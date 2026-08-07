/**
 * features/tracking/tracking.service.js — 산행 안내 세션.
 *
 * '안내받기'를 누른 순간부터 '종료'까지를 책임진다.
 *   시작 → 출발 시각 기록, 세션 저장, GPS 감시 시작
 *   진행 → 좌표 누적, 코스 위 진행률 계산, 세션 갱신
 *   종료 → 도착 시각 기록, 총 소요시간 계산, HikeRecord로 저장
 *
 * 위치 계산은 domain/rules/trackProgress.js가, 저장은 포트가 한다.
 * 이 서비스는 그 순서를 조율할 뿐이다.
 *
 * 배지 재평가는 records 서비스를 거치므로 여기서 직접 하지 않는다.
 */

import { ok, err, ErrorCode } from '../../core/result.js';
import { publish } from '../../core/eventBus.js';
import { Topic } from '../../domain/events.js';
import { LOGIN_REQUIRED_MESSAGE } from '../../domain/ports/authGateway.js';
import {
  createHikeSession, appendPoint, advance, finish, elapsedMinutes, isActive,
} from '../../domain/entities/hikeSession.js';
import { ActivityType, isWalk } from '../../domain/entities/activity.js';
import {
  cumulativeMeters, progressAt, nextWaypoint, passedWaypoint, locateWaypoints,
  traveledMeters, estimateRemainingMin, POOR_ACCURACY_M,
} from '../../domain/rules/trackProgress.js';
import { pathOf } from '../../domain/rules/coursePath.js';

/**
 * @param {{ sessionRepo, locationGateway, coursesService, recordsService, config }} deps
 */
