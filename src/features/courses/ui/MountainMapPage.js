/**
 * features/courses/ui/MountainMapPage.js — 산의 코스를 지도에서 본다.
 *
 * 산 상세의 '지도로 보기'와 코스 안내의 '지도로 보기'가 이 화면으로 온다.
 * ?course=<id> 로 특정 코스를 미리 선택할 수 있다.
 *
 * 지도를 별도 화면에 둔 이유: 고도 단면과 구간 안내가 1차 정보라는 위계를 지키기 위해서다.
 * 지도가 상세 화면 위에 얹히면 화면 인상이 지도 앱이 되어 버린다.
 *
 * 렌더링 구조가 두 층으로 나뉘어 있다:
 *   지도 캔버스 — 데이터가 오면 딱 한 번 만든다. 코스를 바꿔도 다시 만들지 않는다.
 *   코스 목록  — 선택이 바뀔 때마다 다시 그린다.
 * 한 덩어리로 그리면 코스를 고를 때마다 지도가 재생성되어 깜빡이고 타일을 다시 받는다.
 */

import { el, mount, onDestroy } from '../../../core/dom.js';
import { createStore } from '../../../core/store.js';
import { renderAsync, idle, loading, success, failure } from '../../../core/asyncState.js';
import { km, int, clock } from '../../../core/format.js';
import { createRouteMap } from '../../../shared/ui/RouteMap.js';
import { EmptyState, ErrorState } from '../../../shared/ui/EmptyState.js';
import { Skeleton } from '../../../shared/ui/Skeleton.js';
import { Button } from '../../../shared/ui/Button.js';
import { Tag } from '../../../shared/ui/Chip.js';
import { boundsOf, pathProvenance } from '../../../domain/rules/coursePath.js';
import { routeLabel } from '../../../domain/entities/course.js';

