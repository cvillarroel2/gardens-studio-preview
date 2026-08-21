/* Gardens Studio — LOOK PICKER.
 *
 * Passes the site through its four flower palettes. Each look owns a different
 * plant set and placement file as well as its colours, so the swap is a reload
 * rather than a live re-grade: the choice is stored and the page comes back
 * wearing it. Grounds are remembered PER LOOK (see variant-boot.js), because
 * the background choices are specific to each palette.
 *
 * Sits in the top-left gutter, mirroring the ground swatches on the right, and
 * far from the title canvas so it can never swallow a brush gesture.
 */
(function () {
  'use strict';
  var V = window.GARDENS_VARIANTS, cur = window.GARDENS_VARIANT;

  var wrap = document.createElement('nav');
  wrap.className = 'look-pick';
  wrap.setAttribute('role', 'radiogroup');
  wrap.setAttribute('aria-label', 'Flower palette');

  var title = document.createElement('span');
  title.className = 'look-title';
  title.textContent = 'Palette';
  wrap.appendChild(title);

  V.forEach(function (v, i) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'look-item';
    b.textContent = v.label;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', v.id === cur.id ? 'true' : 'false');
    b.tabIndex = v.id === cur.id ? 0 : -1;
    b.addEventListener('click', function () { go(v.id); });
    b.addEventListener('keydown', function (ev) {
      var step = ev.key === 'ArrowDown' || ev.key === 'ArrowRight' ? 1
               : ev.key === 'ArrowUp' || ev.key === 'ArrowLeft' ? -1 : 0;
      if (!step) return;
      ev.preventDefault();
      go(V[(i + step + V.length) % V.length].id);
    });
    wrap.appendChild(b);
  });

  function go(id) {
    if (id === cur.id) return;
    try { localStorage.setItem(window.GARDENS_VKEY, id); } catch (e) {}
    location.reload();
  }

  document.body.appendChild(wrap);
})();
