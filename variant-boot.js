/* Runs in <head>, before ground-boot and before the stylesheet paints: picks
 * the look, stamps it on <html>, and narrows the ground allow-list to the ones
 * that look belongs to. */
(function () {
  var V = window.GARDENS_VARIANTS, id;
  try { id = localStorage.getItem(window.GARDENS_VKEY); } catch (e) { id = null; }
  var v = null;
  for (var i = 0; i < V.length; i++) if (V[i].id === id) v = V[i];
  if (!v) v = V[0];
  window.GARDENS_VARIANT = v;
  document.documentElement.setAttribute('data-variant', v.id);
  window.GARDENS_THEMES = v.grounds.slice();
  // Every page opens on the look's FIRST swatch — the ground it was designed
  // around. A choice made with the picker lasts as long as you stay on the
  // page; the next load starts from the designed pairing again.
  try { localStorage.setItem('gardens-ground', v.grounds[0]); } catch (e) {}
})();
