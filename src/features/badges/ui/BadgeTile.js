/**
 * features/badges/ui/BadgeTile.js — 사각 배지 타일.
 *
 * 참고 앱들이 원형 스티커·인증 마크를 쓰는 것과 정면으로 갈라지는 지점이다.
 *   획득   : 면을 꽉 채우고 글자를 배경색으로 (각인 느낌)
 *   미획득 : 1px 아웃라인 + 진행률 바
 * 티어는 색이 아니라 테두리 두께(1/2/3px)로 구분한다.
 */

import { el } from '../../../core/dom.js';
import { date, progress as progressText, percent } from '../../../core/format.js';

/**
 * @param {{ badge: object, onSelect?: (code: string) => void }} props
 */
export function BadgeTile({ badge, onSelect }) {
  const tag = onSelect ? 'button' : 'div';

  return el(
    tag,
    {
      type: onSelect ? 'button' : undefined,
      class: ['btile', badge.earned ? 'btile--earned' : 'btile--locked'],
      dataset: { tier: String(badge.tier) },
      onClick: onSelect ? () => onSelect(badge.code) : undefined,
    },
    [
      el('div', { class: 'btile__body' }, [
        el('span', { class: 'btile__title', text: badge.title }),
        el('span', { class: 'btile__desc', text: badge.description }),
      ]),

      badge.earned
        ? el('span', { class: 'btile__date', text: badge.earnedAt ? date(badge.earnedAt) : '획득' })
        : el('div', { class: 'btile__progress' }, [
            el('div', { class: 'meter' }, [
              el('div', { class: 'meter__fill', style: { width: percent(badge.ratio) } }),
            ]),
            el('span', { class: 'btile__count', text: progressText(badge.current, badge.target) }),
          ]),
    ],
  );
}
