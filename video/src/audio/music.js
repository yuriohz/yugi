import {
  SR, sine, saw, tri, square, noise, makeSVF, expDecay, softClip, makeReverb, makeDelay,
} from './dsp.js';

/* ------------------------------------------------------------------ voices */

function env(i, len, { a = 0.002, d = 0.2, peak = 1, curve = 5 } = {}) {
  const t = i / SR;
  if (t < a) return (t / a) * peak;
  const u = (t - a) / d;
  if (u >= 1) return 0;
  return peak * Math.pow(1 - u, curve);
}

function addAt(buf, t0, dur, fn) {
  const start = Math.round(t0 * SR);
  const n = Math.round(dur * SR);
  for (let i = 0; i < n; i++) {
    const idx = start + i;
    if (idx < 0 || idx >= buf.length) continue;
    const v = fn(i / SR, i);
    buf[idx] += v;
  }
}

export function kick(buf, t, gain = 1) {
  addAt(buf, t, 0.5, (tt) => {
    const f = 130 * Math.exp(-tt * 34) + 46;
    const e = Math.exp(-tt * 9.5);
    const click = Math.exp(-tt * 260) * 0.35 * noise();
    return (sine(tt * f * 0.5) * e + click) * gain * 0.9;
  });
}

export function sub(buf, t, freq, dur, gain = 1) {
  let phase = 0;
  addAt(buf, t, dur + 0.1, (tt) => {
    phase += freq / SR;
    const e = env(0, 0, {}) ;
    const a = tt < 0.012 ? tt / 0.012 : 1;
    const r = Math.min(1, Math.max(0, (dur - tt) / 0.06));
    return (sine(phase) * 0.85 + tri(phase) * 0.15) * a * r * gain * 0.7;
  });
}

export function hat(buf, t, gain = 1, open = false) {
  const dur = open ? 0.24 : 0.055;
  let lp = 0;
  addAt(buf, t, dur + 0.02, (tt) => {
    const n = noise();
    lp += 0.7 * (n - lp);
    const hp = n - lp;
    const e = Math.exp(-tt / (open ? 0.10 : 0.018));
    return hp * e * gain * 0.5;
  });
}

export function snare(buf, t, gain = 1) {
  let bp = 0, lp = 0;
  addAt(buf, t, 0.32, (tt) => {
    const n = noise();
    bp += 0.42 * (n - bp);
    const body = sine(tt * 190) * Math.exp(-tt * 26) * 0.5;
    return (n * 0.55 + body) * Math.exp(-tt / 0.075) * gain * 0.55;
  });
}

export function clap(buf, t, gain = 1) {
  [0, 0.011, 0.022, 0.034].forEach((off, i) => {
    addAt(buf, t + off, 0.16, (tt) => noise() * Math.exp(-tt / (i === 3 ? 0.075 : 0.014)) * gain * (i === 3 ? 0.5 : 0.28));
  });
}

export function pluck(buf, t, freq, dur = 0.9, gain = 1, { bright = 1 } = {}) {
  const svf = makeSVF();
  let p1 = 0, p2 = 0;
  addAt(buf, t, dur + 0.15, (tt) => {
    p1 += freq / SR;
    p2 += (freq * 1.005) / SR;
    const raw = (saw(p1) * 0.55 + tri(p2) * 0.45);
    const cut = (freq * 3.2 * bright + 220) * Math.exp(-tt * 5.5) + freq * 1.2;
    const f = svf(raw, Math.min(cut, 12000), 1.5);
    const e = env(0, 0, {});
    const a = tt < 0.004 ? tt / 0.004 : 1;
    const rel = Math.min(1, Math.max(0, (dur - tt) / 0.08));
    return f.low * a * rel * gain * 0.42;
  });
}

export function bell(buf, t, freq, dur = 1.6, gain = 1) {
  addAt(buf, t, dur + 0.2, (tt) => {
    const m = sine(tt * freq * 2.01) * Math.exp(-tt * 3) * 2.2;
    const c = sine(tt * freq + m * 0.4);
    const e = Math.exp(-tt / (dur * 0.42));
    return c * e * gain * 0.3;
  });
}

export function pad(buf, t, freqs, dur, gain = 1, { attack = 0.6 } = {}) {
  const svf = makeSVF();
  const phases = freqs.map(() => 0);
  const detunes = [0.997, 1.0, 1.004, 1.008];
  addAt(buf, t, dur + 1.2, (tt) => {
    let v = 0;
    freqs.forEach((f, i) => {
      phases[i] += (f * (detunes[i % detunes.length])) / SR;
      v += saw(phases[i]) * 0.28 + tri(phases[i] * 0.5) * 0.12;
    });
    v /= freqs.length;
    const a = Math.min(1, tt / attack);
    const rel = Math.min(1, Math.max(0, (dur - tt) / 1.0));
    const filt = svf(v, 900 + 1400 * Math.min(1, tt / 2.2), 0.9);
    return (filt.low * 0.9 + v * 0.1) * a * rel * gain * 0.5;
  });
}

