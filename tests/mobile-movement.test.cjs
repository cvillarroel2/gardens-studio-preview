// Exercise the shipped closure with a deterministic clock and DOM, no production hooks.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('scroll.js', 'utf8');
function rig({ bloom = true, reduce = false, desktop = false } = {}) {
  let now = 1000, serial = 0;
  const raf = new Map(), timers = [], events = {}, gusts = [];
  const element = () => ({ style: {}, classList: { add() {}, remove() {} } });
  const title = element(), banner = { ...element(), getBoundingClientRect: () => ({left:5.8515625,right:384.1484375,top:194.9609375,bottom:505.0390625}) };
  const document = { body: element(), documentElement: element(), addEventListener() {}, hidden:false };
  const window = { innerHeight:desktop?900:700, innerWidth:desktop?1440:390, matchMedia:()=>({matches:reduce}),
    addEventListener:(n,f)=>events[n]=f, setTimeout:(f,t)=>timers.push({f,t}),
    gardensStudioGust:(...g)=>gusts.push(g) };
  const context = vm.createContext({ window, document, performance:{now:()=>now},
    fetch:()=>Promise.resolve({json:()=>Promise.resolve({flowers:[]})}),
    requestAnimationFrame:f=>{raf.set(++serial,f);return serial}, cancelAnimationFrame:id=>raf.delete(id),
    clearTimeout(){}, console });
  vm.runInContext(source.replace(/\}\)\(\);\s*$/, `window.test = {
    start:onTouchStart, move:onTouchMove, end:onTouchEnd, cancel:cancelTouch,
    wheel:onWheel, key:onKey, bloom:()=>bloomed=true,
    setup:()=>{body=document.body;titleWrap=window.title;banner=window.banner;computeMetrics();},
    state:()=>({p,pDisplay,mode,v:touch.v,a:touch.a,on:touch.on}),
    at:(n)=>{p=n;pDisplay=n;}, mode:(m)=>{mode=m;}, reduced:reduceMQ
  };})();`), context);
  window.title=title;window.banner=banner;const api=window.test;api.setup();if(bloom)api.bloom();
  function event(kind, points, dt=16) {
    now+=dt;
    const list=points.map(([identifier,x,y])=>({identifier,clientX:x,clientY:y}));
    api[kind]({type:'touch'+kind,timeStamp:now,touches:kind==='end'?[]:list,changedTouches:list,cancelable:true,preventDefault(){}});
  }
  function frames(hz=60) { for(let n=0;raf.size && n<2000;n++){now+=1000/hz;const tasks=[...raf.values()];raf.clear();tasks.forEach(f=>f(now));} }
  return {api,event,frames,gusts,raf,timers,title,clock:dt=>now+=dt, tick:()=>{const tasks=[...raf.values()];raf.clear();tasks.forEach(f=>f(now))}};
}
test('direct distance at all sample rates, short inputs and boundary whispers',()=>{
  for(const hz of [30,60,120,240]) {
    const r=rig();r.event('start',[[1,195,650]],0);
    for(let i=1;i<=hz;i++){r.event('move',[[1,195,650-100*i/hz]],1000/hz);assert.ok(Math.abs(r.api.state().p-100*i/hz/245)<1e-10);assert.equal(r.api.state().p,r.api.state().pDisplay)}
    assert.ok(r.gusts.length);
  }
  for(const [x,y] of [[195,651],[196,650],[195,649.9]]) {const r=rig();r.event('start',[[1,195,650]]);r.event('move',[[1,x,y]]);assert.equal(r.gusts.length,1)}
});
test('bloom lock, failsafe, flower lifetime and fresh outside finger',()=>{
  const r=rig({bloom:false});r.event('start',[[1,195,650]]);r.event('move',[[1,195,600]]);assert.equal(r.api.state().p,0);
  r.timers.find(t=>t.t===4500).f();r.event('move',[[1,195,590]]);assert.ok(Math.abs(r.api.state().p-10/245)<1e-10);
  const f=rig();f.event('start',[[1,195,350]]);f.event('move',[[1,195,50]]);f.event('end',[[1,195,0]]);f.frames();assert.equal(f.api.state().p,0);assert.equal(f.gusts.length,0);
  f.event('start',[[2,195,650]]);f.event('move',[[2,195,640]]);assert.ok(f.api.state().p>0);
});
test('release consumes final position; held and cancelled gestures do not fling',()=>{
  const r=rig();r.event('start',[[1,195,650]]);r.event('end',[[1,195,600]],40);assert.ok(Math.abs(r.api.state().p-50/245)<1e-10);r.frames();assert.ok(r.api.state().p>50/245);
  for(const finish of ['hold','cancel']){const r=rig();r.event('start',[[1,195,650]]);r.event('move',[[1,195,600]],30);if(finish==='hold')r.event('end',[[1,195,600]],100);else r.api.cancel();r.frames();assert.ok(Math.abs(r.api.state().p-50/245)<1e-10)}
});
test('touch identifiers prevent second-finger jumps and premature release',()=>{
  const r=rig();r.event('start',[[1,195,650]]);r.event('start',[[2,195,200],[1,195,650]]);r.event('move',[[2,195,100],[1,195,640]]);assert.ok(Math.abs(r.api.state().p-10/245)<1e-10);
  r.event('end',[[2,195,100]]);assert.equal(r.api.state().on,true);r.event('move',[[1,195,630]]);assert.ok(Math.abs(r.api.state().p-20/245)<1e-10);
});
test('analytic fling distance is independent of refresh rate and stalled frames',()=>{
 const values=[];for(const hz of [4,30,60,120,240]){const r=rig();r.event('start',[[1,195,650]]);r.event('move',[[1,195,610]],80);r.event('end',[[1,195,610]],0);r.frames(hz);values.push(r.api.state().p)}
 assert.ok(Math.max(...values)-Math.min(...values)<1e-10);
});
test('acceleration estimates endpoint speed consistently across event rates',()=>{
 const velocities=[];for(const hz of [30,60,120,240]){const r=rig();r.event('start',[[1,195,650]],0);for(let i=1;i<=hz/3;i++){const t=i/hz;r.event('move',[[1,195,650-450*t*t]],1000/hz)}const s=r.api.state();assert.ok(Math.abs(s.a-900)<1e-6);velocities.push(s.v)}
 assert.ok(Math.max(...velocities)-Math.min(...velocities)<1e-6);
});
test('tiny flick settles quickly and reversal clears old momentum',()=>{
 const r=rig();r.event('start',[[1,195,650]]);r.event('move',[[1,195,648]],1);assert.ok(r.gusts[0][2]<0.15);r.event('end',[[1,195,648]],0);r.frames();assert.ok(r.api.state().p<40/245);
 const q=rig();q.event('start',[[1,195,650]]);q.event('move',[[1,195,550]],50);q.event('move',[[1,195,560]],16);assert.ok(q.api.state().v<0);q.event('end',[[1,195,560]],0);q.frames();assert.ok(q.api.state().p<90/245);
});
test('fresh touch catches fling; full swipe reaches visible gate from below title',()=>{
 const r=rig();r.event('start',[[1,195,650]]);r.event('move',[[1,195,600]],50);r.event('end',[[1,195,600]],0);r.event('start',[[2,195,650]],0);const p=r.api.state().p;r.frames();assert.equal(r.api.state().p,p);
 // 2026-09-11: crossing the gate no longer fires a 0.85 trigger gust — the
 // blow opens with a settle beat (the swipe's motion dies down before the
 // wind enters), so the last gust must be the drag's own stir, not a blast.
 const gustsBefore=r.gusts.length;
 r.event('move',[[2,195,390]],500);assert.equal(r.api.state().p,1);assert.equal(r.api.state().pDisplay,1);assert.equal(r.api.state().mode,'blowing');assert.ok(r.gusts.length-gustsBefore<=1);if(r.gusts.length>gustsBefore)assert.ok(r.gusts.at(-1)[2]<=1.1);
});
test('reduced motion skips physics and desktop keeps its eased path',()=>{
 const r=rig({reduce:true});r.event('start',[[1,195,650]]);r.event('move',[[1,195,640]]);assert.equal(r.api.state().mode,'blowing');assert.equal(r.gusts.length,0);
 const w=rig();w.api.wheel({deltaY:40,deltaMode:0,preventDefault(){}});assert.ok(w.api.state().p>0);assert.equal(w.api.state().pDisplay,0);w.frames();assert.equal(w.api.state().p,w.api.state().pDisplay);
});
test('irregular timestamps and pauses never produce non-finite motion',()=>{
 const r=rig();r.event('start',[[1,195,650]],0);
 for(const [dt,y] of [[0,649],[0,648],[3,640],[40,620],[200,619],[16,618]]) {
   r.event('move',[[1,195,y]],dt);const s=r.api.state();assert.ok(Number.isFinite(s.v));assert.ok(Number.isFinite(s.a));assert.ok(Math.abs(s.p-(650-y)/245)<1e-10);
 }
 r.event('end',[[1,195,618]],200);const p=r.api.state().p;r.frames();assert.equal(r.api.state().p,p);
});
test('braking reduces release speed, and a downward fling stops cleanly at zero',()=>{
 const speeds=[];
 for(const accelerating of [false,true]){const r=rig();r.event('start',[[1,195,650]],0);for(let i=1;i<=8;i++){const t=i/100;const d=accelerating?3000*t*t:480*t-3000*t*t;r.event('move',[[1,195,650-d]],10)}speeds.push(r.api.state().v)}
 assert.ok(speeds[1]>speeds[0]+200);
 const r=rig();r.api.at(0.1);r.event('start',[[1,195,50]]);r.event('move',[[1,195,70]],20);r.event('end',[[1,195,70]],0);r.frames();assert.equal(r.api.state().p,0);assert.equal(r.raf.size,0);
});
test('a wheel glide is caught at the displayed position without a jump',()=>{
 const r=rig();r.api.wheel({deltaY:100,deltaMode:0,preventDefault(){}});assert.ok(r.api.state().p>0);
 r.event('start',[[1,195,650]]);assert.equal(r.api.state().p,0);r.event('move',[[1,195,640]]);assert.ok(Math.abs(r.api.state().p-10/245)<1e-10);r.frames();assert.equal(r.api.state().p,r.api.state().pDisplay);
});
test('sparse event delivery retains measured release velocity',()=>{
 const r=rig();r.event('start',[[1,195,650]],0);r.event('move',[[1,195,610]],200);
 assert.ok(Math.abs(r.api.state().v-200)<1e-8);r.event('end',[[1,195,610]],0);r.frames();assert.ok(r.api.state().p>40/245);
});

