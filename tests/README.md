# Mobile movement verification

Run from the repository root:

```sh
node --check scroll.js
node --check garden.js
node --test tests/*.test.cjs
python3 -m http.server 8913 --bind 127.0.0.1
# In a second terminal:
tests/browser-check.sh
# Optional brush diagnostics (production brush constants are unchanged):
tests/brush-demos.sh touch
tests/brush-demos.sh mouse
```

The Node harness loads the shipped scroll.js closure into a mocked DOM/clock;
accessors exist only in the in-memory test copy. Its 22 groups cover distance,
acceleration/braking, 30–240 Hz input, 4–240 Hz animation, sparse and quantized
timestamps, travel-dependent momentum decay, reversal, holds, cancellation, final release
coordinates, touch identifiers, bloom/failsafe, flower lifetime (including
regrowth), a 49-position phone grid, catching a glide, reduced motion and wheel
isolation.

The Ego browser harness constructs real Touch/TouchEvent objects and invokes
installed page listeners at 390×700 in both layouts. These are synthetic browser
checks, not physical-finger or iPhone frame-rate measurements. It checks geometry,
direct drag, flower lock, cancellation, fling, blow/reveal, native document scroll
restoration and regrowth. Close its task space after the run.

## Historical run: 2026-09-08, scroll v48 / garden v42

- Both JavaScript syntax checks and git diff --check passed.
- 17/17 Node groups passed; both layouts passed 11 browser assertions (22 total).
- Both browser loads used scroll v48 / garden v42. A 50px input moved the title
  20px, preserving the established scrub-to-lift mapping.
- Banner bounds at 390×700: index x=5.8516..384.1484, y=194.9609..505.0391;
  vertical x=121.1875..268.8125, y=91.0117..608.9883. Both have a usable starting
  strip below the flowers and can complete the 245px scrub across the banner.
- Ego frame median 1008.3ms, p95 1008.4ms (four recorded frames per layout):
  renderer throttling prevents a meaningful 60fps conclusion.
- Native iPhone Mirroring connected to iPhone 16 Pro Max. Safari loaded the
  sanctioned Funnel with ?v=48 and visibly bloomed. Funnel still serves scroll
  v47 / garden v41. A flower-area scroll and short/full scrolls below the title
  showed no observable title displacement. Mirroring scroll injection cannot be
  treated as verified physical touch input; no successful fling/blow was observed.
- Mac Safari has no Develop menu available; no remote Web Inspector timeline was
  attached. No security settings were changed or authentication prompts approved.
- Funnel marker verification FAILED: v48 is absent. Mac has no Funnel config or
  existing server on 8913; the endpoint runs on the workstation. Existing SSH
  access returned Permission denied (publickey), without prompting. No retry or
  credential changes were attempted. The edited files remain on this Mac.

## Historical remaining device work (superseded below)

Restore authorized workstation access and sync the intended files from this
working copy to the existing preview, preserving unrelated remote changes. Verify
Funnel serves v48/v42 and the `mobile movement v48` marker. Then enable Safari's
Develop menu and iOS Web Inspector yourself, connect/trust the phone if required,
and test physical short/long, accelerating/braking and reversing swipes, flower
starts, interruptions and regrowth. Record drag/fling/blow frame timings before
claiming the real-device smoothness requirement is met.

No commits, pushes, DNS changes, production publishing or Funnel route changes.


## Short-flick correction: 2026-09-11, scroll v49 / garden v43

The Mac implementer reports the full 9.6667-second source clip (290 frames at 30fps) was decoded and reviewed
in sequence, rather than relying on the supplied contact sheet. It shows the
initial flower staging and subsequent title movement/settling; it does not expose
touch event timestamps. The short, fast, immediately released input comes from
Chris's report. No bloom timing was removed.

Root cause: v48 clipped release speed to `25 + travel * 2 / .22`, scored gusts
using a length cap and 70ms throttle, and did not call the flower gust hook at all
during the fling. A 12px/12ms flick consequently launched at only 134.09px/s and
coasted 24px with no further flower impulses.

v49 preserves measured release speed (2500px/s spike ceiling). Coast decay is
`.22 * (1 - exp(-directionalTravel / 24))` seconds: short flicks start promptly
and settle sooner, with no minimum drag distance. That 12px/12ms trace launches
at 1000px/s and coasts 84.399px; the first 60Hz frame advances 15.160px. Direct
finger mapping is unchanged. The 24px scale is a tuning choice pending physical
phone acceptance, not a measured device constant.

