/**
 * core/store.js — 구독형 상태 컨테이너.
 *
 * React 이행을 대비해 useSyncExternalStore 시그니처와 호환되도록 설계했다.
 *   useSyncExternalStore(store.subscribe, store.getState)
 * 따라서 getState()는 상태가 바뀌지 않으면 반드시 동일 참조를 돌려줘야 한다.
 */

/**
 * @template S
 * @param {S} initialState
 * @returns {{
 *   getState: () => S,
 *   setState: (patch: Partial<S> | ((s: S) => Partial<S>)) => S,
 *   replace: (next: S) => S,
 *   subscribe: (listener: () => void) => () => void,
 *   select: <T>(selector: (s: S) => T, listener: (v: T) => void) => () => void,
 *   reset: () => S
 * }}
 */
export function createStore(initialState) {
  let state = initialState;
  const listeners = new Set();

  const getState = () => state;

  function notify() {
    // 순회 중 구독 해제가 일어나도 안전하도록 복사본을 돈다.
    for (const listener of Array.from(listeners)) listener();
  }

  function replace(next) {
    if (Object.is(next, state)) return state;
    state = next;
    notify();
    return state;
  }

  /** 얕은 병합. 실제로 바뀐 값이 없으면 참조를 유지하고 알리지 않는다. */
  function setState(patch) {
    const partial = typeof patch === 'function' ? patch(state) : patch;
    if (!partial) return state;

    let changed = false;
    for (const key of Object.keys(partial)) {
      if (!Object.is(state[key], partial[key])) {
        changed = true;
        break;
      }
    }
    if (!changed) return state;

    state = { ...state, ...partial };
    notify();
    return state;
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  /**
   * 일부만 구독한다. 선택값이 바뀔 때만 콜백이 돈다.
   * 즉시 1회 호출하지 않는다 — 초기 렌더는 호출부가 직접 한다.
   */
  function select(selector, listener) {
    let prev = selector(state);
    return subscribe(() => {
      const next = selector(state);
      if (Object.is(prev, next)) return;
      prev = next;
      listener(next);
    });
  }

  function reset() {
    return replace(initialState);
  }

  return { getState, setState, replace, subscribe, select, reset };
}
