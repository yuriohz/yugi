import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import {
  decodeToF32, trimSilence, writeWav, normalize, voicedSegments, softClip, SR,
} from './audio/dsp.js';
import { renderScore } from './audio/music.js';
import { masterChain } from './audio/eq.js';
import { ffmpegPath } from './audio/ffmpeg.js';
import { VO_TIMES, SHOTS, TOTAL } from './timeline.js';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..');
const VO_DIR = join(ROOT, 'public', 'vo');
const OUT = join(ROOT, 'out');
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

/* ------------------------------------------------------------------- 1. VO */

function prepareVo() {
  const files = readdirSync(VO_DIR).filter((f) => f.endsWith('.mp3')).sort();
  const lines = [];
  for (const f of files) {
    const id = f.replace('.mp3', '');
    const raw = decodeToF32(join(VO_DIR, f));
    const { start, end, dur } = trimSilence(raw);
    const trimmed = normalize(raw.slice(start, end + 1), 0.80);
    writeWav(join(OUT, `vo-${id}.wav`), [trimmed]);
    lines.push({ id, dur });
  }
  return lines;
}

/* ------------------------------------------------------- 2. mode beat times */

function modeStabs() {
  const raw = decodeToF32(join(VO_DIR, '06.mp3'));
  const segs = voicedSegments(raw, { gap: 0.13 }).filter((s) => s.dur > 0.1);
  const abs = segs.map((s) => VO_TIMES['06'] + s.start);
  const local = abs.map((a) => a - SHOTS.find((s) => s.id === 'modes').start);
  writeFileSync(join(OUT, 'vo-06-beats.json'), JSON.stringify(local.map((x) => Math.round(x * 1000) / 1000)));
  return { abs, local };
}

/* -------------------------------------------------------------- 3. mixing */

function build() {
  const lines = prepareVo();
  const N = Math.ceil(TOTAL * SR) + SR;
  const vo = new Float32Array(N);
  for (const l of lines) {
    const wav = decodeToF32(join(OUT, `vo-${l.id}.wav`));
    const start = Math.round((VO_TIMES[l.id] ?? 0) * SR);
    for (let i = 0; i < wav.length; i++) {
      const idx = start + i;
      if (idx >= 0 && idx < N) vo[idx] += wav[i] * 0.95;
    }
  }

  const { abs: stabAbs, local: stabLocal } = modeStabs();
  const marks = {
    shots: Object.fromEntries(SHOTS.map((s) => [s.id, s.start])),
    modeStabs: stabAbs,
  };

  console.log('rendering score…');
  const [mL, mR] = renderScore(TOTAL, marks);

  // duck music under the voice (fast attack, musical release)
  const duck = new Float32Array(N);
  let env = 0;
  const atk = Math.exp(-1 / (0.02 * SR));
  const rel = Math.exp(-1 / (0.28 * SR));
  for (let i = 0; i < N; i++) {
    const a = Math.abs(vo[i]);
    env = a > env ? atk * env + (1 - atk) * a : rel * env + (1 - rel) * a;
    duck[i] = Math.min(1, env * 3.4);
  }
  // look-ahead smoothing so the music dips just before each line
  const la = Math.round(0.06 * SR);
  const duck2 = new Float32Array(N);
  for (let i = 0; i < N; i++) duck2[i] = duck[Math.min(N - 1, i + la)];

  const L = new Float32Array(N);
  const R = new Float32Array(N);
  const eq = masterChain(SR);
  let hpL = 0, hpR = 0;
  for (let i = 0; i < N; i++) {
    const g = 0.40 * (1 - 0.60 * duck2[i]);
    let l = mL[i] * g + vo[i];
    let r = mR[i] * g + vo[i];
    // gentle rumble cut
    hpL += 0.9985 * (l - hpL);
    hpR += 0.9985 * (r - hpR);
    l -= hpL * 0.82;
    r -= hpR * 0.82;
    L[i] = softClip(eq(l * 1.02, 0) * 1.05, 1.1) * 0.9;
    R[i] = softClip(eq(r * 1.02, 1) * 1.05, 1.1) * 0.9;
  }

  // fades
  const fin = Math.round(0.02 * SR);
  const fout = Math.round(0.9 * SR);
  for (let i = 0; i < fin; i++) { L[i] *= i / fin; R[i] *= i / fin; }
  for (let i = 0; i < fout; i++) {
    const k = i / fout;
    L[N - 1 - i] *= k;
    R[N - 1 - i] *= k;
  }

  let peak = 0;
  for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const k = 0.60 / (peak || 1);
  for (let i = 0; i < N; i++) { L[i] *= k; R[i] *= k; }

  writeWav(join(OUT, 'audio.wav'), [L, R]);
  writeFileSync(
    join(OUT, 'timing.json'),
    JSON.stringify({ total: TOTAL, vo: VO_TIMES, shots: SHOTS, modeStabs: { abs: stabAbs, local: stabLocal } }, null, 2)
  );
  console.log(`audio.wav  ${TOTAL.toFixed(2)}s  peak ${(peak * k).toFixed(3)}`);
  console.log('mode stabs (abs):', stabAbs.map((x) => x.toFixed(2)).join(', '));
}

build();
