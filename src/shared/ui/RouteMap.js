/**
 * shared/ui/RouteMap.js — 등산로 지도.
 *
 * 도메인을 모른다. 좌표 배열만 받아 선을 긋는다 (ARCHITECTURE.md R4).
 * 코스 → 좌표 변환은 domain/rules/coursePath.js 가 한다.
 *
 * 디자인 결정 (참고 앱과 갈리는 지점):
 *   - 타일을 무채색(CARTO Positron/Dark Matter)으로 쓴다. 컬러 지형도를 깔면
 *     화면 인상이 지도 앱에 먹혀 우리 톤이 사라진다.
 *   - 마커는 번호가 박힌 원형 핀. 물방울 모양 기본 마커를 쓰지 않는다.
 *   - 선택된 코스만 액센트 1색, 나머지는 무채색 점선. 여러 색으로 구분하지 않는다.
 *
 * Leaflet은 CDN에서 지연 로드한다. 지도를 열지 않으면 내려받지도 않는다.
 * 로드에 실패해도(오프라인·CDN 차단) 예외를 던지지 않고 실패를 값으로 돌려준다 —
 * 구간 안내와 고도 단면은 지도 없이도 계속 볼 수 있어야 하기 때문이다.
 */

import { el } from '../../core/dom.js';

const LEAFLET_VERSION = '1.9.4';
const LEAFLET_ESM = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet-src.esm.js`;
const LEAFLET_CSS = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css`;

const TILES = {
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
};

const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

let leafletPromise = null;

/** Leaflet과 그 스타일을 한 번만 내려받는다. */
function loadLeaflet() {
  if (leafletPromise) return leafletPromise;

  leafletPromise = (async () => {
    if (!document.querySelector(`link[data-leaflet]`)) {
      const link = el('link', { rel: 'stylesheet', href: LEAFLET_CSS, 'data-leaflet': 'true' });
      document.head.append(link);
    }
    const mod = await import(/* @vite-ignore */ LEAFLET_ESM);
    return mod.default ?? mod;
  })();

  // 실패한 약속을 캐시에 남겨두면 재시도가 영원히 막힌다.
  leafletPromise.catch(() => { leafletPromise = null; });
  return leafletPromise;
}

