/* Gardens Studio — the scroll.
   A single page built on the SAME flower engine (garden.js) and the SAME studio
   content as the hash-routed wind.html version — only the choreography differs.

   The transition is a scroll-CAPTURED scrub, not a native page scroll:
     hero    — the living title is held, fixed, at the centre of the viewport
               (garden.js blooms it in on load). The document does NOT scroll
               natively yet — scroll input is captured.
     scrub   — as you scroll, that input drives a progress p (0->1): the title
               rides UPWARD and its flowers are stirred by the motion
               (window.gardensStudioGust) — the bloom leans the way it travels.
     blow    — a slight bit of scroll (p reaches 1) and the wind streamlines flow
               while the title is carried off to the right (window.Garden.blowAway).
     doc     — the studio document, which sat at the very top all along under the
               title (hidden), fades IN PLACE — it does not slide up from the
               bottom — and native scrolling is released so you read on as one page.
     regrow  — scroll back to the very top and pull up: the studio fades out and
               the title re-plants + blooms again (replant + bloomIn).

   garden.js is shared and loaded UNCHANGED; this file only uses its public API
   (replant / bloomIn / blowAway / setFrame / gardensStudioGust) and never touches
   the wind.* files. */

(function () {
  'use strict';

  // Lock scrolling immediately (before the studio can paint) so the page opens
  // captured on the hero. Released to native scroll once the title blows away.
  document.documentElement.style.overflow = 'hidden';
  if (document.body) document.body.style.overflow = 'hidden';

  // The home title — same layout + framing as the page's config (garden.js
  // already blooms it on load); we re-fetch the layout so a scroll-up re-plant
  // can grow the exact same word again. The layout follows the ACTIVE VARIANT
  // (so a re-plant under Midsommar regrows the ac layout, not the botanical
  // one) or a page-level GARDENS_LOGO override; halfW comes from GARDENS_LOGO.
  var LOGO_CFG = window.GARDENS_LOGO || {};
  var VAR_CFG = window.GARDENS_VARIANT || {};
  var HOME = {
    url: VAR_CFG.layout || LOGO_CFG.dataUrl || 'assets/flowers_stacked.json',
    halfW: LOGO_CFG.halfW || 11,
    layout: null
  };
  fetch(HOME.url).then(function (r) { return r.json(); })
    .then(function (j) { HOME.layout = j.flowers; })
    .catch(function () {});

  var reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  // The scrub budget: SCRUB is the px of scroll that carries p from 0 to 1 (a
  // "slight bit"); LIFT is how far the held title rises over that scrub before it
  // blows. Recomputed on resize from the viewport height.
  var SCRUB = 0, LIFT = 0;
  function computeMetrics() {
    var vh = window.innerHeight || 1;
    // A LONG scrub budget: each wheel tick advances the lift by a small,
    // deliberate amount, so the title-card -> studio journey is slow and smooth.
    // The visual is then eased on top (see easeStep) so wheel-tick steps read
    // as one continuous glide, not snaps.
    SCRUB = clamp(vh * 1.2, 760, 1300);
    LIFT  = vh * 0.14;
  }

  var mode = 'hero';            // 'hero' | 'blowing' | 'doc' | 'growing'
  var p = 0;                    // RAW accumulated capture progress (drives the blow at p>=1)
  var pDisplay = 0;             // EASED, displayed progress — what the title's lift follows
  var easeRAF = 0;             // rAF handle for the lift easing (runs on the hero only)
  var transitioning = false;    // guards the blow / regrow animations
  var body, titleWrap, banner, cue;
  var _windAnims = [];

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    body = document.body;
    titleWrap = document.getElementById('title');
    banner = document.getElementById('banner');
    cue = document.getElementById('cue');

    computeMetrics();
    buildInfo();                       // builds the header + sections and wires them

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize, { passive: true });

    // A reload restored partway down the studio should land in doc mode with the
    // title already gone (not mid-hero). Otherwise start captured on the hero.
    if ((window.scrollY || window.pageYOffset || 0) > 4) {
      enterDoc(true);
    } else {
      lockScroll();
      applyScrub();
    }
  }

  var rT = null;
  function onResize() {
    clearTimeout(rT);
    rT = window.setTimeout(function () { computeMetrics(); if (mode === 'hero') applyScrub(); }, 150);
  }

  // ------------------------------------------------------------- scroll lock
  function lockScroll() {
    document.documentElement.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
  }
  function unlockScroll() {
    document.documentElement.style.overflow = '';
    body.style.overflow = '';
  }

  // Render the held title at the CURRENT displayed progress (it rides upward).
  function renderTitle() {
    titleWrap.style.transform =
      'translate(-50%, calc(-50% - ' + (pDisplay * LIFT).toFixed(2) + 'px))';
  }
  // The cue HOLDS through the whole scrub AND the blow — it only fades out
  // once the flowers have fully blown away (enterDoc adds 'gone', and the
  // cue's opacity transition carries the fade).
  function setCue() {}

  // Instant apply (init / regrow / resize): snap the displayed lift to the raw
  // progress and render — no animation is wanted at those reset points.
  function applyScrub() { pDisplay = p; renderTitle(); setCue(); }

  // Eased apply (wheel / touch / key on the hero): the raw p has already moved;
  // ease the DISPLAYED lift toward it in a rAF loop so each discrete wheel tick
  // is smoothed into a glide instead of snapping. Runs only while on the hero.
  function easeStep() {
    easeRAF = 0;
    if (mode !== 'hero') return;                 // never fight the blow's transform
    var diff = p - pDisplay;
    if (Math.abs(diff) < 0.0012) { pDisplay = p; renderTitle(); return; }
    pDisplay += diff * 0.11;                      // exponential ease-out toward p (soft glide)
    renderTitle();
    easeRAF = requestAnimationFrame(easeStep);
  }
  function scheduleEase() {
    setCue();
    if (!easeRAF && mode === 'hero') easeRAF = requestAnimationFrame(easeStep);
  }
  function stopEase() { if (easeRAF) { cancelAnimationFrame(easeRAF); easeRAF = 0; } }

  // Stir the flowers by how fast (and which way) the scroll just moved. Down-
  // scroll (delta > 0) lifts the title, so the bloom leans UP (dirZ -1); an
  // up-scroll leans it back down. Strength ramps QUADRATICALLY with scroll speed
  // (a soft knee): slow, deliberate scrolls barely whisper — below a tiny
  // threshold there is no gust at all — while brisk flicks still stream the
  // flowers at roughly the old ceiling.
  //
  // Speed is measured over a rolling ~90ms WINDOW, not per event, so it is
  // device-neutral: one mouse-wheel tick (~120px) sits alone in the window and
  // scores like before, while a Mac-trackpad swipe — dozens of 2-25px deltas —
  // sums to the brisk speed it really is (per-event it never crossed the
  // threshold, so trackpads felt dead). Gusts are lightly rate-limited so the
  // dense trackpad stream doesn't machine-gun them.
  var stirWin = [], lastGust = 0;
  function stir(delta) {
    if (reduceMQ.matches || typeof window.gardensStudioGust !== 'function') return;
    var now = performance.now();
    stirWin.push({ t: now, d: delta });
    while (stirWin.length && now - stirWin[0].t > 90) stirWin.shift();
    var sum = 0;
    for (var i = 0; i < stirWin.length; i++) sum += stirWin[i].d;
    var speed = Math.abs(sum);
    if (speed < 14) return;                       // below a whisper: no gust
    if (now - lastGust < 70) return;              // one gust per beat, however dense the input
    var x = clamp(speed / 150, 0, 1);             // 150px in the window ~ a brisk flick
    var str = x * x * 0.9;                         // quadratic soft-knee, same ~0.9 ceiling
    if (str < 0.02) return;                        // sub-whisper: skip entirely
    lastGust = now;
    var dirZ = sum >= 0 ? -1 : 1;
    window.gardensStudioGust((Math.random() - 0.5) * 0.4, dirZ, str);
  }

  // No single scroll may carry you all the way: one continuous gesture (a flick
  // and its inertia, a drag, a held key) can contribute at most GESTURE_MAX of
  // the progress, so reaching the blow takes AT LEAST TWO distinct scrolls. A
  // quiet gap in the input (or a fresh touch) starts the next gesture.
  var GESTURE_MAX = 0.62;      // < 1 and > 0.5: exactly two full gestures suffice
  var GESTURE_GAP = 350;       // ms of stillness that ends a gesture (inertia-safe)
  var gestureP = 0, lastInputTs = 0;

  // A quiet gap alone can't separate two deliberate MAC-TRACKPAD swipes: each
  // flick trails 1-2s of inertial deltas with no gap, so the second swipe used
  // to merge into the first (already spent at the cap) and the title wouldn't
  // budge. Track the |delta| ENVELOPE of the live gesture instead — momentum
  // only ever decays, so a sharp re-acceleration out of a died-down tail is a
  // new finger push. Steady ~120px mouse ticks never look like a decayed tail,
  // so wheel behaviour is unchanged.
  var env = { ema: 0, peak: 0 };
  function beginsGesture(delta) {
    var now = performance.now(), d = Math.abs(delta), fresh = false;
    if (now - lastInputTs > GESTURE_GAP) fresh = true;             // quiet gap (mouse, touch)
    else if (env.peak > 10 &&
             env.ema < Math.max(env.peak * 0.35, 4) &&
             d > Math.max(env.ema * 3, 9)) fresh = true;           // re-acceleration out of the tail
    lastInputTs = now;
    if (fresh) { env.ema = d; env.peak = d; }
    else {
      // ASYMMETRIC envelope: follow decay instantly (momentum only ever falls),
      // rise slowly — so a fresh push's ramping deltas outrun it and register
      // above, instead of the envelope catching up and hiding the push.
      env.ema = d < env.ema ? d : env.ema * 0.9 + d * 0.1;
      if (d > env.peak) env.peak = d;
    }
    return fresh;
  }
  function resetGesture() { gestureP = 0; env.ema = 0; env.peak = 0; lastInputTs = 0; }

  // Advance the capture by a raw scroll delta (px, positive = down). Always
  // consumes the event while capturing on the hero.
  function advance(delta) {
    if (transitioning) return;
    if (reduceMQ.matches) {           // no scrub/physics — reveal at a touch
      if (delta > 0) startBlow();
      return;
    }
    if (beginsGesture(delta)) gestureP = 0;   // a fresh gesture begins
    var step = delta / SCRUB;
    if (step > 0) {                   // downward progress is capped per gesture
      var room = GESTURE_MAX - gestureP;
      if (room <= 0.001) return;      // this gesture is spent — the title holds
      // Ease INTO the cap rather than slamming a wall: inside the last ~30% of
      // the budget each step shrinks with the remaining room, so a trackpad
      // glide settles to a stop instead of freezing mid-momentum. (Discrete
      // wheel ticks land between frames and never showed the wall anyway.)
      var soft = clamp(room / (GESTURE_MAX * 0.3), 0, 1);
      step = Math.min(step * soft, room);
      gestureP += step;
    }
    var was = p;
    p = clamp(p + step, 0, 1.0001);
    if (p !== was) stir(delta);
    if (p >= 1) { p = 1; startBlow(); }   // blow triggers off RAW p, not the eased lift
    else scheduleEase();
  }

  // Getting BACK to the title also takes two scrolls: at the exact top of the
  // studio, one upward gesture only ARMS the regrow; a second distinct upward
  // gesture (after a quiet gap) fires it. An accidental single wheel tick never
  // carries you off the page, and the armed state expires so two strays minutes
  // apart don't combine — only someone trying to return will get there.
  var REGROW_TTL = 2000;       // ms the armed state survives before it forgets
  var upArm = { n: 0, ts: 0 };
  function upTick(delta) {
    var now = performance.now();
    if (now - upArm.ts > REGROW_TTL) upArm.n = 0;        // stale — start over
    if (beginsGesture(delta)) upArm.n++;                 // a distinct gesture (gap OR trackpad re-push)
    upArm.ts = now;
    if (upArm.n >= 2) { upArm.n = 0; startRegrow(); }
  }

  // ------------------------------------------------------------------ input
  // Normalise wheel deltas to PIXELS: Firefox mouse wheels report LINES
  // (deltaMode 1, ~3 per tick) — un-normalised they made SCRUB near-unreachable.
  function normDelta(e) {
    if (e.deltaMode === 1) return e.deltaY * 16;
    if (e.deltaMode === 2) return e.deltaY * (window.innerHeight || 800);
    return e.deltaY;
  }
  function onWheel(e) {
    if (mode === 'hero') { e.preventDefault(); advance(normDelta(e)); }
    else if (transitioning || mode === 'blowing' || mode === 'growing') {
      // Swallow any leftover scroll momentum during the hand-off so it can't
      // leak into native scroll and land the reveal partway down the studio
      // (which would push the first heading back under the fixed chrome).
      e.preventDefault();
    }
    else if (mode === 'doc') {
      // At the very top, pulling further up (twice) re-grows the title.
      var nd = normDelta(e);
      if ((window.scrollY || window.pageYOffset || 0) <= 0 && nd < 0) {
        e.preventDefault(); upTick(nd);
      } else if (nd > 0) {
        upArm.n = 0;                  // heading back down — disarm
      }
    }
  }

  // --- touch on the hero: GESTURE-COUNTED advance -------------------------
  // On a phone a swipe is a discrete statement, not a scroll distance. The
  // desktop wheel/trackpad keeps the distance-scrubbed advance() below, but a
  // finger works in whole swipes: the FIRST deliberate downward swipe lifts
  // the title to its held halfway point (visibly acknowledged), the SECOND
  // sends it to the wind — never a third. "Deliberate" is a short net-travel
  // threshold (TSWIPE_MIN), so accidental brushes neither count nor stick:
  // an under-threshold drag eases back to the last committed stop. A
  // deliberate UPWARD swipe resets the count and lowers the title.
  var TSWIPE_MIN = 55;         // px net downward travel that makes a swipe count
  var TSWIPE_FEEL = 300;       // px over which the pre-threshold live lift builds
  var tswipe = { count: 0, dist: 0, done: false };
  var touch = { on: false, y: 0 };
  function onTouchStart(e) {
    touch.on = true; touch.y = e.touches[0].clientY;
    tswipe.dist = 0; tswipe.done = false;
    resetGesture();                   // a fresh finger is a fresh gesture
  }
  function onTouchMove(e) {
    if (!touch.on) return;
    var y = e.touches[0].clientY, delta = touch.y - y;   // finger up => delta > 0 (scroll down)
    touch.y = y;
    if (mode === 'hero') {
      e.preventDefault();
      if (reduceMQ.matches) { if (delta > 0) startBlow(); return; }
      if (transitioning) return;
      tswipe.dist += delta;
      stir(delta);                    // the flowers feel the swipe as before
      if (tswipe.done) return;        // one touch counts at most once
      if (tswipe.dist >= TSWIPE_MIN) {
        tswipe.done = true;
        tswipe.count++;
        if (tswipe.count >= 2) { tswipe.count = 0; p = 1; startBlow(); return; }
        p = 0.5; scheduleEase();      // swipe 1 acknowledged: the title holds halfway
      } else if (tswipe.dist <= -TSWIPE_MIN) {
        tswipe.done = true;
        tswipe.count = 0;             // deliberate up-swipe: stand down
        p = 0; scheduleEase();
      } else {
        // pre-threshold live feedback: the held title follows the finger
        p = clamp(tswipe.count * 0.5 + Math.max(0, tswipe.dist) / TSWIPE_FEEL * 0.35, 0, 0.98);
        scheduleEase();
      }
    }
    else if (transitioning || mode === 'blowing' || mode === 'growing') { e.preventDefault(); }
    else if (mode === 'doc') {
      if ((window.scrollY || window.pageYOffset || 0) <= 0 && delta < 0) {
        e.preventDefault(); upTick(delta);
      } else if (delta > 0) {
        upArm.n = 0;                  // heading back down — disarm
      }
    }
  }
  function onTouchEnd() {
    touch.on = false;
    // an under-threshold drag was only feedback — settle back on the last stop
    if (mode === 'hero' && !tswipe.done && !transitioning && !reduceMQ.matches) {
      p = tswipe.count * 0.5; scheduleEase();
    }
  }

  function onKey(e) {
    if (mode === 'hero' && !transitioning) {
      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault(); advance(SCRUB * 0.5);
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault(); advance(-SCRUB * 0.5);
      }
    } else if (mode === 'doc' && !transitioning &&
               (window.scrollY || window.pageYOffset || 0) <= 0 &&
               (e.key === 'ArrowUp' || e.key === 'PageUp')) {
      e.preventDefault(); upTick(-SCRUB * 0.5);
    }
  }

  // The wordmark carries you back to the top — and re-grows the title.
  function onHomeClick(e) {
    e.preventDefault();
    if (mode === 'doc' && !transitioning) startRegrow();
  }

  // Run cb once the flower engine is live (garden.js sets window.Garden and
  // fires 'garden-ready' after it finishes loading three.js + the assets).
  function whenGarden(cb) {
    if (window.Garden && window.Garden.isReady) cb();
    else window.addEventListener('garden-ready', function h() {
      window.removeEventListener('garden-ready', h); cb();
    });
  }

  // ---------------------------------------------------------------- blow-away
  // hero -> doc. The gust arrives first as the cue, then a beat later carries the
  // lifted title off to the right; when the last flower has flown, the studio
  // document (already at the top, hidden) fades in place and native scroll opens.
  function startBlow() {
    if (mode !== 'hero' || transitioning) return;
    stopEase();                        // no stray ease frame over the blow transform
    mode = 'blowing';
    transitioning = true;
    // NOTE: the studio header is NOT lit here — it appears only once the title
    // has fully blown away (enterDoc adds body.revealed, which stages it in:
    // the header first, then the section body a beat later).

    var done = false;
    function finish() {
      if (done) return; done = true;
      enterDoc(false);
      restoreBanner();
      hideWind();
      transitioning = false;
    }

    // Reduced motion: skip the streamlines + the fly-off; a quick fade instead.
    if (reduceMQ.matches) {
      if (cue) cue.classList.add('gone');
      titleWrap.classList.add('fading');
      window.setTimeout(function () { titleWrap.classList.remove('fading'); finish(); }, 300);
      return;
    }

    whenGarden(function () {
      showWind();
      window.setTimeout(function () {
        expandBannerFull();
        window.Garden.blowAway(finish);
      }, 460);
    });
    // Watchdog: guarantee the hand-off resolves even if the rAF callback is
    // delayed (e.g. the tab was backgrounded mid-blow). Blow runs ~1.9s.
    window.setTimeout(finish, 2600);
  }

  // Expand the title canvas to fill the window and reframe the camera by the SAME
  // factor (title stays the exact same size/place) so the flowers fly clear to
  // the window's right edge. Preserve the scrubbed lift so nothing jumps at blow.
  // (The full-window trick is ported from wind.js.)
  function expandBannerFull() {
    var bw = banner.clientWidth || 1;
    var fullHalfW = HOME.halfW * window.innerWidth / bw;
    titleWrap.classList.add('blowing');
    titleWrap.style.transform = 'translateY(-' + (p * LIFT).toFixed(1) + 'px)';
    window.Garden.setFrame({ halfW: fullHalfW });
  }
  function restoreBanner() {
    titleWrap.classList.remove('blowing');
    titleWrap.style.transform = '';
  }

  // Commit to the studio document: title away, chrome + studio faded in AT THE
  // TOP (in place — not scrolled up from below), native scrolling released.
  // atLoad = a reload that was already scrolled down into the studio.
  function enterDoc(atLoad) {
    mode = 'doc';
    upArm.n = 0;                       // arrive disarmed — regrow needs two fresh up-scrolls
    if (cue) cue.classList.add('gone');   // the flowers are away — fade the cue out
    titleWrap.classList.add('gone');
    body.classList.add('revealed');    // stages the reveal: header first, body a beat later
    unlockScroll();
    // A fresh blow-away always reveals the studio AT THE TOP — guard against any
    // scroll that slipped through so the first heading sits clear of the chrome.
    // (A reload already scrolled into the studio keeps its position.)
    if (!atLoad) window.scrollTo(0, 0);
    if (atLoad) transitioning = false;
  }

  // ----------------------------------------------------------------- re-grow
  // doc -> hero. Back at the very top, the studio fades out, the page re-locks,
  // and the title re-plants at scale 0 and blooms out of the ground again.
  function startRegrow() {
    if (mode !== 'doc' || transitioning) return;
    mode = 'growing';
    transitioning = true;

    window.scrollTo(0, 0);
    lockScroll();
    body.classList.remove('revealed');    // studio fades out (header + body together)
    if (cue) cue.classList.remove('gone');

    p = 0; gestureP = 0; lastInputTs = 0;
    showTitle();
    applyScrub();

    var done = false;
    function finish() {
      if (done) return; done = true;
      mode = 'hero';
      transitioning = false;
      tswipe.count = 0;               // regrown title: the two-swipe count restarts
    }

    whenGarden(function () {
      if (HOME.layout) window.Garden.replant(HOME.layout, { halfW: HOME.halfW });
      window.Garden.bloomIn(finish);
    });
    // Watchdog: bloom runs ~2.9s (a touch quicker under reduced motion).
    window.setTimeout(finish, reduceMQ.matches ? 900 : 3800);
  }

  function showTitle() {
    titleWrap.classList.remove('gone');
    titleWrap.classList.remove('blowing');
    titleWrap.classList.remove('fading');
    titleWrap.style.opacity = '';
  }

  // ------------------------------------------------------------------ wind
  // Draw a field of flowing, curved wind streamlines — soft tapered lines with a
  // travelling "gust" segment sweeping along each, staggered at different heights
  // and speeds, so it reads as moving air rather than static streaks.
  // (Ported verbatim from wind.js — it is fully self-contained.)
  function showWind() {
    var w = document.getElementById('wind'); if (!w) return;
    var svg = document.getElementById('windSvg');
    var W = window.innerWidth, H = window.innerHeight;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.innerHTML = '';
    _windAnims = [];
    var reduce = reduceMQ.matches;
    var N = Math.round(9 + W / 340);
    var NS = 'http://www.w3.org/2000/svg';
    for (var i = 0; i < N; i++) {
      var y = H * (0.06 + 0.88 * ((i + 0.5) / N)) + (Math.random() - 0.5) * (H / N * 0.8);
      var len = 220 + Math.random() * 460;                // length of this gust curl
      var x0 = -140 + Math.random() * (W * 0.5);          // starts a bit left of where it drifts
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
      _windAnims.push(anim);
    }
    w.classList.add('on');
  }
  function hideWind() {
    var w = document.getElementById('wind'); if (!w) return;
    w.classList.remove('on');
    window.setTimeout(function () {
      _windAnims.forEach(function (a) { try { a.cancel(); } catch (e) {} });
      _windAnims = [];
      var svg = document.getElementById('windSvg'); if (svg) svg.innerHTML = '';
    }, 420);
  }

  // ================================================================== info
  // The studio document — a satspace.ltd-style scroll. A static HEADER band sits
  // at the very top (it scrolls away with the page). Below it, each section is a
  // flex row: a sticky LEFT text column beside a RIGHT column of full-size,
  // uncropped images (or the drawn plan / the equipment grid) that flow past the
  // pinned text — the pinned-vs-flowing differential IS the staggered movement.
  // Contact closes full-width. The nav-highlight observer is viewport-rooted
  // (root:null) since the whole page scrolls natively, and clicks scroll the
  // window. The Amenities/Equipment lists carry the studio's REAL kit and
  // amenities (2026-08-21); the plan is our own drawing, relabelled with
  // satspace-derived figures (never a copied image).
  var S = 'assets/studio/';

  // A full-size, uncropped image for a right column (natural aspect ratio — no
  // object-fit, no fixed-height frame). Every image carries its INTRINSIC
  // width/height attributes: without them a lazy image has no box (renders at
  // width x 0), which both jumps the layout and — observed on iPhone — can
  // leave the loader stuck at complete:false. The attributes reserve the
  // correct aspect box up front (CSS width:100%; height:auto scales it).
  var IMG_DIMS = {
    'arcade': [2400, 1601], 'cyc-2': [2000, 1334], 'cyclorama': [2400, 1601],
    'green-2': [1000, 1500], 'green-room': [1334, 2000], 'lounge': [2400, 1601],
    'lounge-2': [2000, 1334], 'piano-hall': [2400, 1601], 'vanity-2': [2000, 1334]
  };
  function imgTag(slug, alt, eager, cls) {
    var d = IMG_DIMS[slug];
    return '<img src="' + S + slug + '.jpg" alt="Gardens Studio — ' + alt + '"' +
      (cls ? ' class="' + cls + '"' : '') +
      (d ? ' width="' + d[0] + '" height="' + d[1] + '"' : '') +
      ' loading="' + (eager ? 'eager' : 'lazy') + '" decoding="async">';
  }
  function rightImages(list) {
    return '<div class="main-right">' + list.map(function (im, i) {
      // The stack's lead image greets the reveal — never lazy-load it; an
      // entry can also force eager itself (im[2]) for the phone sequence,
      // and carry a class (im[3]) — 'mob-hide' keeps an image desktop-only.
      return imgTag(im[0], im[1], i === 0 || !!im[2], im[3]);
    }).join('') + '</div>';
  }

  // A section: a sticky-left heading + content beside a right column (a stack of
  // images, the drawn plan, or the kit grid — passed in as `right`).
  function section(id, idx, title, leftInner, right) {
    return '<section class="main" id="' + id + '">' +
      '<div class="main-left"><div class="main-left-inner">' +
        '<header class="sec-head">' +
          '<h2 class="sec-title">' + title + '</h2></header>' +
        leftInner +
      '</div></div>' +
      right +
    '</section>';
  }

  // An ORIGINAL top-down floor plan of the single studio room: ink walls, dashed
  // open zones, poppy accents on the cove + door, thin mono labels, dim ticks.
  function floorPlan() {
    return '' +
'<svg class="floorplan" viewBox="0 0 900 560" role="img" ' +
     'aria-label="Floor plan of Gardens Studio: a single room of roughly 2,800 square feet, about 67 by 42 feet, with a 22 by 14 foot white shooting cove to the west, an open shooting floor and lounge in the centre, and vanity, green room and kitchen along the east wall, under a 14 foot ceiling.">' +
  '<path class="fp-wall" d="M70 70 L760 70 M760 70 L760 470 M70 70 L70 470 M70 470 L150 470 M210 470 L760 470"/>' +
  '<path class="fp-wall" d="M560 70 L560 120 M560 155 L560 255 M560 290 L560 395 M560 430 L560 470"/>' +
  '<path class="fp-wall" d="M560 200 L760 200 M560 340 L760 340"/>' +
  '<path class="fp-open" d="M300 70 L300 470"/>' +
  '<path class="fp-open" d="M300 330 L560 330"/>' +
  '<path class="fp-accent" d="M70 210 A150 150 0 0 1 210 70"/>' +
  '<path class="fp-accent" d="M150 470 L150 410"/>' +
  '<path class="fp-accent" d="M150 410 A60 60 0 0 1 210 470"/>' +
  '<path class="fp-win" d="M310 66 L540 66 M310 74 L540 74 M310 66 L310 74 M367 66 L367 74 M425 66 L425 74 M482 66 L482 74 M540 66 L540 74"/>' +
  '<path class="fp-dim" d="M70 514 L760 514"/>' +
  '<path class="fp-tick" d="M70 508 L70 520 M760 508 L760 520"/>' +
  '<path class="fp-dim" d="M800 70 L800 470"/>' +
  '<path class="fp-tick" d="M794 70 L806 70 M794 470 L806 470"/>' +
  '<text class="fp-label" x="185" y="264" text-anchor="middle">CYCLORAMA</text>' +
  '<text class="fp-sub"   x="185" y="284" text-anchor="middle">22′ × 14′ WALL</text>' +
  '<text class="fp-label" x="430" y="192" text-anchor="middle">SHOOTING FLOOR</text>' +
  '<text class="fp-sub"   x="430" y="212" text-anchor="middle">≈ 2,800 SQ FT</text>' +
  '<text class="fp-label" x="430" y="404" text-anchor="middle">LOUNGE</text>' +
  '<text class="fp-sub"   x="430" y="424" text-anchor="middle">WAIT &amp; STYLE</text>' +
  '<text class="fp-label" x="660" y="128" text-anchor="middle">VANITY</text>' +
  '<text class="fp-sub"   x="660" y="148" text-anchor="middle">HAIR &amp; MAKEUP</text>' +
  '<text class="fp-label" x="660" y="270" text-anchor="middle">GREEN ROOM</text>' +
  '<text class="fp-sub"   x="660" y="290" text-anchor="middle">STILL LIFE</text>' +
  '<text class="fp-label" x="660" y="406" text-anchor="middle">KITCHEN</text>' +
  '<text class="fp-sub"   x="660" y="426" text-anchor="middle">COFFEE &amp; PREP</text>' +
  '<text class="fp-sub"  x="425" y="52"  text-anchor="middle">NORTH-FACING WINDOWS</text>' +
  '<text class="fp-sub"  x="180" y="503" text-anchor="middle">ENTRANCE</text>' +
  '<text class="fp-sub"  x="90"  y="452" text-anchor="start">14 FT CEILING</text>' +
  '<text class="fp-meas" x="415" y="535" text-anchor="middle">67 ft</text>' +
  '<text class="fp-meas" x="820" y="270" text-anchor="middle" transform="rotate(-90 820 270)">42 ft</text>' +
'</svg>';
  }

  // The floor-plan legend, reused by the pinned plan frame and its mobile inline.
  function fpLegend() {
    return '<div class="fp-legend"><span><i class="sw ink"></i>Walls</span>' +
      '<span><i class="sw dash"></i>Open zones</span>' +
      '<span><i class="sw pop"></i>Cove &amp; door</span></div>';
  }

  // AMENITIES — the studio's real amenities (replaced the satspace-derived
  // placeholder spec list on 2026-08-21).
  var FEATURES = [
    'Cyc wall',
    'Lighting Grid (adjustable, powered)',
    'Work area',
    'Kitchen',
    'Lounge area',
    'Dressing room',
    'Bathroom'
  ];

  // EQUIPMENT — the studio's real house kit (replaced satspace's public
  // equipment copy on 2026-08-21). Category labels are formatting only.
  var KIT = [
    ['Lighting', [
      '2\u00d7 Profoto D2',
      'Profoto Connect Pro (Canon)',
      'Aputure 300D II',
      'Aputure Spotlight'
    ]],
    ['Modifiers & Grip', [
      'Profoto RFi 4.0 \u00d7 6.0\u2032 Softbox',
      '6\u00d7 C-Stands'
    ]]
  ];

  // ---- The header band ----------------------------------------------------
  // Wordmark / contact / numbered nav grid. Adjacent borders collapse into single
  // hairlines; the nav runs 01 across the top row, then 02–05 in a 2×2. Faded in
  // FIRST on reveal; it scrolls away with the page (no fixed overlay).
  function hrow(label, value) {
    return '<div class="hrow"><span class="hlabel">' + label + '</span>' + value + '</div>';
  }
  function navCell(sec, n, t, full) {
    return '<a class="hnav-cell' + (full ? ' hnav-full' : '') +
      '" href="#' + sec + '" data-sec="' + sec + '">' +
      '<span class="t">' + t + '</span></a>';
  }
  function headerHtml() {
    return '' +
      '<div class="hbox hbox-mark">' +
        '<a class="hmark-word" id="homeMark" href="#top" aria-label="Gardens Studio — back to top">Gardens Studio</a>' +
        '<button class="hmenu" id="hMenu" type="button" aria-expanded="false" aria-controls="infoNav">Menu</button>' +
      '</div>' +
      '<div class="hbox hbox-contact">' +
        hrow('Address', '<span class="hval">Unit 4, The Old Nursery, 118 Verge Lane, North Quarter</span>') +
        hrow('Email', '<a class="hval" href="mailto:hello@gardens.studio">hello@gardens.studio</a>') +
        hrow('Instagram', '<a class="hval" href="https://instagram.com" target="_blank" rel="noopener">@gardens.studio</a>') +
      '</div>' +
      '<nav class="hbox hbox-nav" id="infoNav" aria-label="Studio sections">' +
        navCell('info-space', '01', 'The Space', true) +
        navCell('info-features', '02', 'Amenities') +
        navCell('info-plan', '03', 'Floor Plan') +
        navCell('info-equipment', '04', 'Equipment') +
        navCell('info-contact', '05', 'Contact') +
      '</nav>';
  }

  // ---- The sections -------------------------------------------------------
  // MOBILE-ONLY blocks (hidden on desktop via scroll.css). The phone read
  // opens on the cyc wall bleeding to all four corners of the viewport, and
  // the piano photo sits immediately above the Equipment heading.
  function mobileCycHero() {
    return '<div class="mobile-hero-cyc">' +
      imgTag('cyclorama', 'the cyc wall', true) + '</div>';
  }
  function mobilePiano() {
    return '<div class="mobile-piano">' +
      imgTag('piano-hall', 'the working end and the grand piano', true) + '</div>';
  }

  // THE SPACE + AMENITIES — one section: both headings share the sticky left
  // column (the amenities list reads alongside the space copy while the
  // photos flow past on the right). The right column carries the space stack
  // (desktop-only, 'mob-hide' — the phone's cyc opener replaces it) followed
  // by the amenities photos, which show everywhere. The amenities subhead
  // keeps the id the header nav links to.
  function spaceSection() {
    // Condensed single block (2026-08-21) — still placeholder copy.
    var copy = '<div class="sec-copy">' +
      '<p>Gardens Studio is a single high room at the north edge of the city — one space to book that behaves like a dozen across a day. Nothing is fixed but the walls: the cove drops from the ceiling, furniture rides on castors, the windows black out in about a minute. A shape, not a set — a place you finish yourself.</p>' +
      '<p class="ph-note">Placeholder text — final copy to come.</p>' +
      '</div>';
    var amen = '<header class="sec-head sec-head-sub" id="info-features">' +
      '<h2 class="sec-title">Amenities</h2></header>' +
      '<ul class="sec-list">' + FEATURES.map(function (f) {
        return '<li>' + f + '</li>';
      }).join('') + '</ul>';
    return section('info-space', '01', 'The space', copy + amen, rightImages([
      ['cyclorama', 'the cyc wall', false, 'mob-hide'],
      ['lounge-2', 'the lounge', false, 'mob-hide'],
      ['arcade', 'the arcade run', false, 'mob-hide'],
      ['vanity-2', 'the vanity, ringed with warm bulbs', false, 'mob-hide'],
      ['green-room', 'the green room', true],
      ['green-2', 'the green room, styled', true]
    ]));
  }

  // 03 FLOOR PLAN — sticky-left heading + a short note; the drawn plan rides the
  // right column (legend beneath), the satspace convention of a plan-as-media.
  function planSection() {
    var note = '<div class="sec-copy"><p>One volume, drawn to give you the shape of it — a 22′ × 14′ shooting wall down the west side, a clear span beneath a 14-foot ceiling, roughly 2,800 square feet in all. The soft rooms tuck into a row along the east wall; north light runs the whole way across the top.</p>' +
      '<p class="ph-note">Placeholder text — final copy to come.</p></div>';
    var right = '<div class="main-right main-right-plan"><figure class="plan-figure">' +
      floorPlan() + fpLegend() +
      '<figcaption class="ph-note">Placeholder image — final floor plan to come.</figcaption>' +
      '</figure></div>';
    return section('info-plan', '03', 'Floor plan', note, right);
  }

  // 04 EQUIPMENT — sticky-left heading only; the category lists fill the right
  // column as a two-column grid (satspace's exact convention for this section).
  function equipmentSection() {
    var grid = '<div class="kit-grid">' + KIT.map(function (c) {
      return '<div class="kit-cat"><h3>' + c[0] + '</h3><ul>' +
        c[1].map(function (i) { return '<li>' + i + '</li>'; }).join('') + '</ul></div>';
    }).join('') + '</div>';
    var right = '<div class="main-right main-right-kit">' +
      '<div class="equip-piano">' +
        imgTag('piano-hall', 'the working end and the grand piano') + '</div>' +
      grid + '</div>';
    return section('info-equipment', '04', 'Equipment', '', right);
  }

  // 05 CONTACT — a full-width close: the contact grid, CTAs, the design-study
  // note, and a back-to-top foot.
  function contactSection() {
    return '<section class="info-contact" id="info-contact">' +
      '<header class="sec-head">' +
        '<h2 class="sec-title">Contact Us</h2></header>' +
      // The section IS the contact form — a subject line and a body, plus an
      // email so we can write back. (Address / email / instagram live in the
      // header band above.)
      '<div class="contact-form-wrap" id="contactFormWrap">' +
        '<form class="form contact-form" id="contactForm" novalidate>' +
          '<div class="field"><label for="cf-em">Your email</label>' +
            '<input id="cf-em" name="em" type="email" autocomplete="email" required></div>' +
          '<div class="field"><label for="cf-sub">Subject</label>' +
            '<input id="cf-sub" name="sub" type="text" required></div>' +
          '<div class="field"><label for="cf-msg">Message</label>' +
            '<textarea id="cf-msg" name="msg" rows="5" required></textarea></div>' +
          '<button class="send" type="submit">Send it <span class="arr" aria-hidden="true">&rarr;</span></button>' +
        '</form>' +
      '</div>' +
      '<p class="info-note">Gardens Studio is an imagined place — a design study. The address and contact details are placeholders for a studio that doesn’t (yet) exist; the feature and equipment lists are sample content.</p>' +
      '<div class="info-foot">' +
        '<span class="foot-mark">Gardens Studio</span>' +
        '<a class="to-top" href="#top" id="toTop">Back to the top <span class="arr" aria-hidden="true">&uarr;</span></a>' +
      '</div>' +
    '</section>';
  }

  function buildInfo() {
    var header = document.getElementById('infoHeader');
    var host = document.getElementById('infoBody');
    if (header) header.innerHTML = headerHtml();
    if (host) {
      host.innerHTML =
        mobileCycHero() + spaceSection() + planSection() +
        mobilePiano() + equipmentSection() + contactSection();
    }

    var toTop = document.getElementById('toTop');
    if (toTop) toTop.addEventListener('click', onHomeClick);

    wireHeader();
    wireInfoNav();
    wireContactForm();
  }

  // The contact form: validate (an email we can reply to, a subject, a body),
  // then swap the form for a thank-you in place. No backend — this is the
  // design study's stand-in for a real send, matching the wind.html version.
  function wireContactForm() {
    var form = document.getElementById('contactForm');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var em = form.em.value.trim(), sub = form.sub.value.trim(), msg = form.msg.value.trim();
      var bad = (em.indexOf('@') < 1) ? form.em : (!sub ? form.sub : (!msg ? form.msg : null));
      if (bad) { bad.focus(); return; }
      var wrap = document.getElementById('contactFormWrap');
      wrap.innerHTML =
        '<p class="done-note">Thank you.</p>' +
        '<p class="done-sub">Your note — <em>' + esc(sub) + '</em> — is in the garden. ' +
          'We read everything and reply to ' + esc(em) + ' within two days.</p>';
    });
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Header wiring: the wordmark carries you home (regrow); the mobile Menu button
  // toggles the nav grid open below the wordmark box.
  function wireHeader() {
    var hm = document.getElementById('homeMark');
    if (hm) hm.addEventListener('click', onHomeClick);
    var header = document.getElementById('infoHeader');
    var menu = document.getElementById('hMenu');
    if (menu && header) {
      menu.addEventListener('click', function () {
        var open = header.classList.toggle('nav-open');
        menu.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    }
  }

  // Numbered nav: click smooth-scrolls the matching section so its heading lands
  // near its pinned rest. The header has scrolled away, so the only clearance is
  // a small offset = the sticky-left top (--stick). An IntersectionObserver
  // (viewport-rooted) lights the active cell as you scroll — a poppy top border
  // on the current section. On mobile a click also closes the dropped-open nav.
  function stickPx() {
    return clamp((window.innerHeight || 800) * 0.22, 172, 216);   // mirrors --stick
  }
  function wireInfoNav() {
    var nav = document.getElementById('infoNav');
    if (!nav) return;
    var header = document.getElementById('infoHeader');
    var links = Array.prototype.slice.call(nav.querySelectorAll('.hnav-cell'));
    var reduce = reduceMQ.matches;

    function setActive(id) {
      links.forEach(function (a) { a.classList.toggle('active', a.getAttribute('data-sec') === id); });
    }
    function closeMenu() {
      if (!header) return;
      header.classList.remove('nav-open');
      var m = document.getElementById('hMenu');
      if (m) m.setAttribute('aria-expanded', 'false');
    }
    links.forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var el = document.getElementById(a.getAttribute('data-sec'));
        if (!el) { closeMenu(); return; }
        var top = el.getBoundingClientRect().top + (window.scrollY || window.pageYOffset || 0) - stickPx();
        window.scrollTo({ top: Math.max(0, top), behavior: reduce ? 'auto' : 'smooth' });
        setActive(a.getAttribute('data-sec'));
        closeMenu();
      });
    });
    setActive(links[0] && links[0].getAttribute('data-sec'));

    if ('IntersectionObserver' in window) {
      var obs = new IntersectionObserver(function (entries) {
        var vis = entries.filter(function (en) { return en.isIntersecting; });
        if (!vis.length) return;
        vis.sort(function (a, b) { return a.boundingClientRect.top - b.boundingClientRect.top; });
        setActive(vis[0].target.id);
      }, { root: null, rootMargin: '-30% 0px -55% 0px', threshold: 0 });
      links.forEach(function (a) {
        var el = document.getElementById(a.getAttribute('data-sec'));
        if (el) obs.observe(el);
      });
    }
  }
})();
