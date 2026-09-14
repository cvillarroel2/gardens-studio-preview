(function () {
  'use strict';
  var selection=window.GardensWindSelection;
  if(selection&&selection.wind!=='roll')return;
  var choices={
    original:{name:'Original',description:'The original wind, with white highlights and soft grey sweeps.',reference:'Original scene ↗',href:'./'},
    rush:{name:'Rush',description:'A concentrated gust: close, forceful streaks with a quick, thinning wake.',reference:'Tsushima / gust footage ↗',href:'https://www.youtube.com/watch?v=Ur0pQblaZcE&t=104s'},
    crest:{name:'Crest',description:'A broad, bowed front of air sweeps through, followed by a lighter echo.',reference:'Avatar / pressure front ↗',href:'https://www.youtube.com/watch?v=RkEjDWhQqj4&t=49s'},
    roll:{name:'Roll',description:'A surging sweep with larger eddies curling through its wake.',reference:'Avatar / rolling gesture ↗',href:'https://www.youtube.com/watch?v=NX1ciOBC7g0&t=62s'}
  };
  var key=selection?'roll':new URLSearchParams(location.search).get('gust');if(!choices[key])key='rush';
  var NS='http://www.w3.org/2000/svg';
  function element(name,attrs,parent){var el=document.createElementNS(NS,name);Object.keys(attrs).forEach(function(k){el.setAttribute(k,attrs[k]);});if(parent)parent.appendChild(el);return el;}
  function geometry(style,x,y,len,amp,dir,index){
    function p(u,v){return (x+len*u).toFixed(2)+' '+(y+dir*amp*v).toFixed(2);}
    if(style==='rush')return 'M '+p(0,.18)+' C '+p(.22,.15)+' '+p(.45,-.28)+' '+p(.64,-.23)+' C '+p(.79,-.18)+' '+p(.92,-.02)+' '+p(1,0);
    if(style==='crest')return 'M '+p(0,.46)+' C '+p(.27,.51)+' '+p(.50,.36)+' '+p(.69,-.14)+' C '+p(.85,-.74)+' '+p(.94,-.54)+' '+p(1,.06);
    // Two larger, open eddies among the seven sweeps; a field of repeated
    // spirals would compete with the flowers and weaken the main direction.
    if(index%3===1)return 'M '+p(0,.02)+' C '+p(.12,-.05)+' '+p(.26,-.05)+' '+p(.41,.16)+
      ' C '+p(.58,.42)+' '+p(.58,1.08)+' '+p(.39,.96)+
      ' C '+p(.22,.85)+' '+p(.24,-.18)+' '+p(.47,-.30)+
      ' C '+p(.67,-.40)+' '+p(.84,-.10)+' '+p(1,-.12);
    return 'M '+p(0,.12)+' C '+p(.22,.10)+' '+p(.27,-.65)+' '+p(.49,-.54)+' C '+p(.67,-.45)+' '+p(.76,.35)+' '+p(1,.05);
  }
  function layer(svg,record,animations,options){
    var primary=record.path,outerDash=record.dash;
    var dash=Math.max(1,Math.round(outerDash*options.fraction));
    var inset=(outerDash-dash)/2,lag=options.lag||0;
    var outerGap=Number(primary.getAttribute('stroke-dasharray').split(' ')[1]);
    var stroke=element('path',{d:primary.getAttribute('d'),fill:'none',stroke:primary.getAttribute('stroke'),
      'stroke-width':options.width.toFixed(3),'stroke-opacity':options.opacity,'stroke-linecap':'round','stroke-linejoin':'round',
      'stroke-dasharray':dash+' '+(outerGap+outerDash-dash),transform:'translate(0 '+(options.y||0)+')','data-gust-layer':options.name},svg);
    stroke.style.opacity='0';
    var peak=record.opacity;
    // Same dash period and native clock as the leading path. Insetting and a
    // positive lag keep every secondary head within an already-traced prefix,
    // including on Roll's returning curve. A y-only translation preserves it.
    var frames=[{strokeDashoffset:record.length+lag-inset,opacity:0},
      {offset:.25,opacity:peak},{offset:options.fade||.70,opacity:peak},
      {strokeDashoffset:-record.segment+lag-inset,opacity:0}];
    if(options.early)frames.splice(3,0,{offset:.87,opacity:0});
    animations.push(stroke.animate(frames,record.anim.effect.getTiming()));record.visibleElements.push(stroke);
  }
  var renderer={key:key,specs:[],geometry:geometry,build:function(svg,W,H,reduce){
    this.specs=[];if(reduce)return {animations:[],paths:[]};
    if(key==='original')return window.GardensOriginalWind.build(svg,W,H,reduce);
    var animations=[],paths=[],specs=[],N=W<720?Math.round(4+W/160):Math.round(9+W/340);
    for(var i=0;i<N;i++){
      var draws=[];for(var j=0;j<10;j++)draws.push(Math.random());
      var y=H*(.06+.88*((i+.5)/N))+(draws[0]-.5)*(H/N*.8);
      var len=W*(.94+draws[1]*.56),x=-W*.28+draws[2]*(W*.32),dir=draws[4]<.5?1:-1;
      var amp=key==='rush'?24+draws[3]*28:key==='crest'?75+draws[3]*60:38+draws[3]*38;
      var op=i%3!==0?.5+draws[5]*.4:.2+draws[5]*.2,width=1.55+draws[6]*.5;
      var p=element('path',{d:geometry(key,x,y,len,amp,dir,i),fill:'none',stroke:'#969f8c',
        'stroke-width':(width*.23).toFixed(3),'stroke-opacity':.92,'stroke-linecap':'round','stroke-linejoin':'round','data-primary-wind':i},svg);
      p.style.opacity='0';var L=p.getTotalLength(),fraction=.5+draws[7]*.28,seg=L*fraction,dash=Math.round(seg);
      p.setAttribute('stroke-dasharray',dash+' '+Math.round(L+seg+4));
      var timing={duration:900+draws[8]*750,delay:draws[9]*360,iterations:Infinity,easing:'cubic-bezier(.4,0,.5,1)'};
      var frames=[{strokeDashoffset:L,opacity:0},{offset:.25,opacity:op},{offset:.70,opacity:op},{strokeDashoffset:-seg,opacity:0}];
      var anim=p.animate(frames,timing);animations.push(anim);
      var record={anim:anim,path:p,length:L,segment:seg,dash:dash,visibleElements:[p],draws:draws,opacity:op};
      layer(svg,record,animations,{name:'core',fraction:.88,width:width,opacity:.76});
      if(key==='rush'){
        layer(svg,record,animations,{name:'near-wake',fraction:.80,width:.65,opacity:.64,y:dir*4,lag:8,fade:.53,early:true});
        layer(svg,record,animations,{name:'far-wake',fraction:.52,width:.40,opacity:.48,y:-dir*5.5,lag:18,fade:.49,early:true});
      }else if(key==='crest'){
        layer(svg,record,animations,{name:'crest-echo',fraction:.86,width:.78,opacity:.62,y:dir*11,lag:10,fade:.57,early:true});
        layer(svg,record,animations,{name:'crest-wake',fraction:.56,width:.38,opacity:.39,y:dir*23,lag:18,fade:.48,early:true});
      }else{
        layer(svg,record,animations,{name:'eddy-echo',fraction:.83,width:.66,opacity:.64,y:dir*4.5,lag:9,fade:.58,early:true});
        layer(svg,record,animations,{name:'eddy-wake',fraction:.48,width:.36,opacity:.43,y:-dir*4,lag:20,fade:.48,early:true});
      }
      paths.push(record);specs.push({d:p.getAttribute('d'),draws:draws,duration:timing.duration,delay:timing.delay,easing:timing.easing,opacity:op,segmentFraction:fraction});
    }
    var start=document.timeline.currentTime;animations.forEach(function(a){a.startTime=start;});
    this.specs=specs;return {animations:animations,paths:paths};
  }};
  window.GardensWindLines=renderer;
  if(selection)return;
  document.addEventListener('DOMContentLoaded',function(){
    var panel=document.getElementById('windLinePanel'),choice=choices[key];
    panel.querySelector('[data-description]').textContent=choice.description;
    var ref=panel.querySelector('[data-reference]');ref.textContent=choice.reference;ref.href=choice.href;
    panel.querySelector('[data-gust="'+key+'"]').setAttribute('aria-current','page');
    var play=panel.querySelector('[data-play]');play.addEventListener('click',function(){window.GardensWindPreview.play();});
    panel.querySelector('[data-reset]').addEventListener('click',function(){location.reload();});
    ['touchstart','touchmove','touchend','touchcancel'].forEach(function(type){panel.addEventListener(type,function(e){e.stopPropagation();},{passive:true});});
    function update(){var s=window.GardensWindPreview&&window.GardensWindPreview.state();play.disabled=!s||!s.bloomed||s.mode!=='hero'||s.transitioning;panel.classList.toggle('is-winding',!!s&&(s.mode==='blowing'||(s.mode==='hero'&&s.p>.08)));}
    update();var timer=setInterval(update,200);window.addEventListener('pagehide',function(){clearInterval(timer);});
  });
})();
