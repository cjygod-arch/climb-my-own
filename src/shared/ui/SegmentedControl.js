/**
 * shared/ui/SegmentedControl.js — 각진 세그먼트 전환.
 * 월 선택, 정렬 기준 등 상호 배타 선택에 쓴다.
 */

import { el } from '../../core/dom.js';

/**
 * @param {{
 *   items: Array<{ value: string, label: string }>,
 *   selected: string,
 *   block?: boolean,
 *   ariaLabel?: string,
 *   onSelect: (value: string) => void
 * }} props
 * @returns {HTMLElement}
 */
export function SegmentedControl({ items, selected, block = false, ariaLabel, onSelect }) {
  return el(
    'div',
    {
      class: ['segmented', block && 'segmented--block'],
      role: 'tablist',
      'aria-label': ariaLabel,
    },
    items.map((item) =>
      el('button', {
        type: 'button',
        class: 'segmented__item',
        role: 'tab',
        'aria-selected': String(item.value === selected),
        text: item.label,
        onClick: () => {
          if (item.value !== selected) onSelect(item.value);
        },
      }),
    ),
  );
}
