// Starlight engine — character models, the discipline scene and the dance library.
// Shared by character-viewer.html and starlight-game.html. Needs three.js r128.
// Everything is exposed on window.Starlight.
(function (global) {
'use strict';

// ════════════════════════════════════════════════════════════════
// PIPELINE
//
//   measurements ──► skeleton landmarks ──► SDF primitives
//        │                                       │
//        │                     surface nets (once per build)
//        │                                       │
//        │               skin weights from per-primitive distance
//        ▼                                       ▼
//   THREE.Bone hierarchy ◄──────── THREE.SkinnedMesh (GPU skinning)
//
// Every primitive belongs to one bone (the torso loft blends several
// bones by height), so the same distances that shape the surface
// also decide how each vertex follows the skeleton. The rest pose is
// an A-pose (arms 45° from the body, legs slightly apart) so that
// arms and thighs don't fuse into the torso when blended.
//
// Coordinates: metres, Y up, character faces +Z, character's left = +X.
// ════════════════════════════════════════════════════════════════

// ── Presets ─────────────────────────────────────────────────────
// Circumferences in cm. All characters are adults.
// `outfit` is hair; `skin` the skin tone. `wardrobe` holds the garment layers (see
// CLOTHING LAYERS for the kinds and their settings) and `looks` the combinations
// worn, innermost first; `look` is the one a build starts in. Every look starts
// from the full underwear base layer, and the clothes go over it.
const PRESETS = {
  aya: {
    name: 'Aya', build: 'female', height: 172, legs: 1.02, shoulders: 38,
    bust: 86, underbust: 72, waist: 63, hip: 100.5,
    neck: 31, arm: 25, forearm: 22, wrist: 14.5,
    thigh: 52, knee: 34, calf: 33, ankle: 20.5, cup: 3, glutes: 1.32, head: 1.0,
    eye: 1.1, eyeHeight: -0.1, brow: 0.35, bridge: 0.81, hump: 0.2, tipTilt: -1, noseWidth: 0.92, lips: 0.81, mouth: 1.01, youth: 0.25, cheeks: 0.82,
    // Watchful composure: alert, level, still. Lids a touch lifted (eyes ahead of the
    // room), brows level, mouth corners exactly level; few eye movements, and she holds
    // her gaze; blinks slowly.
    expr: { browInner: -0.15, browOuter: 0.05, mouthL: 0.15, mouthR: 0.05, saccade: 0.12, contact: 0.8, blink: 0.6 },
    // Her versions of the moods (offsets from her resting expression; Open is the shared one).
    moods: {
      effort:    { browInner: 0.05, browFurrow: 0.6, lidUpper: -0.35, squint: 0.6, mouthL: -0.3, mouthR: -0.3, teeth: 0.9 },
      enjoyment: { browOuter: 0.1, lidUpper: 0.5, squint: 0.3, mouthL: 0.75, mouthR: 0.75, teeth: 0.7, mouthOpen: 0.05 },
    },
    skin: 0xe9c6a5,
    outfit: { hair: 0x1a120c, hairStyle: 'ponytail', scrunchie: 0xf4f2ee, bobbles: [0x0c0c0e] },
    wardrobe: {
      bra:    { kind: 'bra', name: 'Black bralette', color: 0x141418, style: 'bralette' },
      briefs: { kind: 'briefs', name: 'Black thong', color: 0x141418, rise: 0.25, riseBack: 1.0, back: 'thong', thong: 0.005 },
      bottom: { kind: 'bottom', name: 'Leggings', color: 0x18181e, legLen: 2.0, lowerTo: 'calf' },
      top:    { kind: 'top', name: 'Crop top', color: 0x1c1c22, from: 'underbust', sleeves: 0 },
      shoes:  { kind: 'shoes', name: 'Trainers', color: 0xf0f0f0 },
    },
    looks: { Underwear: ['bra', 'briefs'], Rehearsal: ['bra', 'briefs', 'bottom', 'top', 'shoes'] },
    look: 'Rehearsal',
  },
  rin: {
    name: 'Rin', build: 'female', height: 163, legs: 1.05, shoulders: 37,
    bust: 75.5, underbust: 68, waist: 62.5, hip: 87.5,
    neck: 26, arm: 23, forearm: 19, wrist: 13.5,
    thigh: 38, knee: 28, calf: 26, ankle: 19.5, cup: 2, glutes: 1.4, head: 1.04,
    eye: 1.15, brow: 0.65, nose: 1.38, hump: 0.2, tipTilt: 1, lips: 0.6, mouth: 0.8, mouthHeight: -0.35, youth: 0.7, cheeks: 0.7, jaw: 0.87, chin: 1.06,
    // Quiet preoccupation: the faintest concentration furrow, gaze a little lowered and
    // inward, eyes that move more than the rest of her face (frequent, wide, not
    // returning to anyone for long); corners of the mouth fractionally down.
    expr: { browFurrow: 0.35, browInner: 0.55, gazeY: -0.15, lidUpper: -0.2, mouthL: -0.05, mouthR: -0.08, saccade: 0.9, contact: 0.25, blink: 1.2 },
    // Her enjoyment: a closed-mouth smile, the furrow easing (Effort and Open are shared).
    moods: {
      enjoyment: { browOuter: 0.1, browFurrow: -0.1, squint: 0.45, mouthL: 0.75, mouthR: 0.75, teeth: 0 },
    },
    skin: 0xe9c6a5,
    outfit: { hair: 0x14100c, hairStyle: 'long' },
    wardrobe: {
      bra:    { kind: 'bra', name: 'White bra', color: 0xf0eee9, style: 'classic' },
      briefs: { kind: 'briefs', name: 'White cotton briefs', color: 0xf0eee9, rise: 0.5, side: 0.9, back: 'brief', backCurve: 1 },
      bottom: { kind: 'bottom', name: 'Shorts', color: 0x3b4f6e, legLen: 0.52 },
      top:    { kind: 'top', name: 'Hoodie', color: 0x9a9aa4, from: 'hip', sleeves: 2 },
      shoes:  { kind: 'shoes', name: 'Trainers', color: 0xe8e8e8 },
    },
    looks: { Underwear: ['bra', 'briefs'], Rehearsal: ['bra', 'briefs', 'bottom', 'top', 'shoes'] },
    look: 'Rehearsal',
  },
  kiko: {
    name: 'Kiko', build: 'female', height: 158, legs: 1.04, shoulders: 35,
    bust: 86, underbust: 60, waist: 64.5, hip: 93.5,
    neck: 26, arm: 30, forearm: 21, wrist: 14,
    thigh: 49.5, knee: 32.5, calf: 27.5, ankle: 20, cup: 4, glutes: 1.4, head: 1.1,
    eye: 1.3, eyeGap: 1.1, eyeHeight: -1, brow: 0.7, hump: -1, tipTilt: -1, noseWidth: 1.15, mouthHeight: -0.4, youth: 0.6, jaw: 0.87, chin: 1.05,
    // Asymmetric readiness: one corner of the mouth cocked higher (a quip in reserve),
    // eyes open and bright, brows lifted a little and one higher; quick eye movements
    // that keep snapping back to you (eye contact held a beat too long).
    expr: { mouthL: 0.6, mouthR: 0.25, lidUpper: 0.5, browInner: 0.2, browOuter: 0.25, browAsym: 0.2, saccade: 0.55, contact: 0.85, blink: 1.1 },
    // Her enjoyment: a full, open grin, eyes wide rather than crinkled (Effort and Open are shared).
    moods: {
      enjoyment: { browOuter: 0.1, lidUpper: 0.5, squint: 0, mouthL: 0.4, mouthR: 0.75, teeth: 1, mouthOpen: 0.2 },
    },
    skin: 0xe9c6a5,
    outfit: { hair: 0x120e08, hairStyle: 'buns', bobbles: [0x2c5fcf, 0xe86aa0], clips: [0xe86aa0, 0x2c5fcf] },
    wardrobe: {
      bra:    { kind: 'bra', name: 'Navy support bra', color: 0x1d2b4c, style: 'sports' },
      briefs: { kind: 'briefs', name: 'Navy hipster shorts', color: 0x1d2b4c, rise: 0.15, side: 0.55, back: 'brief', backCurve: 0.45 },
      bottom: { kind: 'bottom', name: 'Shorts', color: 0xe86aa0, legLen: 0.52 },
      skirt:  { kind: 'skirt', name: 'Skirt', color: 0x2c5fcf, above: 0.01, length: 0.18, flare: 0.025 },
      top:    { kind: 'top', name: 'Top', color: 0x1a7fe8, from: 'waist', sleeves: 2 },
      shoes:  { kind: 'shoes', name: 'Trainers', color: 0x3a7ae0 },
    },
    looks: { Underwear: ['bra', 'briefs'], Rehearsal: ['bra', 'briefs', 'bottom', 'skirt', 'top', 'shoes'] },
    look: 'Rehearsal',
  },
  kenji: {
    name: 'Kenji', build: 'male', height: 181.5, legs: 1.02, shoulders: 45,
    bust: 96, underbust: 90, waist: 80, hip: 94,
    neck: 38, arm: 32.5, forearm: 27, wrist: 17,
    thigh: 54, knee: 38, calf: 37, ankle: 23, glutes: 1.4, head: 1.0,
    eye: 1.14, eyeGap: 1.01, brow: 0.1, nose: 1.18, bridge: 1.5, hump: 0.35, lips: 0.85, mouth: 1.15,
    // Steady absorption: listening to something you can't hear. Gaze resting slightly
    // off to one side and up; a habitual tension round the eyes (lower lids raised,
    // upper a touch heavy, not a squint); mouth neither smiling nor serious.
    expr: { gazeX: 0.3, gazeY: 0.12, squint: 0.35, lidUpper: -0.15, browInner: 0.05, mouthL: 0.05, mouthR: 0.05, saccade: 0.25, contact: 0.6, blink: 0.9 },
    skin: 0xe9c6a5,
    outfit: { hair: 0x120e0a, hairStyle: 'short' },
    wardrobe: {
      briefs: { kind: 'briefs', name: 'Grey trunks', color: 0x3a3d44, rise: 0.5, leg: 0.1 },
      bottom: { kind: 'bottom', name: 'Trousers', color: 0x22252c, legLen: 2.0, lowerTo: 'ankle' },
      top:    { kind: 'top', name: 'Sweatshirt', color: 0x3a4250, from: 'hip', sleeves: 2 },
      shoes:  { kind: 'shoes', name: 'Shoes', color: 0x1a1a1a },
    },
    looks: { Underwear: ['briefs'], Rehearsal: ['briefs', 'bottom', 'top', 'shoes'] },
    look: 'Rehearsal',
  },
};
const ORDER = ['aya', 'rin', 'kiko', 'kenji'];
// Face shape, as multipliers of each build's base face (1 = unchanged) except brow
// hump, tipTilt, mouthHeight and eyeHeight (−1…1). A preset can set any of them; the rest take these defaults.
// eye: eye size; eyeGap: spacing between the eyes.
const FACE_DEFAULTS = { eye: 1, eyeGap: 1, nose: 1, bridge: 1, hump: 0, tipTilt: 0, noseWidth: 1, lips: 1, mouth: 1, mouthHeight: 0, eyeHeight: 0, youth: 0, jaw: 1, chin: 1, cheeks: 1, brow: 0 };
function faceParams(m) {
  const F = { ...FACE_DEFAULTS, jaw: m.build === 'male' ? 1.12 : 1 };
  for (const k of Object.keys(FACE_DEFAULTS)) if (m[k] != null) F[k] = m[k];
  return F;
}

const SLIDERS = [
  ['height', 'Height', 145, 195, 0.5, 'cm'],
  ['legs', 'Leg length', 0.92, 1.08, 0.01, '×'],
  ['shoulders', 'Shoulder width', 30, 50, 0.5, 'cm'],
  ['bust', 'Bust / chest', 70, 115, 0.5, 'cm'],
  ['underbust', 'Underbust', 60, 105, 0.5, 'cm'],
  ['cup', 'Cup size (UK)', 1, 8, 1, 'cup'],
  ['waist', 'Waist', 50, 100, 0.5, 'cm'],
  ['hip', 'Hip', 70, 120, 0.5, 'cm'],
  ['glutes', 'Glute shape', 0.6, 1.4, 0.01, '×'],
  ['thigh', 'Thigh', 38, 70, 0.5, 'cm'],
  ['knee', 'Knee', 28, 45, 0.5, 'cm'],
  ['calf', 'Calf', 26, 45, 0.5, 'cm'],
  ['ankle', 'Ankle', 17, 27, 0.5, 'cm'],
  ['neck', 'Neck', 26, 42, 0.5, 'cm'],
  ['arm', 'Upper arm', 20, 38, 0.5, 'cm'],
  ['forearm', 'Forearm', 18, 32, 0.5, 'cm'],
  ['wrist', 'Wrist', 12, 19, 0.5, 'cm'],
  ['head', 'Head size', 0.9, 1.1, 0.01, '×'],
];

const clone = o => JSON.parse(JSON.stringify(o));

// ── Small vector helpers (plain arrays for speed in the field loop) ──
const V = (x, y, z) => [x, y, z];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = a => Math.sqrt(dot(a, a));
const norm = a => mul(a, 1 / (len(a) || 1));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function smin(a, b, k) {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

// Ramanujan ellipse perimeter
const perim = (a, b) => Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));

// ════════════════════════════════════════════════════════════════
// SDF PRIMITIVES
// ════════════════════════════════════════════════════════════════

// Round cone (iq): sphere r1 at a, sphere r2 at b, tangent cone between.
function sdRoundCone(p, P) {
  const pa0 = p[0] - P.a[0], pa1 = p[1] - P.a[1], pa2 = p[2] - P.a[2];
  const ba = P.ba, l2 = P.l2, rr = P.r1 - P.r2, a2 = P.a2, il2 = 1 / l2;
  const y = pa0 * ba[0] + pa1 * ba[1] + pa2 * ba[2];
  const z = y - l2;
  const x0 = pa0 * l2 - ba[0] * y, x1 = pa1 * l2 - ba[1] * y, x2_ = pa2 * l2 - ba[2] * y;
  const x2 = x0 * x0 + x1 * x1 + x2_ * x2_;
  const y2 = y * y * l2, z2 = z * z * l2;
  const k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - P.r2;
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - P.r1;
  return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - P.r1;
}
function coneT(p, P) {
  return clamp(((p[0] - P.a[0]) * P.ba[0] + (p[1] - P.a[1]) * P.ba[1] + (p[2] - P.a[2]) * P.ba[2]) / P.l2, 0, 1);
}

// Oriented ellipsoid (iq's bound-corrected approximation).
function sdEllipsoid(p, P) {
  const d0 = p[0] - P.c[0], d1 = p[1] - P.c[1], d2 = p[2] - P.c[2];
  const q0 = (d0 * P.u[0] + d1 * P.u[1] + d2 * P.u[2]);
  const q1 = (d0 * P.v[0] + d1 * P.v[1] + d2 * P.v[2]);
  const q2 = (d0 * P.w[0] + d1 * P.w[1] + d2 * P.w[2]);
  const r = P.r;
  const k0 = Math.sqrt((q0 / r[0]) ** 2 + (q1 / r[1]) ** 2 + (q2 / r[2]) ** 2);
  const k1 = Math.sqrt((q0 / (r[0] * r[0])) ** 2 + (q1 / (r[1] * r[1])) ** 2 + (q2 / (r[2] * r[2])) ** 2);
  return k1 < 1e-9 ? -Math.min(r[0], r[1], r[2]) : k0 * (k0 - 1) / k1;
}

// Lofted torso: elliptical rings (half-width a, front depth bf, back depth bb,
// centre z zc) interpolated with monotone cubics along Y.
// The interpolated rings are baked into a lookup table (4 floats per row) so the
// field loop never evaluates the splines directly.
//
// The monotone cubic is smooth in slope but not in curvature: where a ring is a
// widest point (the hips) the curve bends hard on one side of it and barely on
// the other, and that jump in curvature shows as a shading line across the body.
// So the table is smoothed along Y with a Gaussian of width `smooth` (m), and the
// ring values are pre-corrected so the smoothed profile still passes through the
// measured rings.
const LOFT_ROWS = 1024;
function makeLoft(rings, smooth = 0) {
  const ys = rings.map(r => r.y);
  const KEYS = ['a', 'bf', 'bb', 'zc'];
  const y0 = ys[0], y1 = ys[ys.length - 1], dy = (y1 - y0) / (LOFT_ROWS - 1);
  const sample = vals => {
    const chans = KEYS.map((key, c) => monotoneCubic(ys, vals[c]));
    const lut = new Float32Array(LOFT_ROWS * 4);
    for (let i = 0; i < LOFT_ROWS; i++) for (let c = 0; c < 4; c++) lut[i * 4 + c] = chans[c](y0 + dy * i);
    return lut;
  };
  const blur = lut => {
    if (smooth <= 0) return lut;
    const r = Math.ceil(2.5 * smooth / dy), w = [];
    for (let k = -r; k <= r; k++) w.push(Math.exp(-0.5 * (k * dy / smooth) ** 2));
    const ws = w.reduce((s, v) => s + v, 0), out = new Float32Array(lut.length);
    for (let i = 0; i < LOFT_ROWS; i++) for (let c = 0; c < 4; c++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += w[k + r] * lut[clamp(i + k, 0, LOFT_ROWS - 1) * 4 + c];
      out[i * 4 + c] = s / ws;
    }
    return out;
  };
  const at = (lut, y, c) => { const f = (y - y0) / dy, i = Math.min(LOFT_ROWS - 2, Math.max(0, f | 0)), t = f - i; return lut[i * 4 + c] + (lut[i * 4 + 4 + c] - lut[i * 4 + c]) * t; };
  const want = KEYS.map(key => rings.map(r => r[key]));
  let vals = want.map(v => v.slice()), lut = blur(sample(vals));
  for (let it = 0; smooth > 0 && it < 4; it++) {
    vals = vals.map((v, c) => v.map((x, k) => x + want[c][k] - at(lut, ys[k], c)));
    lut = blur(sample(vals));
  }
  return { ys, y0, y1, lut, scale: (LOFT_ROWS - 1) / (y1 - y0) };
}
const _ring = [0, 0, 0, 0];
function loftRing(P, y, out = [0, 0, 0, 0]) {
  const f = (clamp(y, P.y0, P.y1) - P.y0) * P.scale;
  const i = Math.min(LOFT_ROWS - 2, f | 0), t = f - i, L = P.lut;
  for (let c = 0; c < 4; c++) out[c] = L[i * 4 + c] + (L[i * 4 + 4 + c] - L[i * 4 + c]) * t;
  return out;
}
function sdLoft(p, P) {
  loftRing(P, p[1], _ring);
  const a = _ring[0], bf = _ring[1], bb = _ring[2], zc = _ring[3];
  const x = p[0], z = p[2] - zc, b = z > 0 ? bf : bb;
  const k0 = Math.sqrt((x / a) ** 2 + (z / b) ** 2);
  const k1 = Math.sqrt((x / (a * a)) ** 2 + (z / (b * b)) ** 2);
  const d2 = k1 < 1e-9 ? -Math.min(a, b) : k0 * (k0 - 1) / k1;
  const dy = p[1] < P.y0 ? P.y0 - p[1] : p[1] > P.y1 ? p[1] - P.y1 : 0;
  if (dy === 0) return d2;
  return d2 > 0 ? Math.sqrt(d2 * d2 + dy * dy) : dy;
}

// Fritsch–Carlson monotone cubic interpolant — no overshoot between rings.
function monotoneCubic(xs, ys) {
  const n = xs.length, dx = [], m = [], t = new Array(n);
  for (let i = 0; i < n - 1; i++) { dx[i] = xs[i + 1] - xs[i]; m[i] = (ys[i + 1] - ys[i]) / dx[i]; }
  t[0] = m[0]; t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : 3 * (dx[i - 1] + dx[i]) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i]);
  return x => {
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]) i++;
    const h = dx[i], s = (x - xs[i]) / h, s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * ys[i] + (s3 - 2 * s2 + s) * h * t[i] + (-2 * s3 + 3 * s2) * ys[i + 1] + (s3 - s2) * h * t[i + 1];
  };
}

function cone(a, b, r1, r2) {
  const ba = sub(b, a), l2 = dot(ba, ba);
  return { type: 'cone', a, b, r1, r2, ba, l2, a2: l2 - (r1 - r2) ** 2 };
}
function ellipsoid(c, r, axisY = [0, 1, 0], axisZ = [0, 0, 1]) {
  const v = norm(axisY);
  let w = sub(axisZ, mul(v, dot(axisZ, v)));
  w = norm(w);
  const u = cross(v, w);
  return { type: 'ell', c, r, u, v, w };
}

function primDist(p, P) {
  if (P.type === 'cone') return sdRoundCone(p, P);
  if (P.type === 'ell') return sdEllipsoid(p, P);
  return sdLoft(p, P);
}

// ════════════════════════════════════════════════════════════════
// BODY SPEC — measurements → skeleton landmarks + primitives
// ════════════════════════════════════════════════════════════════

// Cross-section shape per build: aspect = half-width / mean half-depth,
// fb/bb = front/back depth multipliers.
const RING_SHAPE = {
  female: { hip: [1.45, 0.88, 1.08], belly: [1.42, 1.0, 0.95], waist: [1.38, 0.95, 0.95], under: [1.32, 0.98, 1.02], chest: [1.45, 0.95, 1.05] },
  male:   { hip: [1.38, 0.95, 1.05], belly: [1.40, 1.0, 0.95], waist: [1.40, 1.0, 0.95],  under: [1.40, 1.0, 1.0],   chest: [1.50, 1.0, 1.0] },
};

// Solve half-width a for a ring with circumference C (m).
function ringFromCirc(C, [aspect, fb, bb]) {
  const b = 1 / aspect;
  const C1 = (perim(1, b * fb) + perim(1, b * bb)) / 2;
  const a = C / C1;
  return { a, bf: a * b * fb, bb: a * b * bb };
}

// Fingers, index to little: [offset across the palm in pitches, length × hand
// length, radius × height, knuckle set back toward the wrist × hand length].
const FINGERS = [[1.45, 0.40, 0.0043, 0.012], [0.48, 0.44, 0.0046, 0], [-0.48, 0.42, 0.0044, 0.012], [-1.42, 0.33, 0.0039, 0.05]];
const CAPS = 16;               // finger capsules the skin shader can press against
const FINGER_PITCH = 0.0103;    // × height
const FINGER_ROOT = 0.56;       // knuckle line, × hand length from the wrist
// Thumb (rigid, on the hand bone), base to tip: [along the hand × hand length, toward the
// palm side × height, toward the thumb side × height, radius × height].
const THUMB = [[0.1, 0, 0.012, 0.0064], [0.36, 0.003, 0.027, 0.0054], [0.68, 0.006, 0.031, 0.0044]];

function buildSpec(m) {
  const H = m.height / 100, L = m.legs, cm = v => v / 100;
  const R = C => cm(C) / (2 * Math.PI);          // radius from circumference
  const shape = RING_SHAPE[m.build];
  const female = m.build === 'female';

  // Vertical landmarks. Legs scale by L; torso stretches to meet the fixed neck/head.
  const crotchF = 0.472, neckF = 0.835;
  const legY = f => f * H * L;
  const c0 = crotchF * L;
  const torY = f => H * (c0 + (f - crotchF) * (neckF - c0) / (neckF - crotchF));
  const Y = {
    ankle: legY(0.039), knee: legY(0.285), hipJoint: legY(0.505), crotch: legY(crotchF),
    hip: torY(0.50), belly: torY(0.56), waist: torY(0.615), under: torY(0.70), bust: torY(0.728),
    armpit: torY(0.752), shoulder: torY(0.815), neckBase: H * neckF,
    chin: H * 0.872, top: H,
  };

  // Torso rings
  const hipR = ringFromCirc(cm(m.hip), shape.hip);
  const waistR = ringFromCirc(cm(m.waist), shape.waist);
  const bellyR = ringFromCirc(cm(lerp(m.waist, m.hip, 0.55)), shape.belly);
  // The ribcage ring never comes out narrower than the waist — an underbust smaller
  // than the waist otherwise leaves a boxy step where the ribcage meets the belly.
  const ribC = Math.max(m.underbust, m.waist * 1.01);
  const underR = ringFromCirc(cm(ribC), shape.under);
  const chestC = female ? ribC * 1.02 : m.bust;
  const bustR = ringFromCirc(cm(chestC), shape.under);
  const armpitR = ringFromCirc(cm(chestC * (female ? 1.06 : 1.02)), shape.chest);
  const shoulderHalf = cm(m.shoulders) / 2;
  const neckR = R(m.neck);

  const rings = [
    // The loft tapers to a close 3% of height below the crotch line, where its end
    // cap is buried inside the thighs; ending higher left the cap's rim on the
    // surface as a crease where the legs meet the torso.
    { y: Y.crotch - 0.03 * H,  a: hipR.a * 0.2,  bf: hipR.bf * 0.18, bb: hipR.bb * 0.17, zc: -0.006 * H },
    { y: Y.crotch - 0.021 * H, a: hipR.a * 0.45, bf: hipR.bf * 0.4,  bb: hipR.bb * 0.38, zc: -0.006 * H },
    { y: Y.crotch - 0.012 * H, a: hipR.a * 0.64, bf: hipR.bf * 0.62, bb: hipR.bb * 0.62, zc: -0.006 * H },
    { y: Y.crotch + 0.012 * H, a: hipR.a * 0.9,  bf: hipR.bf * 0.9,  bb: hipR.bb * 0.95, zc: -0.004 * H },
    { y: Y.hip,   a: hipR.a,   bf: hipR.bf,   bb: hipR.bb,   zc: -0.004 * H },
    { y: Y.belly, a: bellyR.a, bf: bellyR.bf, bb: bellyR.bb, zc: 0 },
    { y: Y.waist, a: waistR.a, bf: waistR.bf, bb: waistR.bb, zc: 0.002 * H },
    { y: Y.under, a: underR.a, bf: underR.bf, bb: underR.bb, zc: 0.002 * H },
    { y: Y.bust,  a: bustR.a,  bf: bustR.bf,  bb: bustR.bb,  zc: 0.002 * H },
    { y: Y.armpit, a: Math.max(armpitR.a, shoulderHalf * 0.78), bf: armpitR.bf, bb: armpitR.bb, zc: 0 },
    { y: Y.shoulder - 0.012 * H, a: shoulderHalf * 0.8, bf: 0.042 * H, bb: 0.046 * H, zc: -0.006 * H },
    { y: Y.neckBase, a: neckR * 1.08, bf: neckR * 0.95, bb: neckR * 1.0, zc: -0.01 * H },
    // Buried inside the neck so the loft's end cap never shows as a crease.
    { y: Y.neckBase + 0.03 * H, a: neckR * 0.7, bf: neckR * 0.6, bb: neckR * 0.65, zc: -0.01 * H },
  ];

  // Joints (world, rest pose)
  const armAngle = 45 * Math.PI / 180, legAngle = 3 * Math.PI / 180;
  const rArm = R(m.arm), rElbow = R(m.arm) * 0.78, rFore = R(m.forearm), rWrist = R(m.wrist);
  const rThigh = R(m.thigh), rKnee = R(m.knee), rCalf = R(m.calf), rAnkle = R(m.ankle);
  const upperLen = 0.172 * H, foreLen = 0.146 * H, handLen = 0.106 * H;
  const hipJX = hipR.a * 0.5;

  const J = {
    pelvis: V(0, Y.hip, 0),
    spine1: V(0, Y.waist, 0),
    spine2: V(0, Y.under, 0),
    neck: V(0, Y.neckBase - 0.01 * H, -0.008 * H),
    head: V(0, Y.chin + 0.006 * H, -0.004 * H),
  };
  for (const s of [1, -1]) {
    const side = s > 0 ? 'L' : 'R';
    const dir = V(s * Math.sin(armAngle), -Math.cos(armAngle), 0);
    const sh = V(s * (shoulderHalf - rArm * 0.85), Y.shoulder - 0.024 * H, -0.006 * H);
    J['clav' + side] = V(s * 0.012 * H, Y.shoulder - 0.03 * H, 0.004 * H);
    J['upperArm' + side] = sh;
    J['forearm' + side] = add(sh, mul(dir, upperLen));
    J['hand' + side] = add(J['forearm' + side], mul(dir, foreLen));
    J['handEnd' + side] = add(J['hand' + side], mul(dir, handLen));
    const hj = V(s * hipJX, Y.hipJoint, 0);
    const legDir = norm(V(s * Math.sin(legAngle), -Math.cos(legAngle), 0));
    J['thigh' + side] = hj;
    J['shin' + side] = add(hj, mul(legDir, (Y.hipJoint - Y.knee) / Math.cos(legAngle)));
    J['shin' + side][2] = 0.004 * H;
    J['foot' + side] = add(J['shin' + side], mul(legDir, (Y.knee - Y.ankle) / Math.cos(legAngle)));
    J['foot' + side][2] = -0.008 * H;
    J['toe' + side] = add(J['foot' + side], V(0, -Y.ankle * 0.7, 0.115 * H));
  }

  // Primitives: { shape, bone, group, k (blend into group), side }
  const prims = [];
  const P = (shape, bone, group, k, side = 0, extra = {}) => prims.push(Object.assign(shape, { bone, group, k, side }, extra));

  // Torso
  P(Object.assign(makeLoft(rings, 0.007 * H), { type: 'loft' }), 'loft', 'torso', 0);
  let bust = null;
  if (female) {
    // Width from the bust/underbust difference; forward projection from the cup
    // size (UK sizing, A = 1 … H = 8): roughly 3 cm at A plus 0.9 cm per cup,
    // scaled to height, measured from the ribcage front.
    const D = Math.max(0, m.bust - m.underbust);
    const rb = 0.028 * H * (0.55 + D / 22);
    const bustRing = loftRing(prims[0], Y.bust);
    const ribFront = bustRing[1] + bustRing[3];
    const proj = (0.022 + 0.009 * (m.cup || 3)) * H / 1.65;
    const rz = Math.max(proj * 0.8, rb * 0.62);
    for (const s of [1, -1]) {
      const c = V(s * bustRing[0] * 0.48, Y.bust - 0.004 * H - proj * 0.12, ribFront + proj - rz);
      // The left bust's centre and radii, for garments that follow it (see braCoverage).
      if (s > 0) bust = { x: c[0], y: c[1], rb, ry: rb * 0.9 + proj * 0.12 };
      // Carried by its own bone (secondary motion), rooted at the chest wall behind it.
      J['bust' + (s > 0 ? 'L' : 'R')] = V(c[0], c[1], ribFront - rz * 0.3);
      P(ellipsoid(c, [rb * 0.95, rb * 0.9 + proj * 0.12, rz], V(0, 1, 0.12 + proj * 0.8), V(s * 0.25, 0, 1)),
        'bust' + (s > 0 ? 'L' : 'R'), 'torso', 0.035 * H, s, { tag: 'bust' });
    }
  }
  // Every build has bust bones (unused on male builds: no geometry weighted to them).
  if (!J.bustL) { J.bustL = J.spine2.slice(); J.bustR = J.spine2.slice(); }
  // The crotch, mannequin-style: a rounded volume spanning between the tops of the
  // thighs, so the torso closes smoothly over them and the underside is one smooth
  // curve. Without it the torso's tapering lower end left the thighs' inner tops
  // meeting in a groove that ran up the front and back well above the crotch. It
  // stops just below the crotch line, so it can't web the thighs together.
  {
    const cr = loftRing(prims[0], Y.crotch + 0.012 * H);
    P(ellipsoid(V(0, Y.crotch + 0.012 * H, cr[3]), [hipR.a * 0.42, 0.03 * H, Math.min(cr[1], cr[2]) * 0.82]),
      'pelvis', 'torso', 0.025 * H, 0, { tag: 'glute' });
  }
  // The base of the pelvis between the thighs: a narrow rounded strip running front to
  // back, blended into the torso and carried by the pelvis. It gives that surface its
  // own identity, so the briefs' gusset can cover exactly it and never the inner
  // thighs beside it (see dress). Its underside is the body's lowest centre point.
  {
    const base = loftRing(prims[0], Y.crotch - 0.01 * H);
    P(ellipsoid(V(0, Y.crotch - 0.024 * H, base[3] + (base[1] - base[2]) / 2), [0.012 * H, 0.012 * H, (base[1] + base[2]) / 2 * 0.95]),
      'pelvis', 'torso', 0.015 * H, 0, { tag: 'perineum' });
  }
  // Male builds: a soft rounded volume at the front of the pelvis, just above the
  // crotch, so the front isn't flat under trunks or trousers. Kept simple and smooth
  // (a mannequin's form, not anatomy); clothing treats it as torso (tag 'groin').
  if (!female) {
    const fr = loftRing(prims[0], Y.crotch + 0.012 * H), front = fr[1] + fr[3];
    // About 4 cm proud of the pelvis at its fullest (0.022 × height), rounder low down.
    const r = [0.022 * H, 0.028 * H, 0.019 * H];
    P(ellipsoid(V(0, Y.crotch + 0.003 * H, front + r[2] * 0.15), r, V(0, 1, 0.35)), 'pelvis', 'torso', 0.018 * H, 0, { tag: 'groin' });
  }
  const hipRing = loftRing(prims[0], Y.hip);
  const g = m.glutes;
  for (const s of [1, -1]) {
    P(ellipsoid(V(s * hipRing[0] * 0.44, Y.hip - 0.022 * H, -hipRing[2] + hipRing[3] + 0.04 * H * g),
                [0.05 * H, 0.055 * H, 0.042 * H * g], V(0, 1, 0), V(s * 0.3, 0, 1)),
      'pelvis', 'torso', 0.03 * H, s, { tag: 'glute' });
  }

  // Neck and head
  P(cone(V(0, Y.neckBase - 0.05 * H, -0.012 * H), V(0, Y.chin - 0.004 * H, -0.014 * H), neckR, neckR * 0.94), 'neck', 'neck', 0);
  const hs = m.head * H, Fp = faceParams(m);
  const craniumC = V(0, H - 0.062 * hs, -0.006 * hs);
  P(ellipsoid(craniumC, [0.046 * hs, 0.06 * hs, 0.057 * hs]), 'head', 'head', 0, 0, { tag: 'head' });
  // Face: cheek mass over the upper face; a mandible with a flat underside that
  // sets the jaw line; and a chin sitting forward of the jaw. Tight blends keep
  // the jaw line and chin defined instead of melting into one receding mass.
  // Face parameters (faceParams: jaw, chin, cheeks, nose, lips, mouth, brow) scale these.
  // 'youth' (0…1, a young adult face): fullness moves up and forward from the lower
  // cheeks to the apples of the cheeks, the jaw narrows and rounds, the chin sits a
  // little higher, and (in addHead) the brows level out.
  const jawW = Fp.jaw * (1 - 0.07 * Fp.youth), yo = Fp.youth;
  P(ellipsoid(V(0, Y.chin + 0.05 * hs, 0.008 * hs), [0.04 * hs, 0.034 * hs, 0.042 * hs], V(0, 1, 0.1)), 'head', 'head', 0.012 * H, 0, { tag: 'head' });
  // Mandible: blended wider (0.014) than before, so the jaw line reads without the
  // crease it used to leave under the cheeks.
  P(ellipsoid(V(0, Y.chin + (0.026 + 0.003 * yo) * hs, -0.001 * hs), [0.038 * hs * jawW, 0.02 * hs * (1 - 0.1 * yo), 0.038 * hs], V(0, 1, 0.45)), 'head', 'head', (0.014 + 0.004 * yo) * H, 0, { tag: 'head' });
  P(ellipsoid(V(0, Y.chin + (0.008 + 0.008 * yo) * hs, 0.031 * hs * Fp.chin), [0.02 * hs * jawW, 0.015 * hs * (1 - 0.18 * yo), 0.015 * hs * Fp.chin]), 'head', 'head', 0.009 * H, 0, { tag: 'head' });
  // Cheek fullness between cheekbone and jaw, so the lower face doesn't read as hollow
  // (higher and rounder with youth); and cheekbones, under the outer corners of the eyes.
  for (const s of [1, -1]) {
    P(ellipsoid(V(s * 0.022 * hs, Y.chin + (0.036 + 0.009 * yo) * hs, (0.014 + 0.005 * yo) * hs), mul([0.02 * hs, 0.024 * hs * (1 - 0.1 * yo), 0.024 * hs], Fp.cheeks * (1 + 0.2 * yo))), 'head', 'head', 0.012 * H, s, { tag: 'head' });
    P(ellipsoid(V(s * 0.027 * hs, Y.chin + (0.054 + 0.003 * Fp.eyeHeight) * hs, 0.021 * hs), [0.013 * hs, 0.008 * hs, 0.012 * hs * Fp.cheeks]), 'head', 'head', 0.008 * H, s, { tag: 'head' });
  }
  // Brow ridge: a low band across the forehead above the eyes, so they sit in shallow sockets.
  P(ellipsoid(V(0, Y.chin + (0.075 + 0.006 * Fp.eyeHeight) * hs + Fp.brow * 0.004 * hs, 0.031 * hs), [0.035 * hs, 0.008 * hs, 0.012 * hs]), 'head', 'head', 0.01 * H, 0, { tag: 'head' });
  // Mouth mass bridging nose and chin, so the profile slopes smoothly with the
  // chin just behind the lips.
  // The mouth line: 0.008 × head height above halfway between the base of the nose
  // (where the columella meets the lip) and the bottom of the chin, moved by
  // 'mouthHeight' (−1…1, a further ±0.008 × head height).
  const noseBaseY = Y.chin + 0.0375 * hs, chinBottomY = Y.chin + (0.008 + 0.008 * yo - 0.015 * (1 - 0.18 * yo)) * hs;
  const mouthY = (noseBaseY + chinBottomY) / 2 + 0.008 * hs * (1 + Fp.mouthHeight);
  P(ellipsoid(V(0, mouthY + 0.0012 * hs, 0.025 * hs), [0.021 * hs * Fp.mouth, 0.02 * hs, 0.02 * hs]), 'head', 'head', 0.012 * H, 0, { tag: 'head' });
  // Nose. The ridge (dorsum) runs straight from the root between the eyes to the top of
  // the tip: 'bridge' is how far the root stands off the face, and 'hump' bends the
  // ridge out (+, a dorsal hump) or in (−, scooped) at its middle; 0 is straight. The
  // tip's distance from the face is 'nose' (length). The tip lobule (and the top of the
  // columella under it) turns about the nostrils by 'tipTilt' (up to ±26°; + turns it
  // up); the nostrils themselves stay where they are.
  const nW = Fp.noseWidth, tilt = Fp.tipTilt;
  const tipC = V(0, Y.chin + (0.0435 - 0.003 * (Fp.nose - 1)) * hs, (0.055 + 0.012 * (Fp.nose - 1)) * hs);
  // Offsets are from the tip's front point; the turn is about the nostril line (x axis).
  const ta = -0.45 * tilt, front = add(tipC, V(0, 0, 0.0045 * hs)), pivot = [-0.0022 * hs, -0.0095 * hs];
  const rotT = (y, z) => { const c = Math.cos(ta), sn = Math.sin(ta); return [y * c - z * sn, y * sn + z * c]; };
  const turn = o => { const [y, z] = rotT(o[1] - pivot[0], o[2] - pivot[1]); return add(front, V(o[0], y + pivot[0], z + pivot[1])); };
  const fixed = o => add(front, V(...o));
  const tAxis = (y, z) => { const [a, b] = rotT(y, z); return V(0, a, b); };
  const root = V(0, Y.chin + 0.064 * hs, (0.041 + 0.005 * (Fp.bridge - 1)) * hs);
  const tipTop = turn([0, 0.0035 * hs, -0.0045 * hs]);
  const dd = sub(tipTop, root), ridgeOut = norm(V(0, dd[2], -dd[1]));
  const mid = add(mul(add(root, tipTop), 0.5), mul(ridgeOut, 0.0065 * hs * Fp.hump));
  P(cone(root, mid, 0.0048 * hs * nW, 0.0042 * hs * nW), 'head', 'head', 0.005 * H, 0, { tag: 'head' });
  P(cone(mid, tipTop, 0.0042 * hs * nW, 0.0036 * hs * nW), 'head', 'head', 0.004 * H, 0, { tag: 'head' });
  // Lobule: longer along the nose than across, so its angle reads.
  P(ellipsoid(turn([0, 0, -0.0045 * hs]), [0.0048 * hs * nW, 0.0055 * hs, 0.0042 * hs], tAxis(1, -0.35)), 'head', 'head', 0.005 * H, 0, { tag: 'head' });
  for (const s of [1, -1]) P(ellipsoid(fixed([s * 0.0058 * hs * nW, pivot[0], pivot[1]]), [0.0034 * hs * nW, 0.0026 * hs, 0.0032 * hs]), 'head', 'head', 0.005 * H, s, { tag: 'head' });
  // Columella: from the tip's underside down to the lip.
  P(cone(turn([0, -0.004 * hs, -0.006 * hs]), V(0, noseBaseY, 0.044 * hs), 0.0022 * hs, 0.0026 * hs), 'head', 'head', 0.004 * H, 0, { tag: 'head' });
  // Lips are painted, not modelled: at this mesh resolution modelled lips could only read
  // as a bulge (parted or pouting). The shape (spec.mouth) is an upper and a lower half-
  // ellipse meeting at the mouth line; buildMesh turns it into the lip channel, which the
  // shader tints with a fine closed-mouth line. 'lips' sets their height, 'mouth' width.
  const lf = Fp.lips, mw = Fp.mouth;
  const mouthShape = { y: mouthY, hu: 0.0045 * hs * lf, hl: 0.0055 * hs * lf, w: 0.0125 * hs * mw, zMin: 0.02 * hs };
  for (const s of [1, -1]) {   // ears
    P(ellipsoid(V(s * 0.045 * hs, Y.chin + 0.056 * hs, -0.008 * hs), [0.006 * hs, 0.016 * hs, 0.01 * hs]), 'head', 'head', 0.004 * H, s, { tag: 'head' });
  }
  // Hair volume is part of the head surface; its colour comes from the hairline in the shader.
  const style = m.outfit.hairStyle;
  const capLift = style === 'short' ? 0.004 : 0.007;
  P(ellipsoid(add(craniumC, V(0, capLift * hs, -0.006 * hs)), [0.05 * hs, 0.06 * hs, 0.058 * hs]), 'head', 'head', 0.01 * H, 0, { tag: 'hair' });
  if (style === 'buns') for (const s of [1, -1]) {
    P(ellipsoid(add(craniumC, V(s * 0.034 * hs, 0.05 * hs, -0.016 * hs)), [0.024 * hs, 0.023 * hs, 0.024 * hs]), 'head', 'head', 0.008 * H, s, { tag: 'hairBun' });
  }
  if (style === 'ponytail') {
    P(ellipsoid(add(craniumC, V(0, 0.016 * hs, -0.06 * hs)), [0.017 * hs, 0.017 * hs, 0.017 * hs]), 'head', 'head', 0.01 * H, 0, { tag: 'hairBun' });
  }

  // Arms
  for (const s of [1, -1]) {
    const side = s > 0 ? 'L' : 'R', grp = 'arm' + side;
    const sh = J['upperArm' + side], el = J['forearm' + side], wr = J['hand' + side], he = J['handEnd' + side];
    const dir = norm(sub(el, sh));
    P(ellipsoid(add(sh, add(mul(dir, 0.02 * H), V(0, 0.008 * H, 0))), [rArm * 1.3, rArm * 1.55, rArm * 1.25], dir), 'upperArm' + side, grp, 0, s, { tag: 'deltoid' });
    P(cone(sh, el, rArm, rElbow), 'upperArm' + side, grp, 0.02 * H, s, { tag: 'upperArm' });
    P(cone(el, wr, rElbow * 1.02, rWrist), 'forearm' + side, grp, 0.015 * H, s, { tag: 'forearm' });
    P(ellipsoid(add(el, mul(dir, foreLen * 0.28)), [rFore * 0.98, foreLen * 0.3, rFore * 0.86], dir), 'forearm' + side, grp, 0.02 * H, s, { tag: 'forearm' });
    // Hand: a palm from the wrist to the knuckles, four fingers on their own bone
    // (so they can curl), and the thumb on the palm. In the A-pose the palm faces
    // the body and its width runs front–back, thumb at the front.
    const across = V(0, 0, 1);
    P(ellipsoid(add(wr, mul(dir, handLen * 0.3)), [0.0085 * H, handLen * 0.31, 0.024 * H], dir, across), 'hand' + side, grp, 0.012 * H, s, { tag: 'hand' });
    for (const [off, lenF, rF, back] of FINGERS) {
      const k0 = add(add(wr, mul(dir, handLen * (FINGER_ROOT - back))), mul(across, off * FINGER_PITCH * H));
      const tip = add(k0, mul(dir, handLen * lenF));
      // Tight blend: the fingers stay separate instead of fusing into a mitten.
      P(cone(add(k0, mul(dir, -handLen * 0.03)), sub(tip, mul(dir, rF * H)), rF * H * 1.08, rF * H * 0.86), 'fingers' + side, grp, 0.0016 * H, s, { tag: 'hand' });
    }
    // Thumb: the metacarpal, set into the heel of the palm, then the phalanges as a
    // separate digit (tight blend, like the fingers), angled a little away from the
    // palm, with the tip level with the middle of the index finger's first segment.
    const [thumbBase, thumbKnuckle, thumbTip] = THUMB.map(([k, x, z]) => add(add(wr, mul(dir, handLen * k)), V(-s * x * H, 0, z * H)));
    P(cone(thumbBase, thumbKnuckle, THUMB[0][3] * H, THUMB[1][3] * H), 'thumb' + side, grp, 0.006 * H, s, { tag: 'hand' });
    P(cone(thumbKnuckle, sub(thumbTip, mul(norm(sub(thumbTip, thumbKnuckle)), THUMB[2][3] * H)), 0.0053 * H, THUMB[2][3] * H),
      'thumb2' + side, grp, 0.0016 * H, s, { tag: 'hand' });
    J['thumb' + side] = thumbBase;       // the thumb turns at its base, in the heel of the palm,
    J['thumb2' + side] = thumbKnuckle;   // and bends at its knuckle
    J['fingers' + side] = add(wr, mul(dir, handLen * FINGER_ROOT));
    void he;
  }

  // Legs
  for (const s of [1, -1]) {
    const side = s > 0 ? 'L' : 'R', grp = 'leg' + side;
    const hj = J['thigh' + side], kn = J['shin' + side], an = J['foot' + side], toe = J['toe' + side];
    const thighTop = add(hj, V(-s * 0.004 * H, -0.03 * H, 0));
    P(cone(thighTop, kn, rThigh, rKnee), 'thigh' + side, grp, 0, s, { tag: 'thigh' });
    const shinDir = norm(sub(an, kn));
    P(cone(kn, an, rKnee * 0.98, rAnkle), 'shin' + side, grp, 0.02 * H, s, { tag: 'shin' });
    const shinLen = len(sub(an, kn));
    P(ellipsoid(add(add(kn, mul(shinDir, shinLen * 0.3)), V(0, 0, -rCalf * 0.22)), [rCalf * 0.88, shinLen * 0.3, rCalf * 0.86], shinDir), 'shin' + side, grp, 0.03 * H, s, { tag: 'shin' });
    const footC = V(an[0], 0.021 * H, (an[2] + toe[2]) * 0.5 - 0.004 * H);
    P(ellipsoid(footC, [0.023 * H, 0.021 * H, 0.078 * H], V(0, 1, 0), V(s * 0.08, 0, 1)), 'foot' + side, grp, 0.02 * H, s, { tag: 'foot' });
    P(ellipsoid(V(an[0], 0.02 * H, an[2] - 0.012 * H), [0.02 * H, 0.02 * H, 0.024 * H]), 'foot' + side, grp, 0.012 * H, s, { tag: 'foot' });
  }

  // Groups: blend within each group, then join groups into the body.
  const GROUPS = [
    { name: 'torso', join: 0 },
    { name: 'neck', join: 0.03 * H },
    { name: 'head', join: 0.011 * H },   // tight: keeps the underside of the jaw distinct from the neck
    { name: 'armL', join: 0.028 * H }, { name: 'armR', join: 0.028 * H },
    // Legs blend with the torso only (see field), never with each other.
    { name: 'legL', join: 0.05 * H, leg: true }, { name: 'legR', join: 0.05 * H, leg: true },
  ];
  const groups = GROUPS.map(G => ({ ...G, prims: prims.filter(p => p.group === G.name) }));

  // Loft → bone weights by height
  const loftBones = [[Y.hip, 'pelvis'], [Y.waist, 'spine1'], [Y.under, 'spine2'], [Y.neckBase, 'neck']];
  // Hinges (elbows, knees): the parent and child bone, the joint, and the limb's
  // direction. Their skin weights are set across the joint (see buildMesh).
  const hinges = [];
  for (const side of ['L', 'R']) {
    hinges.push(['upperArm' + side, 'forearm' + side, J['forearm' + side], norm(sub(J['hand' + side], J['upperArm' + side]))]);
    hinges.push(['thigh' + side, 'shin' + side, J['shin' + side], norm(sub(J['foot' + side], J['thigh' + side]))]);
  }

  return { m, H, Y, J, rings, prims, groups, loftBones, hinges, female, headInfo: { c: craniumC, hs }, mouth: mouthShape,
    bust, dims: { shoulderHalf, neckR, hipA: hipR.a } };
}

// Axis-aligned bounds per primitive and per group, used to skip work in field():
// a primitive (or whole group) whose box is further away than the current
// result plus its blend radius cannot change the smooth-min.
function primBox(P) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  const grow = (p, r) => { for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], p[i] - r); hi[i] = Math.max(hi[i], p[i] + r); } };
  if (P.type === 'cone') { grow(P.a, P.r1); grow(P.b, P.r2); }
  else if (P.type === 'ell') grow(P.c, Math.max(...P.r));
  else for (let i = 0; i < LOFT_ROWS; i += 8) {
    const L = P.lut, y = P.y0 + i / P.scale;
    grow([L[i * 4], y, L[i * 4 + 3] + L[i * 4 + 1]], 0); grow([-L[i * 4], y, L[i * 4 + 3] - L[i * 4 + 2]], 0);
  }
  return { lo, hi };
}
function boxDist(p, B) {
  const dx = Math.max(B.lo[0] - p[0], 0, p[0] - B.hi[0]);
  const dy = Math.max(B.lo[1] - p[1], 0, p[1] - B.hi[1]);
  const dz = Math.max(B.lo[2] - p[2], 0, p[2] - B.hi[2]);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
function prepareBounds(spec) {
  spec.prims.forEach((P, i) => { P.index = i; P.box = primBox(P); });
  for (const G of spec.groups) {
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const P of G.prims) for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], P.box.lo[i]); hi[i] = Math.max(hi[i], P.box.hi[i]); }
    G.box = { lo, hi };
    G.slack = G.prims.reduce((s, P) => s + P.k * 0.25, 0);
  }
}

// Groups are smooth-joined into the body in order, except the legs: each leg is
// smooth-joined to the torso alone and then added with a plain union. Blending the
// legs into everything so far (the other leg included) filled the gap between the
// inner thighs with a web, skinned to the pelvis, that stretched into a sheet across
// the crotch whenever the legs opened.
function field(spec, p, dists) {
  let total = Infinity, torso = Infinity;
  for (const G of spec.groups) {
    // Skip a group that can't reach the result: for a leg, one that can't reach the
    // torso within its blend (smin of values further apart than k is a plain min).
    const ref = G.leg ? torso : total;
    if (!dists && ref !== Infinity && boxDist(p, G.box) - G.slack >= ref + G.join) continue;
    let gd = Infinity;
    for (const P of G.prims) {
      if (!dists && gd !== Infinity && boxDist(p, P.box) >= gd + P.k) continue;
      const d = primDist(p, P);
      if (dists) dists[P.index] = d;
      gd = gd === Infinity ? d : smin(gd, d, P.k);
    }
    if (G.leg) total = Math.min(total, smin(torso, gd, G.join));
    else total = total === Infinity ? gd : smin(total, gd, G.join);
    if (G.name === 'torso') torso = gd;
  }
  return total;
}

// ════════════════════════════════════════════════════════════════
// SURFACE NETS — polygonise the field once, at rest pose
// ════════════════════════════════════════════════════════════════

function bodyBounds(spec) {
  const lo = [Infinity, 0, Infinity], hi = [-Infinity, spec.H, -Infinity];
  const grow = (p, r) => { for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], p[i] - r); hi[i] = Math.max(hi[i], p[i] + r); } };
  for (const P of spec.prims) {
    if (P.type === 'cone') { grow(P.a, P.r1); grow(P.b, P.r2); }
    else if (P.type === 'ell') grow(P.c, Math.max(...P.r));
    else spec.rings.forEach(r => { grow([r.a, r.y, r.zc + r.bf], 0); grow([-r.a, r.y, r.zc - r.bb], 0); });
  }
  lo[1] = -0.01;
  return { lo, hi };
}

// The head and upper neck, from `yFrom` up, for the finer head mesh.
function headBounds(spec, yFrom) {
  const lo = [Infinity, yFrom, Infinity], hi = [-Infinity, spec.H, -Infinity];
  for (const G of spec.groups) if (G.name === 'head' || G.name === 'neck') for (let i = 0; i < 3; i += 2) {
    lo[i] = Math.min(lo[i], G.box.lo[i]); hi[i] = Math.max(hi[i], G.box.hi[i]);
  }
  hi[1] = Math.max(...spec.groups.filter(G => G.name === 'head').map(G => G.box.hi[1]));
  return { lo, hi };
}

function polygonize(spec, h, bounds = bodyBounds(spec)) {
  const { lo, hi } = bounds;
  const pad = 3 * h;
  const org = [lo[0] - pad, lo[1] - pad, lo[2] - pad];
  const nx = Math.ceil((hi[0] - lo[0] + 2 * pad) / h) + 1;
  const ny = Math.ceil((hi[1] - lo[1] + 2 * pad) / h) + 1;
  const nz = Math.ceil((hi[2] - lo[2] + 2 * pad) / h) + 1;
  const idx = (i, j, k) => i + nx * (j + ny * k);
  const vals = new Float32Array(nx * ny * nz);
  const p = [0, 0, 0];

  // Narrow band: evaluate a coarse lattice, and only evaluate fine points exactly
  // inside blocks that could contain the surface.
  const S = 4, band = S * h * 1.5;
  const cnx = Math.ceil((nx - 1) / S) + 1, cny = Math.ceil((ny - 1) / S) + 1, cnz = Math.ceil((nz - 1) / S) + 1;
  const coarse = new Float32Array(cnx * cny * cnz);
  const cidx = (i, j, k) => i + cnx * (j + cny * k);
  let evals = 0;
  for (let k = 0; k < cnz; k++) for (let j = 0; j < cny; j++) for (let i = 0; i < cnx; i++) {
    p[0] = org[0] + i * S * h; p[1] = org[1] + j * S * h; p[2] = org[2] + k * S * h;
    coarse[cidx(i, j, k)] = field(spec, p); evals++;
  }
  for (let bk = 0; bk < cnz - 1; bk++) for (let bj = 0; bj < cny - 1; bj++) for (let bi = 0; bi < cnx - 1; bi++) {
    const c = [];
    for (let d = 0; d < 8; d++) c.push(coarse[cidx(bi + (d & 1), bj + ((d >> 1) & 1), bk + ((d >> 2) & 1))]);
    const near = c.some(v => Math.abs(v) < band) || (Math.min(...c) < 0 && Math.max(...c) > 0);
    // Half-open ranges so block faces aren't evaluated twice; the last block closes the grid.
    const kEnd = bk === cnz - 2 ? nz : Math.min(nz, bk * S + S);
    const jEnd = bj === cny - 2 ? ny : Math.min(ny, bj * S + S);
    const iEnd = bi === cnx - 2 ? nx : Math.min(nx, bi * S + S);
    for (let k = bk * S; k < kEnd; k++)
      for (let j = bj * S; j < jEnd; j++)
        for (let i = bi * S; i < iEnd; i++) {
          const id = idx(i, j, k);
          if (near) {
            p[0] = org[0] + i * h; p[1] = org[1] + j * h; p[2] = org[2] + k * h;
            vals[id] = field(spec, p); evals++;
          } else {
            const tx = (i - bi * S) / S, ty = (j - bj * S) / S, tz = (k - bk * S) / S;
            const x00 = lerp(c[0], c[1], tx), x10 = lerp(c[2], c[3], tx), x01 = lerp(c[4], c[5], tx), x11 = lerp(c[6], c[7], tx);
            vals[id] = lerp(lerp(x00, x10, ty), lerp(x01, x11, ty), tz);
          }
        }
  }

  // One vertex per sign-changing cell, at the mean of its edge crossings.
  const cellVert = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const cid = (i, j, k) => i + (nx - 1) * (j + (ny - 1) * k);
  const pos = [];
  const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cv = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let neg = 0;
    for (let d = 0; d < 8; d++) { cv[d] = vals[idx(i + (d & 1), j + ((d >> 1) & 1), k + ((d >> 2) & 1))]; if (cv[d] < 0) neg++; }
    if (neg === 0 || neg === 8) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [e0, e1] of EDGES) {
      const a = cv[e0], b = cv[e1];
      if ((a < 0) === (b < 0)) continue;
      const t = a / (a - b);
      sx += lerp(e0 & 1, e1 & 1, t); sy += lerp((e0 >> 1) & 1, (e1 >> 1) & 1, t); sz += lerp((e0 >> 2) & 1, (e1 >> 2) & 1, t); n++;
    }
    cellVert[cid(i, j, k)] = pos.length / 3;
    pos.push(org[0] + (i + sx / n) * h, org[1] + (j + sy / n) * h, org[2] + (k + sz / n) * h);
  }

  // One quad per sign-changing grid edge, joining the four cells around it.
  const quads = [];
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const v0 = vals[idx(i, j, k)] < 0;
    if (v0 !== (vals[idx(i + 1, j, k)] < 0)) quads.push([cid(i, j - 1, k - 1), cid(i, j, k - 1), cid(i, j, k), cid(i, j - 1, k)]);
    if (v0 !== (vals[idx(i, j + 1, k)] < 0)) quads.push([cid(i - 1, j, k - 1), cid(i, j, k - 1), cid(i, j, k), cid(i - 1, j, k)]);
    if (v0 !== (vals[idx(i, j, k + 1)] < 0)) quads.push([cid(i - 1, j - 1, k), cid(i, j - 1, k), cid(i, j, k), cid(i - 1, j, k)]);
  }
  return { pos, quads: quads.map(q => q.map(c => cellVert[c])), evals };
}

// ════════════════════════════════════════════════════════════════
// MESH BUILD — projection, normals, skin weights, clothing colours
// ════════════════════════════════════════════════════════════════

const BONES = ['pelvis', 'spine1', 'spine2', 'neck', 'head',
  'clavL', 'upperArmL', 'forearmL', 'handL', 'clavR', 'upperArmR', 'forearmR', 'handR',
  'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR', 'bustL', 'bustR', 'fingersL', 'fingersR', 'thumbL', 'thumbR', 'thumb2L', 'thumb2R'];
const PARENT = { spine1: 'pelvis', spine2: 'spine1', neck: 'spine2', head: 'neck', bustL: 'spine2', bustR: 'spine2',
  clavL: 'spine2', upperArmL: 'clavL', forearmL: 'upperArmL', handL: 'forearmL', fingersL: 'handL', thumbL: 'handL', thumb2L: 'thumbL',
  clavR: 'spine2', upperArmR: 'clavR', forearmR: 'upperArmR', handR: 'forearmR', fingersR: 'handR', thumbR: 'handR', thumb2R: 'thumbR',
  thighL: 'pelvis', shinL: 'thighL', footL: 'shinL', thighR: 'pelvis', shinR: 'thighR', footR: 'shinR' };
const BONE_HUE = {};
BONES.forEach((b, i) => BONE_HUE[b] = new THREE.Color().setHSL((i * 0.618) % 1, 0.65, 0.55));

// Forward differences — f(p) is already known wherever this is called.
function gradient(spec, p, e, f0) {
  const q = p.slice();
  const g = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    q[i] = p[i] + e; g[i] = (field(spec, q) - f0) / e; q[i] = p[i];
  }
  return g;
}

function loftWeights(spec, y) {
  const B = spec.loftBones;
  if (y <= B[0][0]) return [[B[0][1], 1]];
  for (let i = 0; i < B.length - 1; i++) {
    if (y <= B[i + 1][0]) {
      const t = (y - B[i][0]) / (B[i + 1][0] - B[i][0]);
      const s = t * t * (3 - 2 * t);
      return [[B[i][1], 1 - s], [B[i + 1][1], s]];
    }
  }
  return [[B[B.length - 1][1], 1]];
}

// Garment coverage for a vertex: signed distance in metres to each garment's edge
// (positive = covered). Stored per vertex and thresholded per pixel in the shader,
// so edges come out as clean lines instead of following the triangle grid.
// Each primitive near a vertex reports its own distances; buildMesh blends them
// with the skin weights so edges stay smooth where body parts meet.
const NONE = -0.03;
const smooth01 = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function hairline(spec, p) {
  const { c, hs } = spec.headInfo;
  const qx = p[0] - c[0], qy = p[1] - c[1], qz = p[2] - c[2];
  const f = (1 - Math.cos(Math.atan2(qx, qz))) / 2;          // 0 = front, 1 = back
  const lineY = f < 0.5 ? lerp(0.03, 0.002, f / 0.5) : lerp(0.002, -0.052, (f - 0.5) / 0.5);
  return qy - lineY * hs;
}
// How far each part of the body gives way when pressed against someone (see CONTACT):
// soft tissue (belly, glutes, bust) the most, bony parts (shins, head) the least.
function softness(spec, tag, loft, y) {
  if (loft) return y < spec.Y.hip ? 0.8 : y < spec.Y.under ? 1 : 0.5;
  return { bust: 1, glute: 1, groin: 0.6, thigh: 0.7, shin: 0.35, deltoid: 0.5, upperArm: 0.5, forearm: 0.35,
    neck: 0.4, hand: 0.15, foot: 0.15 }[tag] || 0.1;
}
function hairCoverage(P, spec, p) {
  const tag = P.tag || P.group;
  return tag === 'head' || tag === 'hair' ? hairline(spec, p) : tag === 'hairBun' ? 0.03 : NONE;
}

// ── Clothing layers ─────────────────────────────────────────────
// A character's wardrobe (preset.wardrobe) holds named garment layers, and each
// look (preset.looks) lists the ones worn, innermost first. The shader paints
// them over the skin in that order, so an outer layer covers an inner one
// wherever both reach. Every layer has a `kind` (a function below) and a colour.
// Changing a look only recomputes the coverage (dress()), not the mesh.
const MAX_LAYERS = 8, BASIS_K = 8, THIGH_LIMIT = 0.5;
function lookLayers(m, look = m.look) {
  return ((m.looks || {})[look] || []).map(id => m.wardrobe[id]).filter(Boolean);
}

// Tops: from `from` (underbust / waist / hip) up to the neckline. Scoop ends above
// the armpits, crew at the base of the neck, both higher at the back; the default
// is crew for male builds, scoop otherwise. `sleeves`: 0 none, 1 to the elbow, 2 long.
function topCoverage(spec, L, tag, torso, p, t, coneLen) {
  const Y = spec.Y, H = spec.H;
  const from = { underbust: Y.under - 0.012 * H, waist: Y.waist - 0.01 * H, hip: Y.hip - 0.02 * H }[L.from];
  const neck = L.neck || (spec.m.build === 'male' ? 'crew' : 'scoop');
  const neckline = neck === 'crew'
    ? Y.neckBase - 0.016 * H + 0.008 * H * smooth01(0.02, -0.02, p[2])
    : Y.armpit + 0.022 * H + 0.018 * H * smooth01(0.02, -0.02, p[2]);
  if (torso || tag === 'thigh') return Math.min(p[1] - from, neckline - p[1]);   // long tops reach the upper thigh
  if (tag === 'deltoid') return L.sleeves > 0 ? 0.05 : NONE;
  if (tag === 'upperArm') return (L.sleeves - t) * coneLen;
  if (tag === 'forearm') return (L.sleeves - 1 - t) * coneLen;
  return NONE;
}
// Bottoms: from the belly line down; `legLen` in thigh lengths (below 1: shorts,
// 2: to the ankle). Short hems are horizontal (in the rest pose) so the inside leg
// is covered as far down as the outside.
// Lowered (L.lowered, see setLowered): nothing on the torso or upper thighs; a band
// round each knee, from LOWER_BAND[0] × height above the knee joint to LOWER_BAND[1]
// below it (shorts), or on down the shin as normal (long legs). With lowerTo: 'calf'
// the garment is pushed further, covering from LOWER_CALF of the way down the shin
// to its hem. The bunched roll of fabric at the top is a separate mesh (buildBunches).
// lowerTo: 'ankle' pushes it all the way down: covering from LOWER_ANKLE down the shin.
const LOWER_BAND = [0.045, 0.02], LOWER_CALF = 0.45, LOWER_ANKLE = 0.8;
function bottomCoverage(spec, L, tag, torso, p, t, coneLen) {
  if (L.lowered && (L.lowerTo === 'calf' || L.lowerTo === 'ankle')) {
    if (tag !== 'shin' || !coneLen) return NONE;
    return Math.min((t - (L.lowerTo === 'ankle' ? LOWER_ANKLE : LOWER_CALF)) * coneLen, (L.legLen - 1 - t) * coneLen);
  }
  if (L.lowered) {
    if (torso || !coneLen) return NONE;
    if (tag === 'thigh') return (t - (1 - LOWER_BAND[0] * spec.H / coneLen)) * coneLen;
    if (tag === 'shin') return L.legLen < 1 ? (LOWER_BAND[1] * spec.H / coneLen - t) * coneLen : (L.legLen - 1 - t) * coneLen;
    return NONE;
  }
  if (torso) return spec.Y.belly - p[1];
  if (tag === 'thigh') return L.legLen < 1 ? p[1] - (spec.J.thighL[1] - L.legLen * coneLen) : (L.legLen - t) * coneLen;
  if (tag === 'shin') return (L.legLen - 1 - t) * coneLen;
  return NONE;
}
function shoeCoverage(spec, L, tag, torso, p, t, coneLen) {
  return tag === 'shin' ? (t - 0.9) * coneLen : tag === 'foot' ? 0.05 : NONE;
}
// Briefs. One edge rule for every part they cover (torso and thighs alike), in the
// rest pose, so an edge never depends on which body part a vertex is closest to.
// The waistband sits `rise` of the way from the hip line (0) to the belly line (1).
// `leg` gives trunks: a level hem `leg` × height below the crotch line. Otherwise
// the leg opening is one continuous curve around the hip, measured by the angle
// around the pelvis (front centre, side seam, back centre), so front and back meet
// at the same height at the side:
//   gusset: `gusset` × height each side of the centre line, down to just under the
//     body's own crotch point (dims.crotchY, found by probing the body), so it wraps
//     the underside without running down the inner thighs. In front it widens
//     upward, meeting the leg openings in a V.
//   side:   the opening's height at the side seam, `side` of the way from the crotch
//     point to the hip line. The front rises to it evenly from the gusset.
//   back:   'full' (the default) covers everything down to the gusset's depth.
//     'brief' comes down from the side to the gusset; `backCurve` below 1 stays high
//     longer, cutting higher over the cheeks. 'thong' leaves only a narrow waistband
//     and a strip down the centre, `thong` × height either side of it at the bottom,
//     widening to a small triangle under the band; the front then rises to the
//     band's lower edge at the side, so it narrows into the band.
// Each piece is a signed distance, joined by min/max, so the edge stays continuous.
function crotchY(spec) {
  // The lowest point of the body on the centre line, front to back (the surface
  // dips a little lower toward the front than straight under the hips).
  if (spec.dims.crotchY == null) {
    let lo = Infinity;
    for (let z = -0.05; z <= 0.05; z += 0.005) {
      const p = [0, spec.Y.crotch, z * spec.H / 1.7];
      if (field(spec, p) >= 0) continue;
      while (field(spec, p) < 0 && p[1] > 0) p[1] -= 0.001;
      lo = Math.min(lo, p[1]);
    }
    spec.dims.crotchY = lo;
  }
  return spec.dims.crotchY;
}
// The waistband's height at angle a around the pelvis (0 front, 1 side, 2 back):
// `rise` in front, sweeping smoothly over the hips to `riseBack` (default the same)
// at the back, both as fractions of the way from the hip line to the belly line.
function briefsWaist(spec, L, a) {
  const back = L.riseBack == null ? L.rise : L.riseBack;
  return lerp(spec.Y.hip, spec.Y.belly, lerp(L.rise, back, smooth01(0, 2, a)));
}
// Where lowered briefs' rolled waistband sits, as a distance down the thigh from the hip
// joint: briefs and hipsters below the thigh's crease (its lowest point, so the band is
// clear of the buttock all round, plus BRIEFS_DOWN.below × height: far enough that the
// band and its gusset clear the crotch with the legs spread); a thong further,
// near the knee (BRIEFS_DOWN.thong of the way to it).
const BRIEFS_DOWN = { below: 0.04, thong: 0.78 };
function briefsDown(spec, L) {
  const H = spec.H, thong = L.back === 'thong', thigh = len(sub(spec.J.shinL, spec.J.thighL));
  return { roll: thong ? BRIEFS_DOWN.thong * thigh : (spec.dims.creaseLow || 0.1 * H) + BRIEFS_DOWN.below * H, thong };
}
// Lowered briefs (L.lowered, see setLowered) paint nothing: they're the rolled band and the
// fabric between the legs (buildBunches). Trunks are lowered as shorts are, to the knees.
function briefsCoverage(spec, L, tag, torso, p, t, coneLen) {
  if (L.lowered) return L.leg ? bottomCoverage(spec, { lowered: true, legLen: 0.5 }, tag, torso, p, t, coneLen) : NONE;
  if (!torso && tag !== 'thigh') return NONE;
  const Y = spec.Y, H = spec.H, x = Math.abs(p[0]), y = p[1];
  // Angle around the pelvis: 0 at the front centre, 1 at the side seam, 2 at the back centre.
  const a = Math.atan2(x, p[2] + 0.004 * H) / (Math.PI / 2);
  const waist = briefsWaist(spec, L, a);
  if (L.leg) return Math.min(y - (Y.crotch - L.leg * H), waist - y);
  const cy = crotchY(spec), bottom = cy - 0.012 * H, g = (L.gusset || 0.02) * H;
  const thong = L.back === 'thong', bandLo = waist - 0.012 * H;
  // For a thong the front rises to the band's lower edge at the side seam.
  const sideY = thong ? briefsWaist(spec, L, 1) - 0.012 * H : lerp(cy, Y.hip, L.side == null ? 0.7 : L.side);
  let cov;
  if (a <= 1) {
    cov = Math.max(Math.min(g + Math.max(0, y - cy) * 0.9 - x, y - bottom), y - lerp(cy, sideY, a));
  } else if (thong) {
    // The strip widens into the gusset at the bottom (as a real thong does, and so it
    // stays wider than the mesh spacing between spread legs) and into a small triangle
    // under the band at the top.
    const wBase = lerp(0.6 * g, (L.thong || 0.005) * H, smooth01(cy, cy + 0.06 * H, y));
    const w = lerp(wBase, 0.03 * H, smooth01(Y.hip - 0.05 * H, bandLo, y));
    cov = Math.max(y - bandLo, Math.min(w - x, y - bottom));
  } else if (L.back === 'brief') {
    cov = Math.max(Math.min(g - x, y - bottom), y - lerp(cy, sideY, Math.pow(2 - a, L.backCurve || 1)));
  } else cov = y - bottom;
  return Math.min(waist - y, cov);
}
// Bras. A band under the bust; in front, an edge that runs from the centre gore up
// the inside of each cup to the strap point, and down the outside to the band at
// the side; straps from there over the shoulder and down the back. Styles set the
// defaults; any of them can be overridden on the layer. Heights are × body height,
// `apex` (the strap point) is × the bust radius above its centre. `edge` shapes the
// inside of the cup: 'line' (triangle), 'round' (full cup) or 'scoop' (a U across
// the front). Straps narrower than about 1.5 voxels break up, as the edge can't be
// resolved between vertices: 0.0075 × height is about 1.3 cm on Aya.
const BRA_STYLES = {
  // Small triangle cups, a narrow band, thin straps.
  bralette: { band: 0.009, back: 0.01, gore: 0.006, apex: 0.95, apexOut: -0.1, strap: 0.0075, edge: 'line', racer: false },
  // Rounded full cups, a medium band and straps.
  classic:  { band: 0.014, back: 0.016, gore: 0.02, apex: 0.62, apexOut: 0, strap: 0.0085, edge: 'round', racer: false },
  // Support/sports: a high scoop across the front, a deep band, wide racer-back straps.
  // strapOut keeps the wide straps near the neck, off the skin that moves with a raised arm.
  sports:   { band: 0.026, back: 0.05, gore: 0.06, apex: 1.5, apexOut: 0.25, strap: 0.028, edge: 'scoop', racer: true, strapOut: 0.1 },
};
function braCoverage(spec, L, tag, torso, p) {
  const b = spec.bust;
  // Straps are measured on the neck and upper arm too: where those blend into the
  // shoulder, a "not covered" from them would pull the strap's edge in and break it up.
  const nearStrap = tag === 'deltoid' || tag === 'neck' || tag === 'upperArm';
  if (!b || (!torso && !nearStrap)) return NONE;
  const S = { ...BRA_STYLES[L.style || 'classic'], ...L };
  const Y = spec.Y, H = spec.H, x = Math.abs(p[0]), y = p[1];
  const front = smooth01(-0.015, 0.015, p[2] - 0.002 * H);    // 1 in front, 0 behind
  // The band sits in the fold under the bust, which is below the underbust line on a fuller bust.
  const fold = Math.min(Y.under, b.y - b.ry * 0.95);
  const bandLo = fold - S.band * H, backTop = fold + S.back * H;
  const xg = 0.008 * H, yg = fold + S.gore * H;                    // centre gore
  const xa = b.x + S.apexOut * b.rb, ya = b.y + S.apex * b.rb;     // strap point
  const xs = b.x + 1.4 * b.rb;                                     // side of the cup
  const inner = { line: u => u, round: u => Math.sin(u * Math.PI / 2), scoop: u => 1 - Math.cos(u * Math.PI / 2) }[S.edge];
  const outer = S.edge === 'line' ? u => u : u => 1 - Math.cos(u * Math.PI / 2);
  const frontTop = x <= xg ? yg
    : x <= xa ? yg + (ya - yg) * inner((x - xg) / (xa - xg))
    : ya + (backTop - ya) * outer(clamp((x - xa) / (xs - xa), 0, 1));
  const body = !torso ? NONE : Math.min(y - bandLo, lerp(backTop, frontTop, front) - y);
  // Straps: straight lines (in the rest pose) from the strap point, and from the back
  // band (at the centre for a racer back), to the top of the shoulder.
  // Where the straps cross the shoulder: `strapOut` of the way from beside the neck to the shoulder's edge.
  const d = spec.dims, xSh = lerp(d.neckR * 1.2, d.shoulderHalf, S.strapOut == null ? 0.42 : S.strapOut), ySh = Y.shoulder;
  const along = (x0, y0) => x0 + (xSh - x0) * clamp((y - y0) / (ySh - y0), 0, 1);
  const xBack = S.racer ? 0.01 * H : xa;
  const xl = lerp(along(xBack, backTop), along(xa, ya), front), y0 = lerp(backTop, ya, front);
  // Each strap starts a little below its anchor (a strap's width below it), so it joins the cup or band cleanly.
  const strap = Math.min(S.strap * H / 2 - Math.abs(x - xl), y - y0 + Math.max(0.01, S.strap) * H);
  return Math.max(body, strap);
}
const LAYER_KINDS = { top: topCoverage, bottom: bottomCoverage, shoes: shoeCoverage, briefs: briefsCoverage, bra: braCoverage };
function layerCoverage(spec, L, P, p, t, coneLen) {
  const tag = P.tag || P.group, torso = P.type === 'loft' || tag === 'bust' || tag === 'glute' || tag === 'groin' || tag === 'perineum';
  const f = LAYER_KINDS[L.kind];
  return f ? f(spec, L, tag, torso, p, t, coneLen) : NONE;
}

// Puts `layers` (innermost first; default: the character's current look) on a built
// character: coverage per vertex from the primitives recorded at build time, blended
// with their skin weights so edges stay smooth where body parts meet.
function dress(ch, layers = lookLayers(ch.spec.m)) {
  const spec = ch.spec, geo = ch.mesh.geometry, { idx, w } = geo.userData.basis;
  const pos = geo.attributes.position.array, nV = pos.length / 3;
  // Cloth layers (a skirt) are their own meshes; only painted layers go to the shader.
  const cloth = layers.find(L => L.kind === 'skirt');
  if (cloth && !(ch.skirt && ch.skirt.L === cloth)) { removeSkirt(ch); buildSkirt(ch, cloth); }
  else if (!cloth && ch.skirt) removeSkirt(ch);
  if (ch.skirt) ch.skirt.mesh.material.color.copy(lin(cloth.color));
  layers = layers.filter(L => LAYER_KINDS[L.kind]).slice(0, MAX_LAYERS);
  // Lowered garments (setLowered) are measured as such; ch.layers keeps the originals.
  const cov = layers.map(L => ch.lowered && ch.lowered.has(L) ? { ...L, lowered: true } : L);
  // The bunched rolls only show while the lowered garment is actually worn, and lowered
  // briefs only once nothing worn over them (bottoms still up) hides them.
  const bottomsUp = layers.some(L => L.kind === 'bottom' && !(ch.lowered && ch.lowered.has(L)));
  for (const B of (ch.bunches || new Map()).values())
    { B.mesh.visible = B.gusset.visible = layers.includes(B.L) && !(B.L.kind === 'briefs' && bottomsUp); B.inner.visible = B.mesh.visible && !B.strip; }
  // Limb cones by tag+side, so ellipsoid muscles can report position along their limb.
  const limbCone = {};
  spec.prims.forEach(P => { if (P.type === 'cone' && P.tag) limbCone[P.tag + P.side] = P; });
  const A = geo.attributes.layerA.array, B = geo.attributes.layerB.array;
  A.fill(NONE); B.fill(NONE);
  // How much of each vertex moves with a thigh, smoothed over its neighbours (the
  // top-4 weights jump a little from vertex to vertex, which made a ragged edge).
  if (!geo.userData.thighW) {
    const skinIdx = geo.attributes.skinIndex.array, skinW = geo.attributes.skinWeight.array;
    const iL = BONES.indexOf('thighL'), iR = BONES.indexOf('thighR');
    let tw = new Float32Array(nV);
    for (let v = 0; v < nV; v++) for (let k = 0; k < 4; k++) if (skinIdx[4 * v + k] === iL || skinIdx[4 * v + k] === iR) tw[v] += skinW[4 * v + k];
    const idx3 = geo.index.array, sum = new Float32Array(nV), cnt = new Float32Array(nV);
    for (let it = 0; it < 3; it++) {
      sum.set(tw); cnt.fill(1);
      for (let i = 0; i < idx3.length; i += 3) for (let e = 0; e < 3; e++) {
        const a = idx3[i + e], b = idx3[i + (e + 1) % 3];
        sum[a] += tw[b]; cnt[a]++; sum[b] += tw[a]; cnt[b]++;
      }
      tw = sum.map((s, v) => s / cnt[v]);
    }
    geo.userData.thighW = tw;
    geo.userData.crease = thighCreases(spec, pos, tw);
    // The crease's lowest point on either thigh (along the thigh from the hip), for lowered briefs.
    spec.dims.creaseLow = Math.max(...geo.userData.crease.L.c, ...geo.userData.crease.R.c);
    // Each vertex's distance to the crease, for the marks' lower edge (see addMark).
    const cd = geo.attributes.creaseD.array, q = [0, 0, 0];
    for (let v = 0; v < nV; v++) { q[0] = pos[3 * v]; q[1] = pos[3 * v + 1]; q[2] = pos[3 * v + 2]; cd[v] = creaseDistance(geo.userData.crease, q); }
    geo.attributes.creaseD.needsUpdate = true;
  }
  const crease = geo.userData.crease;
  const p = [0, 0, 0], sums = new Float64Array(layers.length);
  for (let v = 0; v < nV; v++) {
    p[0] = pos[3 * v]; p[1] = pos[3 * v + 1]; p[2] = pos[3 * v + 2];
    sums.fill(0);
    let ws = 0, pw = 0;
    for (let k = 0; k < BASIS_K; k++) {
      const wk = w[v * BASIS_K + k];
      if (!wk) break;
      const P = spec.prims[idx[v * BASIS_K + k]];
      if (P.tag === 'perineum') pw += wk;
      const LC = P.tag ? limbCone[P.tag + P.side] : null;
      const t = LC ? coneT(p, LC) : 0, cl = LC ? Math.sqrt(LC.l2) : 0;
      for (let l = 0; l < layers.length; l++) sums[l] += wk * clamp(layerCoverage(spec, cov[l], P, p, t, cl), -0.03, 0.03);
      ws += wk;
    }
    // Briefs (not trunks) stop at the crease where the thigh takes over, so their leg
    // openings never paint skin that swings out with the legs.
    const toCrease = creaseDistance(crease, p);
    for (let l = 0; l < layers.length; l++) {
      let c = sums[l] / ws;
      // The base between the thighs (the perineum piece) is exempt: that skin moves
      // partly with the thighs, but it's what the gusset is there to cover.
      if (layers[l].kind === 'briefs' && !layers[l].leg && !cov[l].lowered) c = Math.min(c, Math.max(toCrease, (pw / ws - 0.15) * 0.05));
      (l < 4 ? A : B)[4 * v + (l & 3)] = c;
    }
  }
  geo.attributes.layerA.needsUpdate = true; geo.attributes.layerB.needsUpdate = true;
  const u = ch.mesh.material.userData.uniforms;
  u.uLayer.value.forEach((c, l) => c.copy(layers[l] ? lin(layers[l].color) : u.uSkin.value));
  ch.layers = layers;
}
// The crease where each thigh takes over from the torso, as a smooth curve: around
// the thigh's axis (CREASE_BINS angles), how far down the axis from the hip joint
// the skin that mostly moves with the thigh (smoothed weight over THIGH_LIMIT)
// begins. Taken from the skin weights, so it matches how the mesh actually bends;
// smoothed around the circle, because the weights themselves are uneven vertex to
// vertex and an edge drawn straight from them comes out scalloped.
const CREASE_BINS = 72;
function thighCreases(spec, pos, tw) {
  const H = spec.H, nV = pos.length / 3, out = {};
  for (const [side, s] of [['L', 1], ['R', -1]]) {
    const hip = spec.J['thigh' + side], d = norm(sub(spec.J['shin' + side], hip));
    const e1 = norm(sub([0, 0, 1], mul(d, d[2]))), e2 = cross(d, e1);
    const top = new Float32Array(CREASE_BINS).fill(Infinity);
    for (let v = 0; v < nV; v++) {
      if (tw[v] < THIGH_LIMIT || pos[3 * v] * s <= 0) continue;
      const q = sub([pos[3 * v], pos[3 * v + 1], pos[3 * v + 2]], hip), t = dot(q, d);
      if (t < -0.05 * H || t > 0.25 * H) continue;
      const b = Math.floor((Math.atan2(dot(q, e2), dot(q, e1)) / (2 * Math.PI) + 0.5) * CREASE_BINS) % CREASE_BINS;
      top[b] = Math.min(top[b], t);
    }
    // Fill any empty angle from its neighbours, then smooth around the circle.
    let c = Array.from(top);
    for (let it = 0; it < CREASE_BINS && c.some(x => x === Infinity); it++)
      c = c.map((x, i) => x !== Infinity ? x : Math.min(c[(i + 1) % CREASE_BINS], c[(i + CREASE_BINS - 1) % CREASE_BINS]));
    for (let it = 0; it < 4; it++)
      c = c.map((x, i) => (c[(i + CREASE_BINS - 2) % CREASE_BINS] + c[(i + CREASE_BINS - 1) % CREASE_BINS] + x + c[(i + 1) % CREASE_BINS] + c[(i + 2) % CREASE_BINS]) / 5);
    out[side] = { hip, d, e1, e2, c };
  }
  return out;
}
// Signed distance (metres, along the thigh axis) from a rest-pose point to the crease
// of the thigh on its side: positive on the torso side, negative on the thigh.
function creaseDistance(crease, p) {
  const C = crease[p[0] >= 0 ? 'L' : 'R'];
  const q = sub(p, C.hip), t = dot(q, C.d);
  const f = (Math.atan2(dot(q, C.e2), dot(q, C.e1)) / (2 * Math.PI) + 0.5) * CREASE_BINS - 0.5;
  const i = Math.floor(f), u = f - i, a = C.c[(i + CREASE_BINS) % CREASE_BINS], b = C.c[(i + 1 + CREASE_BINS) % CREASE_BINS];
  return a + (b - a) * u - t;
}

// A new skin tone on a built character (no rebuild).
function setSkin(ch, hex) {
  ch.spec.m.skin = hex;
  const u = ch.mesh.material.userData.uniforms;
  u.uSkin.value.copy(lin(hex));
  if (ch.face) for (const lm of [ch.face.lidMat, ...ch.face.lidMats]) lm.color.copy(lin(hex));   // eyelids match
  if (ch.spec.m.lipColor == null) u.uLipCol.value.copy(lin(hex)).lerp(lin(0xa84a52), ch.spec.m.build === 'male' ? 0.22 : 0.62);
}

// The head is meshed separately at HEAD_VOXEL × the body's voxel size, so the jaw
// line and profile stay smooth close up. The body mesh stops at a cut through the
// mid-neck (HEAD_CUT × height below the chin) and the head mesh starts HEAD_OVERLAP
// below that. In the overlap both lie on the same surface; the body's copy is
// drawn in by a little (0.3 mm at the bottom of the band, 1.5 mm at the cut) so the
// head mesh always draws on top. The band sits on the straight part of the neck:
// on the concave throat under the jaw, coarse triangles bulge outward by more
// than that and poke through.
const HEAD_VOXEL = 0.4, HEAD_CUT = 0.018, HEAD_OVERLAP = 0.012;
// Regions meshed finer than the body: the head, and each hand (from a cut across
// the forearm just above the wrist). Each has an axis coordinate s(p), the cut
// (body triangles beyond it are dropped) and the start of the overlap band.
const HAND_VOXEL = 0.3, HAND_CUT = -0.012, HAND_OVERLAP = 0.012;
function fineRegions(spec, h) {
  const H = spec.H, yCut = spec.Y.chin - HEAD_CUT * H;
  const regions = [{ h: h * HEAD_VOXEL, s: p => p[1], cut: yCut, from: yCut - HEAD_OVERLAP * H }];
  regions[0].box = headBounds(spec, regions[0].from);
  for (const side of ['L', 'R']) {
    const wr = spec.J['hand' + side], dir = norm(sub(wr, spec.J['forearm' + side]));
    const cut = HAND_CUT * H, from = cut - HAND_OVERLAP * H;
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    const grow = (p, r) => { for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], p[i] - r); hi[i] = Math.max(hi[i], p[i] + r); } };
    for (const P of spec.prims) if (P.bone === 'hand' + side || P.bone === 'fingers' + side || P.bone === 'thumb' + side || P.bone === 'thumb2' + side) { grow(P.box.lo, 0); grow(P.box.hi, 0); }
    grow(add(wr, mul(dir, from)), spec.m.wrist / 100 / (2 * Math.PI) * 1.4);
    regions.push({ h: h * HAND_VOXEL, s: p => dot(sub(p, wr), dir), cut, from, box: { lo, hi } });
  }
  return regions;
}
const inBox = (p, B, m = 0) => p[0] >= B.lo[0] - m && p[0] <= B.hi[0] + m && p[1] >= B.lo[1] - m && p[1] <= B.hi[1] + m && p[2] >= B.lo[2] - m && p[2] <= B.hi[2] + m;

const HINGE_BLEND = 0.012;   // × height, each side of an elbow or knee (about 2 cm)
function buildMesh(spec, h) {
  const t0 = performance.now();
  prepareBounds(spec);
  const regions = fineRegions(spec, h);
  const body = polygonize(spec, h);
  const fine = regions.map(R => polygonize(spec, R.h, R.box));
  // Merge: body quads entirely past a region's cut (and inside it) are dropped, as
  // are fine quads entirely before the overlap; unused vertices are removed.
  const pos = [], cellH = [], quads = [], remap = new Map();
  const at = (src, i) => [src[3 * i], src[3 * i + 1], src[3 * i + 2]];
  const addVert = (src, i, hv, key) => {
    let id = remap.get(key);
    if (id === undefined) { id = pos.length / 3; remap.set(key, id); pos.push(...at(src, i)); cellH.push(hv); }
    return id;
  };
  const pastCut = p => regions.some(R => inBox(p, R.box, 0.01) && R.s(p) > R.cut);
  for (const q of body.quads) {
    if (q.some(i => i < 0) || q.every(i => pastCut(at(body.pos, i)))) continue;
    quads.push(q.map(i => addVert(body.pos, i, h, 'b' + i)));
  }
  fine.forEach((F, r) => {
    const R = regions[r];
    for (const q of F.quads) {
      if (q.some(i => i < 0) || q.every(i => R.s(at(F.pos, i)) < R.from)) continue;
      quads.push(q.map(i => addVert(F.pos, i, R.h, r + ':' + i)));
    }
  });
  const evals = body.evals + fine.reduce((s, F) => s + F.evals, 0);
  const nV = pos.length / 3;
  const tPoly = performance.now();

  // Project vertices onto the zero set (two Newton steps) and take normals from the gradient.
  const normals = new Float32Array(nV * 3);
  const positions = new Float32Array(pos);
  for (let v = 0; v < nV; v++) {
    const hv = cellH[v], e = hv * 0.2;
    const p = [positions[3 * v], positions[3 * v + 1], positions[3 * v + 2]];
    for (let it = 0; it < 2; it++) {
      const d = field(spec, p);
      const g = gradient(spec, p, e, d);
      const gg = dot(g, g) || 1;
      const step = clamp(d / gg, -hv, hv);
      p[0] -= g[0] * step; p[1] -= g[1] * step; p[2] -= g[2] * step;
    }
    const n = norm(gradient(spec, p, e, field(spec, p)));
    // Body vertices in an overlap band sit just inside the finer mesh's surface.
    if (hv === h) for (const R of regions) {
      if (!inBox(p, R.box, 0.01) || R.s(p) <= R.from) continue;
      const inset = 0.0003 + 0.0012 * smooth01(R.from, R.cut, R.s(p));
      p[0] -= n[0] * inset; p[1] -= n[1] * inset; p[2] -= n[2] * inset;
      break;
    }
    positions.set(p, 3 * v);
    normals.set(n, 3 * v);
  }

  const tProj = performance.now();
  // Triangles, wound to agree with the field gradient.
  const index = [];
  const P3 = i => [positions[3 * i], positions[3 * i + 1], positions[3 * i + 2]];
  for (const q of quads) {
    if (q.some(i => i < 0)) continue;
    const [a, b, c, d] = q;
    const pa = P3(a), pb = P3(b), pc = P3(c), pd = P3(d);
    const split = len(sub(pa, pc)) < len(sub(pb, pd));
    const tris = split ? [[a, b, c], [a, c, d]] : [[a, b, d], [b, c, d]];
    for (const [x, y, z] of tris) {
      const fn = cross(sub(P3(y), P3(x)), sub(P3(z), P3(x)));
      const vn = [normals[3 * x] + normals[3 * y] + normals[3 * z], normals[3 * x + 1] + normals[3 * y + 1] + normals[3 * z + 1], normals[3 * x + 2] + normals[3 * y + 2] + normals[3 * z + 2]];
      if (dot(fn, vn) < 0) index.push(x, z, y); else index.push(x, y, z);
    }
  }

  // Skin weights: softmax over primitive distances, primitives → bones.
  const sigma = 0.011 * spec.H;
  const nP = spec.prims.length;
  const dists = new Float32Array(nP);
  const skinIndex = new Uint16Array(nV * 4), skinWeight = new Float32Array(nV * 4);
  const hairCov = new Float32Array(nV), softAttr = new Float32Array(nV), wcolors = new Float32Array(nV * 3);
  // The strongest BASIS_K primitives at each vertex and their weights, kept so that
  // clothing can be recomputed later (dress) without redoing this pass.
  const basisIdx = new Uint16Array(nV * BASIS_K), basisW = new Float32Array(nV * BASIS_K);
  const cand = [];
  const boneIdx = {}; BONES.forEach((b, i) => boneIdx[b] = i);
  const wc = new THREE.Color();
  for (let v = 0; v < nV; v++) {
    const p = P3(v);
    field(spec, p, dists);
    const side = p[0] > 0.004 ? 1 : p[0] < -0.004 ? -1 : 0;
    let dmin = Infinity;
    for (let i = 0; i < nP; i++) {
      const P = spec.prims[i];
      if (side && P.side && P.side !== side) continue;
      if (dists[i] < dmin) dmin = dists[i];
    }
    const acc = {};
    let hsum = 0, wsum = 0, ssum = 0;
    cand.length = 0;
    for (let i = 0; i < nP; i++) {
      const P = spec.prims[i];
      if (side && P.side && P.side !== side) continue;
      const w = Math.exp(-(dists[i] - dmin) / sigma);
      if (w < 0.01) continue;
      const bw = P.type === 'loft' ? loftWeights(spec, p[1]) : [[P.bone, 1]];
      for (const [bn, f] of bw) acc[bn] = (acc[bn] || 0) + w * f;
      // Hairline distance, clamped so one far-away value can't dominate the blend.
      hsum += w * clamp(hairCoverage(P, spec, p), -0.03, 0.03);
      ssum += w * softness(spec, P.tag || P.group, P.type === 'loft', p[1]);
      wsum += w;
      cand.push([i, w]);
    }
    // Elbows and knees: the two limb segments lie in a line at rest, so near the joint
    // a vertex is almost as close to one as the other and the distance softmax shares
    // it between them over ±5 cm or so, which pinches the joint thin when it bends.
    // Instead their combined weight is split across the joint over ±HINGE_BLEND.
    for (const [pa, cb, jp, dir] of spec.hinges) {
      const mass = (acc[pa] || 0) + (acc[cb] || 0);
      if (!mass || !acc[pa] || !acc[cb]) continue;
      const f = smooth01(-HINGE_BLEND * spec.H, HINGE_BLEND * spec.H, dot(sub(p, jp), dir));
      acc[pa] = mass * (1 - f); acc[cb] = mass * f;
    }
    // Crotch: above the body's crotch point and near the centre line the skin sits
    // between both thighs, and blending the two as they open drags it into a slot up
    // the middle. There the pelvis carries it, as on a mannequin, handing over to each
    // thigh halfway out to its hip joint. Below the crotch point the inner thighs
    // stay entirely with their legs.
    if (p[1] < spec.J.thighL[1]) {
      const hx = spec.J.thighL[0], cy = crotchY(spec);
      const give = (1 - smooth01(0.2 * hx, 0.6 * hx, Math.abs(p[0]))) * smooth01(cy - 0.004 * spec.H, cy + 0.02 * spec.H, p[1]);
      for (const t of ['thighL', 'thighR']) if (acc[t] && give > 0) { acc.pelvis = (acc.pelvis || 0) + acc[t] * give; acc[t] *= 1 - give; }
    }
    cand.sort((a, b) => b[1] - a[1]);
    for (let k = 0; k < Math.min(BASIS_K, cand.length); k++) { basisIdx[v * BASIS_K + k] = cand[k][0]; basisW[v * BASIS_K + k] = cand[k][1]; }
    const top = Object.entries(acc).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const sum = top.reduce((s, [, w]) => s + w, 0);
    wc.setRGB(0, 0, 0);
    top.forEach(([bn, w], i) => {
      skinIndex[4 * v + i] = boneIdx[bn];
      skinWeight[4 * v + i] = w / sum;
      wc.r += BONE_HUE[bn].r * w / sum; wc.g += BONE_HUE[bn].g * w / sum; wc.b += BONE_HUE[bn].b * w / sum;
    });
    hairCov[v] = hsum / wsum;
    softAttr[v] = ssum / wsum;
    wcolors.set([wc.r, wc.g, wc.b], 3 * v);
  }

  const tSkin = performance.now();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(wcolors, 3));
  geo.setAttribute('hairCov', new THREE.BufferAttribute(hairCov, 1));
  geo.setAttribute('soft', new THREE.BufferAttribute(softAttr, 1));
  geo.setAttribute('creaseD', new THREE.BufferAttribute(new Float32Array(nV).fill(1), 1));   // set by dress
  geo.setAttribute('layerA', new THREE.BufferAttribute(new Float32Array(nV * 4).fill(NONE), 4));
  geo.setAttribute('layerB', new THREE.BufferAttribute(new Float32Array(nV * 4).fill(NONE), 4));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
  geo.setIndex(index);
  geo.userData.basis = { idx: basisIdx, w: basisW };
  return { geo, stats: { verts: nV, tris: index.length / 3, evals, ms: Math.round(performance.now() - t0),
    stages: { surface: Math.round(tPoly - t0), project: Math.round(tProj - tPoly), weights: Math.round(tSkin - tProj) } } };
}

// ════════════════════════════════════════════════════════════════
// CHARACTER — skeleton + skinned mesh + rigid hair/eyes
// ════════════════════════════════════════════════════════════════

const SKIN = 0xe9c6a5;
const ALL_MATS = new Set();
const lin = hex => new THREE.Color(hex).convertSRGBToLinear();

// Standard PBR material, patched so the base colour comes from the clothing layers
// over the skin (outfit view) or the vertex colours (weight view).
function makeBodyMaterial(m) {
  const mat = new THREE.MeshStandardMaterial({ skinning: true, roughness: 0.62, metalness: 0, vertexColors: true });
  mat.extensions = { derivatives: true };
  const skin = lin(m.skin || SKIN);
  const u = {
    uSkin: { value: skin }, uHair: { value: lin(m.outfit.hair) },
    uLayer: { value: Array.from({ length: MAX_LAYERS }, () => skin.clone()) },   // set by dress()
    uWeights: { value: 0 },
    // Contact compression: skin above the palm plane (point uPressP, outward normal
    // uPressN, mesh-local space) within radius uPressR is flattened onto the plane.
    uPressP: { value: new THREE.Vector3() }, uPressN: { value: new THREE.Vector3(0, 1, 0) },
    uPressR: { value: 0.06 }, uPressAmt: { value: 0 },
    // A long footprint (a paddle's blade): unit axis across the plane (xyz) and half-length
    // (w); the radius is then measured from that segment. w = 0 for a round one.
    uPressAx: { value: new THREE.Vector4() },
    // How far above the plane skin is still flattened (2 cm for a hand; deeper for a blade).
    uPressDepth: { value: 0.02 },
    // Second slot, for the resting left hand (same rule).
    uPressP2: { value: new THREE.Vector3() }, uPressN2: { value: new THREE.Vector3(0, 1, 0) },
    uPressR2: { value: 0.06 }, uPressAmt2: { value: 0 },
    // Fingers pressing the skin: up to CAPS capsules (mesh-local; A = start xyz + radius, B = end xyz
    // + how far in contact, 0–1). Skin inside one is pushed in along its own normal until it
    // clears the finger, so a pad dents the flesh the way the palm plane does.
    uCapA: { value: Array.from({ length: CAPS }, () => new THREE.Vector4()) }, uCapB: { value: Array.from({ length: CAPS }, () => new THREE.Vector4()) }, uCapN: { value: 0 },
    // Contact: the partner's posed proxies (see CONTACT; set by updateContacts).
    uCE: { value: Array.from({ length: CONTACT_ELL * 4 }, () => new THREE.Vector4()) },
    uCC: { value: Array.from({ length: CONTACT_CONE * 2 }, () => new THREE.Vector4()) },
    uCSoft: { value: new Array(CONTACT_CONE).fill(0) },
    uContactN: { value: new THREE.Vector2() },
    // Marks (see addMark): per side, centre in rest space, strength and radius.
    uMarkP: { value: [new THREE.Vector3(), new THREE.Vector3()] }, uMarkAmt: { value: [0, 0] },
    uMarkReach: { value: [new THREE.Vector3(1, 1, 1), new THREE.Vector3(1, 1, 1)] },
    uMarkRegion: { value: new THREE.Vector4() }, uMarkCol: { value: lin(MARK_COLOR) },
    // Lip colour: the skin warmed toward a rose, less on male builds (or preset lipColor).
    uLipCol: { value: m.lipColor != null ? lin(m.lipColor) : skin.clone().lerp(lin(0xa84a52), m.build === 'male' ? 0.22 : 0.62) },
    // The painted lips' shape in rest space (spec.mouth, set in buildCharacter):
    // mouth line y, upper and lower heights, half-width; and the depth in front of which it applies.
    uMouth: { value: new THREE.Vector4(-9, 0, 0, 1) }, uMouthZ: { value: 0 },
    uMouthCorner: { value: new THREE.Vector2() },   // expression: left and right corners up/down (faceStep)
    uMouthOpen: { value: new THREE.Vector3(1, 0, 0) },   // expression: opening half-width, half-height, teeth (faceStep)
    // Finger joints (see FINGER_BEND_GLSL; set by buildCharacter and setFingerBend).
    uFingerK: { value: [new THREE.Vector3(), new THREE.Vector3()] }, uFingerDir: { value: [new THREE.Vector3(1, 0, 0), new THREE.Vector3(1, 0, 0)] },
    uFingerBend: { value: new THREE.Vector2() }, uFingerJ: { value: new THREE.Vector3(1, 1, 0.001) },
  };
  mat.userData.uniforms = u;
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 layerA, layerB;\nattribute float hairCov, creaseD;\nvarying vec4 vLayerA, vLayerB;\nvarying float vHair, vCrease;\nvarying vec3 vRest;\nuniform vec3 uPressP, uPressN, uPressP2, uPressN2;\nuniform vec4 uPressAx;\nuniform float uPressR, uPressAmt, uPressR2, uPressAmt2, uPressDepth;\nuniform vec4 uCapA[' + CAPS + '], uCapB[' + CAPS + '];\nuniform float uCapN;' + CONTACT_GLSL + FINGER_BEND_GLSL)
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvec3 fbPos = vec3(position);\nbendFingers(fbPos, objectNormal);')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed = fbPos;\nvLayerA = layerA; vLayerB = layerB; vHair = hairCov; vRest = position; vCrease = creaseD;')
      .replace('#include <skinning_vertex>', `#include <skinning_vertex>
        if (uPressAmt > 0.0) {
          vec3 dP = transformed - uPressP;
          float hP = dot(dP, uPressN);                        // height above the palm plane
          vec3 acP = dP - hP * uPressN;                       // across the plane
          acP -= uPressAx.xyz * clamp(dot(acP, uPressAx.xyz), -uPressAx.w, uPressAx.w);
          float rP = length(acP);                             // distance across it (from the axis segment, if long)
          // Only skin near the palm: within the radius across the plane, and no more than
          // uPressDepth above it, fading over 1.5 cm beyond (other body parts along the
          // normal are untouched).
          float wP = (1.0 - smoothstep(uPressR * 0.55, uPressR, rP)) * (1.0 - smoothstep(uPressDepth, uPressDepth + 0.015, hP)) * uPressAmt;
          // Everything above the plane (and a soft band just below it) is pushed down,
          // so the skin conforms to the palm with a rounded edge rather than a crease.
          float excess = max(hP + 0.006, 0.0);
          float pushed = excess - 0.006 * (1.0 - exp(-excess / 0.006));
          transformed -= uPressN * pushed * wP;
          #ifndef FLAT_SHADED
            float flatW = wP * smoothstep(-0.004, 0.004, hP);
            vNormal = normalize(mix(vNormal, normalize(normalMatrix * uPressN), flatW));
          #endif
        }
        if (uPressAmt2 > 0.0) {                                // second slot: resting left hand
          vec3 dQ = transformed - uPressP2;
          float hQ = dot(dQ, uPressN2);
          float rQ = length(dQ - hQ * uPressN2);
          float wQ = (1.0 - smoothstep(uPressR2 * 0.55, uPressR2, rQ)) * (1.0 - smoothstep(0.02, 0.035, hQ)) * uPressAmt2;
          float excessQ = max(hQ + 0.006, 0.0);
          float pushedQ = excessQ - 0.006 * (1.0 - exp(-excessQ / 0.006));
          transformed -= uPressN2 * pushedQ * wQ;
          #ifndef FLAT_SHADED
            float flatQ = wQ * smoothstep(-0.004, 0.004, hQ);
            vNormal = normalize(mix(vNormal, normalize(normalMatrix * uPressN2), flatQ));
          #endif
        }
        // Fingers: skin inside a finger capsule is pushed in along its own normal until it
        // clears the finger (a dent as deep as the finger is round), fading out past its edge.
        for (int ci = 0; ci < ${CAPS}; ci++) {
          if (float(ci) >= uCapN) break;
          vec3 pa = uCapA[ci].xyz, ba = uCapB[ci].xyz - pa;
          float rC = uCapA[ci].w;
          float hh = clamp(dot(transformed - pa, ba) / max(dot(ba, ba), 1e-8), 0.0, 1.0);
          vec3 dd = transformed - (pa + ba * hh);
          float hN = dot(dd, objectNormal);                    // below the finger's axis is negative
          float xx = length(dd - hN * objectNormal);
          float dent = max(sqrt(max(rC * rC - xx * xx, 0.0)) + hN, 0.0);
          float wC = (1.0 - smoothstep(rC * 0.9, rC * 1.35, xx)) * (1.0 - smoothstep(0.0, 0.6 * rC, hN)) * uCapB[ci].w;
          transformed -= objectNormal * dent * wC;
        }` + CONTACT_VERTEX);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec4 vLayerA, vLayerB;\nvarying float vHair, vCrease;\nuniform vec3 uLipCol;\nuniform vec4 uMouth;\nuniform float uMouthZ;\nuniform vec2 uMouthCorner;\nuniform vec3 uMouthOpen;\nvarying vec3 vRest;\nuniform vec3 uSkin, uHair, uLayer[${MAX_LAYERS}], uMarkP[2], uMarkReach[2], uMarkCol;\nuniform float uMarkAmt[2];\nuniform vec4 uMarkRegion;\nuniform float uWeights;`)
      .replace('#include <color_fragment>', `
        // Each layer's edge distance, thresholded over about a pixel; innermost first.
        vec4 wa = fwidth(vLayerA) * 0.75 + 1e-5, wb = fwidth(vLayerB) * 0.75 + 1e-5;
        vec4 ca = smoothstep(-wa, wa, vLayerA), cb = smoothstep(-wb, wb, vLayerB);
        float wh = fwidth(vHair) * 0.75 + 1e-5;
        // Marks (see addMark): each side's colour spreads from its centre as it deepens,
        // reaching the edge of the region (glute and top of thigh, behind) at full
        // strength. Painted into the skin, so clothing layers cover it.
        float mk = 0.0;
        // Lower edge: follows the crease where each thigh meets the glute (vCrease, metres
        // along the thigh, negative on the thigh), full to just past it and fading out
        // gradually by uMarkRegion.w down the thigh, so it has no hard line.
        float inBand = smoothstep(-uMarkRegion.w, -0.004, vCrease) * (1.0 - smoothstep(uMarkRegion.y - 0.025, uMarkRegion.y + 0.01, vRest.y));
        float behind = 1.0 - smoothstep(-0.03, 0.0, vRest.z);
        for (int i = 0; i < 2; i++) {
          float s = i == 0 ? 1.0 : -1.0, f = uMarkAmt[i];
          if (f <= 0.0) continue;
          vec3 d = vRest - uMarkP[i];
          vec3 q = vec3(s * d.x > 0.0 ? d.x / uMarkReach[i].z : d.x / max(abs(s * uMarkP[i].x), 0.03),
                        d.y > 0.0 ? d.y / uMarkReach[i].x : d.y / uMarkReach[i].y, d.z / 0.2);
          // Spreads as it deepens: the solid core reaches the whole region (1 in these
          // units) by full strength, with a soft rim beyond it that the region trims.
          float reach = mix(0.3, 1.45, f);
          float spread = 1.0 - smoothstep(reach - 0.35, reach, length(q));
          float side = smoothstep(-0.012, 0.004, s * vRest.x) * (1.0 - smoothstep(uMarkRegion.z, uMarkRegion.z + 0.03, s * vRest.x));
          mk = max(mk, f * spread * side * inBand * behind);
        }
        vec3 outfitCol = mix(uSkin, uMarkCol, mk);
        // Lips: tinted where the lip shapes carry the surface, darker along the line
        // where upper meets lower.
        // Painted lips, per pixel from the rest position: an upper and a lower half-ellipse
        // over the mouth line, tapering to the corners, with a fine closed-mouth line.
        if (vRest.z > uMouthZ) {
          // The mouth line bends toward each corner by that corner's expression (up to 5 mm
          // at the corner, easing in from the middle); the lips follow the line.
          float ex = vRest.x / uMouth.w;
          float dy = vRest.y - uMouth.x - (ex > 0.0 ? uMouthCorner.x : uMouthCorner.y) * ex * ex * 0.005;
          // The mouth's current half-width A and opening half-height B (uMouthOpen: A = the
          // closed half-width and B = 0 when shut), and how far the teeth are bared.
          float A = uMouthOpen.x, B = uMouthOpen.y, T = uMouthOpen.z;
          float xa = vRest.x / A, rim = sqrt(max(0.0, 1.0 - xa * xa));
          float edge = fwidth(dy) + 0.0004;
          // Lips: an upper and lower half-ellipse around the opening.
          float outer = (B + (dy >= 0.0 ? uMouth.y : uMouth.z)) * rim;
          // The parting: the open mouth's oval, or the lips drawn back off clenched teeth
          // (narrower than the mouth), whichever is larger.
          float xt = vRest.x / (0.85 * A), rimT = sqrt(max(0.0, 1.0 - xt * xt));
          float gap = max(B * rim, T * 0.8 * uMouth.y * rimT);
          float inOuter = (1.0 - smoothstep(-edge, edge, abs(dy) - outer)) * step(abs(xa), 1.0);
          float inGap = (1.0 - smoothstep(-edge, edge, abs(dy) - gap)) * step(abs(xa), 1.0);
          outfitCol = mix(outfitCol, uLipCol, inOuter);
          // Inside: a dark mouth, the upper teeth hanging from the top of the parting and the
          // lower rising from its bottom (touching, with a bite line, when clenched). The
          // open mouth shows some teeth even when not bared.
          float tU = 1.3 * uMouth.y * (0.6 + 0.4 * T);
          float tL = 1.0 * uMouth.z * (0.3 + 0.7 * T);
          float upperT = smoothstep(-edge, edge, dy - max(0.0, gap - tU));
          float lowerT = 1.0 - smoothstep(-edge, edge, dy - min(0.0, -gap + tL));
          float teethAmt = max(upperT, lowerT) * (T > 0.001 || B > 0.0005 ? 1.0 : 0.0);
          vec3 teethCol = vec3(0.78, 0.74, 0.66) * (1.0 - 0.55 * xa * xa);
          vec3 inside = mix(vec3(0.07, 0.02, 0.02), teethCol, teethAmt);
          float bite = (1.0 - smoothstep(0.0002, 0.0002 + edge, abs(dy))) * step(gap, tU) * teethAmt;
          inside *= 1.0 - 0.6 * bite;
          outfitCol = mix(outfitCol, inside, inGap);
          // Closed: a fine line where the lips meet.
          float line = (1.0 - smoothstep(0.00025, 0.00025 + edge * 1.5, abs(dy))) * (1.0 - smoothstep(0.75, 1.0, abs(ex))) * (1.0 - step(0.0002, gap));
          outfitCol *= 1.0 - 0.4 * line;
        }
        outfitCol = mix(outfitCol, uLayer[0], ca.x);
        outfitCol = mix(outfitCol, uLayer[1], ca.y);
        outfitCol = mix(outfitCol, uLayer[2], ca.z);
        outfitCol = mix(outfitCol, uLayer[3], ca.w);
        outfitCol = mix(outfitCol, uLayer[4], cb.x);
        outfitCol = mix(outfitCol, uLayer[5], cb.y);
        outfitCol = mix(outfitCol, uLayer[6], cb.z);
        outfitCol = mix(outfitCol, uLayer[7], cb.w);
        outfitCol = mix(outfitCol, uHair, smoothstep(-wh, wh, vHair));
        diffuseColor.rgb = mix(outfitCol, vColor, uWeights);
      `);
  };
  ALL_MATS.add(mat);
  return mat;
}

// `m` is a measurement set (see PRESETS). Options: voxel (mesh resolution in
// metres), key (an id carried on the result), weights / wire (debug views).
function buildCharacter(m, { voxel = 0.010, key = null, weights = false, wire = false } = {}) {
  const spec = buildSpec(m);
  const { geo, stats } = buildMesh(spec, voxel);

  // Bones at rest-pose joint positions (identity rest rotations).
  const bones = {};
  for (const name of BONES) { bones[name] = new THREE.Bone(); bones[name].name = name; }
  for (const name of BONES) {
    const parent = PARENT[name];
    const w = spec.J[name];
    const pw = parent ? spec.J[parent] : [0, 0, 0];
    bones[name].position.set(w[0] - pw[0], w[1] - pw[1], w[2] - pw[2]);
    if (parent) bones[parent].add(bones[name]);
  }

  const bustRest = { L: bones.bustL.position.clone(), R: bones.bustR.position.clone() };
  const mesh = new THREE.SkinnedMesh(geo, makeBodyMaterial(m));
  {
    // Finger joints: each hand's knuckle, the direction along its fingers, and the
    // middle and end joints' distance from the knuckle (see FINGER_BEND_GLSL).
    const u = mesh.material.userData.uniforms, fl = FINGERS[1][1] * 0.106 * spec.H;
    ['L', 'R'].forEach((s, i) => {
      u.uFingerK.value[i].set(...spec.J['fingers' + s]);
      u.uFingerDir.value[i].set(...norm(sub(spec.J['fingers' + s], spec.J['hand' + s])));
    });
    u.uFingerJ.value.set(FINGER_JOINTS[0] * fl, FINGER_JOINTS[1] * fl, 0.003 * spec.H / 1.7);
  }
  if (spec.mouth) {
    const Mo = spec.mouth, u = mesh.material.userData.uniforms;
    u.uMouth.value.set(Mo.y, Mo.hu, Mo.hl, Mo.w); u.uMouthZ.value = Mo.zMin;
  }
  mesh.material.wireframe = wire;
  mesh.material.userData.uniforms.uWeights.value = weights ? 1 : 0;
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.add(bones.pelvis);
  mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(BONES.map(n => bones[n])));

  const hairDef = addHead(spec, bones.head);

  const group = new THREE.Group();
  group.add(mesh);
  const helper = new THREE.SkeletonHelper(mesh);
  helper.material.depthTest = false;
  helper.material.transparent = true;
  helper.visible = false;

  const ch = { key, spec, mesh, bones, group, helper, stats, bustRest, pose: {}, target: {}, proxies: buildProxies(spec) };
  const tDress = performance.now();
  dress(ch);
  stats.stages.dress = Math.round(performance.now() - tDress);
  makeHair(ch, hairDef);
  ch.face = hairDef.face;
  ch.expr = { ...EXPR_DEFAULTS, ...(m.expr || {}) };
  faceStep(ch, 0);
  setPose(ch, 'Relaxed', true);
  return ch;
}

// ════════════════════════════════════════════════════════════════
// EXPRESSION — the face's moving parts: brows, lids, gaze and the painted mouth's
// corners, set from ch.expr (a preset's `expr`, see EXPR_DEFAULTS) plus idle life:
// blinks and small eye movements. The face's shape itself is fixed at build.
//   browInner, browOuter: raise (−1…1).   browFurrow: inner ends drawn down and in (0…1).
//   browAsym: the left brow higher (+) or the right (−).
//   lidUpper: the upper lid raised (+, eyes wide) or lowered (−, heavy).  squint: the
//   lower lid raised (0…1).   gazeX, gazeY: resting gaze, + to her left / up (−1…1).
//   mouthL, mouthR: each corner of the mouth up (+) or down (−) (−1…1).
//   saccade: how often and how far the eyes move on their own (0…1); contact: how
//   strongly they come back to the resting gaze (0…1); blink: blink rate (× normal).
// Call faceStep every frame with everyone on set (it also animates).
// ════════════════════════════════════════════════════════════════
//   teeth: lips parted to show clenched teeth (0…1).   mouthOpen: the mouth open (0…1),
//   its opening always the circumference of the closed mouth traced top and bottom
//   (twice the mouth line), so it narrows as it opens, to a circle at 1.
const EXPR_DEFAULTS = { browInner: 0, browOuter: 0, browFurrow: 0, browAsym: 0, lidUpper: 0, squint: 0,
  gazeX: 0, gazeY: 0, mouthL: 0, mouthR: 0, teeth: 0, mouthOpen: 0, saccade: 0.4, contact: 0.5, blink: 1 };
// Moods: added on top of a character's own expression, blended in and out over a
// quarter of a second (setMood). The values are offsets; the result is clamped.
const MOODS = {
  effort:    { teeth: 0.9, mouthL: -0.3, mouthR: -0.3, browFurrow: 0.6, browInner: -0.2, squint: 0.6, lidUpper: -0.35 },
  enjoyment: { teeth: 0.75, mouthL: 0.75, mouthR: 0.75, squint: 0.45, browOuter: 0.1 },
  open:      { mouthOpen: 0.8, browInner: 0.3, browOuter: 0.25, lidUpper: 0.3 },
};
const EXPR_RANGE = { browFurrow: [0, 1], squint: [0, 1], teeth: [0, 1], mouthOpen: [0, 1], saccade: [0, 1], contact: [0, 1], blink: [0, 3] };
function setMood(ch, name, amount = 1) { ch.mood = MOODS[name] ? { name, target: amount } : null; }
// A character's version of a mood: their preset's `moods[name]` if it has one (each
// character can be tuned; see the viewer), otherwise the shared MOODS entry.
const moodFor = (m, name) => (m.moods && m.moods[name]) || MOODS[name];
// The open mouth's semi-axes [half-width, half-height] (metres) for openness t, keeping
// the perimeter (Ramanujan's approximation) at 4 × the closed half-width w.
function mouthOpening(w, t) {
  const P = 4 * w, b = t * 2 * w / Math.PI;
  const per = a => Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
  let lo = b, hi = w * 1.02;
  for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (per(m) < P) lo = m; else hi = m; }
  return [(lo + hi) / 2, b];
}
const _fq = new THREE.Quaternion(), _fv = new THREE.Vector3(), _fp = new THREE.Vector3(), _fo = new THREE.Vector3();
function faceStep(ch, dt) {
  const F = ch.face;
  if (!F || !ch.expr) return;
  // The expression in effect: the character's own, plus the current mood's offsets
  // (blended in and out over a quarter of a second).
  const mv = ch.moodVal || (ch.moodVal = { name: null, amt: 0 });
  const tgt = ch.mood ? ch.mood.target : 0;
  if (ch.mood && ch.mood.name !== mv.name) { if (mv.amt < 0.02) mv.name = ch.mood.name; }
  const want = ch.mood && ch.mood.name === mv.name ? tgt : 0;
  mv.amt += (want - mv.amt) * (dt > 0 ? 1 - Math.exp(-dt / 0.08) : 1);
  let e = ch.expr;
  if (mv.name && mv.amt > 0.001) {
    e = { ...e };
    for (const [k, v] of Object.entries(moodFor(ch.spec.m, mv.name))) {
      const [lo, hi] = EXPR_RANGE[k] || [-1, 1];
      e[k] = clamp((e[k] || 0) + v * mv.amt, lo, hi);
    }
  }
  const A = ch.faceAnim || (ch.faceAnim = { t: 0, nextBlink: 1 + Math.random() * 3, blink: 0, gx: 0, gy: 0, tx: 0, ty: 0, nextSacc: 0.5 });
  A.t += dt;
  // Blinks: a quick close and open (0.16 s), every 2–6 s / rate.
  if (A.t >= A.nextBlink) { A.blinkT = 0; A.nextBlink = A.t + (2 + Math.random() * 4) / Math.max(0.1, e.blink); }
  if (A.blinkT != null) { A.blinkT += dt; A.blink = Math.max(0, 1 - Math.abs(A.blinkT / 0.08 - 1)); if (A.blinkT > 0.16) { A.blinkT = null; A.blink = 0; } }
  // Eye movements: jump to a new target (near the resting gaze, wider with saccade),
  // or back to it (more often with contact); held for a while in between.
  if (A.t >= A.nextSacc) {
    const back = Math.random() < e.contact, amp = 0.15 + 0.6 * e.saccade;
    A.tx = back ? 0 : (Math.random() * 2 - 1) * amp; A.ty = back ? 0 : (Math.random() * 2 - 1) * amp * 0.5;
    A.nextSacc = A.t + (0.4 + Math.random() * 2.5) * (1.4 - e.saccade);
  }
  const k = dt > 0 ? 1 - Math.exp(-dt * 30) : 1;      // eyes move fast
  A.gx += (A.tx - A.gx) * k; A.gy += (A.ty - A.gy) * k;
  const H = F.H, gx = clamp(e.gazeX + A.gx, -1, 1), gy = clamp(e.gazeY + A.gy, -1, 1);
  for (const S of F.sides) {
    const s = S.s, E = S.E;
    // Gaze: iris and pupil across the white.
    const off = new THREE.Vector3(gx * 0.0022 * H * E, gy * 0.0014 * H * E, 0);
    S.iris.position.copy(S.irisC).add(off); S.pupil.position.copy(S.pupilC).add(off);
    // Lids: the upper line follows lidUpper and gaze (the lid follows the eye up and
    // down); the lower rises with squint; a blink brings the upper down to the lower.
    let up = S.lidUp + e.lidUpper * 0.0012 * H * E + gy * 0.0006 * H * E;
    const low = S.lidLow + e.squint * 0.0022 * H * E;
    up = Math.max(low + 0.0004 * H, Math.min(S.ry * 0.98, up));
    up = up + (low + 0.0002 * H - up) * A.blink;
    // The lids' clipping planes, in world space: the upper lid keeps what's above its
    // line, the lower what's below its own.
    const hq = F.head.getWorldQuaternion(_fq), upW = _fv.set(0, 1, 0).applyQuaternion(hq);
    S.lidU.material.clippingPlanes[0].setFromNormalAndCoplanarPoint(upW, F.head.localToWorld(_fp.copy(S.c).add(_fo.set(0, up, 0))));
    S.lidL.material.clippingPlanes[0].setFromNormalAndCoplanarPoint(upW.clone().negate(), F.head.localToWorld(_fp.copy(S.c).add(_fo.set(0, low, 0))));
    S.lashU.position.copy(S.c).addScaledVector(S.o, 0.0014 * H).add(new THREE.Vector3(0, up, 0));
    S.lashL.position.copy(S.c).addScaledVector(S.o, 0.0010 * H).add(new THREE.Vector3(0, low, 0));
    // Brows: raise the whole brow by the mean of inner and outer, roll by their
    // difference; the furrow draws the inner end down and toward the centre.
    const asym = e.browAsym * s * 0.5;
    const ri = e.browInner - e.browFurrow * 0.7 + asym, ro = e.browOuter + asym;
    S.brow.position.copy(S.browC).add(new THREE.Vector3(-s * e.browFurrow * 0.0012 * H, (ri + ro) / 2 * 0.003 * H, 0));
    S.brow.rotation.z = S.browRoll - s * (ri - ro) * 0.18;
  }
  // Mouth corners, for the painted lips (see the body shader).
  const u = ch.mesh.material.userData.uniforms;
  if (u.uMouthCorner) u.uMouthCorner.value.set(e.mouthL, e.mouthR);
  if (u.uMouthOpen && ch.spec.mouth) {
    const [a, b] = mouthOpening(ch.spec.mouth.w, e.mouthOpen);
    u.uMouthOpen.value.set(a, b, e.teeth);
  }
}
function setExpression(ch, expr) { ch.expr = { ...EXPR_DEFAULTS, ...expr }; faceStep(ch, 0); }

// Eyes are rigid meshes on the head bone (local = world − head joint at rest). Hair
// on the scalp and buns are part of the skinned surface; hanging hair is simulated.
function addHead(spec, headBone) {
  const H = spec.H * spec.m.head, J = spec.J.head, Y = spec.Y;
  const hairMat = new THREE.MeshStandardMaterial({ color: lin(spec.m.outfit.hair), roughness: 0.55 });
  const Fp = faceParams(spec.m), hairHex = spec.m.outfit.hair;
  const scleraMat = new THREE.MeshStandardMaterial({ color: lin(0xeee8df), roughness: 0.35 });
  const irisMat = new THREE.MeshStandardMaterial({ color: lin(spec.m.eyeColor || 0x3d2616), roughness: 0.3 });
  const pupilMat = new THREE.MeshStandardMaterial({ color: lin(0x070605), roughness: 0.15 });
  const lashMat = new THREE.MeshStandardMaterial({ color: lin(0x0d0a08), roughness: 0.6 });
  const browMat = new THREE.MeshStandardMaterial({ color: lin(hairHex), roughness: 0.8 });
  const at = (x, y, z) => new THREE.Vector3(x - J[0], y - J[1], z - J[2]);
  const blob = (r, sx, sy, sz, p, mat = hairMat) => {
    const g = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 20), mat);
    g.scale.set(sx, sy, sz); g.position.copy(p); g.castShadow = true;
    headBone.add(g); return g;
  };
  // Eyes: an almond of white set into the face (found by marching in from the front),
  // an iris and pupil on its front, a dark lash line along the upper lid and a softer
  // one below; then a brow above each. Sizes follow the eye and brow face parameters.
  const surfaceZ = (x, y) => { let z = 0.12 * H; while (z > 0 && field(spec, [x, y, z]) > 0.0005) z -= 0.0005; return z; };
  const piece = (geo, mat, pos, scale, rot) => {
    const m = new THREE.Mesh(geo, mat); m.position.copy(pos); m.scale.set(...scale); if (rot) m.rotation.set(...rot);
    headBone.add(m); return m;
  };
  const sph = new THREE.SphereGeometry(1, 28, 18), E = Fp.eye;
  // Eyelids, in the skin colour: an upper lid whose lower edge is the upper lid line, and
  // a lower lid whose top edge is the lower one. Expressions and blinks move them (faceStep).
  const lidMat = new THREE.MeshStandardMaterial({ color: lin(spec.m.skin || SKIN), roughness: 0.62 });
  const face = { H, lidMat, lidMats: [], head: headBone, sides: [] };
  for (const s of [1, -1]) {
    const x = s * 0.0165 * H * Fp.eyeGap, y = Y.chin + (0.064 + 0.006 * Fp.eyeHeight) * H, z = surfaceZ(x, y);
    const turn = [0, s * 0.16, 0];                                   // eyes follow the curve of the face
    const o = new THREE.Vector3(Math.sin(turn[1]), 0, Math.cos(turn[1]));
    const c = at(x, y, z - 0.0016 * H);
    // Youth opens the eye: a taller white, the upper lid (lash line) lifted clear of the
    // iris instead of resting over it, and a slightly larger iris.
    const yo = Fp.youth, open = 1 + 0.18 * yo, irisK = 1 + 0.08 * yo;
    const rx = 0.0078 * H * E, ry = 0.0042 * H * E * open, rz = 0.0032 * H;
    piece(sph, scleraMat, c, [rx, ry, rz], turn);
    const iris = piece(sph, irisMat, c.clone().addScaledVector(o, 0.0024 * H), [0.0036 * H * E * irisK, 0.0036 * H * E * irisK, 0.0012 * H], turn);
    const pupil = piece(sph, pupilMat, c.clone().addScaledVector(o, 0.0031 * H), [0.0015 * H * E * irisK, 0.0015 * H * E * irisK, 0.0007 * H], turn);
    // Lids: thin shells just over the white, trimmed along the lid line by a clipping
    // plane (each lid its own material, for its own plane; set in faceStep).
    const lidRy = 0, lidScale = [rx * 1.05, ry * 1.08, rz * 1.35];   // deep enough to cover the iris and pupil when shut
    const lidMatU = lidMat.clone(), lidMatL = lidMat.clone();
    const lidU = piece(sph, lidMatU, c.clone().addScaledVector(o, 0.0002 * H), lidScale, turn), lidL = piece(sph, lidMatL, c.clone().addScaledVector(o, 0.0002 * H), lidScale, turn);
    face.lidMats.push(lidMatU, lidMatL);
    lidMatU.clippingPlanes = [new THREE.Plane()]; lidMatL.clippingPlanes = [new THREE.Plane()];
    const lashU = piece(sph, lashMat, c.clone(), [0.0086 * H * E, 0.0011 * H, 0.0024 * H], [0, turn[1], -s * 0.08]);
    const lashL = piece(sph, lashMat, c.clone(), [0.0068 * H * E, 0.0005 * H, 0.0018 * H], turn);
    lashL.material = new THREE.MeshStandardMaterial({ color: lin(0x5a4034), roughness: 0.7 });
    // Brow: thicker at the inner end, following the ridge, the outer end a little lower.
    const bx = s * 0.0175 * H * Fp.eyeGap, by = y + (0.0098 + 0.0035 * Fp.brow) * H, bz = surfaceZ(bx, by);
    const male = spec.m.build === 'male';
    const browRoll = -s * 0.1 * (1 - Fp.youth);   // outer ends droop less with youth
    const brow = piece(sph, browMat, at(bx, by, bz - 0.0011 * H), [0.0098 * H, (male ? 0.0017 : 0.0011) * H, 0.0022 * H], [0, s * 0.2, browRoll]);
    face.sides.push({ s, c, o, turn, rx, ry, rz, lidRy, E,
      lidUp: (0.0036 + 0.0011 * yo) * H * E, lidLow: -0.0038 * H * E,      // resting lid lines, above/below the centre
      iris, irisC: iris.position.clone(), pupil, pupilC: pupil.position.clone(),
      lidU, lidL, lashU, lashL, brow, browC: brow.position.clone(), browRoll });
  }
  // Hanging hair (ponytail, long hair) is simulated: see HAIR below. Each chain is
  // given as rest-pose node positions (head-local), a segment radius pair
  // [across, depth] per segment, and how strongly it holds its styled shape.
  const cy = spec.H - 0.062 * H;
  const style = spec.m.outfit.hairStyle;
  const chains = [];
  const bob = spec.m.outfit.bobbles || [];
  if (style === 'ponytail') {
    const knot = [0, cy + 0.016 * H, -0.066 * H];
    if (spec.m.outfit.scrunchie != null) {
      // Gathered by the scrunchie: a stub of hair from the scalp out through its hole,
      // held proud of the head along its axis (both ends fixed to the head), then the
      // tail falls from the end of the stub.
      const dir = norm([0, 0.2, -1]), end = add(knot, mul(dir, 0.034 * H));
      chains.push({ tie: bob[0], stiff: 0.004, bias: 1, fixed: 2,
        nodes: [at(...knot), at(...end), ...[1, 2, 3, 4].map(k => at(0, end[1] - k * 0.05 * H, end[2] - 0.004 * H - k * 0.004 * H))],
        rad: [[0.0105 * H, 0.0095 * H], ...[0, 1, 2, 3].map(i => [0.017 * H * (1 - i * 0.14), 0.015 * H * (1 - i * 0.1)])] });
    } else chains.push({ tie: bob[0], stiff: 0.004, bias: 1, nodes: [at(...knot), ...[1, 2, 3, 4].map(k => at(0, knot[1] - k * 0.05 * H, knot[2] - 0.008 * H - k * 0.004 * H))],
      rad: [0, 1, 2, 3].map(i => [0.017 * H * (1 - i * 0.14), 0.015 * H * (1 - i * 0.1)]) });
  } else if (style === 'long') {
    chains.push({ stiff: 0.012, nodes: [0, 1, 2, 3].map(k => at(0, cy - k * 0.058 * H, -0.05 * H - k * 0.004 * H)),
      rad: [[0.052 * H, 0.024 * H], [0.05 * H, 0.022 * H], [0.046 * H, 0.018 * H]] });
    for (const s of [1, -1]) chains.push({ stiff: 0.012, nodes: [0, 1, 2].map(k => at(s * (0.047 + k * 0.001) * H, cy - k * 0.065 * H, -0.012 * H - k * 0.002 * H)),
      rad: [[0.012 * H, 0.02 * H], [0.011 * H, 0.018 * H]] });
  }
  // Hair accessories (outfit.bobbles, outfit.clips; [left, right] where there are two).
  const acc = (hex, rough) => new THREE.MeshStandardMaterial({ color: lin(hex), roughness: rough });
  // A ring hugging a knot of hair (a bun, the ponytail's knot): centred on c (rest
  // space), round the axis dir, its radius probed from that knot's own shape in the
  // ring's plane (not the blended head, which would size it to the whole skull), so
  // it sits snugly. 'gathered' adds a scrunchie's puckered fabric.
  const knotOf = s => spec.prims.find(P => P.tag === 'hairBun' && P.side === s);
  const ring = (knot, c, dir, hex, tube, gathered = false) => {
    const d = norm(dir), e1 = norm(cross(Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], d)), e2 = cross(d, e1);
    let rs = 0;
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * 2 * Math.PI, u = add(mul(e1, Math.cos(a)), mul(e2, Math.sin(a)));
      let t = 0.001; while (t < 0.08 && primDist(add(c, mul(u, t)), knot) < 0) t += 0.0003;
      rs += t / 8;
    }
    const g = new THREE.TorusGeometry(rs + tube * 0.35, tube, 14, 48), P = g.attributes.position;
    if (gathered) for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i), u = Math.atan2(y, x), R0 = rs + tube * 0.35;
      const cx = Math.cos(u) * R0, cy2 = Math.sin(u) * R0, k = 1 + 0.22 * Math.sin(u * 16) + 0.08 * Math.sin(u * 7);
      P.setXYZ(i, cx + (x - cx) * k, cy2 + (y - cy2) * k, z * k);
    }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, acc(hex, gathered ? 0.85 : 0.7));
    m.position.copy(at(...c)); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...d));
    m.castShadow = true; headBone.add(m);
    m.userData.ring = { R: rs + tube * 0.35, tube };
    return m;
  };
  const rings = [];   // solid rings the hanging hair collides with (head-local)
  const cranium = [0, cy, -0.006 * H];
  if (style === 'buns') [1, -1].forEach((s, k) => {
    // A bobble round each bun, far enough out along it that the whole ring clears the
    // head (nearer the base, the bun merges into the scalp and half the ring is hidden).
    if (bob[k] == null) return;
    const bc = add(cranium, [s * 0.034 * H, 0.05 * H, -0.016 * H]), dir = norm([s * 0.034, 0.05, -0.016]);
    ring(knotOf(s), add(bc, mul(dir, 0.003 * H)), dir, bob[k], 0.0042 * H);
  });
  if (style === 'ponytail' && spec.m.outfit.scrunchie != null) {
    // The scrunchie gathers the ponytail where it leaves the scalp, round the knot.
    const knot = add(cranium, [0, 0.016 * H, -0.06 * H]), dir = norm([0, 0.2, -1]);
    const m = ring(knotOf(0), add(knot, mul(dir, 0.004 * H)), dir, spec.m.outfit.scrunchie, 0.0075 * H, true);
    rings.push({ c: m.position.clone(), axis: new THREE.Vector3(...dir), R: m.userData.ring.R, tube: m.userData.ring.tube });
  }
  (spec.m.outfit.clips || []).forEach((hex, k) => {
    // A clip each side, well back from the fringe over the side of the head, lying
    // along the scalp front to back (as if holding the hair back), angled a little.
    const s = k === 0 ? 1 : -1, ang = s * 1.05, y = cy + 0.042 * H;   // over the side of the head, above the temple
    const d = [Math.sin(ang), 0, Math.cos(ang)], p = [0, y, 0];
    let r = 0.2;
    while (r > 0.01 && field(spec, [d[0] * r, y, d[2] * r - 0.006 * H]) > 0) r -= 0.0005;
    p[0] = d[0] * r; p[2] = d[2] * r - 0.006 * H;
    const n = new THREE.Vector3(...norm(gradient(spec, p, 0.001, field(spec, p))));
    const across = new THREE.Vector3(0, 1, 0).cross(n).normalize();
    const along = across.clone().applyAxisAngle(n, s * 0.3);   // front to back over the side of the head, rising a little toward the back
    const up = n.clone().cross(along);
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), acc(hex, 0.35));
    m.scale.set(0.017 * H, 0.0036 * H, 0.0026 * H);
    m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(along, up, n));
    m.position.copy(at(...p)).addScaledVector(n, 0.0018 * H);
    m.castShadow = true; headBone.add(m);
  });
  return { chains, hairMat, H, rings, face };
}

// ════════════════════════════════════════════════════════════════
// HAIR — each hanging chain is a row of nodes: the first is fixed to the head,
// the rest are simulated (Verlet) under gravity, pulled gently back toward their
// styled shape in the head's frame, kept at fixed spacing, and pushed out of
// capsules around the bodies nearby and above the floor. Each segment is drawn
// as a stretched ellipsoid between its two nodes, its width following the head's
// side-to-side axis.
// ════════════════════════════════════════════════════════════════
const HAIR_GRAVITY = new THREE.Vector3(0, -9.8, 0);
function makeHair(ch, def) {
  ch.hairRings = def.rings || [];
  ch.hair = def.chains.map(c => {
    const meshes = c.rad.map(() => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), def.hairMat);
      m.castShadow = true; ch.group.add(m); return m;
    });
    const len = c.nodes.slice(1).map((n, i) => n.distanceTo(c.nodes[i]));
    // A bobble round the chain near its tip, carried by the last segment.
    let tieMesh = null;
    if (c.tie != null) {
      // Near the end of the tail: 70% along the last segment, where the drawn ellipsoid
      // is about 0.9 of its full width.
      const [rx, rz] = c.rad[c.rad.length - 1], R = (rx + rz) / 2 * 0.9;
      const g = new THREE.TorusGeometry(R, 0.0048 * def.H, 12, 32); g.rotateX(Math.PI / 2);   // axis along the chain
      tieMesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: lin(c.tie), roughness: 0.3 }));
      tieMesh.castShadow = true; ch.group.add(tieMesh);
    }
    return { ...c, meshes, len, tieMesh, p: null, prev: null };
  });
}
function hairReset(ch) { if (ch.hair) for (const c of ch.hair) c.p = null; }

// Capsules approximating a body as posed: [a, b, radius] in world space.
function bodyColliders(ch) {
  const w = n => ch.bones[n].getWorldPosition(new THREE.Vector3());
  const spec = ch.spec, m = spec.m, R = C => C / 100 / (2 * Math.PI);
  const depth = y => { const r = loftRing(spec.prims[0], y); return (r[1] + r[2]) / 2; };
  const head = ch.bones.head.localToWorld(new THREE.Vector3(...sub(spec.headInfo.c, spec.J.head)));
  const caps = [
    [w('pelvis'), w('spine1'), depth(spec.Y.hip)], [w('spine1'), w('spine2'), depth(spec.Y.waist)],
    [w('spine2'), w('neck'), depth(spec.Y.bust) * 0.95], [w('neck'), w('head'), R(m.neck)],
    [head, head, 0.058 * spec.headInfo.hs],
  ];
  for (const s of ['L', 'R']) caps.push(
    [w('clav' + s), w('upperArm' + s), R(m.arm) * 1.2], [w('upperArm' + s), w('forearm' + s), R(m.arm)],
    [w('forearm' + s), w('hand' + s), R(m.forearm)], [w('hand' + s), w('fingers' + s), 0.012 * spec.H],
    [w('thigh' + s), w('shin' + s), R(m.thigh)], [w('shin' + s), w('foot' + s), R(m.calf) * 0.9]);
  return caps;
}
const _hA = new THREE.Vector3(), _hB = new THREE.Vector3(), _hC = new THREE.Vector3();
function pushOutOfCapsule(p, a, b, r) {
  _hA.subVectors(b, a);
  const L2 = _hA.lengthSq();
  const t = L2 > 1e-10 ? clamp(_hB.subVectors(p, a).dot(_hA) / L2, 0, 1) : 0;
  _hC.copy(a).addScaledVector(_hA, t);
  const d = p.distanceTo(_hC);
  if (d < r && d > 1e-6) p.addScaledVector(_hB.subVectors(p, _hC), (r - d) / d);
}

// Steps every hair chain on `ch`. `colliders` are capsules (see bodyColliders)
// from everyone in the scene, this character included.
function hairStep(ch, dt, colliders) {
  if (!ch.hair || !ch.hair.length) return;
  const head = ch.bones.head, hq = head.getWorldQuaternion(new THREE.Quaternion());
  // Solid rings in the hair (a scrunchie): each a loop of short capsules round its tube.
  if (ch.hairRings && ch.hairRings.length) {
    colliders = colliders.slice();
    for (const R of ch.hairRings) {
      const c = head.localToWorld(R.c.clone()), ax = R.axis.clone().applyQuaternion(hq).normalize();
      const e1 = new THREE.Vector3(0, 1, 0).cross(ax).normalize(), e2 = ax.clone().cross(e1);
      const pt = k => c.clone().addScaledVector(e1, Math.cos(k / 12 * 2 * Math.PI) * R.R).addScaledVector(e2, Math.sin(k / 12 * 2 * Math.PI) * R.R);
      for (let k = 0; k < 12; k++) colliders.push([pt(k), pt(k + 1), R.tube]);
    }
  }
  const inv = ch.group.matrixWorld.clone().invert(), gq = ch.group.getWorldQuaternion(new THREE.Quaternion()).invert();
  const world = c => c.nodes.map(n => head.localToWorld(n.clone()));
  const steps = Math.max(1, Math.ceil(dt / (1 / 60))), h = Math.min(dt, 1 / 20) / steps;
  for (const c of ch.hair) {
    const rest = world(c);
    // (Re)start from the styled shape on the first frame or after a jump (a scene change).
    // A centred ponytail starts a little to one side (`bias`, + = the character's left), so
    // it falls off to that side when the head is down instead of balancing on the spine.
    if (!c.p || c.p[0].distanceTo(rest[0]) > 0.25) {
      const side = new THREE.Vector3(1, 0, 0).applyQuaternion(hq).multiplyScalar(0.012 * (c.bias || 0));
      c.p = rest.map((v, i) => v.clone().addScaledVector(side, i)); c.prev = c.p.map(v => v.clone());
    }
    const nodeR = c.rad.map(([x, z]) => Math.min(x, z) * 0.9);
    for (let s = 0; s < steps; s++) {
      const F = c.fixed || 1;   // the first F nodes are fixed to the head
      for (let i = 0; i < F; i++) { c.p[i].copy(rest[i]); c.prev[i].copy(rest[i]); }
      for (let i = F; i < c.p.length; i++) {
        const v = c.p[i].clone().sub(c.prev[i]).multiplyScalar(0.94);
        c.prev[i].copy(c.p[i]);
        c.p[i].add(v).addScaledVector(HAIR_GRAVITY, h * h);
        // A light pull toward the styled shape (the rest offset from the previous
        // node, in the head's frame); weak enough that gravity wins when the head tips.
        c.p[i].lerp(c.p[i - 1].clone().add(rest[i].clone().sub(rest[i - 1])), c.stiff);
      }
      for (let it = 0; it < 3; it++) {
        for (let i = F; i < c.p.length; i++) {
          // Fixed spacing.
          const d = c.p[i].clone().sub(c.p[i - 1]), l = d.length() || 1e-6;
          c.p[i].copy(c.p[i - 1]).addScaledVector(d, c.len[i - 1] / l);
          const r = nodeR[i - 1];
          for (const [a, b, cr] of colliders) pushOutOfCapsule(c.p[i], a, b, cr + r);
          if (c.p[i].y < r) c.p[i].y = r;
        }
      }
    }
    // Draw each segment between its nodes.
    const side = new THREE.Vector3(1, 0, 0).applyQuaternion(hq);
    c.meshes.forEach((m, i) => {
      const a = c.p[i], b = c.p[i + 1], along = b.clone().sub(a), L = along.length() || 1e-6;
      along.divideScalar(L);
      const x = side.clone().addScaledVector(along, -side.dot(along));
      if (x.lengthSq() < 1e-6) x.set(1, 0, 0).addScaledVector(along, -along.x);
      x.normalize();
      const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, along, x.clone().cross(along)));
      m.position.copy(a.clone().add(b).multiplyScalar(0.5)).applyMatrix4(inv);
      m.quaternion.copy(gq).multiply(q);
      const [rx, rz] = c.rad[i];
      m.scale.set(rx, L * 0.78, rz);
      if (i === c.meshes.length - 1 && c.tieMesh) {
        c.tieMesh.position.copy(a.clone().addScaledVector(along, L * 0.7)).applyMatrix4(inv);
        c.tieMesh.quaternion.copy(gq).multiply(q);
      }
    });
  }
}

// ════════════════════════════════════════════════════════════════
// POSES — Euler degrees per bone, relative to the A-pose rest.
// Signs: thigh/forearm −X swings forward; shin +X bends the knee;
// spine +X leans forward; upperArmL −Z lowers the left arm (R mirrored).
// ════════════════════════════════════════════════════════════════
const POSES = {
  'A-pose':   {},
  // Arms hang a little off the body with soft elbows; feet a touch apart, the left knee eased.
  'Relaxed':  { upperArmL: [-3, 0, -35], upperArmR: [-3, 0, 35], forearmL: [-20, 0, 0], forearmR: [-20, 0, 0], thighL: [-3, 0, -3], thighR: [0, 0, 3], shinL: [6, 0, 0], shinR: [2, 0, 0] },
  'T-pose':   { upperArmL: [0, 0, 45], upperArmR: [0, 0, -45] },
  'Arms up':  { upperArmL: [0, 0, 120], upperArmR: [0, 0, -120], clavL: [0, 0, 12], clavR: [0, 0, -12], spine2: [-6, 0, 0] },
  'Reach':    { upperArmL: [-70, 0, 60], forearmL: [-10, 0, 0], upperArmR: [0, 0, 38], forearmR: [-20, 0, 0], thighR: [-25, 0, 0], shinR: [20, 0, 0], spine1: [-4, 0, 6] },
  'Lunge':    { thighL: [-60, 0, 0], shinL: [65, 0, 0], footL: [-5, 0, 0], thighR: [28, 0, 0], shinR: [30, 0, 0], footR: [-20, 0, 0], upperArmL: [0, 0, -25], upperArmR: [0, 0, 25], pelvis: [0, 0, 0] },
  'Sit':      { thighL: [-90, 0, -4], thighR: [-90, 0, 4], shinL: [90, 0, 0], shinR: [90, 0, 0], upperArmL: [-30, 0, -35], upperArmR: [-30, 0, 35], forearmL: [-40, 0, 0], forearmR: [-40, 0, 0] },
  'Bow':      { pelvis: [18, 0, 0], thighL: [-18, 0, 0], thighR: [-18, 0, 0], spine1: [18, 0, 0], spine2: [14, 0, 0], neck: [8, 0, 0], upperArmL: [0, 0, -40], upperArmR: [0, 0, 40] },
  'Twist':    { pelvis: [0, 12, 0], spine1: [0, -18, 0], spine2: [0, -18, 0], upperArmL: [30, 0, 10], upperArmR: [-40, 0, -10], forearmL: [-60, 0, 0], forearmR: [-70, 0, 0] },
  // Standing still, arms at the sides, head lowered (waiting; facing a wall).
  'Wait':     { upperArmL: [-4, 0, -41], upperArmR: [-4, 0, 41], forearmL: [-10, 0, 0], forearmR: [-10, 0, 0], thighL: [0, 0, -1], thighR: [0, 0, 1], neck: [16, 0, 0], head: [8, 0, 0] },
  // Standing with the eyes cast down (the head and neck bowed); the arms are left to IK (see handsTogether).
  'Downcast': { upperArmL: [-4, 0, -41], upperArmR: [-4, 0, 41], forearmL: [-10, 0, 0], forearmR: [-10, 0, 0], thighL: [0, 0, -1], thighR: [0, 0, 1], spine2: [5, 0, 0], neck: [22, 0, 0], head: [20, 0, 0] },
  // Standing, watching: weight on the left leg, right knee soft, arms loose.
  'Watch':    { upperArmL: [2, 0, -40], upperArmR: [-6, 0, 39], forearmL: [-14, 0, 0], forearmR: [-22, 0, 0], thighL: [0, 0, -3], thighR: [-6, 0, 1], shinR: [10, 0, 0], footR: [-4, 0, 0], pelvis: [0, 0, 2], spine1: [0, 0, -2], neck: [4, 0, 0] },
};

const degQ = e => new THREE.Quaternion().setFromEuler(new THREE.Euler(e[0] * Math.PI / 180, e[1] * Math.PI / 180, e[2] * Math.PI / 180, 'YXZ'));
// Fingers curl toward the palm about −Z on the left hand and +Z on the right (in
// the A-pose frame); unless a pose says otherwise they rest slightly curled.
const HAND_REST = { fingersL: [0, 0, -16], fingersR: [0, 0, 16] };
// Later layers override earlier ones bone by bone.
function poseQuats(...layers) {
  const out = {};
  for (const b of BONES) {
    let e = HAND_REST[b] || [0, 0, 0];
    for (const L of layers) if (L && L[b]) e = L[b];
    out[b] = degQ(e);
  }
  return out;
}
// Swaps left/right bones and flips the side-to-side (Y, Z) angles.
const mirrorPose = P => {
  const out = {};
  for (const [b, e] of Object.entries(P)) {
    const m = b.endsWith('L') ? b.slice(0, -1) + 'R' : b.endsWith('R') ? b.slice(0, -1) + 'L' : b;
    out[m] = [e[0], -e[1], -e[2]];
  }
  return out;
};

// A wide stance: the relaxed pose with straight legs opened until the ankles are
// `width` × shoulder width apart, centre to centre, and the feet turned back flat.
// Spreading the legs lifts the feet, so it also returns `drop`, how far the body has
// to come down (metres) to keep them on the floor.
function wideStance(ch, width = 2) {
  const J = ch.spec.J, hip = J.thighL, ank = J.footL;
  const dx = ank[0] - hip[0], dy = hip[1] - ank[1], legLen = Math.hypot(dx, dy);
  const rest = Math.atan2(dx, dy);                       // the A-pose's own slight spread
  const half = width * ch.spec.m.shoulders / 100 / 2;
  const ang = Math.asin(clamp((half - hip[0]) / legLen, -1, 1));
  const a = (ang - rest) * 180 / Math.PI;
  return {
    pose: { ...POSES.Relaxed, thighL: [0, 0, a], thighR: [0, 0, -a], shinL: [0, 0, 0], shinR: [0, 0, 0], footL: [0, 0, -a], footR: [0, 0, a] },
    drop: legLen * (Math.cos(rest) - Math.cos(ang)),
  };
}

// Target pose by name (POSES) or as an Euler map; `instant` also snaps the current pose.
function setPose(ch, pose, instant = false) {
  const P = typeof pose === 'string' ? POSES[pose] : pose;
  ch.target = poseQuats(P);
  if (instant || !ch.pose || !ch.pose.pelvis) ch.pose = {};
  for (const b of BONES) if (instant || !ch.pose[b]) ch.pose[b] = ch.target[b].clone();
  if (instant) for (const b of BONES) ch.bones[b].quaternion.copy(ch.pose[b]);
}

// Back to a neutral standing state: group at the origin facing +Z, relaxed pose,
// no contact compression, springs settled. Used when a character changes scene.
function resetCharacter(ch, pose = 'Relaxed') {
  ch.group.position.set(0, 0, 0);
  ch.group.quaternion.identity();
  ch.group.rotation.set(0, 0, 0);
  ch.group.visible = true;
  const u = ch.mesh.material.userData.uniforms;
  u.uPressAmt.value = 0; u.uPressAmt2.value = 0; u.uCapN.value = 0;
  ch.jig = null;
  ch.dancer = null;
  ch.handsOnHead = false;
  ch.handsTogether = null;
  ch.lookAtCh = null;   // another character whose face this one looks toward
  hairReset(ch);
  if (ch.skirt) ch.skirt.p = null;   // the cloth restarts from its rest shape where the body now is
  for (const side of ['L', 'R']) ch.bones['bust' + side].position.copy(ch.bustRest[side]);
  setPose(ch, pose, true);
  ch.group.updateMatrixWorld(true);
}

function disposeCharacter(ch) {
  if (ch.group.parent) ch.group.parent.remove(ch.group);
  if (ch.helper.parent) ch.helper.parent.remove(ch.helper);
  ch.mesh.geometry.dispose(); ch.mesh.material.dispose(); ALL_MATS.delete(ch.mesh.material);
  ch.group.traverse(o => { if (o.isMesh && o !== ch.mesh) { o.geometry.dispose(); o.material.dispose(); } });
}

// ── Feet on the floor ──
// A dancer's poses each set their own knee bends, and the body is lowered by a fixed
// amount per move, so without help the feet land at different heights (a foot hanging
// in the air, the other sunk into the floor). After the pose is applied, every foot
// whose sole is within PLANT_MAX of the floor is planted: the body comes down only if
// a straightened leg can't reach, then each planted leg is re-solved (two-bone IK,
// knee kept in its own direction) to put the sole on the floor, and the foot is laid
// flat, keeping its heading. A foot higher than that (a kick) is left in the air.
const PLANT_MAX = 0.15;
const _gq = new THREE.Quaternion(), _gq2 = new THREE.Quaternion(), _gv = new THREE.Vector3(), _gv2 = new THREE.Vector3();
function setWorldQuat(bone, qWorld) {
  bone.quaternion.copy(bone.parent.getWorldQuaternion(_gq2).invert().multiply(qWorld));
  bone.updateMatrixWorld(true);
}
function groundFeet(ch) {
  const B = ch.bones, hA = ch.spec.J.footL[1];
  ch.group.updateMatrixWorld(true);
  const legs = ['L', 'R'].map(s => {
    const hip = B['thigh' + s].getWorldPosition(new THREE.Vector3()), knee = B['shin' + s].getWorldPosition(new THREE.Vector3()), ank = B['foot' + s].getWorldPosition(new THREE.Vector3());
    return { s, hip, knee, ank, a: hip.distanceTo(knee), b: knee.distanceTo(ank), sole: ank.y - hA };
  });
  const planted = legs.filter(L => L.sole < PLANT_MAX);
  if (!planted.length) return;
  // Bring the body down if a planted leg, straightened, still can't reach the floor.
  let drop = 0;
  for (const L of planted) {
    const reach = (L.a + L.b) * 0.995, dx = L.ank.x - L.hip.x, dz = L.ank.z - L.hip.z;
    const lowest = L.hip.y - Math.sqrt(Math.max(0, reach * reach - dx * dx - dz * dz));
    drop = Math.max(drop, hA - lowest < 0 ? lowest - hA : 0);
  }
  if (drop > 0) {
    ch.group.position.y -= drop; ch.group.updateMatrixWorld(true);
    for (const L of planted) { L.hip.y -= drop; L.knee.y -= drop; L.ank.y -= drop; }
  }
  for (const L of planted) {
    const T = new THREE.Vector3(L.ank.x, hA, L.ank.z);
    const d = T.clone().sub(L.hip), c = clamp(d.length(), Math.abs(L.a - L.b) + 1e-4, (L.a + L.b) * 0.999);
    const u = d.normalize(), v = L.knee.clone().sub(L.hip);
    v.addScaledVector(u, -v.dot(u));
    if (v.lengthSq() < 1e-8) v.set(0, 0, 1).applyQuaternion(ch.group.quaternion).addScaledVector(u, -u.z);
    v.normalize();
    const cosA = clamp((L.a * L.a + c * c - L.b * L.b) / (2 * L.a * c), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
    const kneeNew = L.hip.clone().addScaledVector(u, L.a * cosA).addScaledVector(v, L.a * sinA);
    const thigh = B['thigh' + L.s], shin = B['shin' + L.s], foot = B['foot' + L.s];
    setWorldQuat(thigh, _gq.setFromUnitVectors(_gv.copy(L.knee).sub(L.hip).normalize(), _gv2.copy(kneeNew).sub(L.hip).normalize()).multiply(thigh.getWorldQuaternion(new THREE.Quaternion())));
    const k2 = shin.getWorldPosition(new THREE.Vector3()), a2 = foot.getWorldPosition(new THREE.Vector3());
    setWorldQuat(shin, _gq.setFromUnitVectors(a2.sub(k2).normalize(), _gv2.copy(T).sub(k2).normalize()).multiply(shin.getWorldQuaternion(new THREE.Quaternion())));
    // Flat foot: the character's own upright orientation, turned to the foot's heading.
    const fw = new THREE.Vector3(0, 0, 1).applyQuaternion(foot.getWorldQuaternion(new THREE.Quaternion())); fw.y = 0;
    const gw = new THREE.Vector3(0, 0, 1).applyQuaternion(ch.group.getWorldQuaternion(new THREE.Quaternion())); gw.y = 0;
    if (fw.lengthSq() > 1e-6 && gw.lengthSq() > 1e-6) {
      const yaw = Math.atan2(gw.x * fw.z - gw.z * fw.x, gw.x * fw.x + gw.z * fw.z);
      setWorldQuat(foot, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -yaw).multiply(ch.group.getWorldQuaternion(new THREE.Quaternion())));
    }
  }
}

// Per-frame animation for a character not being driven by a scene: ease the pose
// toward its target, breathe, and blend any dance hand IK over the top.
function animateCharacter(ch, dt, t, rate = 7) {
  if (ch.dancer) ch.dancer.update(dt);
  const a = 1 - Math.exp(-dt * (ch.dancer && ch.dancer.active ? 14 : rate));
  for (const b of BONES) {
    ch.pose[b].slerp(ch.target[b], a);
    ch.bones[b].quaternion.copy(ch.pose[b]);
  }
  const br = Math.sin(t * 1.6 + ch.spec.H * 10) * 0.012;
  ch.bones.spine2.rotateX(-br);
  ch.bones.neck.rotateX(br * 0.8);
  if (ch.dancer) groundFeet(ch);
  if (ch.dancer && ch.dancer.ik && ch.dancer.ikW > 0) { ch.group.updateMatrixWorld(true); danceIK(ch, ch.dancer.ik, ch.dancer.ikW); }
  if (ch.lookAtCh) { ch.group.updateMatrixWorld(true); lookAt(ch, ch.lookAtCh.bones.head.getWorldPosition(new THREE.Vector3()), 0.9); }
  if (ch.handsOnHead) { ch.group.updateMatrixWorld(true); handsOnHead(ch); }
  if (ch.handsTogether) { ch.group.updateMatrixWorld(true); handsTogether(ch, ch.handsTogether); }
}

// Hands resting together, one over the other: 'front' — just below the navel, palms
// toward the body; 'back' — at the small of the back, palms facing away from it. The
// right hand lies against the body and the left over it, fingers angled down and
// across. Set `ch.handsTogether = 'front' | 'back'`.
function handsTogether(ch, where) {
  const spec = ch.spec, H = spec.H, J = spec.J.pelvis, pel = ch.bones.pelvis, front = where === 'front';
  // In front: just below the navel. Behind: the small of the back.
  const y = front ? spec.Y.hip + 0.012 * H : spec.Y.belly + 0.015 * H;
  // Where the body surface is at that height, on the centre line (rest space), cached.
  if (!ch._clasp || ch._clasp.where !== where) {
    const p = [0, y, 0], step = front ? 0.001 : -0.001;
    for (let i = 0; i < 400 && field(spec, p) < 0; i++) p[2] += step;
    ch._clasp = { where, z: p[2] };
  }
  const P = v => pel.localToWorld(new THREE.Vector3(v[0] - J[0], v[1] - J[1], v[2] - J[2]));
  const Dir = v => new THREE.Vector3(...v).transformDirection(pel.matrixWorld);
  const out = front ? 1 : -1, half = 0.0085 * H;
  // Both palms face −Z (toward the body in front, away from it behind), so the
  // surface normal the IK lays them against is +Z in either case.
  const n = Dir([0, 0, 1]);
  for (const [side, layer, x, k] of [['R', 1, 0.008, 1], ['L', 3, -0.008, -1]]) {
    const target = P([x * H, y - (side === 'L' ? 0.006 * H : 0), ch._clasp.z + out * (half * layer + 0.002)]);
    const sh = ch.bones['upperArm' + side].getWorldPosition(new THREE.Vector3());
    const s = side === 'L' ? 1 : -1;
    const pole = sh.clone().add(Dir(front ? [s * 0.3, -0.25, -0.15] : [s * 0.35, -0.2, 0.05]));
    armIKClear(ch, side, target, pole, n, Dir([k * 0.55, -0.83, 0]).normalize());
  }
}

// Both palms flat on the top of the head, fingers pointing toward each other and
// curled onto the scalp, elbows out to the sides. Set `ch.handsOnHead = true`.
function handsOnHead(ch) {
  const { c, hs } = ch.spec.headInfo, J = ch.spec.J.head, head = ch.bones.head;
  const local = v => head.localToWorld(new THREE.Vector3(v[0] - J[0], v[1] - J[1], v[2] - J[2]));
  const centre = local(c), up = local([c[0], c[1] + 1, c[2]]).sub(centre).normalize();
  const side = local([c[0] + 1, c[1], c[2]]).sub(centre).normalize();
  const r = 0.062 * hs, palm = 0.0085 * ch.spec.H;
  for (const [s, k] of [['L', 1], ['R', -1]]) {
    // A point on the crown, a little to this side and toward the back.
    const n = up.clone().multiplyScalar(0.88).addScaledVector(side, k * 0.4)
      .add(local([c[0], c[1], c[2] - 1]).sub(centre).normalize().multiplyScalar(0.18)).normalize();
    const target = centre.clone().addScaledVector(n, r + palm);
    const sh = ch.bones['upperArm' + s].getWorldPosition(new THREE.Vector3());
    armIKClear(ch, s, target, sh.clone().addScaledVector(side, k * 0.4).addScaledVector(up, -0.05), n, side.clone().multiplyScalar(-k));
    wrapFingers(ch, s, q => q.distanceTo(centre) - r, -8, 60);
  }
}

// ════════════════════════════════════════════════════════════════
// DISCIPLINE SCENE — disciplinarian seated on the flight case, subject
// face-down across the lap. Bodies are posed with joint angles; the
// disciplinarian's hands are placed with two-bone IK onto points taken
// from the subject's posed pelvis, so any pairing of measurements lines up.
// Coordinates: the disciplinarian faces +Z; their right hand (−X) swings,
// so the subject's hips sit on that side with the head toward +X.
// The scene is laid out at the world origin (the IK uses world axes).
// ════════════════════════════════════════════════════════════════
const STRIKE_K = 2;   // strike height: steps (~1.4 cm each) up from the glute/thigh fold
// Swing timing, in seconds. `speed` multiplies how fast the arm moves (lift and
// strike); the holds are not scaled.
const DEFAULT_TIMING = { speed: 1, lift: 0.52, strike: 0.09, raisedHold: 0.2, contactHold: 0.35 };

const GIVER_BASE = { thighL: [-90, 0, -5], thighR: [-90, 0, 5], shinL: [90, 0, 0], shinR: [90, 0, 0], footL: [0, 0, 0], footR: [0, 0, 0] };
const GIVER_BEAT = {
  relaxed: { spine1: [8, 0, 0], neck: [10, 0, 0] },
  raised:  { spine1: [2, 0, 0], spine2: [-3, 8, 0], neck: [12, 0, 0] },
  contact: { spine1: [5, 0, 0], spine2: [2, -4, 0], neck: [14, 0, 0] },
};
// Seated with the hands resting on the thighs, for scenes before the subject is in place.
const GIVER_SEATED = { upperArmL: [-30, 0, -35], upperArmR: [-30, 0, 35], forearmL: [-40, 0, 0], forearmR: [-40, 0, 0], spine1: [4, 0, 0] };
// Subject pose is in their own frame: +X bends forward, which is toward the floor here.
const SUBJECT_BASE = {
  thighL: [-52, 0, -3], thighR: [-52, 0, 3], shinL: [10, 0, 0], shinR: [10, 0, 0],
  spine1: [10, 0, 0], spine2: [8, 0, 0], neck: [-18, 0, 0], head: [-8, 0, 0],
  upperArmL: [-75, 0, -30], upperArmR: [-75, 0, 30], forearmL: [-15, 0, 0], forearmR: [-15, 0, 0],
  fingersL: [0, 0, 0], fingersR: [0, 0, 0],   // flat on the floor
};
// SUBJECT_REACT lifts the left leg higher (for left-glute strikes); the mirror
// is used for right strikes.
const SUBJECT_REACT = {
  thighL: [-40, 0, -5], thighR: [-46, 0, 6], shinL: [58, 0, 0], shinR: [38, 0, 0],
  spine1: [2, 0, 0], spine2: [-5, 0, 0], neck: [-40, 0, 0], head: [-16, 0, 0],
  upperArmL: [-55, 0, -26], upperArmR: [-55, 0, 26], forearmL: [-50, 0, 0], forearmR: [-50, 0, 0],
  handL: [-30, 0, 0], handR: [-30, 0, 0],
};
const SUBJ_BASE_Q = poseQuats(SUBJECT_BASE);
const SUBJ_REACT_Q = { L: poseQuats(SUBJECT_BASE, SUBJECT_REACT), R: poseQuats(SUBJECT_BASE, mirrorPose(SUBJECT_REACT)) };
// Both sides at once (a wide implement): halfway between the two, so the reaction is centred.
SUBJ_REACT_Q.B = Object.fromEntries(Object.keys(SUBJ_REACT_Q.L).map(b => [b, SUBJ_REACT_Q.L[b].clone().slerp(SUBJ_REACT_Q.R[b], 0.5)]));
const GIVER_Q = Object.fromEntries(Object.keys(GIVER_BEAT).map(k => [k, poseQuats(GIVER_BASE, GIVER_BEAT[k])]));

// ── Over the case ──────────────────────────────────────────────
// The subject stands facing +X, bent at the hips (the whole body pitched forward about the
// hip joint, the legs kept upright by counter-rotating the thighs), arms straight down to
// palms flat on the case lid ahead of them. The disciplinarian stands at the subject's
// left side (world −Z) facing +Z, turned a little toward the subject's hips, so the
// swinging (right) arm points at the subject's rear exactly as it does from the seat.
// Everything else about the scene (strike fit, press, marks) is shared with the lap.
const CASE_PITCH = 84;   // degrees the torso is pitched forward from upright
const CASE_SUBJECT_BASE = {
  // Legs from a pose-editor report: nearly straight, the soles flat so toes and heels both meet the floor.
  thighL: [-80, -1, -3], thighR: [-80, 1, 3], shinL: [-2, 0, 0], shinR: [-2, 0, 0], footL: [1, 0, 0], footR: [0, 0, 0],
  spine1: [-3, 0, 0], spine2: [-4, 0, 0], neck: [-40, 0, 0], head: [-14, 0, 0],
  upperArmL: [-75, 0, -30], upperArmR: [-75, 0, 30], forearmL: [-15, 0, 0], forearmR: [-15, 0, 0],
};
// Struck: the hips jump forward and the back hollows, the head comes up. The legs are the
// base pose's: they stay straight and planted.
const CASE_SUBJECT_REACT = {
  thighL: CASE_SUBJECT_BASE.thighL, thighR: CASE_SUBJECT_BASE.thighR, shinL: CASE_SUBJECT_BASE.shinL, shinR: CASE_SUBJECT_BASE.shinR, footL: CASE_SUBJECT_BASE.footL, footR: CASE_SUBJECT_BASE.footR,
  spine1: [-12, 0, 0], spine2: [-14, 0, 0], neck: [-48, 0, 0], head: [-16, 0, 0],
  upperArmL: [-75, 0, -30], upperArmR: [-75, 0, 30], forearmL: [-15, 0, 0], forearmR: [-15, 0, 0],
};
// The standing stance, from a pose-editor report: legs nearly straight, the feet planted flat
// (the same for every beat and implement).
const CASE_GIVER_BASE = { thighL: [-1.6, -1.2, 0.6], thighR: [-0.3, 1.5, -5.4], shinL: [-2, -3.5, -0.1], shinR: [-3.7, 3.7, -1.7], footL: [3.2, 1.1, -8.8], footR: [3.5, -1.5, 15.2] };
const CASE_GIVER_BEAT = {
  relaxed: { spine1: [16, 0, 0], spine2: [8, 0, 0], neck: [0, 0, 0] },
  raised:  { spine1: [12, 0, 0], spine2: [4, 8, 0], neck: [4, 0, 0] },
  contact: { spine1: [20, 0, 0], spine2: [10, -4, 0], neck: [6, 0, 0] },
};
// From pose-editor reports. At rest the swinging hand floats just off the near cheek (CASE_REST_HOVER
// m above the skin) with the thumb tucked; the left thumb lies along the back; a far-side strike
// leans the spine forward a further CASE_FAR_LEAN degrees and lifts the right shoulder a little.
const CASE_REST_HOVER = 0.016, CASE_REST_THUMB = [-54, 58, 33], CASE_THUMB_L = [11.2, -1, -8.9];
const CASE_FAR_LEAN = 9.7, CASE_FAR_CLAV = [-0.3, -3.8, 6.2];
const CASE_YAW = -35;      // the disciplinarian's turn toward the subject's hips, degrees
const CASE_GIVER_AT = [0, -0.44];   // where the disciplinarian's pelvis stands (x, z)
const poseTable = (base, beats) => Object.fromEntries(Object.keys(beats).map(k => [k, poseQuats(base, beats[k])]));
const CASE_SUBJ_BASE_Q = poseQuats(CASE_SUBJECT_BASE);
const CASE_SUBJ_REACT_Q = { L: poseQuats(CASE_SUBJECT_BASE, CASE_SUBJECT_REACT), R: poseQuats(CASE_SUBJECT_BASE, mirrorPose(CASE_SUBJECT_REACT)) };
CASE_SUBJ_REACT_Q.B = Object.fromEntries(Object.keys(CASE_SUBJ_REACT_Q.L).map(b => [b, CASE_SUBJ_REACT_Q.L[b].clone().slerp(CASE_SUBJ_REACT_Q.R[b], 0.5)]));
// The paddle's reaction over the case (from a pose-editor report) is a buck, not the other implements'
// reaction: the hips come forward and sink, the knees bend and the feet stay planted where they are (the feet
// turn to stay flat). `shift` is the body's move at full reaction (m, for a 1.58 m subject; world axes).
const CASE_PADDLE_GAZE = { neck: [0.6, 13.8, -3.4], head: [0.8, -25.2, 7.5] };
const CASE_BUCK = { shift: [0.066, -0.025, -0.009], leftHand: [0, 0.025, -0.013],
  spine1: [-12.4, 0, 0], spine2: [-10.9, 0, 0],
  thighL: [-87.5, -1, -3], thighR: [-87.5, 1, 3], shinL: [22.7, 0, 0], shinR: [22.7, 0, 0], footL: [-16.9, 0, 0], footR: [-16.9, 0, 0] };
const CASE_BUCK_Q = { L: poseQuats(CASE_SUBJECT_BASE, CASE_BUCK), R: poseQuats(CASE_SUBJECT_BASE, mirrorPose(CASE_BUCK)) };
CASE_BUCK_Q.B = Object.fromEntries(Object.keys(CASE_BUCK_Q.L).map(b => [b, CASE_BUCK_Q.L[b].clone().slerp(CASE_BUCK_Q.R[b], 0.5)]));
const CASE_GIVER_Q = poseTable(CASE_GIVER_BASE, CASE_GIVER_BEAT);

// ── Hands on knees ─────────────────────────────────────────────
// The subject stands free with straight legs, bent forward at the hips (KNEES_PITCH from upright, nearly level)
// with the legs leaning back (KNEES_LEG_BACK) so the hips sit behind the feet and the weight stays over them,
// palms on the front of the knees. The disciplinarian stands and behaves as over the case (same stance, side
// and reach); only the subject's pose and hands differ, and there is no case. Struck with the hand or hair
// brush, only the head moves; struck with the paddle the knees give lightly and the body leans forward, the feet
// staying planted (the legs are solved to keep them there, see kneesBody).
const KNEES_PITCH = 85, KNEES_LEG_BACK = 12;
const KNEES_BUCK = { dx: 0.03, dy: -0.045, pitch: 6 };   // the paddle's buckle: m forward and down, degrees of lean (1.58 m subject)
const KNEES_SUBJECT_BASE = {
  // (A thigh swings forward with a negative angle, and the body's pitch swings the legs back, so the hip takes both.)
  thighL: [KNEES_LEG_BACK - KNEES_PITCH, 0, -4], thighR: [KNEES_LEG_BACK - KNEES_PITCH, 0, 4], shinL: [0, 0, 0], shinR: [0, 0, 0], footL: [-KNEES_LEG_BACK, 0, 0], footR: [-KNEES_LEG_BACK, 0, 0],
  spine1: [-6, 0, 0], spine2: [-8, 0, 0], neck: [-30, 0, 0], head: [-12, 0, 0],
  upperArmL: [-75, 0, -30], upperArmR: [-75, 0, 30], forearmL: [-15, 0, 0], forearmR: [-15, 0, 0],
  fingersL: [0, 0, -35], fingersR: [0, 0, 35],
};
// Only the head moves when struck.
const KNEES_SUBJECT_REACT = { ...KNEES_SUBJECT_BASE, neck: [-44, 0, 0], head: [-16, 0, 0] };
const KNEES_BASE_Q = poseQuats(KNEES_SUBJECT_BASE);
const KNEES_REACT_Q = { L: poseQuats(KNEES_SUBJECT_BASE, KNEES_SUBJECT_REACT), R: poseQuats(KNEES_SUBJECT_BASE, mirrorPose(KNEES_SUBJECT_REACT)) };
KNEES_REACT_Q.B = Object.fromEntries(Object.keys(KNEES_REACT_Q.L).map(b => [b, KNEES_REACT_Q.L[b].clone().slerp(KNEES_REACT_Q.R[b], 0.5)]));

// ── Hands on head ──────────────────────────────────────────────
// The subject stands free, upright, facing +X, hands on the back of the head with the elbows out.
// The disciplinarian stands as over the case (same stance, same side), the right hand striking the
// rear; the left hand rests at their side while relaxed and against the subject's navel when the
// arm is raised and on contact, steadying them.
const HEAD_SUBJECT_BASE = {
  thighL: [0, 0, -3], thighR: [0, 0, 3], shinL: [0, 0, 0], shinR: [0, 0, 0], footL: [0, 0, 0], footR: [0, 0, 0],
  spine1: [-2, 0, 0], spine2: [-2, 0, 0], neck: [0, 0, 0], head: [0, 0, 0],
  upperArmL: [-75, 0, -30], upperArmR: [-75, 0, 30], forearmL: [-15, 0, 0], forearmR: [-15, 0, 0],
  fingersL: [0, 0, -27.5], fingersR: [0, 0, 27.5],   // a loose curl on the head
};
// Struck: the back hollows, the chest comes forward and the head lifts.
// Struck (from a pose-editor report): the chest comes up, the head goes back, and they rise onto their toes.
const HEAD_RISE = 0.038;   // m for a 1.58 m subject, at full reaction
const HEAD_SUBJECT_REACT = { ...HEAD_SUBJECT_BASE, spine1: [1.5, 0, -1.2], spine2: [-12.9, -0.6, -1.9], neck: [-14, -0.6, 3.6], head: [-4, 0, 0], clavL: [0.2, -2.1, 1],
  thighL: [-0.3, 0, -3.4], footL: [18, 0, 0], footR: [19.5, 0, 0] };
// The paddle's reaction is different: bucking away from it, the hips come forward while the feet stay planted
// (the body pitches about them by `pitch` degrees and the back hollows to bring the chest back), instead of
// rising onto the toes. The feet counter-turn to stay flat.
const HEAD_BUCK = { pitch: 4, spine1: -7, spine2: -7, neck: -3, head: -4 };
const HEAD_BUCK_REACT = { ...HEAD_SUBJECT_BASE, spine1: [HEAD_BUCK.spine1, 0, 0], spine2: [HEAD_BUCK.spine2, 0, 0], neck: [HEAD_BUCK.neck, 0, 0], head: [HEAD_BUCK.head, 0, 0],
  footL: [-HEAD_BUCK.pitch, 0, 0], footR: [-HEAD_BUCK.pitch, 0, 0] };
const HEAD_SUBJ_BASE_Q = poseQuats(HEAD_SUBJECT_BASE);
const HEAD_BUCK_Q = { L: poseQuats(HEAD_SUBJECT_BASE, HEAD_BUCK_REACT), R: poseQuats(HEAD_SUBJECT_BASE, mirrorPose(HEAD_BUCK_REACT)) };
HEAD_BUCK_Q.B = Object.fromEntries(Object.keys(HEAD_BUCK_Q.L).map(b => [b, HEAD_BUCK_Q.L[b].clone().slerp(HEAD_BUCK_Q.R[b], 0.5)]));
// The left hand rests on the front of the subject's left side at the waist (anchor `navel`, from the editor); the
// fingers run around the front.
const HEAD_NAVEL_FINGERS = new THREE.Vector3(0.69, -0.11, 0.72);
const HEAD_SUBJ_REACT_Q = { L: poseQuats(HEAD_SUBJECT_BASE, HEAD_SUBJECT_REACT), R: poseQuats(HEAD_SUBJECT_BASE, mirrorPose(HEAD_SUBJECT_REACT)) };
HEAD_SUBJ_REACT_Q.B = Object.fromEntries(Object.keys(HEAD_SUBJ_REACT_Q.L).map(b => [b, HEAD_SUBJ_REACT_Q.L[b].clone().slerp(HEAD_SUBJ_REACT_Q.R[b], 0.5)]));
// Where each palm goes on the skull: a direction from its centre (head frame: +X the subject's left,
// +Y up, +Z forward), the fingers' direction along the surface, and the elbow's pole (world, from
// the shoulder; out to the side and a little forward).
// The disciplinarian's place and turn. They stand behind the subject's rear plane, square on to the
// subject while relaxed (from a pose-editor report: pelvis at x −29.5 cm, facing the subject, the back
// straight), and turn toward the subject's hips as the arm comes up. Hanging hands (m, × height, from
// the shoulder in the disciplinarian's frame): down, outward and forward.
const HEAD_GIVER_AT = [-0.266, -0.386];
const HEAD_YAW_RELAXED = 9, HEAD_YAW_STRIKE = 30;
const HEAD_HANG = { down: 0.312, out: 0.048, fwd: 0.007 };
// Raised and on contact the turn swings the feet round, so those beats re-plant them with their own leg
// angles (from a pose-editor report); the left hand's place on the navel is the anchor's, the same for both.
const HEAD_STRIKE_LEGS = { thighL: [-7.9, -1.6, -0.7], footL: [12.5, 0.9, -10.1], thighR: [14.4, -0.4, -3.5], footR: [-8.5, -1.5, 15.2] };
const HEAD_GIVER_BEAT = {
  relaxed: { spine1: [3.8, -1.1, -3.9], spine2: [1.3, 1.6, 4], neck: [0, 0, 0] },
  raised:  { ...CASE_GIVER_BEAT.raised, spine1: [13.5, 0, 7.2], spine2: [-3.8, 7.4, 6.3], ...HEAD_STRIKE_LEGS },
  contact: { ...CASE_GIVER_BEAT.contact, spine1: [19.8, 0, -1.4], spine2: [-11, -4.6, 12.3], ...HEAD_STRIKE_LEGS },
};
// The raised arm's elbow (world, from the shoulder: out to the side and a little up) and the gaze's
// trim as the arm is raised (neck and head offsets after the look, local degrees).
const HEAD_POLE_RAISED = new THREE.Vector3(-0.184, -0.12, -0.198);
// Where the raised hand's palm goes, from the shoulder (m, for 1.7 m tall; world axes): the elbow as edited in
// the pose editor with the hand continuing the forearm.
const HEAD_RAISED_HAND = new THREE.Vector3(-0.192, 0.103, 0.042);
const HEAD_GAZE = { raised: { neck: [-6.3, -1.4, 11.5], head: [-0.6, -21.9, 4.2] }, contact: { neck: [-5.7, -1.5, 12], head: [-0.9, -19.8, 4.9] } };
// A far-side (right) strike: a small further lean and shoulder turn so the hand reaches the site comfortably.
const HEAD_FAR_LEAN = 4, HEAD_FAR_TURN = 10;
// Standing, the hand lands higher on the cheek than seated (steps up the strike strip; see STRIKE_K).
const HEAD_STRIKE_K = 7;
const HEAD_GIVER_Q = poseTable(CASE_GIVER_BASE, HEAD_GIVER_BEAT);
const HEAD_PALM = { dir: [0.21, 0.42, -0.88], fingers: [-0.92, 0.33, -0.19], lift: 0.019, pole: [0.1, 0.1, 0.5] };

// Puts `ch` (already posed) so that its pelvis joint is at `at` with the group turned to
// `quat`, then drops it until its feet rest on the floor.
function standAt(ch, quat, at) {
  ch.group.quaternion.copy(quat);
  const pel = new THREE.Vector3(...ch.spec.J.pelvis).applyQuaternion(quat);
  ch.group.position.copy(at).sub(pel);
  ch.group.updateMatrixWorld(true);
  const lift = (ch.bones.footL.getWorldPosition(new THREE.Vector3()).y + ch.bones.footR.getWorldPosition(new THREE.Vector3()).y) / 2 - ch.spec.J.footL[1];
  ch.group.position.y -= lift;
  ch.group.updateMatrixWorld(true);
}
// Where a subject's palm goes on the lid (height `top`): ahead of the shoulder far enough
// that the arm is a little short of straight, level with the shoulder across the body.
function casePalm(s, side, top) {
  const sh = s.bones['upperArm' + side].getWorldPosition(new THREE.Vector3());
  const wristReach = s.bones['forearm' + side].position.length() + s.bones['hand' + side].position.length();
  const dy = sh.y - top, r = wristReach * 0.94;
  const dx = Math.sqrt(Math.max(0, r * r - dy * dy));
  const sHand = s.spec.H * 0.106;
  return new THREE.Vector3(sh.x + dx + sHand * 0.42, top + 0.012 * s.spec.H, sh.z);
}
// The case itself: a road case with its near edge `x0` and far edge `x1` along X, `top` high.
function buildCase(top, x0, x1) {
  const g = new THREE.Group();
  const caseMat = new THREE.MeshStandardMaterial({ color: lin(0x1a1a1c), roughness: 0.75, metalness: 0.15 });
  const metal = new THREE.MeshStandardMaterial({ color: lin(0x8a8a90), roughness: 0.35, metalness: 0.8 });
  const L = x1 - x0, W = 0.9;
  const body = new THREE.Mesh(new THREE.BoxGeometry(L, top, W), caseMat);
  body.position.set((x0 + x1) / 2, top / 2, 0); body.castShadow = body.receiveShadow = true; g.add(body);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(L + 0.02, 0.025, W + 0.02), metal);
  trim.position.set((x0 + x1) / 2, top - 0.012, 0); g.add(trim);
  for (const x of [x0 + 0.02, x1 - 0.02]) for (const z of [-W / 2 + 0.02, W / 2 - 0.02]) for (const y of [0.03, top - 0.04]) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), metal);
    c.position.set(x, y, z); g.add(c);
  }
  return g;
}

// Hands on knees: positions the standing subject for this frame and solves the legs to keep the feet planted.
// The body leans (`pitch` degrees more than stood) and the pelvis moves (`dx` forward, `dy` up, m) as the
// paddle's buckle asks, then each leg's thigh, shin and foot are set in the sagittal plane so the ankles stay
// where they were (the knee forward of the line from hip to ankle, the sole flat).
function kneesBody(scn, k) {
  const s = scn.s, sc = s.spec.H / 1.58, DEG = Math.PI / 180;
  const pitch = KNEES_PITCH + KNEES_BUCK.pitch * k;
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2)
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), pitch * DEG));
  const pel = new THREE.Vector3(...s.spec.J.pelvis).applyQuaternion(q);
  const target = scn.kneesPelvis.clone().add(new THREE.Vector3(KNEES_BUCK.dx * k * sc, KNEES_BUCK.dy * k * sc, 0));
  s.group.quaternion.copy(q);
  s.group.position.copy(target).sub(pel);
  s.group.updateMatrixWorld(true);
  for (const side of ['L', 'R']) {
    const th = s.bones['thigh' + side], sh = s.bones['shin' + side], ft = s.bones['foot' + side];
    const H = th.getWorldPosition(new THREE.Vector3()), A = scn.kneesAnkle[side];
    const L1 = sh.position.length(), L2 = ft.position.length();
    const dx = A.x - H.x, dy = H.y - A.y;
    const d = clamp(Math.hypot(dx, dy), Math.abs(L1 - L2) + 1e-3, (L1 + L2) * 0.999);
    const base = Math.atan2(dx, dy);
    const al = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1)), be = Math.acos(clamp((L2 * L2 + d * d - L1 * L1) / (2 * L2 * d), -1, 1));
    const ft_ = base + al, fs_ = base - be;   // thigh and shin forward angles from straight down
    const eu = new THREE.Euler().setFromQuaternion(th.quaternion, 'YXZ');   // keep the thigh's splay, replace its pitch
    th.quaternion.setFromEuler(new THREE.Euler(-ft_ - pitch * DEG, eu.y, eu.z, 'YXZ'));
    sh.quaternion.setFromEuler(new THREE.Euler(ft_ - fs_, 0, 0, 'YXZ'));
    ft.quaternion.setFromEuler(new THREE.Euler(fs_, 0, 0, 'YXZ'));
  }
  s.group.updateMatrixWorld(true);
}
function buildBench(top) {
  const g = new THREE.Group();
  const caseMat = new THREE.MeshStandardMaterial({ color: lin(0x1a1a1c), roughness: 0.75, metalness: 0.15 });
  const metal = new THREE.MeshStandardMaterial({ color: lin(0x8a8a90), roughness: 0.35, metalness: 0.8 });
  // Narrow enough that the subject's arms clear it on the way to the floor.
  const W = 0.42;
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, top, 0.46), caseMat);
  body.position.y = top / 2; body.castShadow = body.receiveShadow = true; g.add(body);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(W + 0.02, 0.025, 0.48), metal);
  trim.position.y = top - 0.012; g.add(trim);
  for (const x of [-W / 2 + 0.02, W / 2 - 0.02]) for (const z of [-0.21, 0.21]) for (const y of [0.03, top - 0.04]) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), metal);
    c.position.set(x, y, z); g.add(c);
  }
  g.position.z = -0.12;
  return g;
}

// Seats the disciplinarian: start with hip joints at knee height, pose the seated
// legs, then drop the whole figure by however far the feet end up above their
// standing height, so the feet are planted. Returns the hip height and the
// flight case, cut to fit under the thighs.
function seatGiver(g, armsPose = GIVER_SEATED) {
  resetCharacter(g);
  const J = g.spec.J;
  g.target = poseQuats(GIVER_BASE, GIVER_BEAT.relaxed, armsPose);
  g.pose = {}; for (const b of BONES) { g.pose[b] = g.target[b].clone(); g.bones[b].quaternion.copy(g.pose[b]); }
  g.group.position.set(0, g.spec.Y.knee - J.thighL[1], 0);
  g.group.updateMatrixWorld(true);
  const footLift = (g.bones.footL.getWorldPosition(new THREE.Vector3()).y + g.bones.footR.getWorldPosition(new THREE.Vector3()).y) / 2 - g.spec.Y.ankle;
  g.group.position.y -= footLift;
  g.group.updateMatrixWorld(true);
  const hipY = g.spec.Y.knee - footLift;
  const rThigh = g.spec.m.thigh / 100 / (2 * Math.PI);
  // Hands resting flat on the tops of the thighs, a little over halfway to the
  // knee, fingers forward; kept in the target pose so the easing holds them there.
  if (armsPose === GIVER_SEATED) {
    for (const side of ['L', 'R']) {
      const hip = g.bones['thigh' + side].getWorldPosition(new THREE.Vector3());
      const knee = g.bones['shin' + side].getWorldPosition(new THREE.Vector3());
      const top = hip.lerp(knee, 0.6).add(new THREE.Vector3(0, rThigh * 0.95 + 0.0085 * g.spec.H, 0));
      const sh = g.bones['upperArm' + side].getWorldPosition(new THREE.Vector3());
      const out = side === 'L' ? 1 : -1;
      armIKClear(g, side, top, sh.clone().add(new THREE.Vector3(out * 0.3, -0.1, -0.3)), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1));
      for (const b of ['upperArm', 'forearm', 'hand']) { g.target[b + side] = g.bones[b + side].quaternion.clone(); g.pose[b + side] = g.target[b + side].clone(); }
    }
  }
  return { hipY, rThigh, bench: buildBench(hipY - rThigh * 0.85) };
}

// Two-bone IK: aims upperArm→forearm→palm at `target`, elbow bent toward `pole`.
// With `surfaceN`, the hand is laid flat on that surface: palm facing into it,
// fingers pointing along `fingers` (projected onto the surface), and the IK
// solves for the wrist so the palm centre lands on `target`.
const _S = new THREE.Vector3(), _E = new THREE.Vector3(), _d = new THREE.Vector3(), _p = new THREE.Vector3();
const _q = new THREE.Quaternion(), _v = new THREE.Vector3();
function basisQuat(primary, secondary) {
  const x = primary.clone().normalize();
  const y = secondary.clone().addScaledVector(x, -secondary.dot(x)).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, x.clone().cross(y)));
}
// Sets the hand's world orientation, handing 60% of the roll about the forearm
// axis to the forearm itself (pronation), so the wrist doesn't twist on its own.
function setHandWorld(ch, side, qWorld) {
  const fo = ch.bones['forearm' + side], ha = ch.bones['hand' + side];
  const rel = fo.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(qWorld);
  const axis = ha.position.clone().normalize();
  const proj = axis.multiplyScalar(axis.dot(new THREE.Vector3(rel.x, rel.y, rel.z)));
  const twist = new THREE.Quaternion(proj.x, proj.y, proj.z, rel.w).normalize();
  fo.quaternion.multiply(new THREE.Quaternion().slerp(twist, 0.6));
  fo.updateMatrixWorld(true);
  ha.quaternion.copy(fo.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(qWorld));
  ha.updateMatrixWorld(true);
}
// Rest-pose hand frame: fingers along the arm; the palm is the hand ellipsoid's
// thin axis, which faces the body in the A-pose (mirrored between sides).
function restHandQuat(ha, side) {
  const along = ha.position.clone().normalize();
  const u = new THREE.Vector3(along.y, -along.x, 0).normalize();
  return basisQuat(along, side === 'L' ? u : u.negate());
}

// The upper arm's anterior (biceps) side in its rest frame: forward, for both arms
// in the A-pose.
const REST_ANTERIOR = new THREE.Vector3(0, 0, 1);

// How far (radians) the upper arm must twist from its natural orientation for the
// forearm to fold toward `W` from elbow `E`: the angle between the anterior side
// carried along by the shortest rotation and the anterior side the fold requires.
function humeralTwist(ch, side, S, E, W) {
  const up = ch.bones['upperArm' + side], fo = ch.bones['forearm' + side];
  const pq = up.parent.getWorldQuaternion(new THREE.Quaternion());
  const along = E.clone().sub(S).normalize();
  const fold = W.clone().sub(E); fold.addScaledVector(along, -fold.dot(along));
  if (fold.lengthSq() < 1e-8) return 0;
  const restAlongW = fo.position.clone().normalize().applyQuaternion(pq);
  const natural = REST_ANTERIOR.clone().applyQuaternion(pq).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(restAlongW, along));
  natural.addScaledVector(along, -natural.dot(along)).normalize();
  return Math.acos(clamp(natural.dot(fold.normalize()), -1, 1));
}

// `palmDir` (without a surface): fingers continue the forearm, palm faces palmDir.
// `straight`: keep the wrist straight — the hand continues the forearm exactly and
// only rolls to face the surface as closely as it can.
// `toWrist`: `target` is the wrist itself rather than the palm centre.
function armIK(ch, side, target, pole, surfaceN, fingers, palmDir, straight, toWrist) {
  const up = ch.bones['upperArm' + side], fo = ch.bones['forearm' + side], ha = ch.bones['hand' + side];
  const palmOff = ch.spec.H * 0.106 * 0.42;
  const L1 = fo.position.length();
  let L2 = ha.position.length() + (toWrist ? 0 : palmOff);
  up.getWorldPosition(_S);
  let flatDir = null;
  if (surfaceN) {
    flatDir = (fingers ? fingers.clone() : target.clone().sub(_S));
    flatDir.addScaledVector(surfaceN, -flatDir.dot(surfaceN));
    if (flatDir.lengthSq() > 1e-6) {
      flatDir.normalize();
      target = target.clone().addScaledVector(flatDir, -palmOff);
      L2 -= palmOff;
    } else flatDir = null;
  }
  _d.copy(target).sub(_S);
  const dist = clamp(_d.length(), Math.abs(L1 - L2) + 1e-3, (L1 + L2) * 0.999);
  _d.normalize();
  const a = (L1 * L1 - L2 * L2 + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(L1 * L1 - a * a, 0));
  _p.copy(pole).sub(_S);
  _p.addScaledVector(_d, -_p.dot(_d)).normalize();
  _E.copy(_S).addScaledVector(_d, a).addScaledVector(_p, h);
  // Upper arm as a hinge: point it along S→E and twist it so its anterior (biceps)
  // side faces the way the forearm folds. The forearm below then bends only about
  // the elbow's hinge axis, so the elbow can never bend backwards.
  up.parent.getWorldQuaternion(_q).invert();
  const alongP = _E.clone().sub(_S).normalize().applyQuaternion(_q);
  const foldP = _S.clone().addScaledVector(_d, dist).sub(_E).applyQuaternion(_q);
  foldP.addScaledVector(alongP, -foldP.dot(alongP));
  const restAlong = fo.position.clone().normalize();
  if (foldP.lengthSq() > 1e-8) {
    up.quaternion.copy(basisQuat(alongP, foldP.normalize()).multiply(basisQuat(restAlong, REST_ANTERIOR).invert()));
  } else {
    up.quaternion.setFromUnitVectors(restAlong, alongP);   // straight arm: no fold to orient
  }
  up.updateMatrixWorld(true);
  // Forearm: rotate its rest direction (toward the wrist) onto E→target.
  fo.parent.getWorldQuaternion(_q).invert();
  _v.copy(_S).addScaledVector(_d, dist).sub(_E).normalize().applyQuaternion(_q);
  fo.quaternion.setFromUnitVectors(ha.position.clone().normalize(), _v);
  fo.updateMatrixWorld(true);
  ha.quaternion.identity();
  let qWant = null;
  const foreDir = _v.copy(_S).addScaledVector(_d, dist).sub(_E).normalize().clone();
  if (flatDir && straight) qWant = basisQuat(foreDir, surfaceN.clone().negate());
  else if (flatDir) qWant = basisQuat(flatDir, surfaceN.clone().negate());
  else if (palmDir) {
    const along = _v.copy(_S).addScaledVector(_d, dist).sub(_E).normalize().clone();
    qWant = basisQuat(along, palmDir);
  }
  if (qWant) setHandWorld(ch, side, qWant.multiply(restHandQuat(ha, side).invert()));
}

// Rotates a bone by a world-space rotation (works under rotated parents).
function rotateBoneWorld(bone, q) {
  const pw = bone.parent.getWorldQuaternion(new THREE.Quaternion());
  const bw = bone.getWorldQuaternion(new THREE.Quaternion());
  bone.quaternion.copy(pw.clone().invert().multiply(q).multiply(bw));
  bone.updateMatrixWorld(true);
}
// Turns the face (head +Z) toward `target`: 40% through the neck, the rest in the
// head, capped so the look stays anatomically plausible.
function lookAt(ch, target, maxAngle = 1.0) {
  for (const [bone, share] of [[ch.bones.neck, 0.4], [ch.bones.head, 1]]) {
    const head = ch.bones.head;
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(head.getWorldQuaternion(new THREE.Quaternion()));
    const want = target.clone().sub(head.getWorldPosition(new THREE.Vector3())).normalize();
    const full = new THREE.Quaternion().setFromUnitVectors(fwd, want);
    const angle = 2 * Math.acos(clamp(full.w, -1, 1));
    const t = share * Math.min(1, maxAngle / Math.max(angle, 1e-6));
    rotateBoneWorld(bone, new THREE.Quaternion().slerp(full, Math.min(t, 1)));
    maxAngle -= angle * t;
    if (maxAngle <= 0) break;
  }
}

const easeIn = x => x * x * x, easeOut = x => 1 - (1 - x) ** 3, easeInOut = x => x * x * (3 - 2 * x);

// Creates the scene with `g` as disciplinarian and `s` as subject, adds the flight
// case to `parent`, and returns its state. Swing modes:
//   'beat'   — hold a beat ('relaxed' | 'raised' | 'contact'), easing between them;
//   'loop'   — run the timing loop (lift → hold raised → strike → hold on contact);
//   'driven' — the caller moves the arm with raise() / strike() / lower().
// `impacts` counts strikes as they land; `onImpact(side, strength)` fires with each.
// Where the subject's pelvis rests: this far from hip to knee along the right thigh,
// and this fraction of its front depth above the thigh's top (below 1 settles in).
const LAP_ALONG = 0.7, LAP_SETTLE = 0.9;
// opts.lower (default true): lower the subject's bottoms to the knees for the correction.
function createDisciplineScene(parent, g, s, opts = {}) {
  const scn = { mode: 'beat', impacts: 0, timing: { ...DEFAULT_TIMING }, plant: {}, reactSide: 'L', palmAim: 0.65,
    beat: 'relaxed', side: 'L', g, s, bench: null, reaction: 0, loopT: 0, handR: null, handL: null, swing: 0,
    fitCache: {}, onImpact: null, dv: null, pendingFlip: false,
    atCase: opts.position === 'case' || opts.position === 'head' || opts.position === 'knees', atHead: opts.position === 'head', atKnees: opts.position === 'knees', baseQ: SUBJ_BASE_Q, reactQ: SUBJ_REACT_Q, giverBaseQ: GIVER_Q, giverBase: GIVER_BASE, giverBeat: GIVER_BEAT };
  const atCase = scn.atCase, atHead = scn.atHead, atKnees = scn.atKnees;
  scn.wideContact = WIDE_CONTACT; scn.wideRaised = WIDE_RAISED; scn.wideRest = null;
  if (atCase) { scn.wideContact = CASE_WIDE_CONTACT; scn.wideRaised = caseWideRaised(); scn.wideRest = caseWideRest(); scn.baseQ = CASE_SUBJ_BASE_Q; scn.reactQ = CASE_SUBJ_REACT_Q; scn.giverBaseQ = CASE_GIVER_Q; scn.giverBase = CASE_GIVER_BASE; scn.giverBeat = CASE_GIVER_BEAT; }
  if (atKnees) { scn.baseQ = KNEES_BASE_Q; scn.reactQ = KNEES_REACT_Q; scn.buckQ = KNEES_REACT_Q; }   // (the paddle's buckle is the body's, in kneesBody)
  if (atHead) {
    scn.baseQ = HEAD_SUBJ_BASE_Q; scn.reactQ = HEAD_SUBJ_REACT_Q; scn.buckQ = HEAD_BUCK_Q; scn.giverBaseQ = HEAD_GIVER_Q; scn.giverBeat = HEAD_GIVER_BEAT;
    scn.wideRaised = caseWideRaised(HEAD_YAW_STRIKE); scn.wideRest = caseWideRest(HEAD_YAW_RELAXED);
  }
  const seat = atCase ? null : seatGiver(g);
  if (atCase) {
    // Standing at the subject's left, turned toward the subject's hips.
    resetCharacter(g);
    g.target = scn.giverBaseQ[scn.beat];
    g.pose = {}; for (const b of BONES) { g.pose[b] = g.target[b].clone(); g.bones[b].quaternion.copy(g.pose[b]); }
    const at = atHead ? HEAD_GIVER_AT : CASE_GIVER_AT;
    standAt(g, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (atHead ? HEAD_YAW_RELAXED : CASE_YAW) * Math.PI / 180),
      new THREE.Vector3(at[0], g.spec.J.pelvis[1], at[1]));
  } else {
    g.target = GIVER_Q[scn.beat];
    scn.bench = seat.bench;
    parent.add(scn.bench);
  }

  // A skirt comes off for the correction (see setSkirtOff): pressed between two bodies
  // whose skin the contact shader compresses on the GPU, the cloth can't be kept out of
  // either. It goes back on when the scene is disposed.
  setSkirtOff(s, true);
  // Shorts or leggings go down to the knees for the correction, back up afterwards.
  if (opts.lower !== false) setLowered(s, 'bottom', true);
  // Subject: face-down, head end dipping toward the floor, pelvis resting on the
  // centre line of the disciplinarian's right thigh, LAP_ALONG of the way from hip
  // to knee: nearer the knees than the torso, so the bodies meet over the thighs
  // rather than the subject's hips pressing into the disciplinarian's middle. The
  // height is the thigh's own top there (it thins toward the knee), less a little
  // for the weight settling in; the contact shader takes up the rest.
  resetCharacter(s);
  s.target = scn.baseQ;
  s.pose = {}; for (const b of BONES) s.pose[b] = s.target[b].clone();
  if (atHead) {
    // Standing free: upright, facing +X (local +X is the subject's left, world −Z, as in the lap).
    for (const b of BONES) s.bones[b].quaternion.copy(s.pose[b]);
    standAt(s, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2), new THREE.Vector3(0, s.spec.J.pelvis[1], 0));
    scn.subjBaseY = s.group.position.y;
    scn.subjBasePos = s.group.position.clone(); scn.subjBaseQ = s.group.quaternion.clone();
    const fa = s.bones.footL.getWorldPosition(new THREE.Vector3()), fb = s.bones.footR.getWorldPosition(new THREE.Vector3());
    scn.feetPivot = new THREE.Vector3((fa.x + fb.x) / 2, 0, (fa.z + fb.z) / 2);
    const hp = s.spec.prims.find(P => P.bone === 'head' && P.tag === 'head');
    scn.headPrim = { c: new THREE.Vector3(...hp.c).sub(new THREE.Vector3(...s.spec.J.head)), r: new THREE.Vector3(...hp.r) };
  } else if (atCase) {
    // Bent over the case: pitched forward about the hips, facing +X (local +X is the
    // subject's left, world −Z, as in the lap).
    for (const b of BONES) s.bones[b].quaternion.copy(s.pose[b]);
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2)
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), (atKnees ? KNEES_PITCH : CASE_PITCH) * Math.PI / 180));
    standAt(s, q, new THREE.Vector3(0, s.spec.J.pelvis[1], 0));
    scn.subjBasePos = s.group.position.clone();
    if (atKnees) {
      // What the legs are solved against: the pelvis and the planted ankles, as stood.
      scn.kneesPelvis = s.bones.pelvis.getWorldPosition(new THREE.Vector3());
      scn.kneesAnkle = { L: s.bones.footL.getWorldPosition(new THREE.Vector3()), R: s.bones.footR.getWorldPosition(new THREE.Vector3()) };
    }
    if (!atKnees) {
    // The lid is set from the subject's own height, and runs from just short of the palms
    // to well past them.
    scn.caseTop = opts.caseHeight || s.spec.Y.hipJoint * 0.88;
    const pL = casePalm(s, 'L', scn.caseTop), pR = casePalm(s, 'R', scn.caseTop);
    scn.bench = buildCase(scn.caseTop, Math.min(pL.x, pR.x) - 0.3, Math.max(pL.x, pR.x) + 0.4);
    parent.add(scn.bench);
    }
  } else {
  const tilt = 0.28, c = Math.cos(tilt), sn = Math.sin(tilt);
  const R = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(0, 0, -1), new THREE.Vector3(c, -sn, 0), new THREE.Vector3(-sn, -c, 0));
  s.group.quaternion.setFromRotationMatrix(R);
  const hipRing = loftRing(s.spec.prims[0], s.spec.Y.hip);
  const onThigh = g.bones.thighR.getWorldPosition(new THREE.Vector3()).lerp(g.bones.shinR.getWorldPosition(new THREE.Vector3()), LAP_ALONG);
  const rHere = lerp(seat.rThigh, g.spec.m.knee / 100 / (2 * Math.PI), LAP_ALONG);
  const pelvisAt = new THREE.Vector3(onThigh.x, onThigh.y + rHere + hipRing[1] * LAP_SETTLE, onThigh.z);
  const pelvisLocal = new THREE.Vector3(...s.spec.J.pelvis).applyQuaternion(s.group.quaternion);
  s.group.position.copy(pelvisAt).sub(pelvisLocal);
  for (const b of BONES) s.bones[b].quaternion.copy(s.pose[b]);
  s.group.updateMatrixWorld(true);
  }
  scn.anchors = sceneAnchors(s);

  // The disciplinarian's pose for a beat, with the implement's own layer if it has one.
  const giverQCache = {};
  scn.giverQ = beat => {
    const layers = scn.implement && (scn.atHead ? null : scn.atCase ? IMPLEMENTS[scn.implement].giverCase : IMPLEMENTS[scn.implement].giver);
    const L = layers && layers[beat];
    if (!L) return scn.giverBaseQ[beat];
    const k = scn.implement + beat;
    return giverQCache[k] || (giverQCache[k] = poseQuats(scn.giverBase, scn.giverBeat[beat], L));
  };
  scn.setBeat = beat => { scn.mode = 'beat'; scn.beat = beat; g.target = scn.giverQ(beat); };
  scn.setLoop = on => { scn.mode = on ? 'loop' : 'beat'; scn.loopT = 0; if (!on) scn.setBeat(scn.beat); };
  // Driven swing: move from wherever the arm is to `to` over `dur` seconds.
  const moveTo = (to, dur, ease, onArrive) => {
    scn.mode = 'driven';
    scn.dv = { from: scn.swing, to, t: 0, dur: Math.max(dur, 1e-3), ease, onArrive };
  };
  // Lift to the raised position. Coming up from contact, the side alternates at the top.
  scn.raise = (dur = scn.timing.lift / scn.timing.speed, then = null) => {
    scn.pendingFlip = scn.swing > 1.5;
    moveTo(1, dur, easeOut, () => { if (scn.pendingFlip) scn.side = scn.side === 'L' ? 'R' : 'L'; scn.pendingFlip = false; if (then) then(); });
  };
  // One full smack from wherever the arm is: lift, then strike the next contact site
  // (alternating from the second), and hold there until the next call.
  // `hold` keeps the arm raised that long before the strike.
  scn.cycle = (strength = 1, lift = scn.timing.lift / scn.timing.speed, strike = scn.timing.strike / scn.timing.speed, hold = 0) =>
    scn.raise(lift, () => hold > 0 ? moveTo(1, hold, easeInOut, () => scn.strike(strength, strike)) : scn.strike(strength, strike));
  // True while the arm is still travelling (a cycle hasn't landed yet).
  scn.busy = () => !!(scn.dv && scn.dv.onArrive);
  // Strike from wherever the arm is. `strength` (0–1) scales the subject's reaction.
  scn.strike = (strength = 1, dur = scn.timing.strike / scn.timing.speed) => {
    scn.pendingFlip = false;
    moveTo(2, dur, easeIn, () => {
      scn.reaction = Math.max(scn.reaction, strength); scn.reactSide = scn.reactKey(); scn.impacts++; scn.mark(scn.side);
      if (scn.onImpact) scn.onImpact(scn.side, strength);
    });
  };
  // Back to resting on the thigh.
  scn.lower = (dur = 0.6) => { scn.pendingFlip = false; moveTo(0, dur, easeInOut); };
  // Each landed smack builds up the mark on that side (see addMark); a wide implement
  // marks both sides, each at its own site.
  scn.mark = side => {
    const w = IMPLEMENTS[scn.implement].mark;
    if (scn.tool && scn.tool.wide) { const F = scn.lastStrike; if (F && F.skinL) { addMark(s, 'L', F.skinL, w); addMark(s, 'R', F.skinR, w); } return; }
    const C = scn.fitCache[side]; if (C && C.fit && C.fit.skin) addMark(s, side, C.fit.skin, w);
  };
  // The reaction's side: the one struck, or 'B' (centred) when a wide implement covers both.
  scn.reactKey = () => scn.tool && scn.tool.wide ? 'B' : scn.side;
  // The implement in the disciplinarian's right hand ('hand' for none; see IMPLEMENTS).
  scn.implement = 'hand'; scn.tool = null;
  scn.setImplement = name => {
    if (!IMPLEMENTS[name]) name = 'hand';
    if (scn.tool) { scn.tool.grp.parent.remove(scn.tool.grp); scn.tool.grp.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); }
    scn.implement = name;
    scn.buck = !!(scn.atCase && name === 'paddle');   // standing positions: the paddle's reaction differs (HEAD_BUCK, CASE_BUCK)
    if (scn.atCase && !scn.atHead && !scn.atKnees) scn.buckQ = CASE_BUCK_Q;
    scn.tool = IMPLEMENTS[name].build ? IMPLEMENTS[name].build(g) : null;
    scn.toolFix = {}; scn.fitCache.B = null; scn.handQ = null;
    // Middle and end finger joints closed round the handle (or straightened again).
    setFingerBend(g, 'R', scn.tool ? (scn.tool.grip || IMPLEMENTS[name].grip).bend : 0);
    if (scn.tool && scn.curl) scn.curl.R = (scn.tool.grip || IMPLEMENTS[name].grip).curl;
    if (scn.mode === 'beat') g.target = scn.giverQ(scn.beat);
  };
  scn.update = dt => updateScene(scn, dt);
  scn.dispose = () => {
    if (scn.bench) { parent.remove(scn.bench); scn.bench.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); }
    scn.bench = null;
    for (const ch of [g, s]) { const u = ch.mesh.material.userData.uniforms; u.uPressAmt.value = 0; u.uPressAmt2.value = 0; u.uCapN.value = 0; }
    setSkirtOff(s, false);
    setLowered(s, 'bottom', false);
    scn.setImplement('hand');   // the implement is put down
  };
  return scn;
}

function updateScene(scn, dt) {
  const g = scn.g, s = scn.s;
  if (!g || !s) return;

  // Swing state: 0 = resting on the thigh, 1 = raised, 2 = contact.
  let swing, reactTarget = null;
  const timed = scn.mode !== 'beat';   // loop and driven: poses follow the swing exactly
  if (scn.mode === 'loop') {
    // Timeline in seconds: lift → hold raised → strike → hold on contact.
    const T = scn.timing, sp = Math.max(0.1, T.speed);
    const lift = T.lift / sp, raised = T.raisedHold, strike = T.strike / sp, contact = T.contactHold;
    const P = lift + raised + strike + contact;
    const prev = scn.loopT;
    scn.loopT = (scn.loopT + dt) % P;
    const t = scn.loopT, t1 = lift, t2 = t1 + raised, t3 = t2 + strike;
    if (t < t1) swing = 2 - easeOut(t / lift);                           // lift from contact to raised
    else if (t < t2) swing = 1;                                          // hold at the top
    else if (t < t3) swing = 1 + easeIn((t - t2) / strike);              // strike
    else swing = 2;                                                      // hold on contact
    // Did this frame pass `at`? Checked on the unwrapped clock, so an event at the very
    // end of the cycle (e.g. impact with a zero contact hold) still fires as it wraps.
    const raw = prev + dt;
    const crossed = at => (prev < at && raw >= at) || (prev < at + P && raw >= at + P);
    if (crossed(t3)) { scn.reaction = 1; scn.reactSide = scn.reactKey(); scn.impacts++; scn.mark(scn.side); if (scn.onImpact) scn.onImpact(scn.side, 1); }
    if (crossed(t1)) scn.side = scn.side === 'L' ? 'R' : 'L';            // alternate at the top of the lift
    scn.reaction *= Math.exp(-dt * 3.2);
  } else if (scn.mode === 'driven') {
    const V = scn.dv;
    if (V) {
      V.t += dt;
      const p = clamp(V.t / V.dur, 0, 1);
      swing = lerp(V.from, V.to, V.ease(p));
      if (p >= 1 && V.onArrive) { const f = V.onArrive; V.onArrive = null; f(); }
    } else swing = scn.swing;
    scn.reaction *= Math.exp(-dt * 3.2);
  } else {
    swing = { relaxed: 0, raised: 1, contact: 2 }[scn.beat];
    reactTarget = scn.beat === 'contact' ? 1 : 0;
    scn.reaction += (reactTarget - scn.reaction) * (1 - Math.exp(-dt * 10));
  }
  if (timed) g.target = scn.giverQ(swing < 0.35 ? 'relaxed' : swing < 1.5 ? 'raised' : 'contact');
  scn.swing = swing;
  // Hands on head: the disciplinarian faces the subject squarely while relaxed and turns toward the
  // subject's hips as the arm comes up (about the vertical through the pelvis, so the feet stay put).
  if (scn.atHead) {
    const yaw = lerp(HEAD_YAW_RELAXED, HEAD_YAW_STRIKE, easeInOut(clamp(swing / 0.6, 0, 1)));
    g.group.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw * Math.PI / 180);
    g.group.updateMatrixWorld(true);
  }

  // Joint-angle poses (subject blends toward the reaction pose).
  const a = 1 - Math.exp(-dt * 9);
  for (const b of BONES) {
    _q.copy(scn.baseQ[b]).slerp((scn.buck ? scn.buckQ : scn.reactQ)[timed ? scn.reactSide : scn.reactKey()][b], scn.reaction);
    s.pose[b].slerp(_q, timed ? 1 : a);
    s.bones[b].quaternion.copy(s.pose[b]);
    g.pose[b].slerp(g.target[b], timed ? 1 - Math.exp(-dt * 14) : a);
    g.bones[b].quaternion.copy(g.pose[b]);
  }
  // Hands on head: struck, the subject rises onto their toes (the feet's pitch is in the reaction pose).
  if (scn.atHead) {
    const pitch = scn.buck ? HEAD_BUCK.pitch * Math.PI / 180 * scn.reaction : 0;
    const qz = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -pitch);   // forward is +X
    s.group.quaternion.copy(qz).multiply(scn.subjBaseQ);
    s.group.position.copy(scn.subjBasePos).sub(scn.feetPivot).applyQuaternion(qz).add(scn.feetPivot);
    if (!scn.buck) s.group.position.y += HEAD_RISE * (s.spec.H / 1.58) * scn.reaction;
  } else if (scn.atCase && !scn.atKnees && scn.buck) {
    // Over the case, bucking away from the paddle: the body moves, the feet stay put (the legs' pose does that).
    s.group.position.copy(scn.subjBasePos).addScaledVector(new THREE.Vector3(...CASE_BUCK.shift), s.spec.H / 1.58 * scn.reaction);
  }
  if (scn.atKnees) kneesBody(scn, scn.buck ? scn.reaction : 0);
  s.group.updateMatrixWorld(true);
  g.group.updateMatrixWorld(true);

  // Contact points: mesh vertices chosen at build time (see sceneAnchors), taken
  // through full skinning each frame, so the palm sits on the skin as rendered.
  const sH = s.spec.H;
  const palm = 0.0085 * g.spec.H + 0.002;   // palm centre sits half a hand-thickness off the skin
  const fingersFwd = new THREE.Vector3(0, 0, 1);   // away from the disciplinarian
  const posed = nameOrAnchor => {
    const A = typeof nameOrAnchor === 'string' ? scn.anchors[nameOrAnchor] : nameOrAnchor;
    const p = s.mesh.boneTransform(A.index, new THREE.Vector3()).applyMatrix4(s.mesh.matrixWorld);
    const M = s.bones[A.bone].matrixWorld.clone().multiply(s.mesh.skeleton.boneInverses[BONES.indexOf(A.bone)]);
    const n = A.n.clone().transformDirection(M);
    return { p: p.addScaledVector(n, palm), n };
  };
  const shoulders = posed(scn.atHead ? 'navel' : scn.atCase ? 'lowback' : 'shoulders'), glute = posed('glute');
  // The resting hand takes the thigh nearer the disciplinarian (subject's left, toward −Z).
  const knee = posed(scn.atCase ? 'cheekL' : 'kneeL');   // over the case the hand rests by the near cheek instead
  // Left hand: same no-clip rule as the strike — palm set slightly below the skin,
  // and the skin under it compressed onto the palm plane.
  const REST_DEPTH = 0.008;
  const backN = shoulders.n, backSkin = shoulders.p.clone().addScaledVector(backN, -palm);
  // Hands on head: the left hand eases from hanging at the disciplinarian's side to the navel
  // as the arm comes up, and presses the skin only once it's there.
  const navW = scn.atHead ? easeInOut(clamp(swing / 0.7, 0, 1)) : 1;
  const giverRight = new THREE.Vector3(-1, 0, 0).applyQuaternion(g.group.quaternion);
  let leftPt = backSkin.clone().addScaledVector(backN, 0.0085 * g.spec.H - REST_DEPTH);
  if (scn.atHead) {
    const shL0 = g.bones.upperArmL.getWorldPosition(new THREE.Vector3());
    leftPt = shL0.clone().add(new THREE.Vector3(HEAD_HANG.out, -HEAD_HANG.down, HEAD_HANG.fwd).multiplyScalar(g.spec.H).applyQuaternion(g.group.quaternion)).lerp(leftPt, navW);
  }
  // Over the case, bucking away from the paddle: the hips move under the resting left hand, which holds its place.
  if (scn.atCase && !scn.atHead && !scn.atKnees && scn.buck) leftPt.addScaledVector(new THREE.Vector3(...CASE_BUCK.shift), -s.spec.H / 1.58 * scn.reaction)
    .addScaledVector(new THREE.Vector3(...CASE_BUCK.leftHand), s.spec.H / 1.58 * clamp(swing - 1, 0, 1));   // (and a little up and toward the disciplinarian, as set)
  setPress(s, backSkin.clone().addScaledVector(backN, -REST_DEPTH), backN, 0.065 * g.spec.H / 1.7, scn.atHead ? clamp((navW - 0.9) / 0.1, 0, 1) : 1, '2');
  let restPt = knee.p;
  const thighN = scn.atHead ? giverRight : knee.n;
  // Far-side (right) strikes: the disciplinarian turns their shoulders toward the
  // far glute — a small twist about the vertical, split across the spine, that
  // brings the right shoulder forward over the target. It builds through the
  // downswing and releases as the hand lifts.
  // A wide implement lands on both sides at once, so there's no far side to turn toward.
  const FAR_TURN = (scn.atHead ? HEAD_FAR_TURN : 20) * Math.PI / 180, wide = !!(scn.tool && scn.tool.wide);
  const turnAmt = scn.side === 'R' && !wide ? FAR_TURN * (t => t * t * (3 - 2 * t))(clamp(swing - 1, 0, 1)) : 0;
  if (turnAmt > 0) {
    const upAxis = new THREE.Vector3(0, 1, 0);
    rotateBoneWorld(g.bones.spine1, new THREE.Quaternion().setFromAxisAngle(upAxis, turnAmt * 0.45));
    rotateBoneWorld(g.bones.spine2, new THREE.Quaternion().setFromAxisAngle(upAxis, turnAmt * 0.55));
    if (scn.atCase) {
      const f = turnAmt / FAR_TURN;
      g.bones.spine2.rotateX((scn.atHead ? HEAD_FAR_LEAN : CASE_FAR_LEAN) * Math.PI / 180 * f);
      g.bones.clavR.quaternion.multiply(new THREE.Quaternion().slerp(degQ(CASE_FAR_CLAV), f));
    }
    g.group.updateMatrixWorld(true);
  }
  const shR = g.bones.upperArmR.getWorldPosition(new THREE.Vector3());
  // Hands on head: the swinging hand hangs at the side at rest (an implement with it).
  if (scn.atHead) restPt = shR.clone().add(new THREE.Vector3(-HEAD_HANG.out, -HEAD_HANG.down, HEAD_HANG.fwd).multiplyScalar(g.spec.H).applyQuaternion(g.group.quaternion));

  // Contact delivery. The strike alternates between the left and right glute/thigh
  // fold. Palm flat on the skin with a straight wrist means the forearm lies along
  // the skin too, so for each candidate point along the fold strip, search the
  // directions the forearm could lie in (around the surface normal) for one where
  // the upper arm exactly spans shoulder → elbow, with the elbow outside the torso.
  // Lower candidates are strongly preferred; the search only moves up the strip
  // when the arm can't lay the palm flat lower down.
  //
  // The palm faces the centre of the glute on that side (not the local skin normal
  // at the fold), and its centre sits PRESS_DEPTH inside the skin; the subject's
  // shader flattens the skin under the palm (see setPress) so it compresses rather
  // than clipping. Candidate forearm lines that pass through the subject's body are
  // rejected, which pushes the elbow away from the body when needed.
  const PRESS_DEPTH = 0.012;
  const palmHalf = 0.0085 * g.spec.H;
  const pelvisM = s.bones.pelvis.matrixWorld.clone().multiply(s.mesh.skeleton.boneInverses[BONES.indexOf('pelvis')]);
  const sideSign = scn.side === 'L' ? 1 : -1;
  const gluteP = s.spec.prims.find(P => P.tag === 'glute' && P.side === sideSign);
  const gluteC = new THREE.Vector3(...gluteP.c).applyMatrix4(pelvisM);
  const rFore = g.spec.m.forearm / 100 / (2 * Math.PI);
  // The strike fit is expensive, so it's cached per side and only recomputed when
  // the target area or the disciplinarian's shoulder has actually moved.
  const shNow = g.bones.upperArmR.getWorldPosition(new THREE.Vector3());
  const tgtNow = posed(scn.anchors[scn.side === 'L' ? 'foldL' : 'foldR'][0]).p;
  const C = scn.fitCache[scn.side];
  const fresh = wide || (C && C.aim === scn.palmAim && C.sh.distanceTo(shNow) < 0.01 && C.tgt.distanceTo(tgtNow) < 0.01);
  const strikeFit = wide ? wideFit(scn, posed, shR, palm) : fresh ? C.fit : (() => {
    // Clearance is tested against the subject's posed skin near the target.
    const skinPts = posedSkinNear(s, tgtNow, 0.45);
    const forearmClear = (E, W) => {
      let worst = Infinity;
      for (const t of [0, 0.2, 0.4, 0.6, 0.75]) worst = Math.min(worst, skinSignedDist(skinPts, E.clone().lerp(W, t)) - rFore * 0.85);
      return worst;   // ≥ 0: the forearm clears the subject
    };
    const L1 = g.bones.forearmR.position.length(), L2 = g.bones.handR.position.length();
    const palmOff = g.spec.H * 0.106 * 0.42;
    const toTorso = g.bones.spine1.matrixWorld.clone().invert(), half = torsoHalfWidth(g);
    const strip = scn.anchors[scn.side === 'L' ? 'foldL' : 'foldR'];
    // The palm-angle setting is a minimum: if no forearm line clears the subject at
    // that angle, turn the palm further toward the glute's centre until one does.
    let fallback = null;
    for (const aim of [scn.palmAim, 0.55, 0.7, 0.85, 1].filter(v => v >= scn.palmAim)) {
    const cands = [];
    strip.forEach((A, k) => {
      const ps = posed(A);
      const skin = ps.p.clone().addScaledVector(ps.n, -palm);
      const n = ps.n.clone().lerp(skin.clone().sub(gluteC).normalize(), aim).normalize();   // toward the glute's centre
      const p = skin.clone().addScaledVector(n, palmHalf - PRESS_DEPTH);
      const t1 = new THREE.Vector3(0, 0, 1).addScaledVector(n, -n.z).normalize(), t2 = n.clone().cross(t1);
      for (let a = 0; a < 360; a += 3) for (const tiltDeg of [0, 10, 20, 30, 40]) {
        const r = a * Math.PI / 180;
        const f = t1.clone().multiplyScalar(Math.cos(r)).addScaledVector(t2, Math.sin(r));
        // Wrist extension: the forearm may come down onto the flat hand from above the
        // skin plane (≤ 40°, within normal wrist range; penalised so small is preferred),
        // letting the elbow sit lower.
        const tl = tiltDeg * Math.PI / 180;
        const dF = f.clone().multiplyScalar(Math.cos(tl)).addScaledVector(n, -Math.sin(tl));
        const W = p.clone().addScaledVector(f, -palmOff), E = W.clone().addScaledVector(dF, -L2);
        const outside = -E.clone().applyMatrix4(toTorso).x - half;   // right arm → torso's −X side
        // Penalise fingers pointing back at the disciplinarian (−Z) or up the body
        // toward the subject's head (+X); reward an open elbow; prefer low candidates.
        const err = Math.abs(E.distanceTo(shR) - L1) + Math.max(0, -f.z) * 0.05 + Math.max(0, f.x) * 0.06
          // Both sides aim for the same height, STRIKE_K steps up the strip from the
          // fold, so left and right contacts match.
          - 0.08 * clamp(outside, 0, 0.12) + 0.025 * Math.abs(k - (scn.atHead ? HEAD_STRIKE_K : STRIKE_K))
          + 0.06 * Math.max(0, humeralTwist(g, 'R', shR, E, W) - 1.05)   // shoulder twist beyond ~60°
          + 0.0006 * tiltDeg;                                              // prefer a straight wrist
        cands.push({ err, f, E, W, p, n, skin, outside, tiltDeg, k, aim });
      }
    });
    // Best-scoring candidates first; take the first whose elbow clears the torso and
    // whose forearm clears the subject. Fall back to the least-clipping one.
    cands.sort((a, b) => a.err - b.err);
    for (const c of cands.slice(0, 120)) {
      if (c.outside < 0.02) continue;
      c.clear = forearmClear(c.E, c.W);
      if (c.clear < 0) continue;
      c.twist = humeralTwist(g, 'R', shR, c.E, c.W);
      if (c.twist <= 1.3) return c;                    // clears and the shoulder twist is comfortable
      if (!fallback || c.twist < fallback.twist) fallback = c;
    }
    if (!fallback && aim === 1) fallback = cands[0];
    }
    return fallback;
  })();
  if (!fresh) scn.fitCache[scn.side] = { aim: scn.palmAim, sh: shNow, tgt: tgtNow, fit: strikeFit };
  const strike = { p: strikeFit.p, n: strikeFit.n };
  // Compress the skin under the palm while the hand is on it (a wide implement's blade
  // is pressed after the arm is placed, from where the blade actually is).
  if (!wide) setPress(s, strikeFit.skin.clone().addScaledVector(strikeFit.n, -PRESS_DEPTH), strikeFit.n, 0.065 * g.spec.H / 1.7,
    clamp((swing - 1.75) / 0.25, 0, 1));
  scn.lastStrike = strikeFit;
  // Holding an implement: the hand is set back along it (and off the skin by its
  // thickness) so the implement's striking face lands on the target instead of the palm,
  // pressing in a few millimetres as the palm does.
  const tool = scn.tool;
  // At contact the palm faces the skin (its normal −n) with the fingers along f, so the
  // thumb side is f × (−n).
  const thumbW = tool && !wide ? strikeFit.f.clone().cross(strike.n.clone().negate()).normalize() : null;
  // The hand doesn't finish exactly as the offsets assume, so a per-side correction
  // (scn.toolFix, learnt while the implement is on the skin; see after the arm IK)
  // closes the rest. A wide implement has one, 'B', for both sides.
  scn.toolFix = scn.toolFix || {};
  const fix = tool && scn.toolFix[scn.implement + (wide ? 'B' : scn.side)];
  const contactPt = wide ? strikeFit.palmC.clone().add(fix || new THREE.Vector3()) : tool ? strike.p.clone().addScaledVector(strike.n, tool.off - 0.004)
    .addScaledVector(strikeFit.f, -tool.along).addScaledVector(thumbW, -tool.across).add(fix || new THREE.Vector3()) : strike.p;
  let raisedPt = shR.clone().add((scn.atHead ? HEAD_RAISED_HAND : new THREE.Vector3(-0.1, 0.3, -0.06)).clone().multiplyScalar(g.spec.H / 1.7));
  // A wide implement raised (WIDE_RAISED): the blade's face placed and turned from the
  // shoulder, and the palm centre (what the swing moves) where that puts the hand.
  let wideUp = null;
  if (wide) {
    const R = scn.wideRaised, T = scn.tool, ax = new THREE.Vector3(...R.axis).normalize(), fN = new THREE.Vector3(...R.faceN);
    fN.addScaledVector(ax, -fN.dot(ax)).normalize();
    const Q = bladeHandQuat(T, ax, fN.negate());
    const face = shR.clone().addScaledVector(new THREE.Vector3(...R.face), g.spec.H / 1.7);
    raisedPt = face.sub(T.face.clone().applyQuaternion(Q)).add(T.palmC.clone().applyQuaternion(Q));
    wideUp = { Q, pole: new THREE.Vector3(...R.elbow).normalize().multiplyScalar(0.5) };
  }

  // Subject's hands: palms flat on the floor ahead of the shoulders if the arm can
  // reach; otherwise the arm straightens toward the floor and the fingertips touch.
  const floorN = new THREE.Vector3(0, 1, 0);
  const sHand = s.spec.H * 0.106;
  // Hands on knees: palms on the front of the knees, fingers down, elbows out.
  if (scn.atKnees) {
    for (const side of ['L', 'R']) {
      const knee = s.bones['shin' + side].getWorldPosition(new THREE.Vector3());
      const rK = s.spec.m.knee / 100 / (2 * Math.PI);
      const n = new THREE.Vector3(1, 0.1, 0).normalize();
      const target = knee.clone().addScaledVector(n, rK + 0.0085 * sH + 0.004).add(new THREE.Vector3(0, 0.02 * sH / 1.58, 0));
      const sh = s.bones['upperArm' + side].getWorldPosition(new THREE.Vector3());
      const out = side === 'L' ? -1 : 1;
      armIK(s, side, target, sh.clone().add(new THREE.Vector3(-0.1, 0.05, out * 0.5)), n, new THREE.Vector3(0, -1, 0));
    }
  }
  for (const side of scn.atHead || scn.atKnees ? [] : ['L', 'R']) {
    const sh = s.bones['upperArm' + side].getWorldPosition(new THREE.Vector3());
    const out = side === 'L' ? -1 : 1;   // subject's left is world −Z in this orientation
    const pole = sh.clone().add(new THREE.Vector3(-0.4, 0.1, out * 0.25));
    const palmReach = armReach(s, side);
    // Hands stay planted while the body reacts: the palm spot is taken at rest and
    // held until the reaction has settled, rather than following the shoulders.
    let palmPt = scn.atCase ? casePalm(s, side, scn.caseTop) : new THREE.Vector3(sh.x + 0.07 * sH, 0.012 * sH, sh.z + out * 0.06 * sH);
    if (!scn.plant[side] || scn.reaction < 0.02) scn.plant[side] = palmPt.clone();
    else {
      const slideTo = palmPt;
      palmPt = scn.plant[side].clone();
      // Over the case the palm stays on the lid however the body moves: it holds its place while
      // the arm can reach it, and slides back along the lid, flat, when the shoulders rise or draw
      // away (casePalm is where a nearly straight arm from the shoulder as it is now would land).
      if (scn.atCase) palmPt.x = Math.min(palmPt.x, slideTo.x);
    }
    // The flat-palm IK solves for the wrist (palm centre minus half a hand along the
    // fingers), so test reach to that point, not to the palm centre.
    const wristPt = palmPt.clone().addScaledVector(new THREE.Vector3(1, 0, 0), -sHand * 0.42);
    const wristReach = s.bones['forearm' + side].position.length() + s.bones['hand' + side].position.length();
    const ha = s.bones['hand' + side];
    const fingersX = new THREE.Vector3(1, 0, 0);            // fingers toward the head end
    const reach = wristReach * 0.99;
    // Pivot point: the fingertips of the flat, planted hand.
    const tipLen = sHand * 0.9;
    const T = wristPt.clone().addScaledVector(fingersX, tipLen);
    // As the hand tilts, the contact moves from the palm to the finger pads, which sit
    // lower than the palm centre line — so the pivot settles toward the floor.
    const pivotAt = th => T.clone().add(new THREE.Vector3(0, -0.015 * sH * Math.sin(th), 0));
    const wristAt = th => pivotAt(th).add(new THREE.Vector3(-Math.cos(th) * tipLen, Math.sin(th) * tipLen, 0));
    if (sh.distanceTo(wristPt) <= reach) {
      // Palm flat on the planted spot.
      armIK(s, side, palmPt, pole, floorN, fingersX);
    } else if (sh.distanceTo(wristAt(Math.PI / 2)) <= reach) {
      // Shoulders too high for a flat palm: the fingertips stay planted and the heel
      // of the hand lifts, pivoting about them just enough for the arm to reach.
      let lo = 0, hi = Math.PI / 2;
      for (let i = 0; i < 20; i++) {
        const mid = (lo + hi) / 2;
        if (sh.distanceTo(wristAt(mid)) > reach) lo = mid; else hi = mid;
      }
      const W = wristAt(hi);
      armIK(s, side, W, pole, null, null, null, false, true);
      const d = pivotAt(hi).sub(W).normalize();
      const palmDir = new THREE.Vector3(0, -1, 0).addScaledVector(d, d.y).normalize();
      setHandWorld(s, side, basisQuat(d, palmDir).multiply(restHandQuat(ha, side).invert()));
    } else {
      // Even a vertical hand can't reach: straighten the arm toward the floor and
      // let the fingertips find it (see placeFingertips).
      const floorPt = new THREE.Vector3(palmPt.x, scn.atCase ? scn.caseTop : 0, palmPt.z);
      const armDir = floorPt.sub(sh).normalize();
      armIK(s, side, sh.clone().addScaledVector(armDir, palmReach * 0.995), pole);
      placeFingertips(s, side);
    }
  }

  // Hands on head: palms on the back of the skull, fingers along it, elbows out.
  if (scn.atHead) {
    const M = s.bones.head.matrixWorld, hp = scn.headPrim, hv = HEAD_PALM;
    for (const side of ['L', 'R']) {
      const sg = side === 'L' ? 1 : -1;
      const d = new THREE.Vector3(hv.dir[0] * sg, hv.dir[1], hv.dir[2]).normalize();
      const surf = hp.c.clone().add(new THREE.Vector3(d.x * hp.r.x, d.y * hp.r.y, d.z * hp.r.z)).applyMatrix4(M);
      const n = new THREE.Vector3(d.x / hp.r.x, d.y / hp.r.y, d.z / hp.r.z).normalize().transformDirection(M);
      const target = surf.addScaledVector(n, 0.0085 * s.spec.H + hv.lift);
      const fingers = new THREE.Vector3(hv.fingers[0] * sg, hv.fingers[1], hv.fingers[2]).transformDirection(M);
      const sh = s.bones['upperArm' + side].getWorldPosition(new THREE.Vector3());
      const out = side === 'L' ? -1 : 1;
      const pole = sh.clone().add(new THREE.Vector3(hv.pole[0], hv.pole[1], hv.pole[2] * out));
      armIK(s, side, target, pole, n, fingers);
    }
  }

  // Swinging hand: rest above the knee → raised → contact.
  // Resting with an implement: its head lies on the thigh instead of the palm, just
  // touching (REST_GAP off the skin, no compression): the hand is set back by the head's
  // offsets, with the fingers forward, plus a correction learnt at rest (below).
  const REST_TILT = 18 * Math.PI / 180;
  const restSkin = restPt.clone().addScaledVector(thighN, -palm);
  let restAt = scn.atCase && !scn.atHead && !tool ? restPt.clone().addScaledVector(thighN, CASE_REST_HOVER) : restPt;
  // A wide implement rests across both sites, flat on the seat (its fit's `rest`), lifted
  // off the skin to REST_GAP (no compression), plus its own correction learnt at rest.
  const wideRest = wide ? strikeFit.rest : null;
  if (wide) restAt = wideRest.palmC.clone().addScaledVector(wideRest.n, scn.wideRest ? 0 : WIDE_DEPTH + REST_GAP)
    .add(scn.toolFix[scn.implement + 'rest'] || new THREE.Vector3());
  else if (tool) {
    const thumbR = fingersFwd.clone().cross(thighN.clone().negate()).normalize();
    restAt = restSkin.clone().addScaledVector(thighN, tool.off + REST_GAP).addScaledVector(fingersFwd, -tool.along)
      .addScaledVector(thumbR, -tool.across).add(scn.toolFix[scn.implement + 'rest'] || new THREE.Vector3());
  }
  const want = swing <= 1 ? restAt.clone().lerp(raisedPt, swing) : raisedPt.clone().lerp(contactPt, swing - 1);
  // A wide implement's fist runs from the hip to above the shoulder: a straight line would
  // take it through the disciplinarian's own shoulder, so the path bows out to their side
  // (and a little forward), most in the middle of each leg of the swing.
  if (wide) want.addScaledVector(WIDE_ARC, g.spec.H / 1.7 * Math.sin(Math.PI * (swing <= 1 ? clamp(swing, 0, 1) : clamp(swing - 1, 0, 1))));
  if (!scn.handR || timed) scn.handR = want; else scn.handR.lerp(want, a);
  if (!scn.handL) scn.handL = leftPt; else scn.handL.lerp(leftPt, a);

  // If a resting hand is out of reach, lean the disciplinarian's torso toward it
  // (rotating spine1 about the axis that swings the shoulder toward the target).
  // The lean is capped (~8°) so it stays a subtle adjustment; the swinging arm
  // isn't included at contact — the strike search fits the arm to the torso instead.
  const reachTargets = [['L', scn.handL]];
  if (swing < 0.3) reachTargets.push(['R', scn.handR]);
  const pivot = new THREE.Vector3(), shW = new THREE.Vector3();
  const MAX_LEAN = 0.14;
  let leaned = 0;
  for (let it = 0; it < 8 && leaned < MAX_LEAN; it++) {
    let moved = false;
    for (const [side, T] of reachTargets) {
      g.bones['upperArm' + side].getWorldPosition(shW);
      const deficit = shW.distanceTo(T) - armReach(g, side) * 0.97;
      if (deficit <= 0.002) continue;
      g.bones.spine1.getWorldPosition(pivot);
      const r = shW.clone().sub(pivot), toT = T.clone().sub(pivot);
      const axis = r.clone().cross(toT);
      if (axis.lengthSq() < 1e-9) continue;
      const step = Math.min(deficit / r.length(), 0.06, MAX_LEAN - leaned);
      g.bones.spine1.rotateOnWorldAxis(axis.normalize(), step);
      g.group.updateMatrixWorld(true);
      leaned += step;
      moved = true;
    }
    if (!moved) break;
  }

  // Attention on the subject: the head turns toward the target area.
  // Capped low so the face stays readable from the front; the eyes imply the rest.
  // `scn.gaze = 'head'` turns the look to the back of the subject's head instead (aftercare).
  if (scn.gaze === 'head') lookAt(g, s.bones.head.getWorldPosition(new THREE.Vector3()), 0.7);
  else lookAt(g, glute.p, 0.42);
  // Over the case, the paddle's contact twists the back, so the look is trimmed back toward the subject.
  if (scn.atCase && !scn.atHead && scn.tool && scn.tool.wide && swing > 1) {
    const w = clamp(swing - 1, 0, 1);
    for (const b of ['neck', 'head']) g.bones[b].quaternion.multiply(new THREE.Quaternion().slerp(degQ(CASE_PADDLE_GAZE[b]), w));
    g.bones.neck.updateMatrixWorld(true);
  }
  if (scn.atHead) {
    // The gaze trim comes in as the arm rises and stays through contact (raised's offsets easing to contact's).
    const w = clamp(swing, 0, 1), c = clamp(swing - 1, 0, 1);
    if (w > 0) for (const b of ['neck', 'head']) g.bones[b].quaternion.multiply(
      degQ(HEAD_GAZE.raised[b]).clone().slerp(degQ(HEAD_GAZE.contact[b]), c).slerp(new THREE.Quaternion(), 1 - w));
    g.bones.neck.updateMatrixWorld(true);
  }

  // Elbow poles: tucked at rest, up and back when raised, then wherever the strike
  // fit puts it at contact.
  const POLE_REST = new THREE.Vector3(-0.1, -0.15, -0.5);
  const POLE_RAISED = scn.atHead ? HEAD_POLE_RAISED : new THREE.Vector3(-0.3, 0.2, -0.45);
  const poleStrike = strikeFit.E.clone().sub(shR);
  // (A wide implement's elbow starts where its rest fit puts it.)
  const poleUp = wide ? wideUp.pole : POLE_RAISED;
  const poleOff = swing <= 1 ? (wide ? (wideRest.pole || wideRest.E.clone().sub(shR)) : POLE_REST).clone().lerp(poleUp, swing) : poleUp.clone().lerp(poleStrike, swing - 1);
  // (Hands on head: from where the shoulder is now, after the lean, so the set elbow directions hold.)
  const poleR = (scn.atHead ? g.bones.upperArmR.getWorldPosition(new THREE.Vector3()) : shR).clone().add(poleOff);
  // Swinging hand: flat on the thigh at rest; palm forward when raised, turning
  // toward the target during the strike; flat on the target, wrist straight, at contact.
  // Resting an implement, the palm tilts REST_TILT so the head end dips onto the thigh
  // and the fist lifts clear (the handle runs toward the thumb: thumbward and a little
  // toward the fingertips).
  let restN = thighN;
  if (tool && !wide) {
    const dW = fingersFwd.clone().cross(thighN.clone().negate()).normalize().addScaledVector(fingersFwd, 0.15).normalize();
    restN = thighN.clone().multiplyScalar(Math.cos(REST_TILT)).addScaledVector(dW, Math.sin(REST_TILT)).normalize();
  }
  // Hanging at the side the palm faces the body, the fingers continuing the forearm.
  const sideIn = giverRight.clone().negate();
  const flatR = swing < 0.3 && !scn.atHead ? restN : swing > 1.9 ? strike.n : null;
  const palmToTarget = flatR ? null : (scn.atHead ? sideIn.clone().lerp(new THREE.Vector3(0, 0, 1), clamp(swing, 0, 1)).normalize() : new THREE.Vector3(0, 0, 1))
    .lerp(contactPt.clone().sub(scn.handR).normalize(), clamp(swing - 1, 0, 1)).normalize();
  const atContact = swing > 1.9;
  if (wide) {
    // A wide implement's hand is turned as a whole: at rest and at contact exactly as the
    // fit holds it (flat across the seat at rest, tilted against the sit spots at contact), and raised as
    // WIDE_RAISED sets it. In between, the hand turns steadily from one to the next.
    const Qr = wideUp.Q, Qc = strikeFit.Q;
    const Qw = swing <= 1 ? wideRest.Q.clone().slerp(Qr, clamp(swing, 0, 1)) : Qr.clone().slerp(Qc, clamp(swing - 1, 0, 1));
    if (!scn.handQ || timed) scn.handQ = Qw; else scn.handQ.slerp(Qw, a);
    const T = scn.tool;
    // The wrist goes where the palm centre and the hand's turn put it, then the hand takes
    // exactly that turn, so the blade lands where it's placed. (Plain armIK: the fit keeps
    // the elbow clear, and may put it behind the back.)
    armIK(g, 'R', scn.handR.clone().sub(T.palmC.clone().applyQuaternion(scn.handQ)), poleR, null, null, null, false, true);
    setHandWorld(g, 'R', scn.handQ);
  } else (scn.atHead && swing > 0.3 && swing < 1.6 ? armIK : armIKClear)(g, 'R', scn.handR, poleR, flatR, atContact ? strikeFit.f : fingersFwd, palmToTarget, atContact && !strikeFit.tiltDeg);   // hands on head: the raised elbow goes where the pole puts it
  // Implement on the skin: where its striking face actually is against where it should
  // be (4 mm into the skin, like the palm), and half the difference into the correction.
  // The same at rest, so it lies on the thigh without sinking in: across the skin, the
  // head's face goes over the rest point; off the skin, the lowest thing held (any
  // point of the brush, or the gripping fingers) ends up REST_GAP above it.
  // Clearance is the subject's own distance field, each point taken back to the rest
  // pose through the nearest pelvis or leg bone: exact about inside and outside, where
  // a nearest-skin-point test is fooled in creases (thigh against glute). Refitted every
  // third frame.
  scn.restTick = (scn.restTick || 0) + 1;
  if (tool && !wide && swing < 0.03 && tool.probes && scn.restTick % 3 === 0) {
    g.bones.handR.updateMatrixWorld(true);
    const M = g.bones.handR.matrixWorld, face = tool.face.clone().applyMatrix4(M);
    const low = restClearance(s, tool.probes, M);
    const key = scn.implement + 'rest', cur = scn.toolFix[key] || new THREE.Vector3();
    const across = restSkin.clone().sub(face); across.addScaledVector(thighN, -across.dot(thighN));
    const err = across.addScaledVector(thighN, REST_GAP - low);
    if (err.length() < 0.15) scn.toolFix[key] = cur.addScaledVector(err, 0.5).clampLength(0, 0.12);
  }
  if (tool && !wide && swing > 1.97) {
    g.bones.handR.updateMatrixWorld(true);
    const face = tool.face.clone().applyMatrix4(g.bones.handR.matrixWorld);
    const goal = strike.p.clone().addScaledVector(strike.n, -0.004);
    const key = scn.implement + scn.side, cur = scn.toolFix[key] || new THREE.Vector3();
    const err = goal.sub(face);
    if (err.length() < 0.15) scn.toolFix[key] = cur.addScaledVector(err, 0.5).clampLength(0, 0.1);
  }
  // A wide implement, the same way at both ends of the swing: across the skin, the
  // blade's face centre goes where the fit put it; off the skin, at rest the lowest thing
  // held is REST_GAP clear (nothing sinks in), and at contact the face is WIDE_CONTACT.depth
  // into the higher of the two sites (the glutes above them stand further through, and the
  // press flattens them all onto it).
  if (wide) {
    g.bones.handR.updateMatrixWorld(true);
    const M = g.bones.handR.matrixWorld, atRest = swing < 0.03, onSkin = swing > 1.97;
    const F = atRest ? wideRest : strikeFit, n = F.n;
    if ((atRest || onSkin) && scn.restTick % 3 === 0) {
      const faceW = tool.face.clone().applyMatrix4(M);
      const low = onSkin ? -Math.max(strikeFit.skinL.clone().sub(faceW).dot(n), strikeFit.skinR.clone().sub(faceW).dot(n))
        : -seatExcess(seatPoints(scn), faceW, n, F.a, tool);
      const plan = onSkin ? strikeFit.face : wideRest.faceRest;
      const across = plan.clone().sub(faceW); across.addScaledVector(n, -across.dot(n));
      const err = across.addScaledVector(n, (onSkin ? -scn.wideContact.depth : REST_GAP) - low);
      const key = scn.implement + (onSkin ? 'B' : 'rest'), cur = scn.toolFix[key] || new THREE.Vector3();
      if (err.length() < 0.15) scn.toolFix[key] = cur.addScaledVector(err, 0.5).clampLength(0, 0.1);
    }
    // The blade flattens the skin under it (a footprint the blade's shape) while it's on,
    // everything standing through its face (the press reaches that deep). The press is full
    // out to the blade's edges and corners (the footprint's inner 55%), then eases back to
    // the natural surface beyond them, so the flesh round the blade rises out of a dent.
    const T = tool, amt = clamp((swing - 1.75) / 0.25, 0, 1), faceW = T.face.clone().applyMatrix4(M);
    const deep = amt > 0 ? Math.max(0.02, seatExcess(seatPoints(scn), faceW, strikeFit.n, strikeFit.a, T) + 0.004) : 0.02;
    setPress(s, faceW, strikeFit.n, (T.halfW + 0.015) / 0.55, amt, '', strikeFit.a, T.halfLen - T.halfW, deep);
  }
  const shL = g.bones.upperArmL.getWorldPosition(new THREE.Vector3());
  if (scn.atHead && navW < 0.98) armIKClear(g, 'L', scn.handL, shL.clone().add(new THREE.Vector3(0.1, -0.15, -0.5)), null, null, giverRight);   // hanging: palm to the thigh
  else armIKClear(g, 'L', scn.handL, shL.clone().add(new THREE.Vector3(0.1, -0.15, -0.5)), backN, scn.atHead ? HEAD_NAVEL_FINGERS : fingersFwd);

  // Fingers follow the skin under each hand: the palm is rigid and flat, so on a
  // rounded surface the fingers curl down until their pads meet the skin. The
  // swinging hand wraps the thigh at rest and the glute at contact, and stays
  // open in between.
  if (!scn.patch) {
    const A = scn.anchors;
    scn.patch = { back: skinPatch(s, (scn.atHead ? A.navel : scn.atCase ? A.lowback : A.shoulders).index, 0.14), knee: skinPatch(s, (scn.atCase ? A.cheekL : A.kneeL).index, 0.14),
      L: skinPatch(s, A.foldL[scn.atHead ? HEAD_STRIKE_K : STRIKE_K].index, 0.16), R: skinPatch(s, A.foldR[scn.atHead ? HEAD_STRIKE_K : STRIKE_K].index, 0.16) };
    scn.curl = { L: null, R: null };
  }
  const onSkin = idx => { const pts = posePatch(s, idx); return q => skinSignedDist(pts, q); };
  const wantL = scn.atHead && navW < 0.5 ? 12 : wrapFingers(g, 'L', onSkin(scn.patch.back));
  const wantR = tool ? (tool.grip || IMPLEMENTS[scn.implement].grip).curl   // closed round the implement's handle
    : swing < 0.3 ? (scn.atHead ? 12 : wrapFingers(g, 'R', onSkin(scn.patch.knee)))
    : swing > 1.9 ? wrapFingers(g, 'R', onSkin(scn.patch[scn.side])) : 4;
  const k = timed ? 1 - Math.exp(-dt * 30) : a;
  for (const [side, want] of [['L', wantL], ['R', wantR]]) {
    scn.curl[side] = scn.curl[side] == null ? want : scn.curl[side] + (want - scn.curl[side]) * k;
    setFingerCurl(g, side, scn.curl[side]);
  }
  if (scn.atCase && !scn.atHead) {
    g.bones.thumbL.quaternion.copy(degQ(CASE_THUMB_L));
    // The resting hand's thumb is tucked in, easing out as the hand lifts to swing.
    if (!tool && !wide) g.bones.thumb2R.quaternion.slerp(degQ(CASE_REST_THUMB), clamp(1 - swing / 0.3, 0, 1));
    g.bones.thumbL.updateMatrixWorld(true); g.bones.thumb2R.updateMatrixWorld(true);
  }
  if (tool && tool.thumbQ) { g.bones.thumbR.quaternion.copy(tool.thumbQ[0]); g.bones.thumb2R.quaternion.copy(tool.thumbQ[1]); }   // round the handle
  // A wide implement's fingers take WIDE_RAISED's pose toward the top of the swing.
  const up = wide ? clamp(1 - Math.abs(swing - 1), 0, 1) : 0;
  if (up > 0) { g.bones.fingersR.quaternion.slerp(degQ(scn.wideRaised.fingers), up); g.bones.fingersR.updateMatrixWorld(true); }
  // The fingers dent the skin they press, as the palm does: the resting left hand always,
  // the swinging hand once it's on the skin (not when it holds an implement: its fingers
  // are round the handle, and the implement presses the skin through the palm's press).
  setFingerCaps(s, g, 'L', 1);
  if (!tool) setFingerCaps(s, g, 'R', clamp((swing - 1.75) / 0.25, 0, 1), true);
}

// ════════════════════════════════════════════════════════════════
// IMPLEMENTS — held in the disciplinarian's right hand (scn.setImplement). Each has a
// mark weight: how many of the hand's smacks one of its smacks counts as, toward the
// colour at the contact site (the hand's first few add about 3% each; a weight of
// 5/3 makes that 5%). Coverage is unchanged: one glute at a time, as with the hand.
//   hairbrush: a wooden paddle brush, held in a fist. The handle crosses the palm
//   diagonally, from the heel under the little finger to the base of the index finger,
//   the fingers wrapped round it, and the oval head stands out past the thumb side with
//   its flat back facing the way the palm does. At contact the back of the head lands
//   on the target and the hand sits where that puts it (see updateScene).
//   paddle: a wide, thick wooden paddle, one board, its flat handle in the fist with the
//   faces parallel to the palm (the palm faces the way the striking face does) and the
//   thumb under the handle against the back face; the blade stands out past the thumb,
//   and the fist that holds it is fitted to the handle (tool.grip). It's wide: the blade
//   lands across both contact sites at once, tilted against the sit spots, its long axis
//   running level from the near site to the far one, and presses the glutes flat under
//   it; each smack marks both sides (8/3: the hand's early 3% becomes 8%, on each). It
//   rests flat across the seat, just touching. See wideFit.
// ════════════════════════════════════════════════════════════════
const IMPLEMENTS = {
  hand:      { mark: 1 },
  hairbrush: { mark: 5 / 3, grip: { curl: 60, bend: 80 }, build: buildHairbrush },
  // `giver`: layers over the disciplinarian's beat poses while this implement is held. The
  // paddle's contact keeps the relaxed torso (the pose editor's pose was set on it) and
  // lifts the right shoulder a little; raised, the shoulder draws back.
  // `giverCase`: over the case the stance is the position's own; the paddle only twists the upper back toward
  // the subject on contact (from a pose-editor report).
  paddle:    { mark: 8 / 3, build: buildPaddle, giverCase: { contact: { spine2: [10, 36, 0], clavL: [-1.4, 2.5, -10.1] } }, giver: { raised: { clavR: [8.9, -11.9, 3.2] }, contact: { spine1: [8, 0, 0], spine2: [0, 0, 0], neck: [10, 0, 0], clavR: [2.5, 4.2, -8] } } },
};
const REST_GAP = 0.001;   // an implement at rest: its lowest point this far off the skin
const REST_SEGS = [['pelvis', 'spine1'], ['thighL', 'shinL'], ['thighR', 'shinR'], ['shinL', 'footL'], ['shinR', 'footR']];
const _rv = new THREE.Vector3(), _rw = new THREE.Vector3();
// The smallest clearance between the subject's skin and any of `probes` ([point, radius],
// in the frame of matrix M, e.g. the holding hand's). Exact about inside and outside: each
// point is taken back to the rest pose through the nearest pelvis or leg bone and measured
// in the subject's own distance field (a nearest-skin-point test is fooled in creases).
function restClearance(s, probes, M) {
  const segs = REST_SEGS.map(([a, b]) => ({ a: s.bones[a].getWorldPosition(new THREE.Vector3()), b: s.bones[b].getWorldPosition(new THREE.Vector3()),
    inv: s.bones[a].matrixWorld.clone().multiply(s.mesh.skeleton.boneInverses[BONES.indexOf(a)]).invert() }));
  const q = new THREE.Vector3();
  let low = Infinity;
  for (const [pt, r] of probes) {
    q.copy(pt).applyMatrix4(M);
    let bd = Infinity, sg = null;
    for (const S2 of segs) { const ab = _rv.copy(S2.b).sub(S2.a), t = clamp(_rw.copy(q).sub(S2.a).dot(ab) / ab.lengthSq(), 0, 1); const dd = _rw.copy(S2.a).addScaledVector(ab, t).distanceTo(q); if (dd < bd) { bd = dd; sg = S2; } }
    low = Math.min(low, field(s.spec, q.applyMatrix4(sg.inv).toArray()) - r);
  }
  return low;
}
// Where a handle fits in a fist: the fingers' centreline with the knuckle curled `curl`
// and the middle and end joints bent `bend` each (degrees), in the plane of the hand
// (u along the fingers, v out of the palm, from the knuckle). Returns the centre and the
// radius of the largest round handle that the fingers and the palm close on.
function fistPocket(H, curl, bend) {
  const fl = FINGERS[1][1] * 0.106 * H, fR = FINGERS[1][2] * H * 0.9, palmHalf = 0.0085 * H;
  const lens = [FINGER_JOINTS[0], FINGER_JOINTS[1] - FINGER_JOINTS[0], 1 - FINGER_JOINTS[1]].map(k => k * fl);
  const pts = [[0, 0]];
  lens.forEach((l, i) => { const a = (curl + i * bend) * Math.PI / 180, [x, y] = pts[i]; pts.push([x + l * Math.cos(a), y + l * Math.sin(a)]); });
  const segD = (u, v, [ax, ay], [bx, by]) => {
    const dx = bx - ax, dy = by - ay, t = clamp(((u - ax) * dx + (v - ay) * dy) / (dx * dx + dy * dy), 0, 1);
    return Math.hypot(u - ax - t * dx, v - ay - t * dy);
  };
  // Only points the curled finger encloses (inside the loop it makes back to the knuckle).
  const inside = (u, v) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > v) !== (yj > v) && u < (xj - xi) * (v - yi) / (yj - yi) + xi) c = !c; } return c; };
  let best = { u: 0, v: 0, r: -1 };
  for (let u = -0.05; u <= 0.06; u += 0.0005) for (let v = palmHalf; v <= 0.08; v += 0.0005) {
    if (!inside(u, v)) continue;
    const r = Math.min(segD(u, v, pts[0], pts[1]), segD(u, v, pts[1], pts[2]), segD(u, v, pts[2], pts[3])) - fR;
    const rr = Math.min(r, v - palmHalf);
    if (rr > best.r) best = { u, v, r: rr };
  }
  best.pts = pts; best.fR = fR;   // the curled finger's centreline, and its radius
  return best;
}
// Built in the right hand bone's frame. Returns the group and, for placing the hand at
// contact, where the head's striking face is relative to the palm centre: `along` the
// fingers, `across` toward the thumb, and `off`, how far it stands out from the palm.
function buildHairbrush(g) {
  const H = g.spec.H, hl = 0.106 * H, side = 'R';
  const along = g.bones['fingers' + side].position.clone().normalize();
  const palmN = new THREE.Vector3(along.y, -along.x, 0).normalize().multiplyScalar(-1);   // out of the palm (right hand)
  const across = along.clone().cross(palmN).normalize();                                  // toward the thumb
  const palmC = along.clone().multiplyScalar(0.42 * hl);
  const wood = new THREE.MeshStandardMaterial({ color: lin(0x8a5a32), roughness: 0.45, metalness: 0 });
  const bristleBed = new THREE.MeshStandardMaterial({ color: lin(0x1c1612), roughness: 0.9 });
  const grp = new THREE.Group();
  const palmHalf = 0.0085 * H, headT = 0.017, headK = 1.15;
  // The handle lies across the fist, square to the fingers (a slight lean toward the
  // fingertips at the thumb end), centred in the pocket the gripping fingers close
  // round, and just thick enough to fill it.
  const G = IMPLEMENTS.hairbrush.grip, pocket = fistPocket(H, G.curl, G.bend);
  const handleR = clamp(pocket.r, 0.008, 0.013);
  const knuckle = g.bones['fingers' + side].position.clone();
  const gripC = knuckle.clone().addScaledVector(along, pocket.u).addScaledVector(palmN, pocket.v);
  const d = across.clone().addScaledVector(along, 0.15).normalize();
  const side2 = d.clone().cross(palmN).normalize();                   // in the palm's plane, square to the handle (right-handed with d, palmN)
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(side2, d, palmN));
  const out = 0.075, butt = 0.035;                                    // handle beyond the grip on each side
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(handleR * 0.85, handleR, out + butt, 20), wood);
  handle.position.copy(gripC).addScaledVector(d, (out - butt) / 2);
  handle.quaternion.copy(q);
  // Head: a flat oval paddle on the end of the handle, long axis along it, its back
  // (the striking face) toward the palm's side, level with the handle's outer edge.
  const head = new THREE.Mesh(new THREE.SphereGeometry(1, 36, 16), wood);
  head.scale.set(0.034 * headK, 0.048 * headK, headT / 2);
  const headC = gripC.clone().addScaledVector(d, out + 0.044 * headK).addScaledVector(palmN, handleR - headT / 2);
  head.position.copy(headC);
  head.quaternion.copy(q);
  // The bristles' bed, on the face away from the skin.
  const bed = new THREE.Mesh(new THREE.SphereGeometry(1, 30, 12), bristleBed);
  bed.scale.set(0.028 * headK, 0.041 * headK, 0.005);
  bed.position.copy(headC).addScaledVector(palmN, -headT / 2);
  bed.quaternion.copy(q);
  for (const m of [handle, head, bed]) { m.castShadow = true; grp.add(m); }
  g.bones['hand' + side].add(grp);
  const rel = headC.clone().sub(palmC);
  // `probes`: points (hand frame) with a radius, covering everything held that could
  // touch a surface: the brush's own vertices (radius 0) and the gripping fingers'
  // centrelines (each finger at its own place across the hand), for resting it without
  // anything sinking in (see updateScene).
  const probes = [];
  grp.updateMatrix();
  for (const m of [handle, head, bed]) {
    m.updateMatrix();
    const P = m.geometry.attributes.position;
    for (let i = 0; i < P.count; i += 3) probes.push([new THREE.Vector3().fromBufferAttribute(P, i).applyMatrix4(m.matrix), 0]);
  }
  for (const [offF] of FINGERS) for (let k = 0; k + 1 < pocket.pts.length; k++) for (let t = 0; t < 1; t += 0.25) {
    const [ax, ay] = pocket.pts[k], [bx, by] = pocket.pts[k + 1];
    probes.push([knuckle.clone().addScaledVector(along, ax + (bx - ax) * t).addScaledVector(palmN, ay + (by - ay) * t)
      .addScaledVector(across, offF * FINGER_PITCH * H), pocket.fR]);
  }
  // `face`: the middle of the striking face (the head's back), in the hand's frame, with
  // its outward normal `faceN` and the brush's long axis `axis` (toward the head).
  return { grp, probes, along: rel.dot(along), across: rel.dot(across), off: rel.dot(palmN) + headT / 2 - palmHalf,
    face: headC.clone().addScaledVector(palmN, headT / 2), faceN: palmN.clone(), axis: d.clone() };
}

// The paddle, in metres, cut from one board `thick` thick: the blade's length and width
// and the radius of its far corners; the `neck` over which its shoulders sweep in to the
// handle; the handle's length (butt to shoulders) and width, and how far its butt stands
// out past the little finger. `lean`: the handle's slant across the palm toward the
// fingertips at the thumb end (0 is square to the fingers); `seat`, how far in from the
// knuckles toward the heel of the palm it lies, the fingers curled tight round it.
// Held with the board's faces parallel to the palm: the palm, heel and all, faces the
// way the striking face does, its back face on the palm, the fingers wrapped round it
// and the thumb over its front face. The blade stands out past the thumb.
const PADDLE = { len: 0.28, width: 0.13, thick: 0.016, corner: 0.03, neck: 0.035, handle: 0.115, handleW: 0.026, butt: 0.012, lean: 0.25, seat: 0.02 };
// The gripping finger's centreline, knuckle to tip, curled `curl` at the knuckle and `bend`
// at each of the other joints (degrees), in the plane of the hand as fistPocket's; and its
// radius.
function fingerChain(H, curl, bend, f = 1) {
  const fl = FINGERS[f][1] * 0.106 * H;
  const lens = [FINGER_JOINTS[0], FINGER_JOINTS[1] - FINGER_JOINTS[0], 1 - FINGER_JOINTS[1]].map(k => k * fl);
  const pts = [[0, 0]];
  lens.forEach((l, i) => { const a = (curl + i * bend) * Math.PI / 180, [x, y] = pts[i]; pts.push([x + l * Math.cos(a), y + l * Math.sin(a)]); });
  return { pts, fR: FINGERS[f][2] * H * 0.9 };
}
// A flat handle in the fist: its cross-section a rounded rectangle, `a` half-width along
// the fingers, `b` half-thickness out of the palm, corners `rc`, slanting `lean` along
// the fingers per unit across, its centre `seat` in from the knuckles toward the heel of
// the palm (from the middle knuckle, across the middle of the hand). Finds how the
// fingers close on it there: the knuckle curl and the other joints' bend, and how far
// the handle rides off the palm (`back`, its back face, is the least; 2 mm at most), the
// fist as tightly closed as it can be with the middle finger's tip coming back over its
// front face, no finger more than 3 mm into it (skin gives) and the nearest within
// 2.5 mm, then with as much of the fingers as possible bearing on it (each finger with its own length and knuckle, and the handle where it
// crosses that finger). Returns the curl and bend, the centre (u, v, from the middle
// knuckle), and the middle finger's centreline and radius.
function flatGrip(H, a, b, rc, back, lean, seat) {
  const hl = 0.106 * H, u = -seat - lean * FINGERS[1][0] * FINGER_PITCH * H;
  let best = null, fallback = null;
  for (let curl = 40; curl <= 120; curl += 2) for (let bend = 50; bend <= 110; bend += 5) {
    const samp = [];
    let tip = null;
    FINGERS.forEach(([off, , , setBack], f) => {
      const ch = fingerChain(H, curl, bend, f), du = -setBack * hl - lean * off * FINGER_PITCH * H;
      for (let k = 0; k + 1 < ch.pts.length; k++) for (let t = 0; t <= 1; t += 1 / 12)
        samp.push([ch.pts[k][0] + (ch.pts[k + 1][0] - ch.pts[k][0]) * t + du, ch.pts[k][1] + (ch.pts[k + 1][1] - ch.pts[k][1]) * t, ch.fR]);
      if (f === 1) tip = [ch.pts[3][0] + du, ch.pts[3][1], ch.fR];
    });
    for (let lift = 0; lift <= 0.002; lift += 0.001) {
      const v = back + b + lift;
      const sd = (px, py) => {   // signed distance from the handle's outline
        const qx = Math.abs(px - u) - (a - rc), qy = Math.abs(py - v) - (b - rc);
        return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rc;
      };
      let c = Infinity, n = 0;
      for (const [x, y, r] of samp) { const e = sd(x, y) - r; c = Math.min(c, e); if (e < 0.003) n++; }
      const wraps = tip[1] > v && tip[0] < u + a && sd(tip[0], tip[1]) - tip[2] < 0.003;
      const { pts, fR } = fingerChain(H, curl, bend);
      const at = { curl, bend, u, v, clear: c, n, lift, pts, fR };
      const score = curl + bend + n * 0.5 - lift * 1000;   // clenched, bearing on it, low
      at.score = score;
      if (wraps && c >= -0.003 && c <= 0.0025) { if (!best || score > best.score) best = at; }
      else if (!fallback || Math.abs(c) < Math.abs(fallback.clear)) fallback = at;
    }
  }
  return best || fallback;
}
// Built in the right hand bone's frame, like the hairbrush. Returns, for placing it (see
// wideFit): `face`, the middle of the blade's striking face, and `faceN`, which way that
// face looks (the way the palm does); `axis`, along the board from handle to tip; the
// blade's half-length and half-width; the hand's own frame (`palmC`, the palm centre,
// `along` the fingers and `palmN` out of the palm); `grip`, the fist that holds it, and
// `thumbQ`, the thumb bone's turn onto the handle's front face; and
// `probes` as the hairbrush's, with `faceProbes` just the striking face's.
function buildPaddle(g) {
  const H = g.spec.H, hl = 0.106 * H, side = 'R', P = PADDLE;
  const along = g.bones['fingers' + side].position.clone().normalize();
  const palmN = new THREE.Vector3(along.y, -along.x, 0).normalize().multiplyScalar(-1);   // out of the palm (right hand)
  const across = along.clone().cross(palmN).normalize();                                  // toward the thumb
  const knuckle = g.bones['fingers' + side].position.clone();
  const d = across.clone().addScaledVector(along, P.lean).normalize();   // along the board, toward the tip
  const w = palmN.clone().cross(d);                                      // across it, about along the fingers (d, w, palmN right-handed)
  const palmHalf = 0.0085 * H, hw = P.handleW / 2, bev = 0.004;
  // The handle's back face lies on the palm, and the fingers close round it.
  const grip = flatGrip(H, hw * Math.hypot(1, P.lean), P.thick / 2, bev + 0.002, palmHalf, P.lean, P.seat);
  const gripC = knuckle.clone().addScaledVector(along, grip.u).addScaledVector(palmN, grip.v);
  const toBoard = p => { const q = p.clone().sub(gripC); return new THREE.Vector3(q.dot(d), q.dot(w), q.dot(palmN)); };
  // Along the board from the grip's centre: the butt just past the little finger, and the
  // shoulders the handle's length on (further if the thumb needs it), then the neck and blade.
  const xb = -((-FINGERS[3][0]) * FINGER_PITCH * H + FINGERS[3][2] * H + P.butt), xs0 = xb + P.handle;
  // Signed distance from the handle (board coordinates), a box with rounded edges.
  const handleD = q => {
    const qx = Math.abs(q.x - (xb + xs0) / 2) - ((xs0 - xb) / 2 - bev), qy = Math.abs(q.y) - (hw - bev), qz = Math.abs(q.z) - (P.thick / 2 - bev);
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - bev;
  };
  // The thumb comes round to the other side of the handle from the palm. Its centreline
  // (hand frame; the right hand's palm side is +x at rest), with its radius, turns at its
  // base: out of the palm (about the fingers' line), then across it (about the palm's
  // normal), the least that brings its pad to rest on the handle's front face, clear of
  // the curled index finger.
  // Its knuckle then bends it across (about the palm's normal, in the thumb's own frame),
  // so the last segment can lie on the face.
  const tb = g.bones['thumb' + side].position.clone(), tk = g.bones['thumb2' + side].position.clone(), thumb = [];
  for (let k = 0; k + 1 < THUMB.length; k++) for (let t = k ? 0.1 : 0; t <= 1.0001; t += 0.1) {
    const [k0, x0, z0, r0] = THUMB[k], [k1, x1, z1, r1] = THUMB[k + 1], m = (a, b) => a + (b - a) * t;
    const p = along.clone().multiplyScalar(m(k0, k1) * hl).add(new THREE.Vector3(m(x0, x1) * H, 0, m(z0, z1) * H)).sub(tb);
    thumb.push([k ? p.sub(tk) : p, m(r0, r1) * H, k]);   // the far segment relative to the knuckle
  }
  const fingers = [];   // the curled fingers' centrelines, with their radii
  FINGERS.forEach(([off, , , setBack], f) => {
    const ch = fingerChain(H, grip.curl, grip.bend, f);
    for (let k = 0; k + 1 < ch.pts.length; k++) for (let t = 0; t <= 1; t += 0.2) {
      const [ax, ay] = ch.pts[k], [bx, by] = ch.pts[k + 1];
      fingers.push([knuckle.clone().addScaledVector(along, ax + (bx - ax) * t - setBack * hl).addScaledVector(palmN, ay + (by - ay) * t)
        .addScaledVector(across, off * FINGER_PITCH * H), ch.fR]);
    }
  });
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), v = new THREE.Vector3(), kw = new THREE.Vector3();
  const qp = new THREE.Quaternion();
  const pose = (al, be, ga, ph, pi) => {
    const Q = qb.setFromAxisAngle(palmN, be * DEG).clone().multiply(qp.setFromAxisAngle(across, pi * DEG)).multiply(qa.setFromAxisAngle(along, -al * DEG));
    const Q2 = new THREE.Quaternion().setFromAxisAngle(palmN.clone().multiplyScalar(Math.cos(ph * DEG)).addScaledVector(across, Math.sin(ph * DEG)), ga * DEG);
    return { Q, Q2, Qt: Q.clone().multiply(Q2) };
  };
  const place = ({ Q, Qt }, fn) => {
    kw.copy(tk).applyQuaternion(Q).add(tb);   // the knuckle, placed
    for (const [p, r, seg] of thumb) fn(seg ? v.copy(p).applyQuaternion(Qt).add(kw) : v.copy(p).applyQuaternion(Q).add(tb), r);
  };
  let thumbFit = null;
  const tryPose = (al, be, ga, ph, pi) => {
    const P2 = pose(al, be, ga, ph, pi);
    let near = Infinity, far = -Infinity, on = 0, off = false;
    place(P2, (v, r) => {
      const q = toBoard(v), dd = handleD(q) - r;
      near = Math.min(near, dd);
      far = Math.max(far, q.x + r);
      // Touching the handle's back face (that's the palm's), or the shoulders beyond it,
      // rules the pose out; its side, where the web of the thumb comes round, is allowed,
      // and each point on the front face counts toward the rest.
      if (dd < 0.002) { if (q.z < -P.thick / 2 + 0.002 || q.x > xs0) off = true; else if (q.z > P.thick / 2 - 0.001 && Math.abs(q.y) < hw - bev && q.x < xs0 - 0.015) on++; }
    });
    if (near < 0.0003 || off || !on) return;
    // Resting on it (not hovering), as much of the pad as will lie on the face, the last
    // segment across the handle rather than along it, turned the least.
    const cross = Math.abs(along.clone().applyQuaternion(P2.Qt).dot(w));
    const err = (near > 0.0015 ? 1 + near : 0) - 0.02 * on - 0.03 * cross + 0.0005 * al + 0.0005 * pi + 0.0003 * Math.abs(be) + 0.0003 * Math.abs(ga);
    if (thumbFit && err >= thumbFit.err) return;
    let fing = Infinity;   // clear of the curled fingers
    place(P2, (v, r) => { for (const [f, fr] of fingers) fing = Math.min(fing, v.distanceTo(f) - r - fr); });
    if (fing < -0.001) return;
    thumbFit = { err, Q: P2.Q, Q2: P2.Q2, near, al, be, ga, ph, pi, on, far };
  };
  // (Out of the palm, turned across it and lifted off it at the base; bent at the knuckle.)
  for (let al = 0; al <= 120; al += 6) for (let be = -60; be <= 40; be += 6) for (let pi = 0; pi <= 60; pi += 10)
    for (let ga = -80; ga <= 80; ga += 8) for (const ph of [0, 90]) tryPose(al, be, ga, ph, pi);
  if (thumbFit) {   // then finer, round the best
    const c = thumbFit;
    for (let al = c.al - 4; al <= c.al + 4; al += 2) for (let be = c.be - 4; be <= c.be + 4; be += 2) for (let pi = c.pi - 6; pi <= c.pi + 6; pi += 3)
      for (let ga = c.ga - 6; ga <= c.ga + 6; ga += 3) for (let ph = c.ph - 30; ph <= c.ph + 30; ph += 15) tryPose(al, be, ga, ph, pi);
  }
  const thumbQ = thumbFit ? [thumbFit.Q, thumbFit.Q2] : null;
  const xs = Math.max(xs0, thumbFit ? thumbFit.far + 0.006 : 0), xn = xs + P.neck, xt = xn + P.len;
  // One outline, blade and handle together, inset by the bevel the extrusion adds back.
  const hh = hw - bev, hy = P.width / 2 - bev, r = P.corner - bev, rb = hh * 0.8, e = xt - bev, b0 = xb + bev;
  const shape = new THREE.Shape();
  shape.moveTo(b0 + rb, -hh); shape.lineTo(xs, -hh);
  shape.bezierCurveTo(xs + P.neck * 0.55, -hh, xn - P.neck * 0.45, -hy, xn, -hy);
  shape.lineTo(e - r, -hy); shape.quadraticCurveTo(e, -hy, e, -hy + r);
  shape.lineTo(e, hy - r); shape.quadraticCurveTo(e, hy, e - r, hy);
  shape.lineTo(xn, hy); shape.bezierCurveTo(xn - P.neck * 0.45, hy, xs + P.neck * 0.55, hh, xs, hh);
  shape.lineTo(b0 + rb, hh); shape.quadraticCurveTo(b0, hh, b0, hh - rb);
  shape.lineTo(b0, -hh + rb); shape.quadraticCurveTo(b0, -hh, b0 + rb, -hh);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: P.thick - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 3, curveSegments: 10 });
  geo.translate(0, 0, -(P.thick - 2 * bev) / 2);
  geo.computeVertexNormals();
  const wood = new THREE.MeshStandardMaterial({ color: lin(0x6e4424), roughness: 0.5, metalness: 0 });
  const board = new THREE.Mesh(geo, wood);
  board.position.copy(gripC);
  board.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(d, w, palmN));
  board.castShadow = true;
  const grp = new THREE.Group();
  grp.add(board);
  g.bones['hand' + side].add(grp);
  // Probes (hand frame): the board's own vertices and the gripping fingers' centrelines,
  // as for the hairbrush; and the blade's striking face on its own, as a 1 cm grid (its
  // mesh has vertices only round the rim).
  const bladeC = gripC.clone().addScaledVector(d, xn + P.len / 2), faceC = bladeC.clone().addScaledVector(palmN, P.thick / 2);
  const probes = [], faceProbes = [];
  board.updateMatrix();
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i += 3) probes.push([new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(board.matrix), 0]);
  const hx = P.len / 2 - bev;
  for (let x = -hx; x <= hx; x += 0.01) for (let y = -hy; y <= hy; y += 0.01) {
    const cx = Math.max(x - (hx - r), 0), cy = Math.max(Math.abs(y) - (hy - r), 0);
    if (Math.hypot(cx, cy) <= r) faceProbes.push([faceC.clone().addScaledVector(d, x).addScaledVector(w, y), 0]);
  }
  probes.push(...faceProbes);
  for (const [offF] of FINGERS) for (let k = 0; k + 1 < grip.pts.length; k++) for (let t = 0; t < 1; t += 0.25) {
    const [ax, ay] = grip.pts[k], [bx, by] = grip.pts[k + 1];
    probes.push([knuckle.clone().addScaledVector(along, ax + (bx - ax) * t).addScaledVector(palmN, ay + (by - ay) * t)
      .addScaledVector(across, offF * FINGER_PITCH * H), grip.fR]);
  }
  return { grp, probes, faceProbes, wide: true, face: faceC, faceN: palmN.clone(), axis: d, halfLen: P.len / 2, halfW: P.width / 2,
    palmC: along.clone().multiplyScalar(0.42 * hl), along, palmN, grip: { curl: grip.curl, bend: grip.bend },
    thumbQ, thumbFit: thumbFit && { near: thumbFit.near, al: thumbFit.al, be: thumbFit.be, ga: thumbFit.ga, ph: thumbFit.ph, pi: thumbFit.pi, on: thumbFit.on }, handleSpan: [xb, xs] };
}

// ── Wide implements: one blade across both contact sites ──
// The blade's pose comes first, and the hand follows from how the paddle sits in the
// fist. Contact is set (WIDE_CONTACT, below); the rest pose is searched:
//  - Roll: the blade's plane is found with its long axis along the line from the near
//    site (the subject's left, nearer the disciplinarian) to the far one, which is level:
//    whichever angle about that line leaves the least skin under the blade standing
//    above it, i.e. the plane that sits on the seat.
//  - Yaw within that plane: the blade may then turn off the line, up to WIDE_YAW, lying
//    diagonally across the seat (both sites stay on the face, and well inside it), tip
//    toward the far side. The palm faces the way the face does, so this is what lets the
//    forearm come in from the disciplinarian's side with the wrist near straight.
//  - Slide along its axis: off-centre toward either end, up to WIDE_SLIDE, sites permitting.
//  - Scoring: a gap between the face and either site is penalised (both should be touched),
//    as is turning or sliding far. Then, for each pose, every elbow position the upper arm
//    and forearm allow is tried, and scored on the wrist (extension and flexion, radial and
//    ulnar deviation, each with a comfortable range and a limit), the shoulder's range (the
//    elbow not drawn in behind the back, nor further behind the chest's plane than
//    SHOULDER_BACK, nor raised far above the shoulder),
//    the elbow clear of the torso, the shoulder's twist and the forearm clear of the
//    subject, as the hand's strike search is. Anything past a limit is heavily penalised
//    rather than dropped, so there's always a pose, the least bad.
// Cached, and refitted only when the sites or the shoulder have moved a centimetre. The fit
// is the contact pose, with the rest pose as its `rest`.
const WIDE_DEPTH = 0.005;   // the rest search's face this far into the (uncompressed) skin, before it's lifted clear
const WIDE_ARC = new THREE.Vector3(-0.14, 0, 0.05);   // the swing's outward bow at its middle (m, for 1.7 m tall)
// How far the subject's skin stands above a blade's face: the highest of the posed skin
// points `pts` (as posePatch returns them) inside the blade's footprint (centre `c`, long
// axis `a`, normal `n` out of the skin), measured along n from the face's plane. Only
// points up to the blade's thickness and a little beyond count (anything further is
// behind the blade, not through it). Exact for a flat face, and not fooled by creases.
function seatExcess(pts, c, n, a, T) {
  const b = n.clone().cross(a), top = PADDLE.thick + 0.03;
  let worst = -Infinity;
  for (let i = 0; i < pts.length; i += 6) {
    const dx = pts[i] - c.x, dy = pts[i + 1] - c.y, dz = pts[i + 2] - c.z;
    const h = dx * n.x + dy * n.y + dz * n.z;
    if (h > top || h <= worst) continue;
    if (Math.abs(dx * a.x + dy * a.y + dz * a.z) > T.halfLen || Math.abs(dx * b.x + dy * b.y + dz * b.z) > T.halfW) continue;
    worst = h;
  }
  return worst;
}
// The subject's skin round the seat, as mesh indices (rest space, once per scene), and posed.
function seatPoints(scn) {
  if (!scn.seatPatch) scn.seatPatch = skinPatch(scn.s, scn.anchors.glute.index, 0.32);
  return posePatch(scn.s, scn.seatPatch);
}
// Signed clearance of an elbow outside the torso's cross-section (an ellipse, the larger
// of the underbust and waist rings, grown by the upper arm's thickness), in the torso's
// own frame: positive = clear. Unlike elbowClearance this lets it pass behind the back.
function elbowClearAround(ch, E) {
  const J = ch.spec.J, Y = ch.spec.Y, P = ch.spec.prims[0];
  const q = E.clone().applyMatrix4(ch.bones.spine1.matrixWorld.clone().invert()).add(new THREE.Vector3(...J.spine1));
  const r1 = loftRing(P, Y.under), r2 = loftRing(P, Y.waist), m = ch.spec.m.arm / 100 / (2 * Math.PI) + 0.012;
  const A = Math.max(r1[0], r2[0]) + m, z = q.z - (r1[3] + r2[3]) / 2, B = (z > 0 ? Math.max(r1[1], r2[1]) : Math.max(r1[2], r2[2])) + m;
  return (Math.hypot(q.x / A, z / B) - 1) * Math.min(A, B);
}
const WIDE_SLIDE = 0.045;   // the blade's centre off the sites' midpoint, along its axis, at most (m)
const WIDE_YAW = 32;        // degrees the blade may turn off the sites' line, within its own plane
// The blade at contact, against the sit spots, as set in the viewer's pose editor (Aya with
// Rin and with Kiko, the two averaged): its face turned `roll` degrees from facing straight
// down about the level line between the sites (so it faces up the body and down), its long
// axis along that line turned `yaw` degrees within the face's plane, its centre `slide`
// along the line toward the far site and `drop` below the sites' midpoint across the face
// (m, for 1.7 m tall), and the higher site `depth` into its face.
// `elbow`: the upper arm's direction from the shoulder, in the torso's (spine1) frame; the
// elbow goes to the point nearest it that the arm can reach. No comfort limits apply here:
// the wrist is well past its usual range, by choice.
// The blade raised, as set on Aya in the viewer's pose editor: its face centre from the
// right shoulder (m, for 1.7 m tall), the face's outward normal and long axis (world), the
// upper arm's direction from the shoulder (world; the elbow is put in that plane), and the
// fingers' pose (degrees, as the pose tables), eased in toward the top of the swing. Scaled
// by height, it suits Kenji as it is.
const WIDE_RAISED = { face: [-0.2491, 0.3825, 0.089], faceN: [0.651, -0.455, 0.607], axis: [0.185, 0.871, 0.454],
  elbow: [-0.3756, 0.247, -0.8932], fingers: [3, 0, 70] };
// Over the case the sites face backward and up rather than up the body, so the blade's roll is
// its own (from the viewer's pose editor); the raised blade is turned with the disciplinarian.
const CASE_WIDE_CONTACT = { roll: 82.5, yaw: 0, slide: 0, drop: 0.01, depth: 0.02, elbow: [-0.7, -0.45, -0.55] };
// The blade at rest over the case, from the viewer's pose editor (Kenji with Aya): held low at the
// right side, its face turned toward the subject. Face centre from the right shoulder (m, for 1.7 m
// tall), the face's normal and long axis, all in the frame before the disciplinarian's yaw.
const CASE_WIDE_REST = { face: [0.001, -0.661, 0.201], faceN: [0.967, -0.191, -0.167], axis: [0.135, -0.171, 0.976], elbow: [-0.174, -0.956, -0.237] };
function caseWideRest(yaw = CASE_YAW) {
  const c = Math.cos(yaw * Math.PI / 180), s = Math.sin(yaw * Math.PI / 180);
  const rot = ([x, y, z]) => [x * c + z * s, y, -x * s + z * c];
  const R = CASE_WIDE_REST;
  return { face: rot(R.face), faceN: rot(R.faceN), axis: rot(R.axis), elbow: rot(R.elbow) };
}
function caseWideRaised(yaw = CASE_YAW) {
  const c = Math.cos(yaw * Math.PI / 180), s = Math.sin(yaw * Math.PI / 180);
  const rot = ([x, y, z]) => [x * c + z * s, y, -x * s + z * c];
  const R = WIDE_RAISED;
  return { ...R, face: rot(R.face), faceN: rot(R.faceN), axis: rot(R.axis), elbow: rot(R.elbow) };
}
const WIDE_CONTACT = { roll: 58.2, yaw: 2.7, slide: 0.0083, drop: 0.0158, depth: 0.02, elbow: [-0.0771, -0.4957, -0.865] };
// How far the upper arm can go behind the plane of the chest, degrees. Measured from that
// plane rather than from hanging down, since the elbow can go back a long way once it's
// out to the side: a seated paddler's elbow is up and back, the forearm coming forward
// and down to the fist at the hip.
const SHOULDER_BACK = 50;
const DEG = Math.PI / 180;
// The hand's world rotation that turns the blade's long axis to `a` and its face to look
// at the skin (along −n).
function bladeHandQuat(T, a, n) {
  const Mh = new THREE.Matrix4().makeBasis(T.axis, T.faceN, T.axis.clone().cross(T.faceN)).transpose();
  const f = n.clone().negate();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(a, f, a.clone().cross(f)).multiply(Mh));
}
function wideFit(scn, posed, shR, palm) {
  const g = scn.g, s = scn.s, T = scn.tool;
  const site = key => { const ps = posed(scn.anchors[key][scn.atHead ? HEAD_STRIKE_K : STRIKE_K]); return { skin: ps.p.clone().addScaledVector(ps.n, -palm), n: ps.n.clone() }; };
  const sL = site('foldL'), sR = site('foldR');
  const C = scn.fitCache.B;
  if (C && C.sh.distanceTo(shR) < 0.01 && C.L.distanceTo(sL.skin) < 0.01 && C.R.distanceTo(sR.skin) < 0.01) return C.fit;
  const t0 = performance.now();
  const mid = sL.skin.clone().add(sR.skin).multiplyScalar(0.5);
  const up = new THREE.Vector3(0, 1, 0);
  const line = sR.skin.clone().sub(sL.skin).setY(0).normalize();          // level, near → far
  const seat = seatPoints(scn);
  // The hand's frame from the paddle's: the rotation taking the blade's axis to `a` and its
  // face to look at the skin (−n).
  const handQuat = (a, n) => bladeHandQuat(T, a, n);
  const L1 = g.bones.forearmR.position.length(), L2 = g.bones.handR.position.length(), palmOff = g.spec.H * 0.106 * 0.42;
  const rFore = g.spec.m.forearm / 100 / (2 * Math.PI);
  const torsoQ = g.bones.spine1.getWorldQuaternion(new THREE.Quaternion()).invert();
  const skinPts = seat;   // the forearm reaches down beside the seat, within its patch
  const forearmClear = (E, W) => { let worst = Infinity; for (const t of [0, 0.2, 0.4, 0.6, 0.8]) worst = Math.min(worst, skinSignedDist(skinPts, E.clone().lerp(W, t)) - rFore * 0.85); return worst; };
  const beyond = (x, lo, hi) => Math.max(0, lo - x, x - hi);
  // Every elbow position for a blade pose (`base`: a, n, Q, face and its own score `pose`),
  // scored as described above, into `list`. `anyWrist` keeps even those where the forearm
  // meets the hand at more than about 75° (dropped otherwise).
  const armCands = (list, base, step = 8, anyWrist = false) => {
    const { Q, face } = base;
    const f = T.along.clone().applyQuaternion(Q), p = T.palmN.clone().applyQuaternion(Q), t = f.clone().cross(p);
    const O = face.clone().sub(T.face.clone().applyQuaternion(Q));          // the hand bone's origin
    const P = O.clone().add(T.palmC.clone().applyQuaternion(Q));
    const W = P.clone().addScaledVector(f, -palmOff);
    Object.assign(base, { P, f, W });
    const SW = W.clone().sub(shR), dist = SW.length();
    if (dist >= (L1 + L2) * 0.995) { list.push({ ...base, err: 10 + dist, E: shR.clone().addScaledVector(SW, L1 / dist), bad: true }); return; }
    const dh = SW.divideScalar(dist), a1 = (L1 * L1 - L2 * L2 + dist * dist) / (2 * dist), h1 = Math.sqrt(Math.max(0, L1 * L1 - a1 * a1));
    const e1 = up.clone().addScaledVector(dh, -dh.y).normalize(), e2 = dh.clone().cross(e1);
    for (let ph = 0; ph < 360; ph += step) {
      const E = shR.clone().addScaledVector(dh, a1).addScaledVector(e1, h1 * Math.cos(ph * DEG)).addScaledVector(e2, h1 * Math.sin(ph * DEG));
      const u = W.clone().sub(E).divideScalar(L2), cf = u.dot(f);
      if (cf < 0.25 && !anyWrist) continue;
      // Wrist: + extension (the forearm comes down onto the back of the hand), − flexion;
      // + radial deviation (hand turned toward the thumb), − ulnar.
      const ext = Math.atan2(u.dot(p), cf) / DEG, dev = Math.atan2(u.dot(t), cf) / DEG;
      // Shoulder: the upper arm in the torso's frame (right arm: outward is −x).
      const ua = E.clone().sub(shR).applyQuaternion(torsoQ);
      const lat = -ua.x, back = Math.atan2(-ua.z, Math.hypot(ua.x, ua.y)) / DEG, raised = ua.y / L1;
      const outside = elbowClearAround(g, E), twist = humeralTwist(g, 'R', shR, E, W);
      const limits = beyond(ext, -60, 70) + beyond(dev, -40, 25) + Math.max(0, back - SHOULDER_BACK) + 100 * Math.max(0, -0.02 - lat) + 100 * Math.max(0, raised - 0.3);
      // (Ulnar deviation is how a paddle held like a racket comes into line with the
      // forearm, so it's comfortable further than radial.)
      const err = base.pose + 0.004 * (beyond(ext, -20, 40) + beyond(dev, -30, 12)) + 0.0008 * Math.abs(ext) + 0.0005 * Math.abs(dev)
        + 0.002 * Math.max(0, back - 35) + 0.05 * Math.max(0, raised - 0.1) - 0.08 * clamp(outside, 0, 0.12) + 0.06 * Math.max(0, twist - 1.05) + 0.05 * limits;
      list.push({ ...base, err, E, ext, dev, outside, twist, back, lat, bad: limits > 0 });
    }
  };
  // The best candidate whose elbow clears the torso and whose forearm clears the subject.
  const pick = cands => {
    cands.sort((x, y) => x.err - y.err);
    for (const c of cands.slice(0, 150)) {
      if (c.bad || c.outside < 0.02 || c.twist > 1.3) continue;
      c.clear = forearmClear(c.E, c.W);
      if (c.clear >= 0) return c;
    }
    return cands[0];
  };
  // Rest: roll, yaw and slide searched as described above (the plane that sits on the seat).
  const restCands = [];
  // Roll: n turns about the level line from straight up; coarse, then fine.
  const nAt = th => up.clone().applyAxisAngle(line, th * DEG);
  let rest;
  if (scn.wideRest) {
    // Fixed rest pose (set per position): the blade held at the side, placed from the shoulder.
    const R = scn.wideRest, fN = new THREE.Vector3(...R.faceN).normalize(), ax = new THREE.Vector3(...R.axis);
    ax.addScaledVector(fN, -ax.dot(fN)).normalize();
    const nR = fN.clone().negate(), faceR = shR.clone().addScaledVector(new THREE.Vector3(...R.face), g.spec.H / 1.7);
    armCands(restCands, { yaw: 0, slide: 0, a: ax, n: nR, e: 0, gap: 0, Q: handQuat(ax, nR), face: faceR, roll: 0, pose: 0 }, 4, true);
    // The elbow goes to the candidate nearest the set direction (the upper arm hanging by the side).
    const Er = shR.clone().addScaledVector(new THREE.Vector3(...R.elbow).normalize(), L1);
    rest = restCands.reduce((m, c) => !m || c.E.distanceTo(Er) < m.E.distanceTo(Er) ? c : m, null);
    Object.assign(rest, { palmC: rest.P, faceRest: faceR.clone(), pole: new THREE.Vector3(...R.elbow).normalize().multiplyScalar(0.5) });
  } else {
    let roll = { e: Infinity };
    for (let th = -78; th <= 78; th += 6) { const n = nAt(th), e = seatExcess(seat, mid, n, line, T); if (e < roll.e) roll = { th, n, e }; }
    for (let th = roll.th - 5; th <= roll.th + 5; th += 1) { const n = nAt(th), e = seatExcess(seat, mid, n, line, T); if (e < roll.e) roll = { th, n, e }; }
    const n = roll.n;
    for (let yaw = -WIDE_YAW; yaw <= WIDE_YAW; yaw += 4) {
      const a = line.clone().applyAxisAngle(n, yaw * DEG);
      const b = n.clone().cross(a), Q = handQuat(a, n);
      for (let slide = -WIDE_SLIDE; slide <= WIDE_SLIDE + 1e-6; slide += 0.01) {
        const c = mid.clone().addScaledVector(a, slide);
        // Both sites well inside the blade: 3 cm from its ends, 2.5 cm from its sides.
        const inside = sp => { const d = sp.skin.clone().sub(c); return Math.abs(d.dot(a)) <= T.halfLen - 0.03 && Math.abs(d.dot(b)) <= T.halfW - 0.025; };
        if (!inside(sL) || !inside(sR)) continue;
        const e = seatExcess(seat, c, n, a, T);
        // How far each site is below the face's plane (0 = touching).
        const gap = Math.max(e - sL.skin.clone().sub(c).dot(n), e - sR.skin.clone().sub(c).dot(n));
        const face = c.clone().addScaledVector(n, e - WIDE_DEPTH);
        armCands(restCands, { yaw, slide, a, n, e, gap, Q, face, roll: roll.th, pose: 4 * gap + 0.0004 * Math.abs(yaw) + 0.1 * Math.abs(slide) });
      }
    }
  rest = pick(restCands);
  Object.assign(rest, { palmC: rest.P, faceRest: rest.face.clone().addScaledVector(rest.n, WIDE_DEPTH + REST_GAP) });
  }
  // Contact: the blade against the sit spots (WIDE_CONTACT), its face WIDE_CONTACT.depth
  // into the higher of the two sites. The glutes above them stand well through its plane;
  // the press flattens them onto the face (see updateScene).
  const W_ = scn.wideContact, cn = nAt(W_.roll), cb = cn.clone().cross(line);
  const cc = mid.clone().addScaledVector(line, W_.slide * g.spec.H / 1.7).addScaledVector(cb, -W_.drop * g.spec.H / 1.7);
  let hi = Math.max(sL.skin.clone().sub(cc).dot(cn), sR.skin.clone().sub(cc).dot(cn));
  // Standing, the glutes' rear-most skin stands well proud of the low sites: the blade meets that.
  if (scn.atHead) {
    const ca0 = line.clone().applyAxisAngle(cn, W_.yaw * DEG), cb0 = cn.clone().cross(ca0);
    for (let i = 0; i < seat.length; i += 6) {
      const dx = seat[i] - cc.x, dy = seat[i + 1] - cc.y, dz = seat[i + 2] - cc.z;
      if (Math.abs(dx * ca0.x + dy * ca0.y + dz * ca0.z) > T.halfLen || Math.abs(dx * cb0.x + dy * cb0.y + dz * cb0.z) > T.halfW) continue;
      hi = Math.max(hi, dx * cn.x + dy * cn.y + dz * cn.z);
    }
  }
  const contactCands = [];
  const ca = line.clone().applyAxisAngle(cn, W_.yaw * DEG);
  armCands(contactCands, { yaw: W_.yaw, slide: W_.slide, a: ca, n: cn, Q: handQuat(ca, cn), face: cc.addScaledVector(cn, hi - W_.depth), roll: W_.roll, pose: 0 }, 1, true);
  const Epref = shR.clone().addScaledVector(new THREE.Vector3(...W_.elbow).normalize().applyQuaternion(torsoQ.clone().invert()), L1);
  const fit = contactCands.reduce((m, c) => !m || c.E.distanceTo(Epref) < m.E.distanceTo(Epref) ? c : m, null);
  Object.assign(fit, { p: fit.P, palmC: fit.P, skin: mid, skinL: sL.skin, skinR: sR.skin, tiltDeg: 0, rest, ms: performance.now() - t0 });
  scn.fitCache.B = { sh: shR.clone(), L: sL.skin.clone(), R: sR.skin.clone(), fit };
  return fit;
}

// ── Finger joints ──
// Each hand's fingers are one bone (the knuckle; setFingerCurl), so on their own they
// can only tilt straight. The middle and end joints are bent in the vertex shader, in
// the rest pose before skinning: every vertex carried by a fingers bone and past a
// joint (FINGER_JOINTS, fractions of the middle finger's length from the knuckle) is
// turned about that joint by the hand's bend angle, the far joint first, so the
// finger rolls up. Normals turn with it. Off (0) unless something is gripped.
const FINGER_JOINTS = [0.42, 0.72];
const FINGER_BEND_GLSL = `
  uniform vec3 uFingerK[2], uFingerDir[2];
  uniform vec2 uFingerBend;
  uniform vec3 uFingerJ;
  vec3 fbRot(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(v.x * c - v.y * s, v.x * s + v.y * c, v.z); }
  void bendFingers(inout vec3 p, inout vec3 nrm) {
    for (int i = 0; i < 2; i++) {
      float a = i == 0 ? uFingerBend.x : uFingerBend.y;
      if (a <= 0.0) continue;
      float idx = i == 0 ? ${BONES.indexOf('fingersL')}.0 : ${BONES.indexOf('fingersR')}.0;
      float w = 0.0;
      if (abs(skinIndex.x - idx) < 0.5) w += skinWeight.x;
      if (abs(skinIndex.y - idx) < 0.5) w += skinWeight.y;
      if (abs(skinIndex.z - idx) < 0.5) w += skinWeight.z;
      if (abs(skinIndex.w - idx) < 0.5) w += skinWeight.w;
      if (w < 0.01) continue;
      float sgn = i == 0 ? -1.0 : 1.0;
      vec3 K = uFingerK[i], D = uFingerDir[i];
      float d = dot(p - K, D);
      for (int j = 0; j < 2; j++) {
        float jd = j == 0 ? uFingerJ.y : uFingerJ.x;          // the end joint, then the middle
        float t = smoothstep(jd - uFingerJ.z, jd + uFingerJ.z, d);
        if (t <= 0.0) continue;
        float ang = sgn * a * t * w;
        vec3 P = K + D * jd;
        p = P + fbRot(p - P, ang);
        nrm = fbRot(nrm, ang);
      }
    }
  }
`;
// The middle and end joints' bend, degrees each (0 = straight).
function setFingerBend(ch, side, deg) {
  ch.mesh.material.userData.uniforms.uFingerBend.value[side === 'L' ? 'x' : 'y'] = Math.max(0, deg) * Math.PI / 180;
}

// Finger curl, degrees toward the palm (negative bends them back).
function setFingerCurl(ch, side, deg) {
  const b = ch.bones['fingers' + side];
  b.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, side === 'L' ? -1 : 1), deg * Math.PI / 180);
  b.updateMatrixWorld(true);
}
// The smallest curl (within [lo, hi] degrees) at which the middle finger's pad
// touches the surface given by `dist` (signed distance, world space).
function wrapFingers(ch, side, dist, lo = -8, hi = 40) {
  const hl = ch.spec.H * 0.106, r = FINGERS[1][2] * ch.spec.H * 0.86;
  const along = ch.bones['fingers' + side].position.clone().normalize();
  const palmN = new THREE.Vector3(along.y, -along.x, 0).normalize().multiplyScalar(side === 'L' ? 1 : -1);
  const pad = along.multiplyScalar(hl * FINGERS[1][1] - r).addScaledVector(palmN, r);
  const fb = ch.bones['fingers' + side], w = new THREE.Vector3();
  for (let deg = lo; deg <= hi; deg += 2) {
    setFingerCurl(ch, side, deg);
    if (dist(fb.localToWorld(w.copy(pad))) <= 0.001) return deg;
  }
  return hi;
}
// The subject's mesh vertices within `radius` (rest space) of vertex `index`, and
// those vertices posed (positions + normals, world space) for contact tests.
function skinPatch(ch, index, radius) {
  const pos = ch.mesh.geometry.attributes.position, c = new THREE.Vector3().fromBufferAttribute(pos, index), v = new THREE.Vector3();
  const idx = [];
  for (let i = 0; i < pos.count; i++) if (v.fromBufferAttribute(pos, i).distanceToSquared(c) < radius * radius) idx.push(i);
  return idx;
}
function posePatch(ch, idx) {
  const geo = ch.mesh.geometry, pos = geo.attributes.position, nrm = geo.attributes.normal, si = geo.attributes.skinIndex;
  const inv = ch.mesh.skeleton.boneInverses;
  const mats = ch.mesh.skeleton.bones.map((b, i) => b.matrixWorld.clone().multiply(inv[i]));
  const pts = new Float32Array(idx.length * 6), v = new THREE.Vector3(), n = new THREE.Vector3();
  idx.forEach((i, k) => {
    ch.mesh.boneTransform(i, v.fromBufferAttribute(pos, i)).applyMatrix4(ch.mesh.matrixWorld);
    n.fromBufferAttribute(nrm, i).transformDirection(mats[si.getX(i)]);
    pts[6 * k] = v.x; pts[6 * k + 1] = v.y; pts[6 * k + 2] = v.z; pts[6 * k + 3] = n.x; pts[6 * k + 4] = n.y; pts[6 * k + 5] = n.z;
  });
  return pts;
}

// Contact anchors on the subject, in rest space: march out from a point on the
// bone axis along the back direction (−Z) until the skin surface, and keep that
// point, its surface normal, and the bone that carries it.
function sceneAnchors(s) {
  const spec = s.spec, Y = spec.Y, J = spec.J, H = spec.H;
  const pos = s.mesh.geometry.attributes.position, v = new THREE.Vector3();
  const toSurface = (bone, origin, dz = -1) => {
    const p = origin.slice();
    for (let i = 0; i < 400 && field(spec, p) < 0; i++) p[2] += dz * 0.001;
    const n = norm(gradient(spec, p, 0.0015, field(spec, p)));
    // Nearest mesh vertex to the surface point; its skinned position is tracked per frame.
    const sp = new THREE.Vector3(...p);
    let index = 0, best = Infinity;
    for (let i = 0; i < pos.count; i++) {
      const d = v.fromBufferAttribute(pos, i).distanceToSquared(sp);
      if (d < best) { best = d; index = i; }
    }
    return { bone, index, n: new THREE.Vector3(...n) };
  };
  const kneeAt = side => {
    const a = J['thigh' + side], b = J['shin' + side];
    // The resting hand's place: the back of the thigh, above anything lowered to the knee.
    return [lerp(a[0], b[0], 0.5), lerp(a[1], b[1], 0.5), lerp(a[2], b[2], 0.5)];
  };
  // Strike points: the lower glute where it meets the thigh, one per side.
  const hipA = loftRing(spec.prims[0], Y.hip)[0];
  const foldY = Y.crotch - 0.068 * H;   // the glute/thigh junction, below the crotch line
  return {
    // Resting left hand: mid-back, just below the underbust line (below Aya's top).
    shoulders: toSurface('spine1', [0, Y.under - 0.03 * H, 0]),
    glute: toSurface('pelvis', [0, Y.hip - 0.03 * H, 0]),
    // Over the case the resting left hand lies on the small of the back.
    lowback: toSurface('spine1', [0, Y.waist - 0.02 * H, 0]),
    // Hands on head: the disciplinarian's left hand rests against the navel (front, so marching +Z).
    navel: toSurface('spine1', [0.0506 * H, Y.waist - 0.007 * H, 0], 1),
    // ... and the swinging hand rests by the near cheek (the subject's left, as the strike strip's x).
    cheekL: toSurface('pelvis', [hipA * 0.42, Y.hip - 0.03 * H, 0]),
    // A short strip of candidates per side, from the fold (index 0) up toward the
    // glute; the strike search prefers the lowest one the arm can reach flat.
    foldL: [0, 1, 2, 3, 4, 5, 6, 7].map(k => toSurface('pelvis', [hipA * 0.42, lerp(foldY, Y.hip - 0.035 * H, k / 7), 0])),
    foldR: [0, 1, 2, 3, 4, 5, 6, 7].map(k => toSurface('pelvis', [-hipA * 0.42, lerp(foldY, Y.hip - 0.035 * H, k / 7), 0])),
    kneeL: toSurface('thighL', kneeAt('L')),
    kneeR: toSurface('thighR', kneeAt('R')),
  };
}

// ── Marks: colour building up where the palm lands, one site per side ──
// Each impact moves that side's centre toward where it landed (in rest space,
// through the pelvis bone, so the mark stays put however the body moves) and adds
// one to its count. Strength f follows markStrength: barely there for the first few
// (3 smacks ≈ 3%), 39% by 10, then slowing, logarithmically, to full depth at 100. The colour spreads
// out from the centre as it deepens, at the same rate: at f the tinted area reaches
// f of the way to the edge of that side's region, the whole glute and the first
// top of the thigh: full to the crease where the thigh meets the glute, then fading
// out over MARK_THIGH down the thigh, following the crease's curve. At full strength
// all of the glute is MARK_COLOR.
// Only the skin is tinted; clothing layers are painted over it.
const MARK_COLOR = 0x8e1a1f, MARK_THIGH = 0.03, MARK_HALF = 12, MARK_POW = 2.5;
// The region a side's colour can cover, in rest space. The top stops just below the
// waistband of the character's own underwear (its briefs' `rise`), so no colour shows
// above it; the shader's fade at the top edge ends 2 mm short of the band.
function markRegion(spec) {
  const Y = spec.Y, H = spec.H, briefs = spec.m.wardrobe && spec.m.wardrobe.briefs;
  // The band's lowest point across the back region, which reaches round to the side seam.
  const band = briefs ? Math.min(briefsWaist(spec, briefs, 1), briefsWaist(spec, briefs, 2)) : Infinity;
  return { yLow: Y.crotch - 0.068 * H - MARK_THIGH * H / 1.7, yTop: Math.min(Y.hip + 0.035 * H, band - 0.012), xSide: loftRing(spec.prims[0], Y.hip)[0] * 0.95 };
}
// Up to MARK_KNEE smacks on a side the strength follows the S-curve (barely there for
// the first few, 3 ≈ 3%, 10 ≈ 39%). Beyond that it's logarithmic, reaching full depth at
// MARK_FULL smacks on a side, so each further step of depth takes more smacks than
// the last: 20 ≈ 57%, 30 ≈ 68%, 50 ≈ 82%, 100 = 100% (200 smacks across both sides).
const MARK_KNEE = 10, MARK_FULL = 100;
const markHill = n => n <= 0 ? 0 : n ** MARK_POW / (n ** MARK_POW + MARK_HALF ** MARK_POW);
const MARK_AT_KNEE = markHill(MARK_KNEE);
const markStrength = n => n <= MARK_KNEE ? markHill(n)
  : Math.min(1, MARK_AT_KNEE + (1 - MARK_AT_KNEE) * Math.log(n / MARK_KNEE) / Math.log(MARK_FULL / MARK_KNEE));
// Fading, two ways:
//  - Dancing: each move performed keeps MARK_FADE_MOVE of the strength, so a full
//    routine (MARK_ROUTINE moves) takes 100% down to MARK_AFTER_ROUTINE at any tempo.
//  - Time: all the time (off stage too), proportionally, tuned so that over a typical
//    cycle, MARK_CYCLE_MIN minutes from one correction to the same character's next,
//    with its MARK_CYCLE_ROUTINES routines danced, 100% ends at MARK_AFTER_CYCLE.
//    Time can never take more than that cycle's share since that side's last smack
//    (MARK_TIME_FLOOR), so however long a player takes, a mark is at least
//    MARK_AFTER_CYCLE by the next correction.
// Set ch.marksHeld to pause both (the game holds marks steady through the finale).
// Smacks after some fading build on what's left: the remaining strength counts as the
// number of smacks that would give it (markCount), plus one.
const MARK_ROUTINE = 12, MARK_AFTER_ROUTINE = 0.55;
const MARK_FADE_MOVE = Math.pow(MARK_AFTER_ROUTINE, 1 / MARK_ROUTINE);
const MARK_CYCLE_MIN = 6, MARK_CYCLE_ROUTINES = 1, MARK_AFTER_CYCLE = 0.25;
const MARK_TIME_FLOOR = MARK_AFTER_CYCLE / Math.pow(MARK_AFTER_ROUTINE, MARK_CYCLE_ROUTINES);   // ≈ 0.45
const MARK_KEEP_PER_SEC = Math.pow(MARK_TIME_FLOOR, 1 / (MARK_CYCLE_MIN * 60));
// The number of smacks that gives strength f (markStrength's inverse, for building on a faded mark).
const markCount = f => f <= 0 ? 0 : f <= MARK_AT_KNEE ? MARK_HALF * Math.pow(f / (1 - f), 1 / MARK_POW)
  : MARK_KNEE * Math.pow(MARK_FULL / MARK_KNEE, (Math.min(f, 1) - MARK_AT_KNEE) / (1 - MARK_AT_KNEE));
// `weight`: how many hand smacks this one counts as (an implement's mark weight).
function addMark(ch, side, pointW, weight = 1) {
  const i = BONES.indexOf('pelvis');
  const M = ch.bones.pelvis.matrixWorld.clone().multiply(ch.mesh.skeleton.boneInverses[i]).invert();
  const p = pointW.clone().applyMatrix4(M);
  ch.marks = ch.marks || { L: { n: 0, c: null, f: 0, t: 1 }, R: { n: 0, c: null, f: 0, t: 1 } };
  const m = ch.marks[side];
  m.n = markCount(m.f) + weight;
  m.f = markStrength(m.n);
  m.t = 1;   // the time fade's allowance restarts with each smack
  m.c = m.c ? m.c.lerp(p, 1 / Math.min(m.n, 8)) : p;   // a running centre, settling as smacks accumulate
  applyMarks(ch);
}
// Call every frame for every character, on stage or not.
function fadeMarks(ch, dt) {
  if (!ch.marks || ch.marksHeld) return;
  const keep = Math.pow(MARK_KEEP_PER_SEC, dt);
  for (const side of ['L', 'R']) {
    const m = ch.marks[side];
    if (m.t == null) m.t = 1;
    if (m.f <= 0 || m.t <= MARK_TIME_FLOOR) continue;
    const k = Math.max(keep, MARK_TIME_FLOOR / m.t);   // never past this cycle's share
    m.f *= k; m.t *= k;
  }
  applyMarks(ch);
}
// One dance move performed (see createDancer).
function fadeMarksMove(ch) {
  if (!ch.marks || ch.marksHeld) return;
  for (const side of ['L', 'R']) { const m = ch.marks[side]; m.f *= MARK_FADE_MOVE; if (m.f < 0.005) { m.f = 0; m.n = 0; m.c = null; } }
  if (!ch.marks.L.f && !ch.marks.R.f) ch.marks = null;
  applyMarks(ch);
}
function clearMarks(ch) { ch.marks = null; applyMarks(ch); }
// Copies one character's marks onto another built from the same person (the viewer's
// scene uses its own copies of the pair).
function copyMarks(from, to) {
  to.marks = from.marks ? Object.fromEntries(['L', 'R'].map(s => [s, { ...from.marks[s], c: from.marks[s].c && from.marks[s].c.clone() }])) : null;   // (f, n, t and the centre)
  applyMarks(to);
}
function applyMarks(ch) {
  const u = ch.mesh.material.userData.uniforms, R = markRegion(ch.spec);
  u.uMarkRegion.value.set(R.yLow, R.yTop, R.xSide, MARK_THIGH * ch.spec.H / 1.7);
  ['L', 'R'].forEach((side, k) => {
    const m = ch.marks && ch.marks[side];
    u.uMarkAmt.value[k] = m && m.c ? m.f : 0;
    if (!m || !m.c) return;
    u.uMarkP.value[k].copy(m.c);
    // Per-axis reach from the centre to the region's edges (up, down, sideways), so
    // spreading to 1 in these units covers the whole region.
    const c = m.c, s = k === 0 ? 1 : -1;
    u.uMarkReach.value[k].set(Math.max(0.02, R.yTop - c.y), Math.max(0.02, c.y - R.yLow), Math.max(0.03, R.xSide - s * c.x, s * c.x));
  });
}

// Sets the contact-compression uniforms on a character's body material from a
// world-space palm plane (point on the palm surface, outward skin-side normal).
// First slot only: `axisW` and `halfLen` stretch the footprint along a line in the plane
// (a paddle's blade), the radius then measured from that segment, and `depth` is how far
// above the plane skin is still flattened.
function setPress(ch, pointW, normalW, radius, amount, slot = '', axisW = null, halfLen = 0, depth = 0.02) {
  const u = ch.mesh.material.userData.uniforms;
  const inv = ch.mesh.matrixWorld.clone().invert();
  u['uPressP' + slot].value.copy(pointW).applyMatrix4(inv);
  u['uPressN' + slot].value.copy(normalW).transformDirection(inv);
  u['uPressR' + slot].value = radius;
  u['uPressAmt' + slot].value = amount;
  if (!slot) {
    u.uPressDepth.value = depth;
    if (!axisW) u.uPressAx.value.set(0, 0, 0, 0);
    else { const ax = axisW.clone().transformDirection(inv); u.uPressAx.value.set(ax.x, ax.y, ax.z, halfLen); }
  }
}

// Presses `ch`'s skin against the four fingers of `hand`'s `side` hand, at the hand's current
// curl, `amount` (0–1) in contact. Several hands add up: pass `append` to keep the earlier
// ones. The fingers are straight capsules on the finger bone, as built (see FINGERS).
function setFingerCaps(ch, hand, side, amount, append = false) {
  const u = ch.mesh.material.userData.uniforms, H = hand.spec.H;
  if (!append) u.uCapN.value = 0;
  if (amount <= 0) return;
  const fb = hand.bones['fingers' + side], inv = ch.mesh.matrixWorld.clone().invert();
  fb.updateMatrixWorld(true);
  const dir = fb.position.clone().normalize(), across = new THREE.Vector3(0, 0, 1), handLen = 0.106 * H;
  for (const [off, lenF, rF, back] of FINGERS) {
    if (u.uCapN.value >= CAPS) return;
    const r = rF * H * 0.95;
    const k0 = dir.clone().multiplyScalar(-handLen * back).addScaledVector(across, off * FINGER_PITCH * H);
    const a = k0.clone().addScaledVector(dir, r), b = k0.clone().addScaledVector(dir, handLen * lenF - r);
    const i = u.uCapN.value++;
    u.uCapA.value[i].set(...fb.localToWorld(a).applyMatrix4(inv).toArray(), r);
    u.uCapB.value[i].set(...fb.localToWorld(b).applyMatrix4(inv).toArray(), amount);
  }
}

// Posed skin points (with approximate normals) within `radius` of `centre`, for
// clearance tests against the subject as actually rendered.
function posedSkinNear(ch, centre, radius) {
  const geo = ch.mesh.geometry, pos = geo.attributes.position, nrm = geo.attributes.normal, si = geo.attributes.skinIndex;
  const pts = [], v = new THREE.Vector3(), r2 = radius * radius, inv = ch.mesh.skeleton.boneInverses;
  const mats = ch.mesh.skeleton.bones.map((b, i) => b.matrixWorld.clone().multiply(inv[i]));
  for (let i = 0; i < pos.count; i += 2) {
    ch.mesh.boneTransform(i, v.fromBufferAttribute(pos, i)).applyMatrix4(ch.mesh.matrixWorld);
    if (v.distanceToSquared(centre) > r2) continue;
    const n = new THREE.Vector3().fromBufferAttribute(nrm, i).transformDirection(mats[si.getX(i)]);
    pts.push(v.x, v.y, v.z, n.x, n.y, n.z);
  }
  return new Float32Array(pts);
}
// Signed distance from `q` to the nearest skin point (positive = outside the body).
function skinSignedDist(pts, q) {
  let best = Infinity, bi = 0;
  for (let i = 0; i < pts.length; i += 6) {
    const dx = q.x - pts[i], dy = q.y - pts[i + 1], dz = q.z - pts[i + 2];
    const d = dx * dx + dy * dy + dz * dz;
    if (d < best) { best = d; bi = i; }
  }
  const dx = q.x - pts[bi], dy = q.y - pts[bi + 1], dz = q.z - pts[bi + 2];
  return Math.sign(dx * pts[bi + 3] + dy * pts[bi + 4] + dz * pts[bi + 5]) * Math.sqrt(best);
}

// Half-width an elbow must stay beyond, measured from the torso's centre line:
// the chest's half-width plus the upper arm's thickness and a little clearance.
function torsoHalfWidth(ch) {
  const chest = Math.max(loftRing(ch.spec.prims[0], ch.spec.Y.under)[0], loftRing(ch.spec.prims[0], ch.spec.Y.waist)[0]);
  return chest + ch.spec.m.arm / 100 / (2 * Math.PI) + 0.012;
}
// Signed clearance of an elbow outside the torso, in the torso's own frame
// (so leans and twists are respected): positive = clear, on its own side.
function elbowClearance(ch, side) {
  const e = ch.bones['forearm' + side].getWorldPosition(new THREE.Vector3())
    .applyMatrix4(ch.bones.spine1.matrixWorld.clone().invert());
  return (side === 'L' ? e.x : -e.x) - torsoHalfWidth(ch);
}
// armIK that keeps the elbow outside the torso: if it lands inside, push the pole
// outward (along the torso's side axis) and solve again.
function armIKClear(ch, side, target, pole, ...rest) {
  const P = pole.clone();
  const out = new THREE.Vector3(side === 'L' ? 1 : -1, 0, 0).transformDirection(ch.bones.spine1.matrixWorld);
  for (let i = 0; i < 6; i++) {
    armIK(ch, side, target, P, ...rest);
    const c = elbowClearance(ch, side);
    if (c >= 0) break;
    P.addScaledVector(out, -c + 0.08 * (i + 1));
  }
}

// Failsafe for a hand that can't lay its palm on the floor: flex the wrist so the
// fingertips come down onto the floor if they can reach it, otherwise point them
// straight at it. The floor always wins: the tip (allowing for the hand's
// thickness) never goes below it, even if that means exceeding the wrist limit.
const FLOOR_EPS = 0.003;
const WRIST_MAX = 70 * Math.PI / 180;
function placeFingertips(ch, side) {
  const fo = ch.bones['forearm' + side], ha = ch.bones['hand' + side];
  const W = ha.getWorldPosition(new THREE.Vector3());
  const foreDir = W.clone().sub(fo.getWorldPosition(new THREE.Vector3())).normalize();
  const tipLen = ch.spec.H * 0.106 * 0.9, halfThick = ch.spec.H * 0.0085 * 0.5;
  const floorY = FLOOR_EPS + halfThick;
  const h = W.y - floorY;                       // wrist height above where the tip may go
  const horiz = new THREE.Vector3(foreDir.x, 0, foreDir.z);
  if (horiz.lengthSq() < 1e-4) horiz.set(1, 0, 0);   // toward the subject's head end
  horiz.normalize();
  // Direction whose tip lands exactly on the floor, or straight down if out of reach.
  const sy = clamp(h / tipLen, 0, 1);
  let d = horiz.clone().multiplyScalar(Math.sqrt(1 - sy * sy)).add(new THREE.Vector3(0, -sy, 0));
  // Keep within the wrist's range of the forearm...
  const ang = Math.acos(clamp(d.dot(foreDir), -1, 1));
  if (ang > WRIST_MAX) {
    const axis = foreDir.clone().cross(d);
    if (axis.lengthSq() > 1e-8) d = foreDir.clone().applyAxisAngle(axis.normalize(), WRIST_MAX);
  }
  // ...unless that would put the tip through the floor.
  if (W.y + d.y * tipLen < floorY) {
    const dy = -clamp(h / tipLen, 0, 1);
    const hz = new THREE.Vector3(d.x, 0, d.z);
    if (hz.lengthSq() < 1e-6) hz.copy(horiz);
    d = hz.normalize().multiplyScalar(Math.sqrt(1 - dy * dy)).add(new THREE.Vector3(0, dy, 0));
  }
  // Palm faces down/back toward the floor (or back toward the body if pointing straight down).
  let palmDir = new THREE.Vector3(0, -1, 0).addScaledVector(d, d.y);
  if (palmDir.lengthSq() < 1e-4) palmDir = horiz.clone().negate();
  setHandWorld(ch, side, basisQuat(d, palmDir.normalize()).multiply(restHandQuat(ha, side).invert()));
}

// Shoulder-to-palm-centre reach of an arm.
function armReach(ch, side) {
  return ch.bones['forearm' + side].position.length() + ch.bones['hand' + side].position.length() + ch.spec.H * 0.106 * 0.42;
}

// ════════════════════════════════════════════════════════════════
// DANCE MOVES — each move is a prep pose (the wind-up, half a beat before)
// and a hit pose (on the beat), layered over a relaxed base. Optional:
// turn (body yaw, degrees, + = to the character's left), drop (hips lowered,
// fraction of height), spin (extra full-body rotation during prep → hit).
// "R" variants are generated by mirroring, so left/right always match.
// Bone angle conventions as in POSES above.
// ════════════════════════════════════════════════════════════════
// Ready stance: arms loose off the body, feet hip-width, knees soft. Moves that leave
// the legs alone keep this stance rather than locking straight.
const DANCE_BASE = { upperArmL: [-4, 0, -34], upperArmR: [-4, 0, 34], forearmL: [-22, 0, 0], forearmR: [-22, 0, 0],
  thighL: [-3, 0, -4], thighR: [-3, 0, 4], shinL: [6, 0, 0], shinR: [6, 0, 0] };
// Arm building blocks (left arm; the right mirrors Z): Z −45 hangs the arm at the
// side, Z +45 is out horizontal, Z +135 straight up. X swings the hanging arm
// forward (−X), so [−90, 0, −45] points straight ahead, [−150, 0, −45] forward-up.
const DANCE_SRC = {
  'Extend & Turn L': {   // body turns; left arm high, right arm out behind, left leg extended back
    prep: { thighL: [-15, 0, 0], thighR: [-15, 0, 0], shinL: [25, 0, 0], shinR: [25, 0, 0], spine1: [8, 0, 0],
            upperArmL: [-45, 0, -40], upperArmR: [-45, 0, 40], forearmL: [-90, 0, 0], forearmR: [-90, 0, 0] },
    prepDrop: 0.02,
    hit: { pelvis: [0, 20, 0], spine2: [-6, 15, 0], neck: [0, 20, 0],
           upperArmL: [0, 0, 115], forearmL: [0, 0, 0], upperArmR: [30, 0, -35], forearmR: [0, 0, 0],
           thighL: [28, 0, 6], footL: [25, 0, 0] },
    turn: 25,
  },
  'Step & Reach L': {  // step forward on the left, left arm reaching forward and up, right arm open low behind
    prep: { thighR: [-10, 0, 0], shinR: [20, 0, 0], thighL: [-8, 0, 0], shinL: [12, 0, 0],
            upperArmL: [25, 0, -40], forearmL: [-20, 0, 0], upperArmR: [-40, 0, 40], forearmR: [-60, 0, 0] },
    prepDrop: 0.015,
    hit: { thighL: [-38, 0, 0], shinL: [12, 0, 0], thighR: [16, 0, 0], shinR: [6, 0, 0], pelvis: [0, -10, 0], spine1: [-5, 0, 0],
           upperArmL: [-130, 0, -45], forearmL: [-5, 0, 0], upperArmR: [35, 0, -20], forearmR: [-5, 0, 0], neck: [-12, 0, 0] },
    hitDrop: 0.012,
  },
  'Sway & Sweep L': {    // side lean with both arms sweeping overhead to one side
    prep: { pelvis: [0, 0, 6], spine1: [0, 0, -8], spine2: [0, 0, -6], thighR: [0, 0, -8],
            upperArmL: [0, 0, -30], upperArmR: [0, 0, 60], forearmL: [-20, 0, 0], forearmR: [-20, 0, 0] },
    hit: { pelvis: [0, 0, -8], spine1: [0, 0, 12], spine2: [0, 0, 10], neck: [0, 0, 8], thighL: [0, 0, 10],
           upperArmL: [0, 0, 150], upperArmR: [0, 0, -110], forearmL: [-10, 0, 0], forearmR: [-10, 0, 0] },
  },
  'Cross-Step L': {    // left foot crosses in front; left arm swings across the body, right arm opens behind
    prep: { thighL: [0, 0, 16], upperArmL: [0, 0, 20], upperArmR: [0, 0, -20], forearmL: [0, 0, 0], forearmR: [0, 0, 0] },
    hit: { thighL: [-22, 0, -24], shinL: [15, 0, 0], thighR: [5, 0, 4], shinR: [18, 0, 0], pelvis: [0, 15, 0], spine2: [0, -20, 0],
           upperArmL: [-68, 0, -54], forearmL: [-8, 0, 0], upperArmR: [30, 0, -40], forearmR: [-10, 0, 0], neck: [0, 10, 0] },
    hitDrop: 0.025,
  },
  'Spin & Land': {     // full turn, landing low: knees bent, torso over the knees, arms low and open
    prep: { upperArmL: [-60, 0, -45], upperArmR: [-60, 0, 45], forearmL: [-110, 0, 0], forearmR: [-110, 0, 0], spine2: [-5, 0, 0] },
    hit: { thighL: [-50, 0, 10], thighR: [-20, 0, -8], shinL: [70, 0, 0], shinR: [45, 0, 0], footL: [-20, 0, 0], footR: [-15, 0, 0],
           spine1: [16, 0, 0], spine2: [4, 0, 0], neck: [-6, 0, 0],
           upperArmL: [-15, 0, 22], upperArmR: [-15, 0, -22], forearmL: [-15, 0, 0], forearmR: [-15, 0, 0] },
    hitDrop: 0.09, spin: 360,
  },
  'Arms Wide': {       // wide stance, arms straight out to the sides, chest lifted
    prep: { upperArmL: [-60, 0, -45], upperArmR: [-60, 0, 45], forearmL: [-100, 0, 0], forearmR: [-100, 0, 0],
            thighL: [-8, 0, 0], thighR: [-8, 0, 0], shinL: [15, 0, 0], shinR: [15, 0, 0], spine1: [8, 0, 0] },
    prepDrop: 0.012,
    hit: { upperArmL: [0, 0, 48], upperArmR: [0, 0, -48], forearmL: [0, 0, 0], forearmR: [0, 0, 0],
           thighL: [0, 0, 14], thighR: [0, 0, -14], spine2: [-8, 0, 0], neck: [-10, 0, 0] },
  },
  'Final Bow': {       // bow from the hips, right hand settled in front of the abdomen, left arm out low
    prep: { upperArmL: [0, 0, 20], upperArmR: [0, 0, -20], forearmL: [0, 0, 0], forearmR: [0, 0, 0], spine2: [-5, 0, 0] },
    hit: { pelvis: [18, 0, 0], thighL: [-18, 0, 0], thighR: [-6, 0, 0], spine1: [20, 0, 0], spine2: [14, 0, 0], neck: [8, 0, 0],
           upperArmR: [-40, 0, 30], forearmR: [-90, 0, 0], upperArmL: [14, 0, -38], forearmL: [-15, 0, 0] },
    // Right palm placed by IK just in front of the abdomen, fingers across the body,
    // elbow forward and out so the forearm lies parallel to the front of the torso.
    ikHit: { side: 'R', gap: 0.012, across: -0.02, pole: [-0.35, -0.05, 0.35] },
  },
  'Kick L': {          // knee up on the prep, left leg kicks out forward, arms open for balance
    prep: { thighL: [-65, 0, 0], shinL: [95, 0, 0], thighR: [-5, 0, 0], shinR: [12, 0, 0],
            upperArmL: [-40, 0, -40], forearmL: [-90, 0, 0], upperArmR: [-40, 0, 40], forearmR: [-90, 0, 0] },
    hit: { thighL: [-80, 0, 0], shinL: [0, 0, 0], footL: [30, 0, 0], thighR: [4, 0, 0], shinR: [10, 0, 0], spine1: [-10, 0, 0],
           upperArmL: [0, 0, 40], upperArmR: [0, 0, -40], forearmL: [0, 0, 0], forearmR: [0, 0, 0] },
    hitDrop: 0.01,
  },
  'Floor Touch L': {   // right knee bends deep, left leg straight out to the side, left hand to the floor
    prep: { thighL: [0, 0, 12], thighR: [0, 0, -12], upperArmL: [0, 0, 60], upperArmR: [0, 0, -60], forearmL: [0, 0, 0], forearmR: [0, 0, 0] },
    hit: { thighR: [-70, 0, -12], shinR: [110, 0, 0], footR: [-30, 0, 0], thighL: [0, 0, 40], shinL: [0, 0, 0], footL: [0, 0, -15],
           pelvis: [0, 0, 10], spine1: [42, 0, 18], spine2: [18, 0, 10],
           upperArmL: [-70, 0, -48], forearmL: [0, 0, 0], upperArmR: [0, 0, -110], forearmR: [0, 0, 0], neck: [-10, 0, 0] },
    hitDrop: 0.2,
  },
  'Forward Reach L': { // left arm straight ahead, right arm drawn back, shoulders turned into the reach
    prep: { upperArmL: [30, 0, -40], forearmL: [-90, 0, 0], upperArmR: [-20, 0, 40], forearmR: [-20, 0, 0], spine2: [0, 10, 0] },
    hit: { upperArmL: [-90, 0, -45], forearmL: [0, 0, 0], upperArmR: [40, 0, 40], forearmR: [-75, 0, 0], spine2: [0, -18, 0],
           spine1: [6, 0, 0], thighL: [-12, 0, 0], shinL: [12, 0, 0], shinR: [12, 0, 0], neck: [0, 10, 0] },
    hitDrop: 0.015,
  },
  'Bend & Reach': {    // fold forward at the hips, both arms reaching forward
    prep: { spine2: [-10, 0, 0], upperArmL: [0, 0, 120], upperArmR: [0, 0, -120], forearmL: [0, 0, 0], forearmR: [0, 0, 0] },
    hit: { pelvis: [35, 0, 0], thighL: [-35, 0, 0], thighR: [-35, 0, 0], shinL: [15, 0, 0], shinR: [15, 0, 0], footL: [-5, 0, 0], footR: [-5, 0, 0],
           spine1: [25, 0, 0], spine2: [10, 0, 0], neck: [-25, 0, 0],
           upperArmL: [-155, 0, -45], upperArmR: [-155, 0, 45], forearmL: [0, 0, 0], forearmR: [0, 0, 0] },
    hitDrop: 0.02,
  },
};
const mirrorMove = m => ({ ...m, prep: mirrorPose(m.prep), hit: mirrorPose(m.hit),
  turn: -(m.turn || 0), prepTurn: -(m.prepTurn || 0), spin: -(m.spin || 0) });
// Every move with a left/right bias gets a mirrored R version.
const SIDED = ['Extend & Turn', 'Step & Reach', 'Sway & Sweep', 'Cross-Step', 'Kick', 'Floor Touch', 'Forward Reach'];
const DANCE_MOVES = {};
for (const [name, m] of Object.entries(DANCE_SRC)) {
  DANCE_MOVES[name] = m;
  const base = name.replace(/ L$/, '');
  if (SIDED.includes(base) && name.endsWith(' L')) DANCE_MOVES[base + ' R'] = mirrorMove(m);
}
DANCE_MOVES['Hold the Pose'] = null;          // repeats the previous move's hit
// Keep the bow last.
const bow = DANCE_MOVES['Final Bow']; delete DANCE_MOVES['Final Bow']; DANCE_MOVES['Final Bow'] = bow;
// A missed move: off-balance, shoulders dropped, arms loose. Not part of the library.
const STUMBLE = { hit: { spine1: [14, 0, 5], spine2: [6, 0, 3], neck: [16, 0, -6], pelvis: [0, 6, -3],
  upperArmL: [-10, 0, -28], upperArmR: [-20, 0, 50], forearmL: [-35, 0, 0], forearmR: [-25, 0, 0],
  thighL: [-14, 0, -2], shinL: [22, 0, 0], thighR: [4, 0, 4], shinR: [8, 0, 0] }, hitDrop: 0.02 };
// The other side of a sided move ('Kick L' ↔ 'Kick R'), or null.
const mirrorName = name => /^(.*) ([LR])$/.test(name) && SIDED.includes(name.slice(0, -2)) ? name.slice(0, -1) + (name.endsWith('L') ? 'R' : 'L') : null;

// Per-character playback of the library. prep()/hit() apply a move immediately;
// play(keys) runs a timed list of {t, move, kind: 'prep'|'hit', dur}.
// The group's yaw and height are offset from `baseRY` / `baseY`.
function createDancer(ch) {
  const D = { active: false, t: 0, keys: [], next: 0, yaw: 0, yawFrom: 0, yawTo: 0, yawT0: 0, yawDur: 0.3, spin: 0,
    drop: 0, dropTo: 0, last: null, ik: null, ikW: 0, baseRY: ch.group.rotation.y, baseY: ch.group.position.y, current: null };
  const apply = (move, kind, dur) => {
    const name = move === 'Hold the Pose' ? D.last : move;
    const m = name === 'Stumble' ? STUMBLE : DANCE_MOVES[name];
    D.active = true;
    D.current = { move, kind };
    if (kind === 'hit') fadeMarksMove(ch);   // every move danced counts, holds and stumbles included
    if (!m) return;
    if (move === 'Hold the Pose') {
      // Back to (or stay in) the last move's hit pose, without replaying its turn or spin.
      const target = poseQuats(DANCE_BASE, m.hit);
      for (const b of BONES) ch.target[b] = target[b].clone();
      D.dropTo = m.hitDrop || 0; D.ik = m.ikHit || null;
      return;
    }
    const target = poseQuats(DANCE_BASE, m[kind] || m.hit);
    for (const b of BONES) ch.target[b] = target[b].clone();
    D.yawFrom = D.yaw; D.yawTo = (kind === 'hit' ? m.turn : m.prepTurn) || 0;
    D.yawT0 = D.t; D.yawDur = dur; D.spin = kind === 'hit' ? (m.spin || 0) : 0;
    if (D.spin) D.yawFrom -= D.spin;   // the spin eases from −spin to 0: a full turn ending facing front
    D.dropTo = (kind === 'hit' ? m.hitDrop : m.prepDrop) || 0;
    D.ik = kind === 'hit' && m.ikHit ? m.ikHit : null; D.ikW = D.ik ? D.ikW : 0;
    if (kind === 'hit' && name !== 'Stumble') D.last = name;
  };
  D.prep = (move, dur = 0.25) => apply(move, 'prep', dur);
  D.hit = (move, dur = 0.3) => apply(move, 'hit', dur);
  D.stumble = (dur = 0.3) => apply('Stumble', 'hit', dur);
  D.rest = () => { D.active = false; D.ik = null; D.yawFrom = D.yaw; D.yawTo = 0; D.yawT0 = D.t; D.yawDur = 0.4; D.spin = 0; D.dropTo = 0;
    const t = poseQuats(DANCE_BASE); for (const b of BONES) ch.target[b] = t[b].clone(); };
  D.play = keys => { D.t = 0; D.keys = keys; D.next = 0; D.active = true; };
  D.update = dt => {
    D.t += dt;
    while (D.next < D.keys.length && D.t >= D.keys[D.next].t) { const k = D.keys[D.next++]; apply(k.move, k.kind, k.dur); }
    const p = clamp((D.t - D.yawT0) / D.yawDur, 0, 1), e = p * p * (3 - 2 * p);
    D.yaw = lerp(D.yawFrom, D.yawTo, e);
    D.drop += (D.dropTo - D.drop) * (1 - Math.exp(-dt * 12));
    D.ikW = D.ik ? Math.min(1, (D.ikW || 0) + dt * 5) : 0;
    ch.group.rotation.y = D.baseRY + D.yaw * Math.PI / 180;
    ch.group.position.y = D.baseY - D.drop * ch.spec.H;
  };
  D.stop = () => { D.rest(); D.yaw = D.yawTo = D.drop = D.dropTo = 0; D.keys = []; ch.group.rotation.y = D.baseRY; ch.group.position.y = D.baseY; };
  ch.dancer = D;
  const t = poseQuats(DANCE_BASE); for (const b of BONES) ch.target[b] = t[b].clone();
  return D;
}
// Belly front (rest space, z) at waist height for a character, cached.
function bellyFront(ch) {
  if (ch.bellyZ === undefined) {
    const p = [0, ch.spec.Y.waist, 0];
    while (field(ch.spec, p) < 0 && p[2] < 0.4) p[2] += 0.001;
    ch.bellyZ = p[2];
  }
  return ch.bellyZ;
}
// Blend a hand IK over the pose for the current move (see ikHit on moves).
function danceIK(ch, spec, w) {
  const side = spec.side, sp = ch.bones.spine1;
  const q = sp.getWorldQuaternion(new THREE.Quaternion());
  const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(q), left = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
  const J = ch.spec.J, rF = ch.spec.m.forearm / 100 / (2 * Math.PI);
  const local = new THREE.Vector3(spec.across * ch.spec.H / 1.7, 0.012 * ch.spec.H, bellyFront(ch) - J.spine1[2] + rF + spec.gap);
  const target = local.applyMatrix4(sp.matrixWorld);
  const sh = ch.bones['upperArm' + side].getWorldPosition(new THREE.Vector3());
  const pole = sh.clone().add(new THREE.Vector3(...spec.pole).applyQuaternion(q));
  const bones = ['upperArm', 'forearm', 'hand'].map(n => ch.bones[n + side]);
  const before = bones.map(b => b.quaternion.clone());
  armIK(ch, side, target, pole, fwd, side === 'R' ? left : left.clone().negate());
  bones.forEach((b, i) => b.quaternion.copy(before[i].slerp(b.quaternion.clone(), w)));
}

// ════════════════════════════════════════════════════════════════
// BUST SECONDARY MOTION — each bust bone is a damped spring that lags behind
// its anchor on the chest when the torso accelerates, then settles. Heavier
// (larger cup) = lower frequency, more travel; smallest cup barely moves.
// ════════════════════════════════════════════════════════════════
function bustSpring(ch, dt) {
  if (ch.spec.m.build !== 'female' || dt <= 0) return;
  const cup = ch.spec.m.cup || 3, w = (cup / 8) ** 1.5;             // 0.04 (A) … 1 (H)
  const f = 5.2 - 0.3 * cup, k = (2 * Math.PI * f) ** 2, c = 2 * 0.22 * Math.sqrt(k);
  const maxOff = 0.004 + 0.004 * cup;                                 // metres of travel at most
  ch.jig = ch.jig || {};
  const sp = ch.bones.spine2;
  for (const side of ['L', 'R']) {
    const b = ch.bones['bust' + side];
    const rest = ch.bustRest[side];
    const anchor = rest.clone().applyMatrix4(sp.matrixWorld);          // where the bone sits with no lag
    let S = ch.jig[side];
    if (!S) S = ch.jig[side] = { prev: anchor.clone(), vel: new THREE.Vector3(), off: new THREE.Vector3(), ov: new THREE.Vector3() };
    const v = anchor.clone().sub(S.prev).divideScalar(dt);
    const acc = v.clone().sub(S.vel).divideScalar(dt);
    S.prev.copy(anchor); S.vel.copy(v);
    // off'' = −k·off − c·off' − acc (the anchor's acceleration drags the mass behind it)
    const steps = Math.max(1, Math.ceil(dt / 0.004)), h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const a = S.off.clone().multiplyScalar(-k).addScaledVector(S.ov, -c).addScaledVector(acc, -1);
      S.ov.addScaledVector(a, h); S.off.addScaledVector(S.ov, h);
    }
    S.off.clampLength(0, maxOff / Math.max(w, 1e-3));
    // Displacement scales with weight; rotate the world offset into spine2's frame.
    const invQ = sp.getWorldQuaternion(new THREE.Quaternion()).invert();
    b.position.copy(rest).add(S.off.clone().multiplyScalar(w).applyQuaternion(invQ));
  }
}

// ════════════════════════════════════════════════════════════════
// CONTACT — skin never passes through another person's skin. Each character
// carries a set of proxy shapes fitted to its own body (built once, from the same
// primitives as the mesh): the torso as a stack of elliptical slices read off the
// loft, plus the limbs', bust's, glutes' and head's own shapes, each on its bone.
// Every frame, updateContacts poses each character's partner's proxies into world
// space and hands them to that character's vertex shader, which pushes any skin
// vertex found inside them back out along the proxy's normal. Both sides give way,
// in proportion to how soft each is at that point (see softness): a belly on a thigh
// compresses mostly the belly, a shin hardly at all. Hands are left out: their
// contacts are placed by IK and flattened by the press slots (setPress).
// ════════════════════════════════════════════════════════════════
const CONTACT_ELL = 36, CONTACT_CONE = 10, CONTACT_PAD = 0.002, CONTACT_MAX = 0.1;
function buildProxies(spec) {
  const H = spec.H, loft = spec.prims[0], ells = [], cones = [];
  // Torso slices every 3 cm, each a y-radius of two spacings so they overlap smoothly.
  const y0 = spec.Y.crotch - 0.02 * H, y1 = spec.Y.neckBase, n = Math.ceil((y1 - y0) / 0.03), dy = (y1 - y0) / n;
  for (let i = 0; i <= n; i++) {
    const y = y0 + i * dy, [a, bf, bb, zc] = loftRing(loft, y);
    const bone = loftWeights(spec, y).sort((p, q) => q[1] - p[1])[0][0];
    ells.push({ bone, c: [0, y, zc + (bf - bb) / 2], u: [1, 0, 0], v: [0, 1, 0], w: [0, 0, 1], r: [a, dy * 2, (bf + bb) / 2], soft: softness(spec, null, true, y) });
  }
  for (const P of spec.prims) {
    const tag = P.tag || P.group;
    if (tag === 'hand' || tag === 'hair' || tag === 'hairBun') continue;
    if (P.type === 'ell' && (tag !== 'head' || P === spec.prims.find(q => q.tag === 'head')))
      ells.push({ bone: P.bone, c: P.c, u: P.u, v: P.v, w: P.w, r: P.r, soft: softness(spec, tag, false, P.c[1]) });
    else if (P.type === 'cone' && tag !== 'hand')
      cones.push({ bone: P.bone, a: P.a, b: P.b, r1: P.r1, r2: P.r2, soft: softness(spec, tag, false, P.a[1]) });
  }
  return { ells: ells.slice(0, CONTACT_ELL), cones: cones.slice(0, CONTACT_CONE) };
}
// Each character's contact partner: the nearest other body close enough to touch.
function updateContacts(everyone) {
  const on = everyone.filter(c => c.group.parent && c.proxies);
  const hip = c => c.bones.pelvis.getWorldPosition(new THREE.Vector3());
  for (const ch of on) {
    const u = ch.mesh.material.userData.uniforms;
    let partner = null, best = 1.6;
    for (const o of on) if (o !== ch) { const d = hip(o).distanceTo(hip(ch)); if (d < best) { best = d; partner = o; } }
    u.uContactN.value.set(0, 0);
    if (!partner) continue;
    const sk = partner.mesh.skeleton, M = {}, m3 = new THREE.Matrix3();
    const mat = b => M[b] || (M[b] = partner.bones[b].matrixWorld.clone().multiply(sk.boneInverses[BONES.indexOf(b)]));
    const V3 = a => new THREE.Vector3(...a);
    partner.proxies.ells.forEach((e, i) => {
      const m = mat(e.bone); m3.setFromMatrix4(m);
      const c = V3(e.c).applyMatrix4(m), ax = [e.u, e.v, e.w].map(a => V3(a).applyMatrix3(m3).normalize());
      for (let k = 0; k < 3; k++) u.uCE.value[i * 4 + k].set(ax[k].x, ax[k].y, ax[k].z, -ax[k].dot(c));
      u.uCE.value[i * 4 + 3].set(e.r[0], e.r[1], e.r[2], e.soft);
    });
    partner.proxies.cones.forEach((q, i) => {
      const m = mat(q.bone), a = V3(q.a).applyMatrix4(m), b = V3(q.b).applyMatrix4(m);
      u.uCC.value[i * 2].set(a.x, a.y, a.z, q.r1); u.uCC.value[i * 2 + 1].set(b.x, b.y, b.z, q.r2);
      u.uCSoft.value[i] = q.soft;
    });
    u.uContactN.value.set(partner.proxies.ells.length, partner.proxies.cones.length);
  }
}
const CONTACT_GLSL = `
  uniform vec4 uCE[${CONTACT_ELL * 4}];
  uniform vec4 uCC[${CONTACT_CONE * 2}];
  uniform float uCSoft[${CONTACT_CONE}];
  uniform vec2 uContactN;
  attribute float soft;
  float cEll(int i, vec3 p) {
    vec3 q = vec3(dot(uCE[i*4].xyz, p) + uCE[i*4].w, dot(uCE[i*4+1].xyz, p) + uCE[i*4+1].w, dot(uCE[i*4+2].xyz, p) + uCE[i*4+2].w);
    vec3 r = uCE[i*4+3].xyz;
    float k0 = length(q / r), k1 = length(q / (r * r));
    return k1 < 1e-7 ? -min(r.x, min(r.y, r.z)) : k0 * (k0 - 1.0) / k1;
  }
  float cCone(int i, vec3 p) {                        // iq's round cone
    vec3 a = uCC[i*2].xyz, b = uCC[i*2+1].xyz; float r1 = uCC[i*2].w, r2 = uCC[i*2+1].w;
    vec3 ba = b - a; float l2 = dot(ba, ba), rr = r1 - r2, a2 = l2 - rr * rr, il2 = 1.0 / l2;
    vec3 pa = p - a; float y = dot(pa, ba), z = y - l2;
    vec3 xv = pa * l2 - ba * y; float x2 = dot(xv, xv), y2 = y * y * l2, z2 = z * z * l2;
    float k = sign(rr) * rr * rr * x2;
    if (sign(z) * a2 * z2 > k) return sqrt(x2 + z2) * il2 - r2;
    if (sign(y) * a2 * y2 < k) return sqrt(x2 + y2) * il2 - r1;
    return (sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
  }
  float cProxy(int kind, int i, vec3 p) { return kind == 0 ? cEll(i, p) : cCone(i, p); }
`;
const CONTACT_VERTEX = `
  if (uContactN.x + uContactN.y > 0.0) {
    vec3 wp = (modelMatrix * vec4(transformed, 1.0)).xyz;
    float dBest = 1e9, sBest = 1.0; int kBest = 0, iBest = 0;
    for (int i = 0; i < ${CONTACT_ELL}; i++) { if (float(i) >= uContactN.x) break; float d = cEll(i, wp); if (d < dBest) { dBest = d; kBest = 0; iBest = i; sBest = uCE[i*4+3].w; } }
    for (int i = 0; i < ${CONTACT_CONE}; i++) { if (float(i) >= uContactN.y) break; float d = cCone(i, wp); if (d < dBest) { dBest = d; kBest = 1; iBest = i; sBest = uCSoft[i]; } }
    if (dBest < ${CONTACT_PAD}) {
      const float e = 0.002;
      vec3 g = vec3(cProxy(kBest, iBest, wp + vec3(e, 0, 0)) - cProxy(kBest, iBest, wp - vec3(e, 0, 0)),
                    cProxy(kBest, iBest, wp + vec3(0, e, 0)) - cProxy(kBest, iBest, wp - vec3(0, e, 0)),
                    cProxy(kBest, iBest, wp + vec3(0, 0, e)) - cProxy(kBest, iBest, wp - vec3(0, 0, e)));
      vec3 n = normalize(g + 1e-9);
      // This body's share of the overlap, by softness; the other body takes the rest.
      float share = (soft + 0.05) / (soft + sBest + 0.1);
      float push = min((${CONTACT_PAD} - dBest) * share, ${CONTACT_MAX});
      transformed += mat3(bindMatrixInverse) * (n * push);
      #ifndef FLAT_SHADED
        vNormal = normalize(mix(vNormal, normalize(mat3(viewMatrix) * n), smoothstep(0.0, 0.006, push)));
      #endif
    }
  }`;

// ════════════════════════════════════════════════════════════════
// SKIRT — a separate cloth mesh (wardrobe kind 'skirt'). A grid of SKIRT_RINGS rings
// × SKIRT_SEGS columns of particles, from a waistband `above` × height over the
// shorts' top (the belly line) down `length` × height. The rest shape falls from the
// widest part of the hips with a small gap and flares by `flare` × height at the hem.
// The waistband ring is pinned to the body (blended pelvis/spine skinning); the rest
// is Verlet cloth: gravity, damping, ring/column/shear springs to its rest lengths
// (so the hem keeps its wider circumference and flares), and weak bending, so it
// hangs loose. It collides with every body on set (their posed contact proxies, see
// CONTACT, own body included), the floor, and any solid objects passed in (boxes).
// Call skirtStep every frame after the pose is set.
// ════════════════════════════════════════════════════════════════
const SKIRT_EASE = 1.1, SKIRT_RINGS = 12, SKIRT_SEGS = 40, SKIRT_GAP = 0.004, SKIRT_THICK = 0.006, SKIRT_PAD = 0.008, SKIN_CELL = 0.03;
const cellKey = (x, y, z) => ((x + 512) * 1024 + (y + 512)) * 1024 + (z + 512);
// Re-skins the skirt's own-body skin points into world space (linear blend skinning,
// as the GPU does) and buckets them in a grid of SKIN_CELL cells.
function skinPoints(ch, S) {
  const K = S.skin, bones = ch.mesh.skeleton.bones, inv = ch.mesh.skeleton.boneInverses;
  const M = bones.map((b, i) => new THREE.Matrix4().multiplyMatrices(b.matrixWorld, inv[i]).elements);
  S.grid.clear();
  for (let k = 0; k < K.n; k++) {
    let x = 0, y = 0, z = 0, nx = 0, ny = 0, nz = 0;
    const px = K.p[3 * k], py = K.p[3 * k + 1], pz = K.p[3 * k + 2], qx = K.nr[3 * k], qy = K.nr[3 * k + 1], qz = K.nr[3 * k + 2];
    for (let a = 0; a < 4; a++) {
      const w = K.w[4 * k + a]; if (!w) continue;
      const e = M[K.i[4 * k + a]];
      x += w * (e[0] * px + e[4] * py + e[8] * pz + e[12]); y += w * (e[1] * px + e[5] * py + e[9] * pz + e[13]); z += w * (e[2] * px + e[6] * py + e[10] * pz + e[14]);
      nx += w * (e[0] * qx + e[4] * qy + e[8] * qz); ny += w * (e[1] * qx + e[5] * qy + e[9] * qz); nz += w * (e[2] * qx + e[6] * qy + e[10] * qz);
    }
    const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    K.wp[3 * k] = x; K.wp[3 * k + 1] = y; K.wp[3 * k + 2] = z; K.wn[3 * k] = nx / nl; K.wn[3 * k + 1] = ny / nl; K.wn[3 * k + 2] = nz / nl;
    const key = cellKey(Math.floor(x / SKIN_CELL), Math.floor(y / SKIN_CELL), Math.floor(z / SKIN_CELL));
    let cell = S.grid.get(key); if (!cell) S.grid.set(key, cell = []); cell.push(k);
  }
}
function buildSkirt(ch, L) {
  const spec = ch.spec, H = spec.H, Y = spec.Y, R = SKIRT_RINGS, N = SKIRT_SEGS;
  const top = Y.belly + (L.above == null ? 0.01 : L.above);
  const len = (L.length || 0.18) * H, flare = (L.flare == null ? 0.025 : L.flare) * H;
  // The body's outer surface along a horizontal ray at angle th (0 = front) and height y:
  // march in from outside, then refine.
  const bodyR = (th, y) => {
    const dx = Math.sin(th), dz = Math.cos(th), p = [0, y, 0];
    let r = 0.32;
    for (; r > 0.005; r -= 0.008) { p[0] = dx * r; p[2] = dz * r; if (field(spec, p) < 0) break; }
    let lo = r, hi = r + 0.008;
    for (let k = 0; k < 6; k++) { const m = (lo + hi) / 2; p[0] = dx * m; p[2] = dz * m; if (field(spec, p) < 0) lo = m; else hi = m; }
    return hi;
  };
  const rest = new Float32Array(R * N * 3), ys = [];
  for (let i = 0; i < R; i++) ys.push(top - len * i / (R - 1));
  for (let j = 0; j < N; j++) {
    const th = 2 * Math.PI * j / N;
    let widest = 0;
    for (let i = 0; i < R; i++) {
      widest = Math.max(widest, bodyR(th, ys[i]));          // hangs straight down from the widest point above
      const t = i / (R - 1), r = widest * (i === 0 ? 1 : SKIRT_EASE) + SKIRT_GAP + flare * t * t;   // ease below the band: room for the hips to flex
      rest.set([Math.sin(th) * r, ys[i], Math.cos(th) * r], 3 * (i * N + j));
    }
  }
  // Springs: [a, b, rest length, stiffness].
  const springs = [], P = k => [rest[3 * k], rest[3 * k + 1], rest[3 * k + 2]];
  const add = (a, b, k) => springs.push([a, b, len3(sub(P(a), P(b))), k]);
  const id = (i, j) => i * N + ((j + N) % N);
  for (let i = 0; i < R; i++) for (let j = 0; j < N; j++) {
    add(id(i, j), id(i, j + 1), 1);                                          // around the ring
    if (i + 1 < R) { add(id(i, j), id(i + 1, j), 1); add(id(i, j), id(i + 1, j + 1), 0.6); add(id(i, j + 1), id(i + 1, j), 0.6); }
    if (i + 2 < R) add(id(i, j), id(i + 2, j), 0.15);                         // weak bending: hangs loose
    add(id(i, j), id(i, j + 2), 0.12);
  }
  // Mesh: a tube of quads, drawn from both sides.
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(R * N * 3), 3));
  const index = [];
  for (let i = 0; i + 1 < R; i++) for (let j = 0; j < N; j++) index.push(id(i, j), id(i + 1, j), id(i + 1, j + 1), id(i, j), id(i + 1, j + 1), id(i, j + 1));
  geo.setIndex(index);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: lin(L.color), roughness: 0.82, metalness: 0, side: THREE.DoubleSide }));
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  ch.group.add(mesh);
  // Own-body collisions use the actual skin: every other mesh vertex in the skirt's
  // height band (with a margin), re-skinned each frame (see skinPoints).
  const g2 = ch.mesh.geometry, pa = g2.attributes.position.array, na = g2.attributes.normal.array;
  const si = g2.attributes.skinIndex.array, sw = g2.attributes.skinWeight.array, pick = [];
  const yLo = ys[R - 1] - 0.08, yHi = top + 0.03;
  for (let v = 0; v < pa.length / 3; v += 2) if (pa[3 * v + 1] > yLo && pa[3 * v + 1] < yHi) pick.push(v);
  const skin = { n: pick.length, p: new Float32Array(pick.length * 3), nr: new Float32Array(pick.length * 3), i: new Uint16Array(pick.length * 4), w: new Float32Array(pick.length * 4),
    wp: new Float32Array(pick.length * 3), wn: new Float32Array(pick.length * 3) };
  pick.forEach((v, k) => { for (let a = 0; a < 3; a++) { skin.p[3 * k + a] = pa[3 * v + a]; skin.nr[3 * k + a] = na[3 * v + a]; } for (let a = 0; a < 4; a++) { skin.i[4 * k + a] = si[4 * v + a]; skin.w[4 * k + a] = sw[4 * v + a]; } });
  ch.skirt = { L, rest, springs, mesh, p: null, prev: null, top, skin, grid: new Map() };
}
const len3 = v => Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
// Takes a skirt off (hidden, not simulated) or puts it back on, restarting its cloth
// from the rest shape wherever the body now is.
// Lowers a worn garment (wardrobe id: 'bottom' to the knees or further, see bottomCoverage;
// 'briefs' to the thighs, see briefsDown), bunched there, or pulls it back up. Each lowered
// garment has its own gathered waistband (ch.bunches).
function setLowered(ch, id, on) {
  const L = ch.spec.m.wardrobe && ch.spec.m.wardrobe[id];
  if (!L || (on && !(ch.layers || []).includes(L))) return;
  ch.lowered = ch.lowered || new Set();
  if (on === ch.lowered.has(L)) return;
  if (on) { ch.lowered.add(L); buildBunches(ch, L); } else { ch.lowered.delete(L); removeBunches(ch, L); }
  dress(ch);
}
// A lowered garment's gathered waistband: one stretchy loop round both legs at the top
// of the lowered band. It hugs the outside of each leg and spans the gap between them
// in front and behind (the convex hull of the two legs' cross-sections), rebuilt each
// frame from wherever the legs are (bunchStep), so it stretches as they part and
// gathers as they close. The legs' cross-sections are probed in the rest pose.
const BUNCH_M = 72, BUNCH_K = 10, BUNCH_IN = 28;
// Lowered briefs (not trunks, which go down as shorts do) roll into a thinner band, a thong
// thinner still. Their gusset never met the thighs, so the band only runs round the outside
// of each leg and straight across the gap (no inner rolls), and the crotch hangs from its
// front and back strands as a strip, free at its sides (see bunchOne): a thong's narrow,
// briefs' about as wide as the gap.
function buildBunches(ch, L) {
  removeBunches(ch, L);
  const spec = ch.spec, H = spec.H, J = spec.J;
  const briefs = L.kind === 'briefs' && !L.leg ? briefsDown(spec, L) : null;
  const tube = (briefs ? (briefs.thong ? 0.006 : 0.008) : 0.017) * H;
  const sides = ['L', 'R'].map(side => {
    const ankle = L.lowerTo === 'ankle', calf = L.lowerTo === 'calf' || ankle, bone = (calf ? 'shin' : 'thigh') + side;
    const top = J[bone], end = J[(calf ? 'foot' : 'shin') + side], dir = norm(sub(end, top));
    const c = briefs ? add(top, mul(dir, briefs.roll))
      : calf ? add(top, mul(sub(end, top), ankle ? 0.84 : LOWER_CALF + 0.03)) : add(end, mul(dir, -(LOWER_BAND[0] - 0.012) * H));
    const e1 = norm(cross([0, 0, 1], dir)), e2 = cross(dir, e1);
    // The leg's mean radius at a point on its axis, probed round it.
    const legR = at => {
      let rs = 0;
      for (let k = 0; k < 12; k++) {
        const a = k / 12 * 2 * Math.PI, u = add(mul(e1, Math.cos(a)), mul(e2, Math.sin(a)));
        let d = 0.01; while (d < 0.2 && field(spec, add(at, mul(u, d))) < 0) d += 0.0005;
        rs += d / 12;
      }
      return rs;
    };
    const rs = legR(c);
    // Loose (trousers round the ankles): the pile stands well off the leg.
    return { bone, bi: BONES.indexOf(bone), c: new THREE.Vector3(...c), dir: new THREE.Vector3(...dir), r: rs + tube * 0.45 + (ankle ? 0.014 * H : 0) };
  });
  const M = BUNCH_M, K = BUNCH_K, geo = new THREE.BufferGeometry(), index = [];
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(M * K * 3), 3));
  for (let i = 0; i < M; i++) for (let j = 0; j < K; j++) {
    const a = i * K + j, b = ((i + 1) % M) * K + j, c = ((i + 1) % M) * K + (j + 1) % K, d = i * K + (j + 1) % K;
    index.push(a, b, c, a, c, d);
  }
  geo.setIndex(index);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: lin(L.color), roughness: 0.8, side: THREE.DoubleSide }));
  mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = false;
  ch.group.add(mesh);
  // Loose garments (trousers at the ankles): thicker, deeper folds, and the part between
  // the legs hangs slack instead of stretching (see bunchStep).
  const loose = L.lowerTo === 'ankle';
  // The roll round the inner side of each leg (the hull loop only covers the outside), so
  // each leg is fully wrapped; the seat hangs between these (see bunchStep).
  const IM = BUNCH_IN, ig = new THREE.BufferGeometry(), ii = [];
  ig.setAttribute('position', new THREE.BufferAttribute(new Float32Array(2 * IM * K * 3), 3));
  for (let arc = 0; arc < 2; arc++) for (let i = 0; i + 1 < IM; i++) for (let j = 0; j < K; j++) {
    const o = arc * IM * K, a = o + i * K + j, b = o + (i + 1) * K + j, c = o + (i + 1) * K + (j + 1) % K, d2 = o + i * K + (j + 1) % K;
    ii.push(a, b, c, a, c, d2);
  }
  ig.setIndex(ii);
  const inner = new THREE.Mesh(ig, mesh.material);
  inner.castShadow = inner.receiveShadow = true; inner.frustumCulled = false;
  ch.group.add(inner);
  // The seat/crotch of the garment: a sheet between the legs (see bunchStep).
  const GT = 16, GW = 12, gg = new THREE.BufferGeometry(), gi = [];
  gg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(GT * GW * 3), 3));
  for (let i = 0; i + 1 < GT; i++) for (let j = 0; j + 1 < GW; j++) { const a = i * GW + j, b = a + GW; gi.push(a, b, b + 1, a, b + 1, a + 1); }
  gg.setIndex(gi);
  const gusset = new THREE.Mesh(gg, mesh.material);
  gusset.castShadow = gusset.receiveShadow = true; gusset.frustumCulled = false;
  ch.group.add(gusset);
  ch.bunches = ch.bunches || new Map();
  const B = { L, sides, tube: loose ? 0.024 * H : tube, mesh, gusset, inner, GT, GW, loose, slack: 0.34 * H,
    // Slack fabric across the seat, between the rolls round each leg.
    seat: (loose ? 0.16 : briefs ? (briefs.thong ? 0.12 : 0.1) : 0.1) * H,
    // Briefs' crotch strip: its width (× height) at the front band, at the back band, and
    // at its narrowest, between the legs (a thong's, and briefs' gusset, 2 × `gusset`).
    strip: !briefs ? null : briefs.thong ? [0.03 * H, 0.012 * H, 0.01 * H] : [0.075 * H, 0.09 * H, 2 * (L.gusset || 0.02) * H] };
  ch.bunches.set(L, B);
  bunchOne(ch, B);
}
// Removes the waistband of garment L (or every one, without L).
function removeBunches(ch, L) {
  if (!ch.bunches) return;
  for (const [K, B] of [...ch.bunches]) {
    if (L && K !== L) continue;
    ch.group.remove(B.mesh); B.mesh.geometry.dispose(); B.mesh.material.dispose();
    ch.group.remove(B.gusset); B.gusset.geometry.dispose();
    ch.group.remove(B.inner); B.inner.geometry.dispose();
    ch.bunches.delete(K);
  }
}
const _bm4 = new THREE.Matrix4();
function bunchStep(ch) {
  if (ch.bunches) for (const B of ch.bunches.values()) bunchOne(ch, B);
}
function bunchOne(ch, B) {
  if (!B.mesh.visible || !ch.group.parent) return;
  ch.group.updateMatrixWorld(true);
  const sk = ch.mesh.skeleton;
  const [A, C] = B.sides.map(s => {
    _bm4.copy(ch.bones[s.bone].matrixWorld).multiply(sk.boneInverses[s.bi]);
    return { c: s.c.clone().applyMatrix4(_bm4), a: s.dir.clone().transformDirection(_bm4), r: s.r };
  });
  // The loop's plane: across both legs, square to their average direction.
  const n = A.a.clone().add(C.a).normalize();
  const u = C.c.clone().sub(A.c); u.addScaledVector(n, -u.dot(n));
  let d = u.length();
  if (d < 1e-4) { u.set(1, 0, 0).addScaledVector(n, -n.x); d = 0; }
  u.normalize();
  const v = n.clone().cross(u);
  // Path: far half of the first leg's circle, straight across (behind or in front),
  // far half of the other's, straight back. Each point keeps its own leg's height
  // along n, blended across the straight parts.
  const hA = A.c.dot(n), hC = C.c.dot(n);
  const arcA = Math.PI * A.r, arcC = Math.PI * C.r, total = arcA + arcC + 2 * d;
  // Loose: the fabric across the gap has more length than the gap, so it hangs down
  // (a parabola of that length), resting on the floor at worst; taut once the legs
  // are further apart than the slack allows.
  const sagDepth = B.loose ? 0.5 * Math.sqrt(Math.max(0, B.slack * B.slack - d * d)) * 0.6 : 0;
  const sag = (P, t) => { if (sagDepth) { P.y -= sagDepth * Math.sin(Math.PI * t); P.y = Math.max(P.y, B.tube * 0.8); } return P; };
  const at = s => {
    let x = s * total;
    const P = new THREE.Vector3();
    if (x < arcA) { const a = Math.PI / 2 + x / A.r; return { p: P.copy(A.c).addScaledVector(u, Math.cos(a) * A.r).addScaledVector(v, Math.sin(a) * A.r), straight: 0 }; }
    x -= arcA;
    if (x < d) { const t = x / Math.max(d, 1e-6); return { p: sag(P.copy(A.c).addScaledVector(v, -A.r).lerp(C.c.clone().addScaledVector(v, -C.r), t), t), straight: 1 }; }
    x -= d;
    if (x < arcC) { const a = -Math.PI / 2 + x / C.r; return { p: P.copy(C.c).addScaledVector(u, Math.cos(a) * C.r).addScaledVector(v, Math.sin(a) * C.r), straight: 0 }; }
    x -= arcC;
    const t = x / Math.max(d, 1e-6);
    return { p: sag(P.copy(C.c).addScaledVector(v, C.r).lerp(A.c.clone().addScaledVector(v, A.r), t), t), straight: 1 };
  };
  const M = BUNCH_M, K = BUNCH_K, pts = [];
  for (let i = 0; i < M; i++) pts.push(at(i / M));
  // Stretched across the gap, the gathered fabric thins out.
  const stretch = B.loose ? 0 : Math.min(1, d / (A.r + C.r + 1e-6));
  const pos = B.mesh.geometry.attributes.position.array, inv = _bm4.copy(ch.group.matrixWorld).invert(), q = new THREE.Vector3();
  for (let i = 0; i < M; i++) {
    const P = pts[i].p, T = pts[(i + 1) % M].p.clone().sub(pts[(i + M - 1) % M].p).normalize();
    const side = T.clone().cross(n).normalize();        // outward from the loop, in its plane
    const s = i / M, thin = 1 - 0.35 * pts[i].straight * stretch;
    // Folds fixed to the fabric (indexed round the loop), so they stretch with it.
    // Loose fabric: broader, rounder folds (no fine ripple, which peaks into spikes).
    const fold = B.loose ? 1 + 0.3 * Math.sin(s * 2 * Math.PI * 7 + 1.3) * Math.sin(s * 2 * Math.PI * 3 + 0.4) + 0.12 * Math.sin(s * 2 * Math.PI * 11)
      : 1 + 0.28 * Math.sin(s * 2 * Math.PI * 9 + 1.3) * Math.sin(s * 2 * Math.PI * 4 + 0.4) + 0.12 * Math.sin(s * 2 * Math.PI * 17);
    for (let j = 0; j < K; j++) {
      const b = j / K * 2 * Math.PI, r = B.tube * thin * fold;
      q.copy(P).addScaledVector(side, Math.cos(b) * r).addScaledVector(n, Math.sin(b) * r * (1.35 + 0.35 * Math.sin(s * 2 * Math.PI * 5))).applyMatrix4(inv);
      pos.set([q.x, q.y, q.z], 3 * (i * K + j));
    }
  }
  B.mesh.geometry.attributes.position.needsUpdate = true;
  B.mesh.geometry.computeVertexNormals();
  // Inner rolls: the near half of each leg's circle (A round +u, C round -u), from the
  // back strand to the front one, with their own folds.
  const IM = BUNCH_IN, ipos = B.inner.geometry.attributes.position.array;
  [[A, 1], [C, -1]].forEach(([S, sgn], arc) => {
    const ip = [];
    for (let i = 0; i < IM; i++) { const a = -Math.PI / 2 + Math.PI * i / (IM - 1); ip.push(S.c.clone().addScaledVector(u, sgn * Math.cos(a) * S.r).addScaledVector(v, Math.sin(a) * S.r)); }
    for (let i = 0; i < IM; i++) {
      const T = ip[Math.min(IM - 1, i + 1)].clone().sub(ip[Math.max(0, i - 1)]).normalize(), side = T.clone().cross(n).normalize(), s2 = i / IM + arc * 0.37;
      const fold = B.loose ? 1 + 0.3 * Math.sin(s2 * 2 * Math.PI * 3 + 1.3) : 1 + 0.25 * Math.sin(s2 * 2 * Math.PI * 4 + 0.7) + 0.1 * Math.sin(s2 * 2 * Math.PI * 9);
      for (let j = 0; j < K; j++) {
        const b = j / K * 2 * Math.PI, rt = B.tube * 0.85 * fold;
        q.copy(ip[i]).addScaledVector(side, Math.cos(b) * rt).addScaledVector(n, Math.sin(b) * rt * 1.3).applyMatrix4(inv);
        ipos.set([q.x, q.y, q.z], 3 * (arc * IM * K + i * K + j));
      }
    }
  });
  B.inner.geometry.attributes.position.needsUpdate = true;
  B.inner.geometry.computeVertexNormals();
  // The seat: a sheet across the gap between the legs, from the bunched fabric round
  // one leg to the other. Its front and back edges are the waistband's two strands; its
  // sides follow the inner rolls (the centre of their tube, so the seam is inside the
  // roll). Slack fabric hangs down in the middle, less as the legs part; not below the floor.
  const GT = B.GT, GW = B.GW, gpos = B.gusset.geometry.attributes.position.array;
  const gap = Math.max(0, d - A.r - C.r), drop = 0.5 * Math.sqrt(Math.max(0, B.seat * B.seat - gap * gap));
  const hole = (S, w, sgn) => {                     // sgn +1: leg A's inner roll (+u); -1: leg C's (-u)
    const a = -Math.PI / 2 + Math.PI * w;
    return S.c.clone().addScaledVector(u, sgn * Math.cos(a) * S.r).addScaledVector(v, Math.sin(a) * S.r);
  };
  // Briefs' strip: hung from the middle of the front and back strands (`strip` wide
  // there), sagging between them by however much longer it is than the gap (`seat`).
  if (B.strip) {
    const strand = (sv, t) => sag(A.c.clone().addScaledVector(v, sv * A.r).lerp(C.c.clone().addScaledVector(v, sv * C.r), t), t);
    const span = A.r + C.r, hang = 0.5 * Math.sqrt(Math.max(0, B.seat * B.seat - span * span));
    // Which strand is in front: the one further along the body's forward direction.
    const fwd = new THREE.Vector3(0, 0, 1).transformDirection(ch.group.matrixWorld);
    const fs = strand(1, 0.5).dot(fwd) > strand(-1, 0.5).dot(fwd) ? 1 : -1;
    // It tapers from its full width where it meets the band in front and behind to its
    // narrowest between the legs, and is never wider there than the gap between them (less a
    // margin), gathering as they close.
    const span2 = Math.max(d, 1e-4), gapW = Math.max(0.004 * ch.spec.H, d - A.r - C.r - 0.01 * ch.spec.H);
    const mid = Math.min(B.strip[2], gapW);
    for (let i = 0; i < GT; i++) {
      const x = i / (GT - 1) - 0.5;
      for (let j = 0; j < GW; j++) {
        const w = j / (GW - 1), full = lerp(B.strip[0], B.strip[1], w);
        const half = lerp(full, Math.min(full, mid), Math.sin(Math.PI * w)) / 2;
        const t = clamp(0.5 + x * 2 * half / span2, 0, 1);
        const P = strand(fs, t).lerp(strand(-fs, t), w);
        P.y -= hang * Math.sin(Math.PI * w);
        P.y = Math.max(P.y, 0.004);
        P.applyMatrix4(inv);
        gpos.set([P.x, P.y, P.z], 3 * (i * GW + j));
      }
    }
    B.gusset.geometry.attributes.position.needsUpdate = true;
    B.gusset.geometry.computeVertexNormals();
    return;
  }
  for (let i = 0; i < GT; i++) {
    const t = i / (GT - 1);
    for (let j = 0; j < GW; j++) {
      const w = j / (GW - 1), edge = j === 0 || j === GW - 1;
      // The front and back edges run along the strands (at the band); the rest drop to the holes.
      let P;
      if (edge) {
        // Exactly along the waistband strand (the loop's straight part, with its sag).
        const sv = j === 0 ? -1 : 1;
        P = sag(A.c.clone().addScaledVector(v, sv * A.r).lerp(C.c.clone().addScaledVector(v, sv * C.r), t), t);
      } else {
        P = hole(A, w, 1).lerp(hole(C, w, -1), t);
        P.y -= drop * Math.sin(Math.PI * t) * Math.sin(Math.PI * w);
      }
      P.y = Math.max(P.y, 0.004);
      P.applyMatrix4(inv);
      gpos.set([P.x, P.y, P.z], 3 * (i * GW + j));
    }
  }
  B.gusset.geometry.attributes.position.needsUpdate = true;
  B.gusset.geometry.computeVertexNormals();
}
// Gathers the back of the skirt's hem up at the waistband, or lets it fall.
function setSkirtGathered(ch, on) {
  const S = ch.skirt;
  if (!S || !!S.gathered === on) return;
  S.gathered = on; S.stillT = 0;
  // Back columns: within 60° of straight behind.
  S.backCols = []; for (let j = 0; j < SKIRT_SEGS; j++) if (Math.cos(2 * Math.PI * j / SKIRT_SEGS) < -0.5) S.backCols.push(j);
  S.pinned = new Set(S.backCols.map(j => (SKIRT_RINGS - 1) * SKIRT_SEGS + j));
}
function setSkirtOff(ch, off) {
  if (!ch.skirt) return;
  ch.skirt.off = off; ch.skirt.mesh.visible = !off;
  if (!off) ch.skirt.p = null;
}
function removeSkirt(ch) {
  if (!ch.skirt) return;
  ch.group.remove(ch.skirt.mesh); ch.skirt.mesh.geometry.dispose(); ch.skirt.mesh.material.dispose();
  ch.skirt = null;
}
// A character's contact proxies posed into world space, as SDF primitives with
// bounding spheres (for cloth collisions).
function posedProxies(o) {
  const sk = o.mesh.skeleton, M = {}, m3 = new THREE.Matrix3(), out = [];
  const mat = b => M[b] || (M[b] = o.bones[b].matrixWorld.clone().multiply(sk.boneInverses[BONES.indexOf(b)]));
  for (const e of o.proxies.ells) {
    const m = mat(e.bone); m3.setFromMatrix4(m);
    const c = new THREE.Vector3(...e.c).applyMatrix4(m).toArray();
    const [u, v, w] = [e.u, e.v, e.w].map(a => new THREE.Vector3(...a).applyMatrix3(m3).normalize().toArray());
    out.push({ type: 'ell', c, u, v, w, r: e.r, sc: c, sr: Math.max(...e.r) });
  }
  for (const q of o.proxies.cones) {
    const m = mat(q.bone), a = new THREE.Vector3(...q.a).applyMatrix4(m).toArray(), b = new THREE.Vector3(...q.b).applyMatrix4(m).toArray();
    const P = cone(a, b, q.r1, q.r2);
    P.sc = mul(add3(a, b), 0.5); P.sr = len3(sub(b, a)) / 2 + Math.max(q.r1, q.r2);
    out.push(P);
  }
  return out;
}
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const _sM = new THREE.Matrix4(), _sT = new THREE.Matrix4(), _sV = new THREE.Vector3();
const _sD = new THREE.Matrix4(), _sI = new THREE.Matrix4(), _sV2 = new THREE.Vector3(), SKIRT_FOLLOW = 0.9, SKIRT_FOLLOW_ROT = 0.3, SKIRT_SLEEP = 1.5;
function skirtStep(ch, dt, everyone = [], solids = []) {
  const S = ch.skirt;
  if (!S || S.off || !ch.group.parent || !ch.group.visible || dt <= 0) return;
  const R = SKIRT_RINGS, N = SKIRT_SEGS, n = R * N, sk = ch.mesh.skeleton;
  ch.group.updateMatrixWorld(true);
  // The waistband follows the body: skinning matrices blended as the torso is at that height.
  _sM.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
  for (const [bone, w] of loftWeights(ch.spec, S.top)) {
    _sT.copy(ch.bones[bone].matrixWorld).multiply(sk.boneInverses[BONES.indexOf(bone)]);
    for (let k = 0; k < 16; k++) _sM.elements[k] += _sT.elements[k] * w;
  }
  const restW = k => _sV.set(S.rest[3 * k], S.rest[3 * k + 1], S.rest[3 * k + 2]).applyMatrix4(_sM);
  if (!S.p) {
    S.p = new Float32Array(n * 3); S.prev = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) { restW(k); S.p.set([_sV.x, _sV.y, _sV.z], 3 * k); }
    S.prev.set(S.p);
    S.lastM = null;
  }
  const p = S.p, prev = S.prev;
  // Sleep: once her waist and everyone near her (their hips and hands) have held still
  // for SKIRT_SLEEP seconds, the cloth has settled; stop simulating so it doesn't
  // quiver on the spot (the collision passes never quite agree). Any movement wakes it.
  let moved = S.lastM ? 0 : Infinity;
  if (S.lastM) for (let e = 0; e < 16; e++) moved = Math.max(moved, Math.abs(_sM.elements[e] - S.lastM.elements[e]));
  const sig = new THREE.Vector3();
  for (const o of everyone) if (o !== ch && o.group.parent && o.group.visible)
    for (const bn of ['pelvis', 'handL', 'handR']) sig.add(o.bones[bn].getWorldPosition(_sV2));
  const others = S.sig ? sig.distanceTo(S.sig) : Infinity;
  S.sig = sig;
  S.stillT = moved < 2e-5 && others < 1e-3 ? (S.stillT || 0) + dt : 0;
  if (S.stillT > SKIRT_SLEEP) return;
  // Carry the cloth with the body's own movement since last frame, so drops and
  // lunges can't leave it behind to snag on the legs: the waist's travel in full
  // (SKIRT_FOLLOW), but only SKIRT_FOLLOW_ROT of its turning, so in a spin the skirt
  // lags and swings out, flying up with the turn.
  if (S.lastM) {
    const c0 = _sV2.set(0, S.top, 0).applyMatrix4(S.lastM), c1 = _sV.set(0, S.top, 0).applyMatrix4(_sM);
    const dt3 = c1.clone().sub(c0).multiplyScalar(SKIRT_FOLLOW);
    const q0 = new THREE.Quaternion().setFromRotationMatrix(S.lastM), q1 = new THREE.Quaternion().setFromRotationMatrix(_sM);
    const dq = q1.multiply(q0.invert());
    const turn = new THREE.Quaternion().slerp(dq, SKIRT_FOLLOW_ROT), v = new THREE.Vector3();
    for (let k = N; k < n; k++) for (const arr of [p, prev]) {
      v.set(arr[3 * k], arr[3 * k + 1], arr[3 * k + 2]).sub(c0).applyQuaternion(turn).add(c0).add(dt3);
      arr[3 * k] = v.x; arr[3 * k + 1] = v.y; arr[3 * k + 2] = v.z;
    }
  }
  S.lastM = (S.lastM || new THREE.Matrix4()).copy(_sM);
  // Everything the cloth can touch this frame.
  const hip = ch.bones.pelvis.getWorldPosition(new THREE.Vector3());
  // Other bodies: their contact proxies, padded to make up for the smooth blends that
  // put their real surface a little outside them. Own body: the actual skin.
  const prims = everyone.filter(o => o !== ch && o.group.parent && o.group.visible && o.proxies && o.bones.pelvis.getWorldPosition(new THREE.Vector3()).distanceTo(hip) < 2.2).flatMap(posedProxies);
  // Own body, coarse: its proxies catch cloth that has ended up deep inside (a leg
  // swinging up into the skirt), where the skin-point test below can't reach.
  const own = posedProxies(ch);
  // Other people's hands (left out of the contact proxies, which IK places): a capsule
  // from wrist to fingertips, applied last so a palm lands on top of the cloth.
  const hands = [];
  for (const o of everyone) if (o !== ch && o.group.parent && o.group.visible) for (const sd of ['L', 'R']) {
    const a = o.bones['hand' + sd].getWorldPosition(new THREE.Vector3()), fb = o.bones['fingers' + sd];
    const tip = fb.localToWorld(new THREE.Vector3(...sub(o.spec.J['handEnd' + sd], o.spec.J['fingers' + sd])));
    const P = cone(a.toArray(), tip.toArray(), 0.013 * o.spec.H, 0.009 * o.spec.H);
    P.sc = mul(add3(P.a, P.b), 0.5); P.sr = len3(P.ba) / 2 + 0.03; hands.push(P);
  }
  skinPoints(ch, S);
  const boxes = solids.filter(Boolean).map(o => new THREE.Box3().setFromObject(o));
  const q = [0, 0, 0];
  // How far a point is inside Kiko's own body (plus the cloth's thickness), and which
  // way is out: her proxies for depth, her posed skin near the surface. [pen, nx, ny, nz]
  // or null when clear.
  const mq = [0, 0, 0];
  const ownPen = (x, y, z) => {
    mq[0] = x; mq[1] = y; mq[2] = z;
    let best = null;
    for (const P of own) {
      const dx = x - P.sc[0], dy = y - P.sc[1], dz = z - P.sc[2];
      if (dx * dx + dy * dy + dz * dz > P.sr * P.sr) continue;
      const d = primDist(mq, P);
      if (d >= 0 || (best && SKIRT_PAD - d <= best[0])) continue;
      const e = 0.001, g = [0, 0, 0];
      for (let a = 0; a < 3; a++) { const o = mq[a]; mq[a] = o + e; const f1 = primDist(mq, P); mq[a] = o - e; g[a] = f1 - primDist(mq, P); mq[a] = o; }
      const gl = len3(g) || 1; best = [SKIRT_PAD - d, g[0] / gl, g[1] / gl, g[2] / gl];
    }
    const cs = SKIN_CELL, cx = Math.floor(x / cs), cy = Math.floor(y / cs), cz = Math.floor(z / cs);
    let nd = Infinity, ni = -1;
    for (let ix = cx - 1; ix <= cx + 1; ix++) for (let iy = cy - 1; iy <= cy + 1; iy++) for (let iz = cz - 1; iz <= cz + 1; iz++) {
      const cell = S.grid.get(cellKey(ix, iy, iz)); if (!cell) continue;
      for (const k2 of cell) { const ex = x - S.skin.wp[3 * k2], ey = y - S.skin.wp[3 * k2 + 1], ez = z - S.skin.wp[3 * k2 + 2], d2 = ex * ex + ey * ey + ez * ez; if (d2 < nd) { nd = d2; ni = k2; } }
    }
    if (ni >= 0) {
      const W = S.skin.wp, Nn = S.skin.wn, o = 3 * ni;
      const sd = (x - W[o]) * Nn[o] + (y - W[o + 1]) * Nn[o + 1] + (z - W[o + 2]) * Nn[o + 2];
      if (sd < SKIRT_THICK && (!best || SKIRT_THICK - sd > best[0])) best = [SKIRT_THICK - sd, Nn[o], Nn[o + 1], Nn[o + 2]];
    }
    return best;
  };
  // Edges: the midpoint of each ring and column edge is tested too. Where the cloth
  // straddles part of the body (a thigh swung up between two rows, fabric stretched
  // over the glutes) both ends measure outside but the edge between them runs through
  // it; pushing both ends out together makes the cloth wrap round instead.
  const edges = S.springs.filter(sp => sp[3] === 1);
  const edgePass = () => {
    for (const [a, b] of edges) {
      const wa = a < N ? 0 : 1, wb = b < N ? 0 : 1;
      if (!wa && !wb) continue;
      const hit = ownPen((p[3 * a] + p[3 * b]) / 2, (p[3 * a + 1] + p[3 * b + 1]) / 2, (p[3 * a + 2] + p[3 * b + 2]) / 2);
      if (!hit) continue;
      const [pen, nx, ny, nz] = hit, ka = wa * (wb ? 1 : 2), kb = wb * (wa ? 1 : 2);
      p[3 * a] += nx * pen * ka; p[3 * a + 1] += ny * pen * ka; p[3 * a + 2] += nz * pen * ka;
      p[3 * b] += nx * pen * kb; p[3 * b + 1] += ny * pen * kb; p[3 * b + 2] += nz * pen * kb;
    }
  };
  const collide = k => {
    q[0] = p[3 * k]; q[1] = p[3 * k + 1]; q[2] = p[3 * k + 2];
    let best = Infinity, bp = null;
    for (const P of prims) {
      const dx = q[0] - P.sc[0], dy = q[1] - P.sc[1], dz = q[2] - P.sc[2];
      if (dx * dx + dy * dy + dz * dz > (P.sr + SKIRT_THICK + 0.02) ** 2) continue;
      const d = primDist(q, P);
      if (d < best) { best = d; bp = P; }
    }
    let hit = false;
    const T = SKIRT_THICK + SKIRT_PAD;
    if (bp && best < T) {
      const e = 0.001, g = [0, 0, 0];
      for (let a = 0; a < 3; a++) { const o = q[a]; q[a] = o + e; const f1 = primDist(q, bp); q[a] = o - e; g[a] = f1 - primDist(q, bp); q[a] = o; }
      const gl = len3(g) || 1, push = T - best;
      for (let a = 0; a < 3; a++) q[a] += g[a] / gl * push;
      hit = true;
    }
    for (const P of own) {
      const dx = q[0] - P.sc[0], dy = q[1] - P.sc[1], dz = q[2] - P.sc[2];
      if (dx * dx + dy * dy + dz * dz > P.sr * P.sr) continue;
      const d = primDist(q, P);
      if (d >= 0) continue;
      // Out on the side it came from: the direction taken at the particle's previous
      // position, if that was shallower. Otherwise a limb sweeping up under the cloth
      // (a kick) would push it out through the far side, and the leg through the skirt.
      const pp = [prev[3 * k], prev[3 * k + 1], prev[3 * k + 2]], at = primDist(pp, P) > d ? pp : q;
      const e = 0.001, g = [0, 0, 0];
      for (let a = 0; a < 3; a++) { const o = at[a]; at[a] = o + e; const f1 = primDist(at, P); at[a] = o - e; g[a] = f1 - primDist(at, P); at[a] = o; }
      const gl = len3(g) || 1, push = SKIRT_PAD - d;
      for (let a = 0; a < 3; a++) q[a] += g[a] / gl * push;
      hit = true;
    }
    // Own skin: the nearest skin point in the grid, and the plane through it.
    const cs = SKIN_CELL, cx = Math.floor(q[0] / cs), cy = Math.floor(q[1] / cs), cz = Math.floor(q[2] / cs);
    let nd = Infinity, ni = -1;
    for (let ix = cx - 1; ix <= cx + 1; ix++) for (let iy = cy - 1; iy <= cy + 1; iy++) for (let iz = cz - 1; iz <= cz + 1; iz++) {
      const cell = S.grid.get(cellKey(ix, iy, iz));
      if (!cell) continue;
      for (const k2 of cell) {
        const dx = q[0] - S.skin.wp[3 * k2], dy = q[1] - S.skin.wp[3 * k2 + 1], dz = q[2] - S.skin.wp[3 * k2 + 2], d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < nd) { nd = d2; ni = k2; }
      }
    }
    if (ni >= 0) {
      const W = S.skin.wp, Nn = S.skin.wn, o = 3 * ni;
      const sd = (q[0] - W[o]) * Nn[o] + (q[1] - W[o + 1]) * Nn[o + 1] + (q[2] - W[o + 2]) * Nn[o + 2];
      if (sd < SKIRT_THICK) { const push = SKIRT_THICK - sd; q[0] += Nn[o] * push; q[1] += Nn[o + 1] * push; q[2] += Nn[o + 2] * push; hit = true; }
    }
    for (const B of boxes) {
      const lo = B.min, hi = B.max, t = SKIRT_THICK;
      if (q[0] > lo.x - t && q[0] < hi.x + t && q[1] > lo.y - t && q[1] < hi.y + t && q[2] > lo.z - t && q[2] < hi.z + t) {
        // Out through the nearest face.
        const pen = [[q[0] - (lo.x - t), 0, -1], [(hi.x + t) - q[0], 0, 1], [q[1] - (lo.y - t), 1, -1], [(hi.y + t) - q[1], 1, 1], [q[2] - (lo.z - t), 2, -1], [(hi.z + t) - q[2], 2, 1]];
        const m = pen.reduce((a, b) => b[0] < a[0] ? b : a);
        q[m[1]] += m[2] * m[0]; hit = true;
      }
    }
    if (q[1] < SKIRT_THICK) { q[1] = SKIRT_THICK; hit = true; }
    for (const P of hands) {
      const dx = q[0] - P.sc[0], dy = q[1] - P.sc[1], dz = q[2] - P.sc[2];
      if (dx * dx + dy * dy + dz * dz > P.sr * P.sr) continue;
      const d = primDist(q, P);
      if (d >= SKIRT_THICK * 0.5) continue;
      const e = 0.001, g = [0, 0, 0];
      for (let a = 0; a < 3; a++) { const o = q[a]; q[a] = o + e; const f1 = primDist(q, P); q[a] = o - e; g[a] = f1 - primDist(q, P); q[a] = o; }
      const gl = len3(g) || 1, push = SKIRT_THICK * 0.5 - d;
      for (let a = 0; a < 3; a++) q[a] += g[a] / gl * push;
      hit = true;
    }
    if (hit) {
      p[3 * k] = q[0]; p[3 * k + 1] = q[1]; p[3 * k + 2] = q[2];
      // Friction: lose some of the sliding speed on contact.
      for (let a = 0; a < 3; a++) prev[3 * k + a] += (p[3 * k + a] - prev[3 * k + a]) * 0.25;
    }
  };
  const steps = Math.min(4, Math.max(1, Math.ceil(dt * 120))), h = Math.min(dt, 1 / 20) / steps;
  for (let st = 0; st < steps; st++) {
    for (let k = N; k < n; k++) for (let a = 0; a < 3; a++) {
      const i = 3 * k + a, v = (p[i] - prev[i]) * 0.985;
      prev[i] = p[i]; p[i] += v + (a === 1 ? -9.8 * h * h : 0);
    }
    for (let k = 0; k < N; k++) { restW(k); p.set([_sV.x, _sV.y, _sV.z], 3 * k); prev.set([_sV.x, _sV.y, _sV.z], 3 * k); }
    // Gathered (setSkirtGathered): the back of the hem is held up at the waistband,
    // just outside and below it; the fabric between folds over.
    if (S.gathered) for (const j of S.backCols) {
      const k = (R - 1) * N + j, x = S.rest[3 * j] * 1.12, y = S.rest[3 * j + 1] - 0.012 * ch.spec.H, z = S.rest[3 * j + 2] * 1.12;
      _sV.set(x, y, z).applyMatrix4(_sM); p.set([_sV.x, _sV.y, _sV.z], 3 * k); prev.set([_sV.x, _sV.y, _sV.z], 3 * k);
    }
    for (let it = 0; it < 5; it++) {
      for (const [a, b, L0, stiff] of S.springs) {
        const ax = 3 * a, bx = 3 * b;
        const dx = p[bx] - p[ax], dy = p[bx + 1] - p[ax + 1], dz = p[bx + 2] - p[ax + 2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-9, c = (d - L0) / d * stiff;
        const wa = a < N || (S.gathered && S.pinned.has(a)) ? 0 : 1, wb = b < N || (S.gathered && S.pinned.has(b)) ? 0 : 1, ws = wa + wb;
        if (!ws) continue;
        p[ax] += dx * c * wa / ws; p[ax + 1] += dy * c * wa / ws; p[ax + 2] += dz * c * wa / ws;
        p[bx] -= dx * c * wb / ws; p[bx + 1] -= dy * c * wb / ws; p[bx + 2] -= dz * c * wb / ws;
      }
      if (it >= 2) for (let k = N; k < n; k++) if (!(S.gathered && S.pinned.has(k))) collide(k);   // collisions on the last three passes
      if (it === 4 && st === steps - 1) edgePass();   // once a frame, on the last pass
    }
  }
  // Into the character's group space for drawing.
  const pos = S.mesh.geometry.attributes.position.array, inv = _sT.copy(ch.group.matrixWorld).invert();
  for (let k = 0; k < n; k++) { _sV.set(p[3 * k], p[3 * k + 1], p[3 * k + 2]).applyMatrix4(inv); pos[3 * k] = _sV.x; pos[3 * k + 1] = _sV.y; pos[3 * k + 2] = _sV.z; }
  S.mesh.geometry.attributes.position.needsUpdate = true;
  S.mesh.geometry.computeVertexNormals();
}

// ════════════════════════════════════════════════════════════════
// BUST CONTACT — keeps each breast out of other people's bodies (a leaning
// disciplinarian's chest over the subject's hips; a subject's chest hanging onto the
// disciplinarian's thigh). Points on the bust's surface are tested against each
// other character's actual body: mapped into their rest pose through the nearest
// body segment's bone and measured with their own distance field. Any point inside
// (or within BUST_PAD of the skin) pushes the bust bone out along that body's
// surface normal. The breast's base stays on the chest, so moving the bone flattens
// it against the surface instead of passing through. Call after bustSpring, with
// everyone on set.
// ════════════════════════════════════════════════════════════════
const BUST_PAD = 0.003;
// Sample directions on the bust ellipsoid (its own axes; +z is forward).
const BUST_DIRS = [[0, 0, 1], [0.7, 0, 0.7], [-0.7, 0, 0.7], [0, 0.7, 0.7], [0, -0.7, 0.7], [0.5, 0.5, 0.7], [-0.5, 0.5, 0.7],
  [0.5, -0.5, 0.7], [-0.5, -0.5, 0.7], [1, 0, 0], [-1, 0, 0], [0, -1, 0.1], [0, 1, 0.1]].map(norm);
// Body segments [bone, child]: a point is mapped into rest pose through the nearest one's bone.
const SEGMENTS = [['pelvis', 'spine1'], ['spine1', 'spine2'], ['spine2', 'neck'], ['neck', 'head'],
  ...['L', 'R'].flatMap(s => [['thigh' + s, 'shin' + s], ['shin' + s, 'foot' + s], ['upperArm' + s, 'forearm' + s], ['forearm' + s, 'hand' + s]])];
const _bq = new THREE.Vector3(), _bm = new THREE.Matrix4(), _bn = new THREE.Matrix3();
function bustContact(ch, everyone) {
  if (!ch.spec.bust) return;
  const others = everyone.filter(o => o !== ch && o.group.parent);
  if (!others.length) return;
  const sk = ch.mesh.skeleton, sp = ch.bones.spine2;
  ch.bustPush = ch.bustPush || { L: new THREE.Vector3(), R: new THREE.Vector3() };
  // Each other body: world segments, and each segment bone's skinning matrix and inverse.
  const bodies = others.map(o => ({ o, segs: SEGMENTS.map(([a, b]) => {
    const i = BONES.indexOf(a), m = o.bones[a].matrixWorld.clone().multiply(o.mesh.skeleton.boneInverses[i]);
    return { a: o.bones[a].getWorldPosition(new THREE.Vector3()), b: o.bones[b].getWorldPosition(new THREE.Vector3()), m, inv: m.clone().invert() };
  }) }));
  for (const [side, s] of [['L', 1], ['R', -1]]) {
    const P = ch.spec.prims.find(q => q.tag === 'bust' && q.side === s), b = ch.bones['bust' + side];
    const reach = Math.max(...P.r) * 0.8;
    // The push is in world space; the bone's position is in spine2's frame, from where
    // bustSpring left it this frame.
    const base = b.position.clone(), spInv = sp.getWorldQuaternion(new THREE.Quaternion()).invert();
    const place = v => { b.position.copy(base).add(v.clone().applyQuaternion(spInv)); b.updateMatrixWorld(true); };
    let push = new THREE.Vector3();
    for (let it = 0; it < 2; it++) {
      place(push);
      _bm.copy(b.matrixWorld).multiply(sk.boneInverses[BONES.indexOf('bust' + side)]);
      let worst = null, depth = 0;
      for (const d of BUST_DIRS) {
        const rest = add(P.c, add(mul(P.u, d[0] * P.r[0]), add(mul(P.v, d[1] * P.r[1]), mul(P.w, d[2] * P.r[2]))));
        const q = _bq.set(...rest).applyMatrix4(_bm);
        for (const { o, segs } of bodies) {
          let best = Infinity, seg = null;
          for (const g of segs) {
            const ab = g.b.clone().sub(g.a), t = clamp(q.clone().sub(g.a).dot(ab) / Math.max(ab.lengthSq(), 1e-9), 0, 1);
            const dd = g.a.clone().addScaledVector(ab, t).distanceToSquared(q);
            if (dd < best) { best = dd; seg = g; }
          }
          if (best > 0.09) continue;                               // nothing within 30 cm
          const r = q.clone().applyMatrix4(seg.inv).toArray();
          const f = field(o.spec, r);
          if (f >= BUST_PAD || BUST_PAD - f <= depth) continue;
          depth = BUST_PAD - f;
          const g = gradient(o.spec, r, 0.002, f);
          worst = new THREE.Vector3(...g).applyMatrix3(_bn.setFromMatrix4(seg.m)).normalize().multiplyScalar(depth);
        }
      }
      if (!worst) break;
      push.add(worst);
      if (push.length() > reach) push.setLength(reach);
    }
    // Ease out of contact (never into it), so a breast settles back instead of snapping.
    const prev = ch.bustPush[side];
    if (push.lengthSq() < prev.lengthSq()) push = prev.clone().lerp(push, 0.25);
    prev.copy(push);
    place(push);
  }
}

global.Starlight = {
  PRESETS, ORDER, FACE_DEFAULTS, faceParams, BONES, POSES, clone, SKIN, BRA_STYLES, lookLayers, dress, setSkin,
  buildCharacter, disposeCharacter, resetCharacter, setPose, groundFeet, wideStance, poseQuats, degQ, mirrorPose, animateCharacter, bustSpring, bustContact, updateContacts, faceStep, setExpression, setMood, MOODS, moodFor, EXPR_RANGE, mouthOpening, EXPR_DEFAULTS, skirtStep, bunchStep, setSkirtOff, setSkirtGathered, setLowered, addMark, clearMarks, fadeMarks, fadeMarksMove, copyMarks, markStrength, markCount,
  hairStep, bodyColliders, hairReset, setFingerCurl, setFingerBend, fistPocket,
  ALL_MATS, lin, field, loftRing,
  createDisciplineScene, POSITIONS: ['lap', 'case', 'head', 'knees'], IMPLEMENTS, PADDLE, seatGiver, buildBench, DEFAULT_TIMING, GIVER_BASE, GIVER_BEAT, GIVER_SEATED,
  armIK, armReach, humeralTwist, elbowClearance, posedSkinNear, skinSignedDist, lookAt,
  setHandWorld, rotateBoneWorld, seatExcess, seatPoints, restClearance, PARENT,
  DANCE_BASE, DANCE_SRC, DANCE_MOVES, SIDED, STUMBLE, mirrorName, createDancer,
};
})(window);
