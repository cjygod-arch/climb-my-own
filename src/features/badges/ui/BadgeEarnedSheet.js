/**
 * features/badges/ui/BadgeEarnedSheet.js — 배지 획득 알림.
 *
 * 축하하지 않고 보고한다. 폭죽·애니메이션·이모지를 쓰지 않는다.
 * 획득 사실과 조건만 담백하게 보여준다 (톤: 계측 도구).
 */

import { el } from '../../../core/dom.js';
import { openSheet } from '../../../shared/ui/Sheet.js';
import { Button } from '../../../shared/ui/Button.js';

/**
 * @param {{ badges: Array<{code:string,title:string,description:string,tier:number}>, onClose?: () => void }} props
 * @returns {() => void} close
 */
export function BadgeEarnedSheet({ badges, onClose }) {
  const content = el('div', { class: 'stack stack--5' }, [
    el('p', { class: 't-caption', text: `${badges.length}개의 배지를 획득했습니다.` }),

    el(
      'div',
      { class: 'stack stack--3' },
      badges.map((badge) =>
        el('div', { class: 'bearn', dataset: { tier: String(badge.tier) } }, [
          el('span', { class: 'bearn__title', text: badge.title }),
          el('span', { class: 'bearn__desc', text: badge.description }),
        ]),
      ),
    ),
  ]);

  const close = openSheet({ title: '배지 획득', content, onClose });

  content.append(
    el('div', { style: { marginTop: 'var(--space-5)' } }, [
      Button({ label: '확인', variant: 'primary', block: true, size: 'lg', onClick: () => close() }),
    ]),
  );

  return close;
}
