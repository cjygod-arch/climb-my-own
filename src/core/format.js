/**
 * core/format.js — 표시용 포매터.
 *
 * 계기판 원칙: 자릿수가 흔들리지 않아야 한다. 소수 자릿수를 고정한다.
 * 도메인을 모른다 — '거리'는 알아도 '등산 거리'는 모른다.
 */

const LOCALE = 'ko-KR';

/** 정수를 천 단위 구분해서. 예: 1284 → "1,284" */
export function int(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return Math.round(n).toLocaleString(LOCALE);
}

/** 소수 자릿수 고정. 예: dec(12.3456, 1) → "12.3" */
export function dec(value, digits = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** 거리(km). 100 미만은 소수 1자리, 이상은 정수 — 자릿수 폭을 일정하게 유지. */
export function km(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n < 100 ? dec(n, 1) : int(n);
}

/** 고도/거리(m) */
export function meters(value) {
  return int(value);
}

/** 분 → "3시간 20분" / "45분" */
export function duration(minutes) {
  const n = Number(minutes);
  if (!Number.isFinite(n) || n < 0) return '—';
  const h = Math.floor(n / 60);
  const m = Math.round(n % 60);
  if (h === 0) return `${m}분`;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}

/** 분 → "3:20" (수치 표시용, 고정폭) */
export function clock(minutes) {
  const n = Number(minutes);
  if (!Number.isFinite(n) || n < 0) return '—';
  const h = Math.floor(n / 60);
  const m = Math.round(n % 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}

/**
 * ISO 날짜(YYYY-MM-DD) → "2026. 03. 14."
 * Date 객체를 만들지 않는다 — 타임존 때문에 하루가 밀리는 사고를 원천 차단.
 */
export function date(iso) {
  const parts = parseIsoDate(iso);
  if (!parts) return '—';
  const { y, m, d } = parts;
  return `${y}. ${pad2(m)}. ${pad2(d)}.`;
}

/** ISO 날짜 → "3월 14일" */
export function dateShort(iso) {
  const parts = parseIsoDate(iso);
  if (!parts) return '—';
  return `${parts.m}월 ${parts.d}일`;
}

/** ISO 날짜 → "토" */
export function weekday(iso) {
  const parts = parseIsoDate(iso);
  if (!parts) return '';
  const dt = new Date(Date.UTC(parts.y, parts.m - 1, parts.d));
  return ['일', '월', '화', '수', '목', '금', '토'][dt.getUTCDay()];
}

/** "2026-03" → "2026년 3월" */
export function monthLabel(ym) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(ym ?? ''));
  if (!match) return '—';
  return `${match[1]}년 ${Number(match[2])}월`;
}

/** "2026-03" → "3월" */
export function monthShort(ym) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(ym ?? ''));
  return match ? `${Number(match[2])}월` : '—';
}

/** 0~1 → "62%" */
export function percent(ratio) {
  const n = Number(ratio);
  if (!Number.isFinite(n)) return '—';
  return `${Math.round(n * 100)}%`;
}

/** "3 / 10" 형태의 진행 표시 */
export function progress(current, total) {
  return `${int(current)} / ${int(total)}`;
}

function parseIsoDate(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

function pad2(n) {
  return String(n).padStart(2, '0');
}
