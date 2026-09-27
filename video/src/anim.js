// Small deterministic animation toolkit: easings, springs, sequencing.

export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const inv = (v, a, b) => clamp((v - a) / (b - a || 1e-9));
export const round = (n, p = 3) => {
  const m = 10 ** p;
  return Math.round(n * m) / m;
};

export const ease = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => t * (2 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  outCubic: (t) => 1 - (1 - t) ** 3,
  inCubic: (t) => t ** 3,
  inOutCubic: (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
  outQuart: (t) => 1 - (1 - t) ** 4,
  inOutQuart: (t) => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2),
  outQuint: (t) => 1 - (1 - t) ** 5,
  inQuint: (t) => t ** 5,
  inOutQuint: (t) => (t < 0.5 ? 16 * t ** 5 : 1 - (-2 * t + 2) ** 5 / 2),
  outExpo: (t) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t)),
  inExpo: (t) => (t <= 0 ? 0 : 2 ** (10 * t - 10)),
  inOutExpo: (t) =>
    t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? 2 ** (20 * t - 10) / 2 : (2 - 2 ** (-20 * t + 10)) / 2,
  outBack: (t, s = 1.70158) => 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2,
  inBack: (t, s = 1.70158) => (s + 1) * t ** 3 - s * t ** 2,
  outElastic: (t) => {
    if (t === 0 || t === 1) return t;
    const p = (2 * Math.PI) / 3;
    return 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * p) + 1;
  },
  outBounce: (t) => {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};

// Analytic damped spring, normalised so spring(0)=0 and spring(inf)=1.
export function spring(t, { stiffness = 170, damping = 22, mass = 1 } = {}) {
  if (t <= 0) return 0;
  const w0 = Math.sqrt(stiffness / mass);
  const z = damping / (2 * Math.sqrt(stiffness * mass));
  if (z < 1) {
    const wd = w0 * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + (z * w0 / wd) * Math.sin(wd * t));
  }
  const e = Math.exp(-w0 * t);
  return 1 - e * (1 + w0 * t);
}

// progress of a window [start, start+dur] with easing
export function win(t, start, dur, easing = ease.outQuint) {
  return easing(inv(t, start, start + dur));
}
export function fade(t, start, dur, easing = ease.outCubic) {
  return easing(inv(t, start, start + dur));
}
export function fadeOut(t, start, dur, easing = ease.inCubic) {
  return 1 - easing(inv(t, start, start + dur));
}

// hold then leave: enters over `inDur`, exits over `outDur` before `end`
export function enter(t, start, inDur = 0.35, easing = ease.outQuint) {
  return ease.outQuint(inv(t, start, start + inDur));
}
export function envelope(t, start, end, inDur = 0.3, outDur = 0.3) {
  const a = fade(t, start, inDur);
  const b = fadeOut(t, end - outDur, outDur);
  return Math.min(a, b);
}

export function stagger(i, { start = 0, step = 0.08, dur = 0.5, easing = ease.outQuint } = {}) {
  return (t) => easing(inv(t, start + i * step, start + i * step + dur));
}

// classic "rise + fade" used everywhere: returns {p, y, o}
export function rise(t, start, { dur = 0.6, dist = 40, easing = ease.outQuint } = {}) {
  const p = easing(inv(t, start, start + dur));
  return { p, y: (1 - p) * dist, o: clamp(p * 1.4) };
}

// deterministic pseudo-random for grain/jitter
export function rnd(seed) {
  let x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
export function noise2(x, y = 0) {
  return rnd(Math.floor(x) * 57.13 + Math.floor(y) * 91.7);
}

// smooth value noise in 1D for camera drift
export function drift(t, speed = 0.2, seed = 0) {
  const x = t * speed + seed * 13.7;
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(rnd(i + seed * 7.3), rnd(i + 1 + seed * 7.3), u) * 2 - 1;
}

export const bezier = (p0, p1, p2, p3, t) => {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
};

export function scramble(str, p, alphabet = 'abcdefghijklmnopqrstuvwxyz') {
  // reveal `str` progressively, unresolved chars shown as random letters
  const n = Math.ceil(p * str.length);
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (i < n || ch === ' ') out += ch;
    else out += alphabet[Math.floor(rnd(i * 3.3 + Math.floor(p * 97)) * alphabet.length)];
  }
  return out;
}

export function typed(str, p) {
  const n = Math.round(clamp(p) * str.length);
  return str.slice(0, n);
}
