import assert from 'node:assert/strict';
import test from 'node:test';
import { cameraPose } from '../src/components/garden/cameraRig.ts';
import { MILESTONES, ROOM, VOYAGE_END, progressAt, stillProgress } from '../src/components/garden/journey.ts';
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

test('the balloon climbs straight up over the river, left of the date label, and is gone well before the dock', async () => {
  const { BALLOON_TIMES, balloonSpot } = await import('../src/components/garden/eggs/balloonCourse.ts');
  const at = progressAt(trip.month);
  for (const [mobile, width] of [[false, 1], [true, MOBILE_RIVER_WIDTH]]) {
    let last = -Infinity;
    for (let t = 0; t <= BALLOON_TIMES.climb; t += .1) {
      const p = at + t * ROOM, { position: [x, y, z] } = balloonSpot(p, t, mobile, width);
      assert.ok(Math.abs(x - riverCenter(z, width)) < bankEdge(z, width), `over the water at ${t}`);
      assert.ok(y >= last, `rising at ${t}`);
      last = y;
      const [cx, , cz] = cameraPose(p, width).position;
      const bearing = degrees(Math.atan2(x - cx, cz - z) - cameraHeading(p, width));
      assert.ok(bearing < -7.5 && bearing > -12, `bearing ${bearing} at ${t}`);
    }
  }
  assert.ok(at + BALLOON_TIMES.gone * ROOM < VOYAGE_END - .05);
});

const meet = MILESTONES.find(m => m.egg === 'university');
// Degrees right of the middle of the picture, and distance, of a point from the camera at p.
const seen = (p, width, x, z) => {
  const [cx, , cz] = cameraPose(p, width).position;
  return { bearing: degrees(Math.atan2(x - cx, cz - z) - cameraHeading(p, width)), distance: Math.hypot(x - cx, z - cz) };
};
// Half the picture's width in degrees: desktop at 16:10, portrait at 390 × 844.
const halfView = width => degrees(width < 1 ? Math.atan(Math.tan(34 * Math.PI / 180) * 390 / 844) : Math.atan(Math.tan(24 * Math.PI / 180) * 1.6));

test('the π stands on the bank, in view from the meeting until the boats are well on their way', async () => {
  const { piSpot } = await import('../src/components/garden/eggs/campus.ts');
  assert.equal(meet.month, '2017-07');
  for (const [mobile, width] of [[false, 1], [true, MOBILE_RIVER_WIDTH]]) {
    const { x, z } = piSpot(mobile, width);
    assert.ok(Math.abs(x - riverCenter(z, width)) > bankEdge(z, width) + .3, 'on land, clear of the water');
    // In view, a little in from the edge, from the date through the first trip away.
    for (let p = progressAt(meet.month); p <= progressAt('2017-11') + ROOM * .35; p += .005) {
      const { bearing } = seen(p, width, x, z);
      assert.ok(Math.abs(bearing) < halfView(width) - 3, `bearing ${bearing} at ${p}`);
    }
  }
});

test('the ducks plop in while the meeting\'s date holds, keep to the water and drift downstream past the boats', async () => {
  const { DUCKS, duckOnWater, duckLaunchSpot } = await import('../src/components/garden/eggs/campus.ts');
  const hold = .35 * meet.room;
  for (const width of [1, MOBILE_RIVER_WIDTH]) {
    DUCKS.launches.forEach(({ at }, i) => {
      assert.ok(at > 0 && at < hold, 'launched while the date holds');
      const from = duckLaunchSpot(i, width);
      assert.ok(Math.abs(from.x - riverCenter(from.z, width)) > bankEdge(from.z, width), 'thrown from the bank');
      let last = Infinity;
      for (let t = at; t <= DUCKS.gone; t += .1) {
        const { x, z } = duckOnWater(i, t, width);
        assert.ok(Math.abs(x - riverCenter(z, width)) < bankEdge(z, width) - .1, `on the water at ${t}`);
        assert.ok(z <= last, 'drifting downstream');
        last = z;
      }
      // Gone only once the camera has passed it.
      const p = progressAt(meet.month) + DUCKS.gone * ROOM;
      assert.ok(cameraPose(p, width).position[2] < duckOnWater(i, DUCKS.gone, width).z, `duck ${i} passed`);
    });
    // Under reduced motion they all float in view at the meeting's still.
    const still = stillProgress(progressAt(meet.month) + ROOM * .2);
    assert.equal(eggTime(meet, still, true, DUCKS.settled), DUCKS.settled);
    DUCKS.launches.forEach(({ at }, i) => {
      assert.ok(at < DUCKS.settled);
      const { x, z } = duckOnWater(i, DUCKS.settled, width);
      assert.ok(Math.abs(seen(still, width, x, z).bearing) < halfView(width) - 2);
    });
  }
});
