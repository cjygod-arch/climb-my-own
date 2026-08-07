/**
 * data/local/localTable.js — localStorage 기반 미니 테이블.
 *
 * 폴더 이름이 'memory'가 아니라 'local'인 이유:
 * 순수 인메모리로 두면 새로고침마다 기록이 사라져 데모가 성립하지 않는다.
 * 영속성이 있어야 월별 누적·배지 판정을 실제로 확인할 수 있다.
 *
 * 이 파일은 도메인을 모른다. 그냥 { id } 를 가진 행을 저장할 뿐이다.
 * Supabase로 전환하면 이 폴더 전체가 쓰이지 않는다 — 삭제해도 앱이 동작한다.
 */

const PREFIX = 'cmo';

/**
 * @param {string} name 테이블 이름
 */
export function createLocalTable(name) {
  const key = `${PREFIX}:${name}`;

  function read() {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      // 손상된 값이 남아 있어도 앱은 계속 동작해야 한다.
      return [];
    }
  }

  function write(rows) {
    try {
      localStorage.setItem(key, JSON.stringify(rows));
      return true;
    } catch {
      return false;
    }
  }

  return {
    list: () => read(),

    get: (id) => read().find((row) => row.id === id) ?? null,

    find: (predicate) => read().filter(predicate),

    /** id가 없으면 만들어 붙이고, 있으면 덮어쓴다. 저장된 행을 돌려준다. */
    upsert(row) {
      const rows = read();
      const id = row.id || newId();
      const next = { ...row, id };
      const index = rows.findIndex((r) => r.id === id);
      if (index === -1) rows.push(next);
      else rows[index] = next;
      write(rows);
      return next;
    },

    /** 여러 행을 한 번에. 이미 있는 id는 건너뛴다(멱등). */
    insertMissing(newRows) {
      const rows = read();
      const existing = new Set(rows.map((r) => r.id));
      const added = newRows.filter((r) => !existing.has(r.id));
      if (added.length) write([...rows, ...added]);
      return added;
    },

    remove(id) {
      const rows = read();
      const next = rows.filter((r) => r.id !== id);
      if (next.length === rows.length) return false;
      write(next);
      return true;
    },

    clear: () => write([]),
  };
}

export function newId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
