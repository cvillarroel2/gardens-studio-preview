(function () {
  'use strict';
  var selection=window.GardensWindSelection;
  if(selection&&selection.wind!=='journey')return;
  var choices = {
    original:{name:'Original',description:'The original wind, with its white highlights and soft grey sweeps.',reference:'Original scene ↗',href:'./'},
    curl:{name:'Soft curl',description:'A light sweep, with an occasional small curl at its tip.',reference:'The Wind Waker / shape & gesture',href:'https://www.nintendo.com/en-ca/whatsnew/jump-into-three-classic-nintendo-gamecube-games/'},
    silk:{name:'Silk current',description:'Long, supple bends with a fine thread following behind.',reference:'Journey / floating movement',href:'https://thatgamecompany.com/journey/'},
    sketch:{name:'Loose sketch',description:'Shorter, gently uneven strokes. A quick drawing of passing air.',reference:'Totoro / hand-drawn atmosphere',href:'https://www.ghibli.jp/works/totoro/'}
  };
  var key=selection?'silk':new URLSearchParams(location.search).get('style');
  if(!choices[key])key='curl';
  var silkMode=selection?'refined':new URLSearchParams(location.search).get('silk');
  if(silkMode!=='classic'&&silkMode!=='flow')silkMode='refined';
  var refinedSilk=key==='silk'&&silkMode!=='classic';
  var flowingSilk=key==='silk'&&silkMode==='flow';
  if(refinedSilk)choices.silk.description='Fine tapered ends, with a trailing thread that gently opens and closes.';
  if(flowingSilk){
    choices.silk.description='A bend travels through the trailing thread, then fades into the flowers.';
    choices.silk.reference='Journey / motion reference ↗';
    choices.silk.href='https://www.youtube.com/watch?v=61DZC-60x20&t=57s';
  }
  var NS='http://www.w3.org/2000/svg';
  function element(name,attrs,parent){var el=document.createElementNS(NS,name);Object.keys(attrs).forEach(function(k){el.setAttribute(k,attrs[k]);});if(parent)parent.appendChild(el);return el;}
  function geometry(x,y,len,amp,dir,index){
    function p(u,v){return (x+len*u).toFixed(2)+' '+(y+dir*amp*v).toFixed(2);}
    if(key==='curl'){
      // Most marks are simple open sweeps. Only two of seven gusts turn into
      // a modest open curl; there is never a screen full of repeated symbols.
      if(index%3!==1)return 'M '+p(0,0)+' C '+p(.17,-.62)+' '+p(.36,-.48)+' '+p(.55,.06)+' C '+p(.7,.49)+' '+p(.85,.35)+' '+p(1,.08);
      return 'M '+p(0,0)+' C '+p(.18,-.45)+' '+p(.4,-.38)+' '+p(.59,.12)+
        ' C '+p(.74,.7)+' '+p(.91,.37)+' '+p(.86,-.3)+
        ' C '+p(.82,-.89)+' '+p(.69,-.72)+' '+p(.72,-.2)+
        ' C '+p(.733,.035)+' '+p(.776,.085)+' '+p(.79,-.09);
    }
    if(key==='silk')return 'M '+p(0,.1)+' C '+p(.12,.08)+' '+p(.19,-.73)+' '+p(.38,-.66)+
      ' C '+p(.55,-.6)+' '+p(.57,.68)+' '+p(.76,.51)+' C '+p(.85,.42)+' '+p(.93,.15)+' '+p(1,.18);
    return 'M '+p(0,.04)+' C '+p(.1,-.3)+' '+p(.23,-.51)+' '+p(.35,-.38)+
      ' C '+p(.44,-.25)+' '+p(.5,.18)+' '+p(.61,.21)+
      ' C '+p(.68,.24)+' '+p(.76,.11)+' '+p(.83,.05);
  }
  function refineSilk(paths,animations){
    function insetStroke(source,record,fraction,width,opacity){
      var stroke=source.cloneNode(false),dash=Number(source.getAttribute('stroke-dasharray').split(' ')[0]);
      var gap=Number(source.getAttribute('stroke-dasharray').split(' ')[1]);
      var innerDash=Math.max(1,Math.round(dash*fraction)),inset=(dash-innerDash)/2;
      stroke.removeAttribute('data-primary-wind');stroke.removeAttribute('data-trailing-wind');
      stroke.setAttribute('data-silk-taper',fraction);
      stroke.setAttribute('stroke-width',width.toFixed(3));stroke.setAttribute('stroke-opacity',opacity);
      // Keep the same period and centre. Both ends of this thicker segment
      // remain strictly inside the fine outer stroke's animated dash.
      stroke.setAttribute('stroke-dasharray',innerDash+' '+(gap+dash-innerDash));
      source.parentNode.insertBefore(stroke,source.nextSibling);
      var sourceAnim=source.getAnimations()[0];
      var frames=sourceAnim.effect.getKeyframes().map(function(f){
        var v={offset:f.computedOffset};
        if(f.opacity!==undefined)v.opacity=f.opacity;
        if(f.strokeDashoffset!==undefined)v.strokeDashoffset=parseFloat(f.strokeDashoffset)-inset;
        return v;
      });
      animations.push(stroke.animate(frames,sourceAnim.effect.getTiming()));
      record.visibleElements.push(stroke);
      return stroke;
    }
    paths.forEach(function(record,i){
      var primary=record.path,echo=record.visibleElements[1];
      var width=Number(primary.getAttribute('stroke-width'));
      // Three nested line weights approximate a taper without masks, filters,
      // geometry rebuilds or an extra JavaScript animation-frame loop.
      primary.setAttribute('stroke-width',(width*.18).toFixed(3));
      insetStroke(primary,record,.96,width*.6,.65);
      insetStroke(primary,record,.82,width,.7);
      var dir=echo.getAttribute('transform').includes('-')?-1:1;
      var group=element('g',{'data-silk-echo':i},null);
      echo.parentNode.insertBefore(group,echo);group.appendChild(echo);
      echo.removeAttribute('transform');echo.setAttribute('stroke-width',.13);
      if(flowingSilk){
        var echoAnim=echo.getAnimations()[0],oldFrames=echoAnim.effect.getKeyframes();
        var peak=Math.max.apply(null,oldFrames.map(function(f){return Number(f.opacity)||0;}));
        // Retain the dash trajectory and clock. Only its decorative opacity
        // finishes earlier, leaving the main line and flower response intact.
        echoAnim.effect.setKeyframes([
          {strokeDashoffset:oldFrames[0].strokeDashoffset,opacity:0},
          {offset:.25,opacity:peak},
          {offset:.48,opacity:peak*.9},
          {offset:.82,opacity:0},
          {strokeDashoffset:oldFrames[oldFrames.length-1].strokeDashoffset,opacity:0}
        ]);
        var inner=insetStroke(echo,record,.88,.48,.4);
        window.GardensSilkMotion.attach(record,[echo,inner],dir,animations);
        return;
      }
      insetStroke(echo,record,.88,.48,.4);
      var frames=[[0,1.2],[.25,3.4],[.5,7.5],[.75,4.2],[1,1.2]].map(function(v){
        return {offset:v[0],transform:'translate(0px,'+(dir*v[1])+'px)'};
      });
      var motion=group.animate(frames,record.anim.effect.getTiming());
      animations.push(motion);record.echoMotion={anim:motion,group:group};
    });
  }
  window.GardensWindLines={key:key,specs:[],build:function(svg,W,H,reduce){
    this.specs=[];if(reduce)return {animations:[],paths:[]};
    if(key==='original')return window.GardensOriginalWind.build(svg,W,H,reduce);
    var animations=[],paths=[],specs=[],N=W<720?Math.round(4+W/160):Math.round(9+W/340);
    for(var i=0;i<N;i++){
      // Preserve the original scene RNG order, pulse duration, stagger, fade
      // and dash proportion. All artwork is original, opt-in SVG geometry.
      var draws=[];for(var j=0;j<10;j++)draws.push(Math.random());
      var y=H*(.06+.88*((i+.5)/N))+(draws[0]-.5)*(H/N*.8);
      var len=220+draws[1]*460,x0=-140+draws[2]*(W*.5),amp=26+draws[3]*52,dir=draws[4]<.5?1:-1;
      // Keep the two curling tips inside a phone viewport, even when the
      // original random sweep would have put its end beyond the right edge.
      if(key==='curl'&&i%3===1)len=Math.min(len,(W-30-x0)/.91);
      var light=i%3!==0,op=light?.5+draws[5]*.4:.2+draws[5]*.2;
      var width=key==='curl'?1.05+draws[6]*.5:key==='silk'?.85+draws[6]*.5:.85+draws[6]*.4;
      var color=key==='sketch'?'#a4a799':key==='silk'?'#a4ad9a':'#9fa994';
      var d=geometry(x0,y,len,amp,dir,i);
      var p=element('path',{d:d,fill:'none',stroke:color,'stroke-width':width.toFixed(2),'stroke-linecap':'round','stroke-linejoin':'round','stroke-opacity':key==='sketch'?.8:.88,'data-primary-wind':i},svg);
      p.style.opacity='0';
      var L=p.getTotalLength(),fraction=.5+draws[7]*.28,seg=L*fraction,dash=Math.round(seg);
      p.setAttribute('stroke-dasharray',dash+' '+Math.round(L+seg+4));
      var timing={duration:900+draws[8]*750,delay:draws[9]*360,iterations:Infinity,easing:'cubic-bezier(.4,0,.5,1)'};
      var frames=[{strokeDashoffset:L,opacity:0},{opacity:op,offset:.25},{opacity:op,offset:.70},{strokeDashoffset:-seg,opacity:0}];
      var anim=p.animate(frames,timing);animations.push(anim);var visible=[p];
      // Native trailing strokes keep the primary x geometry, so their heads
      // can never lead its advancing front. No extra per-frame JS is needed.
      if(key==='silk'||(key==='sketch'&&i%2===0)){
        var isSilk=key==='silk',offset=isSilk?3.8:2.2;
        var echo=element('path',{d:d,fill:'none',stroke:color,'stroke-width':isSilk?.48:.5,'stroke-opacity':isSilk?.42:.34,'stroke-linecap':'round','stroke-dasharray':p.getAttribute('stroke-dasharray'),transform:'translate(0 '+(dir*offset)+')','data-trailing-wind':i},svg);
        echo.style.opacity='0';
        var lag=isSilk?22:34;
        var ef=frames.map(function(f){var v=Object.assign({},f);if(v.strokeDashoffset!==undefined)v.strokeDashoffset+=lag;return v;});
        var ea=echo.animate(ef,timing);animations.push(ea);visible.push(echo);
      }
      paths.push({anim:anim,path:p,length:L,segment:seg,dash:dash,visibleElements:visible,draws:draws});
      specs.push({d:d,draws:draws,duration:timing.duration,delay:timing.delay,easing:timing.easing,opacity:op,segmentFraction:fraction});
    }
    if(refinedSilk)refineSilk(paths,animations);
    var start=document.timeline.currentTime;animations.forEach(function(a){a.startTime=start;});
    this.specs=specs;return {animations:animations,paths:paths};
  }};
  if(selection)return;
  document.addEventListener('DOMContentLoaded',function(){
    var panel=document.getElementById('windLinePanel'),choice=choices[key];
    panel.querySelector('[data-description]').textContent=choice.description;
    var ref=panel.querySelector('[data-reference]');ref.textContent=choice.reference;ref.href=choice.href;
    panel.querySelectorAll('[data-style]').forEach(function(a){if(a.dataset.style===key)a.setAttribute('aria-current','page');});
    var silkOptions=panel.querySelector('[data-silk-options]');
    silkOptions.hidden=key!=='silk';
    silkOptions.querySelector('[data-silk="'+silkMode+'"]').setAttribute('aria-current','page');
    var play=panel.querySelector('[data-play]');play.addEventListener('click',function(){window.GardensWindPreview.play();});
    panel.querySelector('[data-reset]').addEventListener('click',function(){location.reload();});
    ['touchstart','touchmove','touchend','touchcancel'].forEach(function(type){panel.addEventListener(type,function(e){e.stopPropagation();},{passive:true});});
    function update(){var s=window.GardensWindPreview&&window.GardensWindPreview.state();play.disabled=!s||!s.bloomed||s.mode!=='hero'||s.transitioning;panel.classList.toggle('is-winding',!!s&&(s.mode==='blowing'||(s.mode==='hero'&&s.p>.08)));}
    update();var timer=setInterval(update,200);window.addEventListener('pagehide',function(){clearInterval(timer);});
  });
})();
