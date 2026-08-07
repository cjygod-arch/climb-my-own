/**
 * tools/verify-imports.mjs — 상대 import 경로가 실제로 존재하는지 확인.
 *
 * 빌드 도구가 없으므로 경로 오타는 런타임에야 드러난다.
 * 브라우저에서 404를 만나기 전에 CI가 잡는다.
 *
 * 실행: node tools/verify-imports.mjs
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : full.endsWith('.js') ? [full] : [];
  });
}

const files = walk(join(root, 'src'));
const missing = [];
let checked = 0;

for (const file of files) {
  const source = readFileSync(file, 'utf-8');

  // 정적 import 와 동적 import 를 모두 본다. 절대 URL(https://)은 건너뛴다.
  const patterns = [
    /from\s+['"](\.[^'"]+)['"]/g,
    /import\(\s*(?:\/\*[^*]*\*\/\s*)?['"](\.[^'"]+)['"]\s*\)/g,
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      checked += 1;
      const target = resolve(dirname(file), match[1]);
      if (!existsSync(target)) {
        missing.push(`${relative(root, file).replace(/\\/g, '/')} → ${match[1]}`);
      }
    }
  }
}

// index.html 이 참조하는 CSS 도 확인한다.
const html = readFileSync(join(root, 'index.html'), 'utf-8');
for (const match of html.matchAll(/href="\.\/([^"]+\.css)"/g)) {
  checked += 1;
  if (!existsSync(join(root, match[1]))) missing.push(`index.html → ${match[1]}`);
}

console.log(`import ${checked}건 확인 (파일 ${files.length}개)`);

if (missing.length) {
  console.error(`\n존재하지 않는 경로 ${missing.length}건:`);
  for (const m of missing) console.error(`  ✗ ${m}`);
  process.exit(1);
}

console.log('import 경로 OK');
