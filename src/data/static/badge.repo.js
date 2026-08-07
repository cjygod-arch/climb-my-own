/**
 * data/static/badge.repo.js — BadgeRepository 정적 JSON + 로컬 저장 구현.
 *
 * 배지 마스터는 읽기 전용 JSON, 획득 기록은 localStorage.
 * award()는 멱등이다 — 이미 획득한 코드를 다시 넣어도 earnedAt이 바뀌지 않는다.
 * (기록을 수정할 때마다 판정이 다시 돌기 때문에 이 성질이 필요하다.)
 *
 * @implements {import('../../domain/ports/badgeRepository.js').BadgeRepository}
 */

import { ok, err, ErrorCode } from '../../core/result.js';
import { LOGIN_REQUIRED_MESSAGE } from '../../domain/ports/authGateway.js';
import { createBadge, createEarnedBadge } from '../../domain/entities/badge.js';
import { loadItems } from './jsonSource.js';
import { createLocalTable } from '../local/localTable.js';

const FILE = 'badges.json';

/**
 * @param {{ getUserId: () => string|null, now: () => string }} deps
 *   now는 주입받는다 — 도메인 밖에서도 시간 의존을 한 곳에 모아두기 위함이다.
 */
export function createStaticBadgeRepository({ getUserId, now }) {
  const table = createLocalTable('earned_badges');

  /** 저장 행의 id는 `${userId}:${badgeCode}` — 사용자별 중복 획득을 구조적으로 막는다. */
  const rowId = (userId, code) => `${userId}:${code}`;

  return {
    async listAll() {
      const result = await loadItems(FILE);
      if (!result.ok) return result;
      return ok(result.value.map(createBadge));
    },

    async listEarned() {
      const userId = getUserId();
      if (!userId) return ok([]);
      return ok(
        table
          .find((row) => row.userId === userId)
          .map((row) => createEarnedBadge(row)),
      );
    },

    async award(codes, sourceRecordId = null) {
      const userId = getUserId();
      if (!userId) return err(ErrorCode.UNAUTHORIZED, LOGIN_REQUIRED_MESSAGE);
      if (!codes.length) return ok([]);

      const earnedAt = now();
      const rows = codes.map((code) => ({
        id: rowId(userId, code),
        userId,
        badgeCode: code,
        earnedAt,
        sourceRecordId,
      }));

      // 이미 있는 것은 건너뛴다 — 최초 획득 시각을 보존하기 위함이다.
      const added = table.insertMissing(rows);
      return ok(added.map((row) => createEarnedBadge(row)));
    },
  };
}
