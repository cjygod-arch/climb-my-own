/**
 * shared/ui/icons/index.js — 아이콘 렌더러.
 *
 * 형태 데이터는 paths.js가, 렌더링은 이 파일이 책임진다.
 * 픽토그램(면)과 글리프(선)를 자동으로 구분해 그린다 — 호출부는 이름만 알면 된다.
 * 색은 currentColor를 따른다. 호출부가 색을 지정하지 않는다.
 */

import { svg } from '../../../core/dom.js';
import { PICTOGRAMS, GLYPHS, iconKind } from './paths.js';

/**
 * @param {string} name PICTOGRAMS 또는 GLYPHS의 키
 * @param {{ size?: number, class?: string, title?: string }} [options]
 * @returns {SVGElement}
 */
export function icon(name, options = {}) {
  const kind = iconKind(name);
  if (!kind) {
    console.warn(`[icon] 정의되지 않은 아이콘: "${name}"`);
    return svg('svg', { width: 0, height: 0, 'aria-hidden': 'true' });
  }

  const size = options.size ?? 24;

  const base = {
    class: options.class,
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    role: options.title ? 'img' : undefined,
    'aria-hidden': options.title ? undefined : 'true',
  };

  const title = options.title ? svg('title', { text: options.title }) : null;

  if (kind === 'fill') {
    const spec = PICTOGRAMS[name];
    return svg('svg', { ...base, fill: 'currentColor' }, [
      title,
      ...spec.d.map((d) => svg('path', { d, 'fill-rule': spec.evenodd ? 'evenodd' : undefined })),
    ]);
  }

  return svg(
    'svg',
    {
      ...base,
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 2,
      // 둥근 캡·조인. 픽토그램의 부드러운 면과 같은 언어를 쓴다.
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    },
    [title, ...GLYPHS[name].map((d) => svg('path', { d }))],
  );
}

export function hasIcon(name) {
  return iconKind(name) !== null;
}
