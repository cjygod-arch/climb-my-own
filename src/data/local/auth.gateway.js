/**
 * data/local/auth.gateway.js — AuthGateway 로컬 구현 (개발·데모 전용).
 *
 * 실제 소셜 로그인은 Supabase가 담당한다. 이 어댑터는 Supabase 없이도
 * **로그인 게이트가 실제로 동작하는지 확인할 수 있도록** 계정을 흉내 낸다.
 *
 * 흉내라는 사실을 숨기지 않는다:
 *   - 비밀번호도 검증도 없다. 누구나 어떤 provider로든 들어올 수 있다.
 *   - displayName에 '(개발용)'을 붙여 화면에서 바로 구분된다.
 *   - 이 파일은 config.DATA_SOURCE가 'static'일 때만 결선된다.
 *
 * ★ 익명 세션을 만들지 않는다. 로그인하지 않으면 세션이 없고, 따라서 기록도 못 남긴다.
 *   그것이 다중 사용자 서비스의 정책이다 (domain/ports/authGateway.js 참조).
 *
 * @implements {import('../../domain/ports/authGateway.js').AuthGateway}
 */

import { ok, err, ErrorCode } from '../../core/result.js';
import { isAuthenticatedSession, PROVIDER_IDS } from '../../domain/ports/authGateway.js';
import { createLocalTable, newId } from './localTable.js';

const KEY = 'cmo:session';
/** 익명 로그인을 쓰던 시절의 사용자 id. 데이터 이관에만 쓰고 지운다. */
const LEGACY_ANON_KEY = 'cmo:anon-user-id';

const PROVIDER_LABELS = { kakao: '카카오', google: 'Google', naver: '네이버' };

export function createLocalAuthGateway() {
  let session = null;
  const listeners = new Set();

  function emit() {
    for (const listener of Array.from(listeners)) listener(session);
  }

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function write(next) {
    try {
      if (next) localStorage.setItem(KEY, JSON.stringify(next));
      else localStorage.removeItem(KEY);
    } catch {
      // 저장이 막혀도 이번 세션 동안은 메모리로 동작한다.
    }
  }

  /**
   * 익명으로 쌓아둔 기록을 새 계정으로 옮긴다.
   *
   * 이전 버전에서는 로그인 없이도 기록할 수 있었다. 정책이 바뀌었다고 해서
   * 사용자가 이미 남긴 기록이 조용히 사라지면 안 된다. 처음 로그인할 때 한 번만 옮긴다.
   */
  function adoptLegacyData(userId) {
    let legacyId = null;
    try {
      legacyId = localStorage.getItem(LEGACY_ANON_KEY);
    } catch {
      return 0;
    }
    if (!legacyId || legacyId === userId) return 0;

    let moved = 0;
    for (const name of ['records', 'courses', 'earned_badges']) {
      const table = createLocalTable(name);
      for (const row of table.list()) {
        if (row.userId !== legacyId && row.ownerId !== legacyId) continue;
        const next = { ...row };
        if (next.userId === legacyId) next.userId = userId;
        if (next.ownerId === legacyId) next.ownerId = userId;
        // 획득 배지의 id는 `${userId}:${code}` 형식이라 함께 바꿔야 한다.
        if (name === 'earned_badges' && typeof next.id === 'string') {
          next.id = next.id.replace(`${legacyId}:`, `${userId}:`);
          table.remove(row.id);
        }
        table.upsert(next);
        moved += 1;
      }
    }

    try {
      localStorage.removeItem(LEGACY_ANON_KEY);
    } catch { /* 다음 로그인에서 다시 시도된다 */ }

    if (moved) console.info(`[auth] 이전에 남긴 기록 ${moved}건을 계정으로 옮겼습니다.`);
    return moved;
  }

  return {
    async ensureSession() {
      // 저장된 세션만 복구한다. 없으면 없는 대로 둔다 — 익명 세션을 만들지 않는다.
      const stored = read();
      session = isAuthenticatedSession(stored) ? stored : null;
      if (!session && stored) write(null); // 옛 익명 세션은 버린다
      emit();
      return ok(session);
    },

    getSession: () => session,

    isAuthenticated: () => isAuthenticatedSession(session),

    async signIn(provider) {
      if (!PROVIDER_IDS.includes(provider)) {
        return err(ErrorCode.VALIDATION, `지원하지 않는 로그인 수단입니다: ${provider}`);
      }

      // 같은 provider로 다시 들어오면 같은 계정을 쓴다. 기기 안에서는 이것으로 충분하다.
      const previous = read();
      const userId = previous?.provider === provider && previous?.userId
        ? previous.userId
        : newId();

      session = {
        userId,
        isAnonymous: false,
        provider,
        displayName: `${PROVIDER_LABELS[provider]} 사용자 (개발용)`,
      };

      write(session);
      adoptLegacyData(userId);
      emit();
      return ok(session);
    },

    async signOut() {
      session = null;
      write(null);
      emit();
      return ok(null);
    },

    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
