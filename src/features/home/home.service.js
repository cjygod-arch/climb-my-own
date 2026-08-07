/**
 * features/home/home.service.js — 대시보드 조합.
 *
 * 홈은 자기 데이터를 갖지 않는다. 다른 기능의 재료를 모아 한 화면 분량으로 요약할 뿐이다.
 * 그래서 포트를 직접 쓰되, 계산은 전부 domain/rules에 위임한다.
 */

import { ok } from '../../core/result.js';
import { statForMonth, summarize } from '../../domain/rules/monthlyStats.js';
import { sortByDateDesc } from '../../domain/entities/hikeRecord.js';
import { displayTitle, isHike, isWalk } from '../../domain/entities/activity.js';

const RECENT_LIMIT = 3;

export function createHomeService({ recordRepo, mountainRepo, badgeRepo, config }) {
  return {
    async getDashboard() {
      const [recordsResult, mountainsResult, earnedResult] = await Promise.all([
        recordRepo.listAll(),
        mountainRepo.listAll(),
        badgeRepo.listEarned(),
      ]);

      const firstError = [recordsResult, mountainsResult, earnedResult].find((r) => !r.ok);
      if (firstError) return firstError;

      const records = recordsResult.value;
      const mountains = mountainsResult.value;
      const nameById = new Map(mountains.map((m) => [m.id, m.name]));

      // 100대 명산 진행률은 '등록된 명산 중 실제로 오른 곳'만 센다.
      // 걷기에는 산이 없으므로 자연히 빠진다.
      const validIds = new Set(mountains.map((m) => m.id));
      const climbed = new Set(
        records.filter(isHike).map((r) => r.mountainId).filter((id) => validIds.has(id)),
      );

      const recent = sortByDateDesc(records)
        .slice(0, RECENT_LIMIT)
        .map((r) => ({
          ...r,
          mountainName: displayTitle(r, r.mountainId ? (nameById.get(r.mountainId) ?? '알 수 없는 산') : ''),
          isWalk: isWalk(r),
        }));

      return ok({
        thisMonth: statForMonth(records, config.thisMonth()),
        total: summarize(records),
        recent,
        summitProgress: { climbed: climbed.size, total: mountains.length },
        // 이번 달 활동을 종류별로 나눠 보여줄 수 있게 한다.
        walkCount: records.filter(isWalk).length,
        badgeCount: earnedResult.value.length,
      });
    },
  };
}
