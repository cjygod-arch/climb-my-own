/**
 * shared/ui/Sheet.js — 하단 시트.
 *
 * 각진 형태 유지: 상단 모서리를 둥글리지 않고 2px 실선으로 경계를 만든다.
 * 열림 애니메이션은 120ms translateY 하나뿐이다.
 */

import { el, destroy, on } from '../../core/dom.js';
import { IconButton } from './Button.js';

/**
 * 시트를 열고 닫기 함수를 돌려준다.
 *
 * @param {{ title: string, content: Node, onClose?: () => void }} props
 * @returns {() => void} close
 */
export function openSheet({ title, content, onClose }) {
  const previousFocus = document.activeElement;

  const panel = el('div', {
    class: 'sheet',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': title,
  }, [
    el('div', { class: 'sheet__head' }, [
      el('h2', { class: 't-title', text: title }),
      IconButton({ iconName: 'close', label: '닫기', onClick: () => close() }),
    ]),
    el('div', { class: 'sheet__body' }, [content]),
  ]);

  const backdrop = el('div', {
    class: 'sheet-backdrop',
    onClick: (e) => {
      if (e.target === backdrop) close();
    },
  }, [panel]);

  const offKey = on(document, 'keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  let closed = false;

  function close() {
    if (closed) return;
    closed = true;
    offKey();
    document.body.style.overflow = '';
    destroy(backdrop);
    backdrop.remove();
    previousFocus?.focus?.();
    onClose?.();
  }

  document.body.style.overflow = 'hidden';
  document.body.append(backdrop);
  panel.querySelector('button')?.focus();

  return close;
}
