/**
 * features/mountains/mountains.service.js — 명산 유스케이스.
 *
 * 포트를 호출하고 도메인 규칙을 적용한다. DOM을 만들지 않는다.
 * 저장소 구현이 무엇인지 모른다 — 생성자로 주입받은 포트만 안다.
 */

import { applyFilter, countsFor, SORT_KEYS } from '../../domain/rules/filterSpec.js';
import { REGIONS, CATEGORIES, ELEVATION_BANDS } from '../../domain/entities/mountain.js';
import { DIFFICULTY } from '../../domain/rules/difficulty.js';

export function createMountainsService({ mountainRepo }) {
  return {
    listAll: () => mountainRepo.listAll(),

    getById: (id) => mountainRepo.getById(id),

    /**
     * 필터 적용은 메모리에서 한다. 100건 규모에서는 서버 왕복보다 빠르고,
     * 칩을 누르는 즉시 반응해야 필터 UI가 쓸 만해진다.
     */
    filter: (mountains, spec, sortKey = SORT_KEYS.NAME) => applyFilter(mountains, spec, sortKey),

    /** 각 필터 값의 해당 건수. 칩에 숫자를 붙이고 0건 선택지를 비활성화하는 데 쓴다. */
    facets(mountains, spec) {
      return {
        regions: countsFor(mountains, spec, 'regions', REGIONS),
        categories: countsFor(mountains, spec, 'categories', CATEGORIES),
        difficulties: countsFor(mountains, spec, 'difficulties', DIFFICULTY),
        bands: countsFor(mountains, spec, 'bands', ELEVATION_BANDS.map((b) => b.id)),
      };
    },
  };
}
