import { chromium } from 'file:///home/chris/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = process.env.HOME + '/gardens-preview-suite';
const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.glb':'model/gltf-binary', '.jpg':'image/jpeg', '.png':'image/png', '.woff2':'font/woff2' };
const srv = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]) === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); } else { res.writeHead(200, {'content-type': mime[path.extname(p)] || 'application/octet-stream'}); res.end(d); } });
}).listen(8794);
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--use-gl=angle'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
page.on('pageerror', e => console.error('pageerror', e.message));
await page.goto('http://127.0.0.1:8794/', { waitUntil: 'load' });
await page.waitForFunction(() => window.Garden && window.Garden.isReady && window.__gardens, null, { timeout: 30000 });
await page.waitForTimeout(4000);  // bloom fully
const out = await page.evaluate(async () => {
  const THREE = await import('/vendor/three.module.js');
  const F = window.__gardens.flowers;
  let scn = F[0].mesh; while (scn.parent) scn = scn.parent;
  const banner = document.getElementById('banner');
  const W = 1000, H = Math.round(W * banner.clientHeight / banner.clientWidth);
  const halfW = (window.GARDENS_LOGO && window.GARDENS_LOGO.halfW) || 11;
  const halfH = halfW * H / W;
  const cam = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 100);
  cam.position.set(0, 40, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0);
  cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  const cnv = document.createElement('canvas');
  const rend = new THREE.WebGLRenderer({ canvas: cnv, antialias: false, alpha: false, preserveDrawingBuffer: true });
  rend.outputColorSpace = THREE.LinearSRGBColorSpace;
  rend.setPixelRatio(1); rend.setSize(W, H, false);
  rend.setClearColor(0x000000, 1);
  const meshes = [...new Set(F.map(r => r.mesh))];
  const saved = meshes.map(m => ({ m, mat: m.material, ic: m.instanceColor }));
  const idx = new Map(); F.forEach((r, i) => idx.set(r.mesh.uuid + ':' + r.instanceId, i));
  for (const m of meshes) {
    const n = m.count, colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const fi = idx.get(m.uuid + ':' + i);
      const gid = fi === undefined ? 65535 : fi;
      colors[i*3] = (gid & 255) / 255; colors[i*3+1] = ((gid >> 8) & 255) / 255; colors[i*3+2] = 1;
    }
    m.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
    m.material = new THREE.MeshBasicMaterial({ color: 0xffffff });
  }
  const hidden = [];
  scn.traverse(o => { if (o.isMesh && meshes.indexOf(o) < 0 && o.visible) { o.visible = false; hidden.push(o); } });
  rend.render(scn, cam);
  const gl = rend.getContext();
  const buf = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  saved.forEach(s => { s.m.material = s.mat; s.m.instanceColor = s.ic; });
  hidden.forEach(o => o.visible = true);
  rend.dispose();
  const counts = new Array(F.length).fill(0);
  let stray = 0;
  for (let p = 0; p < buf.length; p += 4) {
    if (buf[p+2] > 200) {
      const gid = buf[p] + (buf[p+1] << 8);
      if (gid < F.length) counts[gid]++; else stray++;
    }
  }
  // calibrate full footprint per species: max count/sc^2 among that species
  const perSp = {};
  F.forEach((r, i) => {
    const k = r.sp; const a = counts[i] / (r.sc * r.sc);
    if (!perSp[k] || a > perSp[k]) perSp[k] = a;
  });
  const frac = F.map((r, i) => counts[i] / (perSp[r.sp] * r.sc * r.sc));
  return { total: F.length, stray,
    distinct: counts.filter(c => c > 0).length,
    zero: counts.filter(c => c === 0).length,
    counts, frac: frac.map(x => +x.toFixed(3)),
    sc: F.map(r => +r.sc.toFixed(2)) };
});
const th = [0.02, 0.05, 0.10, 0.15, 0.25, 0.40];
console.log('total', out.total, 'renderedVisible', out.distinct, 'fullyHidden', out.zero, 'strayPx', out.stray);
for (const t of th) console.log(`vis<${(t*100).toFixed(0)}%: ${out.frac.filter(f => f < t).length} flowers`);
const px = [1, 4, 10, 25, 60];
for (const t of px) console.log(`<${t}px visible: ${out.counts.filter(c => c < t).length} flowers`);
fs.writeFileSync('vis.json', JSON.stringify(out));
await browser.close(); srv.close();
