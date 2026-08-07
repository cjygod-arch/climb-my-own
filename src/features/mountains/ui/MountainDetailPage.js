/**
 * features/mountains/ui/MountainDetailPage.js — 산 상세.
 *
 * 화면 구성 순서가 곧 정보 위계다: 수치 → 소개글 → 코스.
 * 섹션은 3개로 제한한다(밀도 규칙).
 */

import { el, mount, onDestroy } from '../../../core/dom.js';
import { createStore } from '../../../core/store.js';
import { renderAsync, idle, loading, success, failure } from '../../../core/asyncState.js';
import { int, km, duration } from '../../../core/format.js';
import { StatBlock, StatGrid } from '../../../shared/ui/StatBlock.js';
import { DataRow, DataList } from '../../../shared/ui/DataRow.js';
import { Tag } from '../../../shared/ui/Chip.js';
import { Button } from '../../../shared/ui/Button.js';
import { EmptyState, ErrorState } from '../../../shared/ui/EmptyState.js';
import { SkeletonStats, SkeletonList } from '../../../shared/ui/Skeleton.js';
import { displayName, locationLabel } from '../../../domain/entities/mountain.js';
import { routeLabel } from '../../../domain/entities/course.js';

export function MountainDetailPage({ services, params, navigate, shell }) {
  const container = el('div', { class: 'page' });
  const store = createStore({ detail: idle(), courses: idle() });

  async function load() {
    store.setState({ detail: loading(), courses: loading() });

    const detail = await services.mountains.getById(params.id);
    store.setState({ detail: detail.ok ? success(detail.value) : failure(detail.error) });
    if (!detail.ok) return;

    // 헤더 제목은 데이터가 도착한 뒤에야 정해진다.
    shell?.update?.(
      { title: detail.value.name, tab: 'mountains', chrome: 'shell', back: true },
      () => window.history.back(),
    );

    const courses = await services.courses.listByMountain(params.id);
    store.setState({ courses: courses.ok ? success(courses.value) : failure(courses.error) });
  }

  function render() {
    const { detail, courses } = store.getState();

    mount(
      container,
      renderAsync(detail, {
        loading: () => el('div', { class: 'stack stack--6' }, [SkeletonStats(3), SkeletonList(3)]),
        error: (error) => ErrorState({ error, onRetry: load }),
        success: (mountain) => body(mountain, courses),
      }),
    );
  }

  function body(mountain, coursesState) {
    return el('div', { class: 'stack stack--6' }, [
      // 1. 표제 + 수치
      el('header', { class: 'card stack stack--4' }, [
        el('div', { class: 'stack stack--1' }, [
          el('h1', { class: 't-display', text: displayName(mountain) }),
          el('p', { class: 't-caption', text: locationLabel(mountain) }),
        ]),
        el('p', { class: 't-body t-mute', text: mountain.summary }),
        el('div', { class: 'row row--wrap', style: { gap: 'var(--space-2)' } }, [
          ...mountain.categories.map((c) => Tag(c)),
          !mountain.verified && Tag('정보 확인 필요', { tone: 'warn' }),
        ]),

        StatGrid(
        [
          StatBlock({ value: int(mountain.elevationM), unit: 'm', label: '표고' }),
          StatBlock({ value: mountain.difficulty, label: '난이도', size: 'sm' }),
          StatBlock({
            value: mountain.bestSeason.join('·') || '—',
            label: '추천 시기',
            size: 'sm',
          }),
        ],
        3,
      ),
      ]),

      // 2. 소개글
      el('section', { class: 'card' }, [
        el('h2', { class: 't-title', text: '산 소개' }),
        el(
          'div',
          { class: 't-prose', style: { marginTop: 'var(--space-3)' } },
          mountain.description.split('\n\n').map((p) => el('p', { text: p })),
        ),
        mountain.dataSource &&
          el('p', { class: 't-caption', style: { marginTop: 'var(--space-4)' }, text: `출처: ${mountain.dataSource}` }),
      ]),

      // 3. 코스
      el('section', { class: 'card stack stack--3' }, [
        el('div', { class: 'row row--between' }, [
          el('h2', { class: 't-title', text: '등산 코스' }),
          el('div', { class: 'row', style: { gap: 'var(--space-1)' } }, [
            Button({
              label: '지도로 보기',
              variant: 'quiet',
              size: 'sm',
              iconName: 'location',
              onClick: () => navigate(`/mountains/${mountain.id}/map`),
            }),
            Button({
              label: '내 코스 등록',
              variant: 'quiet',
              size: 'sm',
              iconName: 'plus',
              onClick: () => navigate(`/courses/new?mountainId=${mountain.id}`),
            }),
          ]),
        ]),
        renderAsync(coursesState, {
          loading: () => SkeletonList(2),
          error: (error) => ErrorState({ error, onRetry: load }),
          success: (list) =>
            list.length === 0
              ? EmptyState({
                  title: '등록된 코스가 없습니다',
                  description: '직접 다녀온 길을 코스로 등록할 수 있습니다.',
                  iconName: 'route',
                  actionLabel: '내 코스 등록',
                  onAction: () => navigate(`/courses/new?mountainId=${mountain.id}`),
                })
              : DataList(
                  list.map((course) =>
                    DataRow({
                      label: course.name,
                      value: el('span', { class: 'crow__meta' }, [
                        el('span', { class: 'datarow__value', text: `${km(course.distanceKm)} km` }),
                        el('span', { class: 't-caption', text: duration(course.durationMin) }),
                        el('span', { class: 't-caption t-faint', text: routeLabel(course) }),
                      ]),
                      onClick: () => navigate(`/courses/${course.id}`),
                    }),
                  ),
                ),
        }),
      ]),
    ]);
  }

  const unsubscribe = store.subscribe(render);
  render();
  load();

  return onDestroy(container, unsubscribe);
}
