/**
 * shared/ui/Chip.js — 필터 칩 / 태그.
 * 활성 상태는 aria-pressed로만 표현한다. CSS가 그 속성을 보고 스타일을 바꾼다.
 */

import { el } from '../../core/dom.js';

/**
 * @param {{
 *   label: string,
 *   value?: string,
 *   active?: boolean,
 *   count?: number|null,
 *   onToggle?: (value: string, nextActive: boolean) => void
 * }} props
 * @returns {HTMLElement}
 */
export function Chip({ label, value = label, active = false, count = null, onToggle }) {
  if (!onToggle) {
    return el('span', { class: 'chip chip--static' }, [label]);
  }

  return el(
    'button',
    {
      type: 'button',
      class: 'chip',
      'aria-pressed': String(active),
      dataset: { value },
      onClick: () => onToggle(value, !active),
    },
    [
      label,
      count !== null && el('span', { class: 'chip__count', text: String(count) }),
    ],
  );
}

/**
 * 칩 묶음. 가로 스크롤 트랙에 담는다.
 * @param {Array<HTMLElement>} chips
 * @param {{ scroll?: boolean }} [options]
 */
export function ChipGroup(chips, { scroll = true } = {}) {
  return el('div', { class: scroll ? 'scroller' : 'row row--wrap' }, chips);
}

/** 정보 표시용 정적 태그 (미검증 표기 등) */
export function Tag(label, { tone = 'default' } = {}) {
  return el('span', { class: ['tag', tone !== 'default' && `tag--${tone}`], text: label });
}
