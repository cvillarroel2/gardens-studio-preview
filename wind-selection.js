(function () {
  'use strict';
  var wind=new URLSearchParams(location.search).get('wind');
  if(['original','journey','roll'].indexOf(wind)===-1)wind='original';
  // Journey reuses the refined Silk renderer. The comparison changes only
  // the selection UI; both studied renderers retain their existing artwork.
  window.GardensWindSelection={wind:wind};
  if(wind==='original')window.GardensWindLines={key:'original',build:function(svg,W,H,reduce){
    return reduce?{animations:[],paths:[]}:window.GardensOriginalWind.build(svg,W,H,reduce);
  }};
  document.addEventListener('DOMContentLoaded',function(){
    var panel=document.getElementById('windLinePanel');
    panel.querySelector('[data-wind="'+wind+'"]').setAttribute('aria-current','page');
    var play=panel.querySelector('[data-play]');
    play.addEventListener('click',function(){window.GardensWindPreview.play();});
    panel.querySelector('[data-reset]').addEventListener('click',function(){location.reload();});
    ['touchstart','touchmove','touchend','touchcancel'].forEach(function(type){
      panel.addEventListener(type,function(e){e.stopPropagation();},{passive:true});
    });
    function update(){
      var s=window.GardensWindPreview&&window.GardensWindPreview.state();
      play.disabled=!s||!s.bloomed||s.mode!=='hero'||s.transitioning;
      panel.classList.toggle('is-winding',!!s&&(s.mode==='blowing'||(s.mode==='hero'&&s.p>.08)));
    }
    update();var timer=setInterval(update,200);
    window.addEventListener('pagehide',function(){clearInterval(timer);});
  });
})();
