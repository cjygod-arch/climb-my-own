/**
 * tools/build-seed-sql.mjs — public/data/*.json → supabase/migrations/000X_seed_*.sql
 *
 * 시드 SQL을 손으로 쓰지 않는 이유:
 * JSON과 SQL을 각각 관리하면 반드시 어긋난다. JSON을 단일 원천으로 두고 SQL은 생성물로 취급한다.
 * 산 데이터를 추가하면 이 스크립트를 다시 돌리기만 하면 된다.
 *
 * 실행: node tools/build-seed-sql.mjs
 *
 * 생성된 SQL은 멱등이다(on conflict do update). 여러 번 실행해도 안전하다.
 * 단, 사용자 데이터(hike_records, user_badges, 내 코스)는 건드리지 않는다.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, 'public', 'data');
const outDir = join(root, 'supabase', 'migrations');

mkdirSync(outDir, { recursive: true });

const readJson = (name) => JSON.parse(readFileSync(join(dataDir, name), 'utf-8'));

/** SQL 문자열 리터럴. 작은따옴표를 두 번 써서 이스케이프한다. */
const q = (value) => `'${String(value ?? '').replace(/'/g, "''")}'`;
/** text[] 리터럴 */
const arr = (list) => `ARRAY[${(list ?? []).map(q).join(', ')}]::text[]`;
/** 숫자 또는 NULL */
const num = (value) => (value === null || value === undefined || value === '' ? 'NULL' : Number(value));
const bool = (value) => (value ? 'TRUE' : 'FALSE');
/** jsonb 리터럴 */
const json = (value) => `${q(JSON.stringify(value))}::jsonb`;

const header = (title, source) => `-- ${title}
-- 자동 생성 파일 — 직접 수정하지 말 것.
-- 원천: public/data/${source}
-- 생성: node tools/build-seed-sql.mjs
--
-- service_role(SQL Editor)로 실행한다. RLS가 쓰기를 막고 있으므로 anon key로는 들어가지 않는다.

`;

// ── 배지 ────────────────────────────────────────────
function buildBadges() {
  const { items } = readJson('badges.json');

  const rows = items.map((b, i) =>
    `  (${q(b.code)}, ${q(b.title)}, ${q(b.description)}, ${json(b.criteria)}, ${b.tier ?? 1}, ${i})`,
  );

  return (
    header('0003_seed_badges.sql — 배지 마스터', 'badges.json') +
    `insert into public.badges (code, title, description, criteria, tier, sort_order) values\n` +
    rows.join(',\n') +
    `\non conflict (code) do update set
  title       = excluded.title,
  description = excluded.description,
  criteria    = excluded.criteria,
  tier        = excluded.tier,
  sort_order  = excluded.sort_order;\n`
  );
}

