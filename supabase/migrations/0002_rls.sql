-- 0002_rls.sql — Row Level Security 정책
--
-- ★ 이 파일이 유일한 방어선이다.
--   anon key는 GitHub Pages에 그대로 노출된다(설계상 정상). 누구나 그 키로 API를 호출할 수 있으므로,
--   "무엇을 읽고 쓸 수 있는가"는 전적으로 아래 정책이 결정한다.
--
-- 원칙
--   * 공개 콘텐츠(산·공식코스·구간·배지마스터): 누구나 읽기, 아무도 쓰기 불가.
--     쓰기 정책을 아예 만들지 않으면 RLS가 기본 거부한다. 시드는 service_role로 넣는다(RLS 우회).
--   * 사용자 데이터(기록·내코스·획득배지): 본인 것만. auth.uid() 기준.
--   * 익명 로그인 사용자도 auth.uid()를 가지므로 같은 정책이 그대로 적용된다.

alter table public.mountains       enable row level security;
alter table public.courses         enable row level security;
alter table public.course_segments enable row level security;
alter table public.hike_records    enable row level security;
alter table public.badges          enable row level security;
alter table public.user_badges     enable row level security;

-- ── 산: 전체 공개 읽기 ──────────────────────────────
drop policy if exists mountains_read on public.mountains;
create policy mountains_read on public.mountains
  for select using (true);
-- 쓰기 정책 없음 = 클라이언트 쓰기 불가.

-- ── 배지 마스터: 전체 공개 읽기 ─────────────────────
drop policy if exists badges_read on public.badges;
create policy badges_read on public.badges
  for select using (true);

-- ── 코스: 공식 코스는 모두에게, 내 코스는 본인에게만 ─
drop policy if exists courses_read on public.courses;
create policy courses_read on public.courses
  for select using (is_official or owner_id = (select auth.uid()));

-- 생성은 '내 코스'만 가능하다. is_official=true로 위조해 공식 코스를 만들 수 없다.
drop policy if exists courses_insert_own on public.courses;
create policy courses_insert_own on public.courses
  for insert with check (
    not is_official and owner_id = (select auth.uid())
  );

drop policy if exists courses_update_own on public.courses;
create policy courses_update_own on public.courses
  for update using (owner_id = (select auth.uid()))
          with check (not is_official and owner_id = (select auth.uid()));

drop policy if exists courses_delete_own on public.courses;
create policy courses_delete_own on public.courses
  for delete using (owner_id = (select auth.uid()));

-- ── 구간: 상위 코스의 권한을 그대로 따른다 ──────────
drop policy if exists course_segments_read on public.course_segments;
create policy course_segments_read on public.course_segments
  for select using (
    exists (
      select 1 from public.courses c
      where c.id = course_id
        and (c.is_official or c.owner_id = (select auth.uid()))
    )
  );

drop policy if exists course_segments_write_own on public.course_segments;
create policy course_segments_write_own on public.course_segments
  for all using (
    exists (
      select 1 from public.courses c
      where c.id = course_id and c.owner_id = (select auth.uid())
    )
  ) with check (
    exists (
      select 1 from public.courses c
      where c.id = course_id and c.owner_id = (select auth.uid())
    )
  );

-- ── 산행 기록: 본인 것만 ────────────────────────────
drop policy if exists hike_records_own on public.hike_records;
create policy hike_records_own on public.hike_records
  for all using (user_id = (select auth.uid()))
          with check (user_id = (select auth.uid()));

-- ── 획득 배지: 본인 것만 ────────────────────────────
drop policy if exists user_badges_read_own on public.user_badges;
create policy user_badges_read_own on public.user_badges
  for select using (user_id = (select auth.uid()));

drop policy if exists user_badges_insert_own on public.user_badges;
create policy user_badges_insert_own on public.user_badges
  for insert with check (user_id = (select auth.uid()));

drop policy if exists user_badges_delete_own on public.user_badges;
create policy user_badges_delete_own on public.user_badges
  for delete using (user_id = (select auth.uid()));
-- update 정책 없음 — 획득 시각은 고쳐 쓸 이유가 없다.

-- ── 권한 ────────────────────────────────────────────
-- RLS가 걸린 상태에서 테이블 접근 자체를 허용한다. 실제 행 필터는 위 정책이 한다.
grant usage on schema public to anon, authenticated;
grant select on public.mountains, public.badges, public.courses, public.course_segments to anon, authenticated;
grant select, insert, update, delete on public.courses, public.course_segments, public.hike_records to authenticated;
grant select, insert, delete on public.user_badges to authenticated;