export function stab(buf, t, freq, gain = 1) {
  const svf = makeSVF();
  let p = 0;
  addAt(buf, t, 0.9, (tt) => {
    p += freq / SR;
    const raw = saw(p) * 0.6 + square(p * 0.5) * 0.25;
    const f = svf(raw, freq * 6 * Math.exp(-tt * 8) + 400, 2.4);
    return (f.low * 0.8 + f.band * 0.2) * Math.exp(-tt / 0.19) * gain * 0.5;
  });
  addAt(buf, t, 0.12, (tt) => noise() * Math.exp(-tt / 0.02) * gain * 0.22);
}

export function riser(buf, t, dur, gain = 1) {
  let bp = 0, lp = 0;
  addAt(buf, t, dur + 0.1, (tt) => {
    const u = tt / dur;
    const n = noise();
    bp += (0.06 + u * 0.5) * (n - bp);
    const shine = sine(tt * (200 + u * 1800)) * u * 0.25;
    return (bp * (0.15 + u * 0.9) + shine) * gain * 0.5;
  });
}

export function impact(buf, t, gain = 1) {
  // sub drop + noise burst
  addAt(buf, t, 1.6, (tt) => {
    const f = 120 * Math.exp(-tt * 5) + 34;
    const e = Math.exp(-tt / 0.55);
    return sine(tt * f * 0.5) * e * gain * 0.9;
  });
  let lp = 0;
  addAt(buf, t, 1.1, (tt) => noise() * Math.exp(-tt / 0.20) * gain * 0.30);
  addAt(buf, t, 0.06, (tt) => noise() * gain * 0.5 * Math.exp(-tt / 0.012));
}

export function tick(buf, t, gain = 1) {
  addAt(buf, t, 0.05, (tt) => (sine(tt * 2400) * 0.5 + noise() * 0.2) * Math.exp(-tt / 0.008) * gain * 0.4);
}

/* ------------------------------------------------------------------- score */

