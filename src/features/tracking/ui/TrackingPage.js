/**
 * features/tracking/ui/TrackingPage.js — 산행 안내 화면.
 *
 * 지도 위에 현재 위치를 표시하고, 코스의 어디쯤인지·코스를 벗어났는지 알려준다.
 * 아래에는 경과 시간과 진행률, 다음 지점.
 *
 * 화면 갱신을 두 갈래로 나눴다:
 *   지도  — 위치가 올 때만 마커를 옮긴다 (재생성하지 않는다)
 *   패널  — 위치 갱신 + 1초 타이머로 다시 그린다
 * 한 덩어리로 그리면 1초마다 지도가 재생성되어 타일을 계속 다시 받는다.
 */

import { el, mount, onDestroy } from '../../../core/dom.js';
import { km, clock, duration } from '../../../core/format.js';
import { createRouteMap } from '../../../shared/ui/RouteMap.js';
import { Button } from '../../../shared/ui/Button.js';
import { EmptyState } from '../../../shared/ui/EmptyState.js';
import { Skeleton } from '../../../shared/ui/Skeleton.js';
import { StatBlock, StatGrid } from '../../../shared/ui/StatBlock.js';
import { openSheet } from '../../../shared/ui/Sheet.js';
import { Tag } from '../../../shared/ui/Chip.js';

