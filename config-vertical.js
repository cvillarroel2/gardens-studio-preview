/* VERTICAL WORDMARK PAGE — letters stacked upright, words reading top-to-
 * bottom (G-A-R-D-E-N-S left column, S-T-U-D-I-O right). Loads AFTER
 * variant-boot.js: the chosen palette variant stays in force; only its layout
 * is swapped for the stacked-letters one (all species names exist in every
 * variant's plant set). halfW 5.5 frames the 9.90x34.52 block at ~90% of the
 * tall-portrait banner (variant-vertical.css). */
window.GARDENS_VARIANT = Object.assign({}, window.GARDENS_VARIANT, {
  layout: 'assets/flowers_vertical.json'
});
window.GARDENS_LOGO = { dataUrl: 'assets/flowers_vertical.json', halfW: 5.5 };
