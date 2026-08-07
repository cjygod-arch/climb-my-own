/**
 * domain/rules/coursePath.js — 코스 → 지도용 경로.
 *
 * 지도 라이브러리를 모른다. 좌표 배열과 경계 상자만 만든다.
 * Leaflet을 다른 것으로 바꿔도 이 파일은 그대로다 — shared/ui/RouteMap.js만 바뀐다.
 *
 * 경로에는 두 종류가 있고, 화면은 반드시 이 둘을 구분해 표기해야 한다.
 *   1. course.track — OSM에 매핑된 실제 보행로를 따라 만든 조밀한 좌표열.
 *      tools/fetch-tracks.mjs 가 생성한다. 실제 등산로 모양을 따라간다.
 *   2. 구간 지점을 이은 직선 — track이 없을 때의 대체물. 실제 길과 모양이 다르다.
 *
 * 없는 것을 있는 척하지 않는 것이 이 파일의 핵심 책임이다.
 * isTrack 플래그로 그 차이를 화면까지 전달한다.
 */

import { sortSegments, hasCoords } from '../entities/courseSegment.js';

/**
 * 코스의 지도 경로를 만든다.
 * @param {import('../entities/course.js').Course} course
 * @returns {{ points: Array<[number,number]>, markers: Array<{lat:number,lng:number,name:string,seq:number}>, isTrack: boolean }}
 */
export function pathOf(course) {
  // 조밀한 실측 트랙이 있으면 그것이 우선이다.
  if (Array.isArray(course.track) && course.track.length > 1) {
    return { points: course.track.map(([lat, lng]) => [lat, lng]), markers: markersOf(course), isTrack: true };
  }

  const points = sortSegments(course.segments)
    .filter(hasCoords)
    .map((s) => [s.lat, s.lng]);

  return { points, markers: markersOf(course), isTrack: false };
}

/** 지점 마커. 원점회귀에서 시작=끝 지점이 겹치면 뒤엣것을 버린다. */
function markersOf(course) {
  const sorted = sortSegments(course.segments).filter(hasCoords);
  const seen = new Set();

  return sorted.filter((s) => {
    const key = `${s.lat.toFixed(4)},${s.lng.toFixed(4)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((s) => ({ lat: s.lat, lng: s.lng, name: s.name, seq: s.seq }));
}

export function hasPath(course) {
  return pathOf(course).points.length > 1;
}

/**
 * 화면에 붙일 경로 출처 표기.
 * @returns {{ label: string, approximate: boolean }}
 */
export function pathProvenance(course) {
  return Array.isArray(course.track) && course.track.length > 1
    ? { label: course.trackSource || '실제 등산로', approximate: false }
    : { label: '개략 경로', approximate: true };
}

/**
 * 여러 경로를 모두 담는 경계 상자.
 * @param {Array<Array<[number,number]>>} pointGroups
 * @returns {{ south:number, west:number, north:number, east:number }|null}
 */
export function boundsOf(pointGroups) {
  const all = pointGroups.flat();
  if (all.length === 0) return null;

  let south = Infinity, west = Infinity, north = -Infinity, east = -Infinity;
  for (const [lat, lng] of all) {
    if (lat < south) south = lat;
    if (lat > north) north = lat;
    if (lng < west) west = lng;
    if (lng > east) east = lng;
  }

  // 점이 하나뿐이면 경계가 0이 되어 지도가 최대 확대된다. 최소 폭을 준다.
  if (north - south < 0.004) { north += 0.002; south -= 0.002; }
  if (east - west < 0.004) { east += 0.002; west -= 0.002; }

  return { south, west, north, east };
}
