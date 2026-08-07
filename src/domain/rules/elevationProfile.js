/**
 * domain/rules/elevationProfile.js — 구간 → 고도 단면 좌표.
 *
 * shared/ui/ElevationChart.js 는 도메인을 모르므로 좌표점만 받는다.
 * 그 변환 책임이 이 파일에 있다. 여기가 UI와 도메인의 경계다.
 */

import { sortSegments, peakIndex } from '../entities/courseSegment.js';

/**
 * @param {import('../entities/courseSegment.js').CourseSegment[]} segments
 * @returns {{ points: Array<{x:number,y:number}>, peakIndex: number|null }}
 */
export function toProfile(segments) {
  const sorted = sortSegments(segments);
  return {
    points: sorted.map((s) => ({ x: s.cumDistanceKm, y: s.elevationM })),
    peakIndex: peakIndex(sorted),
  };
}

/**
 * 구간 데이터로부터 누적 상승고도를 계산한다.
 * 코스에 ascentM이 없거나 검증되지 않았을 때 대체값으로 쓴다.
 * 내려갔다 다시 오르는 구간(가령 대청봉 전 안부)도 상승분으로 더해진다.
 */
export function totalAscentM(segments) {
  const sorted = sortSegments(segments);
  let ascent = 0;
  for (let i = 1; i < sorted.length; i += 1) {
    const delta = sorted[i].elevationM - sorted[i - 1].elevationM;
    if (delta > 0) ascent += delta;
  }
  return Math.round(ascent);
}

/** 누적 하강고도. 종주 코스에서 날머리가 낮을 때 의미가 있다. */
export function totalDescentM(segments) {
  const sorted = sortSegments(segments);
  let descent = 0;
  for (let i = 1; i < sorted.length; i += 1) {
    const delta = sorted[i - 1].elevationM - sorted[i].elevationM;
    if (delta > 0) descent += delta;
  }
  return Math.round(descent);
}

/** 총 거리 = 마지막 지점의 누적 거리 */
export function totalDistanceKm(segments) {
  const sorted = sortSegments(segments);
  return sorted.length ? sorted[sorted.length - 1].cumDistanceKm : 0;
}

/**
 * 구간별 평균 경사(%). 가파른 구간을 표시할 때 쓴다.
 * @returns {Array<{ index: number, gradePercent: number }>}
 */
export function grades(segments) {
  const sorted = sortSegments(segments);
  const result = [];
  for (let i = 1; i < sorted.length; i += 1) {
    const runM = (sorted[i].cumDistanceKm - sorted[i - 1].cumDistanceKm) * 1000;
    const riseM = sorted[i].elevationM - sorted[i - 1].elevationM;
    result.push({
      index: i,
      gradePercent: runM > 0 ? Math.round((riseM / runM) * 100) : 0,
    });
  }
  return result;
}
