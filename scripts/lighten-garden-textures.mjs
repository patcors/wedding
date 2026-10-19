// Offline asset recipe: the lighter copies of the Garden's textures that
// guests download (see gardenTextures.ts). The originals stay where they are,
// for the Review panel's "Original" textures. Each map is saved again at
// ordinary web quality under public/light/, and at half size under
// public/light-phone/ for phones, keeping its path and name.
import { mkdir, readdir, stat } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../', import.meta.url));
const pub = resolve(root, 'public');
const sources = ['models/garden', 'textures/garden'];

async function* maps(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) yield* maps(path);
    else if (/\.(webp|jpg)$/.test(entry.name)) yield path;
  }
}

// Normal maps show compression as faceting in the light, so they keep a little more.
const quality = (name) => /normal/.test(name) ? 82 : 76;

let before = 0, after = 0, phone = 0;
for (const source of sources) for await (const path of maps(resolve(pub, source))) {
  const name = relative(pub, path), q = quality(name);
  const { width } = await sharp(path).metadata();
  for (const [folder, size] of [['light', width], ['light-phone', Math.max(256, width / 2)]]) {
    const target = resolve(pub, folder, name);
    await mkdir(dirname(target), { recursive: true });
    const image = sharp(path).resize(size, size);
    await (name.endsWith('.jpg') ? image.jpeg({ quality: q, mozjpeg: true }) : image.webp({ quality: q, alphaQuality: 90, effort: 6 })).toFile(target);
    if (folder === 'light') after += (await stat(target)).size;
    else phone += (await stat(target)).size;
  }
  before += (await stat(path)).size;
}
const mb = (bytes) => (bytes / 1e6).toFixed(2) + ' MB';
console.log(`originals ${mb(before)}, light ${mb(after)}, light for phones ${mb(phone)}`);
