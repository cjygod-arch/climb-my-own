/**
 * data/static/course.repo.js — CourseRepository 정적 JSON + 로컬 저장 구현.
 *
 * 공식 코스는 읽기 전용 JSON에서, 내 코스는 localStorage에서 온다.
 * 이 이원 구조는 어댑터 안에만 존재한다 — 포트를 쓰는 쪽은 그냥 Course[] 를 받는다.
 * Supabase 어댑터에서는 같은 구분을 is_official 컬럼과 RLS가 처리한다.
 *
 * @implements {import('../../domain/ports/courseRepository.js').CourseRepository}
 */

import { ok, err, ErrorCode } from '../../core/result.js';
import { LOGIN_REQUIRED_MESSAGE } from '../../domain/ports/authGateway.js';
import { createCourse, validateCourse } from '../../domain/entities/course.js';
import { createCourseSegment } from '../../domain/entities/courseSegment.js';
import { loadItems } from './jsonSource.js';
import { createLocalTable, newId } from '../local/localTable.js';

const FILE = 'courses.json';

/**
 * @param {{ getUserId: () => string|null }} deps 세션에서 사용자 id를 얻는 함수.
 *   UI가 사용자 id를 다루지 않게 하려고 어댑터가 직접 주입받는다.
 */
export function createStaticCourseRepository({ getUserId }) {
  const table = createLocalTable('courses');

  async function officialCourses() {
    const result = await loadItems(FILE);
    if (!result.ok) return result;
    return ok(result.value.map(hydrate));
  }

  function myCourses() {
    const userId = getUserId();
    if (!userId) return [];
    return table.find((row) => row.ownerId === userId).map(hydrate);
  }

  async function combined() {
    const result = await officialCourses();
    if (!result.ok) return result;
    return ok([...result.value, ...myCourses()]);
  }

  return {
    async listByMountain(mountainId) {
      const result = await combined();
      if (!result.ok) return result;
      // 목록에서는 구간을 비워 보낸다. 상세 화면만 구간이 필요하다.
      return ok(
        result.value
          .filter((c) => c.mountainId === mountainId)
          .map((c) => ({ ...c, segments: [] })),
      );
    },

    async getById(id) {
      const result = await combined();
      if (!result.ok) return result;
      const found = result.value.find((c) => c.id === id);
      return found ? ok(found) : err(ErrorCode.NOT_FOUND, '해당 코스를 찾을 수 없습니다.');
    },

    async listMine() {
      return ok(myCourses());
    },

    async save(course) {
      const userId = getUserId();
      if (!userId) return err(ErrorCode.UNAUTHORIZED, LOGIN_REQUIRED_MESSAGE);

      const errors = validateCourse(course);
      if (errors.length) return err(ErrorCode.VALIDATION, errors[0]);

      if (course.id && course.isOfficial) {
        return err(ErrorCode.UNAUTHORIZED, '공식 코스는 수정할 수 없습니다.');
      }

      const row = {
        ...course,
        id: course.id || newId(),
        isOfficial: false,
        ownerId: userId,
        segments: course.segments.map((s, i) => ({ ...s, seq: i })),
      };

      return ok(hydrate(table.upsert(row)));
    },

    async remove(id) {
      const userId = getUserId();
      const row = table.get(id);
      if (!row) return err(ErrorCode.NOT_FOUND, '해당 코스를 찾을 수 없습니다.');
      if (row.ownerId !== userId) return err(ErrorCode.UNAUTHORIZED, '삭제 권한이 없습니다.');
      table.remove(id);
      return ok(null);
    },
  };
}

/** 원시 행 → Course 엔티티. 구간 id가 비어 있으면 코스 id + seq 로 만든다. */
function hydrate(raw) {
  const segments = (raw.segments ?? []).map((s) =>
    createCourseSegment({ ...s, id: s.id || `${raw.id}-${s.seq}`, courseId: raw.id }),
  );
  return createCourse({ ...raw, segments });
}
