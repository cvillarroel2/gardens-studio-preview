# Headless verification scripts (2026-09-11 mobile-perf session)

Playwright-driven checks written during the mobile blow-scene perf work.
Each script starts its own static server on a distinct port and drives the
page in headless Chromium.

Run: `node <script>.mjs` from this directory's parent repo root (paths are
absolute/`$HOME`-based, so anywhere works).

Environment quirks these scripts already handle:
- Playwright is imported by absolute path from the npx cache
  (`~/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs`) because
  it isn't installed locally; browsers use `executablePath: '/usr/bin/chromium'`
  (the Playwright-downloaded builds are missing).
- Synthetic scroll: CDP scroll gestures and Playwright `mouse.wheel` do NOT
  reach the page's capture handlers — dispatch `WheelEvent`s from
  `page.evaluate` instead (see blowtest4).
- `import('three')` from `evaluate` can't resolve the import map — import
  `/vendor/three.module.js` directly.

Scripts:
- `blowtest4.mjs` — full mobile flow: two wheel gestures → blow → reveal →
  regrow. Probes: streamline count, rAF frame deltas around wind arrival,
  shadow-canvas opacity + canvas backing size mid-blow (dprCap check), title
  transform mid-blow (lift preserved, not recentered), restoration after
  regrow, console errors.
- `vis.mjs` — per-flower visibility: re-renders the live scene with an
  instance-ID color material and counts visible pixels per flower. Output in
  `vis.json` (`frac` = visible fraction vs same-species full footprint).
- `cull.mjs` — replants culled layouts (thresholds on vis.json frac) and
  screenshots for pixel-diffing against the original (a full-list replant is
  the noise-floor control, since every replant re-jitters).
- `litecheck.mjs` — asserts `?flowers=lite|xlite` load 897/772 flowers.
- `demos.mjs` — runs garden.js's built-in scripted-gesture corridor-coverage
  verification (`?demo=swipe&type=...&pointer=touch`) for 7 gesture types;
  expect coverage=100 on all fast gestures. THE check to run after touching
  the strike/spring physics.
