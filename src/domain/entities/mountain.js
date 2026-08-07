/**
 * domain/entities/mountain.js — 산.
 *
 * 이 파일은 DOM도, fetch도, Supabase도 모른다 (ARCHITECTURE.md R2).
 * DB 컬럼명(snake_case)은 여기까지 오지 않는다 — 어댑터의 mappers 에서 변환된다 (R7).
 */

/**
 * @typedef {Object} Mountain
 * @property {string} id            슬러그 (예: 'seoraksan')
 * @property {string} name          한글명
 * @property {string} nameHanja     한자명
 * @property {string} province      광역시·도
 * @property {string} region        권역 (REGIONS)
 * @property {number} elevationM    정상 표고
 * @property {string[]} categories  테마 태그 (CATEGORIES)
 * @property {string} difficulty    대표 난이도 (DIFFICULTY)
 * @property {string} summary       한 줄 소개
 * @property {string} description   본문 소개글
 * @property {string[]} bestSeason  추천 시기 (SEASONS)
 * @property {string} dataSource    출처 표기
 * @property {boolean} verified     실측 검증 여부
 */

/** 권역 — 필터의 1차 축 */
export const REGIONS = Object.freeze(['수도권', '강원', '충청', '전라', '경상', '제주']);

/** 테마 — 필터의 2차 축. 복수 선택 가능 */
export const CATEGORIES = Object.freeze([
  '국립공원',
  '도립공원',
  '군립공원',
  '암릉',
  '조망',
  '계곡',
  '숲길',
  '억새',
  '단풍',
  '설경',
  '일출',
  '야생화',
]);

export const SEASONS = Object.freeze(['봄', '여름', '가을', '겨울']);

/** 고도 구간 — 필터의 3차 축 */
export const ELEVATION_BANDS = Object.freeze([
  { id: 'under500', label: '500m 미만', min: 0, max: 500 },
  { id: '500to1000', label: '500 ~ 1,000m', min: 500, max: 1000 },
  { id: '1000to1500', label: '1,000 ~ 1,500m', min: 1000, max: 1500 },
  { id: 'over1500', label: '1,500m 이상', min: 1500, max: Infinity },
]);

/**
 * 원시 객체를 Mountain으로 정규화한다.
 * 누락 필드를 안전한 기본값으로 채워, 화면이 undefined를 만나지 않게 한다.
 *
 * @param {Partial<Mountain>} raw
 * @returns {Mountain}
 */
export function createMountain(raw = {}) {
  return {
    id: String(raw.id ?? ''),
    name: raw.name ?? '',
    nameHanja: raw.nameHanja ?? '',
    province: raw.province ?? '',
    region: raw.region ?? '',
    elevationM: toNumber(raw.elevationM),
    categories: Array.isArray(raw.categories) ? raw.categories : [],
    difficulty: raw.difficulty ?? '중',
    summary: raw.summary ?? '',
    description: raw.description ?? '',
    bestSeason: Array.isArray(raw.bestSeason) ? raw.bestSeason : [],
    dataSource: raw.dataSource ?? '',
    verified: Boolean(raw.verified),
  };
}

/** 목록 카드에 쓰는 짧은 위치 표기 */
export function locationLabel(mountain) {
  return [mountain.province, mountain.region].filter(Boolean).join(' · ');
}

/** 표시명. 한자명이 있으면 병기한다. */
export function displayName(mountain, { withHanja = false } = {}) {
  if (withHanja && mountain.nameHanja) return `${mountain.name} ${mountain.nameHanja}`;
  return mountain.name;
}

/** 고도가 어느 구간에 속하는지 */
export function elevationBandOf(mountain) {
  return ELEVATION_BANDS.find((b) => mountain.elevationM >= b.min && mountain.elevationM < b.max) ?? null;
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
