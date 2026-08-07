/**
 * domain/entities/activity.js — 활동 종류.
 *
 * 이 앱의 중심은 산행이지만, 동네 걷기처럼 코스가 없는 활동도 기록한다.
 * 둘은 저장 구조를 공유하되 의미가 다르므로 반드시 구분해야 한다.
 *
 * 구분이 필요한 이유:
 *   - 걷기에는 산도 코스도 없다 (mountainId가 비어 있어도 정상이다)
 *   - 배지는 산행에만 준다. '명산 5'나 '누적 100km' 같은 이름은 등산 맥락이라
 *     동네 산책으로 채워지면 그 배지가 뜻을 잃는다
 *   - 100대 명산 진행률에 걷기가 섞이면 안 된다
 */

export const ActivityType = Object.freeze({
  /** 코스를 따라 오르는 산행 */
  HIKE: 'hike',
  /** 코스 없이 걸은 기록 (동네 산책 등) */
  WALK: 'walk',
});

export const ACTIVITY_LABELS = Object.freeze({
  [ActivityType.HIKE]: '산행',
  [ActivityType.WALK]: '걷기',
});

/** 알 수 없는 값이 들어와도 산행으로 본다 — 기존 기록에는 이 필드가 없다. */
export function normalizeActivityType(value) {
  return value === ActivityType.WALK ? ActivityType.WALK : ActivityType.HIKE;
}

export const isWalk = (x) => normalizeActivityType(x?.activityType) === ActivityType.WALK;
export const isHike = (x) => normalizeActivityType(x?.activityType) === ActivityType.HIKE;

export function activityLabel(x) {
  return ACTIVITY_LABELS[normalizeActivityType(x?.activityType)];
}

/**
 * 기록 목록에 보여줄 제목.
 * 산행은 산 이름이, 걷기는 사용자가 붙인 제목이 주인공이다.
 */
export function displayTitle(record, mountainName = '') {
  if (isWalk(record)) return record.title || '걷기';
  return mountainName || record.title || '산행';
}
