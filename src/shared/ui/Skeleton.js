/**
 * shared/ui/Skeleton.js — 로딩 자리표시.
 * 스피너·바운스·펄스를 쓰지 않는다. 정지된 회색 면으로 자리만 잡는다.
 */

import { el } from '../../core/dom.js';

/**
 * @param {{ variant?: 'text'|'stat'|'row'|'block', width?: string, height?: string }} [props]
 */
export function Skeleton({ variant = 'text', width = '100%', height = null } = {}) {
  return el('div', {
    class: ['skeleton', `skeleton--${variant}`],
    style: { width, ...(height ? { height } : {}) },
    'aria-hidden': 'true',
  });
}

/** 같은 형태를 n개 반복. 목록 로딩에 쓴다. */
export function SkeletonList(count = 4, variant = 'row') {
  return el(
    'div',
    { class: 'stack stack--3', 'aria-busy': 'true' },
    Array.from({ length: count }, () => Skeleton({ variant })),
  );
}

/** 수치 그리드 로딩 */
export function SkeletonStats(count = 3) {
  return el(
    'div',
    { class: 'stat-grid', style: { '--cols': String(count) }, 'aria-busy': 'true' },
    Array.from({ length: count }, () =>
      el('div', { class: 'stack stack--2' }, [
        Skeleton({ variant: 'stat' }),
        Skeleton({ variant: 'text', width: '60%' }),
      ]),
    ),
  );
}
