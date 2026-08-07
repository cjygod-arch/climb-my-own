/**
 * domain/entities/badge.js — 배지 정의와 획득 상태.
 *
 * 배지의 '판정'은 여기가 아니라 domain/rules/badgeRules.js가 한다.
 * 이 파일은 형태와 표시 규칙만 책임진다.
 *
 * 디자인: 원형 스티커가 아니라 사각 타일. 티어는 색이 아니라 테두리 두께로 구분한다.
 */

/**
 * @typedef {Object} BadgeCriteria
 * @property {string} type CriteriaType 중 하나
 * @property {number} [count]
 * @property {string} [mountainId]
 * @property {string} [region]
 * @property {number} [elevationM]
 */

/**
 * @typedef {Object} Badge
 * @property {string} code
 * @property {string} title
 * @property {string} description
 * @property {BadgeCriteria} criteria
 * @property {number} tier  1|2|3 — 테두리 두께에 대응
 */

/**
 * @typedef {Object} EarnedBadge
 * @property {string} badgeCode
 * @property {string} earnedAt        ISO 문자열
 * @property {string|null} sourceRecordId
 */

/** 판정 기준 종류. 새 배지 유형을 추가하면 badgeRules.js에도 계산기를 추가해야 한다. */
export const CriteriaType = Object.freeze({
  /** 서로 다른 산 N곳 등정 */
  DISTINCT_MOUNTAINS: 'DISTINCT_MOUNTAINS',
  /** 누적 거리 N km */
  TOTAL_DISTANCE: 'TOTAL_DISTANCE',
  /** 누적 상승고도 N m */
  TOTAL_ASCENT: 'TOTAL_ASCENT',
  /** 특정 산 등정 */
  SPECIFIC_MOUNTAIN: 'SPECIFIC_MOUNTAIN',
  /** 특정 권역의 산 N곳 등정 */
  REGION_COUNT: 'REGION_COUNT',
  /** 표고 N m 이상인 산 M곳 등정 */
  HIGH_ALTITUDE: 'HIGH_ALTITUDE',
  /** 산행한 달이 연속 N개월 */
  MONTHLY_STREAK: 'MONTHLY_STREAK',
  /** 단일 산행 거리 N km 이상 */
  SINGLE_DISTANCE: 'SINGLE_DISTANCE',
});

/**
 * @param {Partial<Badge>} raw
 * @returns {Badge}
 */
export function createBadge(raw = {}) {
  return {
    code: String(raw.code ?? ''),
    title: raw.title ?? '',
    description: raw.description ?? '',
    criteria: raw.criteria ?? { type: CriteriaType.DISTINCT_MOUNTAINS, count: 1 },
    tier: clampTier(raw.tier),
  };
}

/**
 * @param {Partial<EarnedBadge>} raw
 * @returns {EarnedBadge}
 */
export function createEarnedBadge(raw = {}) {
  return {
    badgeCode: String(raw.badgeCode ?? ''),
    earnedAt: raw.earnedAt ?? '',
    sourceRecordId: raw.sourceRecordId ?? null,
  };
}

/**
 * 배지 + 진행 상황을 화면용 한 덩어리로 묶는다.
 * @param {Badge} badge
 * @param {{ current: number, target: number }} progress
 * @param {EarnedBadge|null} earned
 */
export function toBadgeView(badge, progress, earned) {
  return {
    ...badge,
    earned: Boolean(earned),
    earnedAt: earned?.earnedAt ?? null,
    current: Math.min(progress.current, progress.target),
    target: progress.target,
    ratio: progress.target > 0 ? Math.min(progress.current / progress.target, 1) : 0,
  };
}

function clampTier(tier) {
  const n = Number(tier);
  if (!Number.isFinite(n)) return 1;
  return Math.min(Math.max(Math.round(n), 1), 3);
}
