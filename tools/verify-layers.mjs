/**
 * tools/verify-layers.mjs — 아키텍처 규칙 검사.
 *
 * docs/ARCHITECTURE.md 의 금지 규칙을 기계가 확인한다.
 * 문서에만 적힌 규칙은 결국 깨진다. CI가 막아야 규칙이 된다.
 *
 * 주석은 검사에서 제외한다 — 규칙을 설명하는 주석이 위반으로 잡히면 안 된다.
 *
 * 실행: node tools/verify-layers.mjs
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'src');

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : full.endsWith('.js') ? [full] : [];
  });
}

/** 주석과 문자열 리터럴을 지운다. 규칙을 설명하는 문장이 위반으로 잡히지 않게. */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')  // 블록 주석
    .replace(/(^|[^:])\/\/.*$/gm, '$1'); // 줄 주석 (URL의 // 는 앞에 : 가 있어 살아남는다)
}

const files = walk(srcDir).map((f) => ({
  path: f,
  rel: relative(root, f).replace(/\\/g, '/'),
  code: stripComments(readFileSync(f, 'utf-8')),
}));

const violations = [];

const check = (rule, predicate, message) => {
  for (const file of files) {
    if (predicate(file)) violations.push(`[${rule}] ${file.rel} — ${message}`);
  }
};

// R1 — features/**/ui/ 는 data/ 를 import 하지 않는다
check(
  'R1',
  (f) => f.rel.includes('/features/') && f.rel.includes('/ui/') && /from\s+['"][^'"]*\/data\//.test(f.code),
  'UI가 data/ 를 직접 import 한다. 서비스와 포트를 경유할 것',
);

// R2 — domain/ 은 DOM·I/O를 모른다
check(
  'R2',
  (f) => f.rel.startsWith('src/domain/') && /\b(document|window|fetch|localStorage)\b/.test(f.code),
  'domain이 DOM/I·O를 사용한다. 순수 함수로 유지할 것',
);

// R3 — core/ 에 도메인 용어가 등장하지 않는다
check(
  'R3',
  (f) => f.rel.startsWith('src/core/') && /\b(mountain|course|badge|hike)/i.test(f.code),
  'core에 도메인 용어가 있다. core는 다음 프로젝트에도 그대로 복사될 수 있어야 한다',
);

// R5 — features 간 직접 import 금지
check(
  'R5',
  (f) => {
    if (!f.rel.startsWith('src/features/')) return false;
    const feature = f.rel.split('/')[2];
    const imports = [...f.code.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
    return imports.some((p) => {
      const m = /(?:^|\/)features\/([^/]+)\//.exec(p) ?? /\.\.\/\.\.\/([a-z]+)\//.exec(p);
      if (!m) return false;
      const target = m[1];
      // core/shared/domain/app은 어디서든 쓸 수 있다.
      if (['core', 'shared', 'domain', 'app'].includes(target)) return false;
      return target !== feature;
    });
  },
  '다른 기능을 직접 import 한다. eventBus 또는 서비스 주입을 쓸 것',
);

// R7 — DB 컬럼명은 data/ 밖으로 나가지 않는다
const DB_COLUMNS = /\b(elevation_m|mountain_id|hiked_on|badge_code|is_official|owner_id|cum_distance_km|name_hanja|course_id|user_id|distance_km|ascent_m|duration_min|best_season|data_source|source_record_id|earned_at|created_at|course_type)\b/;
check(
  'R7',
  (f) => !f.rel.startsWith('src/data/') && DB_COLUMNS.test(f.code),
  'DB 컬럼명(snake_case)이 data/ 밖에 있다. mappers에서 변환할 것',
);

// R8 — 지도 라이브러리는 shared/ui 어댑터 안에서만
check(
  'R8',
  (f) => !f.rel.startsWith('src/shared/ui/') && /leaflet/i.test(f.code),
  '지도 라이브러리를 직접 사용한다. shared/ui/RouteMap.js 를 경유할 것',
);

console.log(`검사 대상 ${files.length}개 파일`);

if (violations.length) {
  console.error(`\n규칙 위반 ${violations.length}건:`);
  for (const v of violations) console.error(`  ✗ ${v}`);
  console.error('\n규칙 설명: docs/ARCHITECTURE.md');
  process.exit(1);
}

console.log('아키텍처 규칙 OK');
