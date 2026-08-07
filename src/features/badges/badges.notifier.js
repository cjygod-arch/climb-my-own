/**
 * features/badges/badges.notifier.js — 배지 획득 알림 등록.
 *
 * 왜 이 파일이 있는가:
 * 기록을 저장한 화면(features/records)이 배지 시트를 직접 띄우면
 * features 간 직접 의존이 생긴다 (ARCHITECTURE.md R5 위반).
 * 대신 records 서비스는 eventBus에 사실만 발행하고, 그것을 듣는 책임을
 * badges 기능이 스스로 진다. 발행자는 구독자가 있는지조차 모른다.
 *
 * bootstrap에서 앱 시작 시 1회 등록한다.
 */

import { subscribe } from '../../core/eventBus.js';
import { Topic } from '../../domain/events.js';
import { BadgeEarnedSheet } from './ui/BadgeEarnedSheet.js';

/** @returns {() => void} 구독 해제 */
export function registerBadgeNotifier() {
  return subscribe(Topic.BADGES_EARNED, (badges) => {
    if (!Array.isArray(badges) || badges.length === 0) return;
    BadgeEarnedSheet({ badges });
  });
}
