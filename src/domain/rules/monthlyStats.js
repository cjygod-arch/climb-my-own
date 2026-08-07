/**
 * domain/rules/monthlyStats.js — 월별 집계.
 *
 * "월별 기록 · 누적 킬로수"의 계산 책임 전부가 여기 있다.
 * Date 연산을 쓰지 않는다 — 'YYYY-MM' 문자열을 직접 다뤄 타임존 영향을 없앤다.
 */

import { monthKeyOf, sortByDateDesc } from '../entities/hikeRecord.js';

/**
 * @typedef {Object} MonthlyStat
 * @property {string} monthKey        'YYYY-MM'
 * @property {number} count           산행 횟수
 * @property {number} distanceKm      누적 거리
 * @property {number} ascentM         누적 상승고도
 * @property {number} durationMin     누적 소요 시간
 * @property {number} distinctMountains 서로 다른 산 개수
 * @property {import('../entities/hikeRecord.js').HikeRecord[]} records 최신순
 */

/**
 * 월별로 묶어 최신 달부터 돌려준다.
 * @param {import('../entities/hikeRecord.js').HikeRecord[]} records
 * @returns {MonthlyStat[]}
 */
export function groupByMonth(records) {
  const buckets = new Map();

  for (const record of records) {
    const key = monthKeyOf(record);
    if (!key) continue;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(record);
  }

  return Array.from(buckets.entries())
    .map(([monthKey, list]) => ({ ...summarize(list), monthKey, records: sortByDateDesc(list) }))
    .sort((a, b) => (a.monthKey < b.monthKey ? 1 : -1));
}

/**
 * 기록 묶음의 합계. 월·연·전체 어디에나 쓸 수 있다.
 * @param {import('../entities/hikeRecord.js').HikeRecord[]} records
 */
export function summarize(records) {
  const totals = records.reduce(
    (acc, r) => {
      acc.distanceKm += r.distanceKm;
      acc.ascentM += r.ascentM;
      acc.durationMin += r.durationMin;
      acc.mountains.add(r.mountainId);
      return acc;
    },
    { distanceKm: 0, ascentM: 0, durationMin: 0, mountains: new Set() },
  );

  return {
    count: records.length,
    distanceKm: round1(totals.distanceKm),
    ascentM: Math.round(totals.ascentM),
    durationMin: Math.round(totals.durationMin),
    distinctMountains: totals.mountains.size,
  };
}

/** 특정 월만 뽑는다. 없으면 0으로 채운 빈 통계를 준다 — 화면이 분기하지 않아도 되게. */
export function statForMonth(records, monthKey) {
  const list = records.filter((r) => monthKeyOf(r) === monthKey);
  return { ...summarize(list), monthKey, records: sortByDateDesc(list) };
}

/**
 * 산행한 달의 최장 연속 개월 수. MONTHLY_STREAK 배지 판정에 쓴다.
 * @param {import('../entities/hikeRecord.js').HikeRecord[]} records
 */
export function longestMonthlyStreak(records) {
  const months = Array.from(new Set(records.map(monthKeyOf).filter(Boolean))).sort();
  if (months.length === 0) return 0;

  let best = 1;
  let run = 1;

  for (let i = 1; i < months.length; i += 1) {
    if (isNextMonth(months[i - 1], months[i])) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 1;
    }
  }
  return best;
}

/**
 * 최근 n개월의 월 키를 과거→현재 순으로 만든다. 막대 추이 표시용.
 * @param {string} fromMonthKey 기준 월 'YYYY-MM'
 * @param {number} n
 */
export function recentMonthKeys(fromMonthKey, n) {
  const keys = [];
  let cursor = fromMonthKey;
  for (let i = 0; i < n; i += 1) {
    keys.unshift(cursor);
    cursor = shiftMonth(cursor, -1);
  }
  return keys;
}

/** 'YYYY-MM' 을 delta 개월만큼 이동 */
export function shiftMonth(monthKey, delta) {
  const [y, m] = monthKey.split('-').map(Number);
  const total = y * 12 + (m - 1) + delta;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

function isNextMonth(prev, next) {
  return shiftMonth(prev, 1) === next;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}
