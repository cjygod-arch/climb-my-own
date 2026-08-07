/**
 * features/profile/ui/LoginPage.js — 로그인.
 *
 * 화면(라우트)으로 만든 이유:
 * 기록 화면들이 로그인을 요구할 때 여기로 보내야 하는데, 시트로 만들면
 * 각 기능이 profile 기능을 직접 import 해야 한다 (ARCHITECTURE.md R5).
 * 라우터가 경로로 보내면 아무도 서로를 알 필요가 없다.
 *
 * ?next=<경로> 로 돌아갈 곳을 받는다. 로그인하면 하던 일을 이어서 할 수 있다.
 *
 * 허용 수단은 카카오·구글·네이버 셋뿐이다 (domain/ports/authGateway.js의 PROVIDERS).
 * 브랜드 컬러를 쓰지 않는다 — 무채색 + 액센트 1색 원칙을 지키려고
 * 세 버튼을 같은 형태로 두고 이름으로만 구분한다.
 */

import { el, mount, onDestroy } from '../../../core/dom.js';
import { Button } from '../../../shared/ui/Button.js';
import { icon } from '../../../shared/ui/icons/index.js';
import { PROVIDERS } from '../../../domain/ports/authGateway.js';

/** 로그인 후 돌아갈 곳으로 쓸 수 있는 경로인가. 외부 주소로 튕겨나가지 않게 막는다. */
function safeNext(next) {
  if (typeof next !== 'string' || !next.startsWith('/')) return '/';
  if (next.startsWith('//')) return '/';
  return next;
}

export function LoginPage({ services, query, navigate }) {
  const container = el('div', { class: 'page' });
  const next = safeNext(query.next);

  let busy = null;
  const message = el('p', { class: 'login__error t-caption', hidden: true });

  async function signIn(provider) {
    if (busy) return;
    busy = provider;
    message.hidden = true;
    render();

    const result = await services.profile.signIn(provider);

    // 소셜 로그인은 리디렉션으로 넘어가므로 여기로 돌아오지 않을 수 있다.
    if (!result.ok) {
      busy = null;
      message.textContent = result.error.message;
      message.hidden = false;
      render();
      return;
    }

    // 리디렉션 없이 즉시 로그인된 경우(개발용 어댑터)만 여기까지 온다.
    if (services.profile.isAuthenticated()) {
      navigate(next, { replace: true });
      return;
    }
    busy = null;
    render();
  }

  function render() {
    mount(
      container,
      el('div', { class: 'stack stack--6' }, [
        el('header', { class: 'login__head stack stack--3' }, [
          el('span', { class: 'login__mark' }, [icon('peak', { size: 32 })]),
          el('div', { class: 'stack stack--1' }, [
            el('h1', { class: 't-display', text: '기록하려면 로그인해 주세요' }),
            el('p', {
              class: 't-body t-mute',
              text: '산행과 걷기 기록은 계정에 저장됩니다. 기기를 바꿔도 그대로 남고, 배지도 이어집니다.',
            }),
          ]),
        ]),

        el('div', { class: 'stack stack--3' },
          PROVIDERS.map((provider) =>
            Button({
              label: busy === provider.id ? '연결 중' : provider.label,
              variant: 'ghost',
              block: true,
              size: 'lg',
              disabled: Boolean(busy),
              onClick: () => signIn(provider.id),
            }),
          ),
        ),

        message,

        el('div', { class: 'card card--flat stack stack--2' }, [
          el('p', { class: 't-label', text: '로그인 없이도 볼 수 있어요' }),
          el('p', {
            class: 't-caption',
            text: '100대 명산 소개, 등산 코스, 구간 안내와 지도는 로그인하지 않아도 이용할 수 있습니다.',
          }),
          Button({
            label: '둘러보기',
            variant: 'quiet',
            onClick: () => navigate('/mountains'),
          }),
        ]),
      ]),
    );
  }

  // 이미 로그인했다면 이 화면에 머무를 이유가 없다.
  if (services.profile.isAuthenticated()) {
    navigate(next, { replace: true });
  } else {
    render();
  }

  // 리디렉션으로 돌아와 세션이 붙는 순간 원래 가려던 곳으로 보낸다.
  const off = services.profile.onSessionChange(() => {
    if (services.profile.isAuthenticated()) navigate(next, { replace: true });
  });

  return onDestroy(container, off);
}
