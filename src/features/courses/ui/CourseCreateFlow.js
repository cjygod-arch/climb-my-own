/**
 * features/courses/ui/CourseCreateFlow.js — 내 코스 등록.
 *
 * chrome: 'bare' 라우트다. 입력 중에는 탭바도 헤더도 없다 —
 * "한 화면에 한 가지 작업" 원칙을 화면 구조로 강제한다.
 *
 * 단계: 산 → 이름·들머리 → 실적 → 메모
 */

import { el, mount, onDestroy } from '../../../core/dom.js';
import { createStore } from '../../../core/store.js';
import { renderAsync, idle, loading, success, failure } from '../../../core/asyncState.js';
import { StepFlow } from '../../../shared/ui/StepFlow.js';
import { Field, TextArea, Select } from '../../../shared/ui/Field.js';
import { SegmentedControl } from '../../../shared/ui/SegmentedControl.js';
import { ErrorState } from '../../../shared/ui/EmptyState.js';
import { SkeletonList } from '../../../shared/ui/Skeleton.js';
import { COURSE_TYPES } from '../../../domain/entities/course.js';
import { DIFFICULTY } from '../../../domain/rules/difficulty.js';

/**
 * 난이도 등급의 뜻. 등급만 보여주면 무엇을 고를지 알 수 없다.
 * 거리·고도로 자동 산출하지 않고 등록한 사람이 직접 고른다 —
 * 같은 거리라도 암릉·너덜·계단이 있으면 체감이 완전히 다르고,
 * 그것은 실제로 다녀온 사람만 안다.
 */
const DIFFICULTY_NOTES = {
  '하': '완만하고 짧아 누구나 다녀올 수 있습니다.',
  '중': '보통 체력이면 무리 없는 정도입니다.',
  '상': '경사가 급하거나 거리가 깁니다.',
  '최상': '오래 걷고 험한 구간이 있습니다.',
};

