/**
 * shared/ui/EmptyState.js — 비어 있음 표시.
 * 일러스트를 쓰지 않는다. 점선 테두리 + 단색 아이콘 + 사실 서술.
 */

import { el } from '../../core/dom.js';
import { icon } from './icons/index.js';
import { Button } from './Button.js';

/**
 * @param {{
 *   title: string,
 *   description?: string,
 *   iconName?: string,
 *   actionLabel?: string,
 *   onAction?: () => void
 * }} props
 * @returns {HTMLElement}
 */
export function EmptyState({ title, description = null, iconName = 'info', actionLabel, onAction }) {
  return el('div', { class: 'empty' }, [
    el('div', { class: 'empty__icon' }, [icon(iconName, { size: 28 })]),
    el('p', { class: 'empty__title t-body-strong', text: title }),
    description && el('p', { class: 'empty__desc', text: description }),
    actionLabel &&
      onAction &&
      el('div', { class: 'empty__action' }, [
        Button({ label: actionLabel, variant: 'ghost', size: 'sm', onClick: onAction }),
      ]),
  ]);
}

/** 실패 상태. 재시도 경로를 항상 제공한다. */
export function ErrorState({ error, onRetry }) {
  return EmptyState({
    title: '불러오지 못했습니다',
    description: error?.message ?? '잠시 후 다시 시도해 주세요.',
    iconName: 'warning',
    actionLabel: onRetry ? '다시 시도' : null,
    onAction: onRetry,
  });
}
