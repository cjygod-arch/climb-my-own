/**
 * domain/ports/locationGateway.js — 현재 위치 인터페이스.
 *
 * GPS를 포트로 감싸는 이유:
 *   - domain은 navigator를 몰라야 한다 (ARCHITECTURE.md R2)
 *   - 실제 GPS 없이도 화면을 개발·검증할 수 있어야 한다 (모의 어댑터로 교체)
 *   - 나중에 백그라운드 추적이나 네이티브 브릿지로 바꿔도 화면이 영향받지 않는다
 *
 * @interface LocationGateway
 *
 * @property {() => boolean} isSupported
 *   이 환경에서 위치를 얻을 수 있는가. HTTPS가 아니면 브라우저가 막는다.
 *
 * @property {() => Promise<Result<Fix>>} getCurrent
 *   한 번만 측정. 시작 직전 위치 확인용.
 *
 * @property {(onFix: (fix: Fix) => void, onError: (error) => void) => () => void} watch
 *   연속 측정. 해제 함수를 돌려준다.
 *   실패는 예외가 아니라 onError로 온다 — 산행 중 신호가 잠깐 끊기는 것은 정상이므로
 *   화면이 죽지 않고 '신호 약함'으로 표시만 바꿀 수 있어야 한다.
 */

/**
 * @typedef {Object} Fix
 * @property {number} lat
 * @property {number} lng
 * @property {number} accuracy 미터
 * @property {number|null} altitude
 * @property {string} at ISO 시각
 */

export const LOCATION_GATEWAY_METHODS = Object.freeze(['isSupported', 'getCurrent', 'watch']);

/** 위치 오류 종류. 화면이 사용자에게 무엇을 해야 하는지 알려줄 수 있게 구분한다. */
export const LocationErrorCode = Object.freeze({
  /** 사용자가 권한을 거부함 — 브라우저 설정에서 허용해야 한다 */
  PERMISSION_DENIED: 'LOCATION_PERMISSION_DENIED',
  /** 신호를 잡지 못함 — 하늘이 보이는 곳으로 이동 */
  UNAVAILABLE: 'LOCATION_UNAVAILABLE',
  /** 시간 초과 — 재시도 가능 */
  TIMEOUT: 'LOCATION_TIMEOUT',
  /** 이 환경에서 지원하지 않음 (HTTPS 아님 등) */
  UNSUPPORTED: 'LOCATION_UNSUPPORTED',
});
