-- 0003_seed_badges.sql — 배지 마스터
-- 자동 생성 파일 — 직접 수정하지 말 것.
-- 원천: public/data/badges.json
-- 생성: node tools/build-seed-sql.mjs
--
-- service_role(SQL Editor)로 실행한다. RLS가 쓰기를 막고 있으므로 anon key로는 들어가지 않는다.

insert into public.badges (code, title, description, criteria, tier, sort_order) values
  ('FIRST_STEP', '첫 발자국', '첫 산행을 기록했습니다.', '{"type":"DISTINCT_MOUNTAINS","count":1}'::jsonb, 1, 0),
  ('MOUNTAIN_05', '명산 5', '100대 명산 중 5곳을 올랐습니다.', '{"type":"DISTINCT_MOUNTAINS","count":5}'::jsonb, 1, 1),
  ('MOUNTAIN_10', '명산 10', '100대 명산 중 10곳을 올랐습니다.', '{"type":"DISTINCT_MOUNTAINS","count":10}'::jsonb, 1, 2),
  ('MOUNTAIN_30', '명산 30', '100대 명산 중 30곳을 올랐습니다.', '{"type":"DISTINCT_MOUNTAINS","count":30}'::jsonb, 2, 3),
  ('MOUNTAIN_50', '명산 50', '100대 명산의 절반을 올랐습니다.', '{"type":"DISTINCT_MOUNTAINS","count":50}'::jsonb, 2, 4),
  ('MOUNTAIN_100', '명산 100', '100대 명산을 모두 올랐습니다.', '{"type":"DISTINCT_MOUNTAINS","count":100}'::jsonb, 3, 5),
  ('DISTANCE_100', '누적 100km', '산에서 걸은 거리가 100km에 도달했습니다.', '{"type":"TOTAL_DISTANCE","count":100}'::jsonb, 1, 6),
  ('DISTANCE_500', '누적 500km', '산에서 걸은 거리가 500km에 도달했습니다.', '{"type":"TOTAL_DISTANCE","count":500}'::jsonb, 2, 7),
  ('DISTANCE_1000', '누적 1,000km', '산에서 걸은 거리가 1,000km에 도달했습니다.', '{"type":"TOTAL_DISTANCE","count":1000}'::jsonb, 3, 8),
  ('ASCENT_8848', '8,848', '누적 상승고도가 에베레스트 표고에 도달했습니다.', '{"type":"TOTAL_ASCENT","count":8848}'::jsonb, 2, 9),
  ('ASCENT_30000', '누적 30,000m', '누적 상승고도가 30,000m에 도달했습니다.', '{"type":"TOTAL_ASCENT","count":30000}'::jsonb, 3, 10),
  ('HIGH_1500_05', '고산 5', '표고 1,500m 이상인 산 5곳을 올랐습니다.', '{"type":"HIGH_ALTITUDE","count":5,"elevationM":1500}'::jsonb, 2, 11),
  ('REGION_GANGWON_10', '강원 10', '강원 권역의 명산 10곳을 올랐습니다.', '{"type":"REGION_COUNT","count":10,"region":"강원"}'::jsonb, 2, 12),
  ('REGION_JEJU', '한라 등정', '한라산 정상에 올랐습니다.', '{"type":"SPECIFIC_MOUNTAIN","count":1,"mountainId":"hallasan"}'::jsonb, 2, 13),
  ('STREAK_03', '3개월 연속', '3개월 연속으로 산행을 기록했습니다.', '{"type":"MONTHLY_STREAK","count":3}'::jsonb, 1, 14),
  ('STREAK_06', '6개월 연속', '6개월 연속으로 산행을 기록했습니다.', '{"type":"MONTHLY_STREAK","count":6}'::jsonb, 2, 15),
  ('STREAK_12', '12개월 연속', '1년 동안 매달 산에 올랐습니다.', '{"type":"MONTHLY_STREAK","count":12}'::jsonb, 3, 16),
  ('SINGLE_20', '장거리 20km', '한 번의 산행에서 20km를 걸었습니다.', '{"type":"SINGLE_DISTANCE","count":20}'::jsonb, 2, 17)
on conflict (code) do update set
  title       = excluded.title,
  description = excluded.description,
  criteria    = excluded.criteria,
  tier        = excluded.tier,
  sort_order  = excluded.sort_order;
