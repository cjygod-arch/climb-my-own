/**
 * features/profile/ui/ProfilePage.js — 내 정보.
 *
 * 전체 누적 · 계정 상태 · 내 코스 · 현재 데이터 소스를 보여준다.
 * 데이터 소스 표기는 개발·데모 중 어느 저장소로 동작 중인지 확인하기 위한 것이다.
 */

import { el, mount, onDestroy } from '../../../core/dom.js';
import { createStore } from '../../../core/store.js';
import { renderAsync, idle, loading, success, failure } from '../../../core/asyncState.js';
import { km, int, clock } from '../../../core/format.js';
import { StatBlock, StatGrid } from '../../../shared/ui/StatBlock.js';
import { DataRow, DataList } from '../../../shared/ui/DataRow.js';
import { Button } from '../../../shared/ui/Button.js';
import { EmptyState, ErrorState } from '../../../shared/ui/EmptyState.js';
import { SkeletonStats } from '../../../shared/ui/Skeleton.js';
import { routeLabel } from '../../../domain/entities/course.js';
import { PROVIDERS } from '../../../domain/ports/authGateway.js';
import { canInstall, isInstalled, isIosSafari, promptInstall, onInstallAvailability }
  from '../../../app/pwa.js';

const PROVIDER_LABELS = Object.fromEntries(
  PROVIDERS.map((p) => [p.id, p.label.replace(/(로| ).*$/, '')]),
);


