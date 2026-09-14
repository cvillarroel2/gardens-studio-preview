import { chromium } from 'file:///home/chris/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = process.env.HOME + '/gardens-preview-suite';
const vis = JSON.parse(fs.readFileSync('vis.json', 'utf8'));
const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.glb':'model/gltf-binary', '.jpg':'image/jpeg', '.png':'image/png', '.woff2':'font/woff2' };
const srv = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]) === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); } else { res.writeHead(200, {'content-type': mime[path.extname(p)] || 'application/octet-stream'}); res.end(d); } });
}).listen(8795);
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--use-gl=angle'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
await page.goto('http://127.0.0.1:8795/', { waitUntil: 'load' });
await page.waitForFunction(() => window.Garden && window.Garden.isReady, null, { timeout: 30000 });
await page.waitForTimeout(4200);
const banner = page.locator('#banner');
async function replantAndShoot(keepIdx, name) {
  await page.evaluate(async (keep) => {
    const j = await fetch((window.GARDENS_VARIANT && window.GARDENS_VARIANT.layout) || 'assets/flowers_stacked.json').then(r => r.json());
    const list = keep ? keep.map(i => j.flowers[i]) : j.flowers;
    const halfW = (window.GARDENS_LOGO && window.GARDENS_LOGO.halfW) || 11;
    window.Garden.replant(list, { halfW });
    window.Garden.bloomIn();
  }, keepIdx);
  await page.waitForTimeout(4200);
  await banner.screenshot({ path: name });
}
await banner.screenshot({ path: 'orig.png' });
const all = vis.frac.map((f, i) => i);
await replantAndShoot(all, 'control.png');
for (const t of [0.15, 0.25, 0.40]) {
  const keep = vis.frac.map((f, i) => [f, i]).filter(x => x[0] >= t).map(x => x[1]);
  console.log(`threshold ${t}: keeping ${keep.length} of ${vis.total}`);
  await replantAndShoot(keep, `cull${t}.png`);
}
await browser.close(); srv.close();
