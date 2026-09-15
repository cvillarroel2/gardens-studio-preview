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
    // The scrub budget is deliberately SHORT (2026-09-08 — "less swiping"):
    // one committed scroll carries the title to the wind. The visual is still
    // eased on top (see easeStep) so wheel-tick steps read as one continuous
    // glide, not snaps.
    SCRUB = clamp(vh * 0.7, 440, 800);
    LIFT  = vh * 0.14;
  }

  // The page is NOT swipeable until the word has finished blooming
  // (2026-09-08): garden.js announces completion with 'gardens-bloomed';
  // until then hero swipes/wheels are swallowed. The 4.5s timer is a safety
  // net (engine failed to load, reduced-motion paths) so the page can never
  // be permanently locked.
  var bloomed = false;
  window.addEventListener('gardens-bloomed', function () { bloomed = true; });
  window.setTimeout(function () { bloomed = true; }, 4500);

  var mode = 'hero';            // 'hero' | 'blowing' | 'doc' | 'growing'
  var p = 0;                    // RAW accumulated capture progress (drives the blow at p>=1)
  var pDisplay = 0;             // EASED, displayed progress — what the title's lift follows
  var easeRAF = 0;             // rAF handle for the lift easing (runs on the hero only)
  var transitioning = false;    // guards the blow / regrow animations
  var body, titleWrap, banner, cue;
  var _windAnims = [];
  var _windPaths = [], _windGustRAF = 0;

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
    window.addEventListener('touchcancel', cancelTouch, { passive: true });
    window.addEventListener('blur', cancelTouch);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) cancelTouch();
    });
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
  // TIME-BASED smoothing (2026-09-08): the blend derives from real frame dt,
  // not a per-frame constant, so the glide is identical at any refresh rate —
  // and while a FINGER is down the time-constant tightens so the title tracks
  // the drag closely (a finger-attached element that lags reads as clunky);
  // discrete wheel ticks keep the longer, softer glide.
  var easePrevT = 0;
  function easeStep(ts) {
    easeRAF = 0;
    if (mode !== 'hero') return;                 // never fight the blow's transform
    var now = ts || performance.now();
    var dt = easePrevT ? Math.min((now - easePrevT) / 1000, 0.05) : 1 / 60;
    easePrevT = now;
    var before = pDisplay, diff = p - pDisplay;
    // Finish below a tenth of a pixel, so the final snap cannot bunch the
    // remaining travel into a noticeable flower impulse on high-refresh screens.
    if (Math.abs(diff) < 0.00012) {
      pDisplay = p; stir((pDisplay - before) * SCRUB);
      renderTitle(); easePrevT = 0; return;
    }
    // touch tracks near-1:1 (25ms) — native-scroll feel; wheel keeps the glide
    pDisplay += diff * (1 - Math.exp(-dt / (touch.on ? 0.025 : 0.12)));
    stir((pDisplay - before) * SCRUB);
    renderTitle();
    easeRAF = requestAnimationFrame(easeStep);
  }
  function scheduleEase() {
    setCue();
    if (!easeRAF && mode === 'hero') easeRAF = requestAnimationFrame(easeStep);
  }
  function stopEase() { if (easeRAF) { cancelAnimationFrame(easeRAF); easeRAF = 0; } }

  // Use the phone's travel-based coupling for wheel/trackpad motion too.
  // Drive the flowers from the title's actual eased travel, including its
  // shrinking tail. No 70ms gate, rolling direction sum or repeated force floor.
  var scrollDir = 0;
  var scrollStir = { dir: 0, x: 0.5, pending: 0, lastT: -Infinity };
  function stir(delta) {
    if (!delta || reduceMQ.matches || typeof window.gardensStudioGust !== 'function') return;
    var now = performance.now(), dir = Math.sign(delta);
    if (dir !== scrollStir.dir || now - scrollStir.lastT > GESTURE_GAP) {
      scrollStir.dir = dir;
      scrollStir.x = (Math.random() - 0.5) * (dir > 0 ? 1.0 : 0.4);
      scrollStir.pending = 0.08; // one onset/reversal whisper, as on touch
    }
    scrollStir.lastT = now;
    scrollStir.pending += Math.abs(delta) * 0.004;
    if (scrollStir.pending <= 0.001) return;
    var strength = scrollStir.pending;
    scrollStir.pending = 0;
    window.gardensStudioGust(scrollStir.x, -dir,
      dir > 0 ? Math.min(1.1, strength * 1.6) : Math.min(0.9, strength));
  }

  // The per-gesture cap is GONE on the wheel path (2026-09-12, owner
  // direction): even at GESTURE_MAX 1.0 the soft-knee shrank steps
  // asymptotically as the budget ran out, so one continuous scroll converged
  // just SHORT of p=1 and the wind still demanded a second gesture. Raw
  // scroll now accumulates 1:1 — one committed swipe reaches the blow.
  // (beginsGesture/gestureP remain: the regrow arming still uses them.)
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
  function resetGesture() {
    gestureP = 0; env.ema = 0; env.peak = 0; lastInputTs = 0;
    scrollDir = 0; scrollStir.dir = 0; scrollStir.pending = 0;
  }

  // Advance the capture by a raw scroll delta (px, positive = down). Always
  // consumes the event while capturing on the hero.
  function advance(delta) {
    if (transitioning || !bloomed) return;   // still blooming: the page holds
    if (reduceMQ.matches) {           // no scrub/physics — reveal at a touch
      if (delta > 0) startBlow();
      return;
    }
    if (beginsGesture(delta)) gestureP = 0;   // envelope bookkeeping (regrow arming)
    var dir = Math.sign(delta);
    if (dir && scrollDir && dir !== scrollDir) {
      // Catch the visible position on reversal, as a new finger touch does.
      // Otherwise the old easing backlog keeps drifting against the new input.
      stopEase(); p = pDisplay; easePrevT = 0;
    }
    if (dir) scrollDir = dir;
    var step = delta / SCRUB;                 // uncapped: one swipe can reach the wind
    p = clamp(p + step, 0, 1.0001);
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

  // --- mobile movement v49: direct travel, measured release ------------
  // Position never gains or eases under the finger. Interval velocities are
  // fitted against event time over the last 80ms: their slope is acceleration,
  // and evaluating at release estimates current speed instead of a lagging EMA.
  // Release keeps measured speed. Shorter directional travel increases drag
  // during the coast instead of clipping away the initial flick velocity.
  var TSCRUB_K = 0.5;
  var touch = { on: false, id: null, x: 0, y: 0, t: 0, flower: false,
    samples: [], pending: 0, travel: 0, dir: 0, v: 0, a: 0, gustDir: 0, gustX: 0.5, gustPending: 0 };
  var flingRAF = 0;
  function eventTime(e) {
    return Number.isFinite(e.timeStamp) ? e.timeStamp : performance.now();
  }
  function findTouch(list) {
    for (var i = 0; list && i < list.length; i++) {
      if (list[i].identifier === touch.id) return list[i];
    }
    return null;
  }
  function onFlowers(clientX, clientY) {
    if (!banner) return false;
    var r = banner.getBoundingClientRect();
    return clientX >= r.left && clientX <= r.right &&
           clientY >= r.top && clientY <= r.bottom;
  }
  function setScrub(np) {
    p = clamp(np, 0, 1);
    pDisplay = p; renderTitle();
    if (p >= 1) { touchBlow(); return true; }
    return false;
  }
  function touchBlow() {
    // No trigger gust any more (2026-09-11): the blow now opens with a settle
    // beat — the swipe's own motion dies down FIRST, then the wind enters and
    // stirs (gustSeries). The old 0.85 blast here kept every flower ringing
    // straight through that beat, defeating both its calm and its purpose
    // (the arrival lag showed exactly when the wind landed on peak motion).
    startBlow();
  }
  function stopFling() {
    cancelAnimationFrame(flingRAF); flingRAF = 0;
  }
  function startFling(v) {
    stopFling();
    var last = performance.now();
    var tau = 0.22 * (1 - Math.exp(-touch.travel / 24));
    if (!(tau > 0)) return;
    // Exact exponential integration, including the final partial frame. Neither
    // refresh rate nor a delayed frame changes total distance.
    function step(now) {
      flingRAF = 0;
      if (mode !== 'hero' || transitioning || touch.on || reduceMQ.matches) return;
      var remaining = tau * Math.log(Math.abs(v) / 25);
      var dt = Math.min(Math.max(0, (now - last) / 1000), remaining);
      last = Math.max(last, now);
      if (dt <= 0) {
        if (remaining > 0) flingRAF = requestAnimationFrame(step);
        return;
      }
      var decay = Math.exp(-dt / tau);
      var distance = v * tau * (1 - decay);
      v *= decay;
      // Couple flowers to the same actual travel as the displayed title, even
      // after release. No separate gust timer or repeated per-frame floor.
      var next = clamp(p + distance / (SCRUB * TSCRUB_K), 0, 1);
      stirTouch(0, (next - p) * SCRUB * TSCRUB_K);
      if (setScrub(next)) return;
      if (dt >= remaining || (p === 0 && v < 0)) return;
      flingRAF = requestAnimationFrame(step);
    }
    flingRAF = requestAnimationFrame(step);
  }
  function measureTouch(delta, now) {
    var dt = (now - touch.t) / 1000;
    if (delta && Math.sign(delta) !== touch.dir) {
      touch.samples = []; touch.pending = 0; touch.travel = 0; touch.dir = Math.sign(delta);
    }
    touch.travel += Math.abs(delta);
    // Quantized timestamps may group several movements into one clock tick.
    // Render each delta immediately, but measure their combined travel once
    // time advances, rather than silently losing release velocity.
    touch.pending += delta;
    if (dt > 0) {
      touch.samples.push({ t: (now + touch.t) / 2000, v: touch.pending / dt, w: dt });
      touch.pending = 0;
    }
    touch.t = Math.max(touch.t, now);
    var end = touch.t / 1000;
    // Keep the latest interval even with sparse delivery (e.g. a busy frame);
    // otherwise a >160ms interval would erase a real swipe's release velocity.
    touch.samples = touch.samples.filter(function (s, i, list) {
      return end - s.t <= 0.08 || i === list.length - 1;
    });
    var w = 0, x = 0, y = 0, xx = 0, xy = 0, peak = 0;
    touch.samples.forEach(function (s) {
      var age = s.t - end;
      w += s.w; x += age * s.w; y += s.v * s.w;
      xx += age * age * s.w; xy += age * s.v * s.w;
      peak = Math.max(peak, Math.abs(s.v));
    });
    var variance = w ? xx - x * x / w : 0;
    touch.a = variance > 1e-9 ? (xy - x * y / w) / variance : 0;
    touch.v = w ? (y - touch.a * x) / w : 0;
    // Never extrapolate a reversal or amplify a sparse/noisy sample unboundedly.
    touch.v = touch.dir * clamp(touch.v * touch.dir, 0, peak * 1.5);
  }
  function stirTouch(dx, delta) {
    if ((!dx && !delta) || reduceMQ.matches ||
        typeof window.gardensStudioGust !== 'function') return;
    var dir = delta ? Math.sign(delta) : (touch.gustDir || 1);
    if (dx) touch.gustX = Math.sign(dx) * 0.5;
    if (dir !== touch.gustDir) {
      // One whisper when movement starts or reverses; never a floor per frame.
      // Reversals immediately replace the old direction's pending impulse.
      touch.gustPending = 0.08;
      touch.gustDir = dir;
    }
    // An angular impulse per pixel makes the forcing proportional to velocity
    // over time. This works identically during drag and analytic release coast;
    // slow travel spreads gentle kicks out while a flick transfers them quickly.
    touch.gustPending += Math.abs(delta) * 0.004;
    // garden.js ignores strengths <= .001. Carry sub-threshold input forward
    // rather than lose it at high refresh rates. Its springs handle settling.
    if (touch.gustPending <= 0.001) return;
    var strength = touch.gustPending;
    touch.gustPending = 0;
    window.gardensStudioGust(touch.gustX, -dir,
      dir > 0 ? Math.min(1.1, strength * 1.6) : Math.min(0.9, strength));
  }
  function onTouchStart(e) {
    if (touch.on || !e.touches.length) return; // additional fingers never steal ownership
    var t0 = e.touches[0];
    stopFling(); stopEase();
    // Catch the visible position if a wheel glide preceded the touch.
    if (mode === 'hero') p = pDisplay;
    touch.on = true; touch.id = t0.identifier;
    touch.y = t0.clientY; touch.x = t0.clientX; touch.t = eventTime(e);
    touch.samples = []; touch.pending = 0; touch.travel = 0; touch.dir = 0; touch.v = 0; touch.a = 0;
    touch.gustDir = 0; touch.gustPending = 0;
    touch.gustX = Math.random() < 0.5 ? -0.5 : 0.5;
    touch.flower = (mode === 'hero' || mode === 'growing') && onFlowers(t0.clientX, t0.clientY);
    resetGesture();
  }
  function moveTouch(t0, e) {
    var delta = touch.y - t0.clientY, dx = t0.clientX - touch.x;
    touch.y = t0.clientY; touch.x = t0.clientX;
    var now = eventTime(e);
    if (mode === 'hero') {
      if (e.type === 'touchmove' && e.cancelable) e.preventDefault();
      if (touch.flower || !bloomed || transitioning) {
        touch.t = now; touch.samples = []; touch.pending = 0; touch.v = 0; touch.a = 0; touch.travel = 0; touch.dir = 0;
        return;
      }
      if (reduceMQ.matches) { if (delta > 0) startBlow(); return; }
      measureTouch(delta, now);
      stirTouch(dx, delta);
      setScrub(p + delta / (SCRUB * TSCRUB_K));
    } else if (transitioning || mode === 'blowing' || mode === 'growing') {
      touch.t = now; touch.samples = []; touch.pending = 0; touch.v = 0; touch.a = 0; touch.travel = 0; touch.dir = 0;
      if (e.type === 'touchmove' && e.cancelable) e.preventDefault();
    } else if (mode === 'doc') {
      if ((window.scrollY || window.pageYOffset || 0) <= 0 && delta < 0) {
        if (e.type === 'touchmove' && e.cancelable) e.preventDefault();
        upTick(delta);
      } else if (delta > 0) upArm.n = 0;
    }
  }
  function onTouchMove(e) {
    var t0 = touch.on && findTouch(e.touches);
    if (t0) moveTouch(t0, e);
  }
  function onTouchEnd(e) {
    var t0 = touch.on && findTouch(e.changedTouches);
    if (!t0) return; // another finger lifted
    var now = eventTime(e);
    // Some browsers deliver the last travel only in changedTouches at release.
    if (t0.clientY !== touch.y || t0.clientX !== touch.x) moveTouch(t0, e);
    else if (touch.pending && now > touch.t) measureTouch(0, now);
    var age = Math.max(0, now - touch.t);
    touch.on = false;
    if (mode === 'hero' && !touch.flower && bloomed &&
        !transitioning && !reduceMQ.matches && age < 90) {
      var v = touch.v * Math.exp(-age / 45);
      // A short, fast stroke is a real flick. Cap only implausible spikes;
      // travel affects coast duration, not the speed transferred at release.
      v = clamp(v, -2500, 2500);
      if (Math.abs(v) > 80) startFling(v);
    }
  }
  function cancelTouch() {
    touch.on = false; touch.samples = []; touch.pending = 0; touch.v = 0; touch.a = 0;
    stopFling();
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

  // Follow the advancing SVG dash instead of kicking the entire bed at t=0,
  // when the delayed streamlines are still invisible. Small time-scaled
  // impulses keep reached flowers responding throughout their departure.
  function windFront(paths) {
    var front = -Infinity;
    paths.forEach(function (w) {
      var progress = w.anim.effect.getComputedTiming().progress;
      if (progress === null || progress <= 0 || progress >= 1) return;
      var distance = w.dash - w.length + (w.length + w.segment) * progress;
      if (distance <= 0) return; // the animated dash has not entered its path
      front = Math.max(front, w.path.getPointAtLength(Math.min(w.length, distance)).x);
    });
    return front;
  }
  function gustSeries(frame) {
    if (reduceMQ.matches || typeof window.gardensStudioGust !== 'function') return;
    var paths = _windPaths, last = null, arrived = null, reached = -Infinity;
    function step(now) {
      if (mode !== 'blowing' || paths !== _windPaths) return;
      // Never turn a suspended frame into a catch-up blast.
      var dt = last === null ? 0 : Math.min(Math.max(0, now - last) / 1000, 1 / 60);
      last = now;
      reached = Math.max(reached, windFront(paths));
      if (reached >= frame.left && arrived === null) arrived = now;
      if (arrived !== null) {
        var strength = 1.8 * dt * clamp((now - arrived) / 180, 0, 1);
        var worldX = (reached - frame.left - frame.width / 2) * (2 * HOME.halfW / frame.width);
        if (strength > 0.001) window.gardensStudioGust(1, 0, strength, -Infinity, worldX);
      }
      _windGustRAF = requestAnimationFrame(step);
    }
    _windGustRAF = requestAnimationFrame(step);
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
      if (done) return;
      // SETTLE BEAT (2026-09-11): the arrival lag only shows when the wind
      // lands on top of heavy leftover swipe motion — every flower still
      // ringing in the spring set at full energy. Hold for a beat so that
      // ring dies down (the springs' energy-adaptive damping is quick), and
      // the wind then enters on a calm, cheap scene. The pause also reads as
      // the gust gathering itself before it takes the word.
      window.setTimeout(function () {
        if (done) return;
        showWind();
        // Expand to full-screen NOW, during the calm wind-only lead — the
        // expansion is visually invariant (the camera reframes by the same
        // factor, the title stays put), and doing the WebGL framebuffer
        // reallocation here hides its hitch instead of landing it on the very
        // frame the fly-off starts (2026-09-08 mobile perf).
        var windFrame = expandBannerFull();
        gustSeries(windFrame);
        window.setTimeout(function () {
          if (done) return;
          window.Garden.blowAway(finish);
        }, 460);
      }, 450);
    });
    // Watchdog: guarantee the hand-off resolves even if the rAF callback is
    // delayed (e.g. the tab was backgrounded mid-blow).
    // Settle beat .45s + wind lead .46s + blow ~1.9s.
    window.setTimeout(finish, 3100);
  }

  // Expand the title canvas to fill the window and reframe the camera by the SAME
  // factor (title stays the exact same size/place) so the flowers fly clear to
  // the window's right edge. Preserve the scrubbed lift so nothing jumps at blow.
  // (The full-window trick is ported from wind.js.)
  function expandBannerFull() {
    // Capture the box actually on screen. Mobile browser chrome can change
    // innerHeight (and LIFT) during the settle beat without moving this box.
    // Recomputing the old lift here would snap the flowers toward the centre.
    var rect = banner.getBoundingClientRect();
    var width = window.innerWidth, height = window.innerHeight;
    var fullHalfW = HOME.halfW * width / (rect.width || 1);
    var x = rect.left + rect.width / 2 - width / 2;
    var y = rect.top + rect.height / 2 - height / 2;
    titleWrap.classList.add('blowing');
    // Freeze this frame until the flowers leave. CSS 100vh can represent a
    // different viewport from innerHeight on mobile Safari.
    titleWrap.style.width = width + 'px';
    titleWrap.style.height = height + 'px';
    titleWrap.style.transform = 'translate(' + x + 'px, ' + y + 'px)';
    // Render the blow at a reduced pixel ratio — on every device (2026-09-11;
    // was phones-only at first). Every flower is tumbling fast for ~2s, where
    // the resolution drop is imperceptible but the full-screen fragment load
    // nearly halves. garden.js restores the full cap on replant, so a regrown
    // title is always sharp again.
    window.Garden.setFrame({ halfW: fullHalfW, dprCap: 1.35 });
    return rect;
  }
  function restoreBanner() {
    titleWrap.classList.remove('blowing');
    titleWrap.style.transform = '';
    titleWrap.style.width = '';
    titleWrap.style.height = '';
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
    }

    whenGarden(function () {
      if (done) return;
      if (HOME.layout) window.Garden.replant(HOME.layout, { halfW: HOME.halfW });
      window.Garden.bloomIn(finish);
    });
    // Watchdog: bloom runs ~2.9s (a touch quicker under reduced motion).
    window.setTimeout(finish, reduceMQ.matches ? 900 : 3800);
  }

  function showTitle() {
    restoreBanner();
    titleWrap.classList.remove('gone');
    titleWrap.classList.remove('fading');
    titleWrap.style.opacity = '';
  }

  // ------------------------------------------------------------------ wind
  // Draw a field of flowing, curved wind streamlines — soft tapered lines with a
  // travelling "gust" segment sweeping along each, staggered at different heights
  // and speeds, so it reads as moving air rather than static streaks.
  // (Ported verbatim from wind.js — it is fully self-contained.)
  //
  function showWind() {
    var w = document.getElementById('wind'); if (!w) return;
    var svg = document.getElementById('windSvg');
    var W = window.innerWidth, H = window.innerHeight;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.innerHTML = '';
    // The final desktop scene uses Original, including on old variant links.
    // Mobile and the separate study pages retain their existing selection.
    var finalDesktop = body.getAttribute('data-desktop-wind') === 'original' &&
      window.matchMedia('(min-width: 721px)').matches;
    var windRenderer = finalDesktop ? window.GardensOriginalWind :
      (window.GardensWindSelection && window.GardensWindLines);
    if (windRenderer) {
      var selectedWind = windRenderer.build(svg, W, H, reduceMQ.matches);
      _windAnims = selectedWind.animations;
      _windPaths = selectedWind.paths;
      w.classList.add('on');
      return;
    }
    _windAnims = [];
    _windPaths = [];
    var reduce = reduceMQ.matches;
    // Phones get fewer streamlines: each is an infinite stroke-dashoffset
    // animation painted on the main thread every frame, right while the GPU is
    // flat-out on the blow itself — "moving air" still reads fine with six.
    var N = W < 720 ? Math.round(4 + W / 160) : Math.round(9 + W / 340);
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
      _windPaths.push({ anim: anim, path: p, length: L, segment: seg, dash: Math.round(seg) });
    }
    w.classList.add('on');
  }
  function hideWind() {
    cancelAnimationFrame(_windGustRAF);
    _windGustRAF = 0;
    _windPaths = [];
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
    'lounge-2': [2000, 1334], 'piano-hall': [2400, 1601], 'vanity': [2400, 1601], 'vanity-warm': [2400, 1601],
    'vanity-2': [2000, 1334], 'workroom': [2400, 1601]
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
        hrow('Address', '<span class="hval">1938 W Fairbanks Ave, Winter Park, FL 32789</span>') +
        hrow('Email', '<a class="hval" href="mailto:hello@gardens.studio">hello@gardens.studio</a>') +
        hrow('Instagram', '<a class="hval" href="https://instagram.com" target="_blank" rel="noopener">@gardens.studio</a>') +
      '</div>' +
      '<nav class="hbox hbox-nav" id="infoNav" aria-label="Studio sections">' +
        navCell('info-space', '01', 'The Space', true) +
        navCell('info-features', '02', 'Amenities') +
        navCell('info-equipment', '04', 'Equipment') +
        navCell('info-contact', '05', 'Contact') +
      '</nav>';
  }

  // ---- The sections -------------------------------------------------------
  // MOBILE-ONLY blocks (hidden on desktop via scroll.css). The phone read
  // opens on the cyc wall bleeding to all four corners of the viewport, and
  // the piano photo sits immediately above the Equipment heading.
  // The cyc-wall opener (2026-09-11): the WHOLE wall first, in its natural
  // horizontal framing, then a scroll-driven grow — the photo scales up as
  // you scroll until the screen's edges reach the wall's edges (cover), where
  // it stops, releases, and scrolls away. Structure: a tall scroll runway
  // (.mobile-hero-cyc) with a sticky viewport stage inside; wireCycHero()
  // drives the scale off scroll position.
  function mobileCycHero() {
    return '<div class="mobile-hero-cyc" id="cycHero"><div class="cyc-stage">' +
      imgTag('cyclorama', 'the cyc wall', true) + '</div></div>';
  }
  // PHOTO LOCK-IN (2026-09-12, fourth flavour — replaces the lean): every
  // photo enters the viewport sitting LOCK_GAP px BELOW its resting slot (a
  // touch of extra spacing), rides up as you scroll, and locks into its
  // final place once it reaches the lower third of the screen — after which
  // it scrolls as ordinary page content. Scroll-driven and reversible: scroll
  // back down and it eases off its slot again. Photos only; text is never
  // touched. Desktop only; mobile photos scroll in their normal slots.
  var LOCK_GAP = 40;                               // px below the slot on entry
  function wireImageLock() {
    if (reduceMQ.matches) return;
    var photos = document.querySelectorAll(
      '#infoBody .mob-photos img, #infoBody .main-right img, #infoBody .mobile-piano img');
    if (!photos.length) return;
    var mobilePhotos = window.matchMedia('(max-width: 720px), (hover: none) and (pointer: coarse)');
    var ticking = false;
    function update() {
      ticking = false;
      if (mobilePhotos.matches) {
        for (var j = 0; j < photos.length; j++) photos[j].style.transform = '';
        return;
      }
      var vh = window.innerHeight || 1;
      for (var i = 0; i < photos.length; i++) {
        var el = photos[i];
        if (!el.offsetParent) continue;            // hidden on this layout
        var top = el.getBoundingClientRect().top;
        if (top > vh + LOCK_GAP) continue;         // not yet entered
        // 0 at the bottom edge -> 1 by the time the top reaches ~66% down the
        // screen; ease-out so it decelerates INTO the lock, then holds.
        var prog = clamp((vh - top) / (vh * 0.34), 0, 1);
        prog = 1 - (1 - prog) * (1 - prog);
        var ty = (1 - prog) * LOCK_GAP;
        el.style.transform = ty < 0.05 ? '' : 'translateY(' + ty.toFixed(2) + 'px)';
      }
    }
    window.addEventListener('scroll', function () {
      if (!mobilePhotos.matches && !ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    window.addEventListener('resize', function () {
      window.requestAnimationFrame(update);
    }, { passive: true });
    update();
  }
  function wireCycHero() {
    var hero = document.getElementById('cycHero');
    if (!hero) return;
    var stage = hero.querySelector('.cyc-stage');
    var img = hero.querySelector('img');
    if (!stage || !img) return;
    var ticking = false;
    function update() {
      ticking = false;
      if (!hero.offsetParent) return;              // hidden on desktop
      var vh = stage.clientHeight || window.innerHeight || 1;
      var rect = hero.getBoundingClientRect();
      var range = Math.max(1, rect.height - vh);   // the sticky scrub room
      var prog = clamp(-rect.top / range, 0, 1);
      prog = 1 - (1 - prog) * (1 - prog);          // ease-out: fast growth, soft stop
      var ih = img.clientHeight || 1;              // untransformed layout height
      var cover = Math.max(1, vh / ih);            // scale at which edges meet edges
      // Stop at the owner-picked framing (2026-09-11, landmark-measured from
      // an on-device screenshot): the centre ~65% of the wall filling the
      // width — side table sliver at the left edge, the wall's right sweep
      // closing the frame, the band roughly square on a phone. Never past
      // cover on wide viewports.
      var target = Math.min(cover, 1.53);
      img.style.transform = 'scale(' + (1 + (target - 1) * prog).toFixed(4) + ')';
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    window.addEventListener('resize', function () {
      window.requestAnimationFrame(update);
    }, { passive: true });
    if (img.complete) update();
    else img.addEventListener('load', update, { once: true });
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
    // Real copy (2026-09-08).
    var copy = '<div class="sec-copy">' +
      '<p>The 4,000 square-foot minimalist warehouse environment has been conceived as an intentionally open, adaptable space to act as fertile substrate for creativity, community, and collaboration.</p>' +
      '<p>While Gardens Studio offers top of the line features and amenities for photo and video productions, the space’s high degree of versatility is oriented towards serving a wide range of events, exhibitions, productions, and artistic disciplines.</p>' +
      '<p>In addition to regular bookings, we also offer a select number of memberships for those seeking priority recurring use of the space each month.</p>' +
      '</div>';
    var amen = '<div class="amen-block">' +
      '<header class="sec-head sec-head-sub" id="info-features">' +
      '<h2 class="sec-title">Amenities</h2></header>' +
      '<ul class="sec-list">' + FEATURES.map(function (f) {
        return '<li>' + f + '</li>';
      }).join('') + '</ul></div>';
    // Hand-built section (not section()): the left column is a train of
    // sticky SEGMENTS. Each block rides up, sticks below the header, and
    // holds until the next block catches up and pushes it away — The Space,
    // then Amenities, then the floor plan (which holds to the section's end).
    var right = rightImages([
      ['cyclorama', 'the cyc wall', false, 'mob-hide'],   // the phone's full-bleed opener already shows the cove
      ['lounge-2', 'the lounge'],
      ['arcade', 'the arcade run'],
      ['vanity', 'the dressing room'],
      ['workroom', 'the work area', true]
    ]);
    // Phone-only photo clusters interleave the text blocks (the desktop
    // right-column stack hides on phones): living room + kitchen after The
    // Space, dressing room + desks after Amenities, before the floor plan.
    function mobPhotos(list) {
      return '<div class="mob-photos">' + list.map(function (im) {
        return imgTag(im[0], im[1], true);
      }).join('') + '</div>';
    }
    return '<section class="main" id="info-space">' +
      '<div class="main-left"><div class="main-left-inner">' +
        '<div class="lseg"><div class="lblock">' +
          '<header class="sec-head"><h2 class="sec-title">The space</h2></header>' +
          '<div class="space-intro-wrap">' + copy + '</div></div></div>' +
        mobPhotos([['lounge-2', 'the lounge'], ['arcade', 'the kitchen and arcade run']]) +
        '<div class="lseg seg-last"><div class="lblock">' + amen + '</div></div>' +
        mobPhotos([['vanity', 'the dressing room'], ['workroom', 'the work area']]) +
      '</div></div>' +
      right +
    '</section>';
  }

  // 04 EQUIPMENT — sticky-left heading only; the category lists fill the right
  // column as a two-column grid (satspace's exact convention for this section).
  // EQUIPMENT — the kit list rides the sticky LEFT column under the heading;
  // the piano photo is the right column (phones keep their own piano block
  // above the heading instead — .equip-photo hides there).
  function equipmentSection() {
    var grid = '<div class="kit-grid">' + KIT.map(function (c) {
      return '<div class="kit-cat"><h3>' + c[0] + '</h3><ul>' +
        c[1].map(function (i) { return '<li>' + i + '</li>'; }).join('') + '</ul></div>';
    }).join('') + '</div>';
    // Satspace layout (2026-09-14): the sticky LEFT column holds only the
    // heading; the kit lists live in the RIGHT column (then the piano). On
    // phones the right column stacks under the heading, so the read order
    // (heading -> lists -> piano) is unchanged; only the desktop-hidden
    // photo carries .equip-photo now.
    var right = '<div class="main-right">' + grid +
      imgTag('piano-hall', 'the working end and the grand piano', false, 'equip-photo') + '</div>';
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
      '<div class="info-foot">' +
        '<span class="foot-mark">Gardens Studio</span>' +
        '<a class="to-top" href="#top" id="toTop">Back to the top <span class="arr" aria-hidden="true">&uarr;</span></a>' +
      '</div>' +
    '</section>';
  }

  // Desktop: as a left card is pushed up past its pin line, its content
  // DISSOLVES across a soft band at the line instead of shearing mid-glyph
  // against the header's bottom edge. A scroll-driven gradient mask on the
  // card itself: everything above the pin line is already transparent by the
  // time it slides under the header.
  function wireCardFade() {
    if (window.matchMedia('(max-width: 720px)').matches) return;
    var blocks = document.querySelectorAll('#info-space .lblock');
    if (!blocks.length) return;
    // The dissolve belongs to the old sticky-card train; under the satspace
    // model (2026-09-14) the blocks are static inside one pinned column and
    // simply scroll away at the section's end — no mask.
    if (getComputedStyle(blocks[0]).position !== 'sticky') return;
    var pin = parseFloat(getComputedStyle(blocks[0]).top) || 162;
    var ticking = false;
    function apply() {
      ticking = false;
      for (var i = 0; i < blocks.length; i++) {
        var d = pin - blocks[i].getBoundingClientRect().top;
        if (d > 0.5) {
          var m = 'linear-gradient(to bottom, transparent ' + (d - 8).toFixed(0) +
            'px, #000 ' + (d + 56).toFixed(0) + 'px)';
          blocks[i].style.webkitMaskImage = m;
          blocks[i].style.maskImage = m;
        } else if (blocks[i].style.maskImage) {
          blocks[i].style.webkitMaskImage = '';
          blocks[i].style.maskImage = '';
        }
      }
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(apply); }
    }, { passive: true });
    window.addEventListener('resize', apply, { passive: true });
    apply();
  }

  function buildInfo() {
    var header = document.getElementById('infoHeader');
    var host = document.getElementById('infoBody');
    if (header) header.innerHTML = headerHtml();
    if (host) {
      host.innerHTML =
        mobileCycHero() + spaceSection() +
        equipmentSection() + mobilePiano() + contactSection();
    }

    wireCardFade();
    wireCycHero();
    wireImageLock();

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
  if (window.GardensWindSelection) {
    window.GardensWindPreview = {
      state: function () { return { mode: mode, p: p, bloomed: bloomed, transitioning: transitioning }; },
      play: function () {
        if (mode !== 'hero' || !bloomed || transitioning) return false;
        advance(SCRUB); return true;
      }
    };
  }
})();
