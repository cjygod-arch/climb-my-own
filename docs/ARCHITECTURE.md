# 아키텍처 규칙

이 문서는 **파일을 어디에 두는가**에 대한 유일한 근거다. 판단이 갈리면 여기를 따른다.

---

## 1. 의존 방향

의존은 **항상 안쪽(도메인)을 향한다.** 반대 방향 화살표는 존재하지 않는다.

```
  features/<기능>/ui/          ← 화면. DOM을 만든다.
          │
          ▼
  features/<기능>/*.store.js   ← 화면 상태. DOM을 모른다.
  features/<기능>/*.service.js ← 유스케이스. 포트를 호출한다.
          │
          ▼
  domain/ports/*.js            ← 인터페이스 (JSDoc @interface)
          ▲
          │  구현(implements)
  ┌───────┴────────┬──────────────┬──────────────┐
  data/supabase/   data/static/   data/memory/   (data/http/ …)
          ▲
          │  결선(wiring)
  app/container.js               ← 여기 단 한 곳에서만 구현체를 고른다
```

`core/` 와 `shared/` 는 어느 계층에서든 쓸 수 있지만, 반대로 **아무것도 import 하지 않는다.**

---

## 2. 금지 규칙

| # | 규칙 | 이유 |
|---|---|---|
| R1 | `features/**/ui/` 는 `data/` 를 import 하지 않는다 | UI는 저장 방식을 몰라야 교체 시 무수정이 된다 |
| R2 | `domain/` 은 `document`, `fetch`, `supabase` 를 모른다 | 순수 함수여야 테스트·재사용·프레임워크 이식이 가능하다 |
| R3 | `core/` 에 도메인 용어(산·코스·배지)가 등장하지 않는다 | core는 다음 프로젝트에도 그대로 복사될 수 있어야 한다 |
| R4 | `shared/ui/` 컴포넌트는 도메인 엔티티를 받지 않는다 | 원시값·문자열만 받는다. 그래야 재사용된다 |
| R5 | 기능 간 직접 import 금지 (`features/a` → `features/b`) | 필요하면 `core/eventBus.js` 또는 service 계층 조합으로 해결 |
| R6 | 한 파일은 한 가지 이유로만 바뀐다 | 파일명이 곧 그 이유다 |
| R7 | DB 컬럼명(snake_case)은 `data/<어댑터>/` 밖으로 새어나가지 않는다 | 스키마 변경의 파급을 어댑터 안에 가둔다. 행↔엔티티 변환은 `mappers/`가 전담한다 |
| R8 | 외부 라이브러리(Leaflet 등)는 `shared/ui/` 어댑터 안에서만 import 한다 | 라이브러리를 교체해도 화면과 도메인이 흔들리지 않는다 |

### 상태를 어디에 둘지

`*.store.js`로 분리하는 기준은 **화면을 떠나도 살아 있어야 하는가**다.

- 화면 하나만 쓰는 단순 비동기 상태 → 페이지 안에서 `createStore()`로 만든다
- 여러 화면이 공유하거나 화면을 떠나도 유지되어야 함 → `<기능>.store.js`로 승격

그래서 `mountains.store.js`(필터 유지)와 `records.store.js`(선택한 달 유지)는 있고,
`courses.store.js`는 없다. 쓰이지 않는 파일을 규칙 때문에 만들지 않는다.

### 규칙 검증

```bash
# R1 — 0건이어야 한다
grep -rn "data/" src/features --include="*.js" | grep "/ui/"

# R2 — 0건이어야 한다
grep -rnE "document\.|window\.|fetch\(|supabase" src/domain

# R3 — 0건이어야 한다
grep -rniE "mountain|course|badge|hike" src/core

# R5 — 0건이어야 한다 (features 간 직접 import)
grep -rn "from '\.\./\.\./[a-z]*/" src/features --include="*.js" | grep -vE "core/|shared/|domain/|app/"

# R7 — 0건이어야 한다 (DB 컬럼명이 data/ 밖에 등장)
grep -rnE "\b(elevation_m|mountain_id|hiked_on|badge_code|is_official|owner_id)\b" src --include="*.js" | grep -v "src/data/"

# R8 — 0건이어야 한다 (shared/ui 밖에서 지도 라이브러리 직접 사용)
grep -rn "leaflet" src/features src/domain src/core --include="*.js" -i
```

