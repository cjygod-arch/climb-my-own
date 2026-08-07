# 데이터 조회 · 스키마 확인 매뉴얼

데이터를 직접 들여다보고 쿼리를 날리는 방법을 정리한다.
스키마의 *내용*은 [ERD.md](ERD.md)에, 여기서는 *접근 방법*만 다룬다.

---

## 목차

1. [먼저: 지금은 데이터베이스가 없다](#1-먼저-지금은-데이터베이스가-없다)
2. [지금 상태에서 데이터 보기 (static 모드)](#2-지금-상태에서-데이터-보기-static-모드)
3. [Supabase 연결 후 — 쿼리 날리는 4가지 방법](#3-supabase-연결-후--쿼리-날리는-4가지-방법)
4. [스키마 살펴보기 쿼리 모음](#4-스키마-살펴보기-쿼리-모음)
5. [이 앱 데이터 확인용 실전 쿼리](#5-이-앱-데이터-확인용-실전-쿼리)
6. [RLS 때문에 결과가 달라 보이는 문제](#6-rls-때문에-결과가-달라-보이는-문제)
7. [연결 없이 스키마만 시험해보기 (Docker)](#7-연결-없이-스키마만-시험해보기-docker)
8. [하지 말아야 할 것](#8-하지-말아야-할-것)

---

## 1. 먼저: 지금은 데이터베이스가 없다

**`src/app/config.js`의 `DATA_SOURCE`가 `static`이고 Supabase URL/anon key가 비어 있다.**
즉 지금 이 앱에는 **접속할 Postgres가 존재하지 않는다.**
`supabase/migrations/*.sql`은 아직 **아무 데도 실행되지 않은 대본**이다.

현재 데이터가 실제로 있는 곳:

| 무엇 | 어디 | 형식 |
|---|---|---|
| 산 · 코스 · 구간 · 배지 마스터 | `public/data/*.json` | JSON (읽기 전용) |
| 산행·걷기 기록, 내 코스, 획득 배지 | 브라우저 localStorage | JSON |
| 로그인 세션, 진행 중 산행 | 브라우저 localStorage | JSON |

그래서 이 문서는 두 갈래다.

- **지금 당장 보고 싶다** → [2장](#2-지금-상태에서-데이터-보기-static-모드)
- **SQL로 제대로 쿼리하고 싶다** → Supabase를 먼저 연결해야 한다.
  절차는 [supabase/README.md](../supabase/README.md), 그 다음 [3장](#3-supabase-연결-후--쿼리-날리는-4가지-방법)

> **현재 모드 확인** — 앱을 열고 브라우저 콘솔에서:
> ```js
> document.documentElement.dataset.source   // 'static' 또는 'supabase'
> ```
> 부팅 시 `src/app/bootstrap.js`가 `<html>`에 심어둔 값이다.
> 프로필 화면 하단에도 같은 값이 표시된다.
>
> `config.js`에 URL/키를 채웠더라도 **둘 중 하나라도 비어 있으면 자동으로 `static`으로 내려간다.**
> 그래서 설정 파일이 아니라 이 값을 봐야 실제 모드를 알 수 있다.

---

## 2. 지금 상태에서 데이터 보기 (static 모드)

### 2.1 공개 콘텐츠 — JSON 파일

파일 구조는 `{ version, note, disclaimer, items: [...] }` 이고,
**실제 데이터는 `items` 배열 안에 있다.** 컬럼명은 DB의 snake_case가 아니라
엔티티의 camelCase다 (`elevation_m` → `elevationM`).

| 파일 | 대응 테이블 | 현재 건수 |
|---|---|---|
| `public/data/mountains.json` | `mountains` | 20 |
| `public/data/courses.json` | `courses` + `course_segments` (중첩) | 61 |
| `public/data/badges.json` | `badges` | 18 |

**Node로 조회한다** (별도 설치 없이 바로 된다):

```bash
# 산 목록 — 권역별 개수
node -e "
const m = require('./public/data/mountains.json').items;
const by = {};
for (const x of m) by[x.region] = (by[x.region] ?? 0) + 1;
console.table(by);
"
```

```bash
# 코스 — 실제 등산로 경로가 있는 것만
node -e "
const c = require('./public/data/courses.json').items;
const has = c.filter(x => x.track && x.track.length);
console.log(\`경로 있음 \${has.length} / 전체 \${c.length}\`);
console.table(has.slice(0, 10).map(x => ({
  id: x.id, 이름: x.name, km: x.distanceKm, 점: x.track.length, 출처: x.trackSource,
})));
"
```

```bash
# 특정 산의 코스와 구간
node -e "
const c = require('./public/data/courses.json').items;
for (const x of c.filter(v => v.mountainId === 'bukhansan')) {
  console.log(\`\n[\${x.id}] \${x.name}  \${x.distanceKm}km  \${x.difficulty}\`);
  console.table(x.segments.map(s => ({
    순번: s.seq, 지점: s.name, 누적km: s.cumDistanceKm, 표고: s.elevationM,
  })));
}
"
```

`jq`가 설치돼 있다면 더 짧다:

```bash
jq '.items | length' public/data/mountains.json
jq -r '.items[] | "\(.id)\t\(.name)\t\(.elevationM)m"' public/data/mountains.json
jq '[.items[] | select(.track != null)] | length' public/data/courses.json
```

### 2.2 사용자 데이터 — 브라우저 localStorage

기록·내 코스·획득 배지는 **파일이 아니라 브라우저 안에** 있다.
앱을 연 브라우저에서 봐야 한다.

**키 목록**

| 키 | 내용 | 대응 테이블 |
|---|---|---|
| `cmo:records` | 산행·걷기 기록 | `hike_records` |
| `cmo:courses` | 사용자가 등록한 내 코스 | `courses` (`isOfficial=false`) |
| `cmo:earned_badges` | 획득한 배지 | `user_badges` |
| `cmo:session` | 로그인 세션 (개발용) | `auth.users` |
| `cmo:active-session` | 진행 중인 산행·걷기 | (테이블 없음 — 기기 로컬) |
| `cmo:anon-user-id` | 예전 익명 id (레거시) | — |

> **키는 데이터가 생겨야 나타난다.** 앱을 처음 열었을 때는 목록이 비어 있는 게 정상이다.
> 로그인하면 `cmo:session`이 생기고, 기록을 하나 남기면 `cmo:records`가 생긴다.
>
> 참고로 로그인 직후 `cmo:session` 값은 이런 모양이다 (static 모드의 개발용 로그인):
> ```json
> {"userId":"af619d2c-…","isAnonymous":false,"provider":"kakao","displayName":"카카오 사용자 (개발용)"}
> ```

**DevTools로 보기**

1. 앱을 연 상태에서 `F12`
2. **Application** 탭 → 좌측 **Storage → Local Storage** → 해당 주소 선택
3. 위 키를 클릭하면 값이 보인다 (하단 패널에서 JSON으로 펼쳐진다)

**콘솔에서 쿼리하듯 보기** — 이쪽이 훨씬 편하다.

```js
// 전체 키 훑기
Object.keys(localStorage).filter(k => k.startsWith('cmo:'))
```

```js
// 기록 목록 — 표로
const rec = JSON.parse(localStorage.getItem('cmo:records') ?? '[]');
console.table(rec.map(r => ({
  일자: r.hikedOn, 종류: r.activityType, 산: r.mountainId || r.title,
  km: r.distanceKm, 분: r.durationMin, 좌표수: r.route?.length ?? 0,
})));
```

```js
// 월별 누적 — SQL의 GROUP BY 대신
const rec = JSON.parse(localStorage.getItem('cmo:records') ?? '[]');
const by = {};
for (const r of rec) {
  const m = r.hikedOn.slice(0, 7);
  by[m] ??= { 횟수: 0, 거리km: 0, 상승m: 0 };
  by[m].횟수 += 1;
  by[m].거리km += Number(r.distanceKm);
  by[m].상승m += Number(r.ascentM);
}
console.table(by);
```

```js
// 획득 배지
console.table(JSON.parse(localStorage.getItem('cmo:earned_badges') ?? '[]'));
```

```js
// 진행 중인 세션 (없으면 null)
JSON.parse(localStorage.getItem('cmo:active-session') ?? 'null')
```

> **폰에 설치한 앱의 데이터를 보려면** 안드로이드 크롬 원격 디버깅을 쓴다.
> 폰에서 개발자 옵션 → USB 디버깅을 켜고 USB로 연결한 뒤,
> PC 크롬에서 `chrome://inspect` → 해당 탭 **inspect**.
> 그러면 위 콘솔 명령을 폰 데이터에 대해 그대로 쓸 수 있다.

### 2.3 초기화

```js
// 사용자 데이터만 지운다 (JSON 콘텐츠는 파일이라 영향 없음)
['records', 'courses', 'earned_badges', 'active-session', 'session']
  .forEach(k => localStorage.removeItem('cmo:' + k));
location.reload();
```

---

## 3. Supabase 연결 후 — 쿼리 날리는 4가지 방법

먼저 [supabase/README.md](../supabase/README.md) 절차로 프로젝트를 만들고
마이그레이션 4개를 실행해야 한다.

방법을 고르는 기준:

| 방법 | 쓸 때 | RLS |
|---|---|---|
| **A. 대시보드 SQL Editor** | 대부분의 경우. 스키마 확인, 데이터 점검 | **우회** (모든 행이 보임) |
| **B. Table Editor** | 값 몇 개만 눈으로 볼 때 | 우회 |
| **C. psql / DB 클라이언트** | 대량 조회, 스크립트, `\d` 같은 메타 명령 | 우회 (직접 접속) |
| **D. REST API (curl)** | 앱이 보는 것과 **똑같이** 확인할 때 | **적용** |

**A~C는 RLS를 우회한다.** 앱에서는 안 보이는 데이터가 여기서는 보인다.
"앱에서 왜 안 나오지?"를 디버깅할 때는 반드시 **D**로 확인해야 한다. ([6장](#6-rls-때문에-결과가-달라-보이는-문제))

### A. 대시보드 SQL Editor — 가장 쉬움

1. https://supabase.com/dashboard → 프로젝트 선택
2. 좌측 **SQL Editor** → **New query**
3. 쿼리를 붙여넣고 `Ctrl+Enter` (또는 **Run**)

자주 쓰는 건 우측 **Save** 로 저장해두면 목록에 남는다.
`Ctrl+Enter`는 **커서가 있는 문장만** 실행하므로, 여러 문장을 한 번에 돌리려면
전체를 드래그해서 선택한 뒤 실행한다.

### B. Table Editor — 클릭으로 보기

좌측 **Table Editor** → 테이블 선택. 정렬·필터·인라인 수정이 된다.
행이 많아지면 느려지므로 확인 용도로만 쓴다.

### C. psql 또는 DB 클라이언트

**연결 문자열은 대시보드에서 복사한다.**
**Project Settings → Database → Connection string** 에서 용도에 맞는 것을 고른다.

| 종류 | 쓸 때 |
|---|---|
| **Direct connection** | psql로 직접 붙을 때. IPv6만 지원하는 경우가 있다 |
| **Session pooler** | IPv6가 안 되는 환경. psql·GUI 클라이언트에 적합 |
| **Transaction pooler** | 서버리스 함수 등 짧은 연결. `\d` 같은 메타 명령이 제한될 수 있다 |

비밀번호는 프로젝트를 만들 때 정한 **DB 비밀번호**다 (anon key가 아니다).
잊었으면 같은 화면에서 재설정한다.

```bash
# 붙기
psql "postgresql://postgres.<프로젝트ref>:<비밀번호>@<호스트>:5432/postgres"
```

Windows에 `psql`이 없으면 셋 중 하나:

- PostgreSQL 설치 시 함께 오는 클라이언트만 설치
- `winget install PostgreSQL.PostgreSQL` 후 `psql` 사용
- GUI를 쓴다 — **DBeaver**, **pgAdmin**, **TablePlus** 모두 위 연결 정보로 붙는다

**psql 메타 명령이 이 문서의 4장 쿼리보다 편할 때가 많다:**

```
\dt public.*              -- 테이블 목록
\d public.courses         -- 컬럼 + 인덱스 + 제약 + FK 한 번에
\d+ public.courses        -- 위 + 설명(comment) + 저장 정보
\di public.*              -- 인덱스 목록
\df public.*              -- 함수 목록
\dp public.courses        -- 권한
\l                        -- 데이터베이스 목록
\x                        -- 결과를 세로로 (컬럼 많을 때 필수)
\timing                   -- 실행 시간 표시
\q                        -- 종료
```

### D. REST API — 앱과 똑같은 경로

Supabase는 테이블을 REST로 자동 노출한다(PostgREST).
**anon key로 호출하면 RLS가 그대로 적용되므로, 앱이 실제로 보는 것과 동일하다.**

```bash
SUPABASE_URL="https://<프로젝트ref>.supabase.co"
ANON="<anon key>"

# 산 목록
curl -s "$SUPABASE_URL/rest/v1/mountains?select=id,name,elevation_m&order=elevation_m.desc&limit=5" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
```

```bash
# 조건 + 조인 (구간까지 한 번에)
curl -s "$SUPABASE_URL/rest/v1/courses?select=id,name,distance_km,course_segments(seq,name,cum_distance_km)&mountain_id=eq.bukhansan" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
```

```bash
# 개수만
curl -s -I "$SUPABASE_URL/rest/v1/mountains?select=id" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
  -H "Prefer: count=exact" | grep -i content-range
```

PowerShell이라면:

```powershell
$h = @{ apikey = $ANON; Authorization = "Bearer $ANON" }
Invoke-RestMethod "$SUPABASE_URL/rest/v1/mountains?select=id,name&limit=5" -Headers $h | Format-Table
```

**필터 문법 요약** (`?컬럼=연산자.값`)

| 쓰고 싶은 것 | 표기 |
|---|---|
| `= 'bukhansan'` | `mountain_id=eq.bukhansan` |
| `> 1500` | `elevation_m=gt.1500` |
| `IN (...)` | `region=in.(강원,제주)` |
| `IS NULL` | `track=is.null` |
| `LIKE '%산%'` | `name=like.*산*` |
| `ORDER BY ... DESC` | `order=elevation_m.desc` |
| `LIMIT 10` | `limit=10` |
| 컬럼 선택 | `select=id,name` |

> 로그인이 필요한 데이터(`hike_records` 등)는 anon key만으로는 **빈 배열**이 온다.
> 정상이다. 사용자 토큰이 있어야 `auth.uid()`가 채워진다 ([6장](#6-rls-때문에-결과가-달라-보이는-문제)).

---

## 4. 스키마 살펴보기 쿼리 모음

SQL Editor나 psql에 그대로 붙여넣으면 된다.

### 4.1 테이블 목록과 행 수

```sql
select
  c.relname                                as 테이블,
  pg_size_pretty(pg_total_relation_size(c.oid)) as 크기,
  c.reltuples::bigint                      as 대략_행수,
  c.relrowsecurity                         as rls_켜짐
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relname;
```

`reltuples`는 통계 기반 추정치다. 정확한 값이 필요하면:

```sql
select 'mountains' as t, count(*) from public.mountains
union all select 'courses',         count(*) from public.courses
union all select 'course_segments', count(*) from public.course_segments
union all select 'hike_records',    count(*) from public.hike_records
union all select 'badges',          count(*) from public.badges
union all select 'user_badges',     count(*) from public.user_badges
order by 1;
```

### 4.2 컬럼 정의 (ERD 정의서와 같은 형태)

```sql
select
  c.table_name                            as 테이블,
  c.ordinal_position                      as 순서,
  c.column_name                           as 컬럼,
  c.data_type                             as 타입,
  coalesce(c.character_maximum_length,
           c.numeric_precision)           as 길이,
  c.is_nullable                           as null허용,
  c.column_default                        as 기본값,
  col_description(pc.oid, c.ordinal_position) as 설명
from information_schema.columns c
join pg_class pc      on pc.relname = c.table_name
join pg_namespace pn  on pn.oid = pc.relnamespace and pn.nspname = c.table_schema
where c.table_schema = 'public'
order by c.table_name, c.ordinal_position;
```

특정 테이블만 보려면 마지막에 조건을 더한다:

```sql
  and c.table_name = 'courses'
```

### 4.3 기본키 · 유니크 · 외래키

```sql
select
  tc.table_name       as 테이블,
  tc.constraint_type  as 종류,
  tc.constraint_name  as 제약명,
  string_agg(kcu.column_name, ', ' order by kcu.ordinal_position) as 컬럼,
  ccu.table_name      as 참조테이블,
  ccu.column_name     as 참조컬럼,
  rc.delete_rule      as 삭제시
from information_schema.table_constraints tc
left join information_schema.key_column_usage kcu
       on kcu.constraint_name = tc.constraint_name
      and kcu.table_schema = tc.table_schema
left join information_schema.referential_constraints rc
       on rc.constraint_name = tc.constraint_name
left join information_schema.constraint_column_usage ccu
       on ccu.constraint_name = tc.constraint_name
      and tc.constraint_type = 'FOREIGN KEY'
where tc.table_schema = 'public'
  and tc.constraint_type in ('PRIMARY KEY', 'UNIQUE', 'FOREIGN KEY')
group by 1,2,3,5,6,7
order by 1, 2;
```

### 4.4 CHECK 제약 — 조건식까지

```sql
select
  rel.relname            as 테이블,
  con.conname            as 제약명,
  pg_get_constraintdef(con.oid) as 조건
from pg_constraint con
join pg_class rel      on rel.oid = con.conrelid
join pg_namespace nsp  on nsp.oid = rel.relnamespace
where nsp.nspname = 'public' and con.contype = 'c'
order by 1, 2;
```

> `courses_ownership_ck`, `hike_records_mountain_ck` 같은 것들이 나와야 한다.
> 안 나오면 `0001_schema.sql`이 제대로 실행되지 않은 것이다.

### 4.5 인덱스 — 정의문 그대로

```sql
select
  tablename  as 테이블,
  indexname  as 인덱스,
  indexdef   as 정의
from pg_indexes
where schemaname = 'public'
order by tablename, indexname;
```

### 4.6 RLS 정책 — 가장 중요

```sql
select
  tablename   as 테이블,
  policyname  as 정책,
  cmd         as 대상,
  roles       as 롤,
  qual        as using절,
  with_check  as withcheck절
from pg_policies
where schemaname = 'public'
order by tablename, cmd, policyname;
```

RLS가 켜져 있는지 자체도 확인한다:

```sql
select relname as 테이블, relrowsecurity as rls_켜짐, relforcerowsecurity as 강제
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by 1;
```

> **`rls_켜짐`이 하나라도 `false`면 그 테이블은 anon key로 통째로 열려 있다.**
> 즉시 `0002_rls.sql`을 다시 실행해야 한다.

### 4.7 테이블 권한 (GRANT)

```sql
select
  table_name as 테이블,
  grantee    as 롤,
  string_agg(privilege_type, ', ' order by privilege_type) as 권한
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated')
group by 1, 2
order by 1, 2;
```

### 4.8 테이블 하나의 DDL을 통째로 보고 싶다면

psql에서는 `\d+ public.courses` 한 줄이면 된다.
SQL Editor에서는 그런 명령이 없으므로, 위 4.2~4.5를 해당 테이블로 필터해서 조합하거나
**Database → Tables** 화면에서 확인한다.

원본이 필요하면 저장소의 [supabase/migrations/0001_schema.sql](../supabase/migrations/0001_schema.sql)이
곧 정답이다 — 이게 실제로 실행된 그 파일이다.

---

## 5. 이 앱 데이터 확인용 실전 쿼리

### 5.1 콘텐츠 적재가 제대로 됐는가

```sql
-- 산별 코스 수. 요구사항은 산마다 최소 3개다.
select m.id, m.name, count(c.id) as 코스수
from public.mountains m
left join public.courses c on c.mountain_id = m.id and c.is_official
group by m.id, m.name
having count(c.id) < 3
order by 3, 1;
```

```sql
-- 실제 등산로 경로가 있는 코스 비율
select
  count(*)                                                   as 전체,
  count(*) filter (where track is not null)                  as 경로있음,
  round(100.0 * count(*) filter (where track is not null)
        / nullif(count(*), 0), 1)                            as 비율_퍼센트
from public.courses
where is_official;
```

```sql
-- 경로 좌표 점 수 (jsonb 배열 길이)
select id, name, track_source, jsonb_array_length(track) as 점수
from public.courses
where track is not null
order by 4 desc
limit 10;
```

> `track_source`는 고정 코드가 아니라 자유 문구다. 현재 값은
> `OpenStreetMap 보행로`(39건) 또는 빈 문자열(22건)이다.
> 화면에 보이는 `개략 경로`는 저장된 값이 아니라 `track`이 없을 때 붙는 라벨이다.

```sql
-- 구간 순번이 0부터 연속인가 (빠진 번호 찾기)
-- ★ 들머리가 seq=0 이다. 1이 아니다.
select course_id, count(*) as 구간수, min(seq), max(seq)
from public.course_segments
group by course_id
having count(*) <> max(seq) - min(seq) + 1 or min(seq) <> 0
order by 1;
```

현재 시드 기준으로 이 쿼리는 **0건**이 나와야 한다 (61개 코스, 구간 291개, 결번 없음).

```sql
-- 누적 거리가 뒤로 갈수록 줄어드는 구간 (데이터 오류)
select course_id, seq, name, cum_distance_km
from (
  select *, lag(cum_distance_km) over (partition by course_id order by seq) as 이전
  from public.course_segments
) t
where 이전 is not null and cum_distance_km < 이전
order by course_id, seq;
```

### 5.2 사용자 데이터

```sql
-- 월별 집계 (앱의 기록 화면과 같은 계산)
select
  to_char(hiked_on, 'YYYY-MM')     as 월,
  count(*)                          as 횟수,
  round(sum(distance_km), 1)        as 거리km,
  sum(ascent_m)                     as 상승m,
  sum(duration_min)                 as 시간분
from public.hike_records
where user_id = '<사용자 uuid>'
group by 1
order by 1 desc;
```

```sql
-- 활동 종류별
select activity_type, count(*), round(sum(distance_km), 1) as 거리km
from public.hike_records
group by 1;
```

```sql
-- 서로 다른 산 몇 곳을 올랐나 (배지 판정의 근거)
select count(distinct mountain_id) as 등정한_산
from public.hike_records
where user_id = '<사용자 uuid>' and mountain_id is not null;
```

```sql
-- 배지 획득 현황
select b.code, b.title, b.tier, ub.earned_at
from public.badges b
left join public.user_badges ub
       on ub.badge_code = b.code and ub.user_id = '<사용자 uuid>'
order by b.sort_order;
```

### 5.3 무결성 점검

```sql
-- CHECK가 막았어야 할 것들이 혹시 들어와 있나
select 'is_official인데 소유자 있음' as 문제, count(*) from public.courses
  where is_official and owner_id is not null
union all
select '내 코스인데 소유자 없음', count(*) from public.courses
  where not is_official and owner_id is null
union all
select '산행인데 mountain_id 없음', count(*) from public.hike_records
  where activity_type = 'hike' and mountain_id is null;
```

세 줄 모두 `0`이어야 한다. 아니라면 제약 없이 데이터가 들어간 것이다.

```sql
-- 고아 행 (FK가 있으면 나올 수 없지만, service_role로 밀어넣다 생길 수 있다)
select cs.id, cs.course_id
from public.course_segments cs
left join public.courses c on c.id = cs.course_id
where c.id is null;
```

### 5.4 사용자 uuid 알아내기

위 쿼리들의 `<사용자 uuid>` 자리에 넣을 값이다.

```sql
select id, email, raw_app_meta_data->>'provider' as 로그인수단,
       created_at, last_sign_in_at
from auth.users
order by created_at desc;
```

앱에서 확인하려면 브라우저 콘솔에:

```js
JSON.parse(localStorage.getItem(
  Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
))?.user?.id
```

---

## 6. RLS 때문에 결과가 달라 보이는 문제

**증상**: SQL Editor에서는 100건이 나오는데 앱에서는 0건이 나온다.

**원인**: SQL Editor·psql·Table Editor는 `service_role` 또는 슈퍼유저로 붙기 때문에
**RLS를 통째로 우회한다.** 앱은 anon key + 사용자 토큰으로 붙으므로 정책이 적용된다.

즉 **A/B/C 방법으로는 "앱에서 보이는가"를 절대 검증할 수 없다.**

### 앱과 같은 조건으로 확인하는 법

**방법 1 — REST API (권장)**

[3장 D](#d-rest-api--앱과-똑같은-경로)의 curl을 쓴다. anon key만 쓰면 로그인 안 한 상태와 같다.
로그인한 상태를 재현하려면 브라우저 콘솔에서 액세스 토큰을 꺼내 `Authorization`에 넣는다.

```js
// 콘솔에서 토큰 꺼내기
JSON.parse(localStorage.getItem(
  Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
))?.access_token
```

```bash
curl -s "$SUPABASE_URL/rest/v1/hike_records?select=*" \
  -H "apikey: $ANON" -H "Authorization: Bearer <위에서 꺼낸 access_token>"
```

**방법 2 — SQL Editor에서 롤을 흉내내기**

한 트랜잭션 안에서 롤과 `auth.uid()`를 바꿔치기한다.

```sql
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"<사용자 uuid>","role":"authenticated"}';

  -- 여기서부터는 그 사용자가 보는 것과 같다
  select count(*) from public.hike_records;
  select id, name, is_official from public.courses limit 10;
rollback;
```

익명(로그인 안 함) 상태를 보려면:

```sql
begin;
  set local role anon;
  select count(*) from public.hike_records;   -- 0 이어야 정상
  select count(*) from public.mountains;      -- 20 이어야 정상
rollback;
```

> `rollback`으로 끝내는 이유는 롤 변경이 세션에 남지 않게 하기 위해서다.
> `set local`은 트랜잭션 범위이므로 `commit`으로 끝내도 되지만,
> 조회만 했다면 `rollback`이 안전하다.

**방법 3 — 특정 행이 정책에 걸리는지 직접 판정**

```sql
-- courses_read 정책의 조건을 그대로 평가해본다
select id, name, is_official, owner_id,
       (is_official or owner_id = '<사용자 uuid>'::uuid) as 읽을수_있나
from public.courses
limit 20;
```

### 자주 겪는 경우

| 증상 | 원인 | 확인 |
|---|---|---|
| 기록이 하나도 안 보임 | 로그인 안 됨 → `auth.uid()`가 null | 콘솔에서 세션 확인 |
| 내 코스가 안 보임 | `owner_id`가 다른 사용자 | `select owner_id from courses where id='...'` |
| 쓰기가 `new row violates row-level security` | INSERT 정책의 `with check` 불통과 | `pg_policies`에서 해당 정책의 `with_check` 확인 |
| 공식 코스를 만들려는데 거부됨 | **정상이다.** `courses_insert_own`이 `is_official=true`를 막는다 | 시드는 SQL Editor에서 넣는다 |

---

## 7. 연결 없이 스키마만 시험해보기 (Docker)

Supabase 계정을 만들지 않고 스키마만 돌려보고 싶을 때 쓴다.
**RLS 정책은 `auth.uid()`에 의존하므로 그대로는 동작하지 않는다** — 테이블 구조 검증용이다.

```bash
docker run --rm -d --name climbdb \
  -e POSTGRES_PASSWORD=dev -p 55432:5432 postgres:15

# auth 스키마와 uid() 함수를 흉내낸다 (0001_schema.sql이 참조하므로)
docker exec -i climbdb psql -U postgres <<'SQL'
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key default gen_random_uuid());
create or replace function auth.uid() returns uuid language sql stable
  as $$ select null::uuid $$;
SQL

# 스키마 투입 (RLS 파일은 건너뛴다 — 롤이 없어 실패한다)
docker exec -i climbdb psql -U postgres < supabase/migrations/0001_schema.sql
docker exec -i climbdb psql -U postgres < supabase/migrations/0003_seed_badges.sql
docker exec -i climbdb psql -U postgres < supabase/migrations/0004_seed_mountains.sql

# 확인
docker exec -it climbdb psql -U postgres -c '\dt public.*'
docker exec -it climbdb psql -U postgres -c '\d public.courses'

# 끝나면
docker rm -f climbdb
```

Docker가 없다면 이 절은 건너뛴다. 4장 쿼리들의 결과를 미리 보고 싶은 것뿐이라면
[ERD.md](ERD.md) 8장(인덱스·제약 일람)에 같은 내용이 표로 정리돼 있다.

---

## 8. 하지 말아야 할 것

| 금지 | 이유 |
|---|---|
| `service_role` 키를 앱 코드·프런트엔드·이 문서의 예시에 넣기 | RLS를 통째로 우회한다. 노출되면 전체 데이터가 열린다. 대시보드에서만 쓴다 |
| `alter table ... disable row level security` | 잠깐 편하자고 껐다가 되돌리는 걸 잊으면 그대로 전체 공개다 |
| Table Editor에서 값을 직접 고쳐 앱 동작 맞추기 | 원인을 못 찾은 채 증상만 덮는다. 시드는 `tools/build-seed-sql.mjs`로 재생성한다 |
| `public/data/*.json`을 손으로 편집 | 시드 SQL의 원천이라 SQL과 어긋난다. 원본을 고치고 재생성한다 |
| 운영 DB에서 `delete`/`update`를 `where` 없이 | Postgres는 되묻지 않는다. 먼저 `select count(*)`로 대상 수를 확인한다 |
| anon key를 비밀로 취급 | 공개 전제로 설계했다. 감추려 애쓰지 말고 RLS를 점검하라 |

**쓰기 전에 항상:**

```sql
-- 1) 몇 건이 걸리는지 먼저 센다
select count(*) from public.courses where mountain_id = 'bukhansan';

-- 2) 맞으면 트랜잭션으로 감싸서 실행하고 확인 후 커밋
begin;
  update public.courses set difficulty = '상' where mountain_id = 'bukhansan';
  select id, name, difficulty from public.courses where mountain_id = 'bukhansan';
-- 결과가 맞으면
commit;
-- 아니면
rollback;
```

---

## 관련 문서

| 문서 | 내용 |
|---|---|
| [ERD.md](ERD.md) | 테이블 정의서, 관계도, 코드 값, 설계 근거 |
| [supabase/README.md](../supabase/README.md) | Supabase 프로젝트 생성과 마이그레이션 실행 절차 |
| [AUTH.md](AUTH.md) | 로그인 정책과 RLS의 관계 |
| [ARCHITECTURE.md](ARCHITECTURE.md) | 어댑터 교체 구조 (static ↔ supabase) |
| [TRAIL-DATA.md](TRAIL-DATA.md) | 등산로 좌표를 만드는 파이프라인 |
