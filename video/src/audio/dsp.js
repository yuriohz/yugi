import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { ffmpegPath } from './ffmpeg.js';

export const SR = 48000;

export function decodeToF32(file, { mono = true, sr = SR } = {}) {
  const raw = `${file}.raw`;
  execFileSync(ffmpegPath(), [
    '-hide_banner', '-loglevel', 'error', '-y', '-i', file,
    '-f', 'f32le', '-ac', mono ? '1' : '2', '-ar', String(sr), raw,
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  const buf = readFileSync(raw);
  const arr = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4).slice();
  return arr;
}

export function writeWav(file, channels, sr = SR) {
  // channels: array of Float32Array
  const nCh = channels.length;
  const len = channels[0].length;
  const bytes = 44 + len * nCh * 2;
  const b = Buffer.alloc(bytes);
  b.write('RIFF', 0);
  b.writeUInt32LE(bytes - 8, 4);
  b.write('WAVE', 8);
  b.write('fmt ', 12);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(nCh, 22);
  b.writeUInt32LE(sr, 24);
  b.writeUInt32LE(sr * nCh * 2, 28);
  b.writeUInt16LE(nCh * 2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(len * nCh * 2, 40);
  let off = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < nCh; c++) {
      let v = Math.max(-1, Math.min(1, channels[c][i] || 0));
      b.writeInt16LE(Math.round(v * 32767), off);
      off += 2;
    }
  }
  writeFileSync(file, b);
}

export function trimSilence(a, { thresh = 0.012, pad = 0.035, sr = SR } = {}) {
  // rolling RMS gate
  const win = Math.round(0.012 * sr);
  const energy = new Float32Array(a.length);
  let acc = 0;
  for (let i = 0; i < a.length; i++) {
    acc += a[i] * a[i];
    if (i >= win) acc -= a[i - win] * a[i - win];
    energy[i] = Math.sqrt(acc / win);
  }
  let peak = 0;
  for (let i = 0; i < a.length; i++) peak = Math.max(peak, energy[i]);
  const t = Math.max(thresh, peak * 0.04);
  let start = 0, end = a.length - 1;
  while (start < a.length && energy[start] < t) start++;
  while (end > start && energy[end] < t) end--;
  start = Math.max(0, start - Math.round(pad * sr));
  end = Math.min(a.length - 1, end + Math.round(pad * sr));
  return { start, end, dur: (end - start + 1) / sr };
}

// split a clip into voiced segments (for word-level timing of the modes line)
export function voicedSegments(a, { gap = 0.14, thresh = 0.02, sr = SR } = {}) {
  const win = Math.round(0.010 * sr);
  const energy = new Float32Array(a.length);
  let acc = 0;
  for (let i = 0; i < a.length; i++) {
    acc += a[i] * a[i];
    if (i >= win) acc -= a[i - win] * a[i - win];
    energy[i] = Math.sqrt(acc / win);
  }
  let peak = 0;
  for (let i = 0; i < a.length; i++) peak = Math.max(peak, energy[i]);
  const t = Math.max(thresh, peak * 0.06);
  const segs = [];
  let s = -1;
  const gapN = Math.round(gap * sr);
  let lastVoiced = -1e9;
  for (let i = 0; i < a.length; i++) {
    if (energy[i] >= t) {
      if (s < 0 || i - lastVoiced > gapN) {
        if (s >= 0) segs.push({ start: s, end: lastVoiced });
        s = i;
      }
      lastVoiced = i;
    }
  }
  if (s >= 0) segs.push({ start: s, end: lastVoiced });
  return segs.map((x) => ({ start: x.start / sr, end: x.end / sr, dur: (x.end - x.start) / sr }))
    .filter((x) => x.dur > 0.08);
}

export function normalize(a, target = 0.89) {
  let peak = 0;
  for (let i = 0; i < a.length; i++) peak = Math.max(peak, Math.abs(a[i]));
  if (peak === 0) return a;
  const k = target / peak;
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] * k;
  return out;
}

export function softClip(x, drive = 1) {
  return Math.tanh(x * drive) / Math.tanh(drive);
}

/* ------------------------------------------------------------------ oscillators */

export function sine(phase) { return Math.sin(phase * Math.PI * 2); }
export function saw(phase) {
  const p = phase - Math.floor(phase);
  return 2 * p - 1;
}
export function square(phase) {
  const p = phase - Math.floor(phase);
  return p < 0.5 ? 1 : -1;
}
export function tri(phase) {
  const p = phase - Math.floor(phase);
  return 4 * Math.abs(p - 0.5) - 1;
}
export function noise() { return Math.random() * 2 - 1; }

/* ------------------------------------------------------------------ biquad SVF */

export function makeSVF() {
  let low = 0, band = 0;
  return function svf(input, cutoff, res, sr = SR) {
    const f = 2 * Math.sin((Math.PI * Math.min(cutoff, sr * 0.45)) / sr);
    const q = 1 / Math.max(0.5, res);
    const high = input - low - q * band;
    band += f * high;
    low += f * band;
    return { low, band, high };
  };
}

/* ------------------------------------------------------------------ envelopes */

export const adsr = (t, dur, { a = 0.005, d = 0.08, s = 0.6, r = 0.12 } = {}) => {
  if (t < 0 || t > dur) return 0;
  if (t < a) return (t / a) * 1;
  if (t < a + d) return 1 - (1 - s) * ((t - a) / d);
  if (t < dur - r) return s;
  return s * Math.max(0, 1 - (t - (dur - r)) / r);
};

export const expDecay = (t, tau) => (t < 0 ? 0 : Math.exp(-t / tau));

/* ------------------------------------------------------------------ reverb */

export function makeReverb(sr = SR, { size = 0.86, damp = 0.36, mix = 0.3 } = {}) {
  const combs = [
    [1116, 0.742], [1188, 0.733], [1277, 0.715], [1356, 0.697],
    [1422, 0.679], [1491, 0.661], [1557, 0.644], [1617, 0.624],
  ].map(([d, fb]) => ({ buf: new Float32Array(Math.round(d * size)), i: 0, fb, lp: 0 }));
  const allpass = [
    [556, 0.7], [441, 0.7], [341, 0.7], [225, 0.7],
  ].map(([d, fb]) => ({ buf: new Float32Array(Math.round(d * size)), i: 0, fb }));
  return function reverb(x) {
    let out = 0;
    for (const c of combs) {
      const v = c.buf[c.i];
      c.lp += damp * (v - c.lp);
      out += c.lp;
      c.buf[c.i] = x + c.lp * c.fb;
      c.i = (c.i + 1) % c.buf.length;
    }
    out /= combs.length;
    for (const a of allpass) {
      const v = a.buf[a.i];
      const y = -a.fb * out + v;          // Schroeder allpass
      a.buf[a.i] = out + a.fb * y;
      out = y;
      a.i = (a.i + 1) % a.buf.length;
    }
    return out;
  };
}

// simple stereo delay
export function makeDelay(sr = SR, time = 0.28, fb = 0.32) {
  const n = Math.round(time * sr);
  const buf = [new Float32Array(n), new Float32Array(n)];
  let i = 0;
  return (x, ch) => {
    const v = buf[ch % 2][i];
    buf[ch % 2][i] = x + v * fb;
    i = (i + 1) % n;
    return v;
  };
}

export function ensureDir(p) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}
