import { chromium } from 'file:///home/chris/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = process.env.HOME + '/gardens-preview-suite';
const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.glb':'model/gltf-binary', '.png':'image/png', '.woff2':'font/woff2' };
const srv = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]) === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); } else { res.writeHead(200, {'content-type': mime[path.extname(p)] || 'application/octet-stream'}); res.end(d); } });
}).listen(8796);
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium' });
for (const q of ['', '?flowers=lite', '?flowers=xlite']) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:8796/' + q, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__gardens, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  const n = await page.evaluate(() => window.__gardens.flowers.length);
  console.log(q || '(default)', '->', n, 'flowers', errs.length ? 'ERRORS: ' + errs : 'ok');
  await page.close();
}
await browser.close(); srv.close();
