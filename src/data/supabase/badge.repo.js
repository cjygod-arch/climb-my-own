/**
 * data/supabase/badge.repo.js — BadgeRepository Supabase 구현.
 *
 * award()의 멱등성은 코드가 아니라 스키마가 보장한다:
 * user_badges의 기본키가 (user_id, badge_code)라 중복 삽입이 불가능하고,
 * ignoreDuplicates로 조용히 넘긴다. 최초 획득 시각이 보존된다.
 *
 * @implements {import('../../domain/ports/badgeRepository.js').BadgeRepository}
 */

import { ok, err, ErrorCode } from '../../core/result.js';
import { LOGIN_REQUIRED_MESSAGE } from '../../domain/ports/authGateway.js';
import { toBadge, toEarnedBadge } from './mappers/rowMappers.js';

/**
 * @param {object} client
 * @param {{ getUserId: () => string|null }} deps
 */
export function createSupabaseBadgeRepository(client, { getUserId }) {
  let masterCache = null;

  return {
    async listAll() {
      if (masterCache) return ok(masterCache);

      const { data, error } = await client
        .from('badges')
        .select('code, title, description, criteria, tier')
        .order('sort_order');

      if (error) return toErr(error, '배지 목록');

      masterCache = data.map(toBadge);
      return ok(masterCache);
    },

    async listEarned() {
      const userId = getUserId();
      if (!userId) return ok([]);

      const { data, error } = await client
        .from('user_badges')
        .select('badge_code, earned_at, source_record_id')
        .order('earned_at', { ascending: false });

      if (error) return toErr(error, '획득 배지');
      return ok(data.map(toEarnedBadge));
    },

    async award(codes, sourceRecordId = null) {
      const userId = getUserId();
      if (!userId) return err(ErrorCode.UNAUTHORIZED, LOGIN_REQUIRED_MESSAGE);
      if (!codes.length) return ok([]);

      const rows = codes.map((code) => ({
        user_id: userId,
        badge_code: code,
        source_record_id: sourceRecordId,
      }));

      const { data, error } = await client
        .from('user_badges')
        // 이미 획득한 배지는 건너뛴다 — 최초 획득 시각을 덮어쓰지 않기 위함이다.
        .upsert(rows, { onConflict: 'user_id,badge_code', ignoreDuplicates: true })
        .select('badge_code, earned_at, source_record_id');

      if (error) return toErr(error, '배지 부여');
      return ok((data ?? []).map(toEarnedBadge));
    },
  };
}

function toErr(error, what) {
  return err(ErrorCode.NETWORK, `${what} 처리에 실패했습니다. (${error.message})`, error);
}
