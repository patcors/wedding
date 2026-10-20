import assert from 'node:assert/strict';
import test from 'node:test';
import { MOBILE_RIVER_WIDTH, bankEdge, launchJetties, lawnSpot, pointSpot, riverCenter, voyageLandmarks } from '../src/components/garden/gardenGeometry.ts';

// The river's shape is worked out once per width and kept (gardenGeometry.ts,
// perWidth and the last-answer caches), so the scene starts sooner; the
// answers must be the same however the calls interleave.
const centre = (z, width) => (Math.sin(z * .12 + .7) * 1.15 + Math.sin(z * .26 - 1.2) * .25) * width;

test('the river\'s centre and banks answer for the z and width asked, whatever was asked before', () => {
  const zs = [12, 12, -40, 12, -40.5, -160, -160];
  const fresh = zs.flatMap(z => [1, MOBILE_RIVER_WIDTH].map(width => [riverCenter(z, width), bankEdge(z, width)]));
  // Asked again in another order, with the widths alternating on the same z.
  const again = zs.flatMap(z => [1, MOBILE_RIVER_WIDTH].map(width => [riverCenter(z, width), bankEdge(z, width)]));
  assert.deepEqual(again, fresh);
  assert.notEqual(riverCenter(-40, 1), riverCenter(-40, MOBILE_RIVER_WIDTH));
  // Far from the phone's opening bend and the S-bend, the centre is the plain sum of its waves.
  assert.ok(Math.abs(riverCenter(-60, 1) - centre(-60, 1)) < 1e-12);
});

test('the places that depend only on the width are each worked out once for it', () => {
  for (const width of [1, MOBILE_RIVER_WIDTH]) {
    assert.equal(voyageLandmarks(width), voyageLandmarks(width));
    assert.equal(launchJetties(width), launchJetties(width));
    assert.equal(lawnSpot(width), lawnSpot(width));
    assert.equal(pointSpot(width), pointSpot(width));
  }
  assert.notDeepEqual(voyageLandmarks(1), voyageLandmarks(MOBILE_RIVER_WIDTH));
  assert.deepEqual(voyageLandmarks(), voyageLandmarks(1));
});
