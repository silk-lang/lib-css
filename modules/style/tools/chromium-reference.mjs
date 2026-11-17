// Capture browser references for the color/registration unit cases. Node 22+ and Chromium required.
import { spawn } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const profile = mkdtempSync(join(tmpdir(), 'silk-css-reference-'));
const browser = spawn(process.env.CHROMIUM ?? 'chromium', [
  '--headless', '--no-sandbox', '--disable-gpu', '--no-first-run',
  '--disable-background-networking', '--disable-extensions',
  '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });
let socket;
const pending = new Map();
try {
  const endpoint = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Chromium did not expose CDP')), 15000);
    browser.once('error', error => { clearTimeout(timer); reject(error); });
    browser.stderr.on('data', data => {
      const match = String(data).match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
  });
  const pages = await (await fetch(endpoint.replace('ws:', 'http:').replace(/\/devtools\/.*/, '/json'))).json();
  socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let sequence = 0;
  socket.onmessage = event => {
    const result = JSON.parse(event.data);
    const request = pending.get(result.id);
    if (!request) return;
    pending.delete(result.id);
    clearTimeout(request.timer);
    if (result.error) request.reject(result.error);
    else request.resolve(result.result);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => reject(new Error(`CDP timed out: ${method}`)), 10000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
  await send('Page.enable');
  const { frameTree } = await send('Page.getFrameTree');
  await send('Page.setDocumentContent', {
    frameId: frameTree.frame.id,
    html: readFileSync(process.argv[2] ?? new URL('../fixtures/stylesheets/color-reference.html', import.meta.url), 'utf8'),
  });
  const result = await send('Runtime.evaluate', {
    expression: "document.getElementById('results').textContent", returnByValue: true,
  });
  console.log(JSON.stringify(JSON.parse(result.result.value), null, 2));
} finally {
  for (const request of pending.values()) clearTimeout(request.timer);
  socket?.close();
  browser.kill('SIGTERM');
  await new Promise(resolve => browser.once('close', resolve));
  rmSync(profile, { recursive: true, force: true });
}
