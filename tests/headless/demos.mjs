import { chromium } from 'file:///home/chris/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = process.env.HOME + '/gardens-preview-suite';
const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.glb':'model/gltf-binary', '.png':'image/png', '.woff2':'font/woff2' };
const srv = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]) === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); } else { res.writeHead(200, {'content-type': mime[path.extname(p)] || 'application/octet-stream'}); res.end(d); } });
}).listen(8797);
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 700 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
for (const type of ['slow-short','fast-flick','fast-long-outside','veryfast-diag-outside','whip-outside','cross-exit','multi']) {
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(`http://127.0.0.1:8797/?demo=swipe&type=${type}&pointer=touch`, { waitUntil: 'load' });
  let report = null;
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(1000);
    report = await page.evaluate(() => window.__gardens && window.__gardens.demo && window.__gardens.demo.report);
    if (report) break;
  }
  console.log(type.padEnd(22), report ? `coverage=${report.coverage} covered=${report.covered}/${report.expected} peakTilt=${report.peakTilt}` : 'TIMEOUT', errs.length ? 'ERRORS:' + errs : '');
  await page.close();
}
await browser.close(); srv.close();
