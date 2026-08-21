// Gardens Studio — interactive 3D flower title.
// Real 3D plants (flowers.glb) instanced 1038x at flowers_full.json positions,
// viewed flat top-down. Each plant is rooted at its base and only bends about
// that pivot as a damped harmonic oscillator driven by the pointer ("hand").

import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------
// Optional per-page config (set on window before this module runs). Lets a page
// point the title at a different layout (e.g. a stacked wordmark) and reframe
// the camera to it, without forking this file. Defaults preserve the wide title.
const CFG = (typeof window !== 'undefined' && window.GARDENS_LOGO) || {};
let HALF_W = CFG.halfW || 21.4;     // world half-width framed by the camera (reframeable per title)

// ---------------------------------------------------------------------------
// VARIANT GRADE
// ---------------------------------------------------------------------------
// The ONLY block that differs between the four breeze preview builds. Engine
// code below is byte-identical across all of them, so a fix to the physics, the
// gust or the wisps lands in every variant the same way.
//
//   palette      the shipped warm-paper look, untouched
//   white        the render's white studio: neutral light, neutral shadows
//   golden       golden hour, but with the sun taken overhead so the shadows
//                fall down-screen instead of raking
//   livinglight  white studio with the light itself alive: a breathing sun and
//                dappled cloud shadow drifting over the field
//
//   desat        how far the glb's re-gammaed species colours are pulled toward
//                their own luminance. The species HUES are never touched — that
//                palette is the audited botanical one.
//   shadow       the 2D contact-shadow blob: colour, the two gradient stops, the
//                offset from the flower's base in world units (dz positive =
//                down-screen), and the blob radius factor.
//   sun          null, or the breathing-sunlight parameters.
//   dapple       null, or the drifting cloud-shadow parameters.
// Petal gradient recipes per breed: colorA = base/heart tone, colorB = the
// breed colour, radial base->tip like the recipe system. Pansies put the AC
// face gradient in colorA with a short grad_range so the heart stays dark.
const G_PET = [0.0, 0.85, 0.0, 1.0];       // standard base->tip
const G_FACE = [0.15, 0.50, 0.0, 1.0];     // pansy: dark face wide at centre
const G_RING = [0.20, 0.48, 0.0, 1.0];     // windflower: light ring, then body
const V_STD = [0.0, 1.0, 0.94, 1.06];
function br(mat, a, b, grad, emis) {
  return { [mat]: { colorA: a, colorB: b, grad_range: grad || G_PET,
                    val_range: V_STD, emission_strength: emis == null ? 0.12 : emis } };
}
const V = window.GARDENS_VARIANT;
const GRADES = {
  white: {
  name: 'white',
  gamma: 1.4,
  tone: null,
  recipe: null,
  recolor: null,
  // The render's white studio. The warm build lit the bed with a warm key over
  // a warm hemisphere, which against #ffffff rotated the reds toward orange
  // (measured H 13 against the render's H 8) and crushed the foliage. Same
  // positions, same intensities -- a sweep of exposures against frames2 showed
  // the warm build was already at the right brightness and dimming it only made
  // the bed muddy -- but every source is now neutral, and the hemisphere's
  // ground term is the near-white bounce a white floor gives.
  // The shipped build pulls every species 15% toward its own luminance to sit
  // the bed into the warm paper. Against the render that muting is the whole
  // complaint, so it is off here: the species colours reach the screen as the
  // glb authored them, only re-linearised.
  desat: 0.0,
  hemi: { sky: 0xffffff, ground: 0xf2f2f2, i: 1.32 },
  key:  { color: 0xffffff, i: 1.7, pos: [5, 12, -5] },
  fill: { color: 0xffffff, i: 0.4, pos: [-5, 8, 4] },
  // Fitted to the render's shadow luminance curve on white: frames2 measures
  // mean rgb(233, 231, 226) with the shadowed area running 212 (5th pct) to
  // 248 (95th); this build measures mean rgb(233, 232, 228) at 210 / 233 / 249.
  shadow: { rgb: '133, 126, 98', a0: 0.11, a1: 0.047, dx: -0.07, dz: 0.16, r: 0.72 },
  sun: null,
  dapple: null,
  },
  newpalette: {
  name: 'newpalette',
  // The WHITE variant's palette and pipeline exactly -- same re-linearisation,
  // same neutral studio light, same white ground -- with less pink in the bed
  // and one new family filling the gap between the poppies and the sunflowers.
  //
  // WHICH FLOWERS ARE THE PINK ONES: in this pipeline the glb's rose_p (#cc4536)
  // and tul_r (#d14733) are RED-oranges, not pinks -- they land in the same hue
  // band as the poppies. The pink a viewer actually sees in this build is the
  // mauve of anem_p (#c780ad) and fmn_p (#cc99c7). So the conversion takes the
  // anemones, which is what makes the word read as having less pink in it; the
  // tulips come along because they are the other candidate that can spare the
  // instances without thinning a colour the bed needs.
  gamma: 1.4,
  desat: 0.0,
  recipe: null,
  hemi: { sky: 0xffffff, ground: 0xf2f2f2, i: 1.32 },
  key:  { color: 0xffffff, i: 1.7, pos: [5, 12, -5] },
  fill: { color: 0xffffff, i: 0.4, pos: [-5, 8, 4] },
  tone: null,
  shadow: { rgb: '133, 126, 98', a0: 0.11, a1: 0.047, dx: -0.07, dz: 0.16, r: 0.72 },
  sun: null,
  dapple: null,
  recolor: {
    species: ['anem', 'tul'],
    from: ['anem_p', 'tul_r'],
    favor: ['anem'],                // the mauve goes first: that is the pink
    share: 0.80,
    minDist: 0.62,                  // world units. The bed is dense; a strict
                                    // head-to-head spacing caps the conversion
                                    // near 20% and the change stops being
                                    // visible at all.
    to: {
      // Apricot. It has to be tellable from the poppies AT A GLANCE, and in
      // this build the poppies already render a muted coral-orange (#c96e4d,
      // hue 16, V 0.79) -- so this family is pushed much lighter and a good
      // 20 degrees yellower, into creamy apricot rather than another orange.
      // Eased ~8% darker after user feedback ("a little too bright") — same
      // apricot hue band, tip pulled off near-white so it stops popping.
      colorA: '#e0954a', colorB: '#f2cf8f',
      grad_range: [0.0, 0.27, 0.0, 1.0],
      val_range: [0.0, 1.0, 0.92, 1.08],
    },
    // The E and N still carried visible pink after the global pass ("a little
    // less pink in the E and N") — convert nearly all candidates there, with a
    // tighter spacing floor so the extra conversions actually fit.
    boost: { x0: -1.75, x1: 6.7, share: 0.95, minDist: 0.5 },
  },
  },
  exp2exact: {
  name: 'exp2exact',
  // The gust-wind render's own colour system, taken from the Blender master
  // rather than approximated by grading the glb. The site's flowers.glb carries
  // a DIFFERENT audited palette -- its forget-me-not is a mauve #cc99c7 where
  // the render's is a blue #90b3f6, its anemone a pink #c780ad where the
  // render's is a violet #ad81ea -- so no exponent or desaturation applied to
  // the glb's flat baseColours could ever arrive at the render. This variant
  // bypasses that path entirely: each petal takes its base-to-tip gradient, its
  // per-flower brightness jitter and its self-emission straight from the
  // recipe. gamma and desat below are inert while `recipe` is set; they still
  // cover the few materials the recipe does not name (sepals).
  gamma: 1.4,
  desat: 0.0,
  recipe: 'assets/exp2_color_recipe.json',
  recolor: null,
  hemi: { sky: 0xffffff, ground: 0xf2f2f2, i: 1.32 },
  key:  { color: 0xffffff, i: 1.7, pos: [5, 12, -5] },
  fill: { color: 0xffffff, i: 0.4, pos: [-5, 8, 4] },
  // With emission on top of the diffuse response the brightest petals run past
  // 1.0. Hard clipping there would take the hue with it, so the highlights are
  // rolled off the way the render's view transform does.
  // Eased back about 7% from the calibrated 1.28: with the emission sitting on
  // top of the diffuse response the bed was reading a touch hot against frames2.
  tone: { mode: 'aces', exposure: 1.19 },
  shadow: { rgb: '133, 126, 98', a0: 0.11, a1: 0.047, dx: -0.07, dz: 0.16, r: 0.72 },
  sun: null,
  dapple: null,
  },
  aca24: {
  name: 'aca24',
  species: ['daisy', 'poppy', 'rose', 'sun', 'tul', 'fmn', 'anem', 'mum'],
  globalScale: 0.78,   // AC heads are chunky — keeps the letterforms crisp
  // This glb is authored linear (built for this variant) — no re-gamma, no
  // muting: the AC palette is flat, bright and saturated by design.
  gamma: 1.0,
  tone: null,
  recipe: null,
  recolor: null,
  desat: 0.0,
  // AC's light is even and sunny — a strong warm-white dome with a soft key,
  // so shapes read from silhouette and colour, barely from shading.
  hemi: { sky: 0xffffff, ground: 0xeef3e4, i: 1.55 },
  key:  { color: 0xfff6e2, i: 1.15, pos: [4, 12, -4] },
  fill: { color: 0xf2f6ff, i: 0.45, pos: [-5, 8, 4] },
  // Contact shadow, opened up so it reads on the island-grass ground the way
  // the white builds' does on paper: same warm-neutral green, more presence.
  shadow: { rgb: '92, 106, 74', a0: 0.17, a1: 0.075, dx: -0.05, dz: 0.16, r: 0.84 },
  // Petals lightened and eased off saturation across every breed. The authored
  // hexes stay the game's own; this is the one knob that softens them.
  petalTint: { sat: 0.90, light: 0.08 },
  // The bed is sparser than the botanical builds (817 plants, smaller heads),
  // so a sweep meets fewer flowers — shedding is opened up to compensate.
  shed: { interval: 0.028, prob: 1.0, speedMin: 20 },
  sun: null,
  dapple: null,
  // BREEDS — palette taken from the floral-A24 reference: a dense wildflower
  // mix that is warm-leaning and high-key. Cream and chalk white run through
  // every species, corals and butter yellows carry the warmth, and lavender /
  // periwinkle supply the only cool notes. No black or deep-jewel breeds.
  breeds: {
    rose: [
      br('rose_p', '#d2523c', '#f4785e'), br('rose_p', '#e6dfc8', '#fbf7ea'),
      br('rose_p', '#dcb44a', '#f6d96a'), br('rose_p', '#d4739c', '#f0a2c0'),
      br('rose_p', '#d8853e', '#f3a862'), br('rose_p', '#9a83c4', '#bfa8de'),
      br('rose_p', '#7f97cc', '#a8c0e8'), br('rose_p', '#c9538c', '#e87bb0'),
      br('rose_p', '#d9a52c', '#f7cb4e'),
    ],
    tul: [
      br('tul_r', '#cf4636', '#ea5240'), br('tul_r', '#e4ddc4', '#faf6e8'),
      br('tul_r', '#dcb648', '#f8dd72'), br('tul_r', '#dd8fae', '#f6b8cc'),
      br('tul_r', '#d5843c', '#f2a05c'), br('tul_r', '#8f74c4', '#b193dc'),
      br('tul_r', '#89a2d8', '#aec6ee'),
    ],
    anem: [   // pansies keep their face, but a warm one rather than near-black
      br('anem_p', '#8a3a2e', '#f0846a', G_FACE), br('anem_p', '#8a7350', '#faf5e6', G_FACE),
      br('anem_p', '#8a6a22', '#f4d264', G_FACE), br('anem_p', '#8a5228', '#f2a05c', G_FACE),
      br('anem_p', '#5f4d8a', '#b7a2dc', G_FACE), br('anem_p', '#4f5f96', '#a4bce6', G_FACE),
    ],
    sun: [
      br('sun_p', '#e2dbc2', '#fbf8ec'), br('sun_p', '#dcb648', '#f8dd72'),
      br('sun_p', '#dc93b0', '#f6bed0'), br('sun_p', '#d5843c', '#f3a55f'),
      br('sun_p', '#d2523c', '#f2775c'), br('sun_p', '#9a83c4', '#bda6dc'),
    ],
    daisy: [  // cosmos
      Object.assign(br('daisy_p', '#e4ddc6', '#fcf9ee'), br('c_daisy', '#f6cc52', '#dc9024')),
      Object.assign(br('daisy_p', '#dcb84c', '#f9de76'), br('c_daisy', '#f2b81a', '#c87a10')),
      Object.assign(br('daisy_p', '#d2523c', '#f2775c'), br('c_daisy', '#f6cc52', '#dc7a18')),
      Object.assign(br('daisy_p', '#cf5c96', '#ef8cba'), br('c_daisy', '#f6cc52', '#dc9024')),
      Object.assign(br('daisy_p', '#d5843c', '#f3a55f'), br('c_daisy', '#f6cc52', '#c87a10')),
      Object.assign(br('daisy_p', '#89a2d8', '#aec6ee'), br('c_daisy', '#f6cc52', '#dc9024')),
    ],
    poppy: [  // windflowers — colorA is the light ring
      br('poppy_p', '#fbf2e4', '#f2775c', G_RING), br('poppy_p', '#f2eee2', '#fbf8ee', G_RING),
      br('poppy_p', '#fbe8bc', '#f2b73c', G_RING), br('poppy_p', '#fbe2ee', '#ef8cba', G_RING),
      br('poppy_p', '#dceafb', '#8fa8e0', G_RING), br('poppy_p', '#ece2fa', '#b193dc', G_RING),
    ],
    fmn: [    // hyacinths
      br('fmn_p', '#e2dcc4', '#faf6e8'), br('fmn_p', '#dcb84c', '#f8dd72'),
      br('fmn_p', '#dd8fae', '#f6b8cc'), br('fmn_p', '#7f97cc', '#a8c0e8'),
      br('fmn_p', '#9a83c4', '#bda6dc'), br('fmn_p', '#d2523c', '#f2775c'),
      br('fmn_p', '#d5843c', '#f3a55f'),
    ],
    mum: [
      br('mum_p', '#e2dbc2', '#fbf8ec'), br('mum_p', '#dcb84c', '#f8dd72'),
      br('mum_p', '#d2523c', '#f2775c'), br('mum_p', '#d4739c', '#f0a2c0'),
      br('mum_p', '#9a83c4', '#bda6dc'), br('mum_p', '#d9a52c', '#f7cb4e'),
    ],
  },
  },
};
const GRADE = GRADES[V.id] || GRADES.white;
const GLOBAL_SCALE = GRADE.globalScale || 1.08;
const DPR_CAP = 1.75;

const BLOOM_STAGGER = 1.65;     // s — spread of start times (by bl rank)
const BLOOM_DUR = 0.75;         // s — each flower's grow duration
const BLOOM_JITTER = 0.18;      // s — random start jitter

const HAND_RADIUS = 0.55;       // world radius of the "hand" itself
// TOUCH boost — a fingertip is fatter, faster-moving relative to the small
// framed field, and partly hidden under the hand, so on touch pointers the
// brush responds harder and reaches further. Mouse input is untouched: with
// hand.isTouch false both terms collapse to the shipped desktop behaviour.
const TOUCH_GAIN = 1.7;         // × on push / drag / strike amplitudes for touch
const TOUCH_REACH = 0.55;       // extra world reach around the fingertip
const SUB_DT = 1 / 60;          // s — physics substep
const MAX_FRAME_DT = 0.2;       // s — total simulated time per frame, capped

