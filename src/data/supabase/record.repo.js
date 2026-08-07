/**
 * data/supabase/record.repo.js — RecordRepository Supabase 구현.
 *
 * user_id를 클라이언트가 보내긴 하지만, RLS의 with check가 auth.uid()와 대조하므로
 * 위조해도 통과하지 못한다. 컬럼 기본값도 auth.uid()다 — 이중 방어.
 *
 * @implements {import('../../domain/ports/recordRepository.js').RecordRepository}
 */

import { ok, err, ErrorCode } from '../../core/result.js';
import { LOGIN_REQUIRED_MESSAGE } from '../../domain/ports/authGateway.js';
import { toRecord, recordToRow } from './mappers/rowMappers.js';

const COLUMNS =
  'id, user_id, mountain_id, course_id, hiked_on, distance_km, ascent_m, duration_min, memo, '
  + 'activity_type, title, route, started_at, ended_at, created_at';

/**
 * @param {object} client
 * @param {{ getUserId: () => string|null }} deps
 */
export function createSupabaseRecordRepository(client, { getUserId }) {
  /** 최신순은 DB가 정렬한다 — hike_records_user_date_idx가 그대로 쓰인다. */
  function baseQuery() {
    return client.from('hike_records').select(COLUMNS).order('hiked_on', { ascending: false }).order('created_at', { ascending: false });
  }

  return {
    async listAll() {
      const { data, error } = await baseQuery();
      if (error) return toErr(error, '기록 목록');
      return ok(data.map(toRecord));
    },

    async listByMonth(monthKey) {
      const range = monthRange(monthKey);
      if (!range) return err(ErrorCode.VALIDATION, '잘못된 월 형식입니다.');

      const { data, error } = await baseQuery()
        .gte('hiked_on', range.from)
        .lt('hiked_on', range.toExclusive);

      if (error) return toErr(error, '월별 기록');
      return ok(data.map(toRecord));
    },

    async getById(id) {
      const { data, error } = await client
        .from('hike_records')
        .select(COLUMNS)
        .eq('id', id)
        .maybeSingle();

      if (error) return toErr(error, '기록');
      if (!data) return err(ErrorCode.NOT_FOUND, '해당 기록을 찾을 수 없습니다.');
      return ok(toRecord(data));
    },

    async save(record) {
      const userId = getUserId();
      if (!userId) return err(ErrorCode.UNAUTHORIZED, LOGIN_REQUIRED_MESSAGE);

      const { data, error } = await client
        .from('hike_records')
        .upsert(recordToRow(record, userId), { onConflict: 'id' })
        .select(COLUMNS)
        .single();

      if (error) return toErr(error, '기록 저장');
      return ok(toRecord(data));
    },

    async remove(id) {
      const { data, error } = await client.from('hike_records').delete().eq('id', id).select('id');
      if (error) return toErr(error, '기록 삭제');
      if (!data?.length) return err(ErrorCode.NOT_FOUND, '해당 기록을 찾을 수 없습니다.');
      return ok(null);
    },
  };
}

/**
 * 'YYYY-MM' → 그 달의 시작일과 다음 달 시작일.
 * between 대신 [from, toExclusive)를 쓰면 말일 계산(28/29/30/31)을 안 해도 된다.
 */
function monthRange(monthKey) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(monthKey ?? ''));
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const p2 = (n) => String(n).padStart(2, '0');

  return {
    from: `${year}-${p2(month)}-01`,
    toExclusive: `${nextYear}-${p2(nextMonth)}-01`,
  };
}

function toErr(error, what) {
  return err(ErrorCode.NETWORK, `${what} 처리에 실패했습니다. (${error.message})`, error);
}
