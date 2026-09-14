const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('garden.js','utf8');
function between(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a);return source.slice(a,b);}
test('departure retains every active spring and its current pose/velocity',()=>{
 const flowers=[-8,0,8].map((x,i)=>({x,sx:.1*(i+1),sz:-.05,vx:2-i,vz:.4}));
 const liveSet=new Set(flowers),before=flowers.map(r=>[r.sx,r.sz,r.vx,r.vz]);let starts=0;
 const ctx=vm.createContext({flowers,liveSet,HALF_W:9.7,BLOW_STAGGER:.5,Math,rng:()=>.4,startLoop(){starts++}});
 vm.runInContext(between('function blowAway(', '\nfunction setFrame(')+'\nblowAway();',ctx);
 assert.equal(liveSet.size,flowers.length,'moving flowers must remain in the spring simulation');
 assert.deepEqual(flowers.map(r=>[r.sx,r.sz,r.vx,r.vz]),before,'no handoff pose or velocity reset');
 assert.ok(flowers[0].blowStart<flowers[2].blowStart,'stagger retained');
 assert.ok(flowers.every(r=>r.blowVX>0&&r.bsc===1),'full-size rightward departure retained');assert.equal(starts,1);
});
test('desktop shadows draw on every departure frame, including after 350ms',()=>{
 const start=source.indexOf("    if (mode === 'blow' && isPhone)");assert.ok(start>=0);
 const code=source.slice(start,source.indexOf('    if (allDone)',start));
 const shadowCanvas={style:{opacity:'0'}};let draws=0;
 const ctx=vm.createContext({mode:'blow',isPhone:false,shadowCanvas,shadowFlip:false,clk:0,Math,drawShadows(){draws++}});
 for(const t of [0,.1,.35,.5,.9,1.3]){ctx.clk=t;vm.runInContext(code,ctx);assert.equal(shadowCanvas.style.opacity,'');}
 assert.equal(draws,6,'each visible desktop frame retains moving contact shadows');
 ctx.isPhone=true;ctx.clk=.5;vm.runInContext(code,ctx);assert.equal(shadowCanvas.style.opacity,'0.000','existing phone-only policy remains');assert.equal(draws,6);
});
test('ambient motion continues during staggered departure and stops after departure',()=>{
 const code=between('  const breezeWanted =','  // ---- title animation:');
 const ctx=vm.createContext({BREEZE_ON:true,breezeShown:true,bloomDone:true,mode:'blow',blownAway:true,breezeK:1,breezeT:0,frameDt:1/60,BREEZE_RISE:1.5,Math});
 const run=()=>vm.runInContext('{'+code+'}',ctx);
 for(let i=0;i<60;i++)run();assert.equal(ctx.breezeK,1);assert.ok(ctx.breezeT>.99);
 ctx.mode='idle';for(let i=0;i<30;i++)run();assert.equal(ctx.breezeK,0,'no endless offscreen animation');
});
