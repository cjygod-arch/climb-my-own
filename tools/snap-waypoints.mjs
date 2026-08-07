/**
 * tools/snap-waypoints.mjs — 구간 지점 좌표를 OSM 실제 좌표로 교정한다.
 *
 * 왜 필요한가:
 * 지점 좌표가 몇백 미터씩 어긋나 있으면 등산로 라우팅이 엉뚱한 길로 돌아간다
 * (711m 거리를 2.8km 돌아가는 식). 선을 예쁘게 그리는 문제가 아니라 좌표가 틀린 문제다.
 *
 * 대서문·백운대·도선사 같은 지점은 OSM에 이름과 함께 실제로 등록되어 있다.
 * 이름이 정확히 일치하는 지형지물을 찾아 그 좌표로 바꾼다.
 *
 * 안전장치
 *   - 이름이 정확히 일치할 때만 바꾼다 (부분 일치 금지)
 *   - 원래 좌표에서 MAX_MOVE_M 이상 떨어진 후보는 동명이인으로 보고 버린다
 *   - 후보가 여럿이면 원래 좌표에 가장 가까운 것을 택한다
 *
 * 실행: node tools/snap-waypoints.mjs [산id] [--dry]
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

/** 이 거리를 넘게 움직여야 한다면 같은 이름의 다른 장소로 본다. */
const MAX_MOVE_M = 2500;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry');
const onlyMountain = args.find((a) => !a.startsWith('--')) ?? null;

const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;
function haversine(a, b) {
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchNamedFeatures(key, bbox) {
  const cacheFile = join(cacheDir, `${key}-names.json`);
  if (existsSync(cacheFile)) return JSON.parse(readFileSync(cacheFile, 'utf-8'));

  const box = bbox.join(',');

  // 이름 있는 모든 것을 받으면 도로명까지 딸려와 응답이 수만 건이 되고, 그래서 서버가 자주 죽는다.
  // 구간 지점이 될 수 있는 종류만 고른다: 봉우리·고개·대피소·탐방센터·사찰·폭포·주차장 등.
  const kinds = [
    'natural', 'mountain_pass', 'tourism', 'amenity', 'historic',
    'place', 'waterway', 'leisure', 'building', 'man_made', 'information',
  ];
  const clauses = kinds
    .flatMap((k) => [`  node["name"]["${k}"](${box});`, `  way["name"]["${k}"](${box});`])
    .join('\n');

  const query = `[out:json][timeout:180];
(
${clauses}
);
out center tags;`;

  // Overpass는 공용 서버라 429/504가 흔하다. 엔드포인트를 돌면서 백오프로 재시도한다.
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    for (const url of ENDPOINTS) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          body: 'data=' + encodeURIComponent(query),
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'ClimbMyOwn/0.1 (hiking course seed builder)',
          },
          signal: AbortSignal.timeout(240000),
        });
        if (!res.ok) {
          lastError = `HTTP ${res.status}`;
          // 429(과부하)·504(타임아웃)는 잠시 뒤 다시 시도하면 대개 된다.
          await sleep(res.status === 429 ? 20000 : 5000);
          continue;
        }
        const json = await res.json();
        writeFileSync(cacheFile, JSON.stringify(json), 'utf-8');
        return json;
      } catch (e) {
        lastError = e.message;
        await sleep(5000);
      }
    }
    await sleep(15000 * (attempt + 1));
  }
  throw new Error(`Overpass 실패 (${key}): ${lastError}`);
}

/** 비교용 정규화. 공백과 가운뎃점만 없앤다 — 그 이상 손대면 다른 곳을 같다고 판단한다. */
const norm = (s) => String(s ?? '').replace(/[\s·・]/g, '');

const mountains = JSON.parse(readFileSync(join(dataDir, 'mountains.json'), 'utf-8'));
const coursesFile = JSON.parse(readFileSync(join(dataDir, 'courses.json'), 'utf-8'));

