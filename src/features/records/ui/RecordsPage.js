/**
 * features/records/ui/RecordsPage.js — 월별 기록.
 *
 * 섹션 3개로 제한: 월 선택 + 요약 / 추이 / 목록.
 * 기록이 저장되면 eventBus로 알림이 와서 이 화면이 스스로 갱신된다 —
 * records 기능이 다른 화면을 직접 호출하지 않게 하기 위한 구조다.
 */

import { el, mount, onDestroy } from '../../../core/dom.js';
import { renderAsync, hasData } from '../../../core/asyncState.js';
import { monthLabel } from '../../../core/format.js';
import { subscribe } from '../../../core/eventBus.js';
import { Topic } from '../../../domain/events.js';
import { IconButton, Button } from '../../../shared/ui/Button.js';
import { EmptyState, ErrorState } from '../../../shared/ui/EmptyState.js';
import { SkeletonStats, SkeletonList } from '../../../shared/ui/Skeleton.js';
import { recentMonthKeys, statForMonth } from '../../../domain/rules/monthlyStats.js';
import { recordsStore, loadMonth, stepMonth } from '../records.store.js';
import { MonthSummary, MonthTrend } from './MonthSummary.js';
import { RecordListItem } from './RecordListItem.js';

const TREND_MONTHS = 6;

export function RecordsPage({ services, navigate }) {
  const container = el('div', { class: 'page' });

  function render() {
    const { monthKey, view } = recordsStore.getState();

    mount(
      container,
      el('div', { class: 'stack stack--6' }, [
        monthNav(monthKey),
        renderAsync(view, {
          loading: () =>
            hasData(view)
              ? content(view.data, monthKey)
              : el('div', { class: 'stack stack--6' }, [SkeletonStats(3), SkeletonList(4)]),
          error: (error) => ErrorState({ error, onRetry: () => loadMonth(services.records, monthKey) }),
          success: (data) => content(data, monthKey),
        }),
      ]),
    );
  }

  function monthNav(monthKey) {
    return el('div', { class: 'row row--between monthnav' }, [
      IconButton({ iconName: 'chevronLeft', label: '이전 달', onClick: () => stepMonth(services.records, -1) }),
      el('span', { class: 't-title', text: monthLabel(monthKey) }),
      IconButton({ iconName: 'chevronRight', label: '다음 달', onClick: () => stepMonth(services.records, 1) }),
    ]);
  }

  function content(data, monthKey) {
    const { month, months } = data;

    // 추이는 기록이 없는 달도 0으로 보여야 흐름이 읽힌다.
    const allRecords = months.flatMap((m) => m.records);
    const trend = recentMonthKeys(monthKey, TREND_MONTHS).map((key) => ({
      monthKey: key,
      distanceKm: statForMonth(allRecords, key).distanceKm,
    }));

    return el('div', { class: 'stack stack--6' }, [
      MonthSummary({ stat: month }),

      el('section', { class: 'card stack stack--3' }, [
        el('h2', { class: 't-title', text: `최근 ${TREND_MONTHS}개월` }),
        MonthTrend({
          months: trend,
          activeKey: monthKey,
          onSelect: (key) => loadMonth(services.records, key),
        }),
      ]),

      el('section', { class: 'stack stack--3' }, [
        el('h2', { class: 't-title', style: { padding: '0 var(--space-2)' }, text: '산행 목록' }),
        month.records.length === 0
          ? EmptyState({
              title: '이 달의 기록이 없습니다',
              description: '다녀온 산행을 추가하면 누적 거리와 배지가 함께 갱신됩니다.',
              iconName: 'calendar',
              actionLabel: '산행 기록하기',
              onAction: () => navigate('/records/new'),
            })
          : el(
              'div',
              { class: 'entries' },
              month.records.map((record) =>
                RecordListItem({ record, onSelect: (id) => navigate(`/records/${id}`) }),
              ),
            ),
      ]),

      el('div', { class: 'sticky-action' }, [
        Button({
          label: '산행 기록하기',
          variant: 'primary',
          block: true,
          size: 'lg',
          iconName: 'plus',
          onClick: () => navigate('/records/new'),
        }),
      ]),
    ]);
  }

  const unsubscribeStore = recordsStore.subscribe(render);
  const offSaved = subscribe(Topic.RECORD_SAVED, () => loadMonth(services.records));
  const offDeleted = subscribe(Topic.RECORD_DELETED, () => loadMonth(services.records));

  render();
  loadMonth(services.records);

  return onDestroy(container, () => {
    unsubscribeStore();
    offSaved();
    offDeleted();
  });
}
