// Keep the authoring originals; ship only these versioned derivatives to /garden.
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, writeFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'public/garden-assets');
await mkdir(output, { recursive: true });
for (const family of ['cormorant-garamond', 'montserrat']) {
  await copyFile(resolve(root, `node_modules/@fontsource-variable/${family}/LICENSE`), resolve(output, `${family}-LICENSE.txt`));
}
const manifest = {};
let originalBytes = 0, optimizedBytes = 0;
for (const directory of ['photos', 'textures/garden', 'models/garden']) {
  for (const file of (await readdir(resolve(root, 'public', directory))).sort()) {
    if (!/\.(jpg|webp|glb)$/.test(file)) continue;
    const source = `${directory}/${file}`;
    const original = await readFile(resolve(root, 'public', source));
    const model = file.endsWith('.glb');
    const normal = file.includes('normal');
    // Use a higher quality for normal maps; leaf alpha stays exact.
    const data = model ? original : await sharp(original).rotate()
      .resize({ width: directory === 'photos' ? 640 : 512, withoutEnlargement: true })
      .webp(normal ? { quality: 95 } : { quality: directory === 'photos' ? 82 : 88, alphaQuality: 100 })
      .toBuffer();
    const hash = createHash('sha256').update(data).digest('hex').slice(0, 12);
    const name = `${file.replace(/\.[^.]+$/, '')}.${hash}.${model ? 'glb' : 'webp'}`;
    await writeFile(resolve(output, name), data);
    manifest[source] = `garden-assets/${name}`;
    originalBytes += original.length; optimizedBytes += data.length;
  }
}
await writeFile(resolve(root, 'src/components/garden/gardenAssets.generated.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Garden assets: ${originalBytes.toLocaleString()} → ${optimizedBytes.toLocaleString()} bytes (including prebuilt trees).`);
// Prune only generated derivatives; never touch the authoring originals.
const current = new Set(Object.values(manifest).map(path => path.split('/').pop()));
for (const name of await readdir(output)) {
  if (/\.[a-f0-9]{12}\.(webp|glb)$/.test(name) && !current.has(name)) await unlink(resolve(output, name));
}
