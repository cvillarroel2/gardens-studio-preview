const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const scroll=fs.readFileSync('scroll.js','utf8');
const windCode=scroll.slice(scroll.indexOf('  function windFront('),scroll.indexOf('  // ---------------------------------------------------------------- blow-away'));
const garden=fs.readFileSync('garden.js','utf8');
const gustCode=garden.slice(garden.indexOf('window.gardensStudioGust = function'),garden.indexOf('\n};',garden.indexOf('window.gardensStudioGust = function'))+3);
function rig(){
 let now=0,id=0,progress=null;const scheduled=new Map(),calls=[];
 const flowers=[-8,-4,0,4,8].map(x=>({x,z:0,vx:0,vz:0}));
 const path={anim:{effect:{getComputedTiming:()=>({progress})}},path:{getPointAtLength:d=>({x:d*4})},length:100,segment:50,dash:50};
 const ctx=vm.createContext({window:{},mode:'blowing',_windPaths:[path],_windGustRAF:0,reduceMQ:{matches:false},HOME:{halfW:10},flowers,liveSet:new Set(),hand:{},performance:{now:()=>now},startLoop(){},clamp:(n,a,b)=>Math.max(a,Math.min(b,n)),requestAnimationFrame:f=>{scheduled.set(++id,f);return id},cancelAnimationFrame:n=>scheduled.delete(n)});
 vm.runInContext(gustCode,ctx);const original=ctx.window.gardensStudioGust;
 ctx.window.gardensStudioGust=(...args)=>{calls.push({now,args});original(...args)};
 vm.runInContext(windCode,ctx);ctx.gustSeries({left:0,width:400});
 return {ctx,flowers,calls,path,scheduled,progress:p=>progress=p,frame(t){now=t;const work=[...scheduled.values()];scheduled.clear();work.forEach(f=>f(t))}};
}
test('wind waits through animation delay and the invisible dash lead-in',()=>{const r=rig();for(const p of [null,0,.1,.3]){r.progress(p);r.frame((p||0)*1000)}assert.equal(r.calls.length,0);assert.ok(r.flowers.every(f=>f.vx===0));r.progress(.4);r.frame(400);assert.equal(r.calls.length,0,'arrival starts a ramp, not a kick');r.frame(416);assert.ok(r.calls.length>0)});
test('wind applies only behind the visible front, then gradually reaches the right side',()=>{const r=rig();r.progress(.5);r.frame(0);r.frame(16);r.frame(100);assert.ok(r.flowers[0].vx>0);assert.ok(r.flowers.slice(1).every(f=>f.vx===0),'unreached flowers receive no wind impulse');assert.equal(r.calls.at(-1).args[4],-5);r.progress(.9);r.frame(200);r.frame(216);assert.ok(r.flowers[3].vx>0);assert.equal(r.flowers[4].vx,0)});
test('wind strength follows elapsed time, with comparable 60/120 Hz impulse totals',()=>{function total(hz){const r=rig();r.progress(.8);for(let i=0;i<=hz*2;i++)r.frame(i*1000/hz);return r.calls.reduce((s,c)=>s+c.args[2],0)}const a=total(60),b=total(120);assert.ok(Math.abs(a/b-1)<.01,`${a} / ${b}`);assert.ok(a>3&&a<3.7)});
test('a delayed frame cannot accumulate a bulk wind blast',()=>{const r=rig();r.progress(.9);r.frame(0);r.frame(16);r.frame(1800);assert.ok(r.calls.every(c=>c.args[2]<=.03));assert.ok(r.calls.at(-1).args[2]>0)});
test('wind wakes reached springs without waking unreached flowers',()=>{const r=rig();r.progress(.9);r.frame(0);r.frame(180);r.ctx.liveSet.clear();r.frame(196);assert.ok(r.ctx.liveSet.size>0);assert.equal(r.ctx.liveSet.has(r.flowers[4]),false)});
test('expired and replaced wind cycles cannot kick a regrown bed',()=>{for(const replace of [false,true]){const r=rig();r.progress(.9);r.frame(0);if(replace)r.ctx._windPaths=[];else r.ctx.mode='growing';r.frame(200);assert.equal(r.calls.length,0);assert.equal(r.scheduled.size,0)}});
test('finished or not-yet-visible animation iterations have no advancing front',()=>{const r=rig();for(const p of [null,0,.3,1]){r.progress(p);assert.equal(r.ctx.windFront([r.path]),-Infinity)}r.progress(.5);assert.equal(r.ctx.windFront([r.path]),100)});
