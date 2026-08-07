/**
 * domain/entities/hikeRecord.js — 산행 기록.
 *
 * 산행과 걷기가 같은 테이블을 쓴다. 구분은 activityType 하나로만 한다
 * (domain/entities/activity.js). 걷기에는 산도 코스도 없으므로 mountainId가 비어 있다.
 *
 * hikedOn은 'YYYY-MM-DD' 문자열이다. Date 객체로 다루지 않는다 —
 * 타임존 때문에 사용자가 입력한 날짜가 하루 밀리는 사고를 원천 차단하기 위함이다.
 * 월 집계 키도 이 문자열을 잘라 만든다.
 */

/**
 * @typedef {Object} HikeRecord
 * @property {string} id
 * @property {string} userId
 * @property {string} mountainId
 * @property {string|null} courseId
 * @property {string} hikedOn      'YYYY-MM-DD'
 * @property {number} distanceKm
 * @property {number} ascentM
 * @property {number} durationMin
 * @property {string} memo
 * @property {string} createdAt    ISO 문자열
 * @property {string|null} startedAt 안내로 기록했을 때의 출발 시각 (ISO). 직접 입력이면 null
 * @property {string|null} endedAt   안내로 기록했을 때의 도착 시각 (ISO)
 * @property {'hike'|'walk'} activityType 활동 종류
 * @property {string} title          걷기의 제목. 산행은 산 이름을 쓰므로 보통 비어 있다
 * @property {Array<[number,number]>|null} route 실제로 이동한 경로. 지도에 그린다
 */

import { normalizeActivityType, isWalk } from './activity.js';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @param {Partial<HikeRecord>} raw
 * @returns {HikeRecord}
 */
export function createHikeRecord(raw = {}) {
  return {
    id: String(raw.id ?? ''),
    userId: String(raw.userId ?? ''),
    mountainId: String(raw.mountainId ?? ''),
    courseId: raw.courseId ?? null,
    hikedOn: ISO_DATE.test(raw.hikedOn ?? '') ? raw.hikedOn : '',
    distanceKm: toNumber(raw.distanceKm),
    ascentM: toNumber(raw.ascentM),
    durationMin: toNumber(raw.durationMin),
    memo: raw.memo ?? '',
    createdAt: raw.createdAt ?? '',
    // 안내를 받아 기록한 경우에만 채워진다. 직접 입력한 기록은 비어 있다.
    startedAt: raw.startedAt ?? null,
    endedAt: raw.endedAt ?? null,
    activityType: normalizeActivityType(raw.activityType),
    title: raw.title ?? '',
    // 좌표쌍이 2개 미만이면 선을 그을 수 없으므로 없는 것으로 친다.
    route: Array.isArray(raw.route) && raw.route.length > 1 ? raw.route : null,
  };
}

/** 이동 경로가 남아 있어 지도에 그릴 수 있는가. */
export function hasRoute(record) {
  return Array.isArray(record.route) && record.route.length > 1;
}

/** 출발·도착 시각이 기록된 산행인가. 안내를 통해 만들어진 기록이다. */
export function isTracked(record) {
  return Boolean(record.startedAt && record.endedAt);
}

/** 'YYYY-MM-DD' → 'YYYY-MM'. 월별 집계의 그룹 키. */
export function monthKeyOf(record) {
  return record.hikedOn ? record.hikedOn.slice(0, 7) : '';
}

/** 최신순 정렬 복사본. 같은 날이면 나중에 입력한 것이 위로. */
export function sortByDateDesc(records) {
  return [...records].sort((a, b) => {
    if (a.hikedOn !== b.hikedOn) return a.hikedOn < b.hikedOn ? 1 : -1;
    return a.createdAt < b.createdAt ? 1 : -1;
  });
}

/**
 * 저장 전 검증. 실패 사유 배열(빈 배열이면 통과).
 * @param {HikeRecord} record
 * @param {{ today?: string }} [context] 미래 날짜 차단용. 호출부가 오늘 날짜를 넘긴다.
 */
export function validateHikeRecord(record, context = {}) {
  const errors = [];

  if (!ISO_DATE.test(record.hikedOn)) {
    errors.push('산행 날짜를 선택해 주세요.');
  } else if (context.today && record.hikedOn > context.today) {
    errors.push('미래 날짜는 기록할 수 없습니다.');
  }

  // 걷기에는 산이 없다. 산행일 때만 요구한다.
  if (!isWalk(record) && !record.mountainId) errors.push('산을 선택해 주세요.');
  // 산행은 거리가 있어야 한다. 걷기는 GPS가 잡히지 않아 0으로 측정될 수 있는데,
  // 그때 저장을 막으면 사용자가 걸은 시간까지 통째로 잃는다.
  if (!isWalk(record) && !(record.distanceKm > 0)) errors.push('거리는 0보다 커야 합니다.');
  if (record.distanceKm < 0) errors.push('거리는 0 이상이어야 합니다.');
  if (record.distanceKm > 200) errors.push('거리가 너무 큽니다. 단위(km)를 확인해 주세요.');
  if (record.ascentM < 0) errors.push('상승고도는 0 이상이어야 합니다.');
  if (record.durationMin < 0) errors.push('소요 시간은 0 이상이어야 합니다.');
  if (record.durationMin > 60 * 48) errors.push('소요 시간이 너무 깁니다. 확인해 주세요.');

  return errors;
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
