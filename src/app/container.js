/**
 * app/container.js — 포트 ↔ 어댑터 결선.
 *
 * ★ 저장 방식을 교체할 때 수정되는 유일한 파일이다.
 *   features/ 도 domain/ 도 여기를 import 하지 않는다.
 *   반대로 여기는 모든 계층을 알아도 된다 — 조립이 이 파일의 유일한 책임이다.
 *
 * 서비스 인스턴스도 여기서 만들어 화면에 주입한다(생성자 주입).
 * 화면이 컨테이너를 직접 조회하지 않게 해서, 프레임워크 이행 시 주입 방식만 바꾸면 되도록 했다.
 */

import { config, DataSource, isSupabaseConfigured } from './config.js';

import { createStaticMountainRepository } from '../data/static/mountain.repo.js';
import { createStaticCourseRepository } from '../data/static/course.repo.js';
import { createStaticBadgeRepository } from '../data/static/badge.repo.js';
import { createLocalRecordRepository } from '../data/local/record.repo.js';
import { createLocalSessionRepository } from '../data/local/session.repo.js';
import { createLocalAuthGateway } from '../data/local/auth.gateway.js';
import { createBrowserLocationGateway } from '../data/browser/location.gateway.js';

import { createMountainsService } from '../features/mountains/mountains.service.js';
import { createCoursesService } from '../features/courses/courses.service.js';
import { createRecordsService } from '../features/records/records.service.js';
import { createBadgesService } from '../features/badges/badges.service.js';
import { createHomeService } from '../features/home/home.service.js';
import { createProfileService } from '../features/profile/profile.service.js';
import { createTrackingService } from '../features/tracking/tracking.service.js';

/**
 * 어댑터 묶음을 만든다. 여기가 분기의 전부다.
 * @returns {Promise<{ auth, mountainRepo, courseRepo, recordRepo, badgeRepo, source: string }>}
 */
async function createAdapters() {
  const useSupabase = config.DATA_SOURCE === DataSource.SUPABASE;

  if (useSupabase && !isSupabaseConfigured()) {
    // 설정이 비어 있으면 앱을 죽이지 않고 정적 모드로 내려간다.
    console.warn('[container] Supabase 설정이 비어 있어 static 모드로 전환합니다.');
  }

  if (useSupabase && isSupabaseConfigured()) {
    // 13단계에서 채운다. 동적 import라 static 모드에서는 파일을 내려받지도 않는다.
    const { createSupabaseAdapters } = await import('../data/supabase/index.js');
    const remote = await createSupabaseAdapters(config.supabase);
    const getRemoteUserId = () => remote.auth.getSession()?.userId ?? null;
    return {
      ...remote,
      // 세션·위치는 원격 모드에서도 로컬·브라우저를 쓴다(위 주석 참조).
      sessionRepo: createLocalSessionRepository({ getUserId: getRemoteUserId }),
      locationGateway: createBrowserLocationGateway({ now: config.now }),
      source: DataSource.SUPABASE,
    };
  }

  const auth = createLocalAuthGateway();
  const getUserId = () => auth.getSession()?.userId ?? null;
  const now = config.now;

  return {
    auth,
    mountainRepo: createStaticMountainRepository(),
    courseRepo: createStaticCourseRepository({ getUserId }),
    recordRepo: createLocalRecordRepository({ getUserId, now }),
    badgeRepo: createStaticBadgeRepository({ getUserId, now }),
    // 세션과 위치는 저장소 종류와 무관하게 항상 로컬·브라우저를 쓴다.
    // 세션은 기기 상태이고, 위치는 브라우저만이 줄 수 있다.
    sessionRepo: createLocalSessionRepository({ getUserId }),
    locationGateway: createBrowserLocationGateway({ now }),
    source: DataSource.STATIC,
  };
}

/**
 * 앱 전체가 쓸 서비스 묶음을 만든다.
 * @returns {Promise<{ auth, services: object, source: string }>}
 */
export async function createContainer() {
  const { auth, mountainRepo, courseRepo, recordRepo, badgeRepo, sessionRepo, locationGateway, source } =
    await createAdapters();

  const mountains = createMountainsService({ mountainRepo });
  const courses = createCoursesService({ courseRepo, mountainRepo });

  // 배지 서비스는 기록·산 데이터를 함께 봐야 판정할 수 있다.
  const badges = createBadgesService({ badgeRepo, recordRepo, mountainRepo });

  // 기록 저장 후 배지 재평가는 records 서비스가 badges 서비스에 위임한다.
  // features 간 직접 import를 피하려고 여기서 주입한다 (ARCHITECTURE.md R5).
  const records = createRecordsService({ recordRepo, mountainRepo, courseRepo, badges, config });

  const home = createHomeService({ recordRepo, mountainRepo, badgeRepo, config });
  const profile = createProfileService({ auth, recordRepo, badgeRepo });

  // 안내는 코스·기록 서비스를 조율한다. 종료 시 records를 통해 저장하므로
  // 배지 재평가도 자동으로 따라온다.
  const tracking = createTrackingService({
    auth, sessionRepo, locationGateway, coursesService: courses, recordsService: records, config,
  });

  return {
    auth,
    source,
    services: { mountains, courses, records, badges, home, profile, tracking },
  };
}
