/**
 * domain/rules/filterSpec.js — 카테고리별 필터 규칙.
 *
 * 필터 조건을 '데이터'로 표현하고, 그 데이터를 술어(predicate)로 바꾼다.
 * 이렇게 해두면 같은 조건 객체를 나중에 서버 쿼리 파라미터로도 그대로 넘길 수 있다.
 *
 * 축 간에는 AND, 축 안에서는 OR 로 결합한다.
 *   (수도권 OR 강원) AND (암릉 OR 조망) AND (난이도 중)
 */

import { ELEVATION_BANDS } from '../entities/mountain.js';
import { difficultyRank } from './difficulty.js';

/**
 * @typedef {Object} FilterSpec
 * @property {string[]} regions
 * @property {string[]} categories
 * @property {string[]} difficulties
 * @property {string[]} bands       ELEVATION_BANDS의 id
 * @property {string} query         이름 검색어
 */

export const SORT_KEYS = Object.freeze({
  NAME: 'name',
  ELEVATION_DESC: 'elevationDesc',
  ELEVATION_ASC: 'elevationAsc',
  DIFFICULTY: 'difficulty',
});

/** @returns {FilterSpec} */
export function emptySpec() {
  return { regions: [], categories: [], difficulties: [], bands: [], query: '' };
}

export function isEmptySpec(spec) {
  return (
    spec.regions.length === 0 &&
    spec.categories.length === 0 &&
    spec.difficulties.length === 0 &&
    spec.bands.length === 0 &&
    !spec.query.trim()
  );
}

/** 적용 중인 조건 개수. 필터 버튼의 뱃지 숫자로 쓴다. */
export function activeCount(spec) {
  return (
    spec.regions.length +
    spec.categories.length +
    spec.difficulties.length +
    spec.bands.length +
    (spec.query.trim() ? 1 : 0)
  );
}

/**
 * 배열 축의 값을 토글한 새 spec을 돌려준다. 원본을 변경하지 않는다.
 * @param {FilterSpec} spec
 * @param {'regions'|'categories'|'difficulties'|'bands'} axis
 * @param {string} value
 */
export function toggle(spec, axis, value) {
  const list = spec[axis];
  const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  return { ...spec, [axis]: next };
}

export function setQuery(spec, query) {
  return { ...spec, query };
}

/**
 * spec을 술어 함수로 변환한다.
 * @param {FilterSpec} spec
 * @returns {(mountain: import('../entities/mountain.js').Mountain) => boolean}
 */
export function toPredicate(spec) {
  const query = spec.query.trim().toLowerCase();
  const bands = spec.bands
    .map((id) => ELEVATION_BANDS.find((b) => b.id === id))
    .filter(Boolean);

  return (mountain) => {
    if (spec.regions.length && !spec.regions.includes(mountain.region)) return false;
    if (spec.difficulties.length && !spec.difficulties.includes(mountain.difficulty)) return false;

    // 테마는 하나라도 겹치면 통과한다(OR).
    if (spec.categories.length && !spec.categories.some((c) => mountain.categories.includes(c))) {
      return false;
    }

    if (bands.length && !bands.some((b) => mountain.elevationM >= b.min && mountain.elevationM < b.max)) {
      return false;
    }

    if (query) {
      const haystack = `${mountain.name} ${mountain.nameHanja} ${mountain.province}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    return true;
  };
}

/**
 * @param {import('../entities/mountain.js').Mountain[]} mountains
 * @param {FilterSpec} spec
 * @param {string} [sortKey]
 */
export function applyFilter(mountains, spec, sortKey = SORT_KEYS.NAME) {
  return sortMountains(mountains.filter(toPredicate(spec)), sortKey);
}

export function sortMountains(mountains, sortKey) {
  const list = [...mountains];
  switch (sortKey) {
    case SORT_KEYS.ELEVATION_DESC:
      return list.sort((a, b) => b.elevationM - a.elevationM);
    case SORT_KEYS.ELEVATION_ASC:
      return list.sort((a, b) => a.elevationM - b.elevationM);
    case SORT_KEYS.DIFFICULTY:
      return list.sort(
        (a, b) => difficultyRank(a.difficulty) - difficultyRank(b.difficulty) || a.name.localeCompare(b.name, 'ko'),
      );
    default:
      return list.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }
}

/**
 * 각 필터 값이 몇 건에 해당하는지 센다. 칩에 개수를 표시할 때 쓴다.
 * 자기 축은 제외하고 세야 "선택하면 0건" 같은 막다른 길이 생기지 않는다.
 */
export function countsFor(mountains, spec, axis, values) {
  const base = { ...spec, [axis]: [] };
  const pool = mountains.filter(toPredicate(base));

  return values.reduce((acc, value) => {
    acc[value] = pool.filter(toPredicate({ ...base, [axis]: [value] })).length;
    return acc;
  }, {});
}
