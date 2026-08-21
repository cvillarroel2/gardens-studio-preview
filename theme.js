/* Gardens Studio — ground theme picker.
 *
 * Swaps the GROUND the title stands on, not the flowers. Three quiet swatches
 * in the top-right gutter: this page's own designed ground, plain white, and a
 * very light sage. The flower species colours are the audited botanical palette
 * and are never touched by this control — what changes is the paper, the whole
 * neutral ramp derived from it (each ground carries its own hairline, muted and
 * faint tones so the document keeps the same contrast on all three), and the
 * two things in the WebGL layer that are tinted BY the ground: the contact
 * shadows under each flower, and the drifting cloud dapple where a build has
 * one. Those are handed to garden.js through a `gardens-ground` event.
 *
 * The choice is stored in localStorage and applied by a tiny script in <head>
 * before first paint, so there is never a flash of the wrong ground.
 *
 * The swatches sit in the strip ABOVE the studio header's boxes, so they never
 * collide with the wordmark, the contact rows or the numbered nav, and they are
 * far from the title canvas so they cannot swallow a brush gesture.
 */
(function () {
  'use strict';

  var KEY = 'gardens-ground';
  var LABELS = {
    paper: 'Warm paper (the current site)',
    white: 'White',
    green: 'Light sage',
    cream: 'Warm cream'
  };
  var allowed = window.GARDENS_THEMES || ['paper'];

  function current() {
    var t = document.documentElement.getAttribute('data-ground');
    return allowed.indexOf(t) >= 0 ? t : allowed[0];
  }

  // Resolve the ground actually in force, so garden.js can tint the shadows and
  // the dapple to it rather than to a hard-coded guess.
  function announce(name, isDefault) {
    var css = getComputedStyle(document.documentElement)
      .getPropertyValue('--paper').trim();
    window.dispatchEvent(new CustomEvent('gardens-ground', {
      detail: { name: name, ground: css, isDefault: isDefault }
    }));
  }

  function apply(name, persist) {
    if (allowed.indexOf(name) < 0) name = allowed[0];
    document.documentElement.setAttribute('data-ground', name);
    if (persist) { try { localStorage.setItem(KEY, name); } catch (e) {} }
    var dots = document.querySelectorAll('.ground-dot');
    for (var i = 0; i < dots.length; i++) {
      var on = dots[i].getAttribute('data-ground-name') === name;
      dots[i].setAttribute('aria-checked', on ? 'true' : 'false');
    }
    // theme-color follows, so mobile browser chrome matches the page
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', getComputedStyle(document.documentElement)
        .getPropertyValue('--paper').trim());
    }
    announce(name, name === allowed[0]);
  }

  function build() {
    if (allowed.length < 2) return;              // nothing to choose between
    var wrap = document.createElement('div');
    wrap.className = 'ground-pick';
    var title = document.createElement('span');
    title.className = 'ground-title';
    title.setAttribute('aria-hidden', 'true');   // the group already has a label
    title.textContent = 'Background';
    wrap.appendChild(title);
    var row = document.createElement('div');
    row.className = 'ground-row';
    row.setAttribute('role', 'radiogroup');
    row.setAttribute('aria-label', 'Page ground');
    wrap.appendChild(row);
    for (var i = 0; i < allowed.length; i++) {
      (function (name) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'ground-dot ground-dot-' + name;
        b.setAttribute('data-ground-name', name);
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', 'false');
        b.setAttribute('aria-label', LABELS[name] || name);
        b.title = LABELS[name] || name;
        b.addEventListener('click', function () { apply(name, true); });
        row.appendChild(b);
      })(allowed[i]);
    }
    document.body.appendChild(wrap);
  }

  function init() {
    build();
    apply(current(), false);
    // garden.js is an ES module that awaits its assets, so it may start
    // listening after this first announcement. Tell it again once it is up.
    if (window.Garden && window.Garden.isReady) announce(current(), current() === allowed[0]);
    else window.addEventListener('garden-ready', function () {
      announce(current(), current() === allowed[0]);
    }, { once: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
