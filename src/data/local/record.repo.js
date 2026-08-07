/**
 * data/local/record.repo.js — RecordRepository localStorage 구현.
 *
 * 기록은 사용자가 만드는 데이터이므로 정적 JSON으로는 표현할 수 없다.
 * Supabase 전환 시 이 파일 대신 data/supabase/record.repo.js가 결선된다.
 *
 * @implements {import('../../domain/ports/recordRepository.js').RecordRepository}
 */

import { ok, err, ErrorCode } from '../../core/result.js';
import { LOGIN_REQUIRED_MESSAGE } from '../../domain/ports/authGateway.js';
import { createHikeRecord, monthKeyOf, sortByDateDesc } from '../../domain/entities/hikeRecord.js';
import { createLocalTable, newId } from './localTable.js';

/**
 * @param {{ getUserId: () => string|null, now: () => string }} deps
 */
export function createLocalRecordRepository({ getUserId, now }) {
  const table = createLocalTable('records');

  function mine() {
    const userId = getUserId();
    if (!userId) return [];
    return table.find((row) => row.userId === userId).map(createHikeRecord);
  }

  return {
    async listAll() {
      return ok(sortByDateDesc(mine()));
    },

    async listByMonth(monthKey) {
      return ok(sortByDateDesc(mine().filter((r) => monthKeyOf(r) === monthKey)));
    },

    async getById(id) {
      const record = mine().find((r) => r.id === id);
      return record ? ok(record) : err(ErrorCode.NOT_FOUND, '해당 기록을 찾을 수 없습니다.');
    },

    async save(record) {
      const userId = getUserId();
      if (!userId) return err(ErrorCode.UNAUTHORIZED, LOGIN_REQUIRED_MESSAGE);

      // 수정이라면 소유자를 먼저 확인한다.
      if (record.id) {
        const existing = table.get(record.id);
        if (existing && existing.userId !== userId) {
          return err(ErrorCode.UNAUTHORIZED, '수정 권한이 없습니다.');
        }
      }

      const row = createHikeRecord({
        ...record,
        id: record.id || newId(),
        userId,
        createdAt: record.createdAt || now(),
      });

      return ok(createHikeRecord(table.upsert(row)));
    },

    async remove(id) {
      const userId = getUserId();
      const row = table.get(id);
      if (!row) return err(ErrorCode.NOT_FOUND, '해당 기록을 찾을 수 없습니다.');
      if (row.userId !== userId) return err(ErrorCode.UNAUTHORIZED, '삭제 권한이 없습니다.');
      table.remove(id);
      return ok(null);
    },
  };
}
