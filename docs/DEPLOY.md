# 배포

빌드 단계가 없다. 저장소를 그대로 올린다.

---

## GitHub Pages

### 1. 저장소 준비

```bash
git init
git add .
git commit -m "Climb My Own 초기 구현"
git branch -M main
git remote add origin https://github.com/<사용자>/<저장소>.git
git push -u origin main
```

### 2. Pages 활성화

**Settings → Pages → Build and deployment → Source** 를 **GitHub Actions** 로 바꾼다.

`.github/workflows/deploy.yml` 이 이미 있으므로, main에 push하면 자동으로 검사 후 배포된다.

### 3. 배포 주소

```
https://<사용자>.github.io/<저장소>/
```

**하위 경로로 배포되어도 동작한다.** 이를 위해 두 가지를 지켰다.

| 대응 | 이유 |
|---|---|
| 모든 자산을 상대경로(`./src/...`)로 참조 | 절대경로(`/src/...`)는 하위 경로 배포에서 404가 난다 |
| 해시 라우터(`#/mountains`) 사용 | History API 라우터는 서버의 SPA 폴백 설정이 필요한데, Pages에는 없다 |
| 데이터는 `import.meta.url` 기준으로 해석 | `document.baseURI`에 의존하지 않아 배포 위치와 무관하게 맞는다 |

실제로 `/climb/` 하위 경로에서 전 화면과 지도가 정상 동작함을 확인했다.

---

## 배포 전 검사 (CI가 자동 실행)

```bash
node tools/verify-imports.mjs   # 상대 import 경로가 실제로 존재하는가
node tools/verify-data.mjs      # 산·코스·좌표·배지 정합성
node tools/verify-layers.mjs    # ARCHITECTURE.md 금지 규칙
node tools/build-seed-sql.mjs   # 시드 SQL이 JSON과 일치하는가
```

CI는 이 넷을 모두 통과해야 배포한다. 하나라도 실패하면 배포가 중단된다.

`verify-layers.mjs` 는 문서에만 적힌 규칙을 기계가 강제하도록 만든 것이다.
**문서에만 있는 규칙은 결국 깨진다.**

---

## 다른 정적 호스팅

Netlify·Cloudflare Pages·Vercel 어디든 그대로 올라간다.

| 설정 | 값 |
|---|---|
| Build command | (비움) |
| Output directory | `.` (저장소 루트) |

루트 도메인에 올려도 상대경로라 문제가 없다.

---

## 무료 도메인 연결

1. 무료 도메인 서비스에서 도메인을 발급받는다.
2. DNS에 CNAME 레코드를 추가한다.
   - Name: `@` 또는 `www`
   - Value: `<사용자>.github.io`
3. GitHub **Settings → Pages → Custom domain** 에 도메인을 입력한다.
4. **Enforce HTTPS** 를 켠다 (인증서 발급까지 몇 분에서 한 시간 정도 걸린다).

> 커스텀 도메인을 쓰면 사이트가 루트 경로(`/`)에 놓인다.
> 상대경로 기반이므로 코드 수정은 필요 없다.

Supabase를 연결했다면 **Authentication → URL Configuration → Redirect URLs** 에
새 도메인을 추가해야 소셜 로그인이 돌아온다.

---

## 로컬 확인

```bash
python -m http.server 5173
# http://localhost:5173
```

ES6 모듈은 `file://` 에서 CORS로 차단된다. 반드시 서버를 경유할 것.

하위 경로 배포를 미리 확인하려면 상위 디렉터리에서 서버를 띄우고
`http://localhost:5174/<폴더명>/` 으로 접근한다.
