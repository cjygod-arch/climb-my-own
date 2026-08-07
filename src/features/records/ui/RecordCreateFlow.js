/**
 * features/records/ui/RecordCreateFlow.js — 산행 기록 입력.
 *
 * 4단계: 날짜 → 산 → 실적 → 메모.
 * 코스 안내 화면에서 넘어오면 산과 실적이 미리 채워진다 (query 파라미터).
 *
 * 배지 획득 알림은 이 화면이 하지 않는다. records 서비스가 eventBus로 발행하고
 * features/badges/badges.notifier.js 가 받아서 시트를 띄운다 (ARCHITECTURE.md R5).
 */

import { el, mount, onDestroy } from '../../../core/dom.js';
import { createStore } from '../../../core/store.js';
import { renderAsync, idle, loading, success, failure } from '../../../core/asyncState.js';
import { StepFlow } from '../../../shared/ui/StepFlow.js';
import { Field, TextArea, Select } from '../../../shared/ui/Field.js';
import { ErrorState } from '../../../shared/ui/EmptyState.js';
import { SkeletonList } from '../../../shared/ui/Skeleton.js';
import { config } from '../../../app/config.js';

export function RecordCreateFlow({ services, query, navigate }) {
  const container = el('div', {});
  const store = createStore({ setup: idle() });

  /** 산 목록과 (있다면) 선택된 코스를 함께 가져온다. */
  async function load() {
    store.setState({ setup: loading() });

    const mountainsResult = await services.mountains.listAll();
    if (!mountainsResult.ok) {
      store.setState({ setup: failure(mountainsResult.error) });
      return;
    }

    let course = null;
    if (query.courseId) {
      const guide = await services.courses.getGuide(query.courseId);
      if (guide.ok) course = guide.value.course;
    }

    store.setState({ setup: success({ mountains: mountainsResult.value, course }) });
  }

  function render() {
    mount(
      container,
      renderAsync(store.getState().setup, {
        loading: () => el('div', { class: 'page' }, [SkeletonList(4)]),
        error: (error) => el('div', { class: 'page' }, [ErrorState({ error, onRetry: load })]),
        success: (setup) => flow(setup),
      }),
    );
  }

  function flow({ mountains, course }) {
    const options = mountains.map((m) => ({ value: m.id, label: `${m.name} (${m.elevationM}m)` }));

    return StepFlow({
      initialData: {
        hikedOn: config.today(),
        mountainId: query.mountainId ?? course?.mountainId ?? '',
        courseId: course?.id ?? null,
        // 코스에서 넘어왔으면 실적을 채워둔다. 사용자가 그대로 두거나 고치면 된다.
        distanceKm: course ? String(course.distanceKm) : '',
        ascentM: course ? String(course.ascentM) : '',
        durationMin: course ? String(course.durationMin) : '',
        memo: '',
      },
      submitLabel: '기록 저장',
      onCancel: () => navigate('/records'),

      onComplete: async (data) => {
        const result = await services.records.save({
          ...data,
          distanceKm: Number(data.distanceKm),
          ascentM: Number(data.ascentM) || 0,
          durationMin: Number(data.durationMin) || 0,
        });

        if (!result.ok) {
          window.alert(result.error.message);
          return;
        }

        // 배지를 땄다면 알림 시트는 notifier가 이미 띄웠다. 여기서는 이동만 한다.
        navigate('/records');
      },

      steps: [
        {
          id: 'date',
          question: '언제 다녀오셨나요',
          render: (data, update) =>
            Field({
              label: '산행 날짜',
              name: 'hikedOn',
              type: 'date',
              value: data.hikedOn,
              max: config.today(),
              big: true,
              onInput: (v) => update({ hikedOn: v }),
            }),
          validate: (data) => {
            if (!data.hikedOn) return '산행 날짜를 선택해 주세요.';
            if (data.hikedOn > config.today()) return '미래 날짜는 기록할 수 없습니다.';
            return null;
          },
        },

        {
          id: 'mountain',
          question: '어느 산인가요',
          hint: course ? `선택한 코스: ${course.name}` : null,
          render: (data, update) =>
            Select({
              label: '산',
              name: 'mountainId',
              value: data.mountainId,
              placeholder: '선택해 주세요',
              options,
              onChange: (v) => update({ mountainId: v, courseId: null }),
            }),
          validate: (data) => (data.mountainId ? null : '산을 선택해 주세요.'),
        },

        {
          id: 'metrics',
          question: '실적을 입력해 주세요',
          hint: '거리는 필수입니다. 나머지는 비워두어도 됩니다.',
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
            ]),
          validate: (data) =>
            Number(data.distanceKm) > 0 ? null : '거리를 0보다 크게 입력해 주세요.',
        },

        {
          id: 'memo',
          question: '남길 말이 있나요',
          hint: '날씨, 동행, 컨디션처럼 나중에 떠올릴 단서를 적어두면 좋습니다.',
          skippable: true,
          render: (data, update) =>
            TextArea({
              label: '메모',
              name: 'memo',
              value: data.memo,
              placeholder: '예: 맑음. 정상 바람 강함.',
              onInput: (v) => update({ memo: v }),
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
