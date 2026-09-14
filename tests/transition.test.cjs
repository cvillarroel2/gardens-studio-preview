// Run the shipped choreography closure with a clock and layout model. The real
// browser matrix separately checks projection through the actual Three camera.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
function rig({height=796,cssHeight=height,ready=true}={}){
 let now=0,id=0,halfW=9.7;const timers=new Map(),events={},calls=[];
 const style=()=>({removeProperty(k){delete this[k]}});
 const element=()=>{const classes=new Set();return {style:style(),classList:{add(...a){a.forEach(x=>classes.add(x))},remove(...a){a.forEach(x=>classes.delete(x))},contains(x){return classes.has(x)}}};};
 const title=element(),banner=element(),body=element();
 const win={innerWidth:440,innerHeight:height,cssHeight,GARDENS_LOGO:{halfW:9.7},matchMedia:()=>({matches:false}),addEventListener:(k,f)=>events[k]=f,removeEventListener(){},setTimeout(f,ms){timers.set(++id,{f,at:now+ms});return id},scrollTo(){},gardensStudioGust(){}};
 const oldSize=()=>({w:win.innerWidth*.97,h:win.innerWidth*.97/1.22});
 function rect(){const blowing=title.classList.contains('blowing'),old=oldSize();let w=old.w,h=old.h,x=win.innerWidth/2,y=win.innerHeight/2;const t=title.style.transform||'';
  if(blowing){w=parseFloat(title.style.width)||win.innerWidth;h=parseFloat(title.style.height)||win.cssHeight;x=w/2;y=h/2;const two=t.match(/translate\(([-.\d]+)px,\s*([-.\d]+)px\)/);if(two){x+=+two[1];y+=+two[2]}else{const one=t.match(/translateY\(([-.\d]+)px\)/);if(one)y+=+one[1]}}
  else {const lift=t.match(/calc\(-50% - ([-.\d]+)px\)/);if(lift)y-=+lift[1]}
  return {left:x-w/2,top:y-h/2,right:x+w/2,bottom:y+h/2,width:w,height:h,x:x-w/2,y:y-h/2};}
 banner.getBoundingClientRect=rect;Object.defineProperties(banner,{clientWidth:{get:()=>Math.round(rect().width)},clientHeight:{get:()=>Math.round(rect().height)}});
 const garden={isReady:ready,setFrame(f){halfW=f.halfW;calls.push({kind:'frame',t:now,frame:f})},blowAway(cb){calls.push({kind:'blow',t:now,cb})},replant(){halfW=9.7},bloomIn(cb){calls.push({kind:'bloom',t:now});cb?.()}};
 win.Garden=garden;
 const doc={body,documentElement:element(),hidden:false,addEventListener(){},getElementById:()=>null};
 const ctx=vm.createContext({window:win,document:doc,performance:{now:()=>now},fetch:()=>Promise.resolve({json:()=>Promise.resolve({flowers:[]})}),requestAnimationFrame:()=>0,cancelAnimationFrame(){},clearTimeout:n=>timers.delete(n),console});
 const code=fs.readFileSync('scroll.js','utf8').replace(/\}\)\(\);\s*$/,`window.test={setup:()=>{body=document.body;titleWrap=window.title;banner=window.banner;cue=null;computeMetrics();bloomed=true;p=pDisplay=1;applyScrub();showWind=()=>window.calls.push({kind:'wind'});hideWind=()=>{};},start:startBlow,resize:onResize,regrow:startRegrow,state:()=>({mode,p,pDisplay,transitioning})};})();`);
 vm.runInContext(code,ctx);win.title=title;win.banner=banner;win.calls=calls;win.test.setup();
 const position=()=>{const r=rect();return {x:r.left+r.width/2,y:r.top+r.height/2,scale:r.width/(2*halfW)}};
 function advance(to,{stall=false}={}){if(stall)now=to;for(;;){const next=[...timers].filter(([,v])=>v.at<=to).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;timers.delete(next[0]);if(!stall)now=next[1].at;next[1].f()}now=to;}
 return {api:win.test,win,title,banner,calls,events,position,advance,timers};
}
for(const scenario of [{name:'stable',height:796,cssHeight:796},{name:'large CSS viewport',height:713,cssHeight:796},{name:'toolbar resize during settle',height:796,cssHeight:713,resize:713},{name:'toolbar expansion during settle',height:713,cssHeight:796,resize:796}]){
 test('wind expansion preserves screen position and scale: '+scenario.name,()=>{const r=rig(scenario);r.api.start();if(scenario.resize){r.advance(100);r.win.innerHeight=scenario.resize;r.api.resize();r.advance(449)}else r.advance(449);const before=r.position();r.advance(450);const after=r.position();assert.ok(Math.abs(after.y-before.y)<.1,`vertical jump ${after.y-before.y}px`);assert.ok(Math.abs(after.x-before.x)<.1);assert.ok(Math.abs(after.scale/before.scale-1)<.0001,`scale ratio ${after.scale/before.scale}`);assert.equal(r.calls.find(x=>x.kind==='frame').frame.dprCap,1.35);assert.equal(r.calls.filter(x=>x.kind==='blow').length,0,'450ms settle plus wind lead preserved');r.advance(910);assert.equal(r.calls.filter(x=>x.kind==='blow').length,1)});
}
test('a stalled handoff cannot launch an old blow after watchdog and regrow',()=>{const r=rig();r.api.start();r.advance(3500,{stall:true});assert.equal(r.api.state().mode,'doc');r.api.regrow();r.advance(4000);assert.equal(r.calls.filter(x=>x.kind==='blow').length,0,'overdue wind-lead callback must not touch the regrown title');assert.equal(r.api.state().mode,'hero')});
test('garden becoming ready after the watchdog does not restart wind',()=>{const r=rig({ready:false});r.api.start();r.advance(3200);assert.equal(r.api.state().mode,'doc');r.win.Garden.isReady=true;r.events['garden-ready']();r.advance(5000);assert.equal(r.calls.filter(x=>x.kind==='wind'||x.kind==='frame'||x.kind==='blow').length,0)});
test('regrow clears fullscreen geometry before blooming',()=>{const r=rig();r.api.start();r.advance(910);r.calls.find(x=>x.kind==='blow').cb();r.api.regrow();assert.equal(r.title.style.width||'', '');assert.equal(r.title.style.height||'', '');assert.equal(r.title.classList.contains('blowing'),false);assert.equal(r.api.state().p,0)});
test('a late garden-ready cannot restart an expired regrow',()=>{const r=rig();r.api.start();r.advance(3200);r.win.Garden.isReady=false;r.api.regrow();r.advance(7200);assert.equal(r.api.state().mode,'hero');r.win.Garden.isReady=true;r.events['garden-ready']();assert.equal(r.calls.filter(x=>x.kind==='bloom').length,0)});
