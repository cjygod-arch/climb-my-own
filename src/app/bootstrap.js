/**
 * app/bootstrap.js — 부팅 순서.
 *
 * 설정 → 컨테이너 결선 → 세션 확보 → 셸 마운트 → 라우터 시작.
 * 이 순서는 의존 관계상 바꿀 수 없다. 세션이 없으면 어떤 저장소도 사용자 데이터를 못 읽는다.
 */

import { el, mount } from '../core/dom.js';
import { createContainer } from './container.js';
import { createRouter } from './router.js';
import { routes } from './routes.js';
import { AppShell } from './shell/AppShell.js';
import { registerBadgeNotifier } from '../features/badges/badges.notifier.js';
import { TrackingBar } from '../features/tracking/ui/TrackingBar.js';
import { registerServiceWorker, watchInstallPrompt } from './pwa.js';

export async function bootstrap(mountPoint) {
  // 설치 배너 이벤트는 부팅 도중에도 올 수 있다. 앱 조립보다 먼저 붙잡아 둔다.
  watchInstallPrompt();

  try {
    const { auth, services, source } = await createContainer();

    // 익명 세션이라도 확보되어야 기록 저장·배지 판정이 RLS 안에서 동작한다.
    const session = await auth.ensureSession();
    if (!session.ok) {
      renderBootError(mountPoint, session.error.message);
      return;
    }

    // 배지 획득 알림은 화면과 무관하게 앱 전역에서 한 번만 등록한다.
    // 이렇게 해야 기록 저장 화면이 배지 기능을 직접 호출하지 않는다 (ARCHITECTURE.md R5).
    registerBadgeNotifier();

    const shell = AppShell();
    mount(mountPoint, shell.root);
    mountPoint.setAttribute('aria-busy', 'false');
    document.documentElement.dataset.source = source;

    const router = createRouter({
      routes,
      outlet: shell.outlet,
      context: { services, auth, shell },
      /**
       * 로그인 게이트. 기록 화면은 로그인해야 들어갈 수 있다.
       * 화면마다 따로 검사하면 반드시 하나를 빠뜨리므로 여기 한 곳에서 막는다.
       * 돌아갈 경로를 next로 넘겨, 로그인하면 하던 일을 이어서 할 수 있게 한다.
       */
      guard: (route, pathname) => {
        if (!route.requiresAuth || auth.isAuthenticated()) return null;
        return `/login?next=${encodeURIComponent(pathname)}`;
      },
      onBeforeRender: (route) => {
        shell.update(
          {
            title: route.title ?? '',
            tab: route.tab ?? null,
            chrome: route.chrome ?? 'shell',
            back: Boolean(route.back),
            trackingOpen: route.path === '/tracking',
          },
          () => router.back(),
        );
        shell.setHeaderAction(null);
        document.title = route.title ? `${route.title} · Climb My Own` : 'Climb My Own';
      },
    });

    // 진행 중이던 활동이 있으면 이어서 감시한다.
    // 산행은 몇 시간씩 걸리므로 새로고침이나 앱 재진입은 정상 상황이다.
    // 로그인하지 않았다면 서비스가 알아서 건너뛴다.
    services.tracking.resume().catch((cause) => {
      console.error('[bootstrap] 산행 세션 복구 실패', cause);
    });

    shell.setTrackingBar(
      TrackingBar({ tracking: services.tracking, onOpen: () => router.navigate('/tracking') }),
    );

    router.start();

    // 화면이 뜬 뒤에 등록한다. 초기 로딩과 대역폭을 다투지 않게.
    registerServiceWorker();
  } catch (cause) {
    console.error('[bootstrap] 부팅 실패', cause);
    renderBootError(mountPoint, cause?.message ?? '알 수 없는 오류');
  }
}

function renderBootError(mountPoint, message) {
  mountPoint.setAttribute('aria-busy', 'false');

  // file:// 안내는 실제로 file://로 열었을 때만 보여준다.
  // 원인과 무관한 힌트를 항상 붙이면 진짜 원인을 가린다.
  const isFileProtocol = window.location.protocol === 'file:';

  mount(
    mountPoint,
    el('div', { class: 'boot-error stack stack--3' }, [
      el('h1', { class: 't-display', text: '앱을 시작하지 못했습니다' }),
      el('p', { class: 't-body t-mute', text: message }),
      isFileProtocol &&
        el('p', {
          class: 't-caption',
          text: 'ES6 모듈은 file:// 에서 차단됩니다. 정적 서버(python -m http.server)로 열어 주세요.',
        }),
      el('button', {
        class: 'btn btn--ghost',
        type: 'button',
        text: '다시 시도',
        onClick: () => window.location.reload(),
      }),
    ]),
  );
}
