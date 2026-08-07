/**
 * shared/ui/StatBlock.js — 수치 표시의 기본 단위.
 *
 * 이 프로젝트 타이포 위계의 핵심이다.
 * 수치 44px/800 : 라벨 11px/600 = 4:1 (docs/DESIGN-SYSTEM.md §3)
 * 애니메이션 카운트업을 하지 않는다. 계기판은 튀지 않는다.
 */

import { el } from '../../core/dom.js';

/**
 * @param {{
 *   value: string|number,
 *   label: string,
 *   unit?: string,
 *   size?: 'lg'|'sm',
 *   tone?: 'default'|'accent'|'muted',
 *   labelTop?: boolean
 * }} props
 * @returns {HTMLElement}
 */
export function StatBlock({
  value,
  label,
  unit = null,
  size = 'lg',
  tone = 'default',
  labelTop = false,
}) {
  return el(
    'div',
    {
      class: [
        'stat',
        tone !== 'default' && `stat--${tone}`,
        labelTop && 'stat--label-top',
      ],
    },
    [
      el('div', { class: 'stat__value' }, [
        el('span', {
          class: ['stat__num', size === 'lg' ? 't-stat' : 't-stat-sm'],
          text: String(value),
        }),
        unit && el('span', { class: 't-unit', text: unit }),
      ]),
      el('span', { class: 'stat__label t-label', text: label }),
    ],
  );
}

/**
 * 수치 여러 개를 한 줄에. 밀도 규칙상 4개를 넘기지 않는다.
 * @param {Array<HTMLElement>} stats
 * @param {number} [cols]
 */
export function StatGrid(stats, cols = stats.length) {
  const safeCols = Math.min(Math.max(cols, 1), 4);
  return el('div', { class: 'stat-grid', style: { '--cols': String(safeCols) } }, stats);
}
