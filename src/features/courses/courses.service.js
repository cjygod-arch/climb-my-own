/**
 * features/courses/courses.service.js — 코스 유스케이스.
 *
 * 저장소가 비워 보낸 값을 도메인 규칙으로 보완하는 책임이 여기 있다.
 * (소요 시간이 없으면 추정, 상승고도가 없으면 구간에서 계산)
 * 어댑터가 계산하면 저장소마다 결과가 달라진다 — 계산은 반드시 도메인 쪽에 둔다.
 */

import { ok } from '../../core/result.js';
import { createCourse } from '../../domain/entities/course.js';
import { estimateDurationMin, difficultyOf } from '../../domain/rules/difficulty.js';
import { totalAscentM, totalDistanceKm, toProfile } from '../../domain/rules/elevationProfile.js';
import { pathOf } from '../../domain/rules/coursePath.js';

export function createCoursesService({ courseRepo, mountainRepo }) {
  /** 비어 있는 파생값을 채운다. 실측값이 있으면 건드리지 않는다. */
  function enrich(course) {
    const distanceKm = course.distanceKm || totalDistanceKm(course.segments);
    const ascentM = course.ascentM || totalAscentM(course.segments);
    return {
      ...course,
      distanceKm,
      ascentM,
      durationMin: course.durationMin || estimateDurationMin(distanceKm, ascentM),
      difficulty: course.difficulty || difficultyOf(distanceKm, ascentM),
    };
  }

  return {
    async listByMountain(mountainId) {
      const result = await courseRepo.listByMountain(mountainId);
      return result.ok ? ok(result.value.map(enrich)) : result;
    },

    /**
     * 지도 화면용: 산의 모든 코스를 구간 좌표까지 붙여서 가져온다.
     * 목록 조회(listByMountain)는 구간을 비워 보내므로 여기서 상세를 다시 읽는다.
     */
    async getMountainMap(mountainId) {
      const [listResult, mountainResult] = await Promise.all([
        courseRepo.listByMountain(mountainId),
        mountainRepo.getById(mountainId),
      ]);
      if (!listResult.ok) return listResult;

      const details = await Promise.all(listResult.value.map((c) => courseRepo.getById(c.id)));

      const courses = details
        .filter((r) => r.ok)
        .map((r) => enrich(r.value))
        .map((course) => ({ ...course, path: pathOf(course) }));

      return ok({
        mountain: mountainResult.ok ? mountainResult.value : null,
        courses,
      });
    },

    async listMine() {
      const result = await courseRepo.listMine();
      return result.ok ? ok(result.value.map(enrich)) : result;
    },

    /** 안내 화면에 필요한 것을 한 번에: 코스 + 소속 산 + 고도 단면 좌표 */
    async getGuide(courseId) {
      const courseResult = await courseRepo.getById(courseId);
      if (!courseResult.ok) return courseResult;

      const course = enrich(courseResult.value);
      const mountainResult = await mountainRepo.getById(course.mountainId);

      return ok({
        course,
        // 산 조회가 실패해도 코스 안내는 볼 수 있어야 한다.
        mountain: mountainResult.ok ? mountainResult.value : null,
        profile: toProfile(course.segments),
        path: pathOf(course),
      });
    },

    /**
     * 내 코스 저장. 파생값을 채운 뒤 넘긴다 —
     * 어떤 어댑터가 받든 같은 값이 저장되도록.
     */
    save(draft) {
      return courseRepo.save(enrich(createCourse({ ...draft, isOfficial: false })));
    },

    remove: (id) => courseRepo.remove(id),
  };
}
