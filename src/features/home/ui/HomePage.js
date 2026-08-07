/**
 * features/home/ui/HomePage.js — 홈 대시보드.
 *
 * 첫 화면의 주인공은 이번 달 누적 거리 하나다.
 * 나머지는 전부 그보다 작게 두어 시선이 한 곳에서 출발하게 만든다.
 */

import { el, mount, onDestroy } from '../../../core/dom.js';
import { createStore } from '../../../core/store.js';
import { renderAsync, idle, loading, success, failure, hasData } from '../../../core/asyncState.js';
import { km, int, monthLabel, percent, weekday } from '../../../core/format.js';
import { subscribe } from '../../../core/eventBus.js';
import { Topic } from '../../../domain/events.js';
import { StatBlock, StatGrid } from '../../../shared/ui/StatBlock.js';
import { Button } from '../../../shared/ui/Button.js';
import { EmptyState, ErrorState } from '../../../shared/ui/EmptyState.js';
import { SkeletonStats, SkeletonList } from '../../../shared/ui/Skeleton.js';
import { EntryRow } from '../../../shared/ui/EntryRow.js';
import { config } from '../../../app/config.js';

export function HomePage({ services, navigate }) {
  const container = el('div', { class: 'page' });
  const store = createStore({ dashboard: idle() });

  async function load() {
    store.setState({ dashboard: loading(store.getState().dashboard.data) });
    const result = await services.home.getDashboard();
    store.setState({ dashboard: result.ok ? success(result.value) : failure(result.error) });
  }

  /**
   * 걷기 시작 화면으로 이동한다. 진행 중이면 바로 안내 화면으로.
   * 시작 화면을 여기서 만들지 않는 이유: 그러면 홈이 tracking 기능을 직접 알아야 한다
   * (ARCHITECTURE.md R5). 무엇을 보여줄지는 tracking 기능이 스스로 정한다.
   */
  function startWalk() {
    navigate(services.tracking.hasActive() ? '/tracking' : '/walk/new');
  }

  function render() {
    const { dashboard } = store.getState();

    // 로그인 전에는 보여줄 '내 기록'이 없다. 무엇을 할 수 있는지 안내한다.
    if (!services.profile.isAuthenticated()) {
      mount(container, guestBody());
      return;
    }

    mount(
      container,
      renderAsync(dashboard, {
        loading: () =>
          hasData(dashboard)
            ? body(dashboard.data)
            : el('div', { class: 'stack stack--6' }, [SkeletonStats(3), SkeletonList(3)]),
        error: (error) => ErrorState({ error, onRetry: load }),
        success: (data) => body(data),
      }),
    );
  }

  /** 로그인하지 않은 사람에게 보이는 홈. */
  function guestBody() {
    return el('div', { class: 'stack stack--4' }, [
      el('section', { class: 'card stack stack--4' }, [
        el('div', { class: 'stack stack--1' }, [
          el('h1', { class: 't-display', text: '한국 100대 명산' }),
          el('p', { class: 't-body t-mute', text: '코스와 구간 안내는 로그인 없이 둘러볼 수 있습니다.' }),
        ]),
        Button({
          label: '명산 둘러보기',
          variant: 'ghost',
          block: true,
          size: 'lg',
          iconName: 'peak',
          onClick: () => navigate('/mountains'),
        }),
      ]),

      el('section', { class: 'card stack stack--4' }, [
        el('div', { class: 'stack stack--1' }, [
          el('h2', { class: 't-title', text: '기록은 로그인 후에' }),
          el('p', {
            class: 't-body t-mute',
            text: '산행과 걷기 기록은 계정에 저장됩니다. 기기를 바꿔도 그대로 남고, 배지도 이어집니다.',
          }),
        ]),
        Button({
          label: '로그인하고 기록 시작하기',
          variant: 'primary',
          block: true,
          size: 'lg',
          onClick: () => navigate('/login?next=%2Frecords'),
        }),
      ]),
    ]);
  }

  function body({ thisMonth, total, recent, summitProgress, badgeCount }) {
    const ratio = summitProgress.total ? summitProgress.climbed / summitProgress.total : 0;

    return el('div', { class: 'stack stack--4' }, [
      // 1. 이번 달 — 첫 카드가 화면의 주인공이다
      el('section', { class: 'card stack stack--5' }, [
        el('p', { class: 't-label', text: monthLabel(config.thisMonth()) }),
        StatBlock({ value: km(thisMonth.distanceKm), unit: 'km', label: '이번 달 누적 거리' }),
        StatGrid(
          [
            StatBlock({ value: int(thisMonth.count), unit: '회', label: '산행', size: 'sm' }),
            StatBlock({ value: int(thisMonth.ascentM), unit: 'm', label: '상승고도', size: 'sm' }),
            StatBlock({ value: int(badgeCount), unit: '개', label: '배지', size: 'sm' }),
          ],
          3,
        ),
      ]),

      // 2. 100대 명산 진행
      el('section', { class: 'card stack stack--4' }, [
        el('div', { class: 'row row--between row--baseline' }, [
          el('h2', { class: 't-title', text: '100대 명산' }),
          el('span', { class: 't-caption', text: percent(ratio) }),
        ]),
        el('div', { class: 'row row--between row--baseline' }, [
          StatBlock({
            value: int(summitProgress.climbed),
            unit: `/ ${int(summitProgress.total)}`,
            label: '오른 산',
            size: 'sm',
          }),
          el('span', { class: 't-caption t-faint', text: `총 ${km(total.distanceKm)} km 누적` }),
        ]),
        el('div', { class: 'meter' }, [el('div', { class: 'meter__fill', style: { width: percent(ratio) } })]),
        Button({
          label: '명산 목록 보기',
          variant: 'ghost',
          block: true,
          iconName: 'peak',
          onClick: () => navigate('/mountains'),
        }),
      ]),

      // 3. 최근 기록
      el('section', { class: 'stack stack--3' }, [
        el('div', { class: 'row row--between', style: { padding: '0 var(--space-2)' } }, [
          el('h2', { class: 't-title', text: '최근 산행' }),
          recent.length > 0 &&
            Button({ label: '전체', variant: 'quiet', size: 'sm', onClick: () => navigate('/records') }),
        ]),
        recent.length === 0
          ? EmptyState({
              title: '기록이 없습니다',
              description: '첫 산행을 기록하면 이번 달 누적 거리가 쌓이기 시작합니다.',
              iconName: 'flag',
              actionLabel: '산행 기록하기',
              onAction: () => navigate('/records/new'),
            })
          : el(
              'div',
              { class: 'entries' },
              // features/records의 컴포넌트를 가져오지 않고 공통 EntryRow로 직접 그린다 (R5).
              recent.map((record) =>
                EntryRow({
                  day: record.hikedOn.slice(8, 10).replace(/^0/, ''),
                  weekday: weekday(record.hikedOn),
                  title: record.mountainName,
                  note: record.memo,
                  value: km(record.distanceKm),
                  unit: 'KM',
                  onSelect: () => navigate(`/records/${record.id}`),
                }),
              ),
            ),
      ]),

      el('div', { class: 'sticky-action' }, [
        el('div', { class: 'row', style: { gap: 'var(--space-2)' } }, [
          Button({
            label: '산행 기록하기',
            variant: 'primary',
            block: true,
            size: 'lg',
            iconName: 'plus',
            onClick: () => navigate('/records/new'),
          }),
          Button({
            label: '운동(걷기)',
            variant: 'secondary',
            block: true,
            size: 'lg',
            iconName: 'route',
            onClick: startWalk,
          }),
        ]),
      ]),
    ]);
  }

  const unsubscribeStore = store.subscribe(render);
  const offSaved = subscribe(Topic.RECORD_SAVED, load);
  const offDeleted = subscribe(Topic.RECORD_DELETED, load);
  // 로그인·로그아웃하면 홈이 통째로 달라진다.
  const offSession = services.profile.onSessionChange(() => { render(); load(); });

  render();
  if (services.profile.isAuthenticated()) load();

  return onDestroy(container, () => {
    unsubscribeStore();
    offSaved();
    offDeleted();
    offSession();
  });
}