// Hand → flower coupling. Two channels, mirroring a real flowerbed:
// (1) quasi-static PUSH — a proximity-proportional lean target away from the
//     hand (plus a gentle drag along its travel). Flowers part, lean, and
//     FOLLOW the hand, then ease back.
// (2) velocity IMPULSE — the moving hand STRIKES the plant, adding angular
//     velocity along its travel direction, growing continuously with hand
//     speed. Dominant when the hand is fast: flowers get knocked and recoil
//     with an energetic multi-sway snap-back after the hand has moved on.
//
// BOTH channels are scaled by ONE shared, continuous speed-response
// ("brush") curve — a single analog dial from whisper to whip:
//     R(v) = u^RESP_EXP / (1 + u^RESP_EXP),   u = v / RESP_VSAT
// This is a gentle power law (response ∝ v^1.45 near the origin) that eases
// C∞-smoothly into saturation at 1 around RESP_VSAT. It is strictly
// monotonic with NO flat toe, NO gate, NO threshold and NO plateau: the
// response is already present (subtly) at the slowest creep and rises in
// clear, graded proportion to speed the whole way up. The strike channel
// rides exactly this curve (times the acceleration boost); the push channel
// rides it PLUS one small low-speed PARTING term (below) so a slow hand is
// never invisible — no speed exists where either channel is "off".
// Calibrated to REAL MOUSE speeds on this layout (~37 px per world unit):
//   creep    250 px/s ≈  6.7 u/s → R ≈ 0.04  (subtle — slight movements)
//   easy     500 px/s ≈ 13.4 u/s → R ≈ 0.10
//   moderate 1000 px/s ≈ 26.8 u/s → R ≈ 0.24  (clearly visible)
//   brisk    1500 px/s ≈ 40.1 u/s → R ≈ 0.36
//   fast     2000 px/s ≈ 53.5 u/s → R ≈ 0.46
//   whip     3500+ px/s ≈ 94+ u/s → R ≥ 0.66  (→ 0.77 at the speed clamp)
const RESP_VSAT = 60;           // u/s — soft-saturation speed of the curve
const RESP_EXP = 1.45;          // power-law exponent (low-end slope ~ v^1.45)
function brushResponse(v) {
  const r = Math.pow(Math.max(0, v) / RESP_VSAT, RESP_EXP);
  return r / (1 + r);
}
const PUSH_MAX = 0.85;          // full-speed lean amplitude (× R(v) × falloff × maxBend)
const DRAG_MAX = 0.30;          // full-speed drag along travel (× R(v))
// Low-speed PARTING floor — push channel only. A real hand moving through a
// flowerbed parts the flowers it passes even when it moves slowly: that part
// of the response is DISPLACEMENT-driven (the hand occupies space along its
// travel), not momentum-driven. R(v)'s v^1.45 low end models the momentum
// part correctly but leaves a slow drag perceptually at zero, so the push
// target adds one small saturating low-speed term
//     P(v) = PUSH_LOW · w / (1 + w),   w = v / PART_VSAT
// P is C∞, strictly monotonic, EXACTLY zero at v = 0 (a resting hand holds
// nothing bent), at half strength by ~5 u/s (~190 px/s) and saturating at
// PUSH_LOW — deliberately small: a slow drag from a dead stop reads as a
// slight, gentle parting of the flowers under the hand (a few degrees), while
// at speed the term is dwarfed by PUSH_MAX · R(v). It feeds ONLY the
// quasi-static push target (never the strike), so a creep parts stems without
// flicking them, and the adaptive damping eases them back without ringing.
const PUSH_LOW = 0.10;          // saturated amplitude of the parting term
const PART_VSAT = 5.0;          // u/s — half-response speed of the parting term
function partResponse(v) {
  const w = Math.max(0, v) / PART_VSAT;
  return w / (1 + w);
}
// The impulse channel uses SWEPT-PATH contact: the hand's travel between two
// physics ticks is the POLYLINE of real pointer samples (coalesced sub-events
// included), and every flower within reach of any sub-segment is struck — a
// fast swipe hits the whole corridor it swept, not just the flowers that
// happened to lie under a sampled point. The kick is deposited PER UNIT OF
// SWEPT PATH (not per unit time), with long segments subdivided so the total
// a flower receives converges to the same line integral no matter how densely
// the input was sampled: short dwell cannot dilute a fast hit, dense
// coalescing cannot inflate it.
// Kick density: KICK_GAIN · R(v) · accBoost — the SAME single curve as the
// push channel, no gate and no extra power term. R(v)'s own v^1.45 low end
// keeps a creeping drag down to a faint brush (the adaptive damping absorbs
// it without ringing), the mid band deposits a clearly graded, proportional
// knock, and the saturating top end (× the acceleration boost and the
// whip-crack peak carry below) stays dramatic.
const KICK_GAIN = 1.95;         // impulse per unit swept path at R = 1 (rad/s per u)
const KICK_MAX_SPEED = 140;     // u/s — clamp hand speed feeding the kick
const GESTURE_GAP = 0.25;       // s — sample-time gap that starts a NEW gesture
                                // (teleport/idle-wake detection is TIME-based,
                                // never speed-based: a genuine hard swipe has
                                // continuous small-dt input and always strikes)
const SEG_MAX_LEN = 0.6;        // u — strike sub-segment subdivision length
const PEAK_TAU = 0.18;          // s — decay of the recent-peak-speed memory
const PEAK_CARRY = 0.8;         // kick speed ≥ this × recent peak (whip-crack)
const ACC_REF = 120;            // u/s² — along-track accel for full extra boost
const ACC_BOOST_MAX = 1.8;      // cap of the extra acceleration multiplier
const ACC_TAU = 0.03;           // s — accel-memory window (EVENT-time based, so
                                // a 1000 Hz and a 125 Hz mouse resolve the same
                                // ~30 ms onset window; short enough that gentle
                                // vs moderate vs hard starts from a dead stop
                                // read as distinct boosts from the first frames)
const VEL_CLAMP = 26;           // rad/s — max angular velocity (no blow-up)

// --- petal shedding (Animal-Crossing-style flourish; ported from the studio
// build). A hard/fast brush occasionally knocks a FEW small, species-matched
// petals loose — never every flower, globally rate-limited. Each pops off,
// tumbles, drifts a hand's-width onto the ground around its letter, and fades
// in ~0.7 s. Small, sparse, local; idles to nothing. Disable with ?petals=off.
const PETALS_ON = new URLSearchParams(location.search).get('petals') !== 'off';
const PETAL_CAP = 24;           // pool size PER species (total live ~a dozen)
const PETAL_SPEED_MIN = (GRADE.shed && GRADE.shed.speedMin) || 28;     // u/s strike speed below which NOTHING sheds
const PETAL_INTERVAL = (GRADE.shed && GRADE.shed.interval) || 0.05;    // s — GLOBAL min gap between shed events
const PETAL_EMIT_PROB = (GRADE.shed && GRADE.shed.prob) || 0.9;    // chance a due shed event actually fires
const PETAL_LIFE = 0.72;        // s — brief flutter then gone (± jitter)
const PETAL_GRAVITY = 1.6;      // u/s² (vertical motion is ~invisible top-down)
const PETAL_DRAG = 2.1;         // 1/s — brings the outward drift to rest in ~a unit
const PETAL_UP = 0.7;           // u/s slight lift (mostly depth)
const PETAL_OUT = 4.6;          // u/s outward GROUND drift — the visible motion
const PETAL_SIZE = 0.24;        // × flower sc — clearly reads as a petal

// --- ambient breeze (ported from the Blender "gust wind" liveliness study) ---
// The title is never completely still: a gust wave sweeps it left→right on a
// ~4 s period whose wavelength is the whole word, so the lean travels through
// the letters like wind through a real bed rather than pulsing everywhere at
// once. Three smaller layers ride on top (cross-axis sway, a fast shimmer, a
// slow head wobble) plus a stem twist standing in for per-leaf flutter.
//
// This layer is PURELY KINEMATIC and strictly ADDITIVE. It is evaluated in
// updateFlowerMatrix() only, and never touches r.sx/r.sz/r.vx/r.vz — the
// damped-harmonic-oscillator state the hand drives. So brushing, scroll gusts,
// the swept-path strike, the parting floor, the shed-petal trigger and the
// liveSet rest test all behave EXACTLY as they did before: there is no path by
// which the breeze can fight, delay or amplify a user-driven response. Where a
// flower IS responding to the hand, its breeze share additionally fades out
// (see breezeSuppress) so the struck plant reads as struck, not as windy.
const BREEZE_ON = (() => {
  if (new URLSearchParams(location.search).get('breeze') === 'off') return false;
  try {
    // Same reduceMQ pattern scroll.js uses: no ambient motion under Reduce Motion.
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch { return true; }
})();
const GUST_PERIOD = 4.0;        // s — one crest crosses the word in this time
const GUST_AMP = 0.15;          // rad — peak lean of the travelling gust
const GUST_SHARP = 1.5;         // rectified half-sine raised to this power (gusty, not sinusoidal)
const GUST_AMP_VAR = 0.15;      // ±15% per-flower amplitude variation
const GUST_PHASE_JIT = 0.3;     // ±rad per-flower phase jitter
const GUST_CROSS = 0.18;        // cross-axis sway, × GUST_AMP, signed (both ways)
const SHIM_AMP = 0.03;          // rad — fast shimmer
const SHIM_HZ = 0.75;           // Hz (±12% per flower so the bed never beats in unison)
const WOB_AMP = 0.028;          // rad — slow head wobble, independent phase per axis
const WOB_HZ = 0.5;             // Hz (±15% per flower)
const LEAF_AMP_MIN = 0.05;      // rad — foliage flutter, expressed as a twist about the
const LEAF_AMP_MAX = 0.09;      //       flower's own stem (see updateFlowerMatrix)
const LEAF_HZ_MIN = 0.5;
const LEAF_HZ_MAX = 1.0;
const BREEZE_RISE = 1.5;        // s — the wind picks up after the word finishes blooming
const BREEZE_KNEE = 0.35;       // rad of hand-driven bend at which breeze is halved

// ---------------------------------------------------------------------------
// Deterministic PRNG (stable layout between reloads)
// ---------------------------------------------------------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260709);
// The breeze draws its per-flower constants from its OWN stream so it cannot
// shift `rng`'s sequence — the layout, resting tilts, bloom order and instance
// tints stay bit-identical to the build this was copied from.
const brng = mulberry32(0x6172B133);
// ...and the drifting wisps get a third, because they re-seed continuously at
// runtime and must not walk either of the other two streams.
const drng = mulberry32(0x57159A11);
// ...and a fourth for the colourway assignment, so which plants wear the
// substitute family is stable across reloads and independent of everything else.
const crng = mulberry32(0x0C0A17E5);

// Ambient-breeze state (declared here because buildFlowers, further down but
// executed at module load, measures the gust wavelength from the new layout).
let breezeT = 0;         // s — the breeze's own wall clock
let breezeK = 0;         // 0..1 — global gain (rises after the bloom; 0 while
                         //        the word is blooming / retracting / blowing)
let breezeX0 = 0;        // world-x of the leftmost flower
let breezeW = 1;         // world width of the word = one gust wavelength
let breezeSpanW = Math.PI * 2;   // 2π / breezeW, precomputed
let blownAway = false;   // the word is off-frame — nothing to animate
// Drifting-wisp state that the layout measurement writes into (declared here
// for the same reason: buildFlowers runs before the drift block below).
let driftBedZ = 3.2;     // half-height of the band the wisps keep to
let driftY = 12;         // world Y — clear of every depth slab

// ---------------------------------------------------------------------------
// Renderer / scene / camera
// ---------------------------------------------------------------------------
const canvas = document.getElementById('scene');
const shadowCanvas = document.getElementById('shadows');
const shadowCtx = shadowCanvas.getContext('2d');
const banner = document.getElementById('banner');

// Detect software rasterisers (headless swiftshader / llvmpipe) and drop MSAA
// there — it is prohibitively slow without a real GPU.
const isSoftwareGL = (() => {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
    return /swiftshader|llvmpipe|softpipe|software/i.test(String(name));
  } catch { return false; }
})();

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: !isSoftwareGL,
  alpha: true, // 2D shadow canvas sits underneath
});
renderer.setClearColor(0xffffff, 0);
// Highlight handling. NoToneMapping (the shipped default) hard-clips each
// channel independently, so a saturated petal lit past 1.0 loses its most
// intense channel first and its HUE slides: a poppy measured 10 degrees toward
// orange and lost 0.07 of saturation against the Blender frame purely from
// clipping. A variant that wants the render's colours instead of the site's
// filmic-autumn grade rolls the highlights off the way Blender's view transform
// does, which keeps hue and chroma intact at the top end.
renderer.toneMapping = ({
  none: THREE.NoToneMapping,
  aces: THREE.ACESFilmicToneMapping,
  cineon: THREE.CineonToneMapping,
  reinhard: THREE.ReinhardToneMapping,
})[GRADE.tone ? GRADE.tone.mode : 'none'] || THREE.NoToneMapping;
renderer.toneMappingExposure = GRADE.tone ? GRADE.tone.exposure : 1;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();

const camera = new THREE.OrthographicCamera(-HALF_W, HALF_W, 5, -5, 0.1, 100);
camera.position.set(0, 40, 0);
camera.up.set(0, 0, -1);           // screen-up = world -Z  (data +y)
camera.lookAt(0, 0, 0);

function resize() {
  const w = banner.clientWidth, h = banner.clientHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h, false);
  shadowCanvas.width = Math.round(w * dpr);
  shadowCanvas.height = Math.round(h * dpr);
  const halfH = HALF_W * (h / w);
  camera.top = halfH; camera.bottom = -halfH;
  camera.left = -HALF_W; camera.right = HALF_W;
  camera.updateProjectionMatrix();
  driftBedZ = Math.max(1.4, camera.top * 0.66);   // wisps keep near the flowers
  layoutDapple();                                 // patch size follows the frame
  shadowsDrawnFinal = false;
  requestRender();
}

// ---------------------------------------------------------------------------
// Lighting — key from a high angle + fill + soft ambient dome. Colours,
// intensities and the key's direction all come from GRADE (top of file).
// ---------------------------------------------------------------------------
const hemi = new THREE.HemisphereLight(GRADE.hemi.sky, GRADE.hemi.ground, GRADE.hemi.i);
scene.add(hemi);
const key = new THREE.DirectionalLight(GRADE.key.color, GRADE.key.i);
key.position.set(GRADE.key.pos[0], GRADE.key.pos[1], GRADE.key.pos[2]);
scene.add(key);
const fill = new THREE.DirectionalLight(GRADE.fill.color, GRADE.fill.i);
fill.position.set(GRADE.fill.pos[0], GRADE.fill.pos[1], GRADE.fill.pos[2]);
scene.add(fill);
// Breathing sunlight (livinglight only). The key's energy, warmth and direction
// each ride their own phase of the SAME 4 s period the gust runs on, offset so
// no two pulses peak together — the light reads as weather, not as a throb.
const SUN = GRADE.sun;
const sunWarm = SUN ? new THREE.Color(SUN.warm[0], SUN.warm[1], SUN.warm[2]) : null;
const sunCool = SUN ? new THREE.Color(SUN.cool[0], SUN.cool[1], SUN.cool[2]) : null;
function updateSun(t) {
  if (!SUN) return;
  const w = (Math.PI * 2) * (t / GUST_PERIOD);
  key.intensity = GRADE.key.i * (1 + SUN.swing * Math.sin(w + SUN.phEnergy));
  // 0..1 between the neutral-warm and the golden extreme of the swing
  key.color.copy(sunCool).lerp(sunWarm, 0.5 + 0.5 * Math.sin(w + SUN.phWarm));
  // The sun also wanders a couple of degrees: a yaw about the vertical and a
  // change of elevation, on their own phases. Small angles, but enough that the
  // modelling on every petal shifts instead of only its brightness.
  const yaw = SUN.driftYaw * Math.sin(w + SUN.phDrift);
  const tilt = SUN.driftTilt * Math.sin(w + SUN.phDrift + 1.3);
  const p = GRADE.key.pos;
  const cx = Math.cos(yaw), sx = Math.sin(yaw);
  const x = p[0] * cx - p[2] * sx;
  const z = p[0] * sx + p[2] * cx;
  key.position.set(x, p[1] + tilt * Math.hypot(x, z), z);
}

// ---------------------------------------------------------------------------
// Load assets
// ---------------------------------------------------------------------------
const loader = new GLTFLoader();
const [gltf, petalGltf, layout, RECIPE] = await Promise.all([
  loader.loadAsync(V.flowers),
  loader.loadAsync(V.petals),   // per-species shed-petal shapes
  fetch(V.layout).then((r) => r.json()),
  // Optional authored colour system, extracted from the Blender master. When a
  // variant supplies one it REPLACES the glb-baseColour path entirely: the
  // render's look is not flat per-material colour, it is a base-to-tip gradient
  // per petal plus a little self-emission, which is why no amount of grading
  // the flat colours could reach it.
  GRADE.recipe ? fetch(GRADE.recipe).then((r) => r.json()) : Promise.resolve(null),
]);

