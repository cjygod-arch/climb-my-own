/**
 * tools/verify-data.mjs — 시드 데이터 정합성 검사.
 *
 * 배포 전에 CI가 돌린다. 깨진 데이터가 올라가는 것을 막는 관문이다.
 * 손으로 확인하던 것들을 전부 여기에 모았다.
 *
 * 실행: node tools/verify-data.mjs
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => JSON.parse(readFileSync(join(root, 'public', 'data', name), 'utf-8'));

const mountains = read('mountains.json').items;
const courses = read('courses.json').items;
const badges = read('badges.json').items;

const errors = [];
const warnings = [];

// 한반도 대략 범위. 이 밖으로 나가면 좌표를 잘못 적은 것이다.
const KOREA = { latMin: 33.0, latMax: 39.0, lngMin: 124.0, lngMax: 132.0 };

const MIN_COURSES_PER_MOUNTAIN = 3;

// ── 산 ──────────────────────────────────────────────
const mountainIds = new Set();
for (const m of mountains) {
  if (mountainIds.has(m.id)) errors.push(`산 id 중복: ${m.id}`);
  mountainIds.add(m.id);

  if (!m.id || !m.name) errors.push(`산에 id/name이 없음: ${JSON.stringify(m).slice(0, 60)}`);
  if (!(m.elevationM > 0)) errors.push(`${m.name}: 표고가 0 이하`);
  if (!m.region) errors.push(`${m.name}: 권역 없음`);
  if (!m.summary) warnings.push(`${m.name}: 한 줄 소개 없음`);
  if (!m.description) warnings.push(`${m.name}: 소개글 없음`);
}

// ── 코스 ────────────────────────────────────────────
const courseIds = new Set();
const perMountain = new Map();

for (const c of courses) {
  if (courseIds.has(c.id)) errors.push(`코스 id 중복: ${c.id}`);
  courseIds.add(c.id);

  if (!mountainIds.has(c.mountainId)) {
    errors.push(`${c.id}: 존재하지 않는 산 참조 (${c.mountainId})`);
  }
  perMountain.set(c.mountainId, (perMountain.get(c.mountainId) ?? 0) + 1);

  const segs = c.segments ?? [];
  if (segs.length < 2) {
    errors.push(`${c.id}: 구간이 2개 미만`);
    continue;
  }

  // seq는 0부터 연속이어야 한다.
  const seqs = segs.map((s) => s.seq);
  const expected = segs.map((_, i) => i);
  if (JSON.stringify(seqs) !== JSON.stringify(expected)) {
    errors.push(`${c.id}: seq가 0부터 연속이 아님 [${seqs.join(',')}]`);
  }

  // 누적 거리는 단조 증가여야 한다.
  const cums = segs.map((s) => s.cumDistanceKm);
  for (let i = 1; i < cums.length; i += 1) {
    if (cums[i] < cums[i - 1]) {
      errors.push(`${c.id}: 누적 거리 역행 (seq${i}: ${cums[i - 1]} → ${cums[i]})`);
      break;
    }
  }

  // 마지막 누적 거리 = 코스 총 거리
  const last = cums[cums.length - 1];
  if (Math.abs(last - c.distanceKm) > 0.15) {
    errors.push(`${c.id}: distanceKm(${c.distanceKm})와 마지막 누적(${last})이 다름`);
  }

  // 상승고도 = 구간별 오름의 합
  const ascent = segs.reduce(
    (sum, s, i) => (i === 0 ? 0 : sum + Math.max(0, s.elevationM - segs[i - 1].elevationM)),
    0,
  );
  if (c.ascentM && Math.abs(ascent - c.ascentM) > Math.max(80, c.ascentM * 0.25)) {
    errors.push(`${c.id}: ascentM(${c.ascentM})와 구간 합(${ascent})이 크게 다름`);
  }

  // 좌표
  for (const s of segs) {
    if (s.lat === null || s.lat === undefined || s.lng === null || s.lng === undefined) {
      errors.push(`${c.id} seq${s.seq}(${s.name}): 좌표 없음`);
    } else if (
      s.lat < KOREA.latMin || s.lat > KOREA.latMax ||
      s.lng < KOREA.lngMin || s.lng > KOREA.lngMax
    ) {
      errors.push(`${c.id} seq${s.seq}(${s.name}): 좌표가 한반도 밖 (${s.lat}, ${s.lng})`);
    }
  }

  if (!c.name) errors.push(`${c.id}: 코스 이름 없음`);
  if (!(c.distanceKm > 0)) errors.push(`${c.id}: 거리가 0 이하`);

  // 실제 등산로 경로가 있으면, 그 시작·끝이 첫·마지막 지점과 맞아야 한다.
  // 라우팅이 엉뚱한 곳으로 갔는데 길이 검사만 통과한 경우를 잡는다.
  if (Array.isArray(c.track) && c.track.length > 1) {
    const withCoords = segs.filter((s) => s.lat != null);
    if (withCoords.length >= 2) {
      const startGap = haversineM(c.track[0], [withCoords[0].lat, withCoords[0].lng]);
      const endGap = haversineM(c.track.at(-1), [withCoords.at(-1).lat, withCoords.at(-1).lng]);
      if (startGap > 700) errors.push(`${c.id}: track 시작이 들머리에서 ${Math.round(startGap)}m 떨어짐`);
      if (endGap > 700) errors.push(`${c.id}: track 끝이 날머리에서 ${Math.round(endGap)}m 떨어짐`);
    }
    for (const [lat, lng] of c.track) {
      if (lat < KOREA.latMin || lat > KOREA.latMax || lng < KOREA.lngMin || lng > KOREA.lngMax) {
        errors.push(`${c.id}: track 좌표가 한반도 밖 (${lat}, ${lng})`);
        break;
      }
    }
    if (!c.trackSource) warnings.push(`${c.id}: track은 있는데 trackSource 표기가 없음`);
  }
}

function haversineM(a, b) {
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

// 산마다 코스 최소 개수
for (const m of mountains) {
  const n = perMountain.get(m.id) ?? 0;
  if (n < MIN_COURSES_PER_MOUNTAIN) {
    errors.push(`${m.name}: 코스가 ${n}개 (최소 ${MIN_COURSES_PER_MOUNTAIN}개 필요)`);
  }
}

// ── 배지 ────────────────────────────────────────────
const CRITERIA_TYPES = new Set([
  'DISTINCT_MOUNTAINS', 'TOTAL_DISTANCE', 'TOTAL_ASCENT', 'SPECIFIC_MOUNTAIN',
  'REGION_COUNT', 'HIGH_ALTITUDE', 'MONTHLY_STREAK', 'SINGLE_DISTANCE',
]);

const badgeCodes = new Set();
for (const b of badges) {
  if (badgeCodes.has(b.code)) errors.push(`배지 code 중복: ${b.code}`);
  badgeCodes.add(b.code);

  if (!CRITERIA_TYPES.has(b.criteria?.type)) {
    errors.push(`${b.code}: 알 수 없는 기준 타입 (${b.criteria?.type})`);
  }
  // 특정 산 배지가 없는 산을 가리키면 영원히 획득할 수 없다.
  if (b.criteria?.type === 'SPECIFIC_MOUNTAIN' && !mountainIds.has(b.criteria.mountainId)) {
    errors.push(`${b.code}: 존재하지 않는 산을 가리킴 (${b.criteria.mountainId})`);
  }
  if (b.tier < 1 || b.tier > 3) errors.push(`${b.code}: tier가 1~3 범위 밖 (${b.tier})`);
}

// ── 결과 ────────────────────────────────────────────
const segmentCount = courses.reduce((n, c) => n + (c.segments?.length ?? 0), 0);
console.log(`산 ${mountains.length}곳 / 코스 ${courses.length}개 / 구간 ${segmentCount}개 / 배지 ${badges.length}개`);

if (warnings.length) {
  console.log(`\n경고 ${warnings.length}건:`);
  for (const w of warnings) console.log(`  · ${w}`);
}

if (errors.length) {
  console.error(`\n오류 ${errors.length}건:`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}

console.log('\n데이터 정합성 OK');