---

## 3. 계층별 책임

| 계층 | 폴더 | 아는 것 | 모르는 것 |
|---|---|---|---|
| 프리미티브 | `src/core/` | JS 언어, DOM API | 도메인, 화면, 저장소 |
| 디자인 시스템 | `src/shared/` | DOM, 토큰 | 도메인, 저장소 |
| 도메인 | `src/domain/` | 비즈니스 규칙 | DOM, I/O, 저장소 구현 |
| 데이터 | `src/data/` | 저장소 프로토콜, DB 스키마 | 화면 |
| 기능 | `src/features/` | 화면 + 유스케이스 | 저장소 구현체 |
| 조립 | `src/app/` | 전부 (여기서만 연결한다) | — |

---

## 4. 새 기능을 추가하는 절차

예시: "산행 사진 첨부" 기능을 넣는다고 하자.

| 순서 | 무엇을 | 어디에 |
|---|---|---|
| 1 | 데이터 개념 정의 | `src/domain/entities/photo.js` |
| 2 | 저장 인터페이스 정의 | `src/domain/ports/photoRepository.js` |
| 3 | 판단·계산 규칙 (있다면) | `src/domain/rules/photoRules.js` |
| 4 | 실제 저장 구현 | `src/data/supabase/photo.repo.js` (+ `data/static/`) |
| 5 | 유스케이스 | `src/features/photos/photos.service.js` |
| 6 | 화면 상태 | `src/features/photos/photos.store.js` |
| 7 | 화면 | `src/features/photos/ui/PhotosPage.js` |
| 8 | 전용 스타일 | `src/features/photos/ui/photos.css` + `index.html` 에 링크 |
| 9 | 결선 | `src/app/container.js` |
| 10 | 경로 등록 | `src/app/routes.js` |

**1~4번을 건너뛰고 5번부터 시작하고 싶어지면, 그게 바로 규칙이 필요한 순간이다.**

---

## 5. 파일 명명 규칙

| 종류 | 형태 | 예 |
|---|---|---|
| UI 컴포넌트 / 페이지 | PascalCase | `MountainListPage.js` |
| 서비스 / 스토어 | `<기능>.<역할>.js` | `records.service.js` |
| 포트 | camelCase + `Repository`/`Gateway` | `recordRepository.js` |
| 어댑터 | `<개념>.repo.js` | `record.repo.js` |
| 규칙 | camelCase 명사 | `badgeRules.js` |
| CSS | 기능명 소문자 | `records.css` |

---

## 6. UI 컴포넌트 계약

모든 UI 함수는 **DOM 엘리먼트를 반환한다.** 부모에 직접 붙이지 않는다.

```js
export function MountainCard({ name, elevationM, onSelect }) {
  // ...
  return el('article', { class: 'card' }, [ ... ])
}
```

상태 구독이 필요한 페이지는 정리 함수(`destroy`)를 엘리먼트에 실어 보낸다.

```js
node.destroy = () => unsubscribe()
```

라우터가 화면을 교체할 때 `destroy()` 를 호출한다.

---

## 7. 프레임워크 이행 경로

React / Vue 로 옮길 때:

| 폴더 | 처리 |
|---|---|
| `src/core/` | 그대로. `store.js` 는 `useSyncExternalStore` 시그니처와 호환된다 |
| `src/domain/` | 그대로 |
| `src/data/` | 그대로 |
| `src/features/**/*.service.js` `*.store.js` | 그대로 |
| `src/features/**/ui/` | 다시 쓴다 |
| `src/shared/ui/` | 다시 쓴다 (`styles/` 는 그대로) |
| `src/app/router.js` `shell/` | 라우터 라이브러리로 교체 |

즉 **다시 쓰는 것은 화면 뿐이다.**

---

## 8. 저장소 교체 경로

| 목표 | 작업 |
|---|---|
| 정적 JSON → Supabase | `config.js` 의 `DATA_SOURCE` 를 `'supabase'` 로 |
| Supabase → 자체 서버 API | `src/data/http/` 에 포트 구현 추가 → `container.js` 에 분기 한 줄 추가 |

두 경우 모두 `src/features/` 와 `src/domain/` 은 수정하지 않는다. 수정해야 한다면 포트 설계가 잘못된 것이다.