// Merge each species' primitives into one geometry with baked vertex colors.
// The glb nodes carry a decorative tilt rotation (for a lineup render) — we
// ignore node transforms and use the raw geometry, which is rooted at the
// origin and grows +Y.
// Map Range, as Blender spells it: value in [fromMin, fromMax] onto
// [toMin, toMax], clamped at both ends.
function mapRange(v, r) {
  const span = (r[1] - r[0]) || 1;
  const t = Math.max(0, Math.min(1, (v - r[0]) / span));
  return r[2] + t * (r[3] - r[2]);
}
const NO_GRAD = [0, 1, 0, 1];
// Lighten / desaturate a breed colour. Done in sRGB so the move is perceptual:
// in the renderer's linear working space the same numbers read far stronger.
const TINT = GRADE.petalTint || null;
const _hsl = {};
function tintPetal(c) {
  c.getHSL(_hsl, THREE.SRGBColorSpace);
  c.setHSL(_hsl.h, _hsl.s * TINT.sat,
           Math.min(1, _hsl.l + (1 - _hsl.l) * TINT.light), THREE.SRGBColorSpace);
}

function mergeSpecies(group, override) {
  let vCount = 0, iCount = 0;
  const parts = [];
  group.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    parts.push({ g, color: o.material.color, name: mats[0] ? mats[0].name : '' });
    vCount += g.attributes.position.count;
    iCount += g.index.count;
  });
  const pos = new Float32Array(vCount * 3);
  const nor = new Float32Array(vCount * 3);
  const col = new Float32Array(vCount * 3);
  const emi = new Float32Array(vCount);
  const idx = new Uint32Array(iCount);
  let vo = 0, io = 0;
  const srgb = new THREE.Color();
  const grey = new THREE.Color();
  const cA = new THREE.Color(), cB = new THREE.Color(), cM = new THREE.Color();
  for (const { g, color: rawColor, name: matName } of parts) {
    // The glb carries a sepal material the recipe does not name. Sepals are
    // leaves by another name, and left on the glb's near-black green they end
    // up the most saturated green in frame, which is not what the render shows.
    const recKey = (RECIPE && !RECIPE[matName] && matName === 'sepal_m') ? 'leaf_m' : matName;
    // A recolour variant substitutes one material's whole entry (gradient,
    // emission and all) so the same geometry can be built in a second family.
    const rec = (override && override[matName]) || (RECIPE && RECIPE[recKey]);
    if (rec && rec.colorA && rec.colorB) {
      // Authored gradient. THREE.Color(hex) converts from sRGB into the
      // renderer's working space, so these are the display-referred hexes the
      // Blender material used, landing on screen as authored.
      cA.set(rec.colorA); cB.set(rec.colorB);
      if (TINT && override && override[matName]) { tintPetal(cA); tintPetal(cB); }
      const grad = rec.grad_range || NO_GRAD;
      const emis = rec.emission_strength || 0;
      const p = g.attributes.position.array;
      const c = g.attributes.position.count;
      // The gradient runs base-to-tip along the petal. Petal-local coordinates
      // are not preserved through the merge, so it is taken radially from the
      // flower's own axis, which for a top-down camera is the same read.
      let maxR = 0;
      for (let i = 0; i < c; i++) {
        const r2 = p[i*3] * p[i*3] + p[i*3+2] * p[i*3+2];
        if (r2 > maxR) maxR = r2;
      }
      maxR = Math.sqrt(maxR) || 1;
      pos.set(p, vo * 3);
      nor.set(g.attributes.normal.array, vo * 3);
      for (let i = 0; i < c; i++) {
        const r = Math.hypot(p[i*3], p[i*3+2]) / maxR;
        cM.copy(cA).lerp(cB, mapRange(r, grad));
        col[(vo + i) * 3] = cM.r;
        col[(vo + i) * 3 + 1] = cM.g;
        col[(vo + i) * 3 + 2] = cM.b;
        emi[vo + i] = emis;
      }
      const ia = g.index.array;
      for (let i = 0; i < ia.length; i++) idx[io + i] = ia[i] + vo;
      vo += c; io += ia.length;
      continue;
    }
    if (rec) {
      // in the recipe but with no colour of its own (stems, stamens): keep the
      // glb's colour, take only the emission
      const emis = rec.emission_strength || 0;
      for (let i = 0; i < g.attributes.position.count; i++) emi[vo + i] = emis;
    }
    // The glb's baseColorFactor values were authored as sRGB, so re-linearise
    // them or every petal renders washed-out (salmon instead of poppy red).
    // GRADE.gamma is the exponent: the shipped builds use 1.4, a deliberate
    // UNDER-linearisation that lightens and mutes the palette to sit in the
    // warm-paper ground. A variant that wants the glb's colours as authored
    // uses the true sRGB exponent instead.
    // Then desaturate toward luminance by GRADE.desat (top of file).
    const color = srgb.setRGB(
      Math.pow(rawColor.r, GRADE.gamma),
      Math.pow(rawColor.g, GRADE.gamma),
      Math.pow(rawColor.b, GRADE.gamma)
    );
    const luma = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
    grey.setRGB(luma, luma, luma);
    color.lerp(grey, GRADE.desat);
    const p = g.attributes.position.array, n = g.attributes.normal.array;
    pos.set(p, vo * 3);
    nor.set(n, vo * 3);
    const c = g.attributes.position.count;
    for (let i = 0; i < c; i++) {
      col[(vo + i) * 3] = color.r;
      col[(vo + i) * 3 + 1] = color.g;
      col[(vo + i) * 3 + 2] = color.b;
    }
    const ia = g.index.array;
    for (let i = 0; i < ia.length; i++) idx[io + i] = ia[i] + vo;
    vo += c; io += ia.length;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aEmis', new THREE.BufferAttribute(emi, 1));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  return geo;
}

const SPECIES = GRADE.species || ['daisy', 'poppy', 'rose', 'sun', 'tul', 'fmn', 'anem'];
const speciesGeo = {};
// RECOLOUR: a second copy of the affected species, built in the substitute
// family. Which individual plants get it is decided per-flower below; the
// geometry itself just exists in two colourways.
const RECOLOR = GRADE.recolor || null;
const speciesGeoAlt = {};
// BREEDS: one geometry per breed colourway, same merge path as recolor.
const speciesGeoBreed = {};
for (const name of SPECIES) {
  const node = gltf.scene.getObjectByName(name);
  if (!node) throw new Error(`species node missing in glb: ${name}`);
  speciesGeo[name] = mergeSpecies(node);
  if (RECOLOR && RECOLOR.species.includes(name)) {
    const ov = {};
    for (const m of RECOLOR.from) ov[m] = RECOLOR.to;
    speciesGeoAlt[name] = mergeSpecies(node, ov);
  }
  if (GRADE.breeds && GRADE.breeds[name]) {
    speciesGeoBreed[name] = GRADE.breeds[name].map((ov) =>
      mergeSpecies(ov.__node ? gltf.scene.getObjectByName(ov.__node) : node, ov));
  }
}

// Sanity check: geometry must be rooted at y=0 and grow +Y.
{
  const bb = new THREE.Box3().setFromBufferAttribute(
    speciesGeo.daisy.attributes.position
  );
  console.log('[gardens] daisy geometry bbox', bb.min.toArray(), bb.max.toArray());
  if (bb.min.y < -0.05 || bb.max.y < 0.2) {
    console.warn('[gardens] unexpected orientation — check glb axes');
  }
}

// Per-species head height (local max Y, for the shed origin) + petal colour,
// pulled from the flower's own petal material and run through the SAME palette
// transform mergeSpecies uses (re-linearise ^GRADE.gamma, desaturate GRADE.desat), so shed
// petals match the rendered flowers exactly.
const speciesPetal = {};
const speciesHeadR = {};   // head petal-spread radius (XZ), for overlap layering
for (const name of SPECIES) {
  const p = speciesGeo[name].attributes.position.array;
  let maxY = 0;
  for (let i = 1; i < p.length; i += 3) if (p[i] > maxY) maxY = p[i];
  // radius of the HEAD (petals splay near the top): max XZ radius among the
  // upper vertices, padded a touch so no overlap is missed
  const yThresh = maxY * 0.45;
  let r2 = 0;
  for (let i = 0; i < p.length; i += 3) {
    if (p[i + 1] < yThresh) continue;
    const rr = p[i] * p[i] + p[i + 2] * p[i + 2];
    if (rr > r2) r2 = rr;
  }
  speciesHeadR[name] = Math.sqrt(r2) * 1.12;
  const matName = name === 'tul' ? 'tul_r' : name + '_p';
  let raw = null;
  gltf.scene.getObjectByName(name).traverse((o) => {
    if (raw || !o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) if (m && m.name === matName) { raw = m.color; break; }
  });
  const c = new THREE.Color();
  const brd = GRADE.breeds && GRADE.breeds[name];
  const prec = (brd && brd[0][matName]) || (RECIPE && RECIPE[matName]);
  if (prec && prec.colorB) {
    c.set(prec.colorB);
    if (TINT && brd) tintPetal(c);                        // the petal's tip colour
  } else if (raw) {
    c.setRGB(Math.pow(raw.r, GRADE.gamma), Math.pow(raw.g, GRADE.gamma), Math.pow(raw.b, GRADE.gamma));
    const luma = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    c.lerp(new THREE.Color(luma, luma, luma), GRADE.desat);
  } else { c.setRGB(0.8, 0.5, 0.4); }
  speciesPetal[name] = { headTop: maxY, color: c };
}

const plantMaterial = new THREE.MeshLambertMaterial({
  vertexColors: true,
  side: THREE.DoubleSide,
});
// Petal self-emission. In the Blender master every petal and centre carries a
// small emission on top of its diffuse response, and that glow is most of why
// the render reads bright and saturated rather than lit-and-shaded. It is a
// per-vertex strength (the recipe gives a different value per material, up to
// 0.25 on the daisy and forget-me-not centres), added in the working colour
// space just before the output is encoded, so it lifts without clipping hue.
if (RECIPE) {
  plantMaterial.onBeforeCompile = (shader) => {
    shader.vertexShader = 'attribute float aEmis;\nvarying float vEmis;\n' +
      shader.vertexShader.replace('void main() {', 'void main() {\n\tvEmis = aEmis;');
    shader.fragmentShader = 'varying float vEmis;\n' +
      shader.fragmentShader.replace('#include <colorspace_fragment>',
        '\tgl_FragColor.rgb += vEmis * vColor.rgb;\n#include <colorspace_fragment>');
  };
  plantMaterial.customProgramCacheKey = () => 'gardens-emissive';
}

// ---------------------------------------------------------------------------
// Per-flower records + instanced meshes
// ---------------------------------------------------------------------------
const flowers = [];      // one record per flower, physics + bloom state
const bySpecies = {};    // name -> array of flower records (shed-petal lookup)
for (const name of SPECIES) bySpecies[name] = [];
// species + colourway -> records, in instance order. One InstancedMesh each.
let byGroup = {};

const dummy = new THREE.Object3D();
const tmpQ = new THREE.Quaternion();
const tmpAxis = new THREE.Vector3();
const yawQ = new THREE.Quaternion();
const leafQ = new THREE.Quaternion();   // ambient breeze: stem twist
const tumbleAxis = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const tint = new THREE.Color();
const speciesMeshes = [];

// ---------------------------------------------------------------------------
// Overlap depth-layering. Two flowers whose heads overlap on screen sit at the
// SAME height, so their thin petals genuinely intersect in 3D and the z-buffer
// interleaves them per-pixel (petals "jutting through" a neighbour). Because
// the camera is orthographic top-down, lifting a flower along Y is invisible —
// it only changes occlusion order. So we graph-colour the overlap graph and
// lift each flower by layer × LAYER_GAP: any two OVERLAPPING heads land in
// different slabs, separated by more than a head's height, so the higher one
// cleanly covers the lower. Non-overlapping flowers reuse slabs (few layers).
const LAYER_GAP = 1.7;    // Y per slab — must exceed the tallest head's height
function assignLayers() {
  if (!flowers.length) return;
  let maxRad = 0;
  for (const r of flowers) { r.rad = speciesHeadR[r.sp] * r.sc; if (r.rad > maxRad) maxRad = r.rad; }
  // shorter heads first, so taller flowers tend to end up in the front slabs
  const order = flowers.slice().sort((a, b) => (a.headTop * a.sc) - (b.headTop * b.sc));
  const cell = Math.max(0.5, maxRad);
  const buckets = new Map();
  const bkey = (cx, cz) => cx * 8192 + cz;
  for (const r of order) {
    const cx = Math.floor(r.x / cell), cz = Math.floor(r.z / cell);
    const reach = Math.ceil((r.rad + maxRad) / cell);
    const used = new Set();
    for (let ix = cx - reach; ix <= cx + reach; ix++) {
      for (let iz = cz - reach; iz <= cz + reach; iz++) {
        const arr = buckets.get(bkey(ix, iz));
        if (!arr) continue;
        for (const o of arr) {
          const dx = r.x - o.x, dz = r.z - o.z, sum = r.rad + o.rad;
          if (dx * dx + dz * dz < sum * sum) used.add(o.layer);
        }
      }
    }
    let L = 0; while (used.has(L)) L++;
    r.layer = L; r.yLift = L * LAYER_GAP;
    let a = buckets.get(bkey(cx, cz));
    if (!a) buckets.set(bkey(cx, cz), a = []);
    a.push(r);
  }
}

// Build flower records + instanced meshes from a layout's flower list. Split
// out of the old one-time inline loop so the title can be RE-PLANTED with a new
// word for the page transitions (blow away, then grow the next word).
function buildFlowers(list) {
  for (const f of list) {
    const sc = f.sc * GLOBAL_SCALE;
    const yaw = f.rot + rng() * Math.PI * 2;      // data rot is 0 — add variety
    // resting tilt — flowers mostly stand STRAIGHT UP with only a hint of lean
    // for life; the max lean shrinks with size, so big/heavy heads stand
    // straightest (they were the ones reading as "bending too much").
    const leanMax = 0.17 * Math.min(1, 1 / (0.4 + 0.7 * sc));
    const leanAngle = rng() * rng() * leanMax;    // biased low (product of uniforms)
    const leanDir = rng() * Math.PI * 2;
    const restQ = new THREE.Quaternion()
      .setFromAxisAngle(new THREE.Vector3(Math.cos(leanDir), 0, Math.sin(leanDir)).normalize(), leanAngle)
      .multiply(new THREE.Quaternion().setFromAxisAngle(UP, yaw));
    const blNorm = (f.bl - 5) / 12;               // 5..17 -> 0..1
    const rec = {
      x: f.x, z: -f.y, sc, restQ,
      rank: Math.max(0, Math.min(1, blNorm)),     // bloom order 0..1 (for stagger)
      bloomStart: blNorm * BLOOM_STAGGER + rng() * BLOOM_JITTER,
      bloomScale: 0,
      // damped harmonic oscillator on the 2D tilt vector (radians toward x/z)
      sx: 0, sz: 0, vx: 0, vz: 0,
      // wind blow-away offsets (world x/z translate, extra yaw spin, shrink)
      bx: 0, bz: 0, btumble: 0, bsc: 1, tax: 0, tay: 1, taz: 0,
      blowStart: 0, blowVX: 0, blowVZ: 0, blowTumble: 0,
      reach: 0.45 + 0.62 * sc + HAND_RADIUS,       // hand influence radius
      maxBend: Math.min(1.35, 0.52 + 0.42 * sc),   // big flowers bend further
      omega: 8.6 / (0.55 + 0.62 * sc),             // big flowers sway slower
      zeta: 0.13, live: false, mesh: null, instanceId: 0,
      sp: f.sp,                                    // species (picks shed-petal shape)
      headTop: speciesPetal[f.sp].headTop,         // local head height (shed origin)
      petalColor: speciesPetal[f.sp].color,        // this species' petal colour
      yLift: 0, rad: 0, layer: 0,                  // depth-slab lift (overlap fix)
      // --- ambient breeze constants (own PRNG stream; see brng) -------------
      // Organic irregularity is the point: amplitude, phase and every rider
      // frequency differ per flower, so no two plants are ever in step.
      wAmp: 1 + (brng() - 0.5) * 2 * GUST_AMP_VAR,       // ±15% gust amplitude
      wPh: (brng() - 0.5) * 2 * GUST_PHASE_JIT,          // ±0.3 rad phase jitter
      wShimPh: brng() * Math.PI * 2,                     // shimmer φᵢ
      wShimW: 2 * Math.PI * SHIM_HZ * (0.88 + brng() * 0.24),
      wWobPhX: brng() * Math.PI * 2,                     // head wobble, independent
      wWobPhZ: brng() * Math.PI * 2,                     // phase per axis
      wWobW: 2 * Math.PI * WOB_HZ * (0.85 + brng() * 0.3),
      wLeafAmp: LEAF_AMP_MIN + brng() * (LEAF_AMP_MAX - LEAF_AMP_MIN),
      wLeafW: 2 * Math.PI * (LEAF_HZ_MIN + brng() * (LEAF_HZ_MAX - LEAF_HZ_MIN)),
      wLeafPh: brng() * Math.PI * 2,
    };
    flowers.push(rec);
    bySpecies[f.sp].push(rec);
  }
  assignLayers();          // depth-slab lift so overlapping heads occlude cleanly
  measureBreezeSpan();     // gust wavelength = the width of the word just planted
  assignColorways();       // which plants wear the substitute family
  for (const key of Object.keys(byGroup)) {
    const list2 = byGroup[key];
    if (!list2.length) continue;
    const [name, cw] = key.split('#');
    const geo = (speciesGeoBreed[name] && speciesGeoBreed[name][+cw])
      ? speciesGeoBreed[name][+cw]
      : (cw === '1' && speciesGeoAlt[name]) ? speciesGeoAlt[name] : speciesGeo[name];
    const mesh = new THREE.InstancedMesh(geo, plantMaterial, list2.length);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    for (let i = 0; i < list2.length; i++) {
      const r = list2[i];
      r.mesh = mesh; r.instanceId = i;
      dummy.position.set(r.x, r.yLift, r.z);
      dummy.quaternion.copy(r.restQ);
      dummy.scale.setScalar(0.0001);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      // Two draws either way, so the layout PRNG stream is unchanged.
      const jA = rng(), jB = rng();
      if (RECIPE) {
        // the recipe's per-flower value jitter (val_range 0.92 .. 1.08)
        const vj = 0.92 + jA * 0.16;
        tint.setRGB(vj, vj, vj);
      } else {
        tint.set(1, 1, 1).offsetHSL((jA - 0.5) * 0.05, 0, (jB - 0.5) * 0.10);
      }
      mesh.setColorAt(i, tint);
    }
    mesh.instanceColor.needsUpdate = true;
    scene.add(mesh);
    speciesMeshes.push(mesh);
  }
}

