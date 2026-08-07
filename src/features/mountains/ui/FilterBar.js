/**
 * features/mountains/ui/FilterBar.js — 카테고리별 필터 UI.
 *
 * 1차 축(권역)만 화면에 노출하고, 나머지 축은 시트로 접는다.
 * "낮은 정보 밀도" 원칙상 목록 위에 칩을 3줄씩 쌓지 않는다.
 */

import { el, mount } from '../../../core/dom.js';
import { Chip, ChipGroup } from '../../../shared/ui/Chip.js';
import { Button } from '../../../shared/ui/Button.js';
import { openSheet } from '../../../shared/ui/Sheet.js';
import { REGIONS, CATEGORIES, ELEVATION_BANDS } from '../../../domain/entities/mountain.js';
import { DIFFICULTY } from '../../../domain/rules/difficulty.js';
import { toggle, setQuery, activeCount, emptySpec } from '../../../domain/rules/filterSpec.js';

/**
 * @param {{
 *   spec: import('../../../domain/rules/filterSpec.js').FilterSpec,
 *   facets: object,
 *   onChange: (spec) => void
 * }} props
 */
export function FilterBar({ spec, facets, onChange }) {
  const count = activeCount(spec);

  const search = el('input', {
    class: 'field__input mfilter__search',
    type: 'search',
    value: spec.query,
    placeholder: '산 이름 검색',
    'aria-label': '산 이름 검색',
    onInput: (e) => onChange(setQuery(spec, e.target.value)),
  });

  return el('div', { class: 'mfilter stack stack--3' }, [
    el('div', { class: 'row', style: { gap: 'var(--space-2)' } }, [
      search,
      Button({
        label: count ? `필터 ${count}` : '필터',
        variant: count ? 'secondary' : 'ghost',
        iconName: 'filter',
        onClick: () => openFilterSheet({ spec, facets, onChange }),
      }),
    ]),

    ChipGroup(
      REGIONS.map((region) =>
        Chip({
          label: region,
          value: region,
          active: spec.regions.includes(region),
          count: facets.regions?.[region] ?? null,
          onToggle: (value) => onChange(toggle(spec, 'regions', value)),
        }),
      ),
    ),
  ]);
}

/** 2·3차 축은 시트에서 다룬다. 시트 안에서는 즉시 반영하되 화면 이동은 없다. */
function openFilterSheet({ spec, facets, onChange }) {
  let draft = spec;
  const body = el('div', { class: 'stack stack--6' });

  const close = openSheet({ title: '필터', content: body });

  function render() {
    mount(
      body,
      el('div', { class: 'stack stack--6' }, [
        axis('테마', CATEGORIES, 'categories', facets.categories),
        axis('난이도', DIFFICULTY, 'difficulties', facets.difficulties),
        axis(
          '표고',
          ELEVATION_BANDS.map((b) => b.id),
          'bands',
          facets.bands,
          (id) => ELEVATION_BANDS.find((b) => b.id === id)?.label ?? id,
        ),
        el('div', { class: 'row', style: { gap: 'var(--space-3)' } }, [
          Button({
            label: '초기화',
            variant: 'ghost',
            onClick: () => {
              draft = { ...emptySpec(), query: draft.query };
              onChange(draft);
              render();
            },
          }),
          Button({ label: '적용', variant: 'primary', block: true, onClick: () => close() }),
        ]),
      ]),
    );
  }

  function axis(title, values, key, counts, labelOf = (v) => v) {
    return el('section', { class: 'stack stack--3' }, [
      el('h3', { class: 't-label', text: title }),
      el(
        'div',
        { class: 'row row--wrap', style: { gap: 'var(--space-2)' } },
        values.map((value) =>
          Chip({
            label: labelOf(value),
            value,
            active: draft[key].includes(value),
            count: counts?.[value] ?? null,
            onToggle: (v) => {
              draft = toggle(draft, key, v);
              onChange(draft);
              render();
            },
          }),
        ),
      ),
    ]);
  }

  render();
}
