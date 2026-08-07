/**
 * tools/fetch-tracks.mjs — 실제 등산로를 따라가는 경로를 만든다.
 *
 * 문제: 구간 지점을 직선으로 이으면 지도의 선이 실제 등산로와 전혀 다른 모양이 된다.
 * 해결: OpenStreetMap에 매핑된 실제 보행로(path/footway/steps/track)를 내려받아
 *       그래프를 만들고, 구간 지점 사이를 그 길을 따라 최단 경로로 잇는다.
 *
 * 곡선을 지어내지 않는다. 실제로 매핑된 길만 쓴다.
 * 길을 찾지 못하면 track을 비워 둔다 — 그러면 앱이 개략 경로로 되돌아가고
 * 화면에도 '개략 경로'로 표기된다. 없는 것을 있는 척하지 않는 편이 낫다.
 *
 * 실행:
 *   node tools/fetch-tracks.mjs            # 아직 track이 없는 코스만
 *   node tools/fetch-tracks.mjs --force    # 전부 다시
 *   node tools/fetch-tracks.mjs seoraksan  # 특정 산만
 *
 * Overpass 응답은 .cache/overpass/ 에 저장한다. 재실행 시 API를 다시 부르지 않는다.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, 'public', 'data');
const cacheDir = join(root, '.cache', 'overpass');
mkdirSync(cacheDir, { recursive: true });

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

/** 들머리·정상이 등산로에서 이만큼 넘게 떨어져 있으면 잘못 찍은 좌표로 본다. */
const MAX_SNAP_M = 600;
/** 두 지점을 잇는 길이 직선거리의 이 배를 넘으면 엉뚱한 길로 돌아간 것으로 본다. */
const MAX_DETOUR_RATIO = 3.0;
/** 전체 경로 길이가 표기 거리와 이 비율 밖으로 벌어지면 채택하지 않는다. */
const LENGTH_TOLERANCE = [0.45, 2.2];

const args = process.argv.slice(2);
const force = args.includes('--force');
const onlyMountain = args.find((a) => !a.startsWith('--')) ?? null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── 지리 계산 ───────────────────────────────────────
const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;

function haversine(a, b) {
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

const pathLengthM = (points) =>
  points.reduce((sum, p, i) => (i === 0 ? 0 : sum + haversine(points[i - 1], p)), 0);

// ── Overpass ────────────────────────────────────────
async function fetchTrails(key, bbox) {
  const cacheFile = join(cacheDir, `${key}.json`);
  if (existsSync(cacheFile)) {
    return JSON.parse(readFileSync(cacheFile, 'utf-8'));
  }

  // 등산로만으로는 부족하다. 들머리(탐방지원센터·주차장)는 대개 도로 위에 있어서
  // 접근로를 포함하지 않으면 첫 구간을 이을 수 없다.
  // 대신 라우팅에서 도로에 가중치를 줘서 등산로가 있으면 그쪽을 택하게 한다.
  const query = `[out:json][timeout:180];
(
  way["highway"~"^(path|footway|steps|track|bridleway|pedestrian|cycleway)$"](${bbox.join(',')});
  way["highway"~"^(residential|unclassified|service|living_street|tertiary|secondary)$"](${bbox.join(',')});
);
out body geom;`;

  let lastError = null;
  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        body: 'data=' + encodeURIComponent(query),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'ClimbMyOwn/0.1 (hiking course seed builder)',
        },
        signal: AbortSignal.timeout(180000),
      });
      if (!res.ok) { lastError = `HTTP ${res.status}`; continue; }

      const json = await res.json();
      writeFileSync(cacheFile, JSON.stringify(json), 'utf-8');
      return json;
    } catch (e) {
      lastError = e.message;
    }
  }
  throw new Error(`Overpass 실패 (${key}): ${lastError}`);
}

// ── 그래프 ──────────────────────────────────────────
/**
 * OSM way들을 노드 그래프로 만든다.
 * 서로 다른 way가 같은 노드 id를 공유하면 그 지점이 갈림길이 된다.
 */
/** 등산로에는 가중치 1, 일반 도로에는 벌점을 준다. 둘 다 있으면 등산로를 택하게 하기 위함. */
const TRAIL_TYPES = new Set(['path', 'footway', 'steps', 'track', 'bridleway', 'pedestrian', 'cycleway']);
const ROAD_PENALTY = 4;

