/* The four looks this build can pass through. Each names its own plant set,
 * placements and the grounds that were designed for it — background choices are
 * per-palette, not one global list. */
window.GARDENS_VARIANTS = [
  { id: 'white',      label: 'Warm',              grounds: ['white', 'green', 'paper'],
    flowers: 'assets/flowers_botanical.glb', petals: 'assets/petals_botanical.glb',
    layout: 'assets/flowers_stacked.json' },
  { id: 'newpalette', label: 'Warm (less pink)',  grounds: ['white', 'green', 'paper'],
    flowers: 'assets/flowers_botanical.glb', petals: 'assets/petals_botanical.glb',
    layout: 'assets/flowers_stacked.json' },
  { id: 'exp2exact',  label: 'Bright',            grounds: ['white', 'green', 'paper'],
    flowers: 'assets/flowers_botanical.glb', petals: 'assets/petals_botanical.glb',
    layout: 'assets/flowers_stacked.json' },
  { id: 'aca24',      label: 'Midsommar',         grounds: ['white', 'acgrass', 'green', 'paper', 'ink'],
    flowers: 'assets/flowers_ac.glb', petals: 'assets/petals_ac.glb',
    layout: 'assets/flowers_ac_layout.json' },
];
window.GARDENS_VKEY = 'gardens-suite-variant';
window.GARDENS_GKEY_FOR = function (id) { return 'gardens-ground-' + id; };
