// Offline asset recipe: the flags' marks as guests download them. The PNGs in
// public/textures/garden/ are the sources; each is saved again as lossless
// WebP under public/textures/flags/, the same pixels and transparency (bar
// the colour under fully clear pixels, which never shows) at about half the
// bytes. Kept apart from textures/garden/, so lighten-garden-textures.mjs
// leaves them alone. Re-run after changing a mark:
//   node scripts/compress-flag-marks.mjs
import { mkdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const pub = fileURLToPath(new URL('../public/', import.meta.url));
export const FLAG_MARKS = ['finocomp-mark', 'wavves-mark', 'heirwealth-crown', 'uow-shield'];

await mkdir(`${pub}textures/flags`, { recursive: true });
let before = 0, after = 0;
for (const name of FLAG_MARKS) {
  const source = `${pub}textures/garden/${name}.png`, target = `${pub}textures/flags/${name}.webp`;
  const { width, height } = await sharp(source).metadata();
  if (Math.max(width, height) > 512) throw new Error(`${name} is ${width}×${height}; the flags draw at most 512px`);
  await sharp(source).webp({ lossless: true, effort: 6 }).toFile(target);
  before += (await stat(source)).size; after += (await stat(target)).size;
}
console.log(`flag marks: ${Math.round(before / 1024)} KB of PNG → ${Math.round(after / 1024)} KB of WebP`);
