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

const snow = MILESTONES.find(m => m.egg === 'snow-2019');

test('a flurry builds as the date shows, hides the bank while the snowman appears, and clears while the date holds', async () => {
  const { FLURRY, flurryAt, revealed } = await import('../src/components/garden/eggs/flurry.ts');
  assert.equal(snow.month, '2019-07');
  assert.equal(flurryAt(0), 0);
  assert.equal(flurryAt(FLURRY.full), 1);
  assert.equal(flurryAt(FLURRY.clear), 1);
  assert.equal(flurryAt(FLURRY.gone), 0);
  // Nothing to see coming: it appears only once the flurry is at its thickest.
  for (let t = -1; t < FLURRY.reveal; t += .01) assert.ok(!revealed(t), `hidden at ${t}`);
  for (let t = FLURRY.reveal; t <= FLURRY.clear; t += .01) assert.equal(flurryAt(t), 1);
  // Revealed within the date's hold, and the air clear within the share.
  assert.ok(FLURRY.clear < .35 && FLURRY.gone < 1);
  // Reduced motion rests after it, with the snowman out and the air clear.
  const still = stillProgress(progressAt(snow.month) + ROOM * .2);
  const t = eggTime(snow, still, true, 1);
  assert.ok(revealed(t) && flurryAt(t) === 0);
});

test('the 2019 snowman stands on the bank, in view as its date holds and for a share after', async () => {
  const { SNOW_SPOTS, snowSpot } = await import('../src/components/garden/eggs/flurry.ts');
  for (const width of [1, MOBILE_RIVER_WIDTH]) {
    const { x, z, yaw } = snowSpot(SNOW_SPOTS[2019], snow.month, width);
    assert.ok(Math.abs(x - riverCenter(z, width)) > bankEdge(z, width), 'on land');
    for (let t = 0; t <= 1; t += .05) {
      const p = progressAt(snow.month) + t * ROOM, { bearing } = seen(p, width, x, z);
      assert.ok(Math.abs(bearing) < halfView(width) - 3, `bearing ${bearing} at ${t}`);
    }
    // Turned to face the boats coming down the river.
    const [cx, , cz] = cameraPose(progressAt(snow.month), width).position;
    assert.ok(Math.abs(Math.atan2(cx - x, cz - z) - yaw) < .3);
  }
});

const graduation = MILESTONES.find(m => m.egg === 'graduation');
const onLand = (x, z, width) => Math.abs(x - riverCenter(z, width)) > bankEdge(z, width);

test('the mortarboards are tossed straight up off the boats while the date holds and land on their own banks', async () => {
  const { CAPS, capInAir, capLanding, capLaunch } = await import('../src/components/garden/eggs/capToss.ts');
  const { groundHeight } = await import('../src/components/garden/gardenGeometry.ts');
  assert.equal(graduation.month, '2020-08');
  assert.deepEqual(CAPS.tosses.map(toss => toss.side), [-1, 1]);
  for (const width of [1, MOBILE_RIVER_WIDTH]) {
    for (const toss of CAPS.tosses) {
      assert.ok(toss.at > 0 && toss.at < .35, 'tossed while the date holds');
      const from = capLaunch(graduation.month, toss, width), to = capLanding(graduation.month, toss, width);
      assert.ok(!onLand(from.x, from.z, width), 'tossed from a boat on the water');
      assert.ok(onLand(to.x, to.z, width) && Math.sign(to.x - riverCenter(to.z, width)) === toss.side, 'lands on its own bank');
      assert.ok(groundHeight(to.x, to.z, width) > 0, 'above the waterline');
      // Straight up at first, well over the masthead, and down by the end of its flight.
      const early = capInAir(from, to, CAPS.flight * .15);
      assert.ok(early.y - from.y > 3 * Math.hypot(early.x - from.x, early.z - from.z));
      assert.ok(Math.max(...Array.from({ length: 21 }, (_, i) => capInAir(from, to, CAPS.flight * i / 20).y)) > 2.5);
      const down = capInAir(from, to, CAPS.flight);
      assert.ok(down.landed && Math.abs(down.y - to.y) < 1e-9 && down.turn === 1);
      // In view from its toss until it has lain on the bank for a while.
      for (let t = toss.at; t <= toss.at + .6; t += .05) {
        const { bearing } = seen(progressAt(graduation.month) + t * ROOM, width, to.x, to.z);
        assert.ok(Math.abs(bearing) < halfView(width) - 2, `bearing ${bearing} at ${t}`);
      }
    }
    // Lying clear of the 2019 snowman, still on the bank, and the year markers.
    const { SNOW_SPOTS, snowSpot } = await import('../src/components/garden/eggs/flurry.ts');
    const { YEAR_MARKERS, yearMarkerSpot } = await import('../src/components/garden/eggs/yearMarkerSpots.ts');
    const others = [snowSpot(SNOW_SPOTS[2019], snow.month, width), ...YEAR_MARKERS.map(marker => yearMarkerSpot(marker, width))];
    for (const toss of CAPS.tosses) {
      const to = capLanding(graduation.month, toss, width);
      for (const other of others) assert.ok(Math.hypot(other.x - to.x, other.z - to.z) > 2.5, 'clear of the other scenery');
    }
  }
  // Reduced motion shows both down at graduation's still.
  const still = stillProgress(progressAt(graduation.month) + ROOM * .2);
  assert.ok(CAPS.tosses.every(toss => eggTime(graduation, still, true, CAPS.settled) > toss.at));
});
