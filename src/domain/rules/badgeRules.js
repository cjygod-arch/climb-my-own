/**
 * domain/rules/badgeRules.js — 배지 획득 판정.
 *
 * 순수 함수다. 저장도, 알림도 하지 않는다 —
 * "지금 기록으로 어떤 배지가 성립하는가"만 계산해 돌려준다.
 * 저장은 features/badges/badges.service.js, 알림은 eventBus가 맡는다.
 *
 * 이행 경로: 다중 사용자 단계에서 이 계산을 Postgres 함수로 옮긴다.
 * 그때도 이 파일의 판정 결과가 정답 기준(reference implementation)이 된다.
 */

import { CriteriaType } from '../entities/badge.js';
import { longestMonthlyStreak } from './monthlyStats.js';

/**
 * 배지 하나의 진행 상황을 계산한다.
 *
 * @param {import('../entities/badge.js').Badge} badge
 * @param {import('../entities/hikeRecord.js').HikeRecord[]} records
 * @param {Map<string, import('../entities/mountain.js').Mountain>} mountainsById
 * @returns {{ current: number, target: number, achieved: boolean }}
 */
export function evaluateBadge(badge, records, mountainsById) {
  const { type, count = 1 } = badge.criteria;
  const target = Math.max(count, 1);
  const current = measure(badge.criteria, records, mountainsById);
  return { current, target, achieved: current >= target };
}

/**
 * 전체 배지를 한 번에 판정한다.
 *
 * @param {import('../entities/badge.js').Badge[]} badges
 * @param {import('../entities/hikeRecord.js').HikeRecord[]} records
 * @param {import('../entities/mountain.js').Mountain[]} mountains
 * @returns {Map<string, { current: number, target: number, achieved: boolean }>}
 */
export function evaluateAll(badges, records, mountains) {
  const byId = new Map(mountains.map((m) => [m.id, m]));
  return new Map(badges.map((badge) => [badge.code, evaluateBadge(badge, records, byId)]));
}

/**
 * 아직 획득하지 않았는데 조건을 만족한 배지 코드를 찾는다.
 * 기록 저장 직후 호출한다.
 *
 * @param {import('../entities/badge.js').Badge[]} badges
 * @param {import('../entities/hikeRecord.js').HikeRecord[]} records
 * @param {import('../entities/mountain.js').Mountain[]} mountains
 * @param {Set<string>} earnedCodes 이미 획득한 코드
 * @returns {string[]} 새로 획득한 코드
 */
export function findNewlyEarned(badges, records, mountains, earnedCodes) {
  const results = evaluateAll(badges, records, mountains);
  return badges
    .filter((b) => !earnedCodes.has(b.code) && results.get(b.code)?.achieved)
    .map((b) => b.code);
}

/** 기준 종류별 측정값. 새 CriteriaType을 추가하면 여기에 분기를 추가한다. */
function measure(criteria, records, mountainsById) {
  switch (criteria.type) {
    case CriteriaType.DISTINCT_MOUNTAINS:
      return distinctMountainIds(records).size;

    case CriteriaType.TOTAL_DISTANCE:
      return round1(sum(records, (r) => r.distanceKm));

    case CriteriaType.TOTAL_ASCENT:
      return Math.round(sum(records, (r) => r.ascentM));

    case CriteriaType.SPECIFIC_MOUNTAIN:
      return records.some((r) => r.mountainId === criteria.mountainId) ? 1 : 0;

    case CriteriaType.REGION_COUNT:
      return countDistinct(records, (id) => mountainsById.get(id)?.region === criteria.region);

    case CriteriaType.HIGH_ALTITUDE:
      return countDistinct(
        records,
        (id) => (mountainsById.get(id)?.elevationM ?? 0) >= (criteria.elevationM ?? 0),
      );

    case CriteriaType.MONTHLY_STREAK:
      return longestMonthlyStreak(records);

    case CriteriaType.SINGLE_DISTANCE:
      return records.length === 0 ? 0 : Math.max(...records.map((r) => r.distanceKm));

    default:
      console.warn(`[badgeRules] 알 수 없는 기준: ${criteria.type}`);
      return 0;
  }
}

function distinctMountainIds(records) {
  return new Set(records.map((r) => r.mountainId).filter(Boolean));
}

/** 조건을 만족하는 '서로 다른 산'의 수 */
function countDistinct(records, predicate) {
  let n = 0;
  for (const id of distinctMountainIds(records)) {
    if (predicate(id)) n += 1;
  }
  return n;
}

function sum(list, pick) {
  return list.reduce((acc, item) => acc + (Number(pick(item)) || 0), 0);
}

function round1(n) {
  return Math.round(n * 10) / 10;
}
