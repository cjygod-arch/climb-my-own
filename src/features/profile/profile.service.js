/**
 * features/profile/profile.service.js — 계정과 전체 통계.
 *
 * 로그인 방식의 차이(카카오·구글은 Supabase 기본 제공, 네이버는 브릿지 필요)는
 * 전부 authGateway 어댑터 안에 갇힌다. 이 서비스도 화면도 provider 문자열만 안다.
 */

import { ok } from '../../core/result.js';
import { publish } from '../../core/eventBus.js';
import { Topic } from '../../domain/events.js';
import { summarize } from '../../domain/rules/monthlyStats.js';

export function createProfileService({ auth, recordRepo, badgeRepo }) {
  return {
    getSession: () => auth.getSession(),

    /** 기록을 남길 수 있는 상태인가. 화면의 로그인 게이트가 이 값을 본다. */
    isAuthenticated: () => auth.isAuthenticated(),

    onSessionChange: (listener) => auth.onChange(listener),

    async getSummary() {
      const [recordsResult, earnedResult] = await Promise.all([
        recordRepo.listAll(),
        badgeRepo.listEarned(),
      ]);

      const firstError = [recordsResult, earnedResult].find((r) => !r.ok);
      if (firstError) return firstError;

      return ok({
        total: summarize(recordsResult.value),
        badgeCount: earnedResult.value.length,
      });
    },

    async signIn(provider) {
      const result = await auth.signIn(provider);
      if (result.ok) publish(Topic.SESSION_CHANGED, auth.getSession());
      return result;
    },

    async signOut() {
      const result = await auth.signOut();
      if (result.ok) publish(Topic.SESSION_CHANGED, null);
      return result;
    },
  };
}
