/**
 * app/router.js — 해시 라우터 엔진.
 *
 * 해시를 쓰는 이유: GitHub Pages는 저장소 하위 경로(/repo/)로 배포되고
 * SPA 폴백 설정이 없다. 해시 라우팅이면 서버 설정 없이 어디에 올려도 동작한다.
 *
 * 이 파일은 어떤 화면이 있는지 모른다 — 경로 매칭과 생명주기만 책임진다.
 */

import { mount } from '../core/dom.js';

/**
 * @typedef {{ path: string, view: (ctx: object) => Node }} Route
 */

/**
 * @param {{
 *   routes: Route[],
 *   outlet: HTMLElement,
 *   context?: object,
 *   guard?: (route: Route, pathname: string) => string|null,
 *   onBeforeRender?: (route: Route, params: object) => void
 * }} options
 *
 * guard는 화면을 그리기 전에 불린다. 경로 문자열을 돌려주면 그쪽으로 보내고,
 * null이면 그대로 진행한다. 로그인 게이트가 여기에 붙는다.
 */
export function createRouter({ routes, outlet, context = {}, guard, onBeforeRender }) {
  const compiled = routes.map((route) => ({ ...route, matcher: compile(route.path) }));
  let current = null;

  function parseHash() {
    const raw = window.location.hash.slice(1) || '/';
    const [pathname, search = ''] = raw.split('?');
    return {
      pathname: pathname.startsWith('/') ? pathname : `/${pathname}`,
      query: Object.fromEntries(new URLSearchParams(search)),
    };
  }

  function resolve(pathname) {
    for (const route of compiled) {
      const params = route.matcher(pathname);
      if (params) return { route, params };
    }
    return null;
  }

  function render() {
    const { pathname, query } = parseHash();
    const matched = resolve(pathname);

    if (!matched) {
      navigate('/');
      return;
    }

    const { route, params } = matched;

    // 들여보내도 되는지 먼저 확인한다. 막히면 화면을 만들지 않고 다른 곳으로 보낸다.
    const redirect = guard?.(route, pathname);
    if (redirect) {
      // replace를 쓴다. 뒤로 가기를 눌렀을 때 막힌 화면으로 되돌아가면
      // 다시 튕겨나가 무한히 오가게 된다.
      navigate(redirect, { replace: true });
      return;
    }

    current = { route, params, query };

    onBeforeRender?.(route, params);

    // mount()가 이전 화면의 destroy()를 호출해 구독을 정리한다.
    mount(outlet, route.view({ ...context, params, query, navigate, back }));
    window.scrollTo({ top: 0 });
  }

  function navigate(path, { replace = false } = {}) {
    const target = `#${path.startsWith('/') ? path : `/${path}`}`;
    if (window.location.hash === target) {
      render();
      return;
    }
    if (replace) window.location.replace(target);
    else window.location.hash = target;
  }

  function back() {
    if (window.history.length > 1) window.history.back();
    else navigate('/');
  }

  function start() {
    window.addEventListener('hashchange', render);
    if (!window.location.hash) window.location.replace('#/');
    else render();
  }

  return { start, navigate, back, render, getCurrent: () => current };
}

/**
 * '/mountains/:id' → 경로를 받아 파라미터 객체 또는 null을 돌려주는 함수.
 * 정규식 대신 세그먼트 비교를 쓴다 — 경로에 한글이 섞여도 안전하다.
 */
function compile(pattern) {
  const patternParts = pattern.split('/').filter(Boolean);

  return (pathname) => {
    const pathParts = pathname.split('/').filter(Boolean);
    if (pathParts.length !== patternParts.length) return null;

    const params = {};
    for (let i = 0; i < patternParts.length; i += 1) {
      const seg = patternParts[i];
      if (seg.startsWith(':')) {
        params[seg.slice(1)] = decodeURIComponent(pathParts[i]);
      } else if (seg !== pathParts[i]) {
        return null;
      }
    }
    return params;
  };
}
