/**
 * data/supabase/mappers/rowMappers.js — DB row ↔ 도메인 엔티티.
 *
 * ★ DB 컬럼명(snake_case)을 아는 유일한 파일이다 (ARCHITECTURE.md R7).
 *   컬럼 이름이 바뀌면 여기만 고친다. 화면도 도메인도 영향을 받지 않는다.
 *
 * 반대 방향(toRow)은 저장할 때 쓴다. id가 비어 있으면 넣지 않는다 —
 * DB가 기본값(gen_random_uuid)으로 발급하게 하기 위함이다.
 */

import { createMountain } from '../../../domain/entities/mountain.js';
import { createCourse } from '../../../domain/entities/course.js';
import { createCourseSegment } from '../../../domain/entities/courseSegment.js';
import { createHikeRecord } from '../../../domain/entities/hikeRecord.js';
import { createBadge, createEarnedBadge } from '../../../domain/entities/badge.js';

// ── 산 ──────────────────────────────────────────────
export function toMountain(row) {
  return createMountain({
    id: row.id,
    name: row.name,
    nameHanja: row.name_hanja,
    province: row.province,
    region: row.region,
    elevationM: row.elevation_m,
    categories: row.categories,
    difficulty: row.difficulty,
    summary: row.summary,
    description: row.description,
    bestSeason: row.best_season,
    dataSource: row.data_source,
    verified: row.verified,
  });
}

// ── 구간 ────────────────────────────────────────────
export function toSegment(row) {
  return createCourseSegment({
    id: row.id,
    courseId: row.course_id,
    seq: row.seq,
    name: row.name,
    cumDistanceKm: row.cum_distance_km,
    elevationM: row.elevation_m,
    note: row.note,
    lat: row.lat,
    lng: row.lng,
  });
}

export function segmentToRow(segment, courseId) {
  return {
    id: segment.id || `${courseId}-${segment.seq}`,
    course_id: courseId,
    seq: segment.seq,
    name: segment.name,
    cum_distance_km: segment.cumDistanceKm,
    elevation_m: segment.elevationM,
    note: segment.note,
    lat: segment.lat,
    lng: segment.lng,
  };
}

// ── 코스 ────────────────────────────────────────────
export function toCourse(row) {
  return createCourse({
    id: row.id,
    mountainId: row.mountain_id,
    name: row.name,
    distanceKm: row.distance_km,
    ascentM: row.ascent_m,
    durationMin: row.duration_min,
    difficulty: row.difficulty,
    trailhead: row.trailhead,
    endpoint: row.endpoint,
    courseType: row.course_type,
    isOfficial: row.is_official,
    ownerId: row.owner_id,
    note: row.note,
    track: row.track,
    trackSource: row.track_source,
    // 조인해서 가져온 경우에만 채워진다. 목록 조회에서는 비어 있다.
    segments: (row.course_segments ?? []).map(toSegment),
  });
}

export function courseToRow(course, ownerId) {
  const row = {
    mountain_id: course.mountainId,
    name: course.name,
    distance_km: course.distanceKm,
    ascent_m: course.ascentM,
    duration_min: course.durationMin,
    difficulty: course.difficulty,
    trailhead: course.trailhead,
    endpoint: course.endpoint,
    course_type: course.courseType,
    is_official: false,
    owner_id: ownerId,
    note: course.note,
  };
  if (course.id) row.id = course.id;
  return row;
}

// ── 산행 기록 ───────────────────────────────────────
export function toRecord(row) {
  return createHikeRecord({
    id: row.id,
    userId: row.user_id,
    mountainId: row.mountain_id,
    courseId: row.course_id,
    hikedOn: row.hiked_on,
    distanceKm: row.distance_km,
    ascentM: row.ascent_m,
    durationMin: row.duration_min,
    memo: row.memo,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    activityType: row.activity_type,
    title: row.title,
    route: row.route,
    createdAt: row.created_at,
  });
}

export function recordToRow(record, userId) {
  const row = {
    user_id: userId,
    mountain_id: record.mountainId || null,
    course_id: record.courseId || null,
    hiked_on: record.hikedOn,
    distance_km: record.distanceKm,
    ascent_m: record.ascentM,
    duration_min: record.durationMin,
    memo: record.memo,
    started_at: record.startedAt,
    ended_at: record.endedAt,
    activity_type: record.activityType,
    title: record.title,
    route: record.route,
  };
  // id가 비어 있으면 넣지 않는다 — DB가 uuid를 발급한다.
  if (record.id) row.id = record.id;
  return row;
}

// ── 배지 ────────────────────────────────────────────
export function toBadge(row) {
  return createBadge({
    code: row.code,
    title: row.title,
    description: row.description,
    criteria: row.criteria,
    tier: row.tier,
  });
}

export function toEarnedBadge(row) {
  return createEarnedBadge({
    badgeCode: row.badge_code,
    earnedAt: row.earned_at,
    sourceRecordId: row.source_record_id,
  });
}