test('a same-timestamp first animation frame does not swallow the fling',()=>{
 const r=rig();r.event('start',[[1,195,650]]);r.event('move',[[1,195,610]],80);r.event('end',[[1,195,610]],0);
 r.tick();assert.equal(r.raf.size,1);r.frames();assert.ok(r.api.state().p>40/245);
});

test('phone start-location grid has only the mandated flower deadzone',()=>{
 for(const x of [0,5,6,195,384,385,389])for(const y of [1,194,195,350,505,506,699]){
   const r=rig();r.event('start',[[1,x,y]]);r.event('move',[[1,x,y-1]],16);
   const flower=x>=5.8515625 && x<=384.1484375 && y>=194.9609375 && y<=505.0390625;
   assert.equal(r.api.state().p>0,!flower,`page at ${x},${y}`);
   assert.equal(r.gusts.length,flower?0:1,`flowers at ${x},${y}`);
 }
});

test('quantized movement timestamps retain all distance in measured speed',()=>{
 const r=rig();r.event('start',[[1,195,650]],0);
 r.event('move',[[1,195,640]],0);r.event('move',[[1,195,630]],20);
 assert.equal(r.api.state().v,1000);assert.ok(Math.abs(r.api.state().p-20/245)<1e-10);
});
test('a finger starting on flowers during regrow stays brush-only',()=>{
 const r=rig();r.api.mode('growing');r.event('start',[[1,195,350]]);
 r.api.mode('hero');r.event('move',[[1,195,100]]);r.event('end',[[1,195,100]],0);r.frames();
 assert.equal(r.api.state().p,0);assert.equal(r.gusts.length,0);
});

