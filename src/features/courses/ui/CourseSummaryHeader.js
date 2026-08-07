/**
 * features/courses/ui/CourseSummaryHeader.js — 코스 수치 요약.
 *
 * 거리·상승고도·소요시간 세 값이 이 화면의 주인공이다.
 * 라벨보다 수치가 4배 크게 (StatBlock이 그 비율을 강제한다).
 */

import { el } from '../../../core/dom.js';
import { km, int, clock } from '../../../core/format.js';
import { StatBlock, StatGrid } from '../../../shared/ui/StatBlock.js';
import { Tag } from '../../../shared/ui/Chip.js';
import { routeLabel } from '../../../domain/entities/course.js';

/**
 * @param {{ course: import('../../../domain/entities/course.js').Course, mountainName: string }} props
 */
export function CourseSummaryHeader({ course, mountainName }) {
  return el('header', { class: 'stack stack--5' }, [
    el('div', { class: 'stack stack--1' }, [
      mountainName && el('p', { class: 't-label', text: mountainName }),
      el('h1', { class: 't-display', text: course.name }),
      routeLabel(course) && el('p', { class: 't-caption', text: routeLabel(course) }),
    ]),

    el('div', { class: 'row row--wrap', style: { gap: 'var(--space-2)' } }, [
      Tag(course.courseType),
      Tag(`난이도 ${course.difficulty}`),
      !course.isOfficial && Tag('내 코스'),
    ]),

    StatGrid(
      [
        StatBlock({ value: km(course.distanceKm), unit: 'km', label: '거리' }),
        StatBlock({ value: int(course.ascentM), unit: 'm', label: '상승고도' }),
        StatBlock({ value: clock(course.durationMin), unit: 'h', label: '소요시간' }),
      ],
      3,
    ),
  ]);
}