export function MountainMapPage({ services, params, query, navigate, shell }) {
  const container = el('div', { class: 'mapview' });
  const store = createStore({ data: idle(), activeId: query.course ?? null });

  let mapHandle = null;
  let listSlot = null;

  async function load() {
    store.setState({ data: loading() });
    const result = await services.courses.getMountainMap(params.id);

    if (!result.ok) {
      store.setState({ data: failure(result.error) });
      return;
    }

    shell?.update?.(
      { title: `${result.value.mountain?.name ?? '코스'} 지도`, tab: 'mountains', chrome: 'shell', back: true },
      () => window.history.back(),
    );

    // 선택된 코스가 지정되지 않았거나 그릴 수 없는 코스면 첫 번째로 맞춘다.
    const drawable = result.value.courses.filter((c) => c.path.points.length > 1);
    const requested = store.getState().activeId;
    const activeId = drawable.some((c) => c.id === requested) ? requested : (drawable[0]?.id ?? null);

    store.setState({ data: success(result.value), activeId });
  }

  /** 선택만 바뀌었을 때 — 지도는 그대로 두고 강조와 목록만 갱신한다. */
  function selectCourse(id) {
    if (store.getState().activeId === id) return;
    store.setState({ activeId: id });
    mapHandle?.setActive(id);
    renderList();
  }

  function renderList() {
    const { data, activeId } = store.getState();
    if (!listSlot || data.status !== 'success') return;

    const drawable = data.data.courses.filter((c) => c.path.points.length > 1);
    mount(
      listSlot,
      el(
        'div',
        { class: 'mapview__list' },
        drawable.map((course, i) => courseRow(course, i + 1, course.id === activeId)),
      ),
    );
  }

  function renderShell() {
    const { data } = store.getState();

    mount(
      container,
      renderAsync(data, {
        loading: () => el('div', { class: 'page' }, [Skeleton({ variant: 'block', height: '320px' })]),
        error: (error) => el('div', { class: 'page' }, [ErrorState({ error, onRetry: load })]),
        success: (value) => body(value),
      }),
    );
  }

  function body({ mountain, courses }) {
    const drawable = courses.filter((c) => c.path.points.length > 1);

    if (drawable.length === 0) {
      return el('div', { class: 'page' }, [
        EmptyState({
          title: '지도에 표시할 좌표가 없습니다',
          description: '이 산의 코스에는 아직 위치 정보가 등록되지 않았습니다. 구간 안내와 고도 단면은 코스 화면에서 볼 수 있습니다.',
          iconName: 'location',
          actionLabel: '산 상세로',
          onAction: () => navigate(`/mountains/${mountain?.id ?? params.id}`),
        }),
      ]);
    }

    const canvas = el('div', { class: 'mapview__canvas', role: 'application', 'aria-label': '등산로 지도' });
    listSlot = el('div');

    initMap(canvas, drawable);

    return el('div', {}, [
      canvas,
      el('div', { class: 'page mapview__panel' }, [
        el('div', { class: 'row row--between row--baseline' }, [
          el('h2', { class: 't-title', text: `등산 코스 ${drawable.length}` }),
          // 코스마다 출처가 다를 수 있으므로 하나라도 개략이면 경고를 남긴다.
          drawable.every((c) => !pathProvenance(c).approximate)
            ? Tag('실제 등산로')
            : Tag('일부 개략 경로', { tone: 'warn' }),
        ]),
        listSlot,
        el('p', {
          class: 't-caption t-faint',
          style: { marginTop: 'var(--space-4)' },
          text: drawable.every((c) => !pathProvenance(c).approximate)
            ? '경로는 OpenStreetMap에 등록된 보행로를 따라 그렸습니다. 실제 통제 상황은 현지 안내판과 국립공원공단 정보를 확인하세요.'
            : '‘개략’ 표시가 붙은 코스의 선은 주요 지점을 이은 것이라 실제 등산로와 모양이 다릅니다. 현지 안내판과 국립공원공단 정보를 함께 확인하세요.',
        }),
      ]),
    ]);
  }

  /** 지도 생성은 DOM이 문서에 붙은 뒤라야 한다(Leaflet이 크기를 재야 하므로). */
  function initMap(canvas, drawable) {
    queueMicrotask(async () => {
      if (!canvas.isConnected) return;

      const handle = await createRouteMap(canvas, {
        routes: drawable.map((c, i) => ({
          id: c.id,
          index: i + 1,
          label: c.name,
          points: c.path.points,
          markers: c.path.markers,
        })),
        bounds: boundsOf(drawable.map((c) => c.path.points)),
        activeId: store.getState().activeId,
        onSelect: selectCourse,
      });

      if (!handle.ok) {
        console.error('[MountainMapPage] 지도 로드 실패', handle.error);
        mount(
          canvas,
          el('div', { class: 'mapview__fallback' }, [
            EmptyState({
              title: '지도를 불러오지 못했습니다',
              description: '네트워크 연결을 확인해 주세요. 구간 안내와 고도 단면은 아래 코스에서 그대로 볼 수 있습니다.',
              iconName: 'warning',
            }),
          ]),
        );
        return;
      }

      mapHandle = handle;
    });
  }

  function courseRow(course, index, isActive) {
    return el('div', { class: 'maprow', dataset: { active: String(isActive) } }, [
      el('button', {
        type: 'button',
        class: 'maprow__pick',
        'aria-pressed': String(isActive),
        onClick: () => selectCourse(course.id),
      }, [
        el('span', { class: 'maprow__num', text: String(index) }),
        el('span', { class: 'maprow__body' }, [
          el('span', { class: 'maprow__name t-body-strong', text: course.name }),
          el('span', { class: 'row', style: { gap: 'var(--space-2)', minWidth: '0' } }, [
            el('span', { class: 'maprow__route t-caption', text: routeLabel(course) }),
            pathProvenance(course).approximate && Tag('개략', { tone: 'warn' }),
          ]),
        ]),
        el('span', { class: 'maprow__meta' }, [
          el('span', { class: 'maprow__dist', text: `${km(course.distanceKm)} km` }),
          el('span', { class: 't-caption t-faint', text: `${int(course.ascentM)} m · ${clock(course.durationMin)}` }),
        ]),
      ]),

      isActive &&
        el('div', { class: 'maprow__actions' }, [
          Button({
            label: '구간 안내 보기',
            variant: 'ghost',
            size: 'sm',
            block: true,
            iconName: 'route',
            onClick: () => navigate(`/courses/${course.id}`),
          }),
        ]),
    ]);
  }

  // 데이터 상태가 바뀔 때만 전체를 다시 그린다. 선택 변경은 selectCourse가 처리한다.
  const unsubscribe = store.select(
    (s) => s.data.status,
    () => {
      renderShell();
      renderList();
    },
  );

  renderShell();
  load();

  return onDestroy(container, () => {
    unsubscribe();
    mapHandle?.destroy();
    mapHandle = null;
    listSlot = null;
  });
}
