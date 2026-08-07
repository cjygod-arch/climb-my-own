/**
 * sw.js — 서비스 워커.
 *
 * 두 가지를 위해 존재한다.
 *   1. 홈 화면 설치 자격 (설치형 앱이 되려면 서비스 워커가 있어야 한다)
 *   2. 오프라인 — 산에서는 신호가 자주 끊긴다. 이미 본 화면은 계속 볼 수 있어야 한다.
 *
 * ★ 캐시 전략을 network-first로 잡은 이유
 *   빌드 도구가 없어 파일명에 해시가 붙지 않는다. cache-first로 잡으면
 *   코드를 고쳐도 폰에서 옛 화면이 계속 뜨고, 사용자는 원인을 알 수 없다.
 *   연결이 되면 항상 새 파일을 쓰고, 안 될 때만 캐시로 떨어진다.
 *
 * 범위 주의: 이 파일은 반드시 저장소 루트에 둔다.
 * 하위 폴더에 두면 그 폴더 아래만 제어하게 되어 앱 전체를 덮지 못한다.
 */

// 파일을 고칠 때마다 올린다. 값이 바뀌면 옛 캐시가 통째로 지워진다.
const VERSION = 'v1';
const CACHE = `climb-my-own-${VERSION}`;

/**
 * 설치 직후 미리 받아둘 것. 첫 오프라인 진입에서도 앱이 뜨게 한다.
 * 상대 경로로 적어야 GitHub Pages 하위 경로 배포에서도 맞다.
 */
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './src/main.js',
  './public/data/mountains.json',
  './public/data/courses.json',
  './public/data/badges.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // 하나라도 실패하면 설치 전체가 실패한다. 개별로 담아 실패를 견딘다.
      await Promise.allSettled(PRECACHE.map((url) => cache.add(url)));
      // 새 워커가 즉시 활성화되도록 대기를 건너뛴다.
      // 그러지 않으면 모든 탭을 닫아야 새 코드가 적용된다.
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => n.startsWith('climb-my-own-') && n !== CACHE)
          .map((n) => caches.delete(n)),
      );
      // 이미 열려 있는 화면도 새 워커가 맡는다.
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // GET만 다룬다. Supabase로 가는 저장 요청을 가로채면 안 된다.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  /**
   * 다른 출처는 건드리지 않는다.
   *   지도 타일 — 캐시하면 저장 용량이 순식간에 불어난다. 브라우저 캐시에 맡긴다.
   *   Supabase  — 남의 데이터를 캐시에 남기면 로그아웃해도 남는다.
   *   CDN       — 버전이 URL에 박혀 있어 브라우저 캐시로 충분하다.
   */
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      try {
        const fresh = await fetch(request);
        // 정상 응답만 담는다. 404나 오류를 캐시하면 고쳐도 계속 실패한다.
        if (fresh.ok) {
          const cache = await caches.open(CACHE);
          cache.put(request, fresh.clone());
        }
        return fresh;
      } catch {
        // 오프라인. 캐시에 있으면 그것으로 버틴다.
        const cached = await caches.match(request);
        if (cached) return cached;

        // 화면 이동인데 캐시에도 없으면 앱 껍데기라도 띄운다.
        // 해시 라우터라 index.html만 있으면 어느 경로든 그릴 수 있다.
        if (request.mode === 'navigate') {
          const shell = await caches.match('./index.html');
          if (shell) return shell;
        }

        return new Response('오프라인입니다. 연결을 확인해 주세요.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }
    })(),
  );
});
