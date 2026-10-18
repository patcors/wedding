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
      assert.ok(bearing < -7.5 && bearing > -13, `bearing ${bearing} at ${t}`);
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
    // Amelia's snow trip, so on her bank, the left.
    assert.equal(Math.sign(x - riverCenter(z, width)), -1, 'on Amelia\'s bank');
    for (let t = 0; t <= 1; t += .05) {
      const p = progressAt(snow.month) + t * ROOM, { bearing } = seen(p, width, x, z);
      assert.ok(Math.abs(bearing) < halfView(width) - 3, `bearing ${bearing} at ${t}`);
    }
    // Turned to face the boats coming down the river.
    const [cx, , cz] = cameraPose(progressAt(snow.month), width).position;
    assert.ok(Math.abs(Math.atan2(cx - x, cz - z) - yaw) < .3);
  }
});

test('the eggs about Amelia alone stand on her bank, the left: the 2019 snowman and Sydney\'s duck', async () => {
  const { SNOW_SPOTS } = await import('../src/components/garden/eggs/flurry.ts');
  const { DUCK_STATUE } = await import('../src/components/garden/eggs/careerSpots.ts');
  assert.equal(SNOW_SPOTS[2019].side, -1);
  assert.equal(DUCK_STATUE.side, -1);
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

const apartments = MILESTONES.find(m => m.egg === 'apartments');

test('the birds tell the apartments: one each, his at hers while he renovates, home again, then both at his', async () => {
  const { AMELIA_MOVED_IN } = await import('../src/components/garden/journey.ts');
  const { NESTS, NEST_EVENTS, PATRICK_HOME, birdPoses, fired, nestSpots, nestTriggers, perchPoint } = await import('../src/components/garden/eggs/nesting.ts');
  assert.equal(apartments.month, '2024-05');
  assert.equal(AMELIA_MOVED_IN, '2025-06');
  assert.ok(MILESTONES.every(m => m.month !== AMELIA_MOVED_IN), 'moving in is not a milestone');
  const living = MILESTONES.find(m => m.id === 'living-together');
  assert.deepEqual([...new Set(NEST_EVENTS.map(e => e.month))], [apartments.month, living.month, PATRICK_HOME, AMELIA_MOVED_IN]);
  for (const width of [1, MOBILE_RIVER_WIDTH]) {
    const spots = nestSpots(width), triggers = nestTriggers(width);
    for (let i = 1; i < triggers.length; i++) assert.ok(triggers[i] >= triggers[i - 1], 'in order');
    // Where each bird is once the first n events are done.
    const after = n => birdPoses(NEST_EVENTS.map((_, i) => i < n ? 99 : null), spots);
    const at = (pose, pair, house, spot) => Math.hypot(pose.x - perchPoint(spots[pair][house], spot).x, pose.y - perchPoint(spots[pair][house], spot).y) < 1e-9;
    const expect = [
      [2, 0, { amelia: 'amelia', patrick: 'patrick' }],
      [3, 0, { amelia: 'amelia', patrick: 'amelia' }],
      [4, 0, { amelia: 'amelia', patrick: 'patrick' }],
      [5, 1, { amelia: 'amelia', patrick: 'patrick' }],
      [6, 1, { amelia: 'patrick', patrick: 'patrick' }],
    ];
    for (const [n, pair, homes] of expect) {
      const poses = after(n)[pair];
      for (const owner of ['amelia', 'patrick']) {
        assert.ok(poses[owner].shown && poses[owner].flying === 0, `${owner} perched after ${n}`);
        assert.ok(at(poses[owner], pair, homes[owner], homes[owner] === owner ? 'home' : 'guest'), `${owner} at ${homes[owner]}'s after ${n}`);
      }
    }
    // Nobody in the first pair before they fly in.
    assert.ok(!after(1)[0].amelia.shown && !after(1)[0].patrick.shown);
    // Mid-flight a bird is off its perches, up in the air.
    const flying = birdPoses(NEST_EVENTS.map((_, i) => i < 2 ? 99 : i === 2 ? NESTS.flight / 2 : null), spots)[0].patrick;
    assert.ok(flying.flying > .9 && flying.y > perchPoint(spots[0].amelia, 'guest').y);
    // Each house stands on the bank (or on a post at its edge), clear of the year markers.
    const { YEAR_MARKERS, yearMarkerSpot } = await import('../src/components/garden/eggs/yearMarkerSpots.ts');
    const markers = YEAR_MARKERS.map(marker => yearMarkerSpot(marker, width));
    spots.forEach((pair, k) => Object.values(pair).forEach(house => {
      assert.ok(onLand(house.x, house.z, width) && Math.sign(house.x - riverCenter(house.z, width)) === NESTS.pairs[k].side);
      for (const marker of markers) assert.ok(Math.hypot(marker.x - house.x, marker.z - house.z) > 5);
    }));
    // Both houses of the pair in the picture, and near enough to read, as each event fires.
    NEST_EVENTS.forEach((event, i) => {
      for (const house of Object.values(spots[event.pair])) {
        const { bearing, distance } = seen(triggers[i], width, house.x, house.z);
        assert.ok(Math.abs(bearing) < halfView(width) - 3, `bearing ${bearing} at event ${i}`);
        assert.ok(distance < (event.build && event.pair === 1 ? 31 : 26), `distance ${distance} at event ${i}`);
      }
    });
    // The second pair comes up only once Patrick's bird is home.
    const home = NEST_EVENTS.findIndex(e => e.month === PATRICK_HOME && e.moves?.patrick);
    assert.ok(triggers[NEST_EVENTS.findIndex(e => e.pair === 1 && e.build)] >= triggers[home]);
    // Under reduced motion each still shows its stage done: at living
    // together's, Patrick's bird is at Amelia's and the scaffolding up.
    const still = stillProgress(progressAt(living.month) + ROOM * .2), visit = NEST_EVENTS.findIndex(e => e.scaffold === 1);
    assert.ok(fired(visit, triggers, still, true) && !fired(visit, triggers, still, false));
    assert.ok(!fired(home, triggers, still, true));
  }
});

test('Patrick\'s bird flies home as August 2024 shows, clear of the dating butterflies', async () => {
  const { DATES, dateLabel, routeAt } = await import('../src/components/garden/journey.ts');
  const { boatPose } = await import('../src/components/garden/storyBoats.ts');
  const { FLYERS, flightPoint, flying } = await import('../src/components/garden/eggs/datingFlight.ts');
  const { NEST_EVENTS, PATRICK_HOME, nestSpots, nestTriggers } = await import('../src/components/garden/eggs/nesting.ts');
  assert.equal(PATRICK_HOME, '2024-08');
  assert.equal(PATRICK_HOME, DATES.dating);
  const home = NEST_EVENTS.findIndex(e => e.month === PATRICK_HOME && e.moves?.patrick);
  const rise = NEST_EVENTS.findIndex(e => e.pair === 1 && e.build);
  for (const width of [1, MOBILE_RIVER_WIDTH]) {
    const triggers = nestTriggers(width), houses = Object.values(nestSpots(width)[0]);
    assert.equal(dateLabel(triggers[home]), 'August 2024');
    // The first pair is still ahead of the boats as his bird flies home.
    for (const house of houses) assert.ok(house.z < routeAt(triggers[home]) - 2);
    // The butterflies come out of the trees on the other bank meanwhile, and
    // are nowhere near his flight while the guest might scroll on through it.
    for (let p = triggers[home]; p <= triggers[home] + .1 * ROOM; p += .01 * ROOM) {
      const t = (p - progressAt(DATES.dating)) / ROOM, pose = boatPose(p, width);
      for (const flyer of FLYERS.filter(f => flying(f, t))) for (let s = 0; s < 30; s += .5) {
        const [lx, , lz] = flightPoint(flyer, s, t);
        const x = pose.x + Math.cos(pose.yaw) * lx + Math.sin(pose.yaw) * lz, z = pose.z - Math.sin(pose.yaw) * lx + Math.cos(pose.yaw) * lz;
        for (const house of houses) assert.ok(Math.hypot(x - house.x, z - house.z) > 4, `${flyer.colour} by the houses at ${t}`);
      }
    }
    // The second pair rises only once they are all round the boats.
    assert.ok(triggers[rise] >= progressAt(DATES.dating) + Math.max(...FLYERS.map(f => f.arrive[1])) * ROOM);
  }
});

const snowAgain = MILESTONES.find(m => m.egg === 'snow-2025');

test('the 2025 snowmen stand on the bank holding hands, in view as their date holds, clear of the birdhouses', async () => {
  const { SNOW_SPOTS, snowSpot } = await import('../src/components/garden/eggs/flurry.ts');
  const { HOLD, SNOWMAN, holdingHandsGeometry } = await import('../src/components/garden/eggs/snowmanGeometry.ts');
  const { nestSpots } = await import('../src/components/garden/eggs/nesting.ts');
  const { YEAR_MARKERS, yearMarkerSpot } = await import('../src/components/garden/eggs/yearMarkerSpots.ts');
  assert.equal(snowAgain.month, '2025-08');
  for (const width of [1, MOBILE_RIVER_WIDTH]) {
    const { x, z } = snowSpot(SNOW_SPOTS[2025], snowAgain.month, width);
    assert.ok(onLand(x, z, width), 'on land');
    for (let t = 0; t <= 1; t += .05) {
      const { bearing } = seen(progressAt(snowAgain.month) + t * ROOM, width, x, z);
      assert.ok(Math.abs(bearing) < halfView(width) - 3, `bearing ${bearing} at ${t}`);
    }
    const others = [...nestSpots(width).flatMap(pair => Object.values(pair)), ...YEAR_MARKERS.map(marker => yearMarkerSpot(marker, width))];
    for (const other of others) assert.ok(Math.hypot(other.x - x, other.z - z) > 5, 'clear of the other scenery');
  }
  // Each holds its hand out and down to halfway to the other, where they meet.
  const { snowmanGeometry } = await import('../src/components/garden/eggs/snowmanGeometry.ts');
  const [, [, shoulder]] = SNOWMAN.balls;
  for (const side of [1, -1]) {
    const p = snowmanGeometry({ hold: side, simple: true }).attributes.position;
    let reach = 0;
    for (let i = 0; i < p.count; i++) if (p.getY(i) < shoulder) reach = Math.max(reach, p.getX(i) * side);
    assert.ok(reach > HOLD.apart / 2 - .02 && reach < HOLD.apart / 2 + .1, `reaches ${reach}`);
  }
  assert.ok(holdingHandsGeometry({ scarf: '#4d827f' }, { scarf: '#e3c46a' }).attributes.position.count / 3 < 1600, 'two simple snowmen');
});

// Degrees above the camera's eye line of a point at height y from the camera at p.
const above = (p, width, x, y, z) => {
  const [cx, cy, cz] = cameraPose(p, width).position;
  return degrees(Math.atan2(y - cy, Math.hypot(x - cx, z - cz)));
};
// Half the picture's height in degrees, and the date label's foot above the
// middle of the picture: the open sky below it is where things in the air go.
const halfHeight = width => width < 1 ? 34 : 24;
const underLabel = width => width < 1 ? 19 : 11;

test('the rocket stands on the right bank in late 2025, clear of the arch and the other scenery', async () => {
  const { ROCKET, launchProgress, rocketSpot } = await import('../src/components/garden/eggs/rocketLaunch.ts');
  const { groundHeight } = await import('../src/components/garden/gardenGeometry.ts');
  const { nestSpots } = await import('../src/components/garden/eggs/nesting.ts');
  const { SNOW_SPOTS, snowSpot } = await import('../src/components/garden/eggs/flurry.ts');
  const { YEAR_MARKERS, yearMarkerSpot, yearTurns } = await import('../src/components/garden/eggs/yearMarkerSpots.ts');
  const { dateLabel } = await import('../src/components/garden/journey.ts');
  // Not a milestone: it keeps its own time, after the snow trip's stop and before salsa's date.
  assert.ok(MILESTONES.every(m => m.month !== ROCKET.month), 'not a milestone');
  assert.match(dateLabel(launchProgress() + 1e-4), /^(September|October|November|December) 2025$/);
  const snowStop = progressAt(snowAgain.month) + .35 * ROOM / 2;
  assert.ok(launchProgress() > snowStop && launchProgress() < yearTurns(2026));
  // Out of the haze before the snow trip, not as they start dating a year before.
  const { rocketShown, rocketTime } = await import('../src/components/garden/eggs/rocketLaunch.ts');
  assert.equal(rocketShown(rocketTime(progressAt('2024-08') + .5 * ROOM)), 0);
  assert.equal(rocketShown(rocketTime(snowStop)), 1);
  for (const width of [1, MOBILE_RIVER_WIDTH]) {
    const { x, z } = rocketSpot(width);
    assert.ok(onLand(x, z, width) && x > riverCenter(z, width), 'on the right bank');
    assert.ok(groundHeight(x, z, width) > 0, 'above the waterline');
    assert.ok(Math.abs(z + 117) < 1, `about z −117 (${z})`);
    // Between the second pair of birdhouses and 2026's arch on the same bank,
    // which a phone's narrow river leaves little room between, and across
    // the river from the snowmen.
    const arch = yearMarkerSpot(YEAR_MARKERS.find(m => m.year === 2026), width);
    assert.ok(z < Math.min(...Object.values(nestSpots(width)[1]).map(house => house.z)) && z > arch.z);
    const others = [...nestSpots(width).flatMap(pair => Object.values(pair)), ...YEAR_MARKERS.map(marker => yearMarkerSpot(marker, width)), snowSpot(SNOW_SPOTS[2025], snowAgain.month, width)];
    for (const other of others) assert.ok(Math.hypot(other.x - x, other.z - z) > 4, 'clear of the other scenery');
    assert.ok(Math.hypot(arch.x - x, arch.z - z) > 4.2, 'clear of the arch');
  }
});

test('the rocket waits on its stand, then fires as the scroll passes and climbs away up the river in real time', async () => {
  const { EXHAUST, ROCKET, exhaust, launchProgress, rocketCourse, rocketInFlight, rocketSpot, rocketTime } = await import('../src/components/garden/eggs/rocketLaunch.ts');
  assert.equal(rocketTime(launchProgress()), 0);
  assert.ok(rocketTime(launchProgress() - .01) < 0);
  const end = ROCKET.ignite + ROCKET.flight;
  for (const width of [1, MOBILE_RIVER_WIDTH]) {
    const course = rocketCourse(width), spot = rocketSpot(width);
    // On its stand before it fires, and while it ignites, with no smoke before.
    for (const air of [null, 0, ROCKET.ignite - .01]) assert.deepEqual(rocketInFlight(course, air).position, course.from);
    assert.ok(exhaust(course, null).every(puff => puff.size === 0));
    assert.ok(rocketInFlight(course, ROCKET.ignite - .01).burn > 0);
    // Its course is a function of seconds since it fired, not of the scroll:
    // rising all the way, first straight up off the stand, then turning away
    // up the river, and out of sight by the end of its flight.
    let last = -Infinity;
    for (let air = ROCKET.ignite; air <= end; air += .05) {
      const { position: [, y, z], gone } = rocketInFlight(course, air);
      assert.ok(y >= last - 1e-9, `rising at ${air}`);
      last = y;
      if (!gone) assert.ok(z <= spot.z + 1e-9, 'never back towards the camera');
    }
    const early = rocketInFlight(course, ROCKET.ignite + ROCKET.flight * .15).position;
    assert.ok(early[1] - course.from[1] > 3 * Math.hypot(early[0] - course.from[0], early[2] - course.from[2]), 'straight up at first');
    assert.ok(!rocketInFlight(course, end - .05).gone && rocketInFlight(course, end).gone);
    // Smoke round the stand as it fires, and left along its climb.
    assert.ok(exhaust(course, .3).slice(0, EXHAUST.pad).every(puff => puff.size > 0));
    assert.ok(exhaust(course, end).slice(EXHAUST.pad).filter(puff => puff.size > 0).length >= 3);
    assert.ok(exhaust(course, end + EXHAUST.linger + .1).every(puff => puff.size === 0), 'the smoke clears');
  }
});

test('the rocket is in the picture as it fires and climbs through the open sky over the river, below the date label', async () => {
  const { ROCKET, exhaust, launchProgress, rocketCourse, rocketInFlight, rocketSpot } = await import('../src/components/garden/eggs/rocketLaunch.ts');
  const { ROCKET_MODEL } = await import('../src/components/garden/eggs/rocketGeometry.ts');
  const p = launchProgress();
  for (const width of [1, MOBILE_RIVER_WIDTH]) {
    const spot = rocketSpot(width), course = rocketCourse(width);
    // On its stand, in from the edge of the picture, from when the boats near it until it fires.
    for (let q = p - .5 * ROOM; q <= p; q += .05 * ROOM) assert.ok(Math.abs(seen(q, width, spot.x, spot.z).bearing) < halfView(width) - 3, `stand at ${q}`);
    // Every point of its climb, seen from where it fired, in the picture;
    // once it is above the trees' lowest boughs, over the water.
    for (let air = 0; air < ROCKET.ignite + ROCKET.flight; air += .05) {
      const { position: [x, y, z], gone } = rocketInFlight(course, air);
      if (gone) break;
      assert.ok(Math.abs(seen(p, width, x, z).bearing) < halfView(width) - 2, `bearing at ${air}`);
      const top = y + ROCKET_MODEL.height * spot.scale;
      assert.ok(above(p, width, x, top, z) < underLabel(width), `under the date label at ${air}`);
      assert.ok(above(p, width, x, y, z) > -halfHeight(width) + 2, `above the foot of the picture at ${air}`);
      if (y > 5) assert.ok(Math.abs(x - riverCenter(z, width)) < bankEdge(z, width), `over the water at ${air}`);
    }
    // Its smoke too, as it billows.
    for (const puff of exhaust(course, ROCKET.ignite + ROCKET.flight).filter(puff => puff.size > 0)) {
      assert.ok(Math.abs(seen(p, width, puff.x, puff.z).bearing) < halfView(width));
    }
  }
});

test('the rocket and its stand keep to the egg budget', async () => {
  const { EXHAUST_COUNT } = await import('../src/components/garden/eggs/rocketLaunch.ts');
  const { launchStandGeometry, puffGeometry, rocketGeometry } = await import('../src/components/garden/eggs/rocketGeometry.ts');
  const triangles = g => (g.index ? g.index.count : g.attributes.position.count) / 3;
  // Three draw calls: the stand, the rocket, and the smoke and flame instanced.
  assert.ok(triangles(rocketGeometry()) + triangles(launchStandGeometry()) + triangles(puffGeometry()) * (EXHAUST_COUNT + 1) < 1000);
});

test('the Hagia Sophia stands on the left bank at the start of the S-bend, under the balloon at the trip\'s stop', async () => {
  const { BALLOON_TIMES, HAGIA, balloonSpot, hagiaShown, hagiaSophiaSpot, tripStop } = await import('../src/components/garden/eggs/balloonCourse.ts');
  const { HAGIA_SOPHIA, hagiaSophiaGeometry } = await import('../src/components/garden/eggs/hagiaSophiaGeometry.ts');
  const { VOYAGE } = await import('../src/components/garden/gardenGeometry.ts');
  const stop = tripStop(trip.month), t = (stop - progressAt(trip.month)) / ROOM;
  assert.ok(t > 0 && t < BALLOON_TIMES.climb);
  for (const [mobile, width] of [[false, 1], [true, MOBILE_RIVER_WIDTH]]) {
    const spot = hagiaSophiaSpot(trip.month, width);
    assert.ok(Math.abs(spot.z - HAGIA.z) < 1e-9 && spot.z < VOYAGE.bend.from && spot.z > VOYAGE.bend.from - 10, 'at the start of the S-bend');
    // On the left bank, the front of its terrace a quay at the water's edge.
    assert.ok(onLand(spot.x, spot.z, width) && spot.x < riverCenter(spot.z, width), 'on the left bank');
    const c = Math.cos(spot.yaw), s = Math.sin(spot.yaw);
    for (const [dx, dz] of [[1, 1], [1, -1], [-1, -1], [-1, 1]]) {
      const lx = dx * HAGIA_SOPHIA.width / 2 * spot.scale, lz = dz * HAGIA_SOPHIA.depth / 2 * spot.scale;
      const x = spot.x + c * lx + s * lz, z = spot.z - s * lx + c * lz;
      assert.ok(riverCenter(z, width) - x > bankEdge(z, width) - .6, 'its terrace no more than a quay at the water\'s edge');
    }
    // In the picture, well in from its edge, from the trip's date through the stop.
    for (let q = progressAt(trip.month); q <= stop; q += .05 * ROOM) {
      assert.ok(Math.abs(seen(q, width, spot.x, spot.z).bearing) < halfView(width) - 4, `in the picture at ${q}`);
    }
    // At the stop the balloon hangs over it: close to the same bearing, above its minarets.
    const { position: [bx, by, bz] } = balloonSpot(stop, t, mobile, width);
    const model = seen(stop, width, spot.x, spot.z), balloon = seen(stop, width, bx, bz);
    assert.ok(Math.abs(balloon.bearing - model.bearing) < (mobile ? 5 : 12), `balloon at ${balloon.bearing}, model at ${model.bearing}`);
    assert.ok(above(stop, width, bx, by, bz) > above(stop, width, spot.x, spot.y + HAGIA_SOPHIA.height * spot.scale, spot.z) + 5);
    // It is there, out of the haze, by the trip's date.
    assert.ok(hagiaShown(0) === 1 && hagiaShown(-.6) === 0);
  }
  const g = hagiaSophiaGeometry();
  assert.ok(g.attributes.position.count / 3 < 1500, 'one draw call under the budget');
});

test('on a phone the balloon hangs below the header\'s monogram at the trip\'s stop', async () => {
  const { balloonSpot, tripStop } = await import('../src/components/garden/eggs/balloonCourse.ts');
  const { BALLOON } = await import('../src/components/garden/eggs/balloonGeometry.ts');
  // The sky's open patch is under the monogram, top left, whose foot is about
  // 3.5° below the top of the picture (53 of 844px). At the stop the whole
  // balloon, basket to crown, keeps a degree below that.
  const width = MOBILE_RIVER_WIDTH, stop = tripStop(trip.month), t = (stop - progressAt(trip.month)) / ROOM;
  const { position: [x, y, z], scale } = balloonSpot(stop, t, true, width);
  assert.ok(above(stop, width, x, y + BALLOON.height * scale, z) < halfHeight(width) - 4.5);
});

test('the Hagia Sophia is clear of the petals\' trail, the headland, the old tree and the year markers', async () => {
  const { hagiaSophiaSpot } = await import('../src/components/garden/eggs/balloonCourse.ts');
  const { HAGIA_SOPHIA } = await import('../src/components/garden/eggs/hagiaSophiaGeometry.ts');
  const { PETALS, PETAL_LIST, floatPoint, petalCourse } = await import('../src/components/garden/eggs/petalTrail.ts');
  const { VOYAGE, voyageLandmarks } = await import('../src/components/garden/gardenGeometry.ts');
  const { YEAR_MARKERS, yearMarkerSpot } = await import('../src/components/garden/eggs/yearMarkerSpots.ts');
  for (const width of [1, MOBILE_RIVER_WIDTH]) {
    const spot = hagiaSophiaSpot(trip.month, width), reach = Math.hypot(HAGIA_SOPHIA.width, HAGIA_SOPHIA.depth) / 2 * spot.scale;
    for (const petal of PETAL_LIST) {
      const course = petalCourse(petal, width);
      for (let age = 0; age <= PETALS.life; age += .05) {
        const [x, , z] = floatPoint(petal, course, age, width);
        assert.ok(Math.hypot(x - spot.x, z - spot.z) > reach + .5, 'clear of the petals');
      }
    }
    // The headland that hides the old tree stands on the other bank, further on (see gardenTreeSpots.ts).
    assert.ok(spot.x < riverCenter(spot.z, width) && spot.z > VOYAGE.bend.from - 11 - reach);
    const { tree, jetty } = voyageLandmarks(width);
    for (const landmark of [tree, jetty]) assert.ok(Math.hypot(landmark.x - spot.x, landmark.z - spot.z) > 20);
    for (const marker of YEAR_MARKERS.map(m => yearMarkerSpot(m, width))) assert.ok(Math.hypot(marker.x - spot.x, marker.z - spot.z) > 10);
  }
});
