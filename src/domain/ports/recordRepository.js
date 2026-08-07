/**
 * domain/ports/recordRepository.js — 산행 기록 인터페이스.
 *
 * 월별 집계는 여기서 하지 않는다. 저장소는 '가져오기'만 하고,
 * 집계는 domain/rules/monthlyStats.js가 한다 (관심사 분리).
 * 기록이 수천 건을 넘어가면 그때 listByMonth를 서버 집계로 바꾼다 —
 * 그래도 UI는 같은 MonthlyStat 형태를 받으므로 영향이 없다.
 *
 * @interface RecordRepository
 *
 * @property {() => Promise<Result<HikeRecord[]>>} listAll
 *   현재 사용자의 전체 기록. 배지 판정이 전체를 필요로 한다.
 *
 * @property {(monthKey: string) => Promise<Result<HikeRecord[]>>} listByMonth
 *   'YYYY-MM'
 *
 * @property {(id: string) => Promise<Result<HikeRecord>>} getById
 *
 * @property {(record: HikeRecord) => Promise<Result<HikeRecord>>} save
 *   id가 비어 있으면 생성. userId는 어댑터가 세션에서 채운다 —
 *   UI가 사용자 id를 알 필요가 없게 하기 위함이다.
 *
 * @property {(id: string) => Promise<Result<null>>} remove
 */

export const RECORD_REPOSITORY_METHODS = Object.freeze([
  'listAll',
  'listByMonth',
  'getById',
  'save',
  'remove',
]);
