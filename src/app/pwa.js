/**
 * app/pwa.js — 홈 화면 설치 지원.
 *
 * index.html에 스크립트 로직을 두지 않는 규칙을 지키려고 여기로 분리했다.
 *
 * 서비스 워커는 보안 컨텍스트(HTTPS 또는 localhost)에서만 등록된다.
 * 폰에서 http://192.168.x.x 로 접속하면 등록되지 않고 설치도 되지 않는다 —
 * 그건 브라우저의 규칙이라 우회할 방법이 없다. 자세한 내용은 docs/INSTALL.md.
 */

/** 서비스 워커 경로. index.html 기준 상대 경로라 하위 경로 배포에서도 맞는다. */
const SW_URL = './sw.js';

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  // 보안 컨텍스트가 아니면 등록 자체가 예외를 던진다. 조용히 넘긴다.
  if (!window.isSecureContext) {
    console.info('[pwa] HTTPS(또는 localhost)가 아니어서 앱 설치·오프라인 기능이 꺼집니다.');
    return;
  }

  // 첫 화면이 그려진 뒤에 등록한다. 등록이 초기 로딩과 대역폭을 다투지 않게.
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(SW_URL).catch((cause) => {
      console.warn('[pwa] 서비스 워커 등록 실패', cause);
    });
  });

  /**
   * 새 워커가 제어권을 가져가면 화면을 한 번 새로 고친다.
   * 그러지 않으면 코드는 갱신됐는데 화면은 옛것이 남아,
   * "고쳤는데 폰에서는 그대로"라는 가장 헷갈리는 상황이 된다.
   */
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
}

/**
 * 안드로이드 크롬의 설치 배너를 붙잡아 둔다.
 *
 * 브라우저는 조건이 맞을 때 한 번만 이 이벤트를 준다. 그때 잡아두지 않으면
 * 나중에 '앱 설치' 버튼을 눌러도 띄울 방법이 없다.
 * iOS 사파리에는 이 이벤트가 없다 — 공유 메뉴로 직접 추가해야 한다.
 */
let deferredPrompt = null;
const listeners = new Set();

export function watchInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (event) => {
    // 기본 배너를 막고 우리가 원하는 시점에 띄운다.
    event.preventDefault();
    deferredPrompt = event;
    notify();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
}

function notify() {
  for (const listener of Array.from(listeners)) listener(canInstall());
}

/** 설치 버튼을 보여줄 수 있는 상태인가. */
export function canInstall() {
  return deferredPrompt !== null;
}

/** 이미 홈 화면에서 실행 중인가. 설치 안내를 숨길 때 쓴다. */
export function isInstalled() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS 사파리는 display-mode 대신 이 값을 쓴다.
    window.navigator.standalone === true
  );
}

/** @returns {Promise<'accepted'|'dismissed'|'unavailable'>} */
export async function promptInstall() {
  if (!deferredPrompt) return 'unavailable';

  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;

  // 이벤트는 한 번만 쓸 수 있다.
  deferredPrompt = null;
  notify();
  return outcome;
}

/** 설치 가능 여부가 바뀌면 알린다. 해제 함수를 돌려준다. */
export function onInstallAvailability(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** iOS 사파리인가. 설치 방법이 달라 안내 문구를 바꿔야 한다. */
export function isIosSafari() {
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) ||
    // 아이패드는 데스크톱으로 위장하므로 터치 지원으로 판별한다.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return isIos && isSafari;
}
