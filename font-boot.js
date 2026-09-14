/* Type-set boot — runs in <head>, before the stylesheets paint, so the page
 * never flashes the wrong typography for a frame. Kept as a separate file for
 * the same CSP reason as ground-boot.js.
 * The typeface is settled: Bricolage Grotesque titles / Fragment Mono text
 * (the picker is gone — typefaces.css keeps the set's fitting rules). */
document.documentElement.setAttribute('data-typeface', 'bricolage');
