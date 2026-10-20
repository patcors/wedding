import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, statSync } from 'node:fs';
import sharp from 'sharp';

// The flags' marks download as lossless WebP (scripts/compress-flag-marks.mjs):
// the same picture as each source PNG, at most 512px, in fewer bytes.
const pub = new URL('../public/', import.meta.url).pathname;
const boats = readFileSync(new URL('../src/components/garden/VoyageBoats.tsx', import.meta.url), 'utf8');
const marks = [...boats.matchAll(/mark: '([\w-]+)\.webp'/g)].map(m => m[1]);

test('every flag names a WebP mark under textures/flags', () => {
  assert.deepEqual(marks.sort(), ['finocomp-mark', 'heirwealth-crown', 'uow-shield', 'wavves-mark']);
  assert.match(boats, /textures\/flags\/\$\{mark\}/);
  assert.doesNotMatch(boats, /mark: '[\w-]+\.png'/);
});

test('each WebP is its PNG, pixel for pixel where it shows, and smaller', async () => {
  for (const name of marks) {
    const png = `${pub}textures/garden/${name}.png`, webp = `${pub}textures/flags/${name}.webp`;
    const [a, b] = await Promise.all([png, webp].map(file => sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })));
    assert.deepEqual([b.info.width, b.info.height], [a.info.width, a.info.height], name);
    assert.ok(Math.max(b.info.width, b.info.height) <= 512, name);
    // Premultiplied, so the colour under fully clear pixels (which never shows) doesn't count.
    for (let i = 0; i < a.data.length; i += 4) for (let c = 0; c < 4; c++) {
      const pa = c === 3 ? a.data[i + 3] : a.data[i + c] * a.data[i + 3], pb = c === 3 ? b.data[i + 3] : b.data[i + c] * b.data[i + 3];
      if (pa !== pb) assert.fail(`${name} differs at pixel ${i / 4}`);
    }
    assert.ok(statSync(webp).size < statSync(png).size * .7, name);
  }
});
