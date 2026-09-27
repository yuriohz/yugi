import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

let cached = null;
export function ffmpegPath() {
  if (cached) return cached;
  try {
    cached = require('@ffmpeg-installer/ffmpeg').path;
  } catch {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
    cached = join(root, 'node_modules', '@ffmpeg-installer', 'linux-x64', 'ffmpeg');
  }
  return cached;
}
