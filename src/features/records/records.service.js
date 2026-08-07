/**
 * features/records/records.service.js — 산행 기록 유스케이스.
 *
 * 저장 후 배지 재평가를 촉발하는 지점이 여기다.
 * badges 서비스를 직접 import 하지 않고 주입받는다 —
 * features 간 직접 의존을 만들지 않기 위함이다 (ARCHITECTURE.md R5).
 *
 * 표시용 파생 필드(mountainName 등)는 엔티티에 넣지 않고 뷰 모델로 따로 만든다.
 * 엔티티가 화면 사정을 알기 시작하면 도메인이 오염된다.
 */

import { ok, err, ErrorCode } from '../../core/result.js';
import { publish } from '../../core/eventBus.js';
import { Topic } from '../../domain/events.js';
import { createHikeRecord, validateHikeRecord } from '../../domain/entities/hikeRecord.js';
import { groupByMonth, statForMonth, summarize } from '../../domain/rules/monthlyStats.js';
import { displayTitle, isWalk } from '../../domain/entities/activity.js';

export function createRecordsService({ recordRepo, mountainRepo, courseRepo, badges, config }) {
  /**
   * 기록에 표시용 이름을 붙인 뷰 모델을 만든다.
   * 산행은 산 이름이, 걷기는 사용자가 붙인 제목이 주인공이다.
   */
  async function withMountainNames(records) {
    const ids = Array.from(new Set(records.map((r) => r.mountainId).filter(Boolean)));
    const result = await mountainRepo.listByIds(ids);
    const nameById = new Map((result.ok ? result.value : []).map((m) => [m.id, m.name]));

    return records.map((r) => {
      const mountainName = r.mountainId ? (nameById.get(r.mountainId) ?? '알 수 없는 산') : '';
      return { ...r, mountainName: displayTitle(r, mountainName), isWalk: isWalk(r) };
    });
  }

  return {
    /** 월별 화면 전체가 필요로 하는 것을 한 번에 만든다. */
    async getMonthlyView(monthKey) {
      const result = await recordRepo.listAll();
      if (!result.ok) return result;

      const enriched = await withMountainNames(result.value);

      return ok({
        month: statForMonth(enriched, monthKey),
        months: groupByMonth(enriched),
        total: summarize(enriched),
      });
    },

    /** 상세 화면: 기록 + 산 + (있다면) 코스 */
    async getDetail(id) {
      const recordResult = await recordRepo.getById(id);
      if (!recordResult.ok) return recordResult;

      const record = recordResult.value;
      const [mountainResult, courseResult] = await Promise.all([
        mountainRepo.getById(record.mountainId),
        record.courseId ? courseRepo.getById(record.courseId) : Promise.resolve({ ok: false }),
      ]);

      return ok({
        record,
        mountain: mountainResult.ok ? mountainResult.value : null,
        course: courseResult.ok ? courseResult.value : null,
      });
    },

    /**
     * 저장 → 배지 재평가 → 알림.
     * 배지 평가가 실패해도 기록 저장은 되돌리지 않는다 —
     * 사용자가 입력한 사실이 부가 기능 때문에 사라지면 안 된다.
     */
    async save(draft) {
      const record = createHikeRecord(draft);
      const errors = validateHikeRecord(record, { today: config.today() });
      if (errors.length) return err(ErrorCode.VALIDATION, errors[0]);

      const saved = await recordRepo.save(record);
      if (!saved.ok) return saved;

      publish(Topic.RECORD_SAVED, saved.value);

      let earnedBadges = [];
      try {
        const evaluation = await badges.evaluateAfter(saved.value.id);
        if (evaluation.ok) earnedBadges = evaluation.value;
      } catch (cause) {
        console.error('[records] 배지 재평가 실패', cause);
      }

      if (earnedBadges.length) publish(Topic.BADGES_EARNED, earnedBadges);

      return ok({ record: saved.value, earnedBadges });
    },

    async remove(id) {
      const result = await recordRepo.remove(id);
      if (result.ok) publish(Topic.RECORD_DELETED, { id });
      return result;
    },
  };
}
