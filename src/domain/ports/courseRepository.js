/**
 * domain/ports/courseRepository.js — 코스 조회/저장 인터페이스.
 *
 * 공식 코스와 '내 코스'를 같은 포트가 다룬다.
 * 소유권 판정(누구의 코스를 돌려줄지)은 어댑터의 책임이다 —
 * Supabase 어댑터는 RLS가, 정적 어댑터는 ownerId 비교가 처리한다.
 *
 * @interface CourseRepository
 *
 * @property {(mountainId: string) => Promise<Result<Course[]>>} listByMountain
 *   해당 산의 공식 코스 + 내가 등록한 코스. segments는 포함하지 않는다(목록용).
 *
 * @property {(id: string) => Promise<Result<Course>>} getById
 *   segments를 포함한 전체. 등산길 안내 화면이 쓴다.
 *
 * @property {() => Promise<Result<Course[]>>} listMine
 *   내가 등록한 코스 전체.
 *
 * @property {(course: Course) => Promise<Result<Course>>} save
 *   id가 비어 있으면 생성, 있으면 갱신. 생성된 id를 담아 돌려준다.
 *
 * @property {(id: string) => Promise<Result<null>>} remove
 *   공식 코스 삭제 시도는 err('UNAUTHORIZED', ...)
 */

export const COURSE_REPOSITORY_METHODS = Object.freeze([
  'listByMountain',
  'getById',
  'listMine',
  'save',
  'remove',
]);
