/* Ground theme boot — runs in <head>, before the stylesheet paints, so the page
 * never shows the wrong ground for a frame. Kept as a separate file rather than
 * an inline <script> because the page's own Content-Security-Policy is
 * `script-src 'self'` and that is not worth weakening for four lines. */
// variant-boot.js has already narrowed this to the current look's grounds;
// only fall back if this page is loaded without it.
window.GARDENS_THEMES = window.GARDENS_THEMES || ["white", "green", "paper"];
(function () {
  var t;
  try { t = localStorage.getItem('gardens-ground'); } catch (e) { t = null; }
  if (window.GARDENS_THEMES.indexOf(t) < 0) t = window.GARDENS_THEMES[0];
  document.documentElement.setAttribute('data-ground', t);
})();
