/**
 * data/supabase/mountain.repo.js — MountainRepository Supabase 구현.
 *
 * data/static/mountain.repo.js 와 정확히 같은 계약을 만족한다.
 * container.js의 스위치 한 줄로 둘을 맞바꿔도 화면은 아무것도 모른다.
 *
 * @implements {import('../../domain/ports/mountainRepository.js').MountainRepository}
 */

import { ok, err, ErrorCode } from '../../core/result.js';
import { toMountain } from './mappers/rowMappers.js';

const COLUMNS =
  'id, name, name_hanja, province, region, elevation_m, categories, difficulty, summary, description, best_season, data_source, verified';

export function createSupabaseMountainRepository(client) {
  // 100대 명산은 세션 중 바뀌지 않는다. 한 번 읽으면 캐시한다.
  let cache = null;

  return {
    async listAll() {
      if (cache) return ok(cache);

      const { data, error } = await client.from('mountains').select(COLUMNS).order('name');
      if (error) return toErr(error);

      cache = data.map(toMountain);
      return ok(cache);
    },

    async getById(id) {
      const { data, error } = await client
        .from('mountains')
        .select(COLUMNS)
        .eq('id', id)
        .maybeSingle();

      if (error) return toErr(error);
      if (!data) return err(ErrorCode.NOT_FOUND, '해당 산을 찾을 수 없습니다.');
      return ok(toMountain(data));
    },

    async listByIds(ids) {
      if (!ids.length) return ok([]);

      const { data, error } = await client.from('mountains').select(COLUMNS).in('id', ids);
      if (error) return toErr(error);
      return ok(data.map(toMountain));
    },
  };
}

function toErr(error) {
  return err(ErrorCode.NETWORK, `산 정보를 불러오지 못했습니다. (${error.message})`, error);
}
