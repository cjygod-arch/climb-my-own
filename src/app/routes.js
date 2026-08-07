/**
 * app/routes.js — 경로 ↔ 화면 매핑.
 *
 * 새 화면을 추가할 때 손대는 파일. 라우터 엔진은 이 표를 모른다.
 *
 * chrome:
 *   'shell' — 헤더 + 탭바가 있는 일반 화면
 *   'bare'  — 헤더·탭바 없이 화면 전체를 쓴다. StepFlow 전용
 *             ("한 화면에 한 가지 작업" 원칙상 입력 중에는 다른 이동 수단을 두지 않는다)
 *
 * requiresAuth:
 *   true면 로그인해야 들어갈 수 있다. 로그인하지 않았으면 /login 으로 보낸다.
 *   ★ 기록을 남기는 화면에는 빠짐없이 붙인다 — 게이트를 화면마다 따로 구현하면
 *     반드시 하나를 빠뜨린다. 라우터 한 곳에서 처리한다 (bootstrap.js).
 */

import { HomePage } from '../features/home/ui/HomePage.js';
import { MountainListPage } from '../features/mountains/ui/MountainListPage.js';
import { MountainDetailPage } from '../features/mountains/ui/MountainDetailPage.js';
import { CourseGuidePage } from '../features/courses/ui/CourseGuidePage.js';
import { CourseCreateFlow } from '../features/courses/ui/CourseCreateFlow.js';
import { MountainMapPage } from '../features/courses/ui/MountainMapPage.js';
import { RecordsPage } from '../features/records/ui/RecordsPage.js';
import { RecordDetailPage } from '../features/records/ui/RecordDetailPage.js';
import { RecordCreateFlow } from '../features/records/ui/RecordCreateFlow.js';
import { BadgesPage } from '../features/badges/ui/BadgesPage.js';
import { ProfilePage } from '../features/profile/ui/ProfilePage.js';
import { LoginPage } from '../features/profile/ui/LoginPage.js';
import { TrackingPage } from '../features/tracking/ui/TrackingPage.js';
import { WalkStartPage } from '../features/tracking/ui/WalkStartPage.js';

/** 하단 탭. 순서가 곧 표시 순서다. */
export const TABS = Object.freeze([
  { id: 'home', path: '/', label: '홈', icon: 'home' },
  { id: 'mountains', path: '/mountains', label: '명산', icon: 'peak' },
  { id: 'records', path: '/records', label: '기록', icon: 'calendar' },
  { id: 'badges', path: '/badges', label: '배지', icon: 'badge' },
  { id: 'profile', path: '/profile', label: '내 정보', icon: 'user' },
]);

export const routes = [
  { path: '/', view: HomePage, title: 'Climb My Own', tab: 'home', chrome: 'shell' },

  { path: '/mountains', view: MountainListPage, title: '100대 명산', tab: 'mountains', chrome: 'shell' },
  // 고정 세그먼트('map')가 있는 경로를 :id 보다 먼저 둔다 — 라우터는 위에서부터 매칭한다.
  { path: '/mountains/:id/map', view: MountainMapPage, title: '코스 지도', tab: 'mountains', chrome: 'shell', back: true },
  { path: '/mountains/:id', view: MountainDetailPage, title: '', tab: 'mountains', chrome: 'shell', back: true },

  { path: '/courses/new', view: CourseCreateFlow, title: '내 코스 등록', chrome: 'bare', requiresAuth: true },
  { path: '/courses/:id', view: CourseGuidePage, title: '등산길 안내', tab: 'mountains', chrome: 'shell', back: true },

  { path: '/walk/new', view: WalkStartPage, title: '운동(걷기) 기록', chrome: 'shell', back: true, requiresAuth: true },
  { path: '/tracking', view: TrackingPage, title: '활동 기록 중', chrome: 'shell', back: true, requiresAuth: true },

  // 기록 목록·상세도 남의 기록을 볼 수 없어야 하므로 로그인을 요구한다.
  { path: '/records', view: RecordsPage, title: '월별 기록', tab: 'records', chrome: 'shell', requiresAuth: true },
  { path: '/records/new', view: RecordCreateFlow, title: '산행 기록', chrome: 'bare', requiresAuth: true },
  { path: '/records/:id', view: RecordDetailPage, title: '산행 상세', tab: 'records', chrome: 'shell', back: true, requiresAuth: true },

  { path: '/badges', view: BadgesPage, title: '배지', tab: 'badges', chrome: 'shell', requiresAuth: true },

  { path: '/login', view: LoginPage, title: '로그인', chrome: 'shell', back: true },
  { path: '/profile', view: ProfilePage, title: '내 정보', tab: 'profile', chrome: 'shell' },
];
