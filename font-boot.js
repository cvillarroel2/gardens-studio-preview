/* Type-set boot — runs in <head>, before the stylesheets paint, so the page
 * never flashes the wrong typography for a frame. Kept as a separate file for
 * the same CSP reason as ground-boot.js. */
window.GARDENS_TYPEFACES = [
  { id: 'fraunces',  label: 'Fraunces — original' },
  { id: 'bricolage', label: 'Bricolage' },
  { id: 'funnel',    label: 'Funnel' }
];
window.GARDENS_TKEY = 'gardens-suite-typeface';
(function () {
  var t;
  try { t = localStorage.getItem(window.GARDENS_TKEY); } catch (e) { t = null; }
  var ok = window.GARDENS_TYPEFACES.some(function (f) { return f.id === t; });
  document.documentElement.setAttribute('data-typeface', ok ? t : 'fraunces');
})();
