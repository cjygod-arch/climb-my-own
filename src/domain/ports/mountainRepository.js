/**
 * domain/ports/mountainRepository.js — 산 조회 인터페이스.
 *
 * 이 파일에 구현은 없다. 계약만 있다.
 * 구현은 data/static/, data/supabase/ 등이 하고, 결선은 app/container.js가 한다.
 *
 * 모든 메서드는 예외를 던지지 않고 Result(core/result.js)를 반환한다.
 * 그래야 UI가 try/catch 없이 실패를 화면 상태로 다룰 수 있다.
 *
 * @interface MountainRepository
 *
 * @property {() => Promise<Result<Mountain[]>>} listAll
 *   100대 명산 전체. 필터링은 도메인(filterSpec)이 메모리에서 한다 —
 *   100건 규모에서는 서버 왕복보다 빠르고, 필터 UI가 즉각 반응한다.
 *
 * @property {(id: string) => Promise<Result<Mountain>>} getById
 *   없으면 err('NOT_FOUND', ...)
 *
 * @property {(ids: string[]) => Promise<Result<Mountain[]>>} listByIds
 *   기록 목록에 산 이름을 붙일 때 쓴다. 없는 id는 결과에서 조용히 빠진다.
 */

/** 포트 계약을 실제로 만족하는지 확인한다. container에서 결선 직후 호출한다. */
export const MOUNTAIN_REPOSITORY_METHODS = Object.freeze(['listAll', 'getById', 'listByIds']);
