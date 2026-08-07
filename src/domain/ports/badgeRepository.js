/**
 * domain/ports/badgeRepository.js — 배지 인터페이스.
 *
 * 판정은 domain/rules/badgeRules.js가 한다. 이 포트는 마스터 조회와 획득 기록 저장만 한다.
 * 다중 사용자 단계에서 판정을 Postgres 함수로 옮겨도 이 포트 모양은 그대로다.
 *
 * @interface BadgeRepository
 *
 * @property {() => Promise<Result<Badge[]>>} listAll
 *   배지 마스터 전체(공개 데이터).
 *
 * @property {() => Promise<Result<EarnedBadge[]>>} listEarned
 *   현재 사용자가 획득한 배지.
 *
 * @property {(codes: string[], sourceRecordId: string|null) => Promise<Result<EarnedBadge[]>>} award
 *   여러 배지를 한 번에 부여한다. 이미 획득한 코드는 조용히 무시한다(멱등).
 *   기록 저장 직후 findNewlyEarned()의 결과를 그대로 넘기게 되어 있다.
 */

export const BADGE_REPOSITORY_METHODS = Object.freeze(['listAll', 'listEarned', 'award']);