function token(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function prefersDark() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

/**
 * @typedef {{ id: string, index: number, label: string, points: Array<[number,number]>, markers: Array<{lat:number,lng:number,name:string}> }} MapRoute
 */

/**
 * 지도를 만든다.
 *
 * @param {HTMLElement} container 높이가 정해진 엘리먼트여야 한다
 * @param {{ routes: MapRoute[], bounds: object|null, activeId?: string|null, onSelect?: (id:string)=>void }} options
 * @returns {Promise<{ ok: true, setActive: (id:string|null)=>void, destroy: ()=>void } | { ok: false, error: Error }>}
 */
export async function createRouteMap(container, {
  routes, bounds, activeId = null, onSelect, onFollowChange = null,
}) {
  let L;
  try {
    L = await loadLeaflet();
  } catch (error) {
    return { ok: false, error };
  }

  const accent = token('--c-accent', '#1B4FD8');
  const mute = token('--c-text-mute', '#6B7280');

  const map = L.map(container, {
    zoomControl: true,
    attributionControl: true,
    scrollWheelZoom: false, // 페이지 스크롤 중에 지도가 확대되는 사고를 막는다
    tap: true,
  });

  L.tileLayer(prefersDark() ? TILES.dark : TILES.light, {
    attribution: ATTRIBUTION,
    maxZoom: 18,
    subdomains: 'abcd',
  }).addTo(map);

  const layers = new Map();

  for (const route of routes) {
    if (route.points.length < 2) continue;

    const line = L.polyline(route.points, {
      color: mute,
      weight: 3,
      opacity: 0.85,
      dashArray: '2 7',
      lineCap: 'round',  // 둥근 캡 — 픽토그램·글리프와 같은 언어를 쓴다
      lineJoin: 'round',
    }).addTo(map);

    line.on('click', () => onSelect?.(route.id));

    // 코스 번호 마커는 들머리에만. 지점 마커는 선택된 코스에만 붙는다(밀도 규칙).
    const start = route.points[0];
    const badge = L.marker(start, {
      icon: L.divIcon({
        className: 'routemap__pin-wrap',
        html: `<span class="routemap__pin" data-role="index">${route.index}</span>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      }),
      keyboard: true,
      title: route.label,
    }).addTo(map);

    badge.on('click', () => onSelect?.(route.id));

    layers.set(route.id, { line, badge, waypoints: [], route });
  }

  function clearWaypoints() {
    for (const entry of layers.values()) {
      for (const m of entry.waypoints) map.removeLayer(m);
      entry.waypoints = [];
    }
  }

  /**
   * @param {string|null} id
   * @param {{ fit?: boolean }} [options] fit=true면 선택한 코스에 화면을 맞춘다.
   *   최초 표시에서는 false로 둬야 여러 코스가 한 화면에 함께 보인다.
   */
  function setActive(id, { fit = true } = {}) {
    clearWaypoints();

    for (const [routeId, entry] of layers) {
      const active = routeId === id;
      entry.line.setStyle({
        color: active ? accent : mute,
        weight: active ? 5 : 3,
        opacity: active ? 1 : 0.55,
        dashArray: active ? null : '2 7',
      });
      if (active) entry.line.bringToFront();
      entry.badge.getElement()?.querySelector('.routemap__pin')
        ?.setAttribute('data-active', String(active));
    }

    const entry = layers.get(id);
    if (!entry) return;

    // 선택된 코스의 지점만 표시한다. 이름표는 들머리와 마지막 지점에만 붙인다 —
    // 모든 지점에 붙이면 축척이 작을 때 이름표끼리 겹쳐 읽을 수 없다.
    // 전체 지점명은 '구간 안내'가 순서대로 보여주므로 지도에서 중복할 필요가 없다.
    const last = entry.route.markers.length - 1;

    entry.waypoints = entry.route.markers.map((wp, i) => {
      const labelled = i === 0 || i === last;
      return L.marker([wp.lat, wp.lng], {
        icon: L.divIcon({
          className: 'routemap__wp-wrap',
          html:
            `<span class="routemap__wp"></span>` +
            (labelled ? `<span class="routemap__wp-label">${escapeHtml(wp.name)}</span>` : ''),
          iconSize: [10, 10],
          iconAnchor: [5, 5],
        }),
        title: wp.name,
        zIndexOffset: 500 + i,
      }).addTo(map);
    });

    if (fit && entry.line.getLatLngs().length) {
      map.fitBounds(entry.line.getBounds(), { padding: [40, 40], maxZoom: 15 });
    }
  }

  // 첫 화면은 모든 코스가 함께 보이도록 전체 경계에 맞춘다.
  // 그래야 '이 산에 코스가 몇 개 있고 어디서 갈라지는가'가 한눈에 읽힌다.
  if (bounds) {
    map.fitBounds([[bounds.south, bounds.west], [bounds.north, bounds.east]], { padding: [34, 34], maxZoom: 14 });
  } else {
    map.setView([36.5, 127.8], 7);
  }

  // fit:false — 강조만 하고 화면은 전체 보기를 유지한다.
  setActive(activeId ?? null, { fit: false });

  // 시트/탭 안에서 열리면 컨테이너 크기가 늦게 확정된다. 한 프레임 뒤 재계산.
  const raf = requestAnimationFrame(() => map.invalidateSize());

  // ── 실시간 위치 ──────────────────────────────────
  // 산행 안내 중에만 쓴다. 정확도 원 + 현재 위치 점 + 지나온 자취.
  let liveMarker = null;
  let accuracyCircle = null;
  let traveledLine = null;
  let following = true;

  /**
   * 현재 위치를 갱신한다. null이면 표시를 지운다.
   * @param {{ lat: number, lng: number, accuracy?: number }|null} fix
   */
  function setLivePosition(fix) {
    if (!fix) {
      if (liveMarker) { map.removeLayer(liveMarker); liveMarker = null; }
      if (accuracyCircle) { map.removeLayer(accuracyCircle); accuracyCircle = null; }
      return;
    }

    const latlng = [fix.lat, fix.lng];

    // 정확도 원 — 신호가 나쁘면 눈에 보이게 커진다. 사용자가 오차를 감안할 수 있어야 한다.
    if (!accuracyCircle) {
      accuracyCircle = L.circle(latlng, {
        radius: fix.accuracy ?? 0,
        color: accent, weight: 1, opacity: 0.35,
        fillColor: accent, fillOpacity: 0.12,
        interactive: false,
      }).addTo(map);
    } else {
      accuracyCircle.setLatLng(latlng).setRadius(fix.accuracy ?? 0);
    }

    if (!liveMarker) {
      liveMarker = L.marker(latlng, {
        icon: L.divIcon({
          className: 'routemap__live-wrap',
          html: '<span class="routemap__live"></span>',
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        }),
        zIndexOffset: 1000,
        interactive: false,
      }).addTo(map);
    } else {
      liveMarker.setLatLng(latlng);
    }

    if (following) map.panTo(latlng, { animate: true, duration: 0.5 });
  }

  /** 지나온 자취. 코스 선과 구분되게 굵고 반투명하게 깐다. */
  function setTraveled(points) {
    if (!points || points.length < 2) {
      if (traveledLine) { map.removeLayer(traveledLine); traveledLine = null; }
      return;
    }
    if (!traveledLine) {
      traveledLine = L.polyline(points, {
        color: accent, weight: 8, opacity: 0.25,
        lineCap: 'round', lineJoin: 'round', interactive: false,
      }).addTo(map);
      traveledLine.bringToBack();
    } else {
      traveledLine.setLatLngs(points);
    }
  }

  /** 지도를 현재 위치에 계속 맞출지. 사용자가 지도를 끌면 꺼진다. */
  function setFollow(next) { following = next; }

  // 사용자가 직접 지도를 움직이면 따라가기를 끈다 — 보려는 곳을 뺏지 않는다.
  map.on('dragstart', () => {
    following = false;
    onFollowChange?.(false);
  });

  return {
    ok: true,
    setActive,
    setLivePosition,
    setTraveled,
    setFollow,
    isFollowing: () => following,
    fitTo(points) {
      if (points?.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 16 });
    },
    destroy() {
      cancelAnimationFrame(raf);
      map.remove();
    },
  };
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