// Choose which individual plants wear the substitute colour family.
//
// Three taste constraints, in this order: the new family must be spread EVENLY
// across the whole word rather than clumped, no two plants wearing it may touch
// inside a letter, and where a plant has to stay in its original colour the
// deeper rose is kept in preference to the pale tulip. The draw comes from its
// own fixed-seed stream, so the assignment is identical on every load.
function assignColorways() {
  for (const r of flowers) r.cw = 0;
  byGroup = {};
  if (GRADE.breeds) {
    // Colour is DEALT, not blocked: each species' breeds come off a reshuffled
    // deck so every colour shows in fair measure, and a card is rejected while
    // a same-species neighbour within reach already wears it. Patch-seeding
    // read as clumps of near-identical flowers, so the bed is scattered again —
    // the radius is generous enough that repeats never touch.
    const bySp = {};
    for (const r of flowers) (bySp[r.sp] || (bySp[r.sp] = [])).push(r);
    const MIND = 1.35;                        // world units between same breeds
    for (const sp of Object.keys(GRADE.breeds)) {
      const list = (bySp[sp] || []).slice().sort((a, b) => (a.x - b.x) || (a.z - b.z));
      const K = GRADE.breeds[sp].length;
      let deck = [];
      const placed = [];
      for (const r of list) {
        if (!deck.length) {
          deck = Array.from({ length: K }, (_, i) => i);
          for (let i = deck.length - 1; i > 0; i--) {
            const j = (crng() * (i + 1)) | 0;
            const t = deck[i]; deck[i] = deck[j]; deck[j] = t;
          }
        }
        let pick = -1;
        for (let d = 0; d < deck.length; d++) {
          let clash = false;
          for (const o of placed) {
            const dx = r.x - o.x, dz = r.z - o.z;
            if (o.cw === deck[d] && dx * dx + dz * dz < MIND * MIND) { clash = true; break; }
          }
          if (!clash) { pick = d; break; }
        }
        if (pick < 0) pick = 0;
        r.cw = deck.splice(pick, 1)[0];
        placed.push(r);
        if (placed.length > 60) placed.shift();
      }
    }
  }
  if (RECOLOR) {
    const cand = flowers.filter((r) => RECOLOR.species.includes(r.sp));
    // favoured species go first, so they are the ones that convert
    const order = RECOLOR.favor || [];
    cand.sort((a, b) => {
      const fa = order.indexOf(a.sp), fb = order.indexOf(b.sp);
      return (fb - fa) || (a.x - b.x);
    });
    // even spread: walk the word in vertical strips and fill each to the target
    const NB = 14, buckets = [];
    for (let i = 0; i < NB; i++) buckets.push([]);
    for (const r of cand) {
      const u = breezeW > 0 ? (r.x - breezeX0) / breezeW : 0;
      buckets[Math.min(NB - 1, Math.max(0, Math.floor(u * NB)))].push(r);
    }
    const minD = RECOLOR.minDist || 1.1;
    const taken = [];
    for (const b of buckets) {
      // deterministic shuffle inside the strip (own stream, fixed seed)
      for (let i = b.length - 1; i > 0; i--) {
        const j = (crng() * (i + 1)) | 0;
        const t = b[i]; b[i] = b[j]; b[j] = t;
      }
      // favoured species first within the strip too
      b.sort((a2, b2) => order.indexOf(b2.sp) - order.indexOf(a2.sp));
      let want = Math.round(b.length * RECOLOR.share);
      for (const r of b) {
        if (want <= 0) break;
        let clash = false;
        for (const o of taken) {
          const dx = r.x - o.x, dz = r.z - o.z;
          if (dx * dx + dz * dz < minD * minD) { clash = true; break; }
        }
        if (clash) continue;                 // never two of the new family touching
        r.cw = 1; taken.push(r); want--;
      }
    }
    // Region boost (E/N): raise the converted share inside the box, title row
    // only. The title row is wherever the majority of flowers sit.
    if (RECOLOR.boost) {
      const B = RECOLOR.boost;
      let zmin = Infinity, zmax = -Infinity;
      for (const r of flowers) { if (r.z < zmin) zmin = r.z; if (r.z > zmax) zmax = r.z; }
      const zmid = (zmin + zmax) / 2;
      const hiN = flowers.filter((r) => r.z > zmid).length;
      const topSide = hiN >= flowers.length - hiN ? 1 : -1;
      const rc = cand.filter((r) =>
        ((r.z > zmid ? 1 : -1) === topSide) && r.x >= B.x0 && r.x <= B.x1);
      let want = Math.round(rc.length * B.share) - rc.filter((r) => r.cw === 1).length;
      const rest = rc.filter((r) => r.cw !== 1);
      for (let i = rest.length - 1; i > 0; i--) {
        const j = (crng() * (i + 1)) | 0;
        const t = rest[i]; rest[i] = rest[j]; rest[j] = t;
      }
      const mD = B.minDist || 0.5;
      for (const r of rest) {
        if (want <= 0) break;
        let clash = false;
        for (const o of taken) {
          const dx = r.x - o.x, dz = r.z - o.z;
          if (dx * dx + dz * dz < mD * mD) { clash = true; break; }
        }
        if (clash) continue;
        r.cw = 1; taken.push(r); want--;
      }
    }
  }
  for (const r of flowers) {
    const k = r.sp + '#' + (r.cw || 0);
    (byGroup[k] || (byGroup[k] = [])).push(r);
  }
}
buildFlowers(layout.flowers);

function clearFlowers() {
  for (const m of speciesMeshes) { scene.remove(m); if (m.dispose) m.dispose(); }
  speciesMeshes.length = 0;
  flowers.length = 0;
  for (const name of SPECIES) bySpecies[name].length = 0;
  byGroup = {};
  liveSet.clear();
  grid.clear();
}

// ---------------------------------------------------------------------------
// Petal shedding — one pooled InstancedMesh per species, drawing that species'
// own petal shape (assets/petals.glb, extracted from the flower model). Persist
// across re-plants (the flower meshes rebuild; these don't). See tunables above.
// ---------------------------------------------------------------------------
const petalGeos = {};
for (const name of SPECIES) {
  const node = petalGltf.scene.getObjectByName(name);
  let g = null;
  if (node) node.traverse((o) => { if (o.isMesh && !g) g = o.geometry; });
  petalGeos[name] = g;
}
// draw-on-top flourish layer: skip the depth buffer so petals always read over
// the dense (same-coloured) flower field
const petalMat = new THREE.MeshLambertMaterial({
  vertexColors: false, side: THREE.DoubleSide, transparent: true,
  opacity: 1, depthTest: false, depthWrite: false,
});
const petalHidden = new THREE.Matrix4().makeScale(0, 0, 0);
const PSYS = {};
if (PETALS_ON) {
  for (const name of SPECIES) {
    const geo = petalGeos[name];
    if (!geo) continue;
    const mesh = new THREE.InstancedMesh(geo, petalMat, PETAL_CAP);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.renderOrder = 10;
    const pool = [];
    for (let i = 0; i < PETAL_CAP; i++) {
      pool.push({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
        ang: 0, angV: 0, wob: 0, age: 0, life: 1, size: 0.1 });
      mesh.setMatrixAt(i, petalHidden);
    }
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
    PSYS[name] = { mesh, petals: pool, count: 0, cursor: 0, colorDirty: false };
  }
}
let petalCount = 0;             // total live petals across species (for idle)
let gPetalNext = 0;            // clock (s) before which no new shed event fires
const struckR = []; const struckUx = []; const struckUz = []; let struckN = 0;

// reusable temps (no per-petal allocation)
const pPos = new THREE.Vector3(), pScl = new THREE.Vector3();
const pQuat = new THREE.Quaternion(), qTilt = new THREE.Quaternion(), qYaw = new THREE.Quaternion();
const PAXIS_X = new THREE.Vector3(1, 0, 0), PAXIS_Y = new THREE.Vector3(0, 1, 0);
const pMat = new THREE.Matrix4();
const pColLight = new THREE.Color(), PETAL_WHITE = new THREE.Color(1, 1, 1);

function emitPetal(sys, hx, hy, hz, dirx, dirz, sc, color) {
  const id = sys.cursor;
  sys.cursor = (sys.cursor + 1) % PETAL_CAP;
  const p = sys.petals[id];
  if (!p.alive) { sys.count++; petalCount++; }
  p.alive = true;
  const j = () => rng() - 0.5;
  p.x = hx + j() * 0.06 * sc;
  p.y = hy + j() * 0.05 * sc;
  p.z = hz + j() * 0.06 * sc;
  // outward GROUND drift (the motion visible top-down), NOT hand-speed-scaled
  const ang = rng() * Math.PI * 2;
  let dx = Math.cos(ang) + dirx * 0.8, dz = Math.sin(ang) + dirz * 0.8;
  const dl = Math.hypot(dx, dz) || 1;
  const spd = PETAL_OUT * (0.7 + rng() * 0.6);
  p.vx = (dx / dl) * spd;
  p.vz = (dz / dl) * spd;
  p.vy = PETAL_UP * (0.4 + rng() * 0.6);
  p.ang = rng() * Math.PI * 2;      // in-plane spin (visible flutter)
  p.angV = j() * 7;
  p.wob = rng() * Math.PI * 2;
  p.age = 0;
  p.life = PETAL_LIFE * (0.8 + rng() * 0.5);
  p.size = PETAL_SIZE * sc * (0.8 + rng() * 0.5);
  sys.mesh.setColorAt(id, pColLight.copy(color).lerp(PETAL_WHITE, 0.22));
  sys.colorDirty = true;
}

function updatePetals(dt) {
  if (petalCount === 0) return;
  for (let s = 0; s < SPECIES.length; s++) {
    const sys = PSYS[SPECIES[s]];
    if (!sys || sys.count === 0) continue;
    const mesh = sys.mesh, pool = sys.petals;
    for (let id = 0; id < PETAL_CAP; id++) {
      const p = pool[id];
      if (!p.alive) continue;
      p.age += dt;
      if (p.age >= p.life) { p.alive = false; sys.count--; petalCount--; mesh.setMatrixAt(id, petalHidden); continue; }
      p.vy -= PETAL_GRAVITY * dt;
      const drag = Math.exp(-PETAL_DRAG * dt);
      p.vx *= drag; p.vy *= drag; p.vz *= drag;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.012) { p.y = 0.012; p.vy = 0; p.vx *= 0.4; p.vz *= 0.4; }
      p.ang += p.angV * dt;
      const f0 = p.life * 0.55;
      const fade = p.age > f0 ? Math.max(0, 1 - (p.age - f0) / (p.life - f0)) : 1;
      const sz = p.size * fade;
      // lie ~flat to the top-down camera (tilt −90° about X) + gentle wobble,
      // then spin in-plane (yaw about Y) so the face always shows
      const tilt = -Math.PI / 2 + 0.5 * Math.sin(p.ang * 0.7 + p.wob);
      qTilt.setFromAxisAngle(PAXIS_X, tilt);
      qYaw.setFromAxisAngle(PAXIS_Y, p.ang);
      pQuat.multiplyQuaternions(qYaw, qTilt);
      pPos.set(p.x, p.y, p.z);
      pScl.set(sz, sz, sz);
      pMat.compose(pPos, pQuat, pScl);
      mesh.setMatrixAt(id, pMat);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (sys.colorDirty && mesh.instanceColor) { mesh.instanceColor.needsUpdate = true; sys.colorDirty = false; }
  }
}

// ---------------------------------------------------------------------------
// AMBIENT DRIFTING PETALS — the wisps in the air.
//
// The Blender gust study keeps a dozen-odd tiny petals adrift over the bed at
// all times, tumbling slowly through the air well above the flowers. Measured
// off frames2: 7 to 13 free-flying specks in frame at once, each 1 to 5 px on a
// 1920 px-wide title (so a few tenths of one percent of the word's width —
// "tiny and shapeless"), individually moving 60 to 200 px/s in wandering
// directions rather than streaming one way, in pale washed petal tints.
//
// This layer is a SEPARATE pool from the shed petals. It never borrows a petal
// from PSYS, never calls emitPetal, and never touches the flower records, so
// shedding stays as sparse and as rate-limited as it is today and the word can
// never be thinned by the ambience. It rides the same gust wave the flowers do
// (with a lag, so the air reads as one body), and it lives and dies with the
// breeze — off under Reduce Motion, off while the title is hidden or blown away.
// ---------------------------------------------------------------------------
const DRIFT_ON = BREEZE_ON;
const DRIFT_N = 14;                 // concurrent wisps (reference: 7-13 in frame)
const DRIFT_SIZE = [0.075, 0.150];  // instance scale — deliberately under the
                                    // shed petals' 0.12-0.29 so these read as
                                    // specks in the air, not as fallen petals
const DRIFT_VX = [0.30, 1.10];      // u/s along the wind. Reference tracks run
                                    // both ways; this keeps a left-to-right bias
                                    // so the wisps agree with the gust.
const DRIFT_VZ = 0.34;              // u/s cross-drift, signed
const DRIFT_WANDER_A = [0.10, 0.34];// u/s wander amplitude
const DRIFT_WANDER_F = [0.17, 0.55];// Hz
const DRIFT_TUMBLE = [0.45, 1.60];  // rad/s about the wisp's own random axis
const DRIFT_GUST_PUSH = 1.9;        // u/s added at the crest of the gust
const DRIFT_GUST_LAG = 0.9;         // 1/s — how fast a wisp takes up the gust
const DRIFT_MARGIN = 2.2;           // u past the frame before it wraps around
const DRIFT_FADE = 2.6;             // u of scale fade at each edge
const DRIFT_LIGHTEN = 0.22;         // toward white — the reference wisps are
                                    // pale, but not so pale they vanish on a
                                    // light ground (see alive-life.js's note)

const drifters = [];
const DSYS = {};
const dAxis = new THREE.Vector3(), dQuat = new THREE.Quaternion();
const dPos = new THREE.Vector3(), dScl = new THREE.Vector3(), dMat = new THREE.Matrix4();
const driftMat = new THREE.MeshLambertMaterial({
  vertexColors: false, side: THREE.DoubleSide, transparent: true,
  opacity: 0.92, depthTest: false, depthWrite: false,
});

