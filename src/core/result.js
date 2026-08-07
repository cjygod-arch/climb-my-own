/**
 * core/result.js — 명시적 성공/실패 값.
 *
 * 데이터 계층(data/)의 모든 포트 메서드는 예외를 던지지 않고 Result를 반환한다.
 * 그래야 UI가 try/catch 없이 실패를 화면 상태로 다룰 수 있다.
 */

/** @typedef {{ ok: true, value: any }} Ok */
/** @typedef {{ ok: false, error: { code: string, message: string, cause?: unknown } }} Err */

export function ok(value = null) {
  return { ok: true, value };
}

/**
 * @param {string} code 기계가 분기할 식별자 (예: 'NOT_FOUND', 'NETWORK')
 * @param {string} message 사람이 읽을 메시지 (한국어, 화면에 그대로 노출 가능)
 * @param {unknown} [cause]
 */
export function err(code, message, cause) {
  return { ok: false, error: { code, message, cause } };
}

export const isOk = (r) => r?.ok === true;
export const isErr = (r) => r?.ok === false;

/** 성공이면 값을, 실패면 대체값을 돌려준다. */
export function unwrapOr(result, fallback) {
  return isOk(result) ? result.value : fallback;
}

/** 성공 값만 변환한다. 실패는 그대로 통과시킨다. */
export function mapOk(result, fn) {
  return isOk(result) ? ok(fn(result.value)) : result;
}

/**
 * 던질 수 있는 코드를 Result로 감싼다. 어댑터에서 SDK 호출을 감쌀 때 쓴다.
 * @param {() => Promise<any>} fn
 * @param {string} [code]
 */
export async function attempt(fn, code = 'UNEXPECTED') {
  try {
    return ok(await fn());
  } catch (cause) {
    return err(code, cause?.message ?? '알 수 없는 오류가 발생했습니다.', cause);
  }
}

/** 자주 쓰는 오류 코드. 문자열 오타를 막는다. */
export const ErrorCode = Object.freeze({
  NOT_FOUND: 'NOT_FOUND',
  NETWORK: 'NETWORK',
  UNAUTHORIZED: 'UNAUTHORIZED',
  VALIDATION: 'VALIDATION',
  CONFLICT: 'CONFLICT',
  UNEXPECTED: 'UNEXPECTED',
});
