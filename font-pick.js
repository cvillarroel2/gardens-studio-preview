/* Gardens Studio — TYPE PICKER.
 *
 * Swaps the studio page's typography between the shipped pair and three
 * candidate sets (see typefaces.css). Unlike the palette/ground pickers —
 * which dress the TITLE and fade once the studio stages in — the type sets
 * are about the studio document itself, so this picker STAYS visible in doc
 * mode. The switch is live (an attribute swap; the vendored faces load on
 * first use) and remembered across pages on this origin.
 *
 * Sits under the palette list in the top-left gutter, same chrome. */
(function () {
  'use strict';
  var F = window.GARDENS_TYPEFACES || [];
  var KEY = window.GARDENS_TKEY;
  if (!F.length) return;

  function current() {
    return document.documentElement.getAttribute('data-typeface') || F[0].id;
  }

  var wrap = document.createElement('nav');
  wrap.className = 'look-pick type-pick';
  wrap.setAttribute('role', 'radiogroup');
  wrap.setAttribute('aria-label', 'Typography');

  var title = document.createElement('span');
  title.className = 'look-title';
  title.textContent = 'Type';
  wrap.appendChild(title);

  var buttons = [];
  F.forEach(function (f, i) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'look-item';
    b.textContent = f.label;
    b.setAttribute('role', 'radio');
    b.addEventListener('click', function () { go(f.id); });
    b.addEventListener('keydown', function (ev) {
      var step = ev.key === 'ArrowDown' || ev.key === 'ArrowRight' ? 1
               : ev.key === 'ArrowUp' || ev.key === 'ArrowLeft' ? -1 : 0;
      if (!step) return;
      ev.preventDefault();
      go(F[(i + step + F.length) % F.length].id);
    });
    buttons.push(b);
    wrap.appendChild(b);
  });

  function paint() {
    var cur = current();
    F.forEach(function (f, i) {
      var on = f.id === cur;
      buttons[i].setAttribute('aria-checked', on ? 'true' : 'false');
      buttons[i].tabIndex = on ? 0 : -1;
    });
  }

  function go(id) {
    document.documentElement.setAttribute('data-typeface', id);
    try { localStorage.setItem(KEY, id); } catch (e) {}
    paint();
  }

  paint();
  document.body.appendChild(wrap);
})();