function driftReseed(d, fromLeft) {
  const span = breezeW + DRIFT_MARGIN * 2;
  d.x = fromLeft ? breezeX0 - DRIFT_MARGIN : breezeX0 + breezeW + DRIFT_MARGIN;
  if (fromLeft === null) d.x = breezeX0 - DRIFT_MARGIN + drng() * span;
  d.z = (drng() * 2 - 1) * driftBedZ;
  d.vx = DRIFT_VX[0] + drng() * (DRIFT_VX[1] - DRIFT_VX[0]);
  d.vz = (drng() * 2 - 1) * DRIFT_VZ;
  d.wa = DRIFT_WANDER_A[0] + drng() * (DRIFT_WANDER_A[1] - DRIFT_WANDER_A[0]);
  d.wf = 2 * Math.PI * (DRIFT_WANDER_F[0] + drng() * (DRIFT_WANDER_F[1] - DRIFT_WANDER_F[0]));
  d.wp = drng() * Math.PI * 2;
  d.tv = (DRIFT_TUMBLE[0] + drng() * (DRIFT_TUMBLE[1] - DRIFT_TUMBLE[0])) * (drng() < 0.5 ? -1 : 1);
  d.size = DRIFT_SIZE[0] + drng() * (DRIFT_SIZE[1] - DRIFT_SIZE[0]);
  const ax = drng() - 0.5, ay = drng() - 0.5, az = drng() - 0.5;
  const al = Math.hypot(ax, ay, az) || 1;
  d.ax = ax / al; d.ay = ay / al; d.az = az / al;
  d.gust = 0;
}

