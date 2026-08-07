/**
 * core/eventBus.js — 기능 간 느슨한 알림.
 *
 * ARCHITECTURE.md R5: features/a 가 features/b 를 직접 import 하지 않는다.
 * 서로를 알아야 할 일이 생기면 여기를 경유한다.
 * (예: 기록이 저장됨 → 배지 기능이 재평가)
 */

const channels = new Map();

/**
 * @param {string} topic
 * @param {(payload: any) => void} handler
 * @returns {() => void} 구독 해제
 */
export function subscribe(topic, handler) {
  if (!channels.has(topic)) channels.set(topic, new Set());
  const set = channels.get(topic);
  set.add(handler);
  return () => {
    set.delete(handler);
    if (set.size === 0) channels.delete(topic);
  };
}

/**
 * 발행자는 구독자가 누구인지, 있는지조차 모른다.
 * 한 구독자가 실패해도 나머지는 계속 받는다.
 */
export function publish(topic, payload) {
  const set = channels.get(topic);
  if (!set) return;
  for (const handler of Array.from(set)) {
    try {
      handler(payload);
    } catch (cause) {
      console.error(`[eventBus] "${topic}" 구독자 실행 실패`, cause);
    }
  }
}

/** 테스트·핫리로드 정리용 */
export function clearAll() {
  channels.clear();
}

// 토픽 이름 목록은 여기 두지 않는다. 어떤 사건이 존재하는지는 도메인의 지식이므로
// src/domain/events.js 에 있다 (ARCHITECTURE.md R3: core는 도메인 용어를 모른다).
