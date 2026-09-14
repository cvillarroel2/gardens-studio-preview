// Private, opt-in physical Safari probe. No rendering or physics modifications.
(() => {
  const query = new URLSearchParams(location.search);
  if (query.get('perf') !== '1') return;
  const phases = ['idle', 'light stir', 'hard swipe', 'reversal', 'wind/settle', 'reveal', 'regrow'];
  const quick = query.get('quick') === '1';
  const schedule = [[0,'idle'],[2000,'light stir'],[6000,'hard swipe'],[11000,'reversal'],[16000,'wind/settle'],[19000,'reveal'],[22000,'regrow']];
  const panel = document.createElement('aside');
  panel.style.cssText = 'position:fixed;z-index:99999;top:4px;left:8px;right:8px;background:#fffef4;color:#111;border:1px solid #555;padding:6px;font:12px monospace;white-space:pre-wrap;max-height:30vh;overflow:auto';
  const start = document.createElement('button'), save = document.createElement('button'), output = document.createElement('div');
  for (const b of [start,save]) b.style.cssText = 'font:14px monospace;padding:7px';
  save.textContent = 'Export JSON'; panel.append(start, save, output); document.body.append(panel);
  let phase = Math.max(0, phases.indexOf(query.get('phase'))), active = null;
  const reports = [], versions = {};
  window.__gardensPerf = reports;
  const sourceNames = ['garden.js', 'scroll.js'];
  // Exact known engine versions are available even on private HTTP where
  // crypto.subtle may be unavailable. Served-byte SHA256 is added on HTTPS.
  versions.expected = {"garden.js": "be96fa824c78391fb0ca1636205fe515f5bc7b2d6472ab0687ad2df7cfe59b83", "scroll.js": "36b913c21e0d1a83b16fdedc8ba5f36ac0127186eabc12ad5ca39fc5cc66069d"};
  if (crypto.subtle) Promise.all(sourceNames.map(async name => {
    const bytes = await (await fetch(name, {cache:'no-store'})).arrayBuffer();
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    versions[name] = [...new Uint8Array(hash)].map(x => x.toString(16).padStart(2,'0')).join('');
  })).catch(e => { versions.error = String(e); });
  function environment() {
    const g = window.__gardens;
    return {width:innerWidth,height:innerHeight,dpr:devicePixelRatio,flowers:g?.flowers.length ?? null,canvas:g?[g.renderer.domElement.width,g.renderer.domElement.height]:null,ua:navigator.userAgent,query:location.search,thermal:'unknown',lowPower:'unknown',source:versions};
  }
  function label() { start.textContent = quick ? 'Start 26s finger check' : 'Measure ' + phases[phase] + ' (8s)'; }
  function phaseAt(t) { return quick ? schedule.filter(([at]) => t >= at).at(-1)[1] : phases[phase]; }
  function summary() { output.textContent = `${environment().flowers ?? '?'} flowers · ${innerWidth}×${innerHeight} DPR ${devicePixelRatio}\nengine be96fa824c78 / 36b913c21e0d\n`+reports.map(r => `${r.phase}: n${r.n} p50 ${r.p50.toFixed(1)} p95 ${r.p95.toFixed(1)} max ${r.max.toFixed(1)}\ntrusted touchmove ${r.trustedMoves} / all ${r.moves}; wheel ${r.wheels}`).join('\n'); }
  label(); summary();
  addEventListener('garden-ready', summary, {once:true});
  function bucket() {
    const name=phaseAt(performance.now()-active.started);
    return active.buckets[name] ||= {phase:name,frames:[],events:[],moves:0,trustedMoves:0,wheels:0,distance:0};
  }
  for (const type of ['touchstart','touchmove','touchend','touchcancel','wheel']) addEventListener(type, e => {
    if (!active || panel.contains(e.target)) return;
    const b=bucket(), t=e.touches?.[0] || e.changedTouches?.[0];
    b.events.push({type,trusted:e.isTrusted,t:performance.now()-active.started,x:t?.clientX,y:t?.clientY,deltaY:e.deltaY});
    if (type==='wheel') b.wheels++;
    if (type==='touchmove') { b.moves++; if(e.isTrusted)b.trustedMoves++; if(t && Number.isFinite(active.x))b.distance+=Math.hypot(t.clientX-active.x,t.clientY-active.y); }
    if(t){active.x=t.clientX;active.y=t.clientY;}
    if(type==='touchend'||type==='touchcancel'){active.x=undefined;active.y=undefined;}
  }, {capture:true,passive:true});
  start.addEventListener('click', e => {
    e.stopPropagation(); if(active)return;
    const sample=active={started:performance.now(),buckets:{}}; start.disabled=true;
    let last;
    function frame(now) {
      const b=bucket(), elapsed=now-sample.started;
      if(last!==undefined)b.frames.push({t:elapsed,dt:now-last}); last=now;
      start.textContent=`${b.phase} · ${Math.max(0,Math.ceil(((quick?26000:8000)-elapsed)/1000))}s · touch ${b.trustedMoves}`;
      if(elapsed<(quick?26000:8000)){requestAnimationFrame(frame);return;}
      for(const b of Object.values(sample.buckets)){
        const a=b.frames.map(f=>f.dt).sort((a,b)=>a-b), pct=p=>a[Math.min(a.length-1,Math.floor(a.length*p))]||0;
        reports.push({...b,n:a.length,p50:pct(.5),p95:pct(.95),max:a.at(-1)||0,over33:a.filter(x=>x>33.4).length,environment:environment()});
      }
      active=null;phase=(phase+1)%phases.length;label();start.disabled=false;summary();
    }
    requestAnimationFrame(frame);
  });
  save.addEventListener('click', e => {
    e.stopPropagation(); const blob=new Blob([JSON.stringify({kind:'device-rAF-intervals-not-GPU-time',environment:environment(),reports},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob), a=document.createElement('a');a.href=url;a.download='gardens-finger-validation.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
})();
