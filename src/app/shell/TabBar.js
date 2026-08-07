/**
 * app/shell/TabBar.js — 하단 탭.
 *
 * 아이콘은 면으로 채운 픽토그램이다. 작은 크기에서 실루엣만으로 구분되어야 하므로
 * 선 아이콘 대신 채운 형태를 쓴다 (shared/ui/icons/paths.js의 PICTOGRAMS).
 *
 * 활성 표시는 액센트 색 + 글자 굵기 + 아주 미세한 확대. 별도 표시선을 두지 않는다 —
 * 채운 아이콘은 색 대비만으로도 충분히 읽힌다.
 */

import { el } from '../../core/dom.js';
import { icon } from '../../shared/ui/icons/index.js';
import { TABS } from '../routes.js';

/**
 * @param {{ activeTab: string|null }} props
 * @returns {HTMLElement}
 */
export function TabBar({ activeTab }) {
  return el(
    'nav',
    { class: 'tabbar', 'aria-label': '주요 메뉴' },
    TABS.map((tab) => {
      const active = tab.id === activeTab;
      return el(
        'a',
        {
          class: 'tabbar__item',
          href: `#${tab.path}`,
          'aria-current': active ? 'page' : undefined,
        },
        [
          icon(tab.icon, { size: 24 }),
          el('span', { class: 'tabbar__label', text: tab.label }),
        ],
      );
    }),
  );
}
