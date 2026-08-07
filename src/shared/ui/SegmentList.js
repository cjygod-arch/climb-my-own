/**
 * shared/ui/SegmentList.js — 순차 구간 목록.
 *
 * 지도 대신 쓰는 두 번째 장치. 지점을 순서대로 세로로 잇는다.
 * 도메인을 모른다 — 이미 포맷된 문자열만 받는다 (ARCHITECTURE.md R4).
 * 진행 마크는 원이 아니라 정사각형이다.
 */

import { el } from '../../core/dom.js';

/**
 * @param {{
 *   items: Array<{ title: string, note?: string, primary?: string, secondary?: string }>,
 *   markLast?: boolean
 * }} props
 * @returns {HTMLElement}
 */
export function SegmentList({ items, markLast = true }) {
  return el(
    'ol',
    { class: 'segments hairlines' },
    items.map((item, i) =>
      el('li', { class: 'seg' }, [
        el('span', { class: 'seg__mark' }, [
          el('span', { class: 'seg__line' }),
          el('span', {
            class: ['seg__dot', markLast && i === items.length - 1 && 'seg__dot--end'],
          }),
        ]),
        el('div', { style: { minWidth: '0' } }, [
          el('p', { class: 'seg__name', text: item.title }),
          item.note && el('p', { class: 'seg__note', text: item.note }),
        ]),
        el('div', { class: 'seg__meta' }, [
          item.primary && el('p', { class: 'seg__dist', text: item.primary }),
          item.secondary && el('p', { class: 'seg__elev', text: item.secondary }),
        ]),
      ]),
    ),
  );
}
