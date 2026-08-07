/**
 * domain/entities/course.js — 등산 코스.
 *
 * 공식 코스와 사용자가 등록한 '내 코스'가 같은 엔티티를 쓴다.
 * 구분은 isOfficial / ownerId 두 필드로만 한다. 화면도 저장소도 이 규칙 하나만 안다.
 */

import { sortSegments } from './courseSegment.js';

/**
 * @typedef {Object} Course
 * @property {string} id
 * @property {string} mountainId
 * @property {string} name
 * @property {number} distanceKm    편도 또는 원점회귀 총 거리
 * @property {number} ascentM       누적 상승고도
 * @property {number} durationMin   표준 소요 시간
 * @property {string} difficulty    DIFFICULTY 중 하나
 * @property {string} trailhead     들머리
 * @property {string} endpoint      날머리
 * @property {string} courseType    COURSE_TYPES 중 하나
 * @property {boolean} isOfficial   true면 공개 코스, false면 내 코스
 * @property {string|null} ownerId  내 코스일 때만 값이 있다
 * @property {string} note
 * @property {import('./courseSegment.js').CourseSegment[]} segments
 * @property {Array<[number,number]>|null} track
 *   실제 등산로를 따라가는 조밀한 좌표열. OSM에 매핑된 길을 따라 만든 것으로,
 *   있으면 지도가 이것을 그린다(구간 지점을 직선으로 잇지 않는다).
 *   없으면 구간 지점을 이은 개략 경로로 대체된다.
 * @property {string} trackSource 경로 출처 표기. 비어 있으면 개략 경로다.
 */

export const COURSE_TYPES = Object.freeze(['원점회귀', '종주', '편도']);

/**
 * @param {Partial<Course>} raw
 * @returns {Course}
 */
export function createCourse(raw = {}) {
  return {
    id: String(raw.id ?? ''),
    mountainId: String(raw.mountainId ?? ''),
    name: raw.name ?? '',
    distanceKm: toNumber(raw.distanceKm),
    ascentM: toNumber(raw.ascentM),
    durationMin: toNumber(raw.durationMin),
    difficulty: raw.difficulty ?? '중',
    trailhead: raw.trailhead ?? '',
    endpoint: raw.endpoint ?? '',
    courseType: raw.courseType ?? '원점회귀',
    isOfficial: raw.isOfficial ?? true,
    ownerId: raw.ownerId ?? null,
    note: raw.note ?? '',
    segments: Array.isArray(raw.segments) ? sortSegments(raw.segments) : [],
    // 좌표쌍이 2개 미만이면 선을 그을 수 없으므로 없는 것으로 친다.
    track: Array.isArray(raw.track) && raw.track.length > 1 ? raw.track : null,
    trackSource: raw.trackSource ?? '',
  };
}

/** 지도에 실제 등산로를 그릴 수 있는가. false면 개략 경로를 그린다. */
export function hasRealTrack(course) {
  return Array.isArray(course.track) && course.track.length > 1;
}

export const isMyCourse = (course) => !course.isOfficial;

/** 들머리 → 날머리 표기. 원점회귀면 한쪽만 쓴다. */
export function routeLabel(course) {
  if (!course.trailhead) return '';
  if (!course.endpoint || course.endpoint === course.trailhead) return course.trailhead;
  return `${course.trailhead} → ${course.endpoint}`;
}

/**
 * 저장 전 검증. 실패 사유 배열을 돌려준다(빈 배열이면 통과).
 * 화면은 이 메시지를 그대로 보여줄 수 있다.
 */
export function validateCourse(course) {
  const errors = [];
  if (!course.mountainId) errors.push('산을 선택해 주세요.');
  if (!course.name?.trim()) errors.push('코스 이름을 입력해 주세요.');
  if (!(course.distanceKm > 0)) errors.push('거리는 0보다 커야 합니다.');
  if (course.ascentM < 0) errors.push('상승고도는 0 이상이어야 합니다.');
  if (course.durationMin < 0) errors.push('소요 시간은 0 이상이어야 합니다.');
  return errors;
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
