/**
 * features/badges/ui/BadgesPage.js — 배지 목록.
 * 획득 배지가 위로 오고, 미획득은 진행률이 높은 순으로 이어진다.
 */

import { el, mount, onDestroy } from '../../../core/dom.js';
import { createStore } from '../../../core/store.js';
import { renderAsync, idle, loading, success, failure } from '../../../core/asyncState.js';
import { int } from '../../../core/format.js';
import { subscribe } from '../../../core/eventBus.js';
import { Topic } from '../../../domain/events.js';
import { StatBlock } from '../../../shared/ui/StatBlock.js';
import { ErrorState, EmptyState } from '../../../shared/ui/EmptyState.js';
import { Skeleton } from '../../../shared/ui/Skeleton.js';
import { BadgeTile } from './BadgeTile.js';

export function BadgesPage({ services, navigate }) {
  const container = el('div', { class: 'page' });
  const store = createStore({ overview: idle() });

  async function load() {
    store.setState({ overview: loading(store.getState().overview.data) });
    const result = await services.badges.overview();
    store.setState({ overview: result.ok ? success(result.value) : failure(result.error) });
  }

  function render() {
    mount(
      container,
      renderAsync(store.getState().overview, {
        loading: () =>
          el('div', { class: 'stack stack--6' }, [
            Skeleton({ variant: 'stat', width: '50%' }),
            el('div', { class: 'btiles' }, Array.from({ length: 6 }, () => Skeleton({ variant: 'block' }))),
          ]),
        error: (error) => ErrorState({ error, onRetry: load }),
        success: (data) => body(data),
      }),
    );
  }

  function body({ badges, earnedCount, totalCount }) {
    const earned = badges.filter((b) => b.earned);
    const locked = badges.filter((b) => !b.earned);

    return el('div', { class: 'stack stack--6' }, [
      el('header', {}, [
        StatBlock({
          value: `${int(earnedCount)}`,
          unit: `/ ${int(totalCount)}`,
          label: '획득한 배지',
        }),
      ]),

      earned.length === 0
        ? EmptyState({
            title: '아직 획득한 배지가 없습니다',
            description: '첫 산행을 기록하면 바로 하나를 얻게 됩니다.',
            iconName: 'badge',
            actionLabel: '산행 기록하기',
            onAction: () => navigate('/records/new'),
          })
        : el('section', { class: 'stack stack--3' }, [
            el('h2', { class: 't-title', style: { padding: '0 var(--space-2)' }, text: '획득' }),
            el('div', { class: 'btiles' }, earned.map((badge) => BadgeTile({ badge }))),
          ]),

      locked.length > 0 &&
        el('section', { class: 'stack stack--3' }, [
          el('h2', { class: 't-title', style: { padding: '0 var(--space-2)' }, text: '도전 중' }),
          el('div', { class: 'btiles' }, locked.map((badge) => BadgeTile({ badge }))),
        ]),
    ]);
  }

  const unsubscribeStore = store.subscribe(render);
  // 기록이 바뀌면 진행률이 달라진다. 화면에 없더라도 다음 진입 때 최신값을 보게 된다.
  const offSaved = subscribe(Topic.RECORD_SAVED, load);
  const offDeleted = subscribe(Topic.RECORD_DELETED, load);

  render();
  load();

  return onDestroy(container, () => {
    unsubscribeStore();
    offSaved();
    offDeleted();
  });
}
