/**
 * features/courses/ui/CourseGuidePage.js — 등산길 안내.
 *
 * 지도를 쓰지 않는 대신 두 장치로 길을 설명한다:
 *   1. 고도 단면도 — 어디가 힘든지 한눈에
 *   2. 구간 리스트 — 지점별 누적 거리·표고·주의사항
 * 참고 앱이 지도 중심인 것과 정확히 갈라지는 지점이다.
 */

import { el, mount, onDestroy } from '../../../core/dom.js';
import { createStore } from '../../../core/store.js';
import { renderAsync, idle, loading, success, failure } from '../../../core/asyncState.js';
import { km, int } from '../../../core/format.js';
import { ElevationChart } from '../../../shared/ui/ElevationChart.js';
import { SegmentList } from '../../../shared/ui/SegmentList.js';
import { Button } from '../../../shared/ui/Button.js';
import { ErrorState } from '../../../shared/ui/EmptyState.js';
import { SkeletonStats, Skeleton } from '../../../shared/ui/Skeleton.js';
import { legDistanceKm, legElevationDeltaM } from '../../../domain/entities/courseSegment.js';
import { CourseSummaryHeader } from './CourseSummaryHeader.js';

export function CourseGuidePage({ services, params, navigate, shell }) {
  const container = el('div', { class: 'page' });
  const store = createStore({ guide: idle() });

  async function load() {
    store.setState({ guide: loading() });
    const result = await services.courses.getGuide(params.id);
    store.setState({ guide: result.ok ? success(result.value) : failure(result.error) });

    if (result.ok) {
      shell?.update?.(
        { title: result.value.course.name, tab: 'mountains', chrome: 'shell', back: true },
        () => window.history.back(),
      );
    }
  }

  function render() {
    mount(
      container,
      renderAsync(store.getState().guide, {
        loading: () =>
          el('div', { class: 'stack stack--6' }, [SkeletonStats(3), Skeleton({ variant: 'block', height: '160px' })]),
        error: (error) => ErrorState({ error, onRetry: load }),
        success: (guide) => body(guide),
      }),
    );
  }

  function body({ course, mountain, profile, path }) {
    const segments = course.segments;

    return el('div', { class: 'stack stack--6' }, [
      CourseSummaryHeader({ course, mountainName: mountain?.name ?? '' }),

      el('section', { class: 'card stack stack--3' }, [
        el('div', { class: 'row row--between' }, [
          el('h2', { class: 't-title', text: '고도 단면' }),
          path.points.length > 1 &&
            Button({
              label: '지도로 보기',
              variant: 'quiet',
              size: 'sm',
              iconName: 'location',
              onClick: () => navigate(`/mountains/${course.mountainId}/map?course=${course.id}`),
            }),
        ]),
        ElevationChart({ points: profile.points, peakIndex: profile.peakIndex, height: 170 }),
      ]),

      el('section', { class: 'card stack stack--3' }, [
        el('h2', { class: 't-title', text: '구간 안내' }),
        segments.length === 0
          ? el('p', { class: 't-caption', text: '등록된 구간 정보가 없습니다.' })
          : SegmentList({
              items: segments.map((segment, i) => ({
                title: segment.name,
                note: buildNote(segments, i, segment.note),
                primary: `${km(segment.cumDistanceKm)} km`,
                secondary: `${int(segment.elevationM)} m`,
              })),
            }),
        course.note && el('p', { class: 't-caption', text: course.note }),
      ]),

      el('div', { class: 'sticky-action stack stack--2' }, [
        // 안내는 좌표가 있어야 가능하다. 없으면 버튼을 내보내지 않는다.
        path.points.length > 1 &&
          Button({
            label: '이 코스로 안내받기',
            variant: 'primary',
            block: true,
            size: 'lg',
            iconName: 'location',
            onClick: () => startGuidance(course),
          }),
        Button({
          label: '이 코스로 기록하기',
          variant: path.points.length > 1 ? 'ghost' : 'primary',
          block: true,
          size: path.points.length > 1 ? 'md' : 'lg',
          onClick: () => navigate(`/records/new?courseId=${course.id}&mountainId=${course.mountainId}`),
        }),
      ]),
    ]);
  }

  /**
   * 안내를 시작한다. 출발 시각은 서비스가 확정한다.
   * 위치 권한은 여기서 처음 요청되므로, 왜 필요한지 먼저 알린다.
   */
  async function startGuidance(course) {
    // 라우터 게이트가 막아주지 않는 인라인 동작이다. 여기서 직접 확인한다.
    // 권한 요청 팝업을 띄우기 전에 로그인부터 보내야 흐름이 자연스럽다.
    if (!services.profile.isAuthenticated()) {
      navigate(`/login?next=${encodeURIComponent(`/courses/${course.id}`)}`);
      return;
    }

    const proceed = window.confirm(
      `‘${course.name}’ 안내를 시작합니다.\n\n` +
      '현재 위치를 계속 확인해 코스의 어디쯤인지 알려드립니다.\n' +
      '종료할 때 출발·도착 시각과 총 소요시간이 기록으로 저장됩니다.\n\n' +
      '위치 권한을 허용해 주세요.',
    );
    if (!proceed) return;

    const result = await services.tracking.start(course.id);
    if (!result.ok) {
      window.alert(result.error.message);
      return;
    }
    navigate('/tracking');
  }

  /** 구간 거리와 고도 변화를 안내 문구 앞에 붙인다. 첫 지점은 붙일 것이 없다. */
  function buildNote(segments, index, note) {
    if (index === 0) return note;
    const dist = legDistanceKm(segments, index);
    const delta = legElevationDeltaM(segments, index);
    const sign = delta >= 0 ? '+' : '';
    const prefix = `구간 ${dist} km · ${sign}${delta} m`;
    return note ? `${prefix} · ${note}` : prefix;
  }

  const unsubscribe = store.subscribe(render);
  render();
  load();

  return onDestroy(container, unsubscribe);
}
