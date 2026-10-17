import assert from 'node:assert/strict';
import test from 'node:test';
import { DAWN, DAY, DUSK, SKY_KEYS, contrast, hex, skyAt } from '../src/components/garden/skyCycle.ts';
import { ARRIVAL_END, DATES, DOCKED, VOYAGE_END, progressAt, stillProgress } from '../src/components/garden/journey.ts';

const looks = (p, key) => {
  const sky = skyAt(p);
  for (const name of ['horizon', 'zenith', 'glow', 'ink', 'hemiSky', 'hemiGround', 'sunColor', 'water', 'glint']) assert.equal(hex(sky[name]), key[name], `${name} at ${p}`);
  assert.ok(Math.abs(sky.hemi - key.hemi) < 1e-9 && Math.abs(sky.sunIntensity - key.sunIntensity) < 1e-9);
  sky.sun.forEach((v, i) => assert.ok(Math.abs(v / Math.hypot(...sky.sun) - key.sun[i] / Math.hypot(...key.sun)) < 1e-9));
};

test('the keyframes run forward through the journey', () => {
  for (let i = 1; i < SKY_KEYS.length; i++) assert.ok(SKY_KEYS[i][0] > SKY_KEYS[i - 1][0]);
  assert.deepEqual([SKY_KEYS[0][0], SKY_KEYS.at(-1)[0]], [0, 1]);
});

test('dawn under the title, the old misty daylight through the middle, dusk at the dock', () => {
  for (const p of [0, ARRIVAL_END / 2]) looks(p, DAWN);
  for (const p of [.25, .5, progressAt(DATES.engaged)]) looks(p, DAY);
  for (const p of [VOYAGE_END, DOCKED, 1]) looks(p, DUSK);
});

test('the sun sinks towards dusk and shadows lengthen', () => {
  const elevation = p => { const [x, y, z] = skyAt(p).sun; return Math.atan2(y, Math.hypot(x, z)); };
  for (let p = progressAt(DATES.engaged); p < 1; p += .005) assert.ok(elevation(p + .005) <= elevation(p) + 1e-9, `rises at ${p}`);
  assert.ok(elevation(1) < elevation(.5) / 2);
});

test('the copy stays legible on its glow all the way through, and still views show their moment', () => {
  for (let p = 0; p <= 1; p += .002) {
    const sky = skyAt(p);
    assert.ok(contrast(sky.ink, sky.glow) > 8.5, `ink on glow at ${p.toFixed(3)}`);
  }
  assert.equal(hex(skyAt(stillProgress(0)).horizon), DAWN.horizon);
  assert.equal(hex(skyAt(stillProgress(.99)).horizon), DUSK.horizon);
});