// Chris's physical-iPhone report: brief, fast travel followed by immediate lift.
test('short fast release preserves launch speed and couples the first inertial frame',()=>{
 const r=rig();r.event('start',[[1,195,650]],0);r.event('move',[[1,195,638]],12);
 const drag=r.api.state().p, count=r.gusts.length;r.event('end',[[1,195,638]],0);
 assert.equal(r.api.state().p,drag,'release does not teleport');
 r.clock(1000/60);r.tick();
 assert.ok((r.api.state().p-drag)*245>10,'short flick retains high launch velocity');
 assert.ok(r.gusts.length>count,'first moving fling frame also moves flowers');
 r.frames();assert.ok(r.api.state().p*245>36,'momentum is not capped at twice finger travel');
 assert.ok(r.api.state().p<1,'short flick need not trigger the blow');
});
test('slow short drag holds on release and stays gentler than the same fast travel',()=>{
 const totals=[];
 for(const ms of [600,12]){const r=rig();r.event('start',[[1,195,650]],0);r.event('move',[[1,195,638]],ms);r.event('end',[[1,195,638]],0);
 const before=r.api.state().p;r.frames();if(ms===600)assert.equal(r.api.state().p,before);
 totals.push(r.gusts.reduce((sum,g)=>sum+g[2],0));}
 assert.ok(totals[1]>totals[0]*2,'fast release transfers substantially more impulse');
});
test('reversal immediately redirects flower impulses and release momentum',()=>{
 const r=rig();r.api.at(.5);r.event('start',[[1,195,650]],0);r.event('move',[[1,195,630]],20);
 const count=r.gusts.length;r.event('move',[[1,195,638]],8);
 assert.ok(r.gusts.length>count,'reversal is not swallowed by old gust throttle');
 assert.equal(r.gusts.at(-1)[1],1);r.event('end',[[1,195,638]],0);
 const before=r.api.state().p;r.clock(16);r.tick();assert.ok(r.api.state().p<before);assert.equal(r.gusts.at(-1)[1],1);
});
test('inertial flower impulse decays, settles, and is refresh-rate independent',()=>{
 const totals=[];
 for(const hz of [30,60,120,240]){const r=rig();r.event('start',[[1,195,650]],0);r.event('move',[[1,195,638]],12);r.event('end',[[1,195,638]],0);
 const count=r.gusts.length;r.frames(hz);const tail=r.gusts.slice(count);
 assert.ok(tail.length>2,'flowers remain driven throughout momentum');
 for(let i=1;i<tail.length;i++)assert.ok(tail[i][2]<=tail[i-1][2]+0.002,'impulse decays');
 assert.equal(r.raf.size,0);const settled=r.gusts.length;r.clock(500);r.tick();assert.equal(r.gusts.length,settled);
 totals.push(tail.reduce((sum,g)=>sum+g[2],0));}
 assert.ok(Math.max(...totals)-Math.min(...totals)<0.002,'no frame-count dependent force');
});
test('release resolves pending same-timestamp travel without needing another move',()=>{
 const r=rig();r.event('start',[[1,195,650]],0);r.event('move',[[1,195,638]],0);r.event('end',[[1,195,638]],12);
 assert.ok(r.api.state().v>900);const p=r.api.state().p;r.frames();assert.ok(r.api.state().p>p);
});

