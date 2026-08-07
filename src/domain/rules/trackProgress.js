/**
 * domain/rules/trackProgress.js — 현재 위치가 코스의 어디쯤인지 계산한다.
 *
 * 순수 함수만 둔다. GPS도 지도도 모른다 — 좌표만 받아 숫자를 돌려준다.
 * 이 파일이 "해당 코스로 가고 있는가 / 어디쯤인가"의 판단 전부를 책임진다.
 *
 * 좌표 계산은 국소 평면 근사를 쓴다. 한 코스는 길어야 수십 km라
 * 이 범위에서 등거리원통 근사의 오차는 미터 단위 미만이고, 삼각함수를 훨씬 덜 쓴다.
 */

const EARTH_M = 6371000;
const rad = (d) => (d * Math.PI) / 180;

/** 코스에서 이만큼 벗어나면 '경로 이탈'로 본다. 등산로 GPS 오차와 매핑 오차를 감안한 값. */
export const OFF_TRACK_THRESHOLD_M = 120;

/** 이 정확도보다 나쁜 신호는 위치 판단에 쓰지 않는다. */
export const POOR_ACCURACY_M = 100;

export function haversineM(a, b) {
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** 기준점 근처를 미터 평면으로 편다. */
function toXY(p, ref) {
  return [
    (p[1] - ref[1]) * Math.cos(rad(ref[0])) * 111320,
    (p[0] - ref[0]) * 110540,
  ];
}

/**
 * 트랙 각 지점까지의 누적 거리(m). 한 번 계산해 재사용한다.
 * @param {Array<[number,number]>} track
 * @returns {number[]}
 */
export function cumulativeMeters(track) {
  const out = [0];
  for (let i = 1; i < track.length; i += 1) {
    out.push(out[i - 1] + haversineM(track[i - 1], track[i]));
  }
  return out;
}

/** 되돌아오는 길을 찾을 때 앞뒤로 살펴볼 범위. */
const WINDOW_BACK_M = 200;
const WINDOW_FORWARD_M = 1200;

/**
 * 현재 위치를 트랙 위로 투영한다.
 *
 * fromM을 주면 그 지점 앞뒤 일정 범위 안에서만 찾는다.
 * 원점회귀·왕복 코스에서는 갔던 길과 오는 길이 같은 좌표를 지나므로,
 * 전체에서 최근접점을 찾으면 되돌아오는 내내 '출발점 근처'로 판정되어 진행이 멈춘다.
 * 직전 위치 근처에서 찾으면 왕복 코스에서도 진행이 이어진다.
 *
 * @param {Array<[number,number]>} track
 * @param {[number,number]} point
 * @param {number[]} [cum] cumulativeMeters 결과(있으면 재사용)
 * @param {{ fromM?: number|null }} [options]
 * @returns {{ alongM: number, offTrackM: number, index: number, snapped: [number,number] } | null}
 */
export function projectOnTrack(track, point, cum = null, { fromM = null } = {}) {
  if (!Array.isArray(track) || track.length < 2) return null;

  const cumulative = cum ?? cumulativeMeters(track);

  const windowed = fromM === null ? null : searchRange(track, cumulative, point, fromM);
  // 범위 안에서 코스 위라고 볼 만한 결과가 나왔으면 그것을 쓴다.
  if (windowed && windowed.offTrackM <= OFF_TRACK_THRESHOLD_M) return windowed;

  // 범위 밖으로 벗어났거나 처음이면 트랙 전체에서 찾는다.
  const global = searchRange(track, cumulative, point, null);
  if (!windowed) return global;

  // 둘 다 이탈이면 더 가까운 쪽을 보고한다.
  return global.offTrackM < windowed.offTrackM ? global : windowed;
}

function searchRange(track, cumulative, point, fromM) {
  const lo = fromM === null ? -Infinity : fromM - WINDOW_BACK_M;
  const hi = fromM === null ? Infinity : fromM + WINDOW_FORWARD_M;

  let best = null;

  for (let i = 1; i < track.length; i += 1) {
    if (cumulative[i] < lo || cumulative[i - 1] > hi) continue;
    const a = track[i - 1];
    const b = track[i];

    // 이 구간 근처만 평면으로 펴서 계산한다.
    const [bx, by] = toXY(b, a);
    const [px, py] = toXY(point, a);

    const segLenSq = bx * bx + by * by;
    // 같은 좌표가 연달아 있으면 건너뛴다(0으로 나누기 방지).
    const t = segLenSq === 0 ? 0 : Math.max(0, Math.min(1, (px * bx + py * by) / segLenSq));

    const sx = bx * t;
    const sy = by * t;
    const offM = Math.hypot(px - sx, py - sy);

    if (!best || offM < best.offTrackM) {
      const segLen = Math.sqrt(segLenSq);
      best = {
        offTrackM: offM,
        alongM: cumulative[i - 1] + segLen * t,
        index: i - 1,
        snapped: [
          a[0] + (b[0] - a[0]) * t,
          a[1] + (b[1] - a[1]) * t,
        ],
      };
    }
  }

  return best;
}

/**
 * 진행 상황 요약. 화면이 그대로 쓸 수 있는 형태로 돌려준다.
 *
 * @param {Array<[number,number]>} track
 * @param {[number,number]} point
 * @param {{ cum?: number[], maxAlongM?: number }} [options]
 *   maxAlongM — 지금까지 도달한 최대 진행 거리. 되돌아가도 진행률이 줄지 않게 한다.
 */
export function progressAt(track, point, { cum = null, maxAlongM = 0 } = {}) {
  const cumulative = cum ?? cumulativeMeters(track);
  const totalM = cumulative[cumulative.length - 1] ?? 0;
  // 직전 진행 지점 근처부터 찾는다 — 왕복 코스에서 되돌아올 때도 진행이 이어진다.
  const projection = projectOnTrack(track, point, cumulative, {
    fromM: maxAlongM > 0 ? maxAlongM : null,
  });

  if (!projection) {
    return { totalM, alongM: 0, remainingM: totalM, ratio: 0, offTrackM: null, offTrack: false, snapped: null };
  }

  // 진행 거리는 단조 증가로 본다. 정상에서 잠시 머물거나 GPS가 튀어도 진행률이 뒷걸음치지 않는다.
  const alongM = Math.max(projection.alongM, maxAlongM);

  return {
    totalM,
    alongM,
    remainingM: Math.max(0, totalM - alongM),
    ratio: totalM > 0 ? Math.min(1, alongM / totalM) : 0,
    offTrackM: projection.offTrackM,
    offTrack: projection.offTrackM > OFF_TRACK_THRESHOLD_M,
    snapped: projection.snapped,
    index: projection.index,
  };
}

/**
 * 구간 지점이 트랙 위 어디에 있는지 미리 계산한다.
 *
 * 구간의 cumDistanceKm(사람이 적은 값)와 실제 트랙 길이는 일치하지 않는다.
 * 둘을 섞어 쓰면 "다음 지점"이 엉뚱하게 나온다.
 * 지점 좌표를 트랙에 투영해 얻은 alongM을 쓰면 항상 같은 자로 잰 값이 된다.
 *
 * 왕복 코스에서 같은 지점이 두 번 나오는 것도 순서대로 처리된다 —
 * 직전 지점 이후 범위에서만 찾기 때문이다.
 *
 * @param {Array<[number,number]>} track
 * @param {Array<object>} segments
 * @param {number[]} [cum]
 * @returns {Array<object>} segments에 alongM이 붙은 복사본
 */
export function locateWaypoints(track, segments, cum = null) {
  const cumulative = cum ?? cumulativeMeters(track);
  const totalM = cumulative[cumulative.length - 1] ?? 0;

  let cursor = null;
  return segments.map((s, i) => {
    if (s.lat === null || s.lat === undefined || s.lng === null || s.lng === undefined) {
      // 좌표가 없으면 적혀 있는 거리를 트랙 길이에 비례해 환산한다.
      const declaredTotal = segments[segments.length - 1]?.cumDistanceKm || 1;
      return { ...s, alongM: (s.cumDistanceKm / declaredTotal) * totalM };
    }

    const projection = projectOnTrack(track, [s.lat, s.lng], cumulative, { fromM: cursor });
    const alongM = projection ? projection.alongM : (cursor ?? 0);
    // 마지막 지점은 트랙 끝으로 본다. 원점회귀에서 출발점과 겹쳐도 끝으로 처리된다.
    const resolved = i === segments.length - 1 ? Math.max(alongM, totalM * 0.98) : alongM;
    cursor = resolved;
    return { ...s, alongM: resolved };
  });
}

/**
 * 지금 위치 기준으로 다음에 만날 구간 지점.
 * @param {Array<object>} located locateWaypoints 결과
 * @param {number} alongM
 */
export function nextWaypoint(located, alongM) {
  return located.find((s) => s.alongM > alongM + 20) ?? null;
}

/** 방금 지나온 구간 지점. */
export function passedWaypoint(located, alongM) {
  let last = null;
  for (const s of located) {
    if (s.alongM <= alongM + 20) last = s;
    else break;
  }
  return last;
}

/**
 * 사람이 낼 수 있는 최대 속도(m/s). 이보다 빠른 이동은 GPS가 튄 것으로 본다.
 * 뛰어서 내려오는 경우까지 감안한 값이다.
 */
export const MAX_PLAUSIBLE_SPEED_MPS = 5;

/**
 * 기록한 좌표들의 실제 이동 거리(m).
 *
 * 두 가지를 거른다.
 *   너무 작은 이동 — 제자리에서 GPS가 떨리는 것. 더하면 거리가 부풀려진다.
 *   너무 큰 이동   — 신호를 다시 잡을 때 순간이동처럼 찍히는 것.
 *                   터널이나 계곡을 지나면 실제로 일어나며, 그대로 더하면
 *                   7km 코스가 13km로 기록된다.
 */
export function traveledMeters(points, { minStepM = 8, maxSpeedMps = MAX_PLAUSIBLE_SPEED_MPS } = {}) {
  let total = 0;
  let prev = null;

  for (const p of points) {
    const cur = [p.lat, p.lng];
    if (!prev) { prev = { at: p.at, coord: cur }; continue; }

    const d = haversineM(prev.coord, cur);
    if (d < minStepM) continue;

    const gapSec = Math.max(1, (Date.parse(p.at) - Date.parse(prev.at)) / 1000);
    // 물리적으로 불가능한 도약은 거리에 더하지 않되, 기준점은 옮긴다.
    if (d / gapSec <= maxSpeedMps) total += d;

    prev = { at: p.at, coord: cur };
  }

  return total;
}

/**
 * 남은 거리와 지금까지의 속도로 도착 예정까지 남은 시간(분)을 추정한다.
 * 데이터가 모자라면 null — 화면은 '—'로 표시한다. 근거 없는 숫자를 보여주지 않는다.
 */
export function estimateRemainingMin(alongM, remainingM, elapsedMin) {
  if (alongM < 200 || elapsedMin < 3) return null;
  const speedMPerMin = alongM / elapsedMin;
  if (speedMPerMin <= 0) return null;
  return Math.round(remainingM / speedMPerMin);
}
