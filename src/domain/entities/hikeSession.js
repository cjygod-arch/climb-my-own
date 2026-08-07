/**
 * domain/entities/hikeSession.js — 진행 중인 산행 세션.
 *
 * '안내받기'를 누른 순간부터 '종료'까지의 상태다.
 * 끝나면 HikeRecord로 바뀌어 기록에 남는다 — 세션 자체는 임시 상태다.
 *
 * 산행은 몇 시간씩 걸리고 그 사이 화면이 꺼지거나 새로고침될 수 있으므로,
 * 세션은 반드시 저장소에 보관해야 한다. 메모리에만 두면 안 된다.
 */

/**
 * @typedef {Object} TrackPoint
 * @property {number} lat
 * @property {number} lng
 * @property {string} at        ISO 시각
 * @property {number} accuracy  미터
 */

/**
 * @typedef {Object} HikeSession
 * @property {string} id
 * @property {'hike'|'walk'} activityType 활동 종류. 걷기는 코스도 산도 없다
 * @property {string} courseId
 * @property {string} mountainId
 * @property {string} courseName   화면 표시용. 코스를 다시 조회하지 않아도 되게 복사해 둔다
 * @property {string} mountainName
 * @property {string} startedAt    ISO
 * @property {string|null} endedAt ISO
 * @property {'active'|'finished'} status
 * @property {TrackPoint[]} points 기록한 이동 경로
 * @property {number} maxAlongM    도달한 최대 진행 거리(m)
 */

import { normalizeActivityType } from './activity.js';

export const SessionStatus = Object.freeze({
  ACTIVE: 'active',
  FINISHED: 'finished',
});

/** 저장할 좌표 수 상한. 8시간 산행에 15초 간격이면 약 1,900점이라 넉넉하다. */
export const MAX_POINTS = 3000;

/**
 * @param {Partial<HikeSession>} raw
 * @returns {HikeSession}
 */
export function createHikeSession(raw = {}) {
  return {
    id: String(raw.id ?? ''),
    activityType: normalizeActivityType(raw.activityType),
    courseId: String(raw.courseId ?? ''),
    mountainId: String(raw.mountainId ?? ''),
    courseName: raw.courseName ?? '',
    mountainName: raw.mountainName ?? '',
    startedAt: raw.startedAt ?? '',
    endedAt: raw.endedAt ?? null,
    status: raw.status === SessionStatus.FINISHED ? SessionStatus.FINISHED : SessionStatus.ACTIVE,
    points: Array.isArray(raw.points) ? raw.points : [],
    maxAlongM: Number(raw.maxAlongM) || 0,
  };
}

export const isActive = (session) => session?.status === SessionStatus.ACTIVE;

/**
 * 경과 시간(분). 끝난 세션은 종료 시각까지, 진행 중이면 지금까지.
 * @param {HikeSession} session
 * @param {string} nowIso
 */
export function elapsedMinutes(session, nowIso) {
  if (!session?.startedAt) return 0;
  const start = Date.parse(session.startedAt);
  const end = Date.parse(session.endedAt ?? nowIso);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.round((end - start) / 60000));
}

/**
 * 좌표를 덧붙인다. 원본을 바꾸지 않고 새 세션을 돌려준다.
 *
 * 같은 자리에서 GPS가 미세하게 흔들리는 것까지 다 저장하면 용량만 늘고 거리도 부풀려진다.
 * 일정 거리 이상 움직였거나 일정 시간이 지났을 때만 남긴다.
 *
 * @param {HikeSession} session
 * @param {TrackPoint} point
 * @param {{ minStepM?: number, minGapSec?: number }} [options]
 * @returns {HikeSession}
 */
export function appendPoint(session, point, { minStepM = 10, minGapSec = 20 } = {}) {
  const last = session.points[session.points.length - 1];

  if (last) {
    const movedEnough = roughMeters(last, point) >= minStepM;
    const waitedEnough = (Date.parse(point.at) - Date.parse(last.at)) / 1000 >= minGapSec;
    if (!movedEnough && !waitedEnough) return session;
  }

  const points = [...session.points, point];
  // 상한을 넘으면 오래된 절반을 솎아낸다. 경로의 전체 모양은 유지된다.
  const trimmed = points.length > MAX_POINTS
    ? points.filter((_, i) => i % 2 === 0 || i >= points.length - MAX_POINTS / 2)
    : points;

  return { ...session, points: trimmed };
}

/** 진행 거리 갱신. 뒷걸음치지 않는다. */
export function advance(session, alongM) {
  return alongM > session.maxAlongM ? { ...session, maxAlongM: alongM } : session;
}

/** @returns {HikeSession} */
export function finish(session, endedAt) {
  return { ...session, status: SessionStatus.FINISHED, endedAt };
}

/** 대략적인 거리. 좌표 저장 여부만 판단하므로 정밀할 필요가 없다. */
function roughMeters(a, b) {
  const dLat = (b.lat - a.lat) * 110540;
  const dLng = (b.lng - a.lng) * 88000; // 위도 37도 부근 근사
  return Math.hypot(dLat, dLng);
}
