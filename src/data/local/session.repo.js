/**
 * data/local/session.repo.js — SessionRepository localStorage 구현.
 *
 * 세션은 기기 로컬 상태다. 산 위에서는 네트워크가 자주 끊기므로
 * 통신이 되어야만 진행 상황이 남는 구조는 위험하다.
 * 끝난 세션은 HikeRecord로 변환되어 원격에 저장된다.
 *
 * 좌표가 들어올 때마다 저장되므로 가볍게 유지한다 — 단일 키에 통째로 쓴다.
 *
 * @implements {import('../../domain/ports/sessionRepository.js').SessionRepository}
 */

import { ok, err, ErrorCode } from '../../core/result.js';
import { createHikeSession, isActive } from '../../domain/entities/hikeSession.js';

const KEY = 'cmo:active-session';

/**
 * @param {{ getUserId: () => string|null }} deps
 */
export function createLocalSessionRepository({ getUserId }) {
  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // 다른 사용자의 세션이 남아 있으면 무시한다.
      if (parsed.userId && parsed.userId !== getUserId()) return null;
      return createHikeSession(parsed);
    } catch {
      return null;
    }
  }

  return {
    async getActive() {
      const session = read();
      return ok(session && isActive(session) ? session : null);
    },

    async save(session) {
      try {
        localStorage.setItem(KEY, JSON.stringify({ ...session, userId: getUserId() }));
        return ok(session);
      } catch (cause) {
        // 저장 실패는 조용히 넘기면 안 된다. 새로고침 시 진행 상황이 사라진다.
        return err(ErrorCode.UNEXPECTED, '산행 상태를 저장하지 못했습니다. 저장 공간을 확인해 주세요.', cause);
      }
    },

    async clearActive() {
      try {
        localStorage.removeItem(KEY);
      } catch {
        // 지우기 실패는 다음 시작 때 덮어써지므로 치명적이지 않다.
      }
      return ok(null);
    },
  };
}
