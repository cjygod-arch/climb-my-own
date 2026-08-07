/**
 * tools/build-icons.mjs — icons/icon.svg → 홈 화면 설치용 PNG.
 *
 * 왜 PNG가 필요한가:
 * Android는 manifest의 SVG 아이콘을 받아주는 경우가 있지만 고르지 않고,
 * iOS의 apple-touch-icon은 PNG만 받는다. 설치 아이콘은 확실한 쪽으로 굽는다.
 *
 * 이미지 라이브러리를 새로 들이지 않고 이미 있는 Chrome을 쓴다.
 * SVG를 정확한 크기로 띄워 스크린샷을 뜨는 방식이라 결과가 브라우저 렌더링과 동일하다.
 *
 * 실행:
 *   1) Chrome을 디버깅 포트로 띄운다
 *      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe" \
 *        --headless=new --remote-debugging-port=9333 --user-data-dir=/tmp/cicon about:blank
 *   2) node tools/build-icons.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const iconsDir = join(root, 'icons');
mkdirSync(iconsDir, { recursive: true });

const svg = readFileSync(join(iconsDir, 'icon.svg'), 'utf-8');

/**
 * 구울 아이콘 목록.
 *
 * maskable은 안드로이드가 원형·둥근사각 등 임의의 모양으로 잘라낸다.
 * 가장자리 잘림을 감안해 안쪽 80%(안전 영역)에만 그림이 들어가도록 여백을 준다.
 * 여백 없이 그대로 쓰면 봉우리 끝이 잘린다.
 */
const TARGETS = [
  { file: 'icon-192.png', size: 192, padding: 0 },
  { file: 'icon-512.png', size: 512, padding: 0 },
  { file: 'icon-maskable-512.png', size: 512, padding: 0.1 },
  // iOS는 자체적으로 모서리를 둥글게 처리하므로 여백 없이 꽉 채운다.
  { file: 'apple-touch-icon.png', size: 180, padding: 0 },
];

const ENDPOINT = 'http://127.0.0.1:9333';

async function connect() {
  const res = await fetch(`${ENDPOINT}/json/version`).catch(() => null);
  if (!res?.ok) {
    console.error('Chrome 디버깅 포트(9333)에 연결하지 못했습니다.');
    console.error('먼저 Chrome을 --headless=new --remote-debugging-port=9333 으로 띄워 주세요.');
    process.exit(1);
  }
  const { webSocketDebuggerUrl } = await res.json();
  const ws = new WebSocket(webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));

  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
    }
  });

  const send = (method, params = {}, sessionId) => {
    const i = ++id;
    return new Promise((resolve, reject) => {
      pending.set(i, { resolve, reject });
      ws.send(JSON.stringify({ id: i, method, params, sessionId }));
    });
  };

  return { ws, send };
}

const { ws, send } = await connect();
const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Page.enable', {}, sessionId);

for (const { file, size, padding } of TARGETS) {
  const inset = Math.round(size * padding);
  const inner = size - inset * 2;

  // 배경을 아이콘 색으로 채우고 그 위에 여백을 준 SVG를 얹는다.
  // 투명 배경을 남기면 iOS에서 검게 나온다.
  const html = `<!doctype html><meta charset="utf-8">
<style>
  html,body{margin:0;padding:0;background:#3182F6}
  .wrap{width:${size}px;height:${size}px;background:#3182F6;display:flex;align-items:center;justify-content:center;overflow:hidden}
  svg{width:${inner}px;height:${inner}px;display:block}
</style>
<div class="wrap">${svg.replace(/width="512" height="512"/, '')}</div>`;

  await send('Emulation.setDeviceMetricsOverride',
    { width: size, height: size, deviceScaleFactor: 1, mobile: false }, sessionId);
  await send('Page.navigate', { url: 'data:text/html;charset=utf-8,' + encodeURIComponent(html) }, sessionId);
  await new Promise((r) => setTimeout(r, 350));

  const shot = await send('Page.captureScreenshot',
    { format: 'png', clip: { x: 0, y: 0, width: size, height: size, scale: 1 } }, sessionId);

  writeFileSync(join(iconsDir, file), Buffer.from(shot.data, 'base64'));
  console.log(`  ✓ ${file} (${size}x${size}${padding ? `, 안전 여백 ${Math.round(padding * 100)}%` : ''})`);
}

console.log('\n아이콘 생성 완료');
ws.close();
process.exit(0);
