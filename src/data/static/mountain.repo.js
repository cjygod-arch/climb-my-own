/**
 * data/static/mountain.repo.js — MountainRepository 정적 JSON 구현.
 *
 * Supabase 프로젝트 없이 UI 전체를 개발·데모하기 위한 어댑터다.
 * 동시에 "저장 방식을 바꿔도 UI는 그대로"라는 요구사항의 살아있는 증거이기도 하다 —
 * 어댑터가 둘 이상 존재해야 추상화가 실제로 동작함이 검증된다.
 *
 * @implements {import('../../domain/ports/mountainRepository.js').MountainRepository}
 */

import { ok, err, ErrorCode } from '../../core/result.js';
import { createMountain } from '../../domain/entities/mountain.js';
import { loadItems } from './jsonSource.js';

const FILE = 'mountains.json';

export function createStaticMountainRepository() {
  async function all() {
    const result = await loadItems(FILE);
    if (!result.ok) return result;
    return ok(result.value.map(createMountain));
  }

  return {
    listAll: all,

    async getById(id) {
      const result = await all();
      if (!result.ok) return result;
      const found = result.value.find((m) => m.id === id);
      return found ? ok(found) : err(ErrorCode.NOT_FOUND, '해당 산을 찾을 수 없습니다.');
    },

    async listByIds(ids) {
      const result = await all();
      if (!result.ok) return result;
      const wanted = new Set(ids);
      return ok(result.value.filter((m) => wanted.has(m.id)));
    },
  };
}
