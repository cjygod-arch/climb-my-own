/**
 * domain/ports/authGateway.js — 인증 인터페이스.
 *
 * ★ 정책: 기록하려면 로그인해야 한다.
 *   다중 사용자 서비스이므로 산행·걷기·내 코스 등 **모든 쓰기 작업은 로그인한 사용자만** 할 수 있다.
 *   익명 세션으로 기록을 만들지 않는다 — 기기를 바꾸면 사라지고, 계정에 귀속되지 않아
 *   나중에 합칠 방법도 없다.
 *
 *   반대로 **읽기는 로그인 없이도 된다.** 100대 명산 소개와 코스 안내는 공개 콘텐츠다.
 *   서비스를 둘러보다가 기록할 마음이 생겼을 때 로그인하면 된다.
 *
 * UI는 provider 이름 문자열만 알고, OAuth 흐름은 전혀 모른다.
 * 네이버는 Supabase 기본 제공 provider가 아니라 Edge Function 브릿지가 필요하지만,
 * 그 차이는 어댑터 안에 갇히고 이 계약은 바뀌지 않는다.
 *
 * @interface AuthGateway
 *
 * @property {() => Promise<Result<Session|null>>} ensureSession
 *   저장된 세션을 복구한다. 없으면 null — 새로 만들지 않는다.
 *   부팅 시 1회 호출.
 *
 * @property {() => Session|null} getSession
 *   동기 조회. 현재 캐시된 세션.
 *
 * @property {() => boolean} isAuthenticated
 *   기록을 남길 수 있는 상태인가. 이 값이 false면 모든 쓰기가 거부된다.
 *
 * @property {(provider: string) => Promise<Result<Session|null>>} signIn
 *   PROVIDERS 중 하나. 리디렉션이 일어나므로 성공 시 세션이 없을 수 있다
 *   (돌아온 뒤 onChange로 전달된다).
 *
 * @property {() => Promise<Result<null>>} signOut
 *
 * @property {(listener: (session: Session|null) => void) => () => void} onChange
 *   세션 변화 구독. 해제 함수를 돌려준다.
 */

/**
 * @typedef {Object} Session
 * @property {string} userId
 * @property {boolean} isAnonymous  더 이상 쓰지 않는다. 남겨둔 이유는 아래 주석 참조
 * @property {string|null} provider 'kakao' | 'google' | 'naver'
 * @property {string|null} displayName
 */

/**
 * 허용 로그인 수단. 이 셋 외에는 추가하지 않는다.
 * label은 화면에 그대로 노출된다.
 */
export const PROVIDERS = Object.freeze([
  { id: 'kakao', label: '카카오로 시작하기' },
  { id: 'google', label: 'Google로 시작하기' },
  { id: 'naver', label: '네이버로 시작하기' },
]);

export const PROVIDER_IDS = Object.freeze(PROVIDERS.map((p) => p.id));

export const AUTH_GATEWAY_METHODS = Object.freeze([
  'ensureSession',
  'getSession',
  'isAuthenticated',
  'signIn',
  'signOut',
  'onChange',
]);

/**
 * 로그인한 사용자로 볼 수 있는가.
 *
 * isAnonymous를 여전히 확인하는 이유:
 * 익명 로그인을 쓰던 시절의 세션이 브라우저에 남아 있을 수 있다.
 * 그 세션으로 기록이 만들어지면 계정에 귀속되지 않으므로 명시적으로 걸러낸다.
 *
 * @param {Session|null} session
 */
export function isAuthenticatedSession(session) {
  return Boolean(session?.userId && !session.isAnonymous && session.provider);
}

/** 로그인이 필요할 때 쓰는 표준 오류 메시지. 여러 곳에서 같은 문구를 쓰기 위해. */
export const LOGIN_REQUIRED_MESSAGE = '기록하려면 로그인이 필요합니다.';
