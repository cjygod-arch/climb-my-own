/**
 * core/asyncState.js — 비동기 화면 상태.
 *
 * 모든 목록/상세 화면이 같은 4상태를 갖게 해서 로딩·에러 UI를 일관되게 만든다.
 * store 안에 이 형태를 담고, UI는 renderAsync()로 분기한다.
 */

export const Status = Object.freeze({
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCESS: 'success',
  ERROR: 'error',
});

export const idle = () => ({ status: Status.IDLE, data: null, error: null });
export const loading = (prev = null) => ({ status: Status.LOADING, data: prev, error: null });
export const success = (data) => ({ status: Status.SUCCESS, data, error: null });
export const failure = (error) => ({ status: Status.ERROR, data: null, error });

export const isLoading = (s) => s?.status === Status.LOADING;
export const isSuccess = (s) => s?.status === Status.SUCCESS;
export const isError = (s) => s?.status === Status.ERROR;

/** 로딩 중이라도 이전 데이터가 남아 있으면 그것을 보여줄 수 있다. */
export const hasData = (s) => s?.data !== null && s?.data !== undefined;

/**
 * Result(core/result.js)를 asyncState로 변환한다.
 * 서비스 계층이 반환한 Result를 스토어에 넣기 직전에 쓴다.
 */
export function fromResult(result) {
  return result?.ok ? success(result.value) : failure(result?.error ?? null);
}

/**
 * 상태별 렌더러를 받아 노드를 만든다.
 *
 * @param {object} state asyncState
 * @param {{ loading: () => Node, success: (data:any) => Node, error: (e:any) => Node, idle?: () => Node }} views
 * @returns {Node}
 */
export function renderAsync(state, views) {
  switch (state?.status) {
    case Status.SUCCESS:
      return views.success(state.data);
    case Status.ERROR:
      return views.error(state.error);
    case Status.LOADING:
      return views.loading();
    default:
      return (views.idle ?? views.loading)();
  }
}