export function renderScore(total, marks) {
  const L = new Float32Array(Math.ceil(total * SR) + SR);
  const R = new Float32Array(L.length);
  const dry = L; // mono write, then stereo spread with sends

  const rev = makeReverb(SR, { size: 0.92, damp: 0.34, mix: 0.3 });
  const revBuf = new Float32Array(L.length);
  const dly = [makeDelay(SR, 0.3432, 0.30), makeDelay(SR, 0.4681, 0.26)];

  const write = (buf, t, dur, fn) => {
    const start = Math.round(t * SR);
    const n = Math.round(dur * SR);
    for (let i = 0; i < n; i++) {
      const idx = start + i;
      if (idx < 0 || idx >= buf.length) continue;
      buf[idx] += fn(i / SR, i);
    }
  };

  const BPS = 124 / 60;
  const BEAT = 1 / BPS;         // 0.4839 s
  const BAR = BEAT * 4;         // 1.935 s

  const M = marks;              // { t01..t09, shots }
  const chordRoots = [110.0, 87.31, 98.0, 98.0];        // Am, F, G, G
  const chordTones = [
    [220.0, 261.63, 329.63],
    [174.61, 220.0, 261.63],
    [196.0, 261.63, 329.63],
    [196.0, 246.94, 293.66],
  ];
  const arp = [
    [220.0, 261.63, 329.63, 440.0],
    [174.61, 220.0, 261.63, 349.23],
    [196.0, 261.63, 329.63, 392.0],
    [196.0, 246.94, 293.66, 392.0],
  ];

  /* ---- intro: air, ticks, riser ---- */
  pad(dry, 0.05, chordTones[0].map((f) => f / 2), 6.2, 0.34, { attack: 1.4 });
  for (let i = 0; i < 14; i++) tick(dry, 0.42 + i * BEAT * 0.5, 0.5 + i * 0.03);
  riser(dry, 0.10, 0.92, 0.55);
  bell(dry, 0.95, 880, 1.6, 0.24);

  /* ---- impact at "Make it land." ---- */
  const t2 = M.shots.impact;
  impact(dry, t2, 1.05);
  sub(dry, t2 + 0.02, 55, 1.5, 0.85);
  hat(dry, t2, 0.6, true);
  pad(dry, t2, chordTones[0], 2.4, 0.45, { attack: 0.12 });

  /* ---- wordmark: plucks, warm ---- */
  const t3 = M.shots.wordmark;
  [0, 1, 2, 3].forEach((i) => {
    pluck(dry, t3 + 0.15 + i * 0.19, arp[0][i % 4], 1.4, 0.5, { bright: 1.1 });
  });
  bell(dry, t3 + 0.9, 659.25, 2.2, 0.3);
  pad(dry, t3, chordTones[0], 2.6, 0.40, { attack: 0.5 });

  /* ---- groove from "select" to outro ---- */
  const grooveStart = M.shots.select;
  const grooveEnd = M.shots.outro;
  const bars = Math.ceil((grooveEnd - grooveStart) / BAR);
  for (let b = 0; b < bars; b++) {
    const t0 = grooveStart + b * BAR;
    if (t0 > grooveEnd) break;
    const ci = b % 4;
    const chord = chordTones[ci];
    const root = chordRoots[ci];
    const last = b === bars - 1;

    // drums
    if (!last) {
      kick(dry, t0, 1.0);
      kick(dry, t0 + BEAT * 2, 0.92);
      if (b % 2 === 1) kick(dry, t0 + BEAT * 2.75, 0.7);
      snare(dry, t0 + BEAT, 0.85);
      snare(dry, t0 + BEAT * 3, 0.9);
      if (b >= 2 && b % 4 === 3) clap(dry, t0 + BEAT * 3, 0.5);
      for (let h = 0; h < 8; h++) {
        hat(dry, t0 + h * BEAT * 0.5, h % 2 === 0 ? 0.34 : 0.22, h === 7 && b % 4 === 3);
      }
    }
    // bass
    sub(dry, t0, root, BEAT * 1.4, 0.75);
    sub(dry, t0 + BEAT * 2, root, BEAT * 0.8, 0.6);
    if (b % 2 === 1) sub(dry, t0 + BEAT * 3.5, root * 1.5, BEAT * 0.4, 0.4);

    // arpeggio
    for (let a = 0; a < 8; a++) {
      const f = arp[ci][a % 4] * (a >= 4 ? 2 : 1);
      pluck(dry, t0 + a * BEAT * 0.5, f, 0.7, a % 2 === 0 ? 0.34 : 0.22, { bright: 1 + 0.4 * Math.min(1, b / 6) });
    }
    // pad every bar
    pad(dry, t0, chord.map((f) => f / (b % 2 ? 2 : 1)), BAR * 1.1, 0.30, { attack: 0.5 });
  }

  /* ---- mode stabs on the spoken beats ---- */
  (M.modeStabs || []).forEach((t, i) => {
    const f = [330, 392, 440, 523.25, 659.25][i] ?? 440;
    stab(dry, t, f, 0.85);
    bell(dry, t, f * 2, 1.1, 0.22);
    if (i === 4) impact(dry, t + 0.02, 0.5);
  });

  /* ---- fidelity: sparkle + open filter ---- */
  const t7 = M.shots.fidelity;
  [0, 0.35, 0.7, 1.05].forEach((o, i) => bell(dry, t7 + o, [523.25, 659.25, 784, 880][i], 1.8, 0.26));
  pad(dry, t7, chordTones[2], 4.2, 0.34, { attack: 0.9 });
  sub(dry, t7, 98, 3.6, 0.5);

  /* ---- control: pulse + ticks ---- */
  const t8 = M.shots.control;
  for (let i = 0; i < 12; i++) tick(dry, t8 + i * BEAT * 0.5, 0.5);
  sub(dry, t8, 87.31, 3.4, 0.6);
  [0, 1.55, 1.75, 1.95].forEach((o, i) => {
    if (i === 0) return;
    stab(dry, t8 + o, [330, 294, 262][i - 1] ?? 262, 0.5);
  });
  impact(dry, t8 + 2.25, 0.55);

  /* ---- outro: resolve ---- */
  const t9 = M.shots.outro;
  impact(dry, t9 + 0.25, 1.0);
  pad(dry, t9, [130.81, 196.0, 261.63, 329.63], 6.0, 0.52, { attack: 0.35 });
  pad(dry, t9 + 2.2, [130.81, 196.0, 329.63, 392.0], 4.2, 0.34, { attack: 1.1 });
  [0, 0.4, 0.8, 1.2, 1.6].forEach((o, i) => {
    pluck(dry, t9 + 0.5 + o, [261.63, 329.63, 392.0, 523.25, 659.25][i], 2.4, 0.4, { bright: 1.3 });
  });
  bell(dry, t9 + 2.6, 523.25, 3.4, 0.3);
  sub(dry, t9 + 0.25, 65.41, 3.2, 0.9);

  /* ---- reverbs / delay sends + stereo ---- */
  const send = new Float32Array(L.length);
  for (let i = 0; i < L.length; i++) send[i] = dry[i] * 0.5;
  for (let i = 0; i < L.length; i++) {
    const wet = rev(send[i]);
    revBuf[i] = wet;
  }
  for (let i = 0; i < L.length; i++) {
    const d0 = dly[0](dry[i] * 0.35, 0);
    const d1 = dly[1](dry[i] * 0.35, 1);
    const wet = revBuf[i] * 0.42;
    const mono = dry[i] + wet;
    const spread = (d0 - d1) * 0.30;
    L[i] = mono + spread + wet * 0.03;
    R[i] = mono - spread - wet * 0.03;
  }
  return [L, R];
}
