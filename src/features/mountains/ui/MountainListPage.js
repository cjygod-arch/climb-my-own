/**
 * features/mountains/ui/MountainListPage.js — 100대 명산 목록.
 *
 * 이 파일은 저장소를 모른다. ctx.services.mountains 만 쓴다 (ARCHITECTURE.md R1).
 */

import { el, mount, onDestroy } from '../../../core/dom.js';
import { renderAsync } from '../../../core/asyncState.js';
import { int } from '../../../core/format.js';
import { SkeletonList } from '../../../shared/ui/Skeleton.js';
import { EmptyState, ErrorState } from '../../../shared/ui/EmptyState.js';
import { SegmentedControl } from '../../../shared/ui/SegmentedControl.js';
import { SORT_KEYS, isEmptySpec } from '../../../domain/rules/filterSpec.js';
import { mountainsStore, loadMountains, setSpec, setSortKey, resetSpec } from '../mountains.store.js';
import { MountainCard } from './MountainCard.js';
import { FilterBar } from './FilterBar.js';

const SORT_ITEMS = [
  { value: SORT_KEYS.NAME, label: '이름순' },
  { value: SORT_KEYS.ELEVATION_DESC, label: '높은순' },
  { value: SORT_KEYS.DIFFICULTY, label: '난이도' },
];

export function MountainListPage({ services, navigate }) {
  const container = el('div', { class: 'page' });

  function render() {
    const { source, spec, sortKey } = mountainsStore.getState();

    mount(
      container,
      el('div', {}, [
        renderAsync(source, {
          loading: () => el('div', { class: 'stack stack--5' }, [SkeletonList(6)]),
          error: (error) => ErrorState({ error, onRetry: () => loadMountains(services.mountains, { force: true }) }),
          success: (all) => body(all, spec, sortKey),
        }),
      ]),
    );
  }

  function body(all, spec, sortKey) {
    const visible = services.mountains.filter(all, spec, sortKey);
    const facets = services.mountains.facets(all, spec);

    return el('div', { class: 'stack stack--5' }, [
      FilterBar({ spec, facets, onChange: setSpec }),

      el('div', { class: 'row row--between' }, [
        el('span', { class: 't-label', text: `${int(visible.length)} / ${int(all.length)}` }),
        SegmentedControl({
          items: SORT_ITEMS,
          selected: sortKey,
          ariaLabel: '정렬 기준',
          onSelect: setSortKey,
        }),
      ]),

      visible.length === 0
        ? EmptyState({
            title: '조건에 맞는 산이 없습니다',
            description: '필터를 줄이면 더 많은 산이 표시됩니다.',
            iconName: 'filter',
            actionLabel: isEmptySpec(spec) ? null : '필터 초기화',
            onAction: resetSpec,
          })
        : el(
            'div',
            { class: 'mlist' },
            visible.map((mountain) =>
              MountainCard({ mountain, onSelect: (id) => navigate(`/mountains/${id}`) }),
            ),
          ),
    ]);
  }

  const unsubscribe = mountainsStore.subscribe(render);
  render();
  loadMountains(services.mountains);

  return onDestroy(container, unsubscribe);
}
