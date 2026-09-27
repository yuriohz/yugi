import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const dir = join(root, 'assets', 'fonts');

// Fontsource ships woff2; resvg needs a raw sfnt (ttf/otf). Decompress once, cache on disk.
const SOURCES = [
  ['Inter-400', '@fontsource/inter/files/inter-latin-400-normal.woff2'],
  ['Inter-500', '@fontsource/inter/files/inter-latin-500-normal.woff2'],
  ['Inter-600', '@fontsource/inter/files/inter-latin-600-normal.woff2'],
  ['Inter-700', '@fontsource/inter/files/inter-latin-700-normal.woff2'],
  ['Inter-800', '@fontsource/inter/files/inter-latin-800-normal.woff2'],
  ['Inter-900', '@fontsource/inter/files/inter-latin-900-normal.woff2'],
  ['Serif-400', '@fontsource/source-serif-4/files/source-serif-4-latin-400-normal.woff2'],
  ['Serif-600', '@fontsource/source-serif-4/files/source-serif-4-latin-600-normal.woff2'],
  ['Serif-700', '@fontsource/source-serif-4/files/source-serif-4-latin-700-normal.woff2'],
  ['Serif-400i', '@fontsource/source-serif-4/files/source-serif-4-latin-400-italic.woff2'],
  ['Serif-700i', '@fontsource/source-serif-4/files/source-serif-4-latin-700-italic.woff2'],
];

export async function ensureFonts() {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const { decompress } = await import('wawoff2');
  const files = [];
  for (const [name, rel] of SOURCES) {
    const out = join(dir, `${name}.ttf`);
    if (!existsSync(out) || process.env.WS_FORCE_FONTS === '1') {
      const src = join(root, 'node_modules', rel);
      const ttf = await decompress(readFileSync(src));
      writeFileSync(out, ttf);
    }
    files.push(out);
  }
  return files;
}

// family name as embedded in the ttf, used by resvg/fontdb matching
export const FONT_FILES = await ensureFonts();
export const SANS = 'Inter';
export const SERIF = 'Source Serif 4';