if (DRIFT_ON) {
  const names = SPECIES.filter((n) => petalGeos[n]);
  const perSpecies = {};
  for (let i = 0; i < DRIFT_N; i++) {
    const sp = names[i % names.length];
    (perSpecies[sp] || (perSpecies[sp] = [])).push(i);
  }
  for (const sp of names) {
    const ids = perSpecies[sp];
    if (!ids || !ids.length) continue;
    const mesh = new THREE.InstancedMesh(petalGeos[sp], driftMat, ids.length);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.renderOrder = 9;                     // under the shed petals (10)
    for (let s = 0; s < ids.length; s++) {
      const d = { sp, mesh, slot: s, ang: 0,
                  x: 0, z: 0, vx: 0, vz: 0, wa: 0, wf: 0, wp: 0, tv: 0,
                  size: 0.1, ax: 0, ay: 1, az: 0, gust: 0 };
      driftReseed(d, null);                   // scattered across the word on load
      d.ang = drng() * Math.PI * 2;
      drifters[ids[s]] = d;
      pColLight.copy(speciesPetal[sp].color).lerp(PETAL_WHITE, DRIFT_LIGHTEN);
      mesh.setColorAt(s, pColLight);
      mesh.setMatrixAt(s, petalHidden);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
    DSYS[sp] = mesh;
  }
}

// Re-scatter the wisps over a newly planted word (called from replant).
function driftRescatter() {
  if (!DRIFT_ON) return;
  driftBedZ = Math.max(1.4, camera.top * 0.66);
  for (const d of drifters) if (d) driftReseed(d, null);
}

function updateDrift(dt) {
  if (!DRIFT_ON || !drifters.length) return;
  const lo = breezeX0 - DRIFT_MARGIN, hi = breezeX0 + breezeW + DRIFT_MARGIN;
  for (const d of drifters) {
    if (!d) continue;
    // The gust reaches the air a moment after it reaches the stems, and the
    // wisp keeps going after the front has passed — that lag is what sells the
    // two layers as one body of moving air.
    const w = (Math.PI * 2) * (breezeT / GUST_PERIOD) - (d.x - breezeX0) * breezeSpanW;
    const s = Math.sin(w);
    d.gust += ((s > 0 ? s * Math.sqrt(s) : 0) - d.gust) * Math.min(1, DRIFT_GUST_LAG * dt);
    d.wp += d.wf * dt;
    d.x += (d.vx + d.gust * DRIFT_GUST_PUSH) * dt;
    d.z += (d.vz + Math.sin(d.wp) * d.wa - d.gust * 0.22) * dt;
    d.ang += d.tv * dt;
    if (d.x > hi) driftReseed(d, true);                 // out right, back in left
    else if (d.x < lo) driftReseed(d, false);
    if (d.z > driftBedZ + 1.2 || d.z < -driftBedZ - 1.2) d.vz = -d.vz;

    // scale fade at both edges so a wisp thins away instead of popping
    const edge = Math.min(d.x - lo, hi - d.x) / DRIFT_FADE;
    const sz = d.size * Math.max(0, Math.min(1, edge)) * breezeK;
    if (sz <= 1e-4) { d.mesh.setMatrixAt(d.slot, petalHidden); continue; }
    dAxis.set(d.ax, d.ay, d.az);
    dQuat.setFromAxisAngle(dAxis, d.ang);
    dPos.set(d.x, driftY, d.z);
    dScl.set(sz, sz, sz);
    dMat.compose(dPos, dQuat, dScl);
    d.mesh.setMatrixAt(d.slot, dMat);
  }
  for (const sp in DSYS) DSYS[sp].instanceMatrix.needsUpdate = true;
}

// ---------------------------------------------------------------------------
// DRIFTING DAPPLE — cloud shadow over the whole field (livinglight only).
//
// Big, very soft patches of shade sliding across the hero, seamlessly. This is
// a multiply layer rather than real shadow-casting geometry: with an ortho
// top-down camera the dapple has to darken the ground and the flowers by the
// same amount, which is exactly what a multiply blend does, at no per-flower
// cost and with no change to the material or the physics. The patches live in
// a repeating tile, so translating that tile around a circle returns it to its
// own start — the loop is seamless by construction, not by cross-fade.
//
// It rides the SAME clock as the gust and dies with it: gone under Reduce
// Motion, gone the moment the title is hidden or blown away.
// ---------------------------------------------------------------------------
const DAP = BREEZE_ON ? GRADE.dapple : null;
let dapEl = null, dapTileW = 900, dapTileH = 700, dapDrift = 120;
if (DAP) {
  dapEl = document.createElement('div');
  dapEl.setAttribute('aria-hidden', 'true');
  dapEl.style.cssText =
    'position:fixed;left:-40vw;top:-40vh;width:180vw;height:180vh;' +
    'pointer-events:none;z-index:31;mix-blend-mode:multiply;opacity:0;' +
    'will-change:transform;transition:opacity .6s linear;background-repeat:repeat;';
  document.body.appendChild(dapEl);
}
// Three patch layers. Each is ONE circle centred in its own SQUARE tile, going
// to zero alpha well inside that tile (DAP_STOP of the closest-side radius), so
// the tile repeats with nothing to see at the join — a circle clipped by its
// own tile edge is exactly what draws seams across the field. Stopping early
// also keeps the layer SPARSE: the render holds its ground at a clean 255 with
// only the darkest few percent shaded (frames1 f_0071 measures luminance
// percentiles 1/3/5/50 = 203/222/254/255), and a patch that filled its tile
// would grey the whole page instead. Three different tile sizes beat against
// each other so the composite never reads as a grid.
//   [tile size x patch, x offset x patch, y offset x patch, alpha x strength]
const DAP_STOP = 34;
const DAP_LAYERS = [
  [2.00, 0.00, 0.00, 1.00],
  [3.10, 0.83, 0.41, 0.80],
  [4.30, 0.37, 1.12, 0.62],
];
function layoutDapple() {
  if (!dapEl) return;
  // Patch diameter as a fraction of the framed title width, per the render.
  const px = banner.clientWidth || window.innerWidth;
  const patch = Math.max(160, DAP.feature * px);
  dapDrift = patch * DAP.radius;
  const img = [], size = [], pos = [];
  for (const [t, ox, oy, a] of DAP_LAYERS) {
    const s = Math.round(patch * t);
    img.push(`radial-gradient(circle closest-side at 50% 50%,` +
             ` rgba(${DAP.core}, ${(DAP.strength * a).toFixed(3)}) 0%,` +
             ` rgba(${DAP.core}, 0) ${DAP_STOP}%)`);
    size.push(`${s}px ${s}px`);
    pos.push(`${Math.round(patch * ox)}px ${Math.round(patch * oy)}px`);
  }
  dapEl.style.backgroundImage = img.join(', ') + ', linear-gradient(#fff, #fff)';
  dapEl.style.backgroundSize = size.join(', ') + ', 100% 100%';
  dapEl.style.backgroundPosition = pos.join(', ') + ', 0 0';
}
function updateDapple(t) {
  if (!dapEl) return;
  const on = breezeK > 0.02;
  dapEl.style.opacity = on ? '1' : '0';
  if (!on) return;
  const w = (Math.PI * 2) * (t / DAP.period);
  // a slow circuit; the tile repeats, so one lap is a perfect loop
  dapEl.style.transform =
    `translate3d(${(Math.cos(w) * dapDrift).toFixed(2)}px,` +
    ` ${(Math.sin(w) * dapDrift * 0.62).toFixed(2)}px, 0)`;
}

// ---------------------------------------------------------------------------
// Soft contact shadows — a 2D canvas layer beneath the WebGL canvas.
// Top-down orthographic view means screen-space blobs map exactly to the
// ground plane, and this costs the GPU nothing.
// ---------------------------------------------------------------------------
// The contact shadow is tinted BY the ground. On this build's own designed
// ground it uses the colour fitted against the reference render; on a ground
// picked from the theme switcher there is no fitted value, so it becomes that
// ground darkened toward its own shade — which is what a contact shadow IS, and
// keeps every theme looking designed rather than merely re-backgrounded.
let shadowRGB = GRADE.shadow.rgb;
function makeBlobSprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
  g.addColorStop(0, `rgba(${shadowRGB}, ${GRADE.shadow.a0})`);
  g.addColorStop(0.55, `rgba(${shadowRGB}, ${GRADE.shadow.a1})`);
  g.addColorStop(1, `rgba(${shadowRGB}, 0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return c;
}
let blobSprite = makeBlobSprite();

// The ground picker (theme.js) announces the ground actually in force. Nothing
// about the flowers changes here — this only re-tints the two things the ground
// owns: the contact shadows and, where a build has one, the cloud dapple.
function parseHex(h) {
  h = String(h).trim().replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return Number.isFinite(n) && h.length === 6
    ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : null;
}
window.addEventListener('gardens-ground', (e) => {
  const d = e.detail || {};
  const rgb = parseHex(d.ground);
  if (d.name === 'paper') {
    // The warm-paper swatch is the CURRENT SITE's ground, so it gets that
    // build's own fitted contact-shadow colour rather than a derived one --
    // picking it should land on the shipped look exactly, not on a recolour.
    shadowRGB = '118, 108, 96';
    if (DAP) DAP.core = '222, 216, 205';
  } else if (d.isDefault || !rgb) {
    shadowRGB = GRADE.shadow.rgb;
    if (DAP) DAP.core = GRADE.dapple.core;
  } else {
    // The ground, in shade: dark enough to read on a light paper, still
    // carrying that paper's own hue so it never looks foreign. The factor eases
    // toward 1 as the ground gets darker, because a fixed multiplier that reads
    // as a soft shadow on white goes to near-black on a mid-tone ground like
    // the brand sage.
    const gl = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
    const f = 0.46 + 0.34 * (1 - gl);
    shadowRGB = rgb.map((v) => Math.round(v * f)).join(', ');
    if (DAP) DAP.core = rgb.map((v) => Math.round(v * (0.885 + 0.07 * (1 - gl)))).join(', ');
  }
  blobSprite = makeBlobSprite();
  if (DAP) layoutDapple();
  shadowsDrawnFinal = false;
  drawShadows();
  requestRender();
});

let shadowsDrawnFinal = false;
function drawShadows() {
  const w = shadowCanvas.width, h = shadowCanvas.height;
  const halfH = camera.top;
  const pxPerUnit = w / (2 * HALF_W);
  shadowCtx.clearRect(0, 0, w, h);
  for (const r of flowers) {
    const e = Math.min(1, r.bloomScale * r.bsc);
    if (e <= 0.01) continue;
    // Offset and radius come from GRADE: dz is positive DOWN-SCREEN, so a
    // higher sun (golden) pushes the shadow further below its flower.
    const rad = GRADE.shadow.r * r.sc * e * pxPerUnit;   // blob radius in px
    const px = (r.x + r.bx + GRADE.shadow.dx * r.sc) * pxPerUnit + w / 2;
    const py = ((r.z + r.bz + GRADE.shadow.dz * r.sc) / halfH) * (h / 2) + h / 2;
    shadowCtx.drawImage(blobSprite, px - rad, py - rad, rad * 2, rad * 2);
  }
}

// ---------------------------------------------------------------------------
// Spatial hash for hand -> flower queries
// ---------------------------------------------------------------------------
const CELL = 3.0;
const grid = new Map();
function cellKey(cx, cz) { return cx * 4096 + cz; }
function buildGrid() {
  grid.clear();
  for (const r of flowers) {
    const k = cellKey(Math.floor(r.x / CELL), Math.floor(r.z / CELL));
    let arr = grid.get(k);
    if (!arr) grid.set(k, (arr = []));
    arr.push(r);
  }
}
buildGrid();

const liveSet = new Set();
function wakeNear(x0, z0, x1, z1) {
  const pad = 3.0; // >= max reach (0.45 + 0.62·maxSc + HAND_RADIUS ≈ 2.32) + TOUCH_REACH
  const minX = Math.floor((Math.min(x0, x1) - pad) / CELL);
  const maxX = Math.floor((Math.max(x0, x1) + pad) / CELL);
  const minZ = Math.floor((Math.min(z0, z1) - pad) / CELL);
  const maxZ = Math.floor((Math.max(z0, z1) + pad) / CELL);
  for (let cx = minX; cx <= maxX; cx++) {
    for (let cz = minZ; cz <= maxZ; cz++) {
      const arr = grid.get(cellKey(cx, cz));
      if (arr) for (const r of arr) liveSet.add(r);
    }
  }
}

// ---------------------------------------------------------------------------
// Pointer -> hand on the ground plane (y = 0)
// ---------------------------------------------------------------------------
const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const ndc = new THREE.Vector2();
const hitPoint = new THREE.Vector3();

const hand = {
  x: 0, z: 0,                     // latest sample position (push channel)
  vxs: 0, vzs: 0,                 // smoothed velocity (drag channel)
  active: false,
  lastMove: -1e9,                 // performance clock (s) of last event batch
  lastSampleT: -1e9,              // event-timestamp clock (s) of last sample
  // per-gesture speed memory for the whip-crack (peak carry) + accel terms.
  // vSm is the attack-smoothed segment speed (~25 ms of event time): the
  // peak carry only registers SUSTAINED speed, so one timing-jittered sample
  // cannot masquerade as a swipe, while a real swipe (dozens of consecutive
  // fast samples) registers within ~2 frames.
  prevV: 0, peakV: 0, accS: 0, vSm: 0,
};

// Swept-path buffer: sub-segments of real pointer travel accumulated since
// the last physics tick. Each entry carries its own duration measured from
// EVENT timestamps, so per-segment speed stays exact even when many samples
// land inside a single frame (fast swipes, coalesced input, frame jank).
const pathBuf = [];
// Sub-segments to strike THIS tick, produced from pathBuf (reused each frame).
const strikeSegs = [];

function groundFromClient(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  if (!(rect.width > 0) || !(rect.height > 0)) return false;
  ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
  return raycaster.ray.intersectPlane(groundPlane, hitPoint) !== null;
}

window.addEventListener('pointermove', (e) => {
  // High-resolution path: browsers coalesce fast pointer motion into ~one
  // event per frame — getCoalescedEvents() recovers the raw sub-samples so
  // the swept polyline of a hard swipe has no gaps. Synthetic events carry
  // none — fall back to the event itself.
  let samples = null;
  if (typeof e.getCoalescedEvents === 'function') {
    try { samples = e.getCoalescedEvents(); } catch { samples = null; }
  }
  if (!samples || samples.length === 0) samples = [e];
  hand.isTouch = e.pointerType === 'touch';
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    if (!groundFromClient(s.clientX, s.clientY)) continue;
    const rawTs = Number.isFinite(s.timeStamp) && s.timeStamp > 0
      ? s.timeStamp : (Number.isFinite(e.timeStamp) && e.timeStamp > 0
        ? e.timeStamp : performance.now());
    let ts = rawTs / 1000;
    if (!hand.active || ts - hand.lastSampleT > GESTURE_GAP) {
      // NEW gesture: first-ever sample, pointer (re)entry from outside the
      // window, idle wake, or tab switch. The previous position is stale, so
      // initialise it from THIS sample and strike nothing across the
      // imaginary chord. This decision is based on the TIME GAP between real
      // samples, NEVER on speed — continuous input, however fast, always
      // strikes along its true motion from here on.
      hand.x = hitPoint.x; hand.z = hitPoint.z;
      hand.vxs = 0; hand.vzs = 0;
      hand.prevV = 0; hand.peakV = 0; hand.accS = 0; hand.vSm = 0;
      hand.lastSampleT = ts;
      hand.active = true;
      wakeNear(hand.x, hand.z, hand.x, hand.z);
      continue;
    }
    let dt = ts - hand.lastSampleT;
    const dx = hitPoint.x - hand.x, dz = hitPoint.z - hand.z;
    const len = Math.hypot(dx, dz);
    // Sub-millisecond / duplicate / out-of-order timestamps are event-queue
    // jank (a busy browser can flush queued input with compressed stamps;
    // real devices — even 1000 Hz mice — space samples >= ~1 ms). Such
    // stamps carry NO trustworthy rate: never divide by a ~0 denominator.
    // Instead assume the sample was GENERATED at nominal input cadence
    // (~10 ms) and let the per-event distance carry the speed — a slow
    // hand's queued samples are dense in space (tiny step -> stays slow, no
    // phantom strike), a fast swipe's are sparse (long step -> stays fast,
    // full-force strike). Speed is never conjured out of jank alone.
    if (!(dt >= 0.0009)) {
      if (len > 8) {
        // no single input interval moves 8 world units (~300 px) — this is
        // a teleport chord: re-anchor here and strike nothing along it
        hand.x = hitPoint.x; hand.z = hitPoint.z;
        hand.vxs = 0; hand.vzs = 0;
        hand.prevV = 0; hand.peakV = 0; hand.accS = 0; hand.vSm = 0;
        hand.lastSampleT = Math.max(ts, hand.lastSampleT);
        continue;
      }
      dt = 0.01;
      ts = hand.lastSampleT + dt;      // keep the sample clock monotonic
    }
    if (len > 1e-5) {
      pathBuf.push({
        x0: hand.x, z0: hand.z, ux: dx / len, uz: dz / len, len, dt, kick: 0,
      });
      wakeNear(hand.x, hand.z, hitPoint.x, hitPoint.z);
      // smoothed hand velocity for the quasi-static drag channel, derived
      // from real event-time deltas (robust to sub-frame motion)
      let vx = dx / dt, vz = dz / dt;
      const vlen = Math.hypot(vx, vz);
      if (vlen > KICK_MAX_SPEED) {
        vx *= KICK_MAX_SPEED / vlen; vz *= KICK_MAX_SPEED / vlen;
      }
      // Asymmetric smoothing: FAST attack (12 ms) when speed is rising so the
      // very first events of a drag — fresh from a dead stop, when vxs was
      // just reset to 0 — register within a frame instead of being swallowed
      // by the filter's ramp-up; normal release (22 ms) when slowing keeps
      // steady motion and stops as smooth as before. Onset must never be
      // hostage to the smoother: resolution in the from-rest regime comes
      // from responding to the FIRST samples, jitter rejection from the
      // (unchanged) release side.
      const rising = vx * vx + vz * vz > hand.vxs * hand.vxs + hand.vzs * hand.vzs;
      const a = 1 - Math.exp(-dt / (rising ? 0.012 : 0.022));
      hand.vxs += (vx - hand.vxs) * a;
      hand.vzs += (vz - hand.vzs) * a;
      hand.x = hitPoint.x; hand.z = hitPoint.z;
    }
    hand.lastSampleT = ts;
  }
  hand.active = true;
  hand.lastMove = performance.now() / 1000;
  startLoop();
});
// Anchor the gesture at POINTERDOWN, not at the first pointermove. On touch
// the first move sample used to be consumed as the anchor (strike nothing),
// which on a short, fast flick — often only 1-2 pointermove events on a phone,
// after the browser's touch slop — swallowed most or all of the travel: the
// "quick small swipe does nothing" dead zone. Anchoring on the down-event means
// the first move already strikes the full chord from the touch point, with its
// true event-time speed. (Mouse is unaffected in practice: a click at rest
// anchors a zero-length chord. This also stops a second quick flick landing
// within GESTURE_GAP of the previous one from striking a phantom chord between
// the two touch points.)
window.addEventListener('pointerdown', (e) => {
  if (!groundFromClient(e.clientX, e.clientY)) return;
  const rawTs = Number.isFinite(e.timeStamp) && e.timeStamp > 0
    ? e.timeStamp : performance.now();
  hand.x = hitPoint.x; hand.z = hitPoint.z;
  hand.vxs = 0; hand.vzs = 0;
  hand.prevV = 0; hand.peakV = 0; hand.accS = 0; hand.vSm = 0;
  hand.lastSampleT = rawTs / 1000;
  hand.active = true;
  hand.isTouch = e.pointerType === 'touch';
  hand.lastMove = performance.now() / 1000;
  wakeNear(hand.x, hand.z, hand.x, hand.z);
  startLoop();
});
window.addEventListener('pointerleave', () => { hand.active = false; });
document.addEventListener('mouseleave', () => { hand.active = false; });

// ---------------------------------------------------------------------------
// Bloom easing (back-out overshoot)
// ---------------------------------------------------------------------------
function easeOutBack(t) {
  const s = 1.70158;
  const u = t - 1;
  return 1 + (s + 1) * u * u * u + s * u * u;
}

// ---------------------------------------------------------------------------
// Simulation + render loop (stops entirely at rest -> 0% CPU)
// ---------------------------------------------------------------------------
const BLOOM_TOTAL = BLOOM_STAGGER + BLOOM_JITTER + BLOOM_DUR + 0.35;
let bloomDone = false;

// Title transition state machine: grow the word out of the ground (bloom), pull
// it back into the ground (retract), or let the wind carry it off (blow).
let mode = 'bloom';               // 'bloom' | 'retract' | 'blow' | 'idle'
let animT0 = -1;                  // start time of the current bloom/retract/blow
let animCb = null;                // fired once when the current animation finishes
const RETRACT_DUR = 0.55, RETRACT_STAGGER = 0.75;
const BLOW_DUR = 0.9, BLOW_STAGGER = 0.5;
function easeInCubic(t) { return t * t * t; }
let rafId = 0;
let running = false;
let lastT = 0;
let renderQueued = false;

function requestRender() { renderQueued = true; startLoop(); }

function startLoop() {
  if (running) return;
  running = true;
  lastT = performance.now() / 1000;
  rafId = requestAnimationFrame(tick);
}

// ---------------------------------------------------------------------------
// AMBIENT BREEZE — evaluation. State lives above buildFlowers; tunables at the
// top of the file.
// ---------------------------------------------------------------------------
function measureBreezeSpan() {
  let mnx = Infinity, mxx = -Infinity;
  for (const r of flowers) { if (r.x < mnx) mnx = r.x; if (r.x > mxx) mxx = r.x; }
  if (!(mxx > mnx)) { breezeX0 = 0; breezeW = 1; breezeSpanW = Math.PI * 2; return; }
  breezeX0 = mnx;
  breezeW = mxx - mnx;
  breezeSpanW = (Math.PI * 2) / breezeW;
  // the wisps fly clear of every depth slab, so they always read over the bed
  let topLift = 0;
  for (const r of flowers) if (r.yLift > topLift) topLift = r.yLift;
  driftY = topLift + 4;
}

// How much of the breeze a flower still gets while the hand is working on it.
// A resting plant gets all of it; a plant carrying a hand-driven bend (or still
// ringing from a strike) gets progressively less, so the interaction reads as
// the only thing moving that flower. Continuous, no threshold, no hysteresis —
// and it only scales an offset that is added at draw time, so the underlying
// physics is untouched either way.
function breezeSuppress(bend, vmag) {
  const e = (bend + vmag * 0.05) / BREEZE_KNEE;
  return 1 / (1 + e * e);
}

function updateFlowerMatrix(r) {
  let sx = r.sx, sz = r.sz;
  let leaf = 0;
  if (breezeK > 0) {
    // Travelling gust: phase runs 2π(t/T − x/W), so a crest walks the word
    // left→right once per GUST_PERIOD and the wavelength is the whole title.
    const w = (Math.PI * 2) * (breezeT / GUST_PERIOD)
            - (r.x - breezeX0) * breezeSpanW + r.wPh;
    const s = Math.sin(w);
    // rectified, sharpened half-sine — a gust arrives and passes, it does not
    // pull the flowers backwards on the return half of the cycle
    const g = s > 0 ? s * Math.sqrt(s) : 0;                  // s^1.5
    const bendNow = Math.sqrt(r.sx * r.sx + r.sz * r.sz);
    const k = breezeK * r.wAmp
            * breezeSuppress(bendNow, Math.sqrt(r.vx * r.vx + r.vz * r.vz));
    const lean = GUST_AMP * g;
    sx += k * (lean
             + SHIM_AMP * Math.sin(breezeT * r.wShimW + r.wShimPh)   // fast shimmer
             + WOB_AMP * Math.sin(breezeT * r.wWobW + r.wWobPhX));   // head wobble, x
    sz += k * (GUST_CROSS * GUST_AMP * s                             // cross-axis sway
             + WOB_AMP * Math.sin(breezeT * r.wWobW + r.wWobPhZ));   // head wobble, z
    // Foliage flutter. The web build merges each species into ONE rigid
    // geometry, so leaves cannot be articulated separately — instead the plant
    // twists a little about its own stem, which under the top-down orthographic
    // camera reads as the leaves and head shivering rather than the stem
    // lurching (a whole-plant TILT at leaf amplitude would swamp the gust).
    leaf = k * r.wLeafAmp * Math.sin(breezeT * r.wLeafW + r.wLeafPh);
  }
  const bend = Math.sqrt(sx * sx + sz * sz);
  dummy.position.set(r.x + r.bx, r.yLift, r.z + r.bz);   // yLift = depth slab; +wind blow-away
  if (bend > 1e-4) {
    tmpAxis.set(sz / bend, 0, -sx / bend);       // tilt toward (sx, sz)
    tmpQ.setFromAxisAngle(tmpAxis, bend);
    dummy.quaternion.copy(tmpQ).multiply(r.restQ);
  } else {
    dummy.quaternion.copy(r.restQ);
  }
  if (leaf) {                                        // stem twist (foliage flutter)
    leafQ.setFromAxisAngle(UP, leaf);
    dummy.quaternion.multiply(leafQ);
  }
  if (r.btumble) {                                   // chaotic 3D tumble as it blows away
    tumbleAxis.set(r.tax, r.tay, r.taz);
    yawQ.setFromAxisAngle(tumbleAxis, r.btumble);
    dummy.quaternion.multiply(yawQ);
  }
  dummy.scale.setScalar(Math.max(1e-4, r.sc * r.bloomScale * r.bsc));
  dummy.updateMatrix();
  r.mesh.setMatrixAt(r.instanceId, dummy.matrix);
}

// The breeze only has to run while the title is actually on screen. Polled a
// few times a second rather than per frame (a computed-style read per frame
// would cost more than the wind itself).
let breezeShown = BREEZE_ON;
function pollBreezeVisible() {
  if (!BREEZE_ON) { breezeShown = false; return; }
  if (document.hidden || blownAway) { breezeShown = false; return; }
  const cs = getComputedStyle(banner);
  if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') {
    breezeShown = false; return;
  }
  const b = banner.getBoundingClientRect();
  breezeShown = b.bottom > 0 && b.top < window.innerHeight && b.width > 0;
  if (breezeShown) startLoop();
}
if (BREEZE_ON) {
  setInterval(pollBreezeVisible, 300);
  document.addEventListener('visibilitychange', pollBreezeVisible);
}

let lastRenderAt = -1;
function tick() {
  // Use performance.now(), not the rAF timestamp: under headless virtual time
  // the rAF argument lags far behind the actual (virtual) clock.
  const now = performance.now() / 1000;
  const frameDt = Math.min(MAX_FRAME_DT, Math.max(1e-4, now - lastT));
  lastT = now;
  lastRenderAt = now;

  let anyMatrix = false;

  // ---- ambient breeze gain ----
  // Advanced BEFORE the matrices are written so every flower touched this frame
  // (by the bloom loop, by the physics loop, or by the breeze pass at the end)
  // samples the same instant of the gust wave. The wind is silent while the
  // word is growing, wilting or blowing away — those animations own the
  // transform outright — and picks up over BREEZE_RISE once the word has
  // settled, so the bloom still lands on a still title.
  const breezeWanted = BREEZE_ON && breezeShown && mode === 'idle' && bloomDone && !blownAway;
  if (breezeWanted) {
    breezeT += frameDt;
    breezeK = Math.min(1, breezeK + frameDt / BREEZE_RISE);
  } else if (breezeK > 0) {
    breezeT += frameDt;
    breezeK = Math.max(0, breezeK - frameDt / 0.35);   // fade out quickly
  }

  // ---- title animation: bloom in / retract into ground / blow away ----
  if (mode !== 'idle') {
    if (animT0 < 0) animT0 = now;
    const clk = now - animT0;
    let allDone = true;
    if (mode === 'bloom') {
      for (let i = 0; i < flowers.length; i++) {
        const r = flowers[i];
        const t = (clk - r.bloomStart) / BLOOM_DUR;
        if (t < 1) allDone = false;
        const e = t <= 0 ? 0 : t >= 1 ? 1 : easeOutBack(t);
        if (e !== r.bloomScale) { r.bloomScale = e; updateFlowerMatrix(r); }
      }
      if (clk >= BLOOM_TOTAL) { allDone = true; for (const r of flowers) if (r.bloomScale !== 1) { r.bloomScale = 1; updateFlowerMatrix(r); } }
    } else if (mode === 'retract') {
      for (let i = 0; i < flowers.length; i++) {
        const r = flowers[i];
        const t = (clk - (1 - r.rank) * RETRACT_STAGGER) / RETRACT_DUR;   // last-bloomed wilt first
        if (t < 1) allDone = false;
        r.bloomScale = t <= 0 ? 1 : t >= 1 ? 0 : (1 - easeInCubic(t));
        updateFlowerMatrix(r);
      }
    } else if (mode === 'blow') {
      for (let i = 0; i < flowers.length; i++) {
        const r = flowers[i];
        const t = (clk - r.blowStart) / BLOW_DUR;
        if (t < 1) allDone = false;
        const p = t <= 0 ? 0 : t >= 1 ? 1 : t;
        const ep = p * p;                          // the wind grabs, then flings it out of frame
        r.bx = ep * r.blowVX;                       // rightward, along this flower's own angle
        r.bz = ep * r.blowVZ;                       // scattered up/down across the wind
        r.btumble = p * r.blowTumble;               // tumbling end-over-end as it goes
        updateFlowerMatrix(r);                      // NO shrink — it flies out at full size
      }
    }
    anyMatrix = true;
    drawShadows();
    if (allDone) {
      if (mode === 'bloom') bloomDone = true;
      mode = 'idle';
      shadowsDrawnFinal = false;
      const cb = animCb; animCb = null;
      if (cb) cb();
    }
  } else if (!shadowsDrawnFinal) {
    drawShadows();
    shadowsDrawnFinal = true;
  }

  // ---- hand state ----
  const handFresh = hand.active && (now - hand.lastMove) < 0.09;
  const hvx = handFresh ? hand.vxs : 0;
  const hvz = handFresh ? hand.vzs : 0;
  const speed = Math.hypot(hvx, hvz);
  // unit travel direction of the hand (zero vector when dwelling)
  const ux = speed > 1e-3 ? hvx / speed : 0;
  const uz = speed > 1e-3 ? hvz / speed : 0;
  // Quasi-static channel amplitudes ride the shared brush curve, and the push
  // additionally carries the small low-speed PARTING term: a creeping hand
  // gently parts the flowers it passes (slight, but never zero — a moving
  // hand occupies space), while only a quick hand actually shoves them. The
  // drag (follow) stays on the brush curve alone so a slow creep never tows
  // flowers along.
  const handResp = brushResponse(speed);
  const tGain = hand.isTouch ? TOUCH_GAIN : 1;          // finger hits harder
  const reachX = hand.isTouch ? TOUCH_REACH : 0;        // and reaches further
  const pushAmp = (PUSH_MAX * handResp + PUSH_LOW * partResponse(speed)) * tGain;
  const dragAmp = DRAG_MAX * handResp * tGain;

  // ---- swept-path impulse channel ----
  // The hand's travel since the last physics tick is the POLYLINE of real
  // pointer sub-samples (pathBuf). Every live flower is tested against every
  // sub-segment, so even a one-frame swipe across the whole word strikes the
  // full corridor it swept — nothing between two samples is aliased past.
  // Each sub-segment's speed comes from its own event-time delta, and long
  // segments are subdivided to SEG_MAX_LEN so the impulse a flower collects
  // approximates the same line integral regardless of input sampling density.
  strikeSegs.length = 0;
  if (pathBuf.length) {
    for (let i = 0; i < pathBuf.length; i++) {
      const s = pathBuf[i];
      const segSpeed = Math.min(KICK_MAX_SPEED, s.len / s.dt);
      // whip-crack memory: while decelerating into a stop the corridor is
      // still struck at close to the peak speed the gesture just reached.
      // The carry follows the ATTACK-SMOOTHED speed so a single mistimed
      // sample cannot arm it (per-segment kicks below still use segSpeed
      // directly — a genuine fast swipe strikes from its very first event).
      hand.vSm += (segSpeed - hand.vSm) * (1 - Math.exp(-s.dt / 0.025));
      hand.peakV = Math.max(hand.vSm, hand.peakV * Math.exp(-s.dt / PEAK_TAU));
      // smoothed along-track acceleration: a hand ACCELERATING hard hits
      // harder. The memory is EVENT-time based (τ = ACC_TAU) — the old
      // fixed 0.8/0.2 per-sample blend made the window depend on the mouse's
      // report rate (a 1000 Hz device got a noisy ~5 ms window). Note prevV
      // starts at 0 per gesture, which is CORRECT for a start from a dead
      // stop: the first measured segment speeds ARE the real ramp (a hand
      // cannot be fast 8 ms after rest), so accS resolves gentle vs moderate
      // vs hard onsets from the first events; a pointer ENTERING the window
      // already at speed reads as a hard onset, which is what it is.
      const acc = (segSpeed - hand.prevV) / Math.max(s.dt, 0.004);
      hand.accS += (acc - hand.accS) * (1 - Math.exp(-s.dt / ACC_TAU));
      hand.prevV = segSpeed;
      const effSpeed = Math.min(
        KICK_MAX_SPEED, Math.max(segSpeed, PEAK_CARRY * hand.peakV));
      const accBoost =
        1 + Math.min(ACC_BOOST_MAX, Math.max(0, hand.accS) / ACC_REF);
      // impulse density per unit of swept path — NOT multiplied by dt, so a
      // one-frame pass and a forty-frame pass deposit the same total kick.
      // Scaled by the ONE shared brush curve only: a creep whispers, every
      // step up in speed lands a clearly harder knock, a whip saturates.
      const kick = KICK_GAIN * brushResponse(effSpeed) * accBoost *
        (hand.isTouch ? TOUCH_GAIN : 1);
      if (!(kick > 1e-4) || !Number.isFinite(kick)) continue;
      const pieces = Math.min(80, Math.max(1, Math.ceil(s.len / SEG_MAX_LEN)));
      if (pieces === 1) {
        s.kick = kick;
        s.spd = effSpeed;
        strikeSegs.push(s);
      } else {
        const pl = s.len / pieces;
        for (let p = 0; p < pieces && strikeSegs.length < 400; p++) {
          strikeSegs.push({
            x0: s.x0 + s.ux * pl * p, z0: s.z0 + s.uz * pl * p,
            ux: s.ux, uz: s.uz, len: pl, dt: s.dt / pieces, kick, spd: effSpeed,
          });
        }
      }
    }
    pathBuf.length = 0;
  } else if (handFresh) {
    hand.peakV *= Math.exp(-frameDt / PEAK_TAU);   // paused mid-gesture
  } else {
    hand.prevV = 0; hand.peakV = 0; hand.accS = 0; hand.vSm = 0;
  }
  // A hand that keeps moving holds flowers parted; once it rests for a moment
  // the flowers ease back up (and the loop can eventually stop).
  const handOn = hand.active && (now - hand.lastMove) < 1.2;

  // ---- spring physics for live flowers ----
  if (PETALS_ON) struckN = 0;               // candidates that shed this frame
  if (liveSet.size) {
    for (const r of liveSet) {
      let eDv = 0, eux = 0, euz = 0, espd = 0;   // strongest strike on this flower
      let tx = 0, tz = 0;
      if (handOn) {
        const dx = r.x - hand.x, dz = r.z - hand.z;
        const d = Math.hypot(dx, dz);
        const rrP = r.reach + reachX;
        if (d < rrP) {
          const w = 1 - d / rrP;
          const fall = w * Math.sqrt(w);
          // (1) quasi-static push — proximity-proportional lean away from the
          // hand + gentle drag along its travel, scaled by the brush curve
          // R(hand speed) plus the low-speed parting floor: a creeping hand
          // parts the stems it passes slightly (present, never zero), while a
          // quick hand shoves a moving bow-wave of flowers aside as it travels.
          let px, pz;
          if (d > 1e-4) { px = dx / d; pz = dz / d; }
          else if (speed > 1e-3) { px = ux; pz = uz; }
          else { px = 1; pz = 0; }
          const fx = px * pushAmp + ux * dragAmp;
          const fz = pz * pushAmp + uz * dragAmp;
          const fl = Math.hypot(fx, fz);
          if (fl > 1e-5) {
            const amp = Math.min(1.25, fl) * fall * r.maxBend;
            tx = (fx / fl) * amp;
            tz = (fz / fl) * amp;
          }
        }
      }
      // (2) swept-path velocity impulse — the moving hand STRIKES every plant
      // within reach of the polyline it swept since the last tick; the added
      // angular velocity makes them whip and recoil on their own. Deposited
      // per unit of swept path (each piece capped at the chord through the
      // reach disc), so a full pass delivers the same total kick regardless
      // of how many frames or events it spanned: no dwell dilution, no
      // double-counting, no aliasing past flowers between samples.
      for (let si = 0; si < strikeSegs.length; si++) {
        const s = strikeSegs[si];
        const rx = r.x - s.x0, rz = r.z - s.z0;
        let tSeg = rx * s.ux + rz * s.uz;            // closest point on piece
        if (tSeg < 0) tSeg = 0; else if (tSeg > s.len) tSeg = s.len;
        const cx = rx - s.ux * tSeg, cz = rz - s.uz * tSeg;
        const dSeg = Math.hypot(cx, cz);
        const rrS = r.reach + reachX;
        if (dSeg < rrS) {
          const wS = 1 - dSeg / rrS;
          // strike falloff is FLATTER than the push falloff (near-linear in w
          // with a floor, vs w^1.5): a fast strike entrains air and brushes
          // the whole corridor it sweeps, so even rim flowers get a reliable
          // (if small) knock. The floor is spatially continuous because the
          // chord factor below already takes dv to zero at the disc edge.
          const fallS = 0.35 + 0.65 * wS;
          const chord = 2 * Math.sqrt(rrS * rrS - dSeg * dSeg);
          const dv = s.kick * fallS * Math.min(s.len, chord);
          r.vx += s.ux * dv;
          r.vz += s.uz * dv;
          if (dv > eDv) { eDv = dv; eux = s.ux; euz = s.uz; espd = s.spd; }
        }
      }
      // record a fast-struck flower as a shed candidate (chosen globally below)
      if (PETALS_ON && mode === 'idle' && bloomDone && espd >= PETAL_SPEED_MIN) {
        struckR[struckN] = r; struckUx[struckN] = eux; struckUz[struckN] = euz; struckN++;
      }
      // damped harmonic oscillator toward (tx, tz), integrated in substeps so
      // behaviour is framerate-independent
      const w0 = r.omega;
      let remaining = frameDt;
      while (remaining > 1e-6) {
        const h = Math.min(SUB_DT, remaining);
        remaining -= h;
        // energy-adaptive damping: low-velocity (quasi-static) motion is
        // heavily damped, so slow-hand follow ends in a gentle ease-back with
        // little overshoot — while a high-velocity strike rings almost freely
        // (multi-sway recoil) and only regains damping as the energy decays.
        // Also kills the imperceptible sub-degree tail so the loop can stop.
        const vm = Math.hypot(r.vx, r.vz);
        const z0 = r.zeta + 0.34 / (1 + (vm / 1.5) * (vm / 1.5));
        r.vx += (w0 * w0 * (tx - r.sx) - 2 * z0 * w0 * r.vx) * h;
        r.vz += (w0 * w0 * (tz - r.sz) - 2 * z0 * w0 * r.vz) * h;
        r.sx += r.vx * h;
        r.sz += r.vz * h;
      }
      // clamp angular velocity — extreme flicks stay energetic, never NaN
      const vMag = Math.hypot(r.vx, r.vz);
      if (vMag > VEL_CLAMP) {
        const k = VEL_CLAMP / vMag;
        r.vx *= k; r.vz *= k;
      }
      // never fold past ~86 deg (a plant cannot bend through the ground)
      const mag = Math.hypot(r.sx, r.sz);
      if (mag > 1.5) {
        const k = 1.5 / mag;
        r.sx *= k; r.sz *= k; r.vx *= 0.5; r.vz *= 0.5;
      }

      const still =
        tx === 0 && tz === 0 &&
        Math.abs(r.sx) < 0.0015 && Math.abs(r.sz) < 0.0015 &&
        Math.abs(r.vx) < 0.003 && Math.abs(r.vz) < 0.003;
      if (still) {
        r.sx = 0; r.sz = 0; r.vx = 0; r.vz = 0;
        updateFlowerMatrix(r);
        liveSet.delete(r);
      } else {
        updateFlowerMatrix(r);
      }
      anyMatrix = true;
    }
  }

  // ---- ambient breeze pass ----
  // Every flower the hand is NOT currently simulating still has to be re-posed,
  // because the gust wave has moved on. (The liveSet flowers were re-posed just
  // above and picked up the same breeze offset there — updateFlowerMatrix reads
  // the shared clock.) This is the only per-frame cost the wind adds: one
  // matrix compose per flower, no extra shadow redraw and no physics.
  if (breezeK > 0 && mode === 'idle') {
    const live = liveSet.size;
    for (let i = 0; i < flowers.length; i++) {
      const r = flowers[i];
      if (live && liveSet.has(r)) continue;
      updateFlowerMatrix(r);
    }
    anyMatrix = true;
  }

  if (anyMatrix) {
    for (const m of speciesMeshes) m.instanceMatrix.needsUpdate = true;
  }

  // Sparse shedding: however many flowers were struck hard this frame, at most
  // ONE sheds, and only once every PETAL_INTERVAL — a whip just trickles a few
  // petals from random flowers, never a spray. Dropped 1 (usually) or 2 by the
  // chosen flower's head, in that flower's own petal shape + colour.
  if (PETALS_ON && struckN && now >= gPetalNext && rng() < PETAL_EMIT_PROB) {
    const k = (rng() * struckN) | 0;
    const r = struckR[k];
    const sys = PSYS[r.sp];
    if (sys && sys.count < PETAL_CAP - 3) {
      const hy = r.headTop * r.sc;
      const hx = r.x + r.sx * hy * 0.5;
      const hz = r.z + r.sz * hy * 0.5;
      const n = rng() < 0.55 ? 2 : (rng() < 0.6 ? 3 : 1);
      for (let e = 0; e < n; e++) emitPetal(sys, hx, hy, hz, struckUx[k], struckUz[k], r.sc, r.petalColor);
      gPetalNext = now + PETAL_INTERVAL;
    }
  }
  if (PETALS_ON) updatePetals(frameDt);   // advance/fade the shed petals
  if (breezeK > 0) updateDrift(frameDt);  // advance the wisps adrift over the bed
  updateSun(breezeT);                     // breathing sunlight (livinglight)
  updateDapple(breezeT);                  // drifting cloud shadow (livinglight)

  renderer.render(scene, camera);
  renderQueued = false;

  // The breeze holds the loop open while the title is on screen (it is the one
  // thing here that is never "at rest"). Everything else about the stop
  // condition is unchanged, so with the breeze off — Reduce Motion, ?breeze=off,
  // a hidden/blown-away title, a backgrounded tab — the engine still settles to
  // 0% CPU exactly as before.
  const idle = mode === 'idle' && bloomDone && liveSet.size === 0 && petalCount === 0 && !renderQueued &&
               breezeK === 0 && !(BREEZE_ON && breezeShown && !blownAway) &&
               (!hand.active || now - hand.lastMove > 0.3);
  if (idle) {
    running = false;            // full stop: no rAF until the pointer moves
    cancelAnimationFrame(rafId);
    console.log('[gardens] settled — render loop stopped');
    return;
  }
  running = true;
  cancelAnimationFrame(rafId);  // tick may be invoked by rAF or a timer
  rafId = requestAnimationFrame(tick);
}

// ---------------------------------------------------------------------------
// Go
// ---------------------------------------------------------------------------
window.addEventListener('resize', resize);
resize();
startLoop();

// Safety driver for the bloom phase: headless/virtual-time environments starve
// requestAnimationFrame, but honour setTimeout. If rAF has not rendered
// recently, step the simulation from a timer. On real browsers rAF keeps
// lastRenderAt fresh, so these are no-ops.
for (let ms = 50; ms <= (BLOOM_TOTAL + 0.4) * 1000; ms += 100) {
  setTimeout(() => {
    if (bloomDone && !running) return;
    const now = performance.now() / 1000;
    if (now - lastRenderAt > 0.045) tick();
  }, ms);
}

console.log(`[gardens] ${flowers.length} flowers planted`);

// Debug/testing handle (tiny, harmless in production; used by headless
// verification to inspect physics state without patching the module).
window.__gardens = {
  flowers, hand,
  isRunning: () => running,
  liveCount: () => liveSet.size,
  tickNow: () => tick(),
  // ambient-breeze introspection (read-only; used by headless verification to
  // confirm the gust actually travels left→right instead of eyeballing pixels)
  breeze: () => ({
    on: BREEZE_ON, shown: breezeShown, k: breezeK, t: breezeT,
    x0: breezeX0, w: breezeW, period: GUST_PERIOD, amp: GUST_AMP, blownAway,
  }),
  // live handles on the three lights, so a grading sweep can be driven from the
  // page instead of by editing this file and reloading between every candidate
  lights: { hemi: hemi, key: key, fill: fill },
  renderer,
  grade: () => ({ name: GRADE.name, keyI: +key.intensity.toFixed(4),
                  keyColor: '#' + key.color.getHexString(),
                  keyPos: key.position.toArray().map((v) => +v.toFixed(3)),
                  dapple: dapEl ? dapEl.style.transform : null }),
  drift: () => drifters.filter(Boolean).map((d) => ({
    sp: d.sp, x: +d.x.toFixed(3), z: +d.z.toFixed(3), size: +d.size.toFixed(3),
    vx: +d.vx.toFixed(3), gust: +d.gust.toFixed(3),
  })),
};

// External gust hook — lets a page drive the whole bed from a gesture that
// happens OFF the flowers (e.g. a full-page swipe). A gust adds angular
// velocity to every plant along (dirX, dirZ), scaled by `strength` (~0..1.4),
// so the meadow leans together and springs back on its own — harder for a
// harder swipe — exactly like the swept-path strike, minus the pointer. The
// per-flower jitter keeps it from moving as one rigid sheet. Additive and
// inert unless something calls it, so it is safe on every page that loads the
// title. dirX/dirZ are in the ground plane; screen-vertical ≈ world Z here.
// Optional xMin/xMax (world-x) and zMin/zMax (world-z) restrict the gust to a
// rectangle of the bed — so a picture brushing over only PART of the title
// stirs only the flowers actually beneath it.
window.gardensStudioGust = function (dirX, dirZ, strength, xMin, xMax, zMin, zMax) {
  const s = Math.max(0, Math.min(1.4, strength || 0));
  if (!(s > 1e-3) || !flowers.length) return;
  const dl = Math.hypot(dirX, dirZ) || 1;
  const nx = dirX / dl, nz = dirZ / dl;
  const KICK = 12 * s;                         // rad/s of angular velocity at full strength
  const clipX = (typeof xMin === 'number' && typeof xMax === 'number');
  const clipZ = (typeof zMin === 'number' && typeof zMax === 'number');
  for (const r of flowers) {
    if (clipX && (r.x < xMin || r.x > xMax)) continue;
    if (clipZ && (r.z < zMin || r.z > zMax)) continue;
    const jitter = 0.68 + Math.random() * 0.6;
    r.vx += nx * KICK * jitter;
    r.vz += nz * KICK * jitter;
    liveSet.add(r);
  }
  hand.lastMove = performance.now() / 1000;    // keep the loop awake
  startLoop();
};

// ---------------------------------------------------------------------------
// Title transition API — drives the home/subpage flower titles for wind.html.
// ---------------------------------------------------------------------------
// Re-plant the title with a new word's layout, framed to fit, at scale 0
// (ready to grow). Pair with bloomIn().
function replant(list, frame) {
  clearFlowers();
  if (frame && typeof frame.halfW === 'number') HALF_W = frame.halfW;
  buildFlowers(list);
  buildGrid();
  resize();                                    // reframe camera + shadow canvas
  for (const r of flowers) { r.bloomScale = 0; r.bx = 0; r.bz = 0; r.btumble = 0; r.bsc = 1; }
  mode = 'idle'; bloomDone = true; animT0 = -1; animCb = null;
  blownAway = false; breezeK = 0;               // fresh word: the wind restarts with it
  driftRescatter();                            // and a freshly scattered sky
  drawShadows(); requestRender();
}
// Grow the current word out of the ground.
function bloomIn(cb) { bloomDone = false; blownAway = false; mode = 'bloom'; animT0 = -1; animCb = cb || null; pollBreezeVisible(); startLoop(); }
// Pull the current word back down into the ground.
function retract(cb) { mode = 'retract'; animT0 = -1; animCb = cb || null; liveSet.clear(); startLoop(); }
// Let the wind carry the current word off to the right — leftmost flowers
// first, each on its own irregular angle, scattered up/down but always exiting
// the right edge at full size, tumbling as it goes.
function blowAway(cb) {
  let mnx = Infinity, mxx = -Infinity;
  for (const r of flowers) { if (r.x < mnx) mnx = r.x; if (r.x > mxx) mxx = r.x; }
  const span = Math.max(1, mxx - mnx);
  for (const r of flowers) {
    const t = (r.x - mnx) / span;              // left of the word catches the wind first
    const ang = (rng() - 0.5) * 1.2;           // ±0.6 rad (~±34°): fanned, irregular angles
    const dist = HALF_W * 3 + 30 + rng() * 45; // well past the right edge, with varied speed
    r.blowStart = t * BLOW_STAGGER + rng() * 0.06;
    r.blowVX = Math.cos(ang) * dist;           // always rightward
    r.blowVZ = Math.sin(ang) * dist * 0.6;     // scatter across the wind (up/down)
    // a random 3D axis + a big spin: every flower cartwheels its own way
    var tax = rng() - 0.5, tay = rng() - 0.5, taz = rng() - 0.5;
    var tl = Math.hypot(tax, tay, taz) || 1;
    r.tax = tax / tl; r.tay = tay / tl; r.taz = taz / tl;
    r.blowTumble = Math.PI * (3 + rng() * 7) * (rng() < 0.5 ? -1 : 1);   // ~1.5–5 spins, either way
    r.bsc = 1;
  }
  mode = 'blow'; animT0 = -1; animCb = cb || null; liveSet.clear();
  blownAway = true;                    // the word leaves frame: ambient wind off
  startLoop();
}
function setFrame(frame) { if (frame && typeof frame.halfW === 'number') HALF_W = frame.halfW; resize(); }

window.Garden = { replant, bloomIn, retract, blowAway, setFrame, isReady: true };
window.dispatchEvent(new Event('garden-ready'));

// Dev/testing hook: ?demo=swipe&type=<name> replays a scripted hand gesture by
// dispatching synthetic PointerEvents (the same code path as a live mouse —
// synthetic events carry no coalesced sub-events, which exercises the
// swept-segment fallback: events arrive with realistic spacing and the
// segment strikes must cover the gaps between samples).
//
// Types (see TYPES below): slow-short, slow-long, fast-flick,
// fast-long-outside, veryfast-diag-outside, whip-outside, vertical,
// cross-exit, multi. Legacy aliases: ?demo=sweep[&speed=fast][&len=long],
// ?demo=whip.
//
// A type is a list of STROKES; a stroke is a continuous sequence of pointer
// samples {t ms, fx, fy} in canvas fractions. Strokes are separated by silent
// gaps > GESTURE_GAP — exactly like a user whose pointer left the window and
// re-entered somewhere else — and the engine must NOT strike along the
// imaginary chord between strokes. Outside-origin swipes model reality: the
// browser only delivers events once the pointer is inside the window, already
// AT SPEED, while the last known position (the `stale` stroke) is far away.
//
// After settling, logs a metrics line and stores a machine-readable report in
// window.__gardens.demo.report, including CORRIDOR COVERAGE: expected = every
// flower whose base lies within strike reach (minus a small rim margin) of a
// main stroke's polyline; covered = those that measurably moved.
{
  const q = new URLSearchParams(location.search);
  const demoKind = q.get('demo');
  let typeName = null;
  if (demoKind === 'swipe') typeName = q.get('type') || 'fast-long-outside';
  else if (demoKind === 'whip') typeName = 'whip-outside';
  else if (demoKind === 'sweep') {
    typeName = q.get('speed') === 'fast'
      ? (q.get('len') === 'long' ? 'fast-long-outside' : 'fast-flick')
      : (q.get('len') === 'long' ? 'slow-long' : 'slow-short');
  }

  const line = (t0, dur, steps, fx0, fy0, fx1, fy1, ease) => {
    const evs = [];
    for (let i = 0; i <= steps; i++) {
      const u = steps ? i / steps : 0;
      const f = ease ? ease(u) : u;
      evs.push({ t: t0 + dur * u, fx: fx0 + (fx1 - fx0) * f, fy: fy0 + (fy1 - fy0) * f });
    }
    return evs;
  };
  const acc2 = (u) => u * u;      // f = u² -> speed ramps linearly (whip)

  const TYPES = {
    // 1. slow short drag, inside the word (~2.1 u/s)
    'slow-short':   [{ main: true, evs: line(0, 2600, 32, 0.30, 0.38, 0.42, 0.62) }],
    // 2. slow long drag across the whole word (~4.5 u/s)
    'slow-long':    [{ main: true, evs: line(0, 9000, 100, 0.03, 0.55, 0.97, 0.45) }],
    // 2b. medium drag over the same path (~12 u/s) — the slow/fast gradient
    'medium-long':  [{ main: true, evs: line(0, 3400, 60, 0.03, 0.55, 0.97, 0.45) }],
    // 3. fast short flick, inside (~87 u/s)
    'fast-flick':   [{ main: true, evs: line(0, 100, 8, 0.35, 0.58, 0.55, 0.40) }],
    // 4. fast LONG swipe across the whole word, originating OUTSIDE the left
    //    bound and already at full speed on entry (~111 u/s); the stale stroke
    //    parks the previous hand position far away first
    'fast-long-outside': [
      { stale: true, evs: line(0, 0, 0, 0.88, 0.15, 0.88, 0.15) },
      { main: true, evs: line(700, 380, 24, 0.005, 0.56, 0.995, 0.44) },
    ],
    // 5. very fast swipe rapidly ACCELERATING from an outside corner,
    //    diagonal across everything (peaks ~280 u/s — would have been
    //    misclassified as a teleport by the old speed-based guard)
    'veryfast-diag-outside': [
      { stale: true, evs: line(0, 0, 0, 0.50, 0.90, 0.50, 0.90) },
      { main: true, evs: line(700, 300, 20, 0.01, 0.86, 0.99, 0.14, acc2) },
    ],
    // 6. crack-the-whip starting outside: accelerate hard, then stop DEAD
    'whip-outside': [
      { stale: true, evs: line(0, 0, 0, 0.90, 0.80, 0.90, 0.80) },
      { main: true, evs: line(700, 560, 22, 0.01, 0.60, 0.72, 0.45, acc2) },
    ],
    // 7. fast vertical swipe through the word (~57 u/s; x through "GARDENS" —
    //    fx 0.50 is the empty gap between the two words)
    'vertical':     [{ main: true, evs: line(0, 140, 10, 0.30, 0.03, 0.30, 0.97) }],
    // 8. enters one side, crosses, EXITS the far side; later a fresh unrelated
    //    stroke elsewhere (verifies no strike along the exit->re-entry chord)
    'cross-exit': [
      { main: true, evs: line(0, 340, 22, 0.005, 0.52, 0.995, 0.50) },
      { evs: line(1400, 300, 6, 0.10, 0.50, 0.16, 0.55) },
    ],
    // 9. several rapid consecutive swipes (continuous zig-zag)
    'multi': [{ main: true, evs: [
      ...line(0, 320, 20, 0.04, 0.50, 0.96, 0.58),
      ...line(340, 320, 20, 0.96, 0.58, 0.04, 0.66),
      ...line(680, 340, 20, 0.04, 0.66, 0.96, 0.42),
    ] }],
  };

  if (typeName && TYPES[typeName]) {
    const strokes = TYPES[typeName];
    const T0 = 3300;                          // after bloom completes
    const allEvs = [];
    for (const s of strokes) {
      s.pts = [];                             // ground-plane points actually hit
      for (const ev of s.evs) allEvs.push({ ...ev, stroke: s });
    }
    allEvs.sort((a, b) => a.t - b.t);
    const sweepEnd = T0 + allEvs[allEvs.length - 1].t;
    const finalAt = sweepEnd + 6500;          // settle window before reporting

    // per-flower peak tilt + peak angular speed over the whole run
    const peakTilt = new Float32Array(flowers.length);
    const peakVel = new Float32Array(flowers.length);
    const M = { peak: 0, postPeakTilt: 0, postPeakVel: 0, postEnergy: -1 };
    // "post" metrics measure only flowers the hand has already LEFT (farther
    // than any reach from its current position) — free recoil, not the
    // parted-and-held bed under a dwelling hand.
    let postPhase = false;
    setTimeout(() => { postPhase = true; }, sweepEnd + 40);
    const series = [];                        // ~90ms samples of post-pass tilt
    let lastSeriesAt = 0;
    const sample = () => {
      let mMax = 0, postMax = 0;
      for (let i = 0; i < flowers.length; i++) {
        const r = flowers[i];
        const m = Math.hypot(r.sx, r.sz);
        const v = Math.hypot(r.vx, r.vz);
        if (m > peakTilt[i]) peakTilt[i] = m;
        if (v > peakVel[i]) peakVel[i] = v;
        if (m > mMax) mMax = m;
        if (!postPhase) continue;
        if (hand.active && Math.hypot(r.x - hand.x, r.z - hand.z) < 2.6) continue;
        if (m > postMax) postMax = m;
        if (m > M.postPeakTilt) M.postPeakTilt = m;
        if (v > M.postPeakVel) M.postPeakVel = v;
      }
      if (mMax > M.peak) M.peak = mMax;
      const nowMs = performance.now();
      if (postPhase && nowMs - lastSeriesAt > 88 && series.length < 40) {
        lastSeriesAt = nowMs;
        series.push(postMax.toFixed(2));
      }
    };
    setTimeout(() => {           // free-recoil spring energy shortly after pass
      let e = 0;
      for (const r of flowers) {
        if (hand.active && Math.hypot(r.x - hand.x, r.z - hand.z) < 2.6) continue;
        e += 0.5 * (r.vx * r.vx + r.vz * r.vz +
                    r.omega * r.omega * (r.sx * r.sx + r.sz * r.sz));
      }
      M.postEnergy = e;
    }, sweepEnd + 160);

    window.__gardens.demo = {
      type: typeName, T0,
      strokes: strokes.map((s) => ({ main: !!s.main, stale: !!s.stale, pts: s.pts })),
      peakTilt, peakVel, metrics: M, report: null, done: false,
    };

    const rect = () => canvas.getBoundingClientRect();
    for (const ev of allEvs) {
      setTimeout(() => {
        const r = rect();
        const x = r.left + r.width * ev.fx;
        const y = r.top + r.height * ev.fy;
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y }));
        ev.stroke.pts.push({ x: hand.x, z: hand.z, t: ev.t });
        // headless rAF is starved — step manually; a healthy rAF makes this a no-op
        if (performance.now() / 1000 - lastRenderAt > 0.012) tick();
        sample();
      }, T0 + ev.t);
    }
    // keep stepping through the recoil + settle phase so late screenshots and
    // the metrics capture the post-pass sway
    for (let ms = sweepEnd + 15; ms <= finalAt; ms += 30) {
      setTimeout(() => {
        if (running && performance.now() / 1000 - lastRenderAt > 0.025) tick();
        sample();
      }, ms);
    }

    setTimeout(() => {
      // ---- corridor coverage vs the main strokes' swept polyline ----
      // expected: base within strike reach of the polyline, minus a rim margin
      // (at the very rim the falloff is ~0 by design); covered: measurably moved.
      const MARGIN = 0.25, TILT_MIN = 0.04, VEL_MIN = 0.15;
      const mains = strokes.filter((s) => s.main && s.pts.length);
      let expected = 0, covered = 0, expectedFull = 0;
      const missed = [];
      for (let i = 0; i < flowers.length; i++) {
        const r = flowers[i];
        let dMin = Infinity;
        for (const s of mains) {
          const p = s.pts;
          if (p.length === 1) {
            dMin = Math.min(dMin, Math.hypot(r.x - p[0].x, r.z - p[0].z));
          }
          for (let j = 0; j + 1 < p.length; j++) {
            const ax = p[j].x, az = p[j].z;
            const bx = p[j + 1].x - ax, bz = p[j + 1].z - az;
            const bl = bx * bx + bz * bz;
            let t = bl > 0 ? ((r.x - ax) * bx + (r.z - az) * bz) / bl : 0;
            if (t < 0) t = 0; else if (t > 1) t = 1;
            const d = Math.hypot(r.x - (ax + bx * t), r.z - (az + bz * t));
            if (d < dMin) dMin = d;
          }
        }
        if (dMin < r.reach) expectedFull++;
        if (dMin < r.reach - MARGIN) {
          expected++;
          if (peakTilt[i] > TILT_MIN || peakVel[i] > VEL_MIN) covered++;
          else missed.push(i);
        }
      }
      let moved = 0, movedStrong = 0, minX = 1e9, maxX = -1e9;
      for (let i = 0; i < flowers.length; i++) {
        if (peakTilt[i] > 0.15) {
          moved++;
          if (flowers[i].x < minX) minX = flowers[i].x;
          if (flowers[i].x > maxX) maxX = flowers[i].x;
        }
        if (peakTilt[i] > 0.4) movedStrong++;
      }
      const span = moved ? (maxX - minX).toFixed(1) : '0';
      const coverage = expected ? (100 * covered) / expected : 100;
      const report = {
        type: typeName, expected, covered, expectedFull,
        coverage: +coverage.toFixed(1), missed,
        peakTilt: +M.peak.toFixed(3), postPeakTilt: +M.postPeakTilt.toFixed(3),
        postPeakVel: +M.postPeakVel.toFixed(2), postEnergy: +M.postEnergy.toFixed(3),
        moved, movedStrong, corridorSpanX: +span, settled: !running,
        series: series.slice(),
      };
      const lineTxt =
        `[gardens] swipe(${typeName}) coverage=${coverage.toFixed(1)}% ` +
        `(${covered}/${expected} in-path, ${expectedFull} at full reach) ` +
        `missed=[${missed.slice(0, 24).join(',')}] ` +
        `peakTilt=${M.peak.toFixed(3)}rad postPeakTilt=${M.postPeakTilt.toFixed(3)}rad ` +
        `postPeakVel=${M.postPeakVel.toFixed(2)}rad/s postEnergy=${M.postEnergy.toFixed(3)} ` +
        `moved=${moved}/${flowers.length} strong=${movedStrong} ` +
        `corridorSpanX=${span} settled=${!running} ` +
        `tiltSeries=[${series.join(',')}]`;
      console.log(lineTxt);
      const el = document.createElement('div');
      el.id = 'sweep-metrics';
      el.style.display = 'none';
      el.textContent = lineTxt;
      document.body.appendChild(el);
      window.__gardens.demo.report = report;
      window.__gardens.demo.done = true;
    }, finalAt + 100);
  }
}
