/**
 * domain/entities/courseSegment.js — 코스 구간(지점).
 *
 * 지도를 쓰지 않기로 했으므로, 이 엔티티가 '길 안내'의 실질 단위다.
 * cumDistanceKm는 들머리에서부터의 누적 거리다 — 구간 거리가 아니다.
 * 누적으로 저장해야 고도 단면도의 x축과 1:1로 대응한다.
 */

/**
 * @typedef {Object} CourseSegment
 * @property {string} id
 * @property {string} courseId
 * @property {number} seq            0부터. 들머리가 0
 * @property {string} name           지점명 (예: '소공원', '비선대')
 * @property {number} cumDistanceKm  들머리 기준 누적 거리
 * @property {number} elevationM     해당 지점 표고
 * @property {string} note           안내 문구
 * @property {number|null} lat       위도. 없으면 지도에 표시하지 않는다
 * @property {number|null} lng       경도
 */

/**
 * @param {Partial<CourseSegment>} raw
 * @returns {CourseSegment}
 */
export function createCourseSegment(raw = {}) {
  return {
    id: String(raw.id ?? ''),
    courseId: String(raw.courseId ?? ''),
    seq: Number(raw.seq ?? 0),
    name: raw.name ?? '',
    cumDistanceKm: toNumber(raw.cumDistanceKm),
    elevationM: toNumber(raw.elevationM),
    note: raw.note ?? '',
    // 좌표는 선택 항목이다. 없어도 구간 안내와 고도 단면은 그대로 동작한다.
    lat: toCoord(raw.lat),
    lng: toCoord(raw.lng),
  };
}

/** 좌표가 둘 다 있어야 지도에 찍을 수 있다. */
export function hasCoords(segment) {
  return segment.lat !== null && segment.lng !== null;
}

/** seq 순으로 정렬한 복사본. 저장소가 순서를 보장하지 않아도 화면은 안전하다. */
export function sortSegments(segments) {
  return [...segments].sort((a, b) => a.seq - b.seq);
}

/** 직전 지점 대비 구간 거리 */
export function legDistanceKm(segments, index) {
  if (index <= 0) return 0;
  return round1(segments[index].cumDistanceKm - segments[index - 1].cumDistanceKm);
}

/** 직전 지점 대비 고도 변화. 양수면 오름 */
export function legElevationDeltaM(segments, index) {
  if (index <= 0) return 0;
  return Math.round(segments[index].elevationM - segments[index - 1].elevationM);
}

/** 최고점 인덱스. 고도 단면도의 정상 마커 위치로 쓴다. */
export function peakIndex(segments) {
  if (segments.length === 0) return null;
  let best = 0;
  for (let i = 1; i < segments.length; i += 1) {
    if (segments[i].elevationM > segments[best].elevationM) best = i;
  }
  return best;
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** 좌표는 0으로 대체하면 안 된다 — 0,0은 바다 한가운데다. 없으면 null. */
function toCoord(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}
