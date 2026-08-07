/**
 * features/mountains/ui/MountainCard.js — 목록의 한 항목.
 *
 * '카드'라는 이름이지만 실제로는 헤어라인으로 구분되는 행이다.
 * 그림자로 띄우지 않고 1px 선으로 나눈다 (docs/DESIGN-SYSTEM.md §5).
 * 표고를 우측에 크게 두어 목록 전체가 수치 열로 읽히게 했다.
 */

import { el } from '../../../core/dom.js';
import { int } from '../../../core/format.js';
import { locationLabel } from '../../../domain/entities/mountain.js';

/**
 * @param {{ mountain: import('../../../domain/entities/mountain.js').Mountain, onSelect: (id:string)=>void }} props
 */
export function MountainCard({ mountain, onSelect }) {
  return el(
    'button',
    {
      type: 'button',
      class: 'mcard',
      onClick: () => onSelect(mountain.id),
    },
    [
      el('div', { class: 'mcard__main' }, [
        el('div', { class: 'row', style: { gap: 'var(--space-2)' } }, [
          el('span', { class: 'mcard__name t-title', text: mountain.name }),
          el('span', { class: 'mcard__diff t-label', text: mountain.difficulty }),
        ]),
        el('p', { class: 'mcard__loc t-caption', text: locationLabel(mountain) }),
        mountain.categories.length > 0 &&
          el('p', { class: 'mcard__tags t-caption', text: mountain.categories.slice(0, 3).join(' · ') }),
      ]),
      el('div', { class: 'mcard__elev' }, [
        el('span', { class: 't-stat-sm', text: int(mountain.elevationM) }),
        el('span', { class: 'mcard__unit t-label', text: 'M' }),
      ]),
    ],
  );
}
