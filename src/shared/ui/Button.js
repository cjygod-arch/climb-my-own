/**
 * shared/ui/Button.js — 버튼.
 * ARCHITECTURE.md R4: 도메인 엔티티를 받지 않는다. 원시값만 받는다.
 */

import { el } from '../../core/dom.js';
import { icon } from './icons/index.js';

/**
 * @param {{
 *   label: string,
 *   variant?: 'primary'|'secondary'|'ghost'|'quiet'|'danger',
 *   size?: 'sm'|'md'|'lg',
 *   block?: boolean,
 *   disabled?: boolean,
 *   iconName?: string,
 *   iconAfter?: boolean,
 *   type?: string,
 *   onClick?: (e: Event) => void
 * }} props
 * @returns {HTMLButtonElement}
 */
export function Button({
  label,
  variant = 'primary',
  size = 'md',
  block = false,
  disabled = false,
  iconName = null,
  iconAfter = false,
  type = 'button',
  onClick,
}) {
  const glyph = iconName ? icon(iconName, { size: size === 'lg' ? 20 : 18 }) : null;

  return el(
    'button',
    {
      type,
      class: [
        'btn',
        `btn--${variant}`,
        size !== 'md' && `btn--${size}`,
        block && 'btn--block',
      ],
      disabled: disabled || undefined,
      onClick: disabled ? undefined : onClick,
    },
    iconAfter ? [label, glyph] : [glyph, label],
  );
}

/** 아이콘만 있는 버튼. 접근성을 위해 label은 필수이며 sr-only로 들어간다. */
export function IconButton({ iconName, label, variant = 'quiet', size = 20, onClick }) {
  return el(
    'button',
    {
      type: 'button',
      class: ['btn', `btn--${variant}`],
      'aria-label': label,
      onClick,
    },
    [icon(iconName, { size })],
  );
}
