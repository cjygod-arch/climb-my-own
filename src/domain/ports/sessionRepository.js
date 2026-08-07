/**
 * domain/ports/sessionRepository.js — 진행 중인 산행 세션 저장 인터페이스.
 *
 * 세션은 '이 기기에서 지금 걷고 있는 상태'다. 산행은 몇 시간씩 걸리고
 * 그 사이 화면이 꺼지거나 새로고침될 수 있으므로 반드시 저장해야 한다.
 *
 * 원격에 두지 않는 이유: 세션은 기기 로컬 상태이고, 산 위에서는 네트워크가 끊기는 일이 잦다.
 * 통신이 되어야만 진행 상황이 남는다면 그게 더 위험하다.
 * 끝난 세션은 HikeRecord로 변환되어 recordRepository를 통해 원격에 저장된다.
 *
 * @interface SessionRepository
 *
 * @property {() => Promise<Result<HikeSession|null>>} getActive
 *   진행 중인 세션. 없으면 null.
 *
 * @property {(session: HikeSession) => Promise<Result<HikeSession>>} save
 *   생성과 갱신 모두. 좌표가 들어올 때마다 호출되므로 가벼워야 한다.
 *
 * @property {() => Promise<Result<null>>} clearActive
 *   세션을 끝내고 지운다.
 */

export const SESSION_REPOSITORY_METHODS = Object.freeze(['getActive', 'save', 'clearActive']);
