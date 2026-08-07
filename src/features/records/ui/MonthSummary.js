/**
 * features/records/ui/MonthSummary.js — 이번 달 수치.
 *
 * "누적 킬로수"가 이 앱에서 가장 자주 보게 될 숫자다.
 * 44px/800 로 크게 두고, 나머지는 보조 수치로 내린다.
 */

import { el } from '../../../core/dom.js';
import { km, int, clock } from '../../../core/format.js';
import { StatBlock, StatGrid } from '../../../shared/ui/StatBlock.js';

/**
 * @param {{ stat: import('../../../domain/rules/monthlyStats.js').MonthlyStat }} props
 */
export function MonthSummary({ stat }) {
  return el('div', { class: 'stack stack--5' }, [
    StatBlock({ value: km(stat.distanceKm), unit: 'km', label: '이번 달 누적 거리' }),

    StatGrid(
      [
        StatBlock({ value: int(stat.count), unit: '회', label: '산행', size: 'sm' }),
        StatBlock({ value: int(stat.ascentM), unit: 'm', label: '상승고도', size: 'sm' }),
        StatBlock({ value: clock(stat.durationMin), unit: 'h', label: '소요시간', size: 'sm' }),
      ],
      3,
    ),
  ]);
}

/**
 * 최근 몇 달의 거리 추이. 막대는 액센트가 아니라 무채색으로,
 * 현재 선택한 달만 액센트로 표시한다.
 *
 * @param {{ months: Array<{monthKey:string, distanceKm:number}>, activeKey: string, onSelect: (k:string)=>void }} props
 */
export function MonthTrend({ months, activeKey, onSelect }) {
  if (months.length === 0) return el('div');
  const max = Math.max(...months.map((m) => m.distanceKm), 1);

  return el(
    'div',
    { class: 'trend' },
    months.map((m) =>
      el(
        'button',
        {
          type: 'button',
          class: 'trend__col',
          'aria-pressed': String(m.monthKey === activeKey),
          'aria-label': `${m.monthKey} ${m.distanceKm}km`,
          onClick: () => onSelect(m.monthKey),
        },
        [
          el('span', { class: 'trend__bar-wrap' }, [
            el('span', {
              class: 'trend__bar',
              style: { height: `${Math.max((m.distanceKm / max) * 100, 2)}%` },
            }),
          ]),
          el('span', { class: 'trend__label', text: m.monthKey.slice(5).replace(/^0/, '') }),
        ],
      ),
    ),
  );
}
