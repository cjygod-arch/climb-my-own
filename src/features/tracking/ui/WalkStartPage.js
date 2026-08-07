/**
 * features/tracking/ui/WalkStartPage.js — 걷기 시작 화면.
 *
 * 화면(라우트)으로 만든 이유:
 * 홈에서 시트를 직접 열려면 features/home이 features/tracking을 import 해야 하는데
 * 그건 기능 간 직접 의존이다 (ARCHITECTURE.md R5).
 * 홈은 경로로 이동만 하고, 무엇을 보여줄지는 tracking 기능이 스스로 정한다.
 *
 * 위치 권한은 '걷기 시작'을 누르는 순간 처음 요청된다. 왜 필요한지 먼저 알린다.
 * 제목은 선택 사항이다 — 산책은 마음먹은 순간 시작하므로 입력을 강요하지 않는다.
 */

import { el, mount, onDestroy } from '../../../core/dom.js';
import { Button } from '../../../shared/ui/Button.js';
import { Field } from '../../../shared/ui/Field.js';
import { icon } from '../../../shared/ui/icons/index.js';

export function WalkStartPage({ services, navigate }) {
  const container = el('div', { class: 'page stack stack--5' });

  let title = '';
  let busy = false;

  const message = el('p', { class: 't-caption t-danger', hidden: true });

  async function start() {
    if (busy) return;
    busy = true;
    message.hidden = true;
    render();

    const result = await services.tracking.startWalk(title);

    if (!result.ok) {
      busy = false;
      message.textContent = result.error.message;
      message.hidden = false;
      render();
      return;
    }
    navigate('/tracking');
  }

  function render() {
    mount(
      container,
      el('div', { class: 'stack stack--5' }, [
        el('div', { class: 'card stack stack--4' }, [
          el('div', { class: 'walkstart' }, [
            el('span', { class: 'walkstart__icon' }, [icon('route', { size: 26 })]),
            el('div', { class: 'stack stack--1' }, [
              el('p', { class: 't-body-strong', text: '걸은 길을 지도에 남깁니다' }),
              el('p', {
                class: 't-caption',
                text: '시작 시각부터 종료까지 위치를 기록해 걸은 거리와 경로를 저장합니다.',
              }),
            ]),
          ]),

          Field({
            label: '제목 (선택)',
            name: 'walkTitle',
            value: title,
            placeholder: '예: 동네 한 바퀴',
            hint: '비워두면 ‘걷기’로 저장됩니다.',
            onInput: (v) => { title = v; },
          }),
        ]),

        el('div', { class: 'card stack stack--3' }, [
          el('h2', { class: 't-title', text: '시작하기 전에' }),
          el('ul', { class: 'walkstart__notes' }, [
            el('li', { text: '위치 권한을 허용해야 기록할 수 있습니다.' }),
            el('li', { text: '화면이 꺼지면 기록 간격이 늘어날 수 있습니다.' }),
            el('li', { text: '종료할 때 시작·종료 시각과 총 거리가 저장됩니다.' }),
          ]),
        ]),

        message,

        el('div', { class: 'sticky-action' }, [
          Button({
            label: busy ? '시작하는 중' : '걷기 시작',
            variant: 'primary',
            block: true,
            size: 'lg',
            disabled: busy,
            iconName: 'route',
            onClick: start,
          }),
        ]),
      ]),
    );
  }

  // 이미 진행 중이면 시작 화면을 보여줄 이유가 없다.
  if (services.tracking.hasActive()) {
    navigate('/tracking');
  } else {
    render();
  }

  return onDestroy(container, () => {});
}
