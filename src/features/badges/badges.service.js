/**
 * features/badges/badges.service.js — 배지 유스케이스.
 *
 * 판정 자체는 domain/rules/badgeRules.js가 한다. 이 서비스는
 * 판정에 필요한 재료(배지 마스터 · 기록 · 산)를 모으고, 결과를 저장하는 조율만 한다.
 */

import { ok } from '../../core/result.js';
import { toBadgeView } from '../../domain/entities/badge.js';
import { evaluateAll, findNewlyEarned } from '../../domain/rules/badgeRules.js';
import { isHike } from '../../domain/entities/activity.js';

export function createBadgesService({ badgeRepo, recordRepo, mountainRepo }) {
  /** 판정에 필요한 세 가지를 한 번에 가져온다. */
  async function gather() {
    const [badgesResult, recordsResult, mountainsResult, earnedResult] = await Promise.all([
      badgeRepo.listAll(),
      recordRepo.listAll(),
      mountainRepo.listAll(),
      badgeRepo.listEarned(),
    ]);

    const firstError = [badgesResult, recordsResult, mountainsResult, earnedResult].find((r) => !r.ok);
    if (firstError) return firstError;

    return ok({
      badges: badgesResult.value,
      // 배지는 산행에만 준다. '명산 5'나 '누적 100km'는 등산 맥락의 이름이라
      // 동네 걷기로 채워지면 배지가 뜻을 잃는다.
      records: recordsResult.value.filter(isHike),
      mountains: mountainsResult.value,
      earned: earnedResult.value,
    });
  }

  return {
    /** 배지 화면용 뷰 목록. 획득 → 진행률 높은 순으로 정렬한다. */
    async overview() {
      const gathered = await gather();
      if (!gathered.ok) return gathered;

      const { badges, records, mountains, earned } = gathered.value;
      const progress = evaluateAll(badges, records, mountains);
      const earnedByCode = new Map(earned.map((e) => [e.badgeCode, e]));

      const views = badges
        .map((badge) => toBadgeView(badge, progress.get(badge.code), earnedByCode.get(badge.code) ?? null))
        .sort((a, b) => {
          if (a.earned !== b.earned) return a.earned ? -1 : 1;
          return b.ratio - a.ratio;
        });

      return ok({
        badges: views,
        earnedCount: views.filter((v) => v.earned).length,
        totalCount: views.length,
      });
    },

    /**
     * 기록 저장 직후 호출된다. 새로 성립한 배지를 저장하고 그 목록을 돌려준다.
     * award()가 멱등이므로 여러 번 불려도 최초 획득 시각이 보존된다.
     */
    async evaluateAfter(sourceRecordId = null) {
      const gathered = await gather();
      if (!gathered.ok) return gathered;

      const { badges, records, mountains, earned } = gathered.value;
      const earnedCodes = new Set(earned.map((e) => e.badgeCode));
      const newCodes = findNewlyEarned(badges, records, mountains, earnedCodes);

      if (newCodes.length === 0) return ok([]);

      const awarded = await badgeRepo.award(newCodes, sourceRecordId);
      if (!awarded.ok) return awarded;

      const byCode = new Map(badges.map((b) => [b.code, b]));
      return ok(newCodes.map((code) => byCode.get(code)).filter(Boolean));
    },
  };
}
