import { chromium, devices } from 'file:///home/chris/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = process.env.HOME + '/gardens-preview-suite';
const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.glb':'model/gltf-binary', '.jpg':'image/jpeg', '.png':'image/png', '.woff2':'font/woff2' };
const srv = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]) === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); } else { res.writeHead(200, {'content-type': mime[path.extname(p)] || 'application/octet-stream'}); res.end(d); } });
}).listen(8792);
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium' });
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto('http://127.0.0.1:8792/', { waitUntil: 'load' });
await page.waitForFunction(() => window.Garden && window.Garden.isReady, null, { timeout: 20000 });
await page.waitForTimeout(3500); // let the bloom finish
// Drive the capture with two touch gestures (gesture cap requires two)
await page.evaluate(() => { window.__wc = 0; window.addEventListener('wheel', () => window.__wc++, { capture: true, passive: true }); });
async function swipeUp() {
  await page.evaluate(async () => {
    for (let i = 0; i < 14; i++) {
      window.dispatchEvent(new WheelEvent('wheel', { deltaY: 80, deltaMode: 0, cancelable: true, bubbles: true }));
      await new Promise(r => setTimeout(r, 30));
    }
  });
}
await page.evaluate(() => {
  window.__fd = []; let prev = performance.now();
  (function rec(t) { window.__fd.push(t - prev); prev = t; requestAnimationFrame(rec); })(prev);
});
await swipeUp(); await page.waitForTimeout(600); await swipeUp();
console.log('wheelCount', await page.evaluate(() => window.__wc));
// wait for blow to start
await page.waitForFunction(() => document.getElementById('wind').classList.contains('on'), null, { timeout: 8000 }).catch(() => errors.push('wind overlay never turned on'));
// count wind streamlines + sample flower motion during the cue beat (the old freeze window)
const nLines = await page.evaluate(() => document.getElementById('windSvg').childElementCount);
const s1 = await page.evaluate(() => { const f = window.__gardens.flowers; return { live: window.__gardens.liveCount(), sx: f.slice(0,50).map(r => r.sx + r.sz + (r.bx||0)) }; });
await page.waitForTimeout(250);
const mid = await page.evaluate(() => ({
  shadowOp: document.getElementById('shadows').style.opacity,
  titleTf: document.getElementById('title').style.transform,
  blowing: document.getElementById('title').classList.contains('blowing'),
  sceneW: document.getElementById('scene').width,
  cssW: document.getElementById('scene').clientWidth,
}));
const frames = await page.evaluate(() => {
  const a = window.__fd.slice(-90);            // ~1.5s window covering the wind arrival
  return { max: Math.max(...a).toFixed(1), over50: a.filter(d => d > 50).length };
});
const s2 = await page.evaluate(() => { const f = window.__gardens.flowers; return { live: window.__gardens.liveCount(), sx: f.slice(0,50).map(r => r.sx + r.sz + (r.bx||0)) }; });
let moved = 0; for (let i = 0; i < 50; i++) if (Math.abs(s1.sx[i] - s2.sx[i]) > 1e-4) moved++;
await page.waitForTimeout(3000);
const revealed = await page.evaluate(() => document.body.classList.contains('revealed'));
// regrow: two distinct upward gestures at the top of the doc
async function swipeDown() {
  await page.evaluate(async () => {
    for (let i = 0; i < 6; i++) {
      window.dispatchEvent(new WheelEvent('wheel', { deltaY: -80, deltaMode: 0, cancelable: true, bubbles: true }));
      await new Promise(r => setTimeout(r, 30));
    }
  });
}
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(300);
await swipeDown(); await page.waitForTimeout(500); await swipeDown();
await page.waitForTimeout(4200);  // bloom ~2.9s + margin
const regrow = await page.evaluate(() => ({
  sceneW: document.getElementById('scene').width,
  cssW: document.getElementById('scene').clientWidth,
  shadowOp: document.getElementById('shadows').style.opacity,
  revealed: document.body.classList.contains('revealed'),
}));
console.log(JSON.stringify({ nLines, frames, mid, live1: s1.live, live2: s2.live, movedOf50: moved, revealed, regrow, errors }, null, 1));
await browser.close(); srv.close();
