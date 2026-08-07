-- 0001_schema.sql — 테이블 정의
--
-- 실행: Supabase 대시보드 > SQL Editor 에 이 파일 내용을 붙여넣고 실행한다.
--       또는 supabase CLI 사용 시 `supabase db push`.
--
-- 설계 원칙
--   * id 타입이 둘로 나뉜다.
--       - 콘텐츠(산·코스·구간): text 슬러그. 시드 데이터를 사람이 읽고 관리해야 하므로.
--       - 사용자 데이터(기록): uuid. 클라이언트가 만들지 않고 DB가 발급한다.
--     사용자가 만든 '내 코스'도 courses 테이블을 쓰므로 id는 text이고, 그때는 uuid 문자열이 들어간다.
--   * user_id 기본값을 auth.uid()로 둔다. 클라이언트가 사용자 id를 보내지 않아도 되고,
--     보내더라도 RLS가 다시 검사하므로 위조할 수 없다.

create extension if not exists "pgcrypto";

-- ── 산 (공개 콘텐츠) ────────────────────────────────
create table if not exists public.mountains (
  id           text primary key,
  name         text        not null,
  name_hanja   text        not null default '',
  province     text        not null default '',
  region       text        not null,
  elevation_m  integer     not null,
  categories   text[]      not null default '{}',
  difficulty   text        not null default '중',
  summary      text        not null default '',
  description  text        not null default '',
  best_season  text[]      not null default '{}',
  -- 출처와 검증 여부. verified=false면 화면에 '정보 확인 필요'로 표기된다.
  data_source  text        not null default '',
  verified     boolean     not null default false,
  created_at   timestamptz not null default now()
);

comment on column public.mountains.verified is
  '실측 검증 여부. false면 UI에서 참고값으로 표기한다.';

-- ── 코스 (공식 + 내 코스) ───────────────────────────
create table if not exists public.courses (
  id           text primary key,
  mountain_id  text        not null references public.mountains(id) on delete cascade,
  name         text        not null,
  distance_km  numeric(6,2) not null default 0,
  ascent_m     integer     not null default 0,
  duration_min integer     not null default 0,
  difficulty   text        not null default '중',
  trailhead    text        not null default '',
  endpoint     text        not null default '',
  course_type  text        not null default '원점회귀',
  is_official  boolean     not null default true,
  owner_id     uuid        references auth.users(id) on delete cascade,
  note         text        not null default '',
  -- 실제 등산로를 따라가는 조밀한 좌표열 [[lat,lng], ...].
  -- 있으면 지도가 이것을 그리고, 없으면 구간 지점을 이은 개략 경로로 대체된다.
  -- 좌표가 수백 개라 별도 테이블 대신 jsonb로 둔다 — 항상 통째로 읽고 쓴다.
  track        jsonb,
  track_source text        not null default '',
  created_at   timestamptz not null default now(),

  -- 공식 코스는 소유자가 없고, 내 코스는 반드시 소유자가 있다.
  -- 이 제약이 있으면 RLS 정책이 owner_id만 보고 판단해도 안전하다.
  constraint courses_ownership_ck check (
    (is_official and owner_id is null) or (not is_official and owner_id is not null)
  )
);

create index if not exists courses_mountain_idx on public.courses (mountain_id);
create index if not exists courses_owner_idx    on public.courses (owner_id) where owner_id is not null;

-- ── 구간 (지도·고도 단면의 원천) ────────────────────
create table if not exists public.course_segments (
  id              text primary key,
  course_id       text    not null references public.courses(id) on delete cascade,
  seq             integer not null,
  name            text    not null default '',
  -- 들머리 기준 누적 거리. 구간 거리가 아니다.
  cum_distance_km numeric(6,2) not null default 0,
  elevation_m     integer not null default 0,
  note            text    not null default '',
  -- 좌표는 선택. 없으면 지도에 표시되지 않고 구간 안내만 동작한다.
  lat             double precision,
  lng             double precision,

  constraint course_segments_seq_uk unique (course_id, seq),
  constraint course_segments_latlng_ck check (
    (lat is null and lng is null) or
    (lat between -90 and 90 and lng between -180 and 180)
  )
);

create index if not exists course_segments_course_idx on public.course_segments (course_id, seq);

-- ── 산행 기록 (사용자 데이터) ───────────────────────
create table if not exists public.hike_records (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  mountain_id  text        references public.mountains(id) on delete set null,
  course_id    text        references public.courses(id) on delete set null,
  hiked_on     date        not null,
  distance_km  numeric(6,2) not null default 0,
  ascent_m     integer     not null default 0,
  duration_min integer     not null default 0,
  memo         text        not null default '',
  -- 활동 종류. 산행과 걷기가 같은 표를 쓰고 이 값으로만 구분한다.
  -- 걷기에는 산도 코스도 없으므로 mountain_id가 비어 있다.
  activity_type text       not null default 'hike',
  -- 걷기의 제목. 산행은 산 이름을 쓰므로 보통 비어 있다.
  title        text        not null default '',
  -- 실제로 이동한 경로 [[lat,lng], ...]. 지도에 그린다.
  route        jsonb,
  -- 안내(GPS 트래킹)로 기록한 경우에만 채워진다. 직접 입력한 기록은 비어 있다.
  started_at   timestamptz,
  ended_at     timestamptz,
  created_at   timestamptz not null default now(),

  constraint hike_records_activity_ck check (activity_type in ('hike', 'walk')),
  -- 산행에는 반드시 산이 있어야 한다. 걷기는 없어도 된다.
  constraint hike_records_mountain_ck check (
    activity_type = 'walk' or mountain_id is not null
  ),

  constraint hike_records_distance_ck check (distance_km >= 0 and distance_km <= 200),
  constraint hike_records_duration_ck check (duration_min >= 0 and duration_min <= 2880)
);

-- 월별 조회가 가장 잦다. 사용자별 최신순 정렬을 인덱스로 받는다.
create index if not exists hike_records_user_date_idx on public.hike_records (user_id, hiked_on desc);

-- ── 배지 마스터 (공개 콘텐츠) ───────────────────────
create table if not exists public.badges (
  code        text primary key,
  title       text     not null,
  description text     not null default '',
  -- { type, count, mountainId?, region?, elevationM? }
  -- 판정 로직은 src/domain/rules/badgeRules.js 가 갖는다. 여기엔 기준값만 둔다.
  criteria    jsonb    not null,
  tier        smallint not null default 1,
  sort_order  integer  not null default 0,

  constraint badges_tier_ck check (tier between 1 and 3)
);

-- ── 획득한 배지 (사용자 데이터) ─────────────────────
create table if not exists public.user_badges (
  user_id          uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  badge_code       text        not null references public.badges(code) on delete cascade,
  earned_at        timestamptz not null default now(),
  source_record_id uuid        references public.hike_records(id) on delete set null,

  -- 복합 기본키가 중복 획득을 구조적으로 막는다.
  -- 덕분에 award()를 여러 번 호출해도 최초 획득 시각이 보존된다(멱등).
  primary key (user_id, badge_code)
);

create index if not exists user_badges_user_idx on public.user_badges (user_id);
