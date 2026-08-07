/**
 * shared/ui/EntryRow.js — 날짜가 붙은 목록 행.
 *
 * 왜 shared에 있는가:
 * 홈과 기록 화면이 같은 형태의 행을 쓴다. 한쪽이 다른 쪽의 컴포넌트를 가져다 쓰면
 * features 간 직접 의존이 생긴다 (ARCHITECTURE.md R5).
 * 공통으로 쓰이는 순간 shared로 올리고, 도메인 타입 대신 원시값만 받게 한다 (R4).
 *
 * 좌측에 일자를 크게 두어 목록 전체가 달력처럼 읽히게 했다.
 */

import { el } from '../../core/dom.js';

/**
 * @param {{
 *   day: string,        // '14'
 *   weekday: string,    // '토'
 *   title: string,
 *   note?: string,
 *   value: string,      // '12.4'
 *   unit?: string,      // 'KM'
 *   onSelect?: () => void
 * }} props
 */
export function EntryRow({ day, weekday, title, note = '', value, unit = '', onSelect }) {
  const children = [
    el('div', { class: 'entry__date' }, [
      el('span', { class: 'entry__day', text: day }),
      el('span', { class: 'entry__dow t-label', text: weekday }),
    ]),

    el('div', { class: 'entry__main' }, [
      el('span', { class: 'entry__title t-body-strong', text: title }),
      note && el('span', { class: 'entry__note t-caption', text: note }),
    ]),

    el('div', { class: 'entry__meta' }, [
      el('span', { class: 'entry__value', text: value }),
      unit && el('span', { class: 'entry__unit t-label', text: unit }),
    ]),
  ];

  if (!onSelect) return el('div', { class: 'entry' }, children);
  return el('button', { type: 'button', class: 'entry', onClick: onSelect }, children);
}