export function CourseCreateFlow({ services, query, navigate }) {
  const container = el('div', {});
  const store = createStore({ mountains: idle() });

  async function load() {
    store.setState({ mountains: loading() });
    const result = await services.mountains.listAll();
    store.setState({ mountains: result.ok ? success(result.value) : failure(result.error) });
  }

  function render() {
    mount(
      container,
      renderAsync(store.getState().mountains, {
        loading: () => el('div', { class: 'page' }, [SkeletonList(4)]),
        error: (error) => el('div', { class: 'page' }, [ErrorState({ error, onRetry: load })]),
        success: (mountains) => flow(mountains),
      }),
    );
  }

  function flow(mountains) {
    const options = mountains.map((m) => ({ value: m.id, label: `${m.name} (${m.elevationM}m)` }));

    return StepFlow({
      initialData: {
        mountainId: query.mountainId ?? '',
        name: '',
        courseType: COURSE_TYPES[0],
        // 빈 값은 '아직 고르지 않음'이다. 기본값을 넣으면 고르지 않고 지나칠 수 있다.
        difficulty: '',
        trailhead: '',
        endpoint: '',
        distanceKm: '',
        ascentM: '',
        durationMin: '',
        note: '',
      },
      submitLabel: '코스 저장',
      onCancel: () => navigate(query.mountainId ? `/mountains/${query.mountainId}` : '/mountains'),
      onComplete: async (data) => {
        const result = await services.courses.save({
          ...data,
          distanceKm: Number(data.distanceKm),
          ascentM: Number(data.ascentM) || 0,
          durationMin: Number(data.durationMin) || 0,
          endpoint: data.endpoint || data.trailhead,
        });

        if (!result.ok) {
          window.alert(result.error.message);
          return;
        }
        navigate(`/courses/${result.value.id}`);
      },

      steps: [
        {
          id: 'mountain',
          question: '어느 산인가요',
          hint: '100대 명산 중에서 선택합니다.',
          render: (data, update) =>
            Select({
              label: '산',
              name: 'mountainId',
              value: data.mountainId,
              placeholder: '선택해 주세요',
              options,
              onChange: (v) => update({ mountainId: v }),
            }),
          validate: (data) => (data.mountainId ? null : '산을 선택해 주세요.'),
        },

        {
          id: 'route',
          question: '코스를 어떻게 부를까요',
          hint: '들머리와 날머리를 적어두면 나중에 알아보기 쉽습니다.',
          render: (data, update) =>
            el('div', {}, [
              Field({
                label: '코스 이름',
                name: 'name',
                value: data.name,
                placeholder: '예: 오색 → 대청봉',
                onInput: (v) => update({ name: v }),
              }),
              el('div', { class: 'field' }, [
                el('span', { class: 't-label', text: '코스 형태' }),
                SegmentedControl({
                  items: COURSE_TYPES.map((t) => ({ value: t, label: t })),
                  selected: data.courseType,
                  block: true,
                  ariaLabel: '코스 형태',
                  // 형태를 바꾸면 날머리 입력란이 나타나거나 사라진다.
                  // 이 단계의 본문만 다시 그린다 — 바깥 render()를 부르면
                  // StepFlow가 새로 만들어져 1단계로 되돌아간다.
                  onSelect: (v) => update({ courseType: v }, { rerender: true }),
                }),
              ]),
              Field({
                label: '들머리',
                name: 'trailhead',
                value: data.trailhead,
                placeholder: '예: 오색탐방지원센터',
                onInput: (v) => update({ trailhead: v }),
              }),
              data.courseType !== '원점회귀' &&
                Field({
                  label: '날머리',
                  name: 'endpoint',
                  value: data.endpoint,
                  placeholder: '예: 한계령',
                  onInput: (v) => update({ endpoint: v }),
                }),
            ]),
          validate: (data) => (data.name.trim() ? null : '코스 이름을 입력해 주세요.'),
        },

        {
          id: 'metrics',
          question: '실적을 입력해 주세요',
          hint: '거리와 난이도는 꼭 입력해 주세요. 상승고도와 소요 시간은 비워두면 추정합니다.',
          render: (data, update) =>
            el('div', {}, [
              Field({
                label: '거리',
                name: 'distanceKm',
                type: 'number',
                inputMode: 'decimal',
                step: '0.1',
                min: '0',
                value: data.distanceKm,
                suffix: 'km',
                big: true,
                onInput: (v) => update({ distanceKm: v }),
              }),
              Field({
                label: '누적 상승고도',
                name: 'ascentM',
                type: 'number',
                inputMode: 'numeric',
                min: '0',
                value: data.ascentM,
                suffix: 'm',
                big: true,
                onInput: (v) => update({ ascentM: v }),
              }),
              Field({
                label: '소요 시간',
                name: 'durationMin',
                type: 'number',
                inputMode: 'numeric',
                min: '0',
                value: data.durationMin,
                suffix: '분',
                big: true,
                onInput: (v) => update({ durationMin: v }),
              }),

              el('div', { class: 'field' }, [
                el('span', { class: 't-label', text: '난이도' }),
                SegmentedControl({
                  items: DIFFICULTY.map((d) => ({ value: d, label: d })),
                  selected: data.difficulty,
                  block: true,
                  ariaLabel: '난이도',
                  // 고르면 아래 설명이 바뀌어야 하므로 이 단계의 본문만 다시 그린다.
                  onSelect: (v) => update({ difficulty: v }, { rerender: true }),
                }),
                el('span', {
                  class: 't-caption',
                  text: data.difficulty
                    ? DIFFICULTY_NOTES[data.difficulty]
                    : '다녀온 느낌을 기준으로 골라 주세요. 같은 거리라도 암릉이나 계단이 있으면 훨씬 힘듭니다.',
                }),
              ]),
            ]),
          validate: (data) => {
            if (!(Number(data.distanceKm) > 0)) return '거리를 0보다 크게 입력해 주세요.';
            if (!data.difficulty) return '난이도를 선택해 주세요.';
            return null;
          },
        },

        {
          id: 'note',
          question: '메모를 남길까요',
          hint: '주의 구간이나 물 보충 지점 같은 정보를 적어두면 유용합니다.',
          skippable: true,
          render: (data, update) =>
            TextArea({
              label: '메모',
              name: 'note',
              value: data.note,
              placeholder: '예: 정상 직전 철계단이 길다.',
              onInput: (v) => update({ note: v }),
            }),
        },
      ],
    });
  }

  const unsubscribe = store.subscribe(render);
  render();
  load();

  return onDestroy(container, unsubscribe);
}
