/**
 * data/supabase/auth.gateway.js — AuthGateway Supabase 구현.
 *
 * ★ 익명 로그인을 쓰지 않는다.
 *   다중 사용자 서비스이므로 기록은 반드시 계정에 귀속되어야 한다.
 *   Supabase 대시보드에서도 Anonymous sign-ins를 꺼두는 편이 안전하다.
 *
 * 읽기(산·코스·배지 마스터)는 anon key로 로그인 없이 가능하다 — RLS의 select 정책이 공개다.
 * 쓰기는 auth.uid()가 있어야 통과하므로, 로그인하지 않으면 DB 차원에서 막힌다.
 * 즉 화면의 로그인 게이트를 우회하더라도 데이터는 안전하다.
 *
 * ⚠ 네이버는 Supabase 기본 제공 provider가 아니다 (카카오·구글은 기본 지원).
 *   Edge Function 브릿지가 필요하며, 그 URL이 설정되지 않으면 명확한 실패를 돌려준다.
 *   중요한 것은 이 차이가 어댑터 안에 갇힌다는 점이다 — 포트 계약도 화면도 바뀌지 않는다.
 *
 * @implements {import('../../domain/ports/authGateway.js').AuthGateway}
 */

import { ok, err, ErrorCode } from '../../core/result.js';
import { isAuthenticatedSession } from '../../domain/ports/authGateway.js';

/** Supabase가 기본 제공하는 provider */
const NATIVE_PROVIDERS = new Set(['kakao', 'google']);

/**
 * @param {object} client
 * @param {{ naverBridgeUrl?: string }} [settings]
 */
export function createSupabaseAuthGateway(client, settings = {}) {
  let session = null;
  const listeners = new Set();

  function toSession(supabaseSession) {
    const user = supabaseSession?.user;
    if (!user) return null;

    // 익명 사용자로 만들어진 세션은 기록에 쓸 수 없다. 그대로 표시해 걸러지게 한다.
    const identity = user.identities?.find((i) => i.provider !== 'anonymous') ?? user.identities?.[0];
    const provider = identity?.provider === 'anonymous' ? null : (identity?.provider ?? null);

    return {
      userId: user.id,
      isAnonymous: Boolean(user.is_anonymous),
      provider,
      displayName:
        user.user_metadata?.name ??
        user.user_metadata?.full_name ??
        user.email ??
        null,
    };
  }

  function emit() {
    for (const listener of Array.from(listeners)) listener(session);
  }

  // 소셜 로그인 리디렉션으로 돌아왔을 때, 토큰 교환이 끝나면 여기로 알림이 온다.
  client.auth.onAuthStateChange((_event, supabaseSession) => {
    session = toSession(supabaseSession);
    emit();
  });

  /** OAuth 후 돌아올 주소. 해시와 쿼리를 떼어 저장소 하위 경로 배포에서도 맞게 만든다. */
  function redirectTo() {
    return `${window.location.origin}${window.location.pathname}`;
  }

  return {
    async ensureSession() {
      const { data, error } = await client.auth.getSession();
      if (error) return toErr(error, '세션 확인');

      // 저장된 세션만 복구한다. 없으면 없는 대로 둔다 — 익명 세션을 만들지 않는다.
      session = toSession(data.session);
      emit();
      return ok(session);
    },

    getSession: () => session,

    isAuthenticated: () => isAuthenticatedSession(session),

    async signIn(provider) {
      if (provider === 'naver') {
        if (!settings.naverBridgeUrl) {
          return err(
            ErrorCode.UNAUTHORIZED,
            '네이버 로그인은 아직 설정되지 않았습니다. Supabase 기본 제공 provider가 아니라 Edge Function 브릿지가 필요합니다.',
          );
        }
        const url = new URL(settings.naverBridgeUrl);
        url.searchParams.set('redirect_to', redirectTo());
        window.location.assign(url.toString());
        return ok(null);
      }

      if (!NATIVE_PROVIDERS.has(provider)) {
        return err(ErrorCode.VALIDATION, `지원하지 않는 로그인 수단입니다: ${provider}`);
      }

      const { error } = await client.auth.signInWithOAuth({
        provider,
        options: { redirectTo: redirectTo() },
      });

      if (error) return toErr(error, '로그인');

      // 여기 도달하면 곧 리디렉션이 일어난다. 결과는 onAuthStateChange로 온다.
      return ok(null);
    },

    async signOut() {
      const { error } = await client.auth.signOut();
      if (error) return toErr(error, '로그아웃');

      // 로그아웃하면 세션이 없는 상태로 돌아간다. 익명 세션을 새로 만들지 않는다.
      session = null;
      emit();
      return ok(null);
    },

    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function toErr(error, what) {
  return err(ErrorCode.UNAUTHORIZED, `${what}에 실패했습니다. (${error.message})`, error);
}
