/**
 * domain/rules/difficulty.js — 난이도 산출.
 *
 * 순수 함수만 둔다. 입력이 같으면 출력이 같다.
 *
 * 산출 근거: 거리와 누적 상승고도를 하나의 점수로 합산한다.
 *   점수 = 거리(km) + 상승고도(m) / 100
 * 즉 100m 오르는 것을 평지 1km와 동등하게 본다. 국내 등산 안내에서 널리 쓰는 환산이다.
 */

export const DIFFICULTY = Object.freeze(['하', '중', '상', '최상']);

/** 점수 → 등급 경계 */
const BANDS = Object.freeze([
  { max: 9, label: '하' },
  { max: 16, label: '중' },
  { max: 24, label: '상' },
  { max: Infinity, label: '최상' },
]);

/**
 * @param {number} distanceKm
 * @param {number} ascentM
 * @returns {number}
 */
export function effortScore(distanceKm, ascentM) {
  const d = Number(distanceKm) || 0;
  const a = Number(ascentM) || 0;
  return d + a / 100;
}

/**
 * @param {number} distanceKm
 * @param {number} ascentM
 * @returns {'하'|'중'|'상'|'최상'}
 */
export function difficultyOf(distanceKm, ascentM) {
  const score = effortScore(distanceKm, ascentM);
  return BANDS.find((b) => score < b.max).label;
}

/**
 * 표준 소요 시간 추정 (분).
 * 수평 3.0 km/h, 상승 400 m/h 를 기준으로 하고 10% 휴식을 더한다.
 * 코스 데이터에 소요 시간이 비어 있을 때만 쓴다 — 실측값이 있으면 그쪽이 우선이다.
 */
export function estimateDurationMin(distanceKm, ascentM) {
  const d = Number(distanceKm) || 0;
  const a = Number(ascentM) || 0;
  const minutes = (d / 3.0) * 60 + (a / 400) * 60;
  return Math.round(minutes * 1.1);
}

/** 난이도 등급의 순서값. 정렬·비교에 쓴다. */
export function difficultyRank(label) {
  const index = DIFFICULTY.indexOf(label);
  return index === -1 ? DIFFICULTY.length : index;
}
