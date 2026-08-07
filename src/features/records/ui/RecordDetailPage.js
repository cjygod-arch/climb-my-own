/**
 * features/records/ui/RecordDetailPage.js — 산행 상세.
 * "클릭 시 세부 일정별 산행정보" 요구사항에 해당하는 화면이다.
 */

import { el, mount, onDestroy } from '../../../core/dom.js';
import { createStore } from '../../../core/store.js';
import { renderAsync, idle, loading, success, failure } from '../../../core/asyncState.js';
import { km, int, clock, date, weekday, duration } from '../../../core/format.js';
import { StatBlock, StatGrid } from '../../../shared/ui/StatBlock.js';
import { DataRow, DataList } from '../../../shared/ui/DataRow.js';
import { Button } from '../../../shared/ui/Button.js';
import { Tag } from '../../../shared/ui/Chip.js';
import { ErrorState } from '../../../shared/ui/EmptyState.js';
import { SkeletonStats } from '../../../shared/ui/Skeleton.js';
import { routeLabel } from '../../../domain/entities/course.js';
import { isTracked, hasRoute } from '../../../domain/entities/hikeRecord.js';
import { isWalk, activityLabel, displayTitle } from '../../../domain/entities/activity.js';
import { createRouteMap } from '../../../shared/ui/RouteMap.js';
import { difficultyOf } from '../../../domain/rules/difficulty.js';

export function RecordDetailPage({ services, params, navigate, shell }) {
  const container = el('div', { class: 'page' });
  const store = createStore({ detail: idle() });
  let mapHandle = null;

  async function load() {
    store.setState({ detail: loading() });
    const result = await services.records.getDetail(params.id);
    store.setState({ detail: result.ok ? success(result.value) : failure(result.error) });

    // 헤더 제목은 무엇을 기록했는지 알아야 정할 수 있다.
    if (result.ok) {
      shell?.update?.(
        {
          title: isWalk(result.value.record) ? '운동 상세' : '산행 상세',
          tab: 'records',
          chrome: 'shell',
          back: true,
        },
        () => window.history.back(),
      );
    }
  }

  async function handleRemove(record) {
    if (!window.confirm('이 기록을 삭제할까요? 되돌릴 수 없습니다.')) return;
    const result = await services.records.remove(record.id);
    if (!result.ok) {
      window.alert(result.error.message);
      return;
    }
    navigate('/records');
  }

  function render() {
    mount(
      container,
      renderAsync(store.getState().detail, {
        loading: () => SkeletonStats(3),
        error: (error) => ErrorState({ error, onRetry: load }),
        success: (detail) => body(detail),
      }),
    );
  }

  function body({ record, mountain, course }) {
    return el('div', { class: 'stack stack--6' }, [
      el('header', { class: 'stack stack--1' }, [
        el('p', { class: 't-label', text: `${date(record.hikedOn)} ${weekday(record.hikedOn)}요일` }),
        // 산행은 산 이름이, 걷기는 사용자가 붙인 제목이 주인공이다.
        el('h1', { class: 't-display', text: displayTitle(record, mountain?.name ?? '') }),
        mountain && el('p', { class: 't-caption', text: mountain.province }),
        el('div', { class: 'row', style: { marginTop: 'var(--space-2)', gap: 'var(--space-2)' } }, [
          isWalk(record) && Tag(activityLabel(record)),
          isTracked(record) && Tag('기록으로 저장됨'),
        ]),
      ]),

      // 실제로 이동한 경로가 남아 있으면 지도에 그린다.
      hasRoute(record) && routeCard(record),

      StatGrid(
        [
          StatBlock({ value: km(record.distanceKm), unit: 'km', label: isWalk(record) ? '걸은 거리' : '거리' }),
          // 걷기에는 상승고도가 의미 없다. 대신 평균 속도를 보여준다.
          isWalk(record)
            ? StatBlock({
                value: record.durationMin > 0
                  ? (record.distanceKm / (record.durationMin / 60)).toFixed(1)
                  : '—',
                unit: 'km/h', label: '평균 속도',
              })
            : StatBlock({ value: int(record.ascentM), unit: 'm', label: '상승고도' }),
          StatBlock({ value: clock(record.durationMin), unit: 'h', label: '소요시간' }),
        ],
        3,
      ),

      el('section', { class: 'card stack stack--3' }, [
        el('h2', { class: 't-title', text: isWalk(record) ? '운동 정보' : '산행 정보' }),
        DataList([
          // 안내로 기록한 활동만 출발·도착 시각이 있다.
          isTracked(record) && DataRow({ label: '출발', value: timeOf(record.startedAt) }),
          isTracked(record) && DataRow({ label: '도착', value: timeOf(record.endedAt) }),
          // 걷기에는 난이도라는 개념이 없다.
          !isWalk(record) &&
            DataRow({ label: '체감 난이도', value: difficultyOf(record.distanceKm, record.ascentM) }),
          DataRow({ label: '소요 시간', value: duration(record.durationMin) }),
          !isWalk(record) && mountain &&
            DataRow({ label: '정상 표고', value: `${int(mountain.elevationM)} m` }),
          course &&
            DataRow({
              label: '코스',
              value: el('span', { class: 'datarow__value', text: course.name }),
              onClick: () => navigate(`/courses/${course.id}`),
            }),
          course && DataRow({ label: '구간', value: routeLabel(course) || '—' }),
        ].filter(Boolean)),
      ]),

      record.memo &&
        el('section', { class: 'card stack stack--3' }, [
          el('h2', { class: 't-title', text: '메모' }),
          el('p', { class: 't-prose', text: record.memo }),
        ]),

      el('div', { class: 'sticky-action' }, [
        Button({
          label: '기록 삭제',
          variant: 'danger',
          block: true,
          iconName: 'trash',
          onClick: () => handleRemove(record),
        }),
      ]),
    ]);
  }

  /**
   * 걸은 길 지도. 지도는 카드가 화면에 붙은 뒤에 만들어야 크기를 잴 수 있다.
   * 페이지를 떠날 때 지도를 정리하려고 핸들을 바깥에 보관한다.
   */
  function routeCard(record) {
    const canvas = el('div', { class: 'rec-map' });

    queueMicrotask(async () => {
      if (!canvas.isConnected) return;
      const handle = await createRouteMap(canvas, {
        routes: [{ id: record.id, index: 1, label: '이동 경로', points: record.route, markers: [] }],
        bounds: boundsOfRoute(record.route),
        activeId: record.id,
      });
      if (handle.ok) {
        mapHandle = handle;
        handle.fitTo(record.route);
      } else {
        mount(canvas, el('div', { class: 'rec-map__fail' }, [
          el('p', { class: 't-caption', text: '지도를 불러오지 못했습니다.' }),
        ]));
      }
    });

    return el('section', { class: 'card card--tight stack stack--3' }, [
      el('h2', { class: 't-title', text: isWalk(record) ? '걸은 길' : '이동 경로' }),
      canvas,
    ]);
  }

  const unsubscribe = store.subscribe(render);
  render();
  load();

  return onDestroy(container, () => {
    unsubscribe();
    mapHandle?.destroy();
    mapHandle = null;
  });
}

/** 경로를 모두 담는 경계 상자. */
function boundsOfRoute(route) {
  const lats = route.map((p) => p[0]);
  const lngs = route.map((p) => p[1]);
  return {
    south: Math.min(...lats), north: Math.max(...lats),
    west: Math.min(...lngs), east: Math.max(...lngs),
  };
}

/** ISO 시각 → 'HH:MM'. 날짜는 이미 헤더에 있으므로 시각만 보여준다. */
function timeOf(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}
