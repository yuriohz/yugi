import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', 'out');

// Absolute start time of each voice line, in seconds. Hand-placed for breath
// between lines; every line is placed after the previous one ends.
export const VO_TIMES = {
  '01': 1.00,
  '02': 3.70,
  '03': 5.95,
  '04': 8.10,
  '05': 11.20,
  '06': 15.55,
  '07': 21.35,
  '08': 25.65,
  '09': 29.35,
};

export const SHOTS = [
  { id: 'coldopen', start: 0.00, end: 3.60 },
  { id: 'impact', start: 3.60, end: 5.70 },
  { id: 'wordmark', start: 5.70, end: 7.90 },
  { id: 'select', start: 7.90, end: 11.00 },
  { id: 'rewrite', start: 11.00, end: 15.30 },
  { id: 'modes', start: 15.30, end: 21.10 },
  { id: 'fidelity', start: 21.10, end: 25.40 },
  { id: 'control', start: 25.40, end: 29.10 },
  { id: 'outro', start: 29.10, end: 35.60 },
];

export const TOTAL = SHOTS[SHOTS.length - 1].end;
export const FPS = 30;
export const TRANSITION = 0.26;

export function voLines() {
  return JSON.parse(readFileSync(join(OUT, 'vo-lines.json'), 'utf8'));
}

// local (scene-relative) times at which each mode name is spoken in line 06
export function modeBeats() {
  const f = join(OUT, 'vo-06-beats.json');
  if (existsSync(f)) return JSON.parse(readFileSync(f, 'utf8'));
  return [0.39, 1.29, 2.17, 2.98, 4.59];
}

export const shotAt = (t) => SHOTS.find((s) => t >= s.start && t < s.end) ?? SHOTS[SHOTS.length - 1];
export const shotIndexAt = (t) => {
  for (let i = 0; i < SHOTS.length; i++) if (t >= SHOTS[i].start && t < SHOTS[i].end) return i;
  return SHOTS.length - 1;
};
