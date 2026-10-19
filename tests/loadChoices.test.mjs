import assert from 'node:assert/strict';
import test from 'node:test';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { PREPARE, TEXTURE_WEIGHT, prepareWhen, textureUrl, textureWeight } from '../src/components/garden/loadChoices.ts';

const pub = new URL('../public/', import.meta.url).pathname;
const maps = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
  entry.isDirectory() ? maps(join(dir, entry.name)) : /\.(webp|jpg)$/.test(entry.name) ? [join(dir, entry.name)] : []);

test('guests get the light textures, and the scene prepares once downloaded', () => {
  assert.equal(TEXTURE_WEIGHT, 'light');
  assert.equal(PREPARE, 'downloaded');
  assert.equal(textureWeight(null), 'light');
  assert.equal(textureWeight('original'), 'original');
  assert.equal(prepareWhen('nonsense'), 'downloaded');
  assert.equal(prepareWhen('butterflies'), 'butterflies');
});

test('a scene map downloads from its light copy, half size on a phone', () => {
  const url = '/models/garden/ground/grass007-normal.webp';
  assert.equal(textureUrl(url, '/', 'light', false), '/light/models/garden/ground/grass007-normal.webp');
  assert.equal(textureUrl(url, '/', 'light', true), '/light-phone/models/garden/ground/grass007-normal.webp');
  assert.equal(textureUrl(url, '/', 'original', true), url);
  assert.equal(textureUrl('/textures/garden/water-normal.jpg', '/', 'light', false), '/light/textures/garden/water-normal.jpg');
  // The eggs' logos and anything outside the garden's folders are left alone.
  assert.equal(textureUrl('/textures/garden/uow-shield.png', '/', 'light', false), '/textures/garden/uow-shield.png');
  assert.equal(textureUrl('/photos/IMG_0466.jpg', '/', 'light', false), '/photos/IMG_0466.jpg');
});

test('every scene map has a lighter copy and a smaller one for phones', () => {
  const originals = ['models/garden', 'textures/garden'].flatMap(dir => maps(join(pub, dir)));
  assert.ok(originals.length >= 15);
  for (const path of originals) {
    const name = relative(pub, path), size = statSync(path).size;
    const light = statSync(join(pub, 'light', name)).size, phone = statSync(join(pub, 'light-phone', name)).size;
    assert.ok(light < size, `${name}: light copy is no smaller`);
    assert.ok(phone < light, `${name}: phone copy is no smaller`);
  }
});