function buildGraph(osm) {
  const coords = new Map();   // nodeId -> [lat, lng]
  const adj = new Map();      // nodeId -> [{ to, dist, cost }]

  const link = (a, b, dist, cost) => {
    if (!adj.has(a)) adj.set(a, []);
    adj.get(a).push({ to: b, dist, cost });
  };

  for (const way of osm.elements) {
    if (way.type !== 'way' || !way.geometry || !way.nodes) continue;

    const isTrail = TRAIL_TYPES.has(way.tags?.highway);
    const weight = isTrail ? 1 : ROAD_PENALTY;

    for (let i = 0; i < way.nodes.length; i += 1) {
      const id = way.nodes[i];
      const g = way.geometry[i];
      if (!g) continue;
      coords.set(id, [g.lat, g.lon]);
    }

    for (let i = 1; i < way.nodes.length; i += 1) {
      const a = way.nodes[i - 1];
      const b = way.nodes[i];
      const ga = way.geometry[i - 1];
      const gb = way.geometry[i];
      if (!ga || !gb) continue;

      const d = haversine([ga.lat, ga.lon], [gb.lat, gb.lon]);
      link(a, b, d, d * weight);
      link(b, a, d, d * weight); // 등산로는 양방향
    }
  }

  return { coords, adj };
}

function nearestNode(graph, point) {
  let best = null;
  let bestDist = Infinity;
  for (const [id, c] of graph.coords) {
    const d = haversine(point, c);
    if (d < bestDist) { bestDist = d; best = id; }
  }
  return { id: best, dist: bestDist };
}

/** 최소 힙. 노드가 3만 개를 넘어가면 배열 정렬로는 감당이 안 된다. */
class MinHeap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(item) {
    const a = this.a;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].c <= a[i].c) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l].c < a[m].c) m = l;
        if (r < a.length && a[r].c < a[m].c) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

/**
 * Dijkstra. 비용(cost)으로 탐색하고 실제 거리(dist)는 따로 누적한다.
 * 도로에 벌점이 있으므로 최소 비용 경로 = 등산로를 우선한 경로가 된다.
 */
function shortestPath(graph, startId, goalId, limitM) {
  const cost = new Map([[startId, 0]]);
  const meters = new Map([[startId, 0]]);
  const prev = new Map();
  const visited = new Set();

  const heap = new MinHeap();
  heap.push({ id: startId, c: 0 });

  while (heap.size) {
    const { id, c } = heap.pop();
    if (visited.has(id)) continue;
    visited.add(id);
    if (id === goalId) break;

    // 실제 거리 기준으로 너무 멀어지면 포기한다.
    if (meters.get(id) > limitM) continue;

    for (const edge of graph.adj.get(id) ?? []) {
      if (visited.has(edge.to)) continue;
      const nc = c + edge.cost;
      if (nc < (cost.get(edge.to) ?? Infinity)) {
        cost.set(edge.to, nc);
        meters.set(edge.to, meters.get(id) + edge.dist);
        prev.set(edge.to, id);
        heap.push({ id: edge.to, c: nc });
      }
    }
  }

  if (!cost.has(goalId)) return null;

  const ids = [];
  for (let cur = goalId; cur !== undefined; cur = prev.get(cur)) {
    ids.push(cur);
    if (cur === startId) break;
  }
  ids.reverse();
  if (ids[0] !== startId) return null;

  const lengthM = meters.get(goalId);
  if (lengthM > limitM) return null;

  return { points: ids.map((id) => graph.coords.get(id)), lengthM };
}

/** 연속한 좌표에서 거의 같은 점을 걸러 파일 크기를 줄인다. */
function simplify(points, minGapM = 8) {
  const out = [];
  for (const p of points) {
    const rounded = [Number(p[0].toFixed(5)), Number(p[1].toFixed(5))];
    if (out.length === 0 || haversine(out[out.length - 1], rounded) >= minGapM) {
      out.push(rounded);
    }
  }
  // 마지막 점은 반드시 살린다.
  const last = [Number(points.at(-1)[0].toFixed(5)), Number(points.at(-1)[1].toFixed(5))];
  if (haversine(out.at(-1), last) > 0) out.push(last);
  return out;
}

// ── 본 작업 ─────────────────────────────────────────
const mountains = JSON.parse(readFileSync(join(dataDir, 'mountains.json'), 'utf-8'));
const coursesFile = JSON.parse(readFileSync(join(dataDir, 'courses.json'), 'utf-8'));

const byMountain = new Map();
for (const course of coursesFile.items) {
  if (!byMountain.has(course.mountainId)) byMountain.set(course.mountainId, []);
  byMountain.get(course.mountainId).push(course);
}

const summary = { built: [], skipped: [], failed: [] };
let apiCalls = 0;