const byMountain = new Map();
for (const c of coursesFile.items) {
  if (!byMountain.has(c.mountainId)) byMountain.set(c.mountainId, []);
  byMountain.get(c.mountainId).push(c);
}

let moved = 0, kept = 0, notFound = 0, rejected = 0;
const details = [];

for (const mountain of mountains.items) {
  if (onlyMountain && mountain.id !== onlyMountain) continue;
  const courses = byMountain.get(mountain.id) ?? [];
  if (!courses.length) continue;

  const pts = courses.flatMap((c) => c.segments.map((s) => [s.lat, s.lng])).filter((p) => p[0] != null);
  if (!pts.length) continue;

  const pad = 0.03;
  const bbox = [
    Math.min(...pts.map((p) => p[0])) - pad,
    Math.min(...pts.map((p) => p[1])) - pad,
    Math.max(...pts.map((p) => p[0])) + pad,
    Math.max(...pts.map((p) => p[1])) + pad,
  ].map((v) => v.toFixed(5));

  const cached = existsSync(join(cacheDir, `${mountain.id}-names.json`));
  process.stdout.write(`\n[${mountain.name}] ${cached ? '캐시' : '조회'} … `);

  let osm;
  try {
    osm = await fetchNamedFeatures(mountain.id, bbox);
    if (!cached) await sleep(1500);
  } catch (e) {
    console.log(`실패 — ${e.message}`);
    continue;
  }

  // 이름 -> 좌표 후보들
  const index = new Map();
  for (const el of osm.elements) {
    const name = el.tags?.name;
    if (!name) continue;
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (lat == null || lng == null) continue;
    const key = norm(name);
    if (!index.has(key)) index.set(key, []);
    index.get(key).push([lat, lng]);
  }
  console.log(`이름 있는 지형지물 ${index.size}종`);

  // 같은 이름의 지점은 코스마다 반복되므로 한 번만 계산해 재사용한다.
  const resolved = new Map();

  for (const course of courses) {
    for (const s of course.segments) {
      if (s.lat == null || s.lng == null) continue;

      const key = norm(s.name);
      const cacheKey = `${key}@${s.lat},${s.lng}`;

      if (!resolved.has(cacheKey)) {
        const candidates = index.get(key) ?? [];
        if (candidates.length === 0) {
          resolved.set(cacheKey, { status: 'notfound' });
        } else {
          let best = null, bestD = Infinity;
          for (const c of candidates) {
            const d = haversine([s.lat, s.lng], c);
            if (d < bestD) { bestD = d; best = c; }
          }
          resolved.set(cacheKey, bestD > MAX_MOVE_M
            ? { status: 'rejected', dist: bestD }
            : { status: 'ok', point: best, dist: bestD });
        }
      }

      const r = resolved.get(cacheKey);
      if (r.status === 'notfound') { notFound += 1; continue; }
      if (r.status === 'rejected') { rejected += 1; continue; }

      if (r.dist < 1) { kept += 1; continue; }

      details.push(`${mountain.name} · ${s.name}: ${Math.round(r.dist)}m 이동`);
      moved += 1;
      if (!dryRun) {
        s.lat = Number(r.point[0].toFixed(5));
        s.lng = Number(r.point[1].toFixed(5));
      }
    }
  }
}

if (!dryRun) {
  writeFileSync(join(dataDir, 'courses.json'), JSON.stringify(coursesFile, null, 2) + '\n', 'utf-8');
}

console.log('\n' + '─'.repeat(60));
console.log(`교정 ${moved}건 / 이미 정확 ${kept}건 / OSM에 없음 ${notFound}건 / 너무 멂(동명이지) ${rejected}건`);
if (dryRun) console.log('(--dry 모드: 파일을 쓰지 않았다)');

const sample = details.slice(0, 40);
if (sample.length) {
  console.log('\n교정 내역 (일부):');
  for (const d of sample) console.log(`  · ${d}`);
  if (details.length > sample.length) console.log(`  … 외 ${details.length - sample.length}건`);
}
