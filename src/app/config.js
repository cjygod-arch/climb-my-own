/**
 * app/config.js — 환경 설정.
 *
 * 저장 방식을 바꾸려면 DATA_SOURCE 한 값만 고친다.
 * features/ 와 domain/ 은 이 파일을 import 하지 않는다 — 결선은 container.js만 안다.
 */

export const DataSource = Object.freeze({
  /** public/data/*.json 읽기 + localStorage 쓰기. 서버 없이 동작한다. */
  STATIC: 'static',
  /** Supabase Postgres. 프로젝트 URL과 anon key가 필요하다. */
  SUPABASE: 'supabase',
});

export const config = Object.freeze({
  appName: 'Climb My Own',

  /** ← 저장 방식 스위치. 이 한 줄이 교체 지점의 전부다. */
  DATA_SOURCE: DataSource.STATIC,

  supabase: {
    /**
     * anon key는 정적 호스팅에 그대로 노출된다. 이는 설계상 정상이며,
     * 실제 방어선은 Postgres의 RLS 정책이다. (supabase/migrations/0002_rls.sql)
     *
     * 값을 채운 뒤 위 DATA_SOURCE를 DataSource.SUPABASE로 바꾸면 전환된다.
     * 둘 중 하나라도 비어 있으면 자동으로 static 모드로 내려간다.
     */
    url: '',
    anonKey: '',

    /**
     * 네이버 로그인용 Edge Function 주소.
     * 네이버는 Supabase 기본 provider가 아니라 브릿지가 필요하다 (카카오·구글은 불필요).
     * 비워두면 네이버 버튼이 안내 메시지를 띄운다.
     */
    naverBridgeUrl: '',
  },

  /** 기록 입력에서 미래 날짜를 막을 때 쓰는 기준 시각 공급자. */
  now: () => new Date().toISOString(),

  /** 'YYYY-MM-DD' 로컬 기준 오늘. UTC로 하루가 밀리지 않도록 로컬 값을 직접 조립한다. */
  today() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  },

  /** 'YYYY-MM' 이번 달 */
  thisMonth() {
    return this.today().slice(0, 7);
  },
});

export const isSupabaseConfigured = () =>
  Boolean(config.supabase.url && config.supabase.anonKey);
