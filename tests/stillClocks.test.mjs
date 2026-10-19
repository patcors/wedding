import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Reduced motion shows a still at each milestone, so every decorative clock in
// the scene (wind in the trees and grass, the water, flags, bobbing, eggs'
// idle motion) must hold while `paused`, which GardenScene sets for reduced
// motion as well as the guest's own pause. Otherwise a still would show
// whatever point in its sway the scene's first few frames reached, and differ
// from one load to the next.
const GARDEN = new URL('../src/components/garden/', import.meta.url).pathname;
// Clocks that step with frames but never run in a still, and why.
const EXEMPT = {
  'GardenButterfly.tsx': 'the page\'s butterflies, which reduced motion doesn\'t release',
  'VoyageCamera.tsx': 'the finale\'s flight, which never starts under reduced motion',
  'journeyPace.ts': '"The next chapter"\'s glide, a cut under reduced motion',
  'boatPhysics.ts': 'guest-launched boats, whose advance() returns at once while paused',
};
const files = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
  entry.isDirectory() ? files(join(dir, entry.name)) : /\.(ts|tsx)$/.test(entry.name) ? [join(dir, entry.name)] : []);
const CLOCK = /(\+=\s*(Math\.min\()?(dt|delta|step)\b)|\.value\s*\+=/;

test('every clock that steps with drawn frames holds while paused (and so under reduced motion)', () => {
  let clocks = 0;
  for (const file of files(GARDEN)) {
    const name = file.slice(GARDEN.length);
    if (EXEMPT[name.split('/').pop()]) continue;
    const source = readFileSync(file, 'utf8');
    // A frame's `step` that is 0 while paused, as the eggs keep it.
    const heldStep = /\bstep\s*=\s*paused\s*\?\s*0\b/.test(source);
    source.split('\n').forEach((line, i) => {
      if (!CLOCK.test(line) || line.trim().startsWith('//')) return;
      clocks++;
      const held = /\bpaused\b/.test(line) || (/\bstep\b/.test(line) && heldStep);
      assert.ok(held, `${name}:${i + 1} steps a clock without holding it while paused: ${line.trim()}`);
    });
  }
  assert.ok(clocks > 15, `found the scene's clocks (${clocks})`);
});

test('the scene pauses its decorative motion under reduced motion as well as the guest\'s own pause', () => {
  const scene = readFileSync(join(GARDEN, 'GardenScene.tsx'), 'utf8');
  assert.match(scene, /const still = paused \|\| reduced;/);
  assert.match(scene, /const slot: SlotProps = \{ paused: still,/);
});