export function ProfilePage({ services, navigate }) {
  const container = el('div', { class: 'page' });
  const store = createStore({ summary: idle(), myCourses: idle() });

  async function load() {
    store.setState({ summary: loading(), myCourses: loading() });

    const [summary, myCourses] = await Promise.all([
      services.profile.getSummary(),
      services.courses.listMine(),
    ]);

    store.setState({
      summary: summary.ok ? success(summary.value) : failure(summary.error),
      myCourses: myCourses.ok ? success(myCourses.value) : failure(myCourses.error),
    });
  }

  function render() {
    const { summary, myCourses } = store.getState();
    const session = services.profile.getSession();
    const signedIn = services.profile.isAuthenticated();

    mount(
      container,
      el('div', { class: 'stack stack--4' }, [
        signedIn && renderAsync(summary, {
          loading: () => SkeletonStats(3),
          error: (error) => ErrorState({ error, onRetry: load }),
          success: (data) => totals(data),
        }),
        account(session),
        installCard(),
        signedIn && courses(myCourses),
        sourceInfo(),
      ]),
    );
  }

  function totals({ total, badgeCount }) {
    return el('section', { class: 'card stack stack--5' }, [
      StatBlock({ value: km(total.distanceKm), unit: 'km', label: '전체 누적 거리' }),
      StatGrid(
        [
          StatBlock({ value: int(total.count), unit: '회', label: '산행', size: 'sm' }),
          StatBlock({ value: int(total.distinctMountains), unit: '곳', label: '오른 산', size: 'sm' }),
          StatBlock({ value: int(total.ascentM), unit: 'm', label: '상승고도', size: 'sm' }),
          StatBlock({ value: clock(total.durationMin), unit: 'h', label: '누적 시간', size: 'sm' }),
        ],
        4,
      ),
      StatBlock({ value: int(badgeCount), unit: '개', label: '획득 배지', size: 'sm' }),
    ]);
  }

  function account(session) {
    const signedIn = services.profile.isAuthenticated();

    return el('section', { class: 'card stack stack--3' }, [
      el('h2', { class: 't-title', text: '계정' }),
      DataList([
        DataRow({
          label: '상태',
          value: signedIn ? (session.displayName ?? session.provider ?? '연결됨') : '로그인하지 않음',
        }),
        signedIn && DataRow({ label: '로그인 수단', value: PROVIDER_LABELS[session.provider] ?? '—' }),
      ].filter(Boolean)),
      signedIn
        ? Button({
            label: '로그아웃',
            variant: 'ghost',
            block: true,
            iconName: 'logout',
            onClick: async () => {
              if (!window.confirm('로그아웃할까요? 기록은 계정에 남아 다시 로그인하면 볼 수 있습니다.')) return;
              await services.profile.signOut();
              navigate('/');
            },
          })
        : el('div', { class: 'stack stack--2' }, [
            el('p', {
              class: 't-caption',
              text: '기록을 남기려면 로그인이 필요합니다. 산과 코스는 로그인 없이도 볼 수 있습니다.',
            }),
            Button({
              label: '로그인',
              variant: 'primary',
              block: true,
              size: 'lg',
              onClick: () => navigate('/login?next=%2Fprofile'),
            }),
          ]),
    ]);
  }

  function courses(state) {
    return el('section', { class: 'card stack stack--3' }, [
      el('div', { class: 'row row--between' }, [
        el('h2', { class: 't-title', text: '내가 등록한 코스' }),
        Button({
          label: '추가',
          variant: 'quiet',
          size: 'sm',
          iconName: 'plus',
          onClick: () => navigate('/courses/new'),
        }),
      ]),
      renderAsync(state, {
        loading: () => el('div'),
        error: (error) => ErrorState({ error, onRetry: load }),
        success: (list) =>
          list.length === 0
            ? EmptyState({
                title: '등록한 코스가 없습니다',
                description: '자주 가는 길을 코스로 만들어 두면 기록할 때 실적이 자동으로 채워집니다.',
                iconName: 'route',
                actionLabel: '코스 등록하기',
                onAction: () => navigate('/courses/new'),
              })
            : DataList(
                list.map((course) =>
                  DataRow({
                    label: course.name,
                    value: el('span', { class: 'crow__meta' }, [
                      el('span', { class: 'datarow__value', text: `${km(course.distanceKm)} km` }),
                      el('span', { class: 't-caption t-faint', text: routeLabel(course) }),
                    ]),
                    onClick: () => navigate(`/courses/${course.id}`),
                  }),
                ),
              ),
      }),
    ]);
  }

  /**
   * 홈 화면 설치 안내.
   * 이미 설치해 실행 중이면 보여줄 이유가 없다.
   * 안드로이드는 버튼 한 번으로 되고, iOS는 공유 메뉴를 직접 열어야 해서 안내가 다르다.
   */
  function installCard() {
    if (isInstalled()) return null;

    if (isIosSafari()) {
      return el('section', { class: 'card stack stack--2' }, [
        el('h2', { class: 't-title', text: '홈 화면에 추가' }),
        el('p', {
          class: 't-caption',
          text: '아래 공유 버튼을 누르고 ‘홈 화면에 추가’를 선택하면 앱처럼 쓸 수 있습니다.',
        }),
      ]);
    }

    if (!canInstall()) return null;

    return el('section', { class: 'card stack stack--3' }, [
      el('div', { class: 'stack stack--1' }, [
        el('h2', { class: 't-title', text: '앱으로 설치하기' }),
        el('p', {
          class: 't-caption',
          text: '홈 화면에서 바로 열 수 있고, 주소창 없이 전체화면으로 실행됩니다.',
        }),
      ]),
      Button({
        label: '설치',
        variant: 'primary',
        block: true,
        onClick: async () => {
          await promptInstall();
          render();
        },
      }),
    ]);
  }

  function sourceInfo() {
    const source = document.documentElement.dataset.source ?? 'static';
    return el('section', { class: 'card stack stack--2' }, [
      el('h2', { class: 't-title', text: '데이터' }),
      DataList([
        DataRow({ label: '저장소', value: source === 'supabase' ? 'Supabase' : '이 기기 (정적 모드)' }),
      ]),
      el('p', {
        class: 't-caption t-faint',
        text: '저장소는 src/app/config.js 의 DATA_SOURCE 값으로 전환합니다. 화면 코드는 바뀌지 않습니다.',
      }),
    ]);
  }

  const unsubscribeStore = store.subscribe(render);
  const offSession = services.profile.onSessionChange(() => render());
  // 설치 배너는 부팅 뒤 늦게 올 수 있다. 오면 카드를 띄운다.
  const offInstall = onInstallAvailability(() => render());

  render();
  if (services.profile.isAuthenticated()) load();

  return onDestroy(container, () => {
    unsubscribeStore();
    offSession();
    offInstall();
  });
}
