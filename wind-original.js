/* Original production wind renderer, extracted from scroll.js. */
(function () {
  'use strict';
  window.GardensOriginalWind = { build: function (svg, W, H, reduce) {
    var animations = [], paths = [];
    var N = W < 720 ? Math.round(4 + W / 160) : Math.round(9 + W / 340);
    var NS = 'http://www.w3.org/2000/svg';
    for (var i = 0; i < N; i++) {
      var y = H * (0.06 + 0.88 * ((i + 0.5) / N)) + (Math.random() - 0.5) * (H / N * 0.8);
      var len = 220 + Math.random() * 460;                // length of this gust curl
      var placement = Math.random();
      // A few local curls begin near the middle, carrying the eye rightward.
      // Keep every curl's original length and clock; most retain their placement.
      var x0 = i % 4 === 2 ? W * (0.42 + placement * 0.12) : -140 + placement * (W * 0.5);
      var amp = 26 + Math.random() * 52;                  // how strongly it waves
      var dir = Math.random() < 0.5 ? 1 : -1;
      // a whole flowing S-curl (two cubic waves that trail off) — so the CURVE
      // reads, rather than a short dash that looks like a straight line.
      var d = 'M ' + x0.toFixed(0) + ' ' + y.toFixed(0) +
        ' C ' + (x0 + len * 0.20).toFixed(0) + ' ' + (y - dir * amp).toFixed(0) +
        ' ' + (x0 + len * 0.40).toFixed(0) + ' ' + (y - dir * amp).toFixed(0) +
        ' ' + (x0 + len * 0.52).toFixed(0) + ' ' + y.toFixed(0) +
        ' C ' + (x0 + len * 0.66).toFixed(0) + ' ' + (y + dir * amp).toFixed(0) +
        ' ' + (x0 + len * 0.86).toFixed(0) + ' ' + (y + dir * amp * 0.55).toFixed(0) +
        ' ' + (x0 + len).toFixed(0) + ' ' + (y + dir * amp * 0.1).toFixed(0);
      var p = document.createElementNS(NS, 'path');
      p.setAttribute('d', d);
      p.setAttribute('fill', 'none');
      var light = i % 3 !== 0;                             // white highlight / warm-grey shadow
      var op = light ? (0.5 + Math.random() * 0.4) : (0.2 + Math.random() * 0.2);
      p.setAttribute('stroke', light ? '#ffffff' : 'rgb(124,124,124)');   /* neutral grey streamlines on the white ground */
      p.setAttribute('stroke-width', (1.1 + Math.random() * 2.2).toFixed(1));
      p.setAttribute('stroke-linecap', 'round');
      p.style.opacity = '0';
      svg.appendChild(p);
      var L = p.getTotalLength();
      var seg = L * (0.5 + Math.random() * 0.28);         // a LONG, clearly-curved visible portion
      p.setAttribute('stroke-dasharray', seg.toFixed(0) + ' ' + (L + seg + 4).toFixed(0));
      if (reduce) { p.setAttribute('stroke-dashoffset', ((L - seg) / 2).toFixed(0)); p.style.opacity = (op * 0.6).toFixed(2); continue; }
      var dur = 900 + Math.random() * 750;
      var anim = p.animate([
        { strokeDashoffset: L, opacity: 0 },              // the curl flows along its own curve...
        { opacity: op, offset: 0.25 },
        { opacity: op, offset: 0.70 },
        { strokeDashoffset: -seg, opacity: 0 }            // ...and fades as it passes
      ], { duration: dur, delay: Math.random() * 360, iterations: Infinity, easing: 'cubic-bezier(.4,0,.5,1)' });
      animations.push(anim);
      paths.push({ anim: anim, path: p, length: L, segment: seg, dash: Math.round(seg) });
    }
    return { animations: animations, paths: paths };
  }};
})();
