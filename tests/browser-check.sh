#!/bin/sh
# Start the loopback preview on 8913 first. Requires installed Ego Browser.
set -eu
ego-browser nodejs <<'JS'
await useOrCreateTaskSpace('Gardens mobile movement');
await openOrReuseTab('http://127.0.0.1:8913/', {wait:true});
await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:700,deviceScaleFactor:3,mobile:true});
await cdp('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
for (const page of ['index.html','vertical.html']) {
  await gotoAndWait('http://127.0.0.1:8913/'+page);
  await wait(5);
  const result=await js(String.raw`(async () => {
    const title=document.getElementById('title'), banner=document.getElementById('banner');
    const sleep=ms=>new Promise(r=>setTimeout(r,ms));
    const assert=(ok,label)=>{if(!ok)throw new Error(label)};
    const rect=banner.getBoundingClientRect().toJSON();
    const y=innerHeight-30, x=innerWidth/2;
    assert(y>rect.bottom,'below-title starting strip');
    const emit=(type,px,py)=>{
      const finger=new Touch({identifier:1,target:banner,clientX:px,clientY:py});
      const active=type==='touchend'||type==='touchcancel'?[]:[finger];
      window.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,touches:active,targetTouches:active,changedTouches:[finger]}));
    };
    const initial=title.style.transform;
    emit('touchstart',x,(rect.top+rect.bottom)/2);
    emit('touchmove',x,20);emit('touchend',x,20);
    await sleep(120);
    assert(title.style.transform===initial,'flower-start lifetime lock');
    emit('touchstart',x,y);
    for(let i=1;i<=5;i++){await sleep(16);emit('touchmove',x,y-i*10)}
    const drag=title.style.transform;
    const budget=Math.min(800,Math.max(440,innerHeight*.7))*.5;
    const expected=(50/budget*innerHeight*.14).toFixed(2);
    assert(Math.abs(rect.top-banner.getBoundingClientRect().top-Number(expected))<0.02,'direct 50px drag');
    emit('touchcancel',x,y-50);await sleep(150);
    assert(title.style.transform===drag,'cancel has no momentum');
    // Real DOM path through final release coordinates, wind lead and doc reveal.
    const frames=[];let recording=true,prev=performance.now();
    function frame(t){frames.push(t-prev);prev=t;if(recording)requestAnimationFrame(frame)}
    requestAnimationFrame(frame);
    emit('touchstart',x,y);
    // Short, fast swipe with immediate release: the real browser listeners
    // must transfer momentum to the existing flower hook after the finger lifts.
    const gust=window.gardensStudioGust;
    let impulses=0;
    window.gardensStudioGust=function(...args){impulses++;return gust.apply(this,args)};
    await sleep(12);emit('touchmove',x,y-12);
    const beforeRelease=title.style.transform;
    emit('touchend',x,y-12);
    const releaseImpulses=impulses;
    // Ego may starve rAF in its isolated renderer; allow delivery, then assert.
    for(let n=0;n<20 && title.style.transform===beforeRelease;n++)await sleep(100);
    const fling=title.style.transform;
    window.gardensStudioGust=gust;
    assert(fling!==beforeRelease,'short immediate-release momentum advances');
    assert(impulses>releaseImpulses,'flowers receive inertial impulse after release');
    // Catch momentum and finish from the strip without a teleport.
    emit('touchstart',x,y);
    for(let i=1;i<=26;i++){await sleep(16);emit('touchmove',x,y-i*10)}
    emit('touchend',x,y-260);
    assert(title.classList.contains('blowing'),'wind lead expands banner');
    await sleep(2900);recording=false;
    assert(document.body.classList.contains('revealed'),'doc revealed');
    assert(document.documentElement.style.overflow==='','native scroll restored');
    assert(scrollY===0,'doc reveals at top');
    document.getElementById('toTop').click();
    await sleep(4200);
    assert(!title.classList.contains('gone'),'regrown title');
    assert(document.documentElement.style.overflow==='hidden','hero recaptured');
    const sorted=frames.slice(1).sort((a,b)=>a-b);
    return {rect,drag,fling,checks:12,frameCount:sorted.length,
      frameMedianMs:sorted[Math.floor(sorted.length*.5)],frameP95Ms:sorted[Math.floor(sorted.length*.95)],
      scripts:[...document.scripts].map(s=>s.src).filter(s=>/\/(garden|scroll)\.js/.test(s))};
  })()`);
  cliLog({page,result});
}
JS
