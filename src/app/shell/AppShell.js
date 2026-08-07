/**
 * app/shell/AppShell.js — 앱 골격.
 *
 * 헤더 / 콘텐츠 슬롯 / 탭바. 화면 내용은 모르고 슬롯만 제공한다.
 * chrome: 'bare' 라우트에서는 헤더와 탭바를 감춘다 — StepFlow가 화면 전체를 쓴다.
 */

import { el, mount, clear } from '../../core/dom.js';
import { icon } from '../../shared/ui/icons/index.js';
import { TabBar } from './TabBar.js';

export function AppShell() {
  const headerTitle = el('span', { class: 'appbar__title t-title' });
  const headerLeft = el('div', { class: 'appbar__side' });
  const headerRight = el('div', { class: 'appbar__side appbar__side--end' });

  const header = el('header', { class: 'appbar' }, [
    el('div', { class: 'appbar__inner' }, [headerLeft, headerTitle, headerRight]),
  ]);

  const outlet = el('main', { class: 'outlet', id: 'outlet' });
  const tabbarSlot = el('div', { class: 'tabbar-slot' });
  // 진행 중인 산행 알림 바가 들어갈 자리. 화면이 아니라 셸의 일부다.
  const trackingSlot = el('div');

  const root = el('div', { class: 'shell' }, [header, outlet, trackingSlot, tabbarSlot]);

  /**
   * 라우트가 바뀔 때마다 셸의 겉모습을 갱신한다.
   * @param {{ title: string, tab: string|null, chrome: string, back: boolean }} meta
   * @param {() => void} onBack
   */
  function update(meta, onBack) {
    const bare = meta.chrome === 'bare';
    root.dataset.chrome = meta.chrome;
    // 안내 화면에서는 알림 바를 감춘다 — 이미 그 화면에 있는데 또 안내할 이유가 없다.
    root.dataset.trackingOpen = String(Boolean(meta.trackingOpen));
    header.hidden = bare;
    tabbarSlot.hidden = bare;
    trackingSlot.hidden = bare;

    if (bare) {
      clear(tabbarSlot);
      return;
    }

    headerTitle.textContent = meta.title ?? '';

    clear(headerLeft);
    if (meta.back) {
      headerLeft.append(
        el('button', { type: 'button', class: 'appbar__btn', 'aria-label': '뒤로', onClick: onBack }, [
          icon('arrowLeft', { size: 20 }),
        ]),
      );
    }

    mount(tabbarSlot, TabBar({ activeTab: meta.tab ?? null }));
  }

  /** 헤더 우측 액션 슬롯. 화면이 필요할 때 직접 채운다. */
  function setHeaderAction(node) {
    mount(headerRight, node);
  }

  /** 진행 중 산행 알림 바를 붙인다. 부팅 시 한 번만 호출한다. */
  function setTrackingBar(node) {
    mount(trackingSlot, node);
  }

  return { root, outlet, update, setHeaderAction, setTrackingBar };
}
