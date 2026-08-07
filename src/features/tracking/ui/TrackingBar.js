/**
 * features/tracking/ui/TrackingBar.js — 진행 중 산행 알림 바.
 *
 * 안내를 켜둔 채 다른 화면을 보는 일이 흔하다(다음 코스를 찾아본다든지).
 * 그때 산행이 진행 중이라는 사실과 돌아갈 길이 항상 보여야 한다.
 *
 * 앱 셸에 한 번만 붙는다. 화면이 아니라 셸의 일부다.
 */

import { el, mount, onDestroy } from '../../../core/dom.js';
import { clock, km } from '../../../core/format.js';
import { icon } from '../../../shared/ui/icons/index.js';

/**
 * @param {{ tracking: object, onOpen: () => void }} deps
 * @returns {HTMLElement} 진행 중이 아니면 비어 있는 컨테이너
 */
export function TrackingBar({ tracking, onOpen }) {
  const container = el('div', { class: 'trackbar-slot' });
  let ticker = null;

  function render() {
    const snapshot = tracking.getSnapshot();

    if (!snapshot) {
      mount(container, null);
      container.hidden = true;
      if (ticker) { clearInterval(ticker); ticker = null; }
      return;
    }

    container.hidden = false;
    if (!ticker) ticker = setInterval(render, 1000);

    // 걷기에는 진행률이 없다. 대신 걸은 거리를 보여준다.
    const meta = snapshot.walk
      ? `${clock(snapshot.elapsedMin)} 경과 · ${km(snapshot.traveledM / 1000)} km`
      : `${clock(snapshot.elapsedMin)} 경과 · ${Math.round((snapshot.progress?.ratio ?? 0) * 100)}%`;

    mount(
      container,
      el('button', { type: 'button', class: 'trackbar', onClick: onOpen }, [
        el('span', { class: 'trackbar__pulse' }),
        el('span', { class: 'trackbar__body' }, [
          el('span', { class: 'trackbar__name', text: snapshot.title }),
          el('span', { class: 'trackbar__meta', text: meta }),
        ]),
        el('span', { class: 'trackbar__go' }, [icon('chevronRight', { size: 20 })]),
      ]),
    );
  }

  const unsubscribe = tracking.subscribe(render);
  render();

  return onDestroy(container, () => {
    unsubscribe();
    if (ticker) clearInterval(ticker);
  });
}
