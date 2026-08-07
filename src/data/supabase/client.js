/**
 * data/supabase/client.js — supabase-js 클라이언트 단일 인스턴스.
 *
 * 빌드 도구가 없으므로 CDN에서 ESM으로 가져온다.
 * container.js가 동적 import로 이 모듈을 부르므로, static 모드에서는 내려받지도 않는다.
 *
 * anon key가 정적 파일에 노출되는 것은 설계상 정상이다.
 * 실제 방어선은 Postgres RLS다 (supabase/migrations/0002_rls.sql).
 */

const SUPABASE_ESM = 'https://esm.sh/@supabase/supabase-js@2';

let client = null;

/**
 * @param {{ url: string, anonKey: string }} settings
 * @returns {Promise<object>} SupabaseClient
 */
export async function getSupabaseClient({ url, anonKey }) {
  if (client) return client;

  const { createClient } = await import(/* @vite-ignore */ SUPABASE_ESM);

  client = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // 소셜 로그인 후 리디렉션으로 돌아왔을 때 URL의 토큰을 세션으로 바꾼다.
      detectSessionInUrl: true,
      // 해시 라우터를 쓰므로 OAuth 응답도 해시로 온다.
      flowType: 'pkce',
    },
  });

  return client;
}

/** 테스트·핫리로드 정리용 */
export function resetClient() {
  client = null;
}