for (const mountain of mountains.items) {
  if (onlyMountain && mountain.id !== onlyMountain) continue;

  const courses = byMountain.get(mountain.id) ?? [];
  const targets = force ? courses : courses.filter((c) => !c.track);
  if (targets.length === 0) continue;

  // 이 산의 모든 구간 지점을 감싸는 bbox + 여유
  const pts = courses.flatMap((c) => c.segments.map((s) => [s.lat, s.lng])).filter((p) => p[0] != null);
  if (pts.length === 0) continue;

  const pad = 0.02; // 약 2km
  const bbox = [
    Math.min(...pts.map((p) => p[0])) - pad,
    Math.min(...pts.map((p) => p[1])) - pad,
    Math.max(...pts.map((p) => p[0])) + pad,
    Math.max(...pts.map((p) => p[1])) + pad,
  ].map((v) => v.toFixed(5));

  const cached = existsSync(join(cacheDir, `${mountain.id}.json`));
  process.stdout.write(`\n[${mountain.name}] ${cached ? '캐시' : 'Overpass 조회'} … `);

  let osm;
  try {
    if (!cached) { apiCalls += 1; }
    osm = await fetchTrails(mountain.id, bbox);
    if (!cached) await sleep(1500); // API 예의
  } catch (e) {
    console.log(`실패 — ${e.message}`);
    for (const c of targets) summary.failed.push(`${c.id}: Overpass 실패`);
    continue;
  }

  const graph = buildGraph(osm);
  console.log(`노드 ${graph.coords.size}개`);

  for (const course of targets) {
    const waypoints = course.segments
      .filter((s) => s.lat != null && s.lng != null)
      .map((s) => ({ name: s.name, p: [s.lat, s.lng] }));

    if (waypoints.length < 2) { summary.skipped.push(`${course.id}: 지점 부족`); continue; }

    // 각 지점을 가장 가까운 등산로 노드에 붙인다.
    const snapped = waypoints.map((w) => ({ ...w, ...nearestNode(graph, w.p) }));
    const tooFar = snapped.find((s) => s.dist > MAX_SNAP_M);
    if (tooFar) {
      summary.skipped.push(
        `${course.id}: '${tooFar.name}'이(가) 등산로에서 ${Math.round(tooFar.dist)}m 떨어짐`,
      );
      continue;
    }

    // 이웃한 지점 사이를 실제 길을 따라 잇는다.
    let track = [];
    let ok = true;
    let totalM = 0;

    for (let i = 1; i < snapped.length; i += 1) {
      const a = snapped[i - 1];
      const b = snapped[i];

      if (a.id === b.id) continue; // 같은 지점(원점회귀 시작=끝)

      const straight = haversine(a.p, b.p);
      const limit = Math.max(straight * MAX_DETOUR_RATIO, 1500);
      const leg = shortestPath(graph, a.id, b.id, limit);

      if (!leg) {
        summary.skipped.push(`${course.id}: '${a.name}' → '${b.name}' 구간 길 없음`);
        ok = false;
        break;
      }

      totalM += leg.lengthM;
      track = track.length ? track.concat(leg.points.slice(1)) : leg.points;
    }

    if (!ok) continue;
    if (track.length < 2) { summary.skipped.push(`${course.id}: 경로 없음`); continue; }

    // 표기 거리와 크게 다르면 엉뚱한 길을 탄 것이다.
    const routedKm = totalM / 1000;
    const ratio = routedKm / course.distanceKm;
    if (ratio < LENGTH_TOLERANCE[0] || ratio > LENGTH_TOLERANCE[1]) {
      summary.skipped.push(
        `${course.id}: 경로 ${routedKm.toFixed(1)}km vs 표기 ${course.distanceKm}km (비율 ${ratio.toFixed(2)})`,
      );
      continue;
    }

    course.track = simplify(track);
    course.trackSource = 'OpenStreetMap 보행로';
    course.trackLengthKm = Number(routedKm.toFixed(2));

    summary.built.push(
      `${course.id}: ${course.track.length}점 / ${routedKm.toFixed(1)}km (표기 ${course.distanceKm}km)`,
    );
  }
}

writeFileSync(
  join(dataDir, 'courses.json'),
  JSON.stringify(coursesFile, null, 2) + '\n',
  'utf-8',
);

const total = coursesFile.items.length;
const withTrack = coursesFile.items.filter((c) => c.track?.length > 1).length;

console.log('\n' + '─'.repeat(60));
console.log(`실제 등산로 적용: ${withTrack} / ${total} 코스 (Overpass 호출 ${apiCalls}회)`);

if (summary.built.length) {
  console.log(`\n생성 ${summary.built.length}건:`);
  for (const s of summary.built) console.log(`  ✓ ${s}`);
}
if (summary.skipped.length) {
  console.log(`\n건너뜀 ${summary.skipped.length}건 (개략 경로 유지):`);
  for (const s of summary.skipped) console.log(`  · ${s}`);
}
if (summary.failed.length) {
  console.log(`\n실패 ${summary.failed.length}건:`);
  for (const s of summary.failed) console.log(`  ✗ ${s}`);
}
