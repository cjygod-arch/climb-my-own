/**
 * domain/events.js — 도메인 이벤트 이름.
 *
 * 왜 core가 아니라 domain에 있는가:
 * core/는 도메인 용어를 몰라야 한다 (ARCHITECTURE.md R3).
 * eventBus는 '토픽 문자열을 구독하고 발행하는 장치'일 뿐이고,
 * 어떤 사건이 존재하는지는 도메인의 지식이다.
 *
 * 새 이벤트는 반드시 여기에 등록한다 — 문자열 오타를 컴파일 없이 막는 유일한 방법이다.
 */

export const Topic = Object.freeze({
  /** 산행 기록이 저장됨. payload: HikeRecord */
  RECORD_SAVED: 'record:saved',
  /** 산행 기록이 삭제됨. payload: { id } */
  RECORD_DELETED: 'record:deleted',
  /** 내 코스가 저장됨. payload: Course */
  COURSE_SAVED: 'course:saved',
  /** 배지를 새로 획득함. payload: Badge[] */
  BADGES_EARNED: 'badges:earned',
  /** 세션이 바뀜. payload: Session|null */
  SESSION_CHANGED: 'session:changed',
  /** 산행 안내가 시작됨. payload: HikeSession */
  TRACKING_STARTED: 'tracking:started',
  /** 산행 안내가 끝남. payload: HikeSession */
  TRACKING_STOPPED: 'tracking:stopped',
});