// The wheel/trackpad path shares touch's travel-based flower coupling.
test('desktop reversal catches visible position and redirects the next frame',()=>{
 const r=rig({desktop:true});r.api.at(.4);r.api.wheel({deltaY:80,deltaMode:0,preventDefault(){}});
 r.clock(16);r.tick();const before=r.api.state().pDisplay,n=r.gusts.length;
 r.api.wheel({deltaY:-8,deltaMode:0,preventDefault(){}});
 assert.equal(r.api.state().pDisplay,before,'reversal itself does not jump');
 r.clock(16);r.tick();assert.ok(r.api.state().pDisplay<before,'no stale forward glide');
 assert.ok(r.gusts.length>n);assert.equal(r.gusts.at(-1)[1],1);
});
test('desktop flower impulse follows travel independently of event/frame rate',()=>{
 const sums=[];
 for(const hz of [30,60,120,240]){
  const r=rig({desktop:true});for(let i=0;i<hz;i++){
   r.api.wheel({deltaY:120/hz,deltaMode:0,preventDefault(){}});r.clock(1000/hz);r.tick();
  }
  r.frames(hz);sums.push(r.gusts.reduce((sum,g)=>sum+g[2],0));
  assert.ok(Math.abs(r.api.state().pDisplay-120/630)<1e-10);
  const n=r.gusts.length;r.clock(500);r.tick();assert.equal(r.gusts.length,n,'no idle impulses');
 }
 assert.ok(Math.max(...sums)-Math.min(...sums)<.002);
});
test('desktop easing tail keeps flower impulses decaying instead of stopping abruptly',()=>{
 const r=rig({desktop:true});r.api.wheel({deltaY:40,deltaMode:0,preventDefault(){}});
 r.clock(16);r.tick();const n=r.gusts.length;r.frames(120);
 const tail=r.gusts.slice(n);assert.ok(tail.length>2);
 for(let i=1;i<tail.length;i++)assert.ok(tail[i][2]<=tail[i-1][2]+.002);
});
test('desktop short/long, slow/fast and braking traces preserve distance and settle',()=>{
 for(const px of [2,12,120,300])for(const ms of [100,300,1000])for(const hz of [30,60,120,240]){
  const r=rig({desktop:true}),n=Math.max(2,Math.round(ms*hz/1000));let previous=0;
  // Ease-out travel: high initial velocity, slow ending, no synthetic fling.
  for(let i=1;i<=n;i++){
   const next=px*(1-(1-i/n)**2);
   r.api.wheel({deltaY:next-previous,deltaMode:0,preventDefault(){}});
   previous=next;r.clock(ms/n);r.tick();
   assert.ok(r.api.state().pDisplay<=r.api.state().p+1e-10,'no overshoot');
  }
  r.frames(hz);assert.equal(r.api.state().mode,'hero');
  assert.ok(Math.abs(r.api.state().pDisplay-px/630)<1e-10);
  const impulse=r.gusts.reduce((sum,g)=>sum+g[2],0);
  assert.ok(Math.abs(impulse-(.08+px*.004)*1.6)<.002,`travel force: ${px}px/${ms}ms/${hz}Hz`);
  assert.equal(r.raf.size,0);assert.ok(r.gusts.every(g=>g[2]>0&&g[2]<=1.1));
 }
});
test('desktop reversal variants never retain forward backlog or add a position snap',()=>{
 for(const px of [.25,8,80])for(const delay of [0,8,16,100,400]){
  const r=rig({desktop:true});r.api.at(.4);
  r.api.wheel({deltaY:120,deltaMode:0,preventDefault(){}});
  if(delay){r.clock(delay);r.tick();}
  const before=r.api.state().pDisplay;
  r.api.wheel({deltaY:-px,deltaMode:0,preventDefault(){}});
  assert.equal(r.api.state().pDisplay,before);r.clock(16);r.tick();
  assert.ok(r.api.state().pDisplay<before);assert.equal(r.gusts.at(-1)[1],1);
  r.frames();assert.ok(Math.abs(r.api.state().pDisplay-(before-px/630))<1e-10);
 }
});
test('desktop wheel delta units agree and one full scroll still reaches the wind',()=>{
 for(const [deltaY,deltaMode] of [[32,0],[2,1],[32/900,2]]){
  const r=rig({desktop:true});r.api.wheel({deltaY,deltaMode,preventDefault(){}});r.frames();
  assert.ok(Math.abs(r.api.state().pDisplay-32/630)<1e-10);
 }
 const r=rig({desktop:true});r.api.wheel({deltaY:1000,deltaMode:0,preventDefault(){}});
 assert.equal(r.api.state().mode,'blowing');assert.equal(r.api.state().p,1);
 assert.equal(r.gusts.length,0,'no premature full-bed impulse on wind trigger');
});