export function TrackingPage({ services, navigate }) {
  const container = el('div', { class: 'track' });

  let mapHandle = null;
  let canvas = null;
  let panel = null;
  let ticker = null;
  let built = false;

  /** 지도는 첫 스냅샷이 왔을 때 한 번만 만든다. */
  function buildOnce(snapshot) {
    if (built) return;
    built = true;

    canvas = el('div', { class: 'track__map', role: 'application', 'aria-label': '산행 안내 지도' });
    panel = el('div', { class: 'track__panel' });

    mount(container, el('div', {}, [canvas, panel]));

    queueMicrotask(async () => {
      if (!canvas.isConnected) return;

      // 걷기는 따라갈 코스가 없다. 빈 지도 위에 내 자취만 그린다.
      const handle = await createRouteMap(canvas, {
        routes: snapshot.walk ? [] : [{
          id: snapshot.course.id,
          index: 1,
          label: snapshot.course.name,
          points: snapshot.track,
          markers: [],
        }],
        bounds: null,
        activeId: snapshot.walk ? null : snapshot.course.id,
        onFollowChange: () => renderPanel(),
      });

      if (!handle.ok) {
        mount(canvas, el('div', { class: 'track__mapfail' }, [
          EmptyState({
            title: '지도를 불러오지 못했습니다',
            description: '위치 기록은 계속되고 있습니다. 연결이 돌아오면 지도가 다시 표시됩니다.',
            iconName: 'warning',
          }),
        ]));
        return;
      }

      mapHandle = handle;
      if (snapshot.track) handle.fitTo(snapshot.track);
      applyToMap(services.tracking.getSnapshot());
    });
  }

  function applyToMap(snapshot) {
    if (!mapHandle || !snapshot) return;
    if (snapshot.lastFix) {
      mapHandle.setLivePosition({
        lat: snapshot.lastFix.lat,
        lng: snapshot.lastFix.lng,
        accuracy: snapshot.lastFix.accuracy,
      });
    }
    mapHandle.setTraveled(snapshot.session.points.map((p) => [p.lat, p.lng]));
  }

  function renderPanel() {
    const snapshot = services.tracking.getSnapshot();
    if (!snapshot || !panel) return;

    const { walk, progress, weakSignal, lastError } = snapshot;

    mount(panel, el('div', { class: 'page track__inner stack stack--4' }, [
      // 상태 배너 — 지금 상황을 한 줄로
      statusBanner({ walk, progress, weakSignal, lastError, following: mapHandle?.isFollowing() ?? true }),

      walk ? walkCard(snapshot) : hikeCard(snapshot),

      !walk && waypointCard(snapshot),

      el('div', { class: 'track__actions' }, [
        Button({
          label: walk ? '걷기 종료하고 기록하기' : '산행 종료하고 기록하기',
          variant: 'primary',
          block: true,
          size: 'lg',
          onClick: confirmStop,
        }),
        Button({
          label: mapHandle?.isFollowing() ? '지도 따라가기 켜짐' : '내 위치로 이동',
          variant: 'ghost',
          block: true,
          iconName: 'location',
          onClick: () => {
            mapHandle?.setFollow(true);
            const s = services.tracking.getSnapshot();
            if (s?.lastFix) mapHandle?.setLivePosition(s.lastFix);
            renderPanel();
          },
        }),
      ]),
    ]));
  }

  /** 걷기 — 코스가 없으므로 걸은 거리가 주인공이다. */
  function walkCard({ title, elapsedMin, traveledM, speedKmh }) {
    return el('div', { class: 'card stack stack--4' }, [
      el('div', { class: 'row row--between row--baseline' }, [
        el('h1', { class: 't-title', text: title }),
        Tag('걷기'),
      ]),
      StatBlock({ value: km(traveledM / 1000), unit: 'km', label: '걸은 거리' }),
      StatGrid([
        StatBlock({ value: clock(elapsedMin), unit: 'h', label: '경과 시간', size: 'sm' }),
        StatBlock({
          value: speedKmh > 0 ? speedKmh.toFixed(1) : '—',
          unit: speedKmh > 0 ? 'km/h' : '', label: '평균 속도', size: 'sm',
        }),
      ], 2),
    ]);
  }

  /** 산행 — 코스 위 진행률이 주인공이다. */
  function hikeCard({ title, subtitle, progress, elapsedMin, etaMin }) {
    const ratio = progress?.ratio ?? 0;
    return el('div', { class: 'card stack stack--4' }, [
      el('div', { class: 'stack stack--1' }, [
        el('p', { class: 't-label', text: subtitle }),
        el('h1', { class: 't-title', text: title }),
      ]),
      el('div', { class: 'stack stack--2' }, [
        el('div', { class: 'row row--between row--baseline' }, [
          el('span', { class: 't-caption', text: progress
            ? `${km(progress.alongM / 1000)} / ${km(progress.totalM / 1000)} km`
            : '위치 확인 중' }),
          el('span', { class: 't-caption t-accent', text: `${Math.round(ratio * 100)}%` }),
        ]),
        el('div', { class: 'meter' }, [
          el('div', { class: 'meter__fill', style: { width: `${ratio * 100}%` } }),
        ]),
      ]),
      StatGrid([
        StatBlock({ value: clock(elapsedMin), unit: 'h', label: '경과 시간', size: 'sm' }),
        StatBlock({
          value: progress ? km(progress.remainingM / 1000) : '—',
          unit: 'km', label: '남은 거리', size: 'sm',
        }),
        StatBlock({
          value: etaMin === null ? '—' : clock(etaMin),
          unit: etaMin === null ? '' : 'h', label: '남은 시간', size: 'sm',
        }),
      ], 3),
    ]);
  }

  function waypointCard({ progress, next, passed }) {
    return el('div', { class: 'card stack stack--3' }, [
      el('h2', { class: 't-title', text: '지점 안내' }),
      passed && waypointRow('지나온 지점', passed, progress, 'passed'),
      next
        ? waypointRow('다음 지점', next, progress, 'next')
        : el('p', { class: 't-caption', text: '마지막 지점에 가까워졌습니다.' }),
    ]);
  }

  function waypointRow(label, segment, progress, kind) {
    // 트랙 위 거리(alongM)로 계산한다. 구간에 적힌 cumDistanceKm와는 자가 다르다.
    const deltaKm = ((segment.alongM ?? 0) - (progress?.alongM ?? 0)) / 1000;

    return el('div', { class: ['track__wp', `track__wp--${kind}`] }, [
      el('span', { class: 'track__wp-dot' }),
      el('div', { class: 'track__wp-body' }, [
        el('span', { class: 't-label', text: label }),
        el('span', { class: 't-body-strong', text: segment.name }),
        segment.note && el('span', { class: 't-caption', text: segment.note }),
      ]),
      el('span', { class: 'track__wp-dist', text: kind === 'next' && deltaKm > 0 ? `${km(deltaKm)} km` : '' }),
    ]);
  }

  function statusBanner({ walk, progress, weakSignal, lastError, following }) {
    if (lastError) {
      return banner('warn', lastError.message);
    }
    // 걷기에는 따라갈 코스가 없다. 이탈이라는 개념 자체가 없다.
    if (walk) {
      if (weakSignal) return banner('info', '위치 신호가 약합니다. 거리에 오차가 있을 수 있습니다.');
      if (!following) return banner('info', '지도를 직접 움직였습니다. 아래 버튼으로 내 위치로 돌아갑니다.');
      return banner('ok', '걸은 길을 기록하고 있습니다.');
    }
    if (!progress) {
      return banner('info', '위치를 확인하고 있습니다. 하늘이 트인 곳에서 더 빨리 잡힙니다.');
    }
    if (progress.offTrack) {
      return banner('warn', `코스에서 ${Math.round(progress.offTrackM)}m 벗어났습니다. 경로를 확인해 주세요.`);
    }
    if (weakSignal) {
      return banner('info', '위치 신호가 약합니다. 표시된 위치에 오차가 있을 수 있습니다.');
    }
    if (!following) {
      return banner('info', '지도를 직접 움직였습니다. 아래 버튼으로 내 위치로 돌아갈 수 있습니다.');
    }
    return banner('ok', '코스를 따라 이동 중입니다.');
  }

  function banner(tone, text) {
    return el('div', { class: ['track__banner', `track__banner--${tone}`] }, [
      el('span', { class: 'track__banner-dot' }),
      el('span', { text }),
    ]);
  }

  function confirmStop() {
    const snapshot = services.tracking.getSnapshot();
    if (!snapshot) return;

    const kind = snapshot.walk ? '걷기' : '산행';
    const content = el('div', { class: 'stack stack--5' }, [
      el('p', { class: 't-body t-mute', text: `지금까지의 시간과 거리를 ${kind} 기록으로 저장합니다.` }),
      el('div', { class: 'card card--flat stack stack--3' }, [
        summaryRow('출발', formatTime(snapshot.session.startedAt)),
        summaryRow('종료', formatTime(new Date().toISOString())),
        summaryRow('총 소요시간', duration(snapshot.elapsedMin)),
        summaryRow(snapshot.walk ? '걸은 거리' : '이동 거리', `${km(snapshot.traveledM / 1000)} km`),
      ]),
      el('div', { class: 'stack stack--2' }, [
        Button({
          label: '기록으로 저장하고 종료',
          variant: 'primary', block: true, size: 'lg',
          onClick: async () => {
            close();
            await stopAndGo(true);
          },
        }),
        Button({
          label: '저장하지 않고 종료',
          variant: 'ghost', block: true,
          onClick: async () => {
            if (!window.confirm(`이번 ${kind} 기록이 저장되지 않고 사라집니다. 종료할까요?`)) return;
            close();
            await stopAndGo(false);
          },
        }),
      ]),
    ]);

    const close = openSheet({ title: `${kind} 종료`, content });
  }

  async function stopAndGo(save) {
    const result = await services.tracking.stop({ save });
    if (!result.ok) {
      // 저장에 실패해도 세션은 살아 있다. 그 사실을 분명히 알린다.
      window.alert(
        `${result.error.message}\n\n기록은 아직 진행 중입니다. 다시 시도해 주세요.`,
      );
      return;
    }
    navigate(save && result.value.record ? `/records/${result.value.record.id}` : '/records');
  }

  function summaryRow(label, value) {
    return el('div', { class: 'row row--between' }, [
      el('span', { class: 't-caption', text: label }),
      el('span', { class: 't-body-strong', text: value }),
    ]);
  }

  function onSnapshot(snapshot) {
    if (!snapshot) {
      // 다른 곳에서 종료된 경우.
      navigate('/records');
      return;
    }
    buildOnce(snapshot);
    applyToMap(snapshot);
    renderPanel();
  }

  // 진행 중인 세션이 없으면 안내 화면을 띄울 이유가 없다.
  const current = services.tracking.getSnapshot();
  if (!current) {
    mount(container, el('div', { class: 'page' }, [
      EmptyState({
        title: '진행 중인 활동이 없습니다',
        description: '홈에서 ‘운동(걷기) 기록하기’ 또는 코스 화면의 ‘이 코스로 안내받기’로 시작합니다.',
        iconName: 'route',
        actionLabel: '명산 둘러보기',
        onAction: () => navigate('/mountains'),
      }),
    ]));
  } else {
    mount(container, el('div', { class: 'page' }, [Skeleton({ variant: 'block', height: '320px' })]));
    onSnapshot(current);
    // 경과 시간은 위치와 무관하게 흐른다. 1초마다 패널만 다시 그린다.
    ticker = setInterval(renderPanel, 1000);
  }

  // 셸 갱신을 여기서 다시 하지 않는다. bootstrap의 onBeforeRender가 이미 제목과
  // trackingOpen 플래그를 설정했고, 여기서 덮어쓰면 그 플래그가 지워져
  // 안내 화면 위에 진행 중 알림 바가 겹쳐 뜬다.

  const unsubscribe = services.tracking.subscribe(onSnapshot);

  return onDestroy(container, () => {
    unsubscribe();
    if (ticker) clearInterval(ticker);
    mapHandle?.destroy();
    mapHandle = null;
  });
}

function formatTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}
