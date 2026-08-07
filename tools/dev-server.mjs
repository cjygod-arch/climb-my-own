/**
 * tools/dev-server.mjs — 개발용 정적 서버.
 *
 * python -m http.server 로도 되지만 두 가지 함정이 있다.
 *   1. IPv4에만 바인딩된다. Windows에서 localhost는 ::1(IPv6)로 먼저 해석되어
 *      브라우저에 따라 연결이 실패한다.
 *   2. 캐시 헤더를 보내지 않아 브라우저가 옛 JS·CSS를 붙잡는다.
 *      빌드 단계가 없는 이 프로젝트에서는 이게 "고쳤는데 화면이 그대로"의 주범이다.
 *
 * 이 서버는 두 스택 모두에서 듣고, 모든 응답에 no-store를 붙인다.
 *
 * 실행: node tools/dev-server.mjs [포트]
 */

import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(join(dirname(fileURLToPath(import.meta.url)), '..'));
const port = Number(process.argv[2]) || 5173;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith('/')) pathname += 'index.html';

  // 루트 밖으로 나가는 경로 요청을 막는다.
  const target = normalize(join(root, pathname));
  if (!target.startsWith(root + sep) && target !== root) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  let stat;
  try {
    stat = statSync(target);
    if (stat.isDirectory()) throw new Error('directory');
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`404 ${pathname}`);
    console.log(`404 ${pathname}`);
    return;
  }

  res.writeHead(200, {
    'Content-Type': MIME[extname(target).toLowerCase()] ?? 'application/octet-stream',
    'Content-Length': stat.size,
    // 개발 중에는 절대 캐시하지 않는다. 강력 새로고침을 잊어도 최신 코드가 온다.
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    Pragma: 'no-cache',
  });

  createReadStream(target).pipe(res);
});

// '::' 로 들으면 IPv6와 IPv4(::ffff: 매핑) 양쪽을 모두 받는다.
// 그래서 localhost(::1)와 127.0.0.1 어느 쪽으로 들어와도 응답한다.
server.listen(port, '::', () => {
  console.log(`Climb My Own 개발 서버`);
  console.log(`  http://localhost:${port}/`);
  console.log(`  http://127.0.0.1:${port}/`);
  console.log(`  (캐시 없음 — 파일을 고치면 새로고침만으로 반영됩니다)`);
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`포트 ${port}이(가) 이미 사용 중입니다. 기존 서버를 끄거나 다른 포트를 지정하세요.`);
    console.error(`  node tools/dev-server.mjs 5180`);
  } else {
    console.error(e);
  }
  process.exit(1);
});