export function createTrackingService({ auth, sessionRepo, locationGateway, coursesService, recordsService, config }) {
  /** 감시 중인 코스 정보. 세션이 살아 있는 동안만 유지된다. */
  let context = null;   // { session, course, track, cum }
  let stopWatch = null;
  const listeners = new Set();

  function emit() {
    const snapshot = describe();
    for (const listener of Array.from(listeners)) listener(snapshot);
  }

  /** 화면이 그대로 쓸 수 있는 형태로 현재 상태를 만든다. */
  function describe() {
    if (!context) return null;

    const { session, course, track, cum, located, lastFix, lastError } = context;
    const elapsedMin = elapsedMinutes(session, config.now());
    const traveledM = traveledMeters(session.points);

    // 걷기에는 따라갈 코스가 없다. 진행률·다음 지점 대신 실제 이동 거리만 있다.
    const walk = isWalk(session);

    const progress = !walk && lastFix
      ? progressAt(track, [lastFix.lat, lastFix.lng], { cum, maxAlongM: session.maxAlongM })
      : null;

    return {
      session,
      walk,
      course,
      track,
      // 화면이 걷기/산행을 분기하지 않도록 표시용 이름을 여기서 정한다.
      // 걷기에는 course가 null이므로 화면에서 course.name을 읽으면 터진다.
      title: walk ? (session.courseName || '걷기') : (course?.name ?? ''),
      subtitle: walk ? '걷기' : (session.mountainName || ''),
      elapsedMin,
      lastFix,
      lastError,
      progress,
      traveledM,
      // 분당 이동 거리로 낸 평균 속도(km/h). 걷기 화면의 주요 수치다.
      speedKmh: elapsedMin > 0 ? (traveledM / 1000) / (elapsedMin / 60) : 0,
      next: !walk && progress ? nextWaypoint(located, progress.alongM) : null,
      passed: !walk && progress ? passedWaypoint(located, progress.alongM) : null,
      etaMin: progress ? estimateRemainingMin(progress.alongM, progress.remainingM, elapsedMin) : null,
      // 정확도가 나쁘면 위치 판단을 신뢰할 수 없다고 화면에 알린다.
      weakSignal: Boolean(lastFix && lastFix.accuracy > POOR_ACCURACY_M),
    };
  }

  async function persist() {
    if (!context) return;
    await sessionRepo.save(context.session);
  }

  function handleFix(fix) {
    if (!context) return;

    context.lastFix = fix;
    context.lastError = null;

    // 정확도가 형편없는 신호로 진행률을 갱신하면 엉뚱한 곳으로 튄다. 표시만 하고 넘긴다.
    // 걷기는 코스가 없으므로 진행률 자체가 없다.
    if (!isWalk(context.session) && context.track && fix.accuracy <= POOR_ACCURACY_M) {
      const p = progressAt(context.track, [fix.lat, fix.lng], {
        cum: context.cum,
        maxAlongM: context.session.maxAlongM,
      });
      // 코스에서 크게 벗어난 지점으로 진행률을 올리지 않는다.
      if (!p.offTrack) context.session = advance(context.session, p.alongM);
    }

    context.session = appendPoint(context.session, {
      lat: fix.lat, lng: fix.lng, at: fix.at, accuracy: Math.round(fix.accuracy),
    });

    persist();
    emit();
  }

  function handleError(error) {
    if (!context) return;
    context.lastError = error;
    emit();
  }

  function startWatching() {
    stopWatch?.();
    stopWatch = locationGateway.watch(handleFix, handleError);
  }

  /** 코스 정보를 붙여 감시 문맥을 만든다. 걷기는 붙일 코스가 없다. */
  async function attach(session) {
    if (isWalk(session)) {
      context = { session, course: null, track: null, cum: null, located: [], lastFix: null, lastError: null };
      startWatching();
      emit();
      return ok(describe());
    }

    const guide = await coursesService.getGuide(session.courseId);
    if (!guide.ok) return guide;

    const course = guide.value.course;
    const track = pathOf(course).points;

    if (track.length < 2) {
      return err(ErrorCode.VALIDATION, '이 코스에는 경로 좌표가 없어 안내를 시작할 수 없습니다.');
    }

    const cum = cumulativeMeters(track);
    context = {
      session, course, track, cum,
      // 구간 지점을 트랙 위 거리로 미리 환산해 둔다. 매 위치 갱신마다 다시 계산하지 않는다.
      located: locateWaypoints(track, course.segments, cum),
      lastFix: null, lastError: null,
    };
    startWatching();
    emit();
    return ok(describe());
  }

  return {
    /**
     * 앱 시작 시 호출. 진행 중이던 활동이 있으면 이어서 감시한다.
     * 로그인하지 않았다면 이어받을 것이 없다 — 남의 세션을 복구하지 않는다.
     */
    async resume() {
      if (!auth.isAuthenticated()) return ok(null);
      const found = await sessionRepo.getActive();
      if (!found.ok || !found.value) return ok(null);
      return attach(found.value);
    },

    /**
     * 안내 시작. 출발 시각을 여기서 확정한다.
     * @param {string} courseId
     */
    async start(courseId) {
      if (!auth.isAuthenticated()) return err(ErrorCode.UNAUTHORIZED, LOGIN_REQUIRED_MESSAGE);
      if (!locationGateway.isSupported()) {
        return err(
          ErrorCode.VALIDATION,
          '이 환경에서는 위치를 사용할 수 없습니다. HTTPS로 접속했는지 확인해 주세요.',
        );
      }

      const existing = await sessionRepo.getActive();
      if (existing.ok && existing.value && isActive(existing.value)) {
        return err(ErrorCode.CONFLICT, '이미 진행 중인 산행이 있습니다. 먼저 종료해 주세요.');
      }

      const guide = await coursesService.getGuide(courseId);
      if (!guide.ok) return guide;

      const { course, mountain } = guide.value;

      const session = createHikeSession({
        id: newId(),
        courseId: course.id,
        mountainId: course.mountainId,
        courseName: course.name,
        mountainName: mountain?.name ?? '',
        startedAt: config.now(),
        status: 'active',
      });

      const saved = await sessionRepo.save(session);
      if (!saved.ok) return saved;

      const attached = await attach(session);
      if (!attached.ok) {
        // 감시를 못 붙이면 세션을 남겨두지 않는다. 시작하지 않은 것으로 되돌린다.
        await sessionRepo.clearActive();
        context = null;
        return attached;
      }

      publish(Topic.TRACKING_STARTED, session);
      return attached;
    },

    /**
     * 걷기 시작. 코스가 없으므로 어디서든 바로 시작할 수 있다.
     * @param {string} [title] 사용자가 붙인 제목
     */
    async startWalk(title = '') {
      if (!auth.isAuthenticated()) return err(ErrorCode.UNAUTHORIZED, LOGIN_REQUIRED_MESSAGE);
      if (!locationGateway.isSupported()) {
        return err(
          ErrorCode.VALIDATION,
          '이 환경에서는 위치를 사용할 수 없습니다. HTTPS로 접속했는지 확인해 주세요.',
        );
      }

      const existing = await sessionRepo.getActive();
      if (existing.ok && existing.value && isActive(existing.value)) {
        return err(ErrorCode.CONFLICT, '이미 진행 중인 활동이 있습니다. 먼저 종료해 주세요.');
      }

      const session = createHikeSession({
        id: newId(),
        activityType: ActivityType.WALK,
        courseName: title.trim() || '걷기',
        startedAt: config.now(),
        status: 'active',
      });

      const saved = await sessionRepo.save(session);
      if (!saved.ok) return saved;

      const attached = await attach(session);
      if (!attached.ok) {
        await sessionRepo.clearActive();
        context = null;
        return attached;
      }

      publish(Topic.TRACKING_STARTED, session);
      return attached;
    },

    /**
     * 안내 종료. 도착 시각과 총 소요시간을 확정하고 기록으로 저장한다.
     * @param {{ save?: boolean }} [options] save=false면 기록하지 않고 버린다
     */
    async stop({ save = true } = {}) {
      if (!context) return err(ErrorCode.NOT_FOUND, '진행 중인 산행이 없습니다.');

      const endedAt = config.now();
      const finished = finish(context.session, endedAt);
      const snapshot = describe();
      const durationMin = elapsedMinutes(finished, endedAt);
      const course = context.course;

      /**
       * 세션을 지우는 것은 마지막에 한다.
       * 먼저 지우면 기록 저장이 실패했을 때 사용자가 걸은 기록을 통째로 잃는다.
       * 저장이 확정된 뒤에야 되돌릴 수 없는 작업을 한다.
       */
      async function release() {
        stopWatch?.();
        stopWatch = null;
        await sessionRepo.clearActive();
        context = null;
        emit();
        publish(Topic.TRACKING_STOPPED, finished);
      }

      if (!save) {
        await release();
        return ok({ session: finished, record: null, durationMin });
      }

      const traveledKm = round1(traveledMeters(finished.points) / 1000);
      // 실제로 이동한 경로를 기록에 함께 담는다. 나중에 지도에 그린다.
      const route = finished.points.map((p) => [round5(p.lat), round5(p.lng)]);

      const walk = isWalk(finished);

      // 산행은 GPS가 부실하면 코스 표기 거리로 대체한다.
      // 걷기는 대체할 기준이 없으므로 측정값을 그대로 쓴다.
      const distanceKm = walk
        ? traveledKm
        : (traveledKm >= course.distanceKm * 0.5 ? traveledKm : course.distanceKm);

      const result = await recordsService.save({
        activityType: finished.activityType,
        title: walk ? finished.courseName : '',
        mountainId: walk ? '' : finished.mountainId,
        courseId: walk ? null : finished.courseId,
        hikedOn: finished.startedAt.slice(0, 10),
        distanceKm,
        ascentM: walk ? 0 : course.ascentM,
        durationMin,
        startedAt: finished.startedAt,
        endedAt,
        route,
        memo: '',
      });

      // 저장에 실패하면 세션을 살려둔다. 사용자가 다시 시도할 수 있어야 한다.
      if (!result.ok) return result;

      await release();

      return ok({
        session: finished,
        record: result.value.record,
        earnedBadges: result.value.earnedBadges,
        durationMin,
        snapshot,
      });
    },

    /** 현재 상태 스냅샷. 없으면 null. */
    getSnapshot: describe,

    hasActive: () => context !== null,

    /** 상태 변화 구독. 해제 함수를 돌려준다. */
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /** 화면이 보이지 않는 동안에도 감시는 계속된다. 탭 복귀 시 갱신만 유도한다. */
    refresh: emit,
  };
}

function newId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

/** 좌표는 소수 5자리면 약 1m 정밀도다. 저장 용량을 줄인다. */
function round5(n) {
  return Math.round(n * 1e5) / 1e5;
}
