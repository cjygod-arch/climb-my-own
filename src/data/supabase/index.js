/**
 * data/supabase/index.js — Supabase 어댑터 묶음.
 *
 * container.js가 동적 import로 이 파일 하나만 부른다.
 * static 모드에서는 이 모듈도, supabase-js도 내려받지 않는다.
 */

import { getSupabaseClient } from './client.js';
import { createSupabaseAuthGateway } from './auth.gateway.js';
import { createSupabaseMountainRepository } from './mountain.repo.js';
import { createSupabaseCourseRepository } from './course.repo.js';
import { createSupabaseRecordRepository } from './record.repo.js';
import { createSupabaseBadgeRepository } from './badge.repo.js';

/**
 * @param {{ url: string, anonKey: string, naverBridgeUrl?: string }} settings
 */
export async function createSupabaseAdapters(settings) {
  const client = await getSupabaseClient(settings);

  const auth = createSupabaseAuthGateway(client, settings);
  // 세션은 부팅 시 ensureSession()으로 채워진다. 리포지토리는 호출 시점에 읽는다.
  const getUserId = () => auth.getSession()?.userId ?? null;

  return {
    auth,
    mountainRepo: createSupabaseMountainRepository(client),
    courseRepo: createSupabaseCourseRepository(client, { getUserId }),
    recordRepo: createSupabaseRecordRepository(client, { getUserId }),
    badgeRepo: createSupabaseBadgeRepository(client, { getUserId }),
  };
}