// ── 산 · 코스 · 구간 ────────────────────────────────
function buildMountains() {
  const mountains = readJson('mountains.json').items;
  const courses = readJson('courses.json').items;

  const mountainIds = new Set(mountains.map((m) => m.id));
  const orphans = courses.filter((c) => !mountainIds.has(c.mountainId));
  if (orphans.length) {
    throw new Error(`존재하지 않는 산을 참조하는 코스: ${orphans.map((c) => c.id).join(', ')}`);
  }

  const mountainRows = mountains.map((m) =>
    `  (${q(m.id)}, ${q(m.name)}, ${q(m.nameHanja)}, ${q(m.province)}, ${q(m.region)}, ` +
    `${num(m.elevationM)}, ${arr(m.categories)}, ${q(m.difficulty)}, ${q(m.summary)}, ` +
    `${q(m.description)}, ${arr(m.bestSeason)}, ${q(m.dataSource)}, ${bool(m.verified)})`,
  );

  const courseRows = courses.map((c) =>
    `  (${q(c.id)}, ${q(c.mountainId)}, ${q(c.name)}, ${num(c.distanceKm)}, ${num(c.ascentM)}, ` +
    `${num(c.durationMin)}, ${q(c.difficulty)}, ${q(c.trailhead)}, ${q(c.endpoint)}, ` +
    `${q(c.courseType)}, TRUE, NULL, ${q(c.note)}, ` +
    `${c.track?.length > 1 ? json(c.track) : 'NULL'}, ${q(c.trackSource ?? '')})`,
  );

  // 구간 id는 코스 id + seq로 만든다. JSON에 id를 중복해서 적지 않아도 되고 충돌하지 않는다.
  const segmentRows = courses.flatMap((c) =>
    (c.segments ?? []).map((s) =>
      `  (${q(`${c.id}-${s.seq}`)}, ${q(c.id)}, ${s.seq}, ${q(s.name)}, ` +
      `${num(s.cumDistanceKm)}, ${num(s.elevationM)}, ${q(s.note)}, ${num(s.lat)}, ${num(s.lng)})`,
    ),
  );

  return (
    header('0004_seed_mountains.sql — 산 · 코스 · 구간', 'mountains.json + courses.json') +
    `-- 산 ${mountains.length}곳 / 코스 ${courses.length}개 / 구간 ${segmentRows.length}개\n\n` +

    `insert into public.mountains
  (id, name, name_hanja, province, region, elevation_m, categories, difficulty, summary, description, best_season, data_source, verified) values\n` +
    mountainRows.join(',\n') +
    `\non conflict (id) do update set
  name        = excluded.name,
  name_hanja  = excluded.name_hanja,
  province    = excluded.province,
  region      = excluded.region,
  elevation_m = excluded.elevation_m,
  categories  = excluded.categories,
  difficulty  = excluded.difficulty,
  summary     = excluded.summary,
  description = excluded.description,
  best_season = excluded.best_season,
  data_source = excluded.data_source,
  verified    = excluded.verified;\n\n` +

    `insert into public.courses
  (id, mountain_id, name, distance_km, ascent_m, duration_min, difficulty, trailhead, endpoint, course_type, is_official, owner_id, note, track, track_source) values\n` +
    courseRows.join(',\n') +
    `\non conflict (id) do update set
  mountain_id  = excluded.mountain_id,
  name         = excluded.name,
  distance_km  = excluded.distance_km,
  ascent_m     = excluded.ascent_m,
  duration_min = excluded.duration_min,
  difficulty   = excluded.difficulty,
  trailhead    = excluded.trailhead,
  endpoint     = excluded.endpoint,
  course_type  = excluded.course_type,
  note         = excluded.note,
  track        = excluded.track,
  track_source = excluded.track_source;\n\n` +

    `insert into public.course_segments
  (id, course_id, seq, name, cum_distance_km, elevation_m, note, lat, lng) values\n` +
    segmentRows.join(',\n') +
    `\non conflict (id) do update set
  course_id       = excluded.course_id,
  seq             = excluded.seq,
  name            = excluded.name,
  cum_distance_km = excluded.cum_distance_km,
  elevation_m     = excluded.elevation_m,
  note            = excluded.note,
  lat             = excluded.lat,
  lng             = excluded.lng;\n\n` +

    `-- 시드에서 사라진 공식 코스의 구간을 정리한다(코스 자체는 cascade로 지워진다).
delete from public.course_segments s
 where not exists (select 1 from public.courses c where c.id = s.course_id);\n`
  );
}

writeFileSync(join(outDir, '0003_seed_badges.sql'), buildBadges(), 'utf-8');
writeFileSync(join(outDir, '0004_seed_mountains.sql'), buildMountains(), 'utf-8');

const m = readJson('mountains.json').items.length;
const c = readJson('courses.json').items.length;
const s = readJson('courses.json').items.reduce((n, x) => n + (x.segments?.length ?? 0), 0);
const b = readJson('badges.json').items.length;
console.log(`생성 완료 — 산 ${m} / 코스 ${c} / 구간 ${s} / 배지 ${b}`);
