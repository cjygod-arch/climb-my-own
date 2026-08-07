# Climb My Own

한국 100대 명산 코스 안내와 나의 산행 기록을 관리하는 웹앱.

빌드 도구 없는 순수 HTML / CSS / ES6 모듈. 정적 호스팅(GitHub Pages)에 그대로 올라간다.

## 실행

ES6 모듈은 `file://` 프로토콜에서 CORS로 차단된다. 반드시 정적 서버를 경유할 것.

```bash
python -m http.server 5173
# http://localhost:5173
```

## 문서

| 문서 | 내용 |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 레이어 규칙, 의존 방향, 새 기능 추가 절차 |
| [docs/DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md) | 디자인 토큰, 타이포 위계, 아이콘·지도 규칙 |
| [docs/AUTH.md](docs/AUTH.md) | 로그인 정책, 게이트가 걸리는 3개 지점 |
| [docs/TRACKING.md](docs/TRACKING.md) | GPS 안내·걷기 기록 |
| [docs/TRAIL-DATA.md](docs/TRAIL-DATA.md) | 등산로 경로를 OSM에서 만드는 방법 |
| [docs/INSTALL.md](docs/INSTALL.md) | 폰에 설치하기 (PWA), HTTPS 요구사항 |
| [docs/DEPLOY.md](docs/DEPLOY.md) | GitHub Pages 배포, 커스텀 도메인 |
| [supabase/README.md](supabase/README.md) | Supabase 연결 절차, 소셜 로그인 |

## 검사

```bash
node tools/verify-imports.mjs   # import 경로
node tools/verify-data.mjs      # 시드 데이터 정합성
node tools/verify-layers.mjs    # 아키텍처 규칙
node tools/build-seed-sql.mjs   # JSON → 시드 SQL 재생성
```

CI가 배포 전에 전부 실행한다. 하나라도 실패하면 배포가 중단된다.

## 데이터 소스 전환

`src/app/config.js` 의 `DATA_SOURCE` 한 값만 바꾼다. UI 코드는 수정하지 않는다.

```js
export const config = {
  DATA_SOURCE: 'static',   // 'static' | 'memory' | 'supabase'
  ...
}
```

## 기술 스택

- 순수 HTML / CSS / JavaScript (ES2022 모듈)
- 데이터: Supabase (Postgres + RLS), 개발 시 정적 JSON 어댑터로 대체 가능
- 라우팅: 해시 라우터 (GitHub Pages 하위 경로 배포 대응)
- 빌드 단계 없음 — 저장소를 그대로 배포
