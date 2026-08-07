# Supabase 연결 절차

앱은 Supabase 없이도 `static` 모드로 완전히 동작한다. 아래는 원격 DB로 전환하는 절차다.

---

## 1. 프로젝트 생성

1. https://supabase.com 에서 프로젝트를 만든다 (Region은 `Northeast Asia (Seoul)` 권장).
2. **Project Settings → API** 에서 두 값을 복사한다.
   - `Project URL`
   - `anon` `public` key

> `service_role` key는 **절대** 앱 코드에 넣지 않는다. RLS를 우회하므로 노출되면 전체 데이터가 열린다.
> 이 키는 아래 3단계 SQL 실행(대시보드)에서만 쓰인다.

## 2. 익명 로그인은 꺼둔다

**Authentication → Sign In / Providers → Anonymous sign-ins 를 끈 상태로 둔다.**

이 서비스는 기록하려면 로그인해야 한다. 익명 계정으로 만들어진 데이터는 주인이 없어
기기를 바꾸면 사라지고 나중에 계정과 합칠 방법도 마땅치 않다.
켜져 있으면 누군가 직접 API를 불러 익명 계정을 만들 수 있으므로 꺼두는 편이 안전하다.

정책의 전모는 [docs/AUTH.md](../docs/AUTH.md) 참조.

읽기(산·코스·배지 마스터)는 anon key로 로그인 없이 가능하다 — RLS의 select 정책이 공개다.
쓰기는 `auth.uid()`가 있어야 통과하므로 로그인 없이는 DB 차원에서 막힌다.

## 3. 마이그레이션 실행

**SQL Editor** 에서 아래 순서대로 붙여넣고 실행한다.

| 순서 | 파일 | 내용 |
|---|---|---|
| 1 | `migrations/0001_schema.sql` | 테이블 6개 + 인덱스 + 제약 |
| 2 | `migrations/0002_rls.sql` | RLS 정책 (**필수** — 이게 유일한 방어선) |
| 3 | `migrations/0003_seed_badges.sql` | 배지 마스터 |
| 4 | `migrations/0004_seed_mountains.sql` | 산 · 코스 · 구간 |

0003·0004는 **자동 생성 파일**이다. `public/data/*.json` 을 수정한 뒤

```bash
node tools/build-seed-sql.mjs
```

를 실행해 다시 만든 다음, SQL Editor에서 재실행한다. `on conflict do update`라 여러 번 실행해도 안전하고, 사용자 데이터(기록·획득 배지·내 코스)는 건드리지 않는다.

## 4. 앱 전환

`src/app/config.js` 한 곳만 고친다.

```js
DATA_SOURCE: DataSource.SUPABASE,

supabase: {
  url: 'https://xxxxx.supabase.co',
  anonKey: 'eyJhbGciOi...',
  naverBridgeUrl: '',
}
```

`features/` 와 `domain/` 은 한 줄도 수정하지 않는다. 수정해야 한다면 포트 설계가 잘못된 것이다.

> url이나 anonKey가 비어 있으면 콘솔에 경고를 남기고 자동으로 `static` 모드로 내려간다.
> 앱이 죽지 않으므로 설정 실수를 바로 알아챌 수 있다.

## 5. 소셜 로그인 (필수)

기록 기능을 쓰려면 최소 하나는 설정해야 한다. 설정 전에는 로그인 화면의 버튼이
모두 실패하므로 아무도 기록을 남길 수 없다.

| Provider | 상태 | 설정 |
|---|---|---|
| 카카오 | Supabase 기본 지원 | Authentication → Providers → Kakao 에 REST API 키/시크릿 입력 |
| 구글 | Supabase 기본 지원 | Authentication → Providers → Google 에 클라이언트 ID/시크릿 입력 |
| **네이버** | **기본 미지원** | 아래 참조 |

공통으로 **Authentication → URL Configuration → Redirect URLs** 에 배포 주소를 등록해야 한다.
GitHub Pages라면 `https://<사용자>.github.io/<저장소>/` 형태다.

### 네이버

Supabase는 네이버를 기본 provider로 제공하지 않는다. Edge Function 브릿지가 필요하다.

1. Edge Function을 만들어 네이버 OAuth 콜백을 받는다.
2. 네이버에서 받은 프로필로 `auth.admin` API를 통해 사용자를 생성/조회하고 세션을 발급한다.
3. `config.supabase.naverBridgeUrl` 에 그 함수 주소를 넣는다.

브릿지가 없으면 네이버 버튼은 안내 메시지를 띄우고 아무 일도 하지 않는다.
**중요한 것은 이 차이가 `data/supabase/auth.gateway.js` 안에만 존재한다는 점이다** —
`authGateway` 포트도 로그인 화면도 세 provider를 동일하게 취급한다.

---

## 확인

전환 후 앱의 **내 정보 → 데이터 → 저장소** 가 `Supabase` 로 표시되면 성공이다.

동작 검증은 `docs/ARCHITECTURE.md` 의 "저장소 교체 경로"를 따른다:
`DATA_SOURCE`를 `static` ↔ `supabase` 로 오가며 같은 화면이 나오는지 본다.
