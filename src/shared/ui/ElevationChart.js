/**
 * shared/ui/ElevationChart.js — 고도 단면도.
 *
 * 지도를 쓰지 않기로 한 결정의 핵심 대체물이다.
 * 이 컴포넌트는 '등산'을 모른다 — 좌표점 배열만 받아 선을 긋는다.
 * 코스 구간 → 좌표 변환은 domain/rules/elevationProfile.js가 한다.
 *
 * 곡선 보간을 쓰지 않는다. 꺾인 직선이 이 디자인 시스템의 톤이다.
 */

import { el, svg } from '../../core/dom.js';

const VIEW_W = 320;
const PAD_L = 4;
const PAD_R = 4;
const PAD_T = 14;
const PAD_B = 18;

/**
 * @param {{
 *   points: Array<{ x: number, y: number }>,
 *   height?: number,
 *   xUnit?: string,
 *   yUnit?: string,
 *   peakIndex?: number|null
 * }} props
 * @returns {HTMLElement}
 */
export function ElevationChart({
  points,
  height = 160,
  xUnit = 'km',
  yUnit = 'm',
  peakIndex = null,
}) {
  if (!Array.isArray(points) || points.length < 2) {
    return el('div', { class: 'surface', style: { padding: 'var(--space-5)' } }, [
      el('p', { class: 't-caption', text: '고도 정보가 없습니다.' }),
    ]);
  }

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);

  // 고도차가 0에 가까울 때 0으로 나누는 것을 막는다.
  const xSpan = xMax - xMin || 1;
  const ySpan = yMax - yMin || 1;

  const innerW = VIEW_W - PAD_L - PAD_R;
  const innerH = height - PAD_T - PAD_B;

  const toX = (x) => PAD_L + ((x - xMin) / xSpan) * innerW;
  const toY = (y) => PAD_T + innerH - ((y - yMin) / ySpan) * innerH;

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.x).toFixed(1)} ${toY(p.y).toFixed(1)}`).join(' ');
  const area = `${line} L${toX(xMax).toFixed(1)} ${(PAD_T + innerH).toFixed(1)} L${toX(xMin).toFixed(1)} ${(PAD_T + innerH).toFixed(1)} Z`;

  const baseline = PAD_T + innerH;
  const peak = peakIndex !== null && points[peakIndex] ? points[peakIndex] : null;

  return el('div', {}, [
    svg(
      'svg',
      {
        class: 'elev',
        viewBox: `0 0 ${VIEW_W} ${height}`,
        preserveAspectRatio: 'none',
        height: String(height),
        role: 'img',
        'aria-label': `고도 단면. 최저 ${Math.round(yMin)}${yUnit}, 최고 ${Math.round(yMax)}${yUnit}, 총 ${xMax.toFixed(1)}${xUnit}`,
      },
      [
        svg('line', { class: 'elev__grid', x1: PAD_L, y1: PAD_T, x2: VIEW_W - PAD_R, y2: PAD_T }),
        svg('line', { class: 'elev__grid', x1: PAD_L, y1: baseline, x2: VIEW_W - PAD_R, y2: baseline }),
        svg('path', { class: 'elev__area', d: area }),
        svg('path', { class: 'elev__line', d: line }),
        peak &&
          svg('line', {
            class: 'elev__marker',
            x1: toX(peak.x),
            y1: toY(peak.y),
            x2: toX(peak.x),
            y2: baseline,
          }),
        peak &&
          svg('rect', {
            class: 'elev__peak',
            x: toX(peak.x) - 3,
            y: toY(peak.y) - 3,
            width: 6,
            height: 6,
          }),
      ],
    ),
    // 축 라벨은 SVG 밖에 둔다. preserveAspectRatio=none이 글자를 늘리기 때문이다.
    el('div', { class: 'elev-legend' }, [
      el('span', { class: 't-label', text: `${Math.round(yMin)} ${yUnit}` }),
      el('span', { class: 't-label', text: `최고 ${Math.round(yMax)} ${yUnit}` }),
      el('span', { class: 't-label', text: `${xMax.toFixed(1)} ${xUnit}` }),
    ]),
  ]);
}
