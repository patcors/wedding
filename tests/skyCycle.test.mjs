import assert from 'node:assert/strict';
import test from 'node:test';
import { AFTERNOON, DAWN, DUSK, MIDDAY, MIST_DAWN, MIST_DAY, MIST_KEYS, MORNING, SKY_KEYS, WATERS, contrast, duskAt, hex, lampsAt, skyAt, waterIn } from '../src/components/garden/skyCycle.ts';
import { ARRIVAL_END, DATES, DOCKED, MILESTONES, VOYAGE_END, progressAt, stillProgress } from '../src/components/garden/journey.ts';

const looks = (p, key, keys) => {
  const sky = skyAt(p, keys);
  for (const name of ['horizon', 'zenith', 'glow', 'ink', 'hemiSky', 'hemiGround', 'sunColor', 'glint']) assert.equal(hex(sky[name]), key[name], `${name} at ${p}`);
  assert.ok(Math.abs(sky.hemi - key.hemi) < 1e-9 && Math.abs(sky.sunIntensity - key.sunIntensity) < 1e-9 && Math.abs(sky.haze - key.haze) < 1e-9);
  sky.sun.forEach((v, i) => assert.ok(Math.abs(v / Math.hypot(...sky.sun) - key.sun[i] / Math.hypot(...key.sun)) < 1e-9));
};
const rgb = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16) / 255);
const angles = p => { const [x, y, z] = skyAt(p).sun; return { azimuth: Math.atan2(x, z), elevation: Math.atan2(y, Math.hypot(x, z)) }; };
const blueness = c => c[2] - (c[0] + c[1]) / 2;

test('the keyframes run forward through the journey', () => {
  for (const keys of [SKY_KEYS, MIST_KEYS]) {
    for (let i = 1; i < keys.length; i++) assert.ok(keys[i][0] > keys[i - 1][0]);
    assert.deepEqual([keys[0][0], keys.at(-1)[0]], [0, 1]);
  }
});

test('dawn under the title, a light blue morning by the meeting, clear midday, deeper blue afternoon, dusk at the dock', () => {
  for (const p of [0, ARRIVAL_END / 3]) looks(p, DAWN);
  looks(progressAt(DATES.meet), MORNING);
  looks(progressAt('2020-08'), MIDDAY);
  looks(progressAt(DATES.dating), AFTERNOON);
  for (const p of [VOYAGE_END, DOCKED, 1]) looks(p, DUSK);
  // Blue overhead all day, and deepening from morning into the afternoon.
  for (const key of [MORNING, MIDDAY, AFTERNOON]) assert.ok(blueness(rgb(key.zenith)) > .2 && blueness(rgb(key.horizon)) > .1);
  const value = c => Math.max(...rgb(c));
  assert.ok(value(MORNING.zenith) > value(MIDDAY.zenith) && value(MIDDAY.zenith) > value(AFTERNOON.zenith));
});

test('the light never stands still between the title and the dock', () => {
  // Every stretch of a third of a milestone's scroll moves the sky visibly.
  const step = (VOYAGE_END - ARRIVAL_END * .4) / 60;
  for (let p = ARRIVAL_END * .4; p < VOYAGE_END - 1e-9; p += step) {
    const a = skyAt(p), b = skyAt(p + step);
    const moved = Math.max(...['zenith', 'horizon'].flatMap(name => a[name].map((v, i) => Math.abs(v - b[name][i]))));
    assert.ok(moved > 1.5 / 255 || Math.abs(angles(p).azimuth - angles(p + step).azimuth) > .02, `the sky stands still at ${p.toFixed(3)}`);
  }
});

test('the sun climbs to midday then sinks towards dusk, swinging across the sky so shadows turn as they lengthen', () => {
  const noon = progressAt('2020-08');
  for (let p = 0; p < 1; p += .005) {
    if (p + .005 <= noon) assert.ok(angles(p + .005).elevation >= angles(p).elevation - 1e-9, `sinks at ${p}`);
    else if (p >= noon) assert.ok(angles(p + .005).elevation <= angles(p).elevation + 1e-9, `rises at ${p}`);
    assert.ok(angles(p + .005).azimuth <= angles(p).azimuth + 1e-9, `swings back at ${p}`);
  }
  assert.ok(angles(noon).elevation > Math.PI / 4 && angles(1).elevation < angles(noon).elevation / 2);
  assert.ok(angles(0).azimuth - angles(1).azimuth > Math.PI * .75, 'the sun crosses the sky');
});

test('the copy stays legible on its glow all the way through, and still views show their moment', () => {
  for (const keys of [SKY_KEYS, MIST_KEYS]) for (let p = 0; p <= 1; p += .002) {
    const sky = skyAt(p, keys);
    assert.ok(contrast(sky.ink, sky.glow) > 8.5, `ink on glow at ${p.toFixed(3)}`);
    // The glow is a paler wash of the sky's own colour, not a fixed white:
    // tinted the same way as the horizon, and at least a quarter as strongly.
    const tint = c => { const mean = (c[0] + c[1] + c[2]) / 3; return c.map(v => v - mean); };
    const [h, g] = [tint(sky.horizon), tint(sky.glow)], length = c => Math.hypot(...c);
    if (length(h) > .04) assert.ok(h.reduce((sum, v, i) => sum + v * g[i], 0) / length(h) / length(g) > .8 && length(g) > length(h) / 4, `glow strays from the sky at ${p.toFixed(3)}`);
  }
  assert.equal(hex(skyAt(stillProgress(0)).horizon), DAWN.horizon);
  assert.equal(hex(skyAt(stillProgress(.99)).horizon), DUSK.horizon);
  // Each milestone's still has its own light.
  const stills = new Set(MILESTONES.map(m => hex(skyAt(stillProgress(progressAt(m.month) + .01)).zenith)));
  assert.equal(stills.size, MILESTONES.length);
});

test('the old misty day is kept for the Review panel, sage river and all', () => {
  looks(0, MIST_DAWN, MIST_KEYS);
  for (const p of [.25, .5, progressAt(DATES.engaged)]) looks(p, MIST_DAY, MIST_KEYS);
  assert.equal(hex(waterIn(skyAt(0, MIST_KEYS), 'sage')), '#bab9ad');
  assert.equal(hex(waterIn(skyAt(.5, MIST_KEYS), 'sage')), '#b5bca6');
  assert.equal(hex(waterIn(skyAt(1, MIST_KEYS), 'sage')), '#9a98a8');
});

test('every water follows the day, warming in the golden light and dimming at dusk', () => {
  for (const water of Object.keys(WATERS)) {
    const [noon, dusk] = [waterIn(skyAt(progressAt('2020-08')), water), waterIn(skyAt(1), water)];
    assert.equal(hex(noon), WATERS[water].color);
    assert.ok(dusk[1] < noon[1] && dusk[0] / dusk[2] > noon[0] / noon[2] - 1e-9, `${water} at dusk`);
  }
});

test('the lamps come up with the dusk, before the dock', () => {
  assert.equal(lampsAt(progressAt('2026-07')), 0);
  for (let p = .5; p < 1; p += .005) {
    assert.ok(lampsAt(p + .005) >= lampsAt(p) - 1e-9, `dims at ${p}`);
    if (duskAt(p) < .3) assert.equal(lampsAt(p), 0, `lit in the golden light at ${p}`);
  }
  assert.equal(lampsAt(VOYAGE_END), 1);
  assert.ok(lampsAt(VOYAGE_END - .03) > .5, 'lit as the tree comes round the bend');
});
