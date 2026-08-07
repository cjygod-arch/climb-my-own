/**
 * shared/ui/StepFlow.js — "한 화면에 한 가지 작업" 강제 장치.
 *
 * 참고 앱에서 가져온 것은 이 원리뿐이다. 표현은 우리 방식으로 재해석했다:
 *   - 원형 스테퍼·점 표시 대신 상단 2px 직선 바 + "1/4" 고정폭 텍스트
 *   - 단계 전환 애니메이션 없음
 *   - 하단 고정 액션 버튼 1개
 *
 * 도메인을 모른다. 각 단계가 무엇을 묻는지는 호출부가 정한다.
 */

import { el, mount, clear, onDestroy } from '../../core/dom.js';
import { Button, IconButton } from './Button.js';

/**
 * @typedef {{
 *   id: string,
 *   question: string,
 *   hint?: string,
 *   render: (data: object, update: (patch, options?) => void, api: StepApi) => Node,
 *   validate?: (data: object) => string|null,
 *   nextLabel?: string,
 *   skippable?: boolean
 * }} Step
 */

/**
 * @typedef {Object} StepApi
 * @property {() => object} getData
 *   ★ 항상 최신 값을 돌려준다.
 *   render()가 인자로 받은 data는 그 시점의 스냅샷이라, update()를 한 번이라도 부르면
 *   낡은 값이 된다(update는 새 객체를 만들어 갈아끼우기 때문).
 *   입력한 값을 다시 읽어야 한다면 반드시 이것을 쓴다.
 */

/**
 * @param {{
 *   steps: Step[],
 *   initialData?: object,
 *   submitLabel?: string,
 *   onComplete: (data: object) => void|Promise<void>,
 *   onCancel?: () => void
 * }} props
 * @returns {HTMLElement}
 */
export function StepFlow({ steps, initialData = {}, submitLabel = '완료', onComplete, onCancel }) {
  let index = 0;
  let data = { ...initialData };
  let errorText = null;
  let submitting = false;

  const barFill = el('div', { class: 'stepflow__bar-fill' });
  const counter = el('span', { class: 'stepflow__counter' });
  const backSlot = el('div', { style: { minWidth: '44px' } });
  const closeSlot = el('div', { style: { minWidth: '44px', display: 'flex', justifyContent: 'flex-end' } });
  const body = el('div', { class: 'stepflow__body' });
  const footInner = el('div', { class: 'stepflow__foot-inner' });

  const root = el('div', { class: 'stepflow' }, [
    el('div', { class: 'stepflow__bar' }, [barFill]),
    el('div', { class: 'stepflow__head' }, [backSlot, counter, closeSlot]),
    body,
    el('div', { class: 'stepflow__foot' }, [footInner]),
  ]);

  /**
   * 단계별 render()가 값을 바꿀 때 호출한다.
   *
   * 기본적으로 화면을 다시 그리지 않는다 — 글자를 입력하는 중에 다시 그리면
   * 입력란이 새로 만들어져 포커스와 커서 위치가 날아간다.
   *
   * 선택에 따라 다른 입력란이 나타나거나 사라져야 할 때만 rerender를 켠다
   * (예: 코스 형태를 '종주'로 바꾸면 날머리 입력란이 생긴다).
   * 이때도 다시 그리는 것은 **현재 단계의 본문뿐**이다.
   *
   * ⚠ 단계 안에서 바깥 화면의 render()를 부르면 안 된다.
   *   StepFlow 자체가 새로 만들어져 1단계로 되돌아간다.
   *
   * @param {object} patch
   * @param {{ rerender?: boolean }} [options]
   */
  function update(patch, { rerender = false } = {}) {
    data = { ...data, ...patch };
    if (errorText) {
      errorText = null;
      renderFoot();
    }
    if (rerender) renderBody();
  }

  function goTo(next) {
    index = Math.min(Math.max(next, 0), steps.length - 1);
    errorText = null;
    renderAll();
    root.scrollTo?.({ top: 0 });
    window.scrollTo({ top: 0 });
  }

  function handleNext() {
    const step = steps[index];
    const message = step.validate ? step.validate(data) : null;
    if (message) {
      errorText = message;
      renderFoot();
      return;
    }
    if (index < steps.length - 1) {
      goTo(index + 1);
      return;
    }
    finish();
  }

  async function finish() {
    if (submitting) return;
    submitting = true;
    renderFoot();
    try {
      await onComplete(data);
    } finally {
      submitting = false;
      if (root.isConnected) renderFoot();
    }
  }

  function renderHead() {
    const isFirst = index === 0;

    clear(backSlot);
    if (!isFirst) {
      backSlot.append(
        IconButton({ iconName: 'arrowLeft', label: '이전 단계', onClick: () => goTo(index - 1) }),
      );
    }

    clear(closeSlot);
    if (onCancel) {
      closeSlot.append(IconButton({ iconName: 'close', label: '취소', onClick: onCancel }));
    }

    counter.textContent = `${index + 1} / ${steps.length}`;
    barFill.style.width = `${((index + 1) / steps.length) * 100}%`;
  }

  function renderBody() {
    const step = steps[index];
    mount(
      body,
      el('div', {}, [
        el('div', { class: 'stepflow__question' }, [
          el('h1', { class: 't-display', text: step.question }),
          step.hint && el('p', { class: 'stepflow__hint', text: step.hint }),
        ]),
        // getData는 화살표 함수라 바깥의 data 변수를 계속 따라간다.
        step.render(data, update, { getData: () => data }),
      ]),
    );
  }

  function renderFoot() {
    const step = steps[index];
    const isLast = index === steps.length - 1;
    const label = submitting ? '저장 중' : (step.nextLabel ?? (isLast ? submitLabel : '다음'));

    mount(
      footInner,
      el('div', { class: 'stack stack--2', style: { flex: '1 1 auto' } }, [
        errorText && el('div', { class: 'stepflow__error', role: 'alert', text: errorText }),
        el('div', { class: 'row', style: { gap: 'var(--space-3)' } }, [
          step.skippable &&
            Button({
              label: '건너뛰기',
              variant: 'ghost',
              onClick: () => (isLast ? finish() : goTo(index + 1)),
            }),
          Button({ label, variant: 'primary', block: true, disabled: submitting, onClick: handleNext }),
        ]),
      ]),
    );
  }

  function renderAll() {
    renderHead();
    renderBody();
    renderFoot();
  }

  renderAll();

  return onDestroy(root, () => {
    clear(body);
    clear(footInner);
  });
}
