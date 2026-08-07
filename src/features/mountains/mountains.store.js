/**
 * features/mountains/mountains.store.js — 명산 목록 화면 상태.
 *
 * DOM을 모른다. 화면이 무엇을 그릴지 결정할 재료만 담는다.
 * 필터 상태를 스토어에 두는 이유: 상세 화면에 갔다 돌아와도 필터가 유지되도록.
 */

import { createStore } from '../../core/store.js';
import { idle, loading, fromResult } from '../../core/asyncState.js';
import { emptySpec, SORT_KEYS } from '../../domain/rules/filterSpec.js';

/** 모듈 수준 싱글턴. 화면을 떠나도 필터가 살아 있어야 한다. */
export const mountainsStore = createStore({
  source: idle(),
  spec: emptySpec(),
  sortKey: SORT_KEYS.NAME,
});

/**
 * 목록을 불러온다. 이미 불러왔으면 다시 요청하지 않는다 —
 * 100대 명산은 세션 중 바뀌지 않는 데이터다.
 * @param {{ listAll: () => Promise<any> }} service
 * @param {{ force?: boolean }} [options]
 */
export async function loadMountains(service, { force = false } = {}) {
  const { source } = mountainsStore.getState();
  if (!force && source.status === 'success') return;

  mountainsStore.setState({ source: loading(source.data) });
  const result = await service.listAll();
  mountainsStore.setState({ source: fromResult(result) });
}

export function setSpec(spec) {
  mountainsStore.setState({ spec });
}

export function setSortKey(sortKey) {
  mountainsStore.setState({ sortKey });
}

export function resetSpec() {
  mountainsStore.setState({ spec: emptySpec() });
}
