/**
 * features/records/records.store.js — 월별 기록 화면 상태.
 *
 * 선택한 달을 모듈 수준에 둔다. 기록 상세를 보고 돌아왔을 때
 * 3월을 보고 있었다면 3월로 돌아와야 하기 때문이다.
 */

import { createStore } from '../../core/store.js';
import { idle, loading, fromResult } from '../../core/asyncState.js';
import { shiftMonth } from '../../domain/rules/monthlyStats.js';
import { config } from '../../app/config.js';

export const recordsStore = createStore({
  monthKey: config.thisMonth(),
  view: idle(),
});

/**
 * @param {{ getMonthlyView: (monthKey: string) => Promise<any> }} service
 */
export async function loadMonth(service, monthKey = recordsStore.getState().monthKey) {
  recordsStore.setState({ monthKey, view: loading(recordsStore.getState().view.data) });
  const result = await service.getMonthlyView(monthKey);
  // 요청 중 사용자가 달을 또 넘겼다면 늦게 도착한 응답을 버린다.
  if (recordsStore.getState().monthKey !== monthKey) return;
  recordsStore.setState({ view: fromResult(result) });
}

export function stepMonth(service, delta) {
  return loadMonth(service, shiftMonth(recordsStore.getState().monthKey, delta));
}

export function invalidate() {
  recordsStore.setState({ view: idle() });
}
