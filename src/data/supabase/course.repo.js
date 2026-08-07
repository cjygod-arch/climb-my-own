/**
 * data/supabase/course.repo.js — CourseRepository Supabase 구현.
 *
 * 정적 어댑터는 '공식 JSON + 로컬 내 코스'를 코드로 합쳤지만,
 * 여기서는 RLS가 그 일을 대신한다 — select 한 번이면 공식 코스와 내 코스가 함께 온다
 * (0002_rls.sql의 courses_read 정책).
 * 같은 계약을 서로 다른 방식으로 만족시키는 것이 어댑터의 존재 이유다.
 *
 * @implements {import('../../domain/ports/courseRepository.js').CourseRepository}
 */

import { ok, err, ErrorCode } from '../../core/result.js';
import { LOGIN_REQUIRED_MESSAGE } from '../../domain/ports/authGateway.js';
import { validateCourse } from '../../domain/entities/course.js';
import { sortSegments } from '../../domain/entities/courseSegment.js';
import { toCourse, courseToRow, segmentToRow } from './mappers/rowMappers.js';

// 목록에는 track을 넣지 않는다. 좌표 수백 개 × 코스 수만큼 전송량이 늘어난다.
const LIST_COLUMNS =
  'id, mountain_id, name, distance_km, ascent_m, duration_min, difficulty, trailhead, endpoint, course_type, is_official, owner_id, note, track_source';

// 상세는 구간과 실제 등산로 좌표를 함께 가져온다. PostgREST의 내장 조인 문법.
const DETAIL_COLUMNS = `${LIST_COLUMNS}, track, course_segments(id, course_id, seq, name, cum_distance_km, elevation_m, note, lat, lng)`;

/**
 * @param {object} client
 * @param {{ getUserId: () => string|null }} deps
 */
export function createSupabaseCourseRepository(client, { getUserId }) {
  return {
    async listByMountain(mountainId) {
      const { data, error } = await client
        .from('courses')
        .select(LIST_COLUMNS)
        .eq('mountain_id', mountainId)
        // 공식 코스를 먼저, 그 다음 내 코스.
        .order('is_official', { ascending: false })
        .order('distance_km');

      if (error) return toErr(error, '코스 목록');
      return ok(data.map(toCourse));
    },

    async getById(id) {
      const { data, error } = await client
        .from('courses')
        .select(DETAIL_COLUMNS)
        .eq('id', id)
        .maybeSingle();

      if (error) return toErr(error, '코스');
      if (!data) return err(ErrorCode.NOT_FOUND, '해당 코스를 찾을 수 없습니다.');

      // PostgREST는 조인된 행의 순서를 보장하지 않는다. 도메인에서 정렬한다.
      const course = toCourse(data);
      return ok({ ...course, segments: sortSegments(course.segments) });
    },

    async listMine() {
      const userId = getUserId();
      if (!userId) return ok([]);

      const { data, error } = await client
        .from('courses')
        .select(LIST_COLUMNS)
        .eq('owner_id', userId)
        .order('created_at', { ascending: false });

      if (error) return toErr(error, '내 코스');
      return ok(data.map(toCourse));
    },

    async save(course) {
      const userId = getUserId();
      if (!userId) return err(ErrorCode.UNAUTHORIZED, LOGIN_REQUIRED_MESSAGE);

      const errors = validateCourse(course);
      if (errors.length) return err(ErrorCode.VALIDATION, errors[0]);

      if (course.isOfficial && course.id) {
        return err(ErrorCode.UNAUTHORIZED, '공식 코스는 수정할 수 없습니다.');
      }

      const { data, error } = await client
        .from('courses')
        .upsert(courseToRow(course, userId), { onConflict: 'id' })
        .select(LIST_COLUMNS)
        .single();

      if (error) return toErr(error, '코스 저장');

      const saved = toCourse(data);

      // 구간은 통째로 갈아끼운다. 부분 병합은 seq가 어긋날 때 복구가 어렵다.
      const segments = sortSegments(course.segments).map((s, i) => ({ ...s, seq: i }));

      const { error: deleteError } = await client
        .from('course_segments')
        .delete()
        .eq('course_id', saved.id);
      if (deleteError) return toErr(deleteError, '구간 정리');

      if (segments.length) {
        const rows = segments.map((s) => segmentToRow({ ...s, id: '' }, saved.id));
        const { error: insertError } = await client.from('course_segments').insert(rows);
        if (insertError) return toErr(insertError, '구간 저장');
      }

      return ok({ ...saved, segments });
    },

    async remove(id) {
      const userId = getUserId();
      if (!userId) return err(ErrorCode.UNAUTHORIZED, LOGIN_REQUIRED_MESSAGE);

      // RLS가 남의 코스·공식 코스를 걸러낸다. 여기서는 결과 건수로 확인만 한다.
      const { data, error } = await client.from('courses').delete().eq('id', id).select('id');
      if (error) return toErr(error, '코스 삭제');
      if (!data?.length) return err(ErrorCode.UNAUTHORIZED, '삭제할 수 없는 코스입니다.');
      return ok(null);
    },
  };
}

function toErr(error, what) {
  return err(ErrorCode.NETWORK, `${what} 처리에 실패했습니다. (${error.message})`, error);
}
