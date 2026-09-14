/* Runs in <head>, before ground-boot and before the stylesheet paints: stamps
 * the settled look on <html>. The palette/ground pickers are gone
 * (2026-09-11, owner decision) — the site ships ONE look: the
 * 'Warm (less pink)' palette ('newpalette') on the white ground. */
(function () {
  var V = window.GARDENS_VARIANTS, v = V[0];
  for (var i = 0; i < V.length; i++) if (V[i].id === 'newpalette') v = V[i];
  window.GARDENS_VARIANT = v;
  document.documentElement.setAttribute('data-variant', v.id);
  window.GARDENS_THEMES = ['white'];
  // Overwrite any ground a visitor picked back when the picker existed.
  try { localStorage.setItem('gardens-ground', 'white'); } catch (e) {}

  // A/B toggle (2026-09-11, perf experiment): ?flowers=lite (897) or
  // ?flowers=xlite (772) swaps in a culled copy of the stacked layout —
  // flowers under 25% / 40% visible (measured by an instance-ID render of
  // the live scene, occluded under bigger blooms) removed. Pixel-diff of the
  // culled words sits at the replant-jitter noise floor. Only applies to the
  // stacked layout; no param = the full 1,038 (unchanged default).
  try {
    var fl = new URLSearchParams(location.search).get('flowers');
    if ((fl === 'lite' || fl === 'xlite') &&
        v.layout === 'assets/flowers_stacked.json') {
      window.GARDENS_VARIANT = Object.assign({}, v, {
        layout: 'assets/flowers_stacked_' + fl + '.json'
      });
    }
  } catch (e) {}
})();