Flower forcing now uses the same travel as the page: .004 impulse per pixel,
one .08 onset/reversal whisper, and the existing up-direction compensation.
Fling impulses follow actual clamped page travel. Sub-.001 impulses accumulate
to survive the garden API's cutoff; there is no per-frame floor or 70ms wait.
The existing flower springs settle naturally once page forcing stops. The
regression's .002 tolerance accounts for the final sub-threshold remainder.

Mac implementer validation (before workstation integration):
- Five new regressions failed on v48; all 22 Node groups pass on v49.
- Syntax checks for scroll.js and garden.js and git diff --check pass.
- The browser harness now checks short immediate release and post-release flower
  impulses (12 assertions per layout), but could not run: the managed sandbox
  rejected the loopback server bind and Ego bootstrap connection. Older browser
  results above apply only to v48.
- iPhone prerequisite check reported Bluetooth off and Wi-Fi off/unavailable.
  Native Safari access was denied by Computer Use. No current device, inspector,
  performance or visual-acceptance result is claimed. No permissions changed.

Parent handles reviewed synchronization to /home/chris/gardens-preview-suite.
Check both HTML files reference v49/v43 and verify `mobile movement v49` in the
served scroll.js before testing at http://100.72.96.89:8913/. Exercise short fast
release, slow short drag, reversal, catch/cancel, flower starts, and full blow;
verify bloom staging remains deliberate and record drag/coast/blow frame timing.

## Workstation integration and Chromium verification — 2026-09-11

Integrated into the existing preview, not a new publication. All six starting
file hashes exactly matched the Mac baseline; changes were applied using V4A
patches after backing up local files. The production files and harness matched
the Mac result hashes. This README additionally records workstation results.
Only scroll.js, index.html, vertical.html and the three test/documentation files
changed. garden.js and the desktop/staging code outside the mobile section are
byte-identical to the workstation baseline.

- Node: 22/22 passed. Running the new tests against the backed-up v48 scroll.js
  produced exactly the five intended regression failures (17 passed).
- Syntax: node --check for both JS files and sh -n for the browser harness pass.
- Both layouts passed the shipped 12 browser assertions via Playwright Chromium,
  plus trusted CDP flower-lock, direct-drag, cancel, blow/reveal and native-scroll
  checks. Desktop wheel, reveal, native scrolling and home/regrow passed.
- A controlled 12px/12ms TouchEvent trace, with real listeners and real rAF,
  advanced the title 4.8px under the finger and 33.76px after release in both
  layouts. Each received 13 post-release gusts; wrapping the existing hook and
  forwarding every call confirmed actual flower angular-velocity changes.
- Slow 12px/600ms travel held on release with no further gusts. An 8ms reversal
  immediately reversed actual flower impulses and subsequent title momentum.
  Integrated coast impulse matched actual page travel within .002 tolerance.
- With ambient breeze disabled solely by the existing ?breeze=off test option,
  both layouts' 1038 flowers settled to liveCount=0. Default-breeze behavior was
  exercised by the shipped harness; ambient movement is expected to continue.
- Trusted CDP 24px/24ms immediate-release traces advanced title lift a further
  54.23px (index) / 54.47px (vertical), with 21 / 22 actual post-release gusts.
  Protocol timestamps specify gesture timing; this is not physical touch.
- Browser errors: none. Settled screenshots show intact flowers and both title
  layouts. Software-rendered frame median was 16.7ms, p95 50ms for each layout;
  this does not establish phone frame-rate or physical smoothness acceptance.
- Live HTTP reads on loopback and 100.72.96.89:8913 matched local SHA-256 hashes
  for both HTML files, scroll.js?v=49 and garden.js?v=43.

Evidence and reproducible runner:
`/home/chris/gardens-verification/short-flick-v49/verify.py`
(uses the preserved motion-20260911-162028 runner for prior behavior coverage).
Run with `uv run --with playwright python /home/chris/gardens-verification/short-flick-v49/verify.py`.
Evidence directory includes Node output, browser JSON, screenshots and served
hashes. Original local files: `short-flick-v49/workstation-backup/` there.

Remaining: physical iPhone/Safari short-flick feel and performance acceptance.
No commit, push, DNS, route, permissions or new publication changes were made.
