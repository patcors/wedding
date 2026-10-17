import assert from 'node:assert/strict';
import test from 'node:test';
import { cameraPose } from '../src/components/garden/cameraRig.ts';
import { MILESTONES, ROOM, progressAt, stillProgress } from '../src/components/garden/journey.ts';
import { GARDEN_CAMERA, MOBILE_RIVER_WIDTH, bankEdge, riverCenter } from '../src/components/garden/gardenGeometry.ts';
import { cameraHeading, eggTime, heightAt, inView, overRiver } from '../src/components/garden/eggs/egg.ts';

const degrees = radians => radians * 180 / Math.PI;
const trip = MILESTONES.find(m => m.egg === 'balloon');

test('an egg\'s clock starts on its date and runs with the scroll', () => {
  const at = progressAt(trip.month);
  assert.equal(eggTime(trip, at, false, 1.4), 0);
  assert.ok(Math.abs(eggTime(trip, at + ROOM, false, 1.4) - 1) < 1e-9);
  assert.ok(eggTime(trip, at - ROOM / 2, false, 1.4) < 0);
});

test('under reduced motion an egg rests at its settled pose on its milestone\'s still', () => {
  const still = stillProgress(progressAt(trip.month) + ROOM);
  assert.equal(eggTime(trip, still, true, 1.4), 1.4);
});

test('a spot in view sits at its bearing and distance from the camera', () => {
  for (const width of [1, MOBILE_RIVER_WIDTH]) {
    for (const p of [.2, .6, .85]) {
      const [cx, , cz] = cameraPose(p, width).position;
      const [x, y, z] = inView(p, width, { distance: 20, bearing: 6, height: 7 });
      assert.ok(Math.abs(Math.hypot(x - cx, z - cz) - 20) < 1e-9);
      assert.equal(y, 7);
      const bearing = degrees(Math.atan2(x - cx, cz - z) - cameraHeading(p, width));
      assert.ok(Math.abs(bearing - 6) < 1e-6, `bearing ${bearing} at ${p}`);
      // Holding the heading from an earlier progress leaves the camera's turning out.
      const [hx, , hz] = inView(p, width, { distance: 20, from: .5, follow: 0 });
      assert.ok(Math.abs(Math.atan2(hx - cx, cz - hz) - cameraHeading(.5, width)) < 1e-9);
    }
  }
  assert.ok(Math.abs(heightAt(10, 45) - (GARDEN_CAMERA.height + 10)) < 1e-9);
});

test('overRiver keeps a point over the water', () => {
  const z = -140, middle = riverCenter(z), reach = bankEdge(z) * .5;
  assert.equal(overRiver([middle + 50, 3, z], 1, .5)[0], middle + reach);
  assert.equal(overRiver([middle - 50, 3, z], 1, .5)[0], middle - reach);
  assert.equal(overRiver([middle + .1, 3, z], 1, .5)[0], middle + .1);
});
