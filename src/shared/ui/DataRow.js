/**
 * shared/ui/DataRow.js — 라벨-값 한 행.
 * 카드 대신 이 행 + 1px 헤어라인이 이 앱의 기본 목록 형태다.
 */

import { el } from '../../core/dom.js';
import { icon } from './icons/index.js';

/**
 * @param {{
 *   label: string,
 *   value: string|number|Node,
 *   unit?: string,
 *   onClick?: () => void
 * }} props
 * @returns {HTMLElement}
 */
export function DataRow({ label, value, unit = null, onClick }) {
  const valueNode =
    value instanceof Node
      ? value
      : el('span', { class: 'datarow__value' }, [
          String(value),
          unit && el('span', { class: 't-unit', text: unit }),
        ]);

  const children = [
    el('span', { class: 'datarow__label', text: label }),
    valueNode,
    onClick && el('span', { class: 'datarow__chev' }, [icon('chevronRight', { size: 16 })]),
  ];

  if (!onClick) {
    return el('div', { class: 'datarow' }, children);
  }

  return el('button', { type: 'button', class: 'datarow datarow--action', onClick }, children);
}

/** 헤어라인으로 구분되는 행 묶음 */
export function DataList(rows) {
  return el('div', { class: 'hairlines' }, rows);
}
