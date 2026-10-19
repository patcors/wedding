import assert from 'node:assert/strict';
import test from 'node:test';
import { cameraPose } from '../src/components/garden/cameraRig.ts';
import { MILESTONES, ROOM, STOPS, VOYAGE_END, progressAt, stillProgress } from '../src/components/garden/journey.ts';
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

test('the balloons climb in the open sky left of the date label, the first over the river, and are gone well before the dock', async () => {
  const { BALLOONS, BALLOON_TIMES, balloonSpot } = await import('../src/components/garden/eggs/balloonCourse.ts');
  const { BALLOON } = await import('../src/components/garden/eggs/balloonGeometry.ts');
  const at = progressAt(trip.month);
  // A few, all flown on desktop and at least three on a phone.
  assert.ok(BALLOONS.length >= 3 && BALLOONS.length <= 5);
  assert.ok(BALLOONS.filter(b => b.mobile).length >= 3);
  for (const [mobile, width] of [[false, 1], [true, MOBILE_RIVER_WIDTH]]) {
    BALLOONS.forEach((_, i) => {
      let last = -Infinity;
      for (let t = 0; t <= BALLOON_TIMES.climb; t += .1) {
        const p = at + t * ROOM, spot = balloonSpot(p, t, mobile, width, i);
        if (!spot) return;
        const { position: [x, y, z], scale } = spot;
        if (i === 0) assert.ok(Math.abs(x - riverCenter(z, width)) < bankEdge(z, width), `over the water at ${t}`);
        assert.ok(y >= last, `balloon ${i} rising at ${t}`);
        last = y;
        const [cx, , cz] = cameraPose(p, width).position, distance = Math.hypot(x - cx, z - cz);
        const bearing = degrees(Math.atan2(x - cx, cz - z) - cameraHeading(p, width)), half = degrees(Math.atan(BALLOON.radius * scale / distance));
        // Between the canopy on the left and the date label, whose left edge
        // is about 4.5° left of the middle on desktop and, where they could
        // meet it, under the monogram, 2.7° on a phone.
        assert.ok(bearing + half < (mobile ? -4.5 : -8.5) && bearing - half > (mobile ? -14 : -17), `balloon ${i} at ${bearing} at ${t}`);
        // On a phone, where it is under the header's monogram (top left, more
        // than 11.5° left of the middle), it keeps below its foot.
        if (mobile && bearing - half < -11.5) assert.ok(above(p, width, x, y + (BALLOON.height + BALLOON.basketTop) * scale, z) < halfHeight(width) - 3.5, `balloon ${i} under the monogram at ${t}`);
      }
    });
  }
  assert.ok(at + BALLOON_TIMES.gone * ROOM < VOYAGE_END - .05);
});

test('the balloons keep to the egg budget', async () => {
  const { BALLOONS } = await import('../src/components/garden/eggs/balloonCourse.ts');
  const { BALLOON_LOOKS, balloonGeometry } = await import('../src/components/garden/eggs/balloonGeometry.ts');
  assert.equal(BALLOON_LOOKS.length, BALLOONS.length);
  // Three draw calls for them all: the envelopes and baskets, skinned, a bone
  // to each balloon; the ropes; and the burners, instanced (8 triangles each).
  const { geometry } = balloonGeometry();
  assert.deepEqual([...new Set(geometry.attributes.skinIndex.array.filter((_, k) => k % 4 === 0))], BALLOONS.map((_, i) => i));
  assert.ok(geometry.attributes.position.count / 3 + 8 * BALLOONS.length < 1500);
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

test('the eggs about Amelia alone stand on her bank, the left: the 2019 snowman and the end of Sydney\'s bridge', async () => {
  const { SNOW_SPOTS } = await import('../src/components/garden/eggs/flurry.ts');
  const { harbourBridge } = await import('../src/components/garden/eggs/harbour.ts');
  assert.equal(SNOW_SPOTS[2019].side, -1);
  for (const width of [1, MOBILE_RIVER_WIDTH]) {
    const { far, z } = harbourBridge(width);
    assert.ok(far < riverCenter(z, width) - bankEdge(z, width));
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

const apartments = MILESTONES.find(m => m.egg === 'apartments');

test('the birds tell the apartments: one house each side of the river, his at hers while he renovates, home across the river, then both at his', async () => {
  const { AMELIA_MOVED_IN, DATES } = await import('../src/components/garden/journey.ts');
  const { MOVE_SHOWN, NESTS, NEST_EVENTS, PATRICK_HOME, birdPoses, fired, nestSpots, nestTriggers, perchPoint } = await import('../src/components/garden/eggs/nesting.ts');
  assert.equal(apartments.month, '2024-05');
  assert.equal(AMELIA_MOVED_IN, '2026-03');
  assert.ok(MILESTONES.every(m => m.month !== AMELIA_MOVED_IN), 'moving in is not a milestone');
  const living = MILESTONES.find(m => m.id === 'living-together'), dating = MILESTONES.find(m => m.id === 'dating');
  assert.deepEqual([...new Set(NEST_EVENTS.map(e => e.month))], [apartments.month, PATRICK_HOME, MOVE_SHOWN]);
  // Her move stands in for AMELIA_MOVED_IN early, once dating's date has
  // held and before 2025 turns, while the houses are still well in view.
  assert.ok(progressAt(MOVE_SHOWN) > progressAt(dating.month) + dating.hold * ROOM && MOVE_SHOWN < '2025-01' && MOVE_SHOWN < AMELIA_MOVED_IN);
  // His house goes up with its scaffolding round it; one build only.
  assert.equal(NEST_EVENTS.filter(e => e.build).length, 1);
  assert.equal(NEST_EVENTS.find(e => e.build).scaffold, 1);
  const triggers = nestTriggers();
  for (let i = 1; i < triggers.length; i++) assert.ok(triggers[i] >= triggers[i - 1], 'in order');
  for (const width of [1, MOBILE_RIVER_WIDTH]) {
    const houses = nestSpots(width);
    // Where each bird is once the first n events are done.
    const after = n => birdPoses(NEST_EVENTS.map((_, i) => i < n ? 99 : null), houses);
    const at = (pose, house, spot) => Math.hypot(pose.x - perchPoint(houses[house], spot).x, pose.y - perchPoint(houses[house], spot).y, pose.z - perchPoint(houses[house], spot).z) < 1e-9;
    const expect = [
      [2, { amelia: 'amelia', patrick: 'amelia' }],
      [3, { amelia: 'amelia', patrick: 'patrick' }],
      [4, { amelia: 'patrick', patrick: 'patrick' }],
    ];
    for (const [n, homes] of expect) {
      const poses = after(n);
      for (const owner of ['amelia', 'patrick']) {
        assert.ok(poses[owner].shown && poses[owner].flying === 0, `${owner} perched after ${n}`);
        assert.ok(at(poses[owner], homes[owner], homes[owner] === owner ? 'home' : 'guest'), `${owner} at ${homes[owner]}'s after ${n}`);
      }
    }
    // Nobody about before they fly in.
    assert.ok(!after(1).amelia.shown && !after(1).patrick.shown);
    // Mid-flight a bird is off its perches, up over the river, well above the boats' masts.
    for (const [i, owner] of [[2, 'patrick'], [3, 'amelia']]) {
      const flying = birdPoses(NEST_EVENTS.map((_, k) => k < i ? 99 : k === i ? NESTS.flight / 2 : null), houses)[owner];
      assert.ok(flying.flying > .9 && flying.y > perchPoint(houses.patrick, 'home').y && flying.y > 2.5, `${owner} up in the air`);
      assert.ok(Math.abs(flying.x - riverCenter(flying.z, width)) < bankEdge(flying.z, width), `${owner} over the river halfway across`);
    }
    // One house on each bank, hers on the left and his on the right, across
    // the river from each other and turned towards each other, still showing
    // their fronts to the camera.
    const { YEAR_MARKERS, yearMarkerSpot } = await import('../src/components/garden/eggs/yearMarkerSpots.ts');
    const { PIE_BED, ornamentSpot } = await import('../src/components/garden/eggs/careerSpots.ts');
    const { SNOW_SPOTS, snowSpot } = await import('../src/components/garden/eggs/flurry.ts');
    const { bulletSpot } = await import('../src/components/garden/eggs/bulletOrnament.ts');
    const others = [...YEAR_MARKERS.map(marker => yearMarkerSpot(marker, width)), ornamentSpot(PIE_BED, width), snowSpot(SNOW_SPOTS[2025], snowAgain.month, width), bulletSpot(width)];
    for (const owner of ['amelia', 'patrick']) {
      const house = houses[owner];
      assert.ok(onLand(house.x, house.z, width) && Math.sign(house.x - riverCenter(house.z, width)) === NESTS.side[owner], `${owner}'s on ${owner}'s bank`);
      for (const other of others) assert.ok(Math.hypot(other.x - house.x, other.z - house.z) > 5, `${owner}'s clear of the other scenery`);
      const [cx, , cz] = cameraPose(triggers[2], width).position;
      const facing = [Math.sin(house.yaw), Math.cos(house.yaw)], toCamera = [cx - house.x, cz - house.z];
      const across = Math.sign(facing[0]) === -NESTS.side[owner], front = facing[0] * toCamera[0] + facing[1] * toCamera[1] > .5 * Math.hypot(...toCamera);
      assert.ok(across && front, `${owner}'s faces across the river and up it`);
    }
    assert.ok(Math.abs(houses.amelia.z - houses.patrick.z) < 3.5, 'across the river from each other');
    // Both houses in the picture, whole, and near enough to read, as each
    // event fires.
    const whole = (p, house) => Math.abs(seen(p, width, house.x, house.z).bearing) + degrees(Math.atan(.22 * house.scale / seen(p, width, house.x, house.z).distance));
    NEST_EVENTS.forEach((_, i) => {
      for (const house of Object.values(houses)) {
        assert.ok(whole(triggers[i], house) < halfView(width) - 2, `in the picture at event ${i}`);
        assert.ok(seen(triggers[i], width, house.x, house.z).distance < 30, `near enough at event ${i}`);
      }
    });
    // Each flight is done with both houses still in the picture, and they
    // stay in it for a good while after (more than .4 of a share on both),
    // so the guest sees the settled scene before it goes.
    NEST_EVENTS.forEach((event, i) => {
      if (!event.moves) return;
      for (let s = 0; s <= .4; s += .02) for (const house of Object.values(houses)) {
        assert.ok(whole(triggers[i] + s * ROOM, house) < halfView(width) - 2, `in the picture ${s} after event ${i}`);
      }
    });
    // Under reduced motion each still shows its stage done: at the
    // apartments' and at living together's, Patrick's bird is at Amelia's and
    // the scaffolding up; at dating's, each is at home, the scaffolding down;
    // from the snow trip on, both at his. Scrolling, the houses go up a
    // little before May shows; at a still it counts from the date.
    const fly = NEST_EVENTS.findIndex(e => e.moves?.amelia?.house === 'amelia'), up = NEST_EVENTS.findIndex(e => e.scaffold === 1);
    const home = NEST_EVENTS.findIndex(e => e.moves?.patrick?.house === 'patrick'), move = NEST_EVENTS.findIndex(e => e.moves?.amelia?.house === 'patrick');
    const still = month => stillProgress(progressAt(month) + ROOM * .2);
    for (const month of [apartments.month, living.month]) {
      assert.ok(fired(up, triggers, still(month), true) && fired(fly, triggers, still(month), true) && !fired(home, triggers, still(month), true), `still at ${month}`);
    }
    assert.ok(fired(home, triggers, still(DATES.dating), true) && !fired(move, triggers, still(DATES.dating), true), 'each at home at dating');
    assert.ok(fired(move, triggers, still(snowAgain.month), true), 'both at his from the snow trip');
    const before = progressAt(apartments.month) - ROOM * .01;
    assert.ok(fired(up, triggers, before, false) && !fired(up, triggers, stillProgress(before), true));
  }
});

test('Patrick\'s bird flies home across the river as July 2024 shows, before they start dating, clear of the dating butterflies', async () => {
  const { DATES, dateLabel, routeAt } = await import('../src/components/garden/journey.ts');
  const { boatPose } = await import('../src/components/garden/storyBoats.ts');
  const { FLYERS, flightPoint, flying } = await import('../src/components/garden/eggs/datingFlight.ts');
  const { BIRDHOUSE } = await import('../src/components/garden/eggs/birdhouseGeometry.ts');
  const { NEST_EVENTS, PATRICK_HOME, nestSpots, nestTriggers } = await import('../src/components/garden/eggs/nesting.ts');
  assert.equal(PATRICK_HOME, '2024-08');
  assert.equal(PATRICK_HOME, DATES.dating);
  const home = NEST_EVENTS.findIndex(e => e.month === PATRICK_HOME && e.moves?.patrick);
  const triggers = nestTriggers();
  // Early, so it is home well before the houses leave the picture.
  assert.equal(dateLabel(triggers[home]), 'July 2024');
  assert.ok(triggers[home] < progressAt(DATES.dating));
  for (const width of [1, MOBILE_RIVER_WIDTH]) {
    const houses = Object.values(nestSpots(width));
    // The houses are still ahead of the boats as his bird flies home.
    for (const house of houses) assert.ok(house.z < routeAt(triggers[home]) - 2);
    // How far a butterfly is from a house: its post (with the number on it)
    // up to the floor, then the house up to the ridge.
    const clearance = ([x, y, z], house) => {
      const r = Math.hypot(x - house.x, z - house.z);
      const part = (from, to, radius) => Math.hypot(Math.max(0, r - radius * house.scale),
        Math.max(0, house.y + from * house.scale - y, y - house.y - to * house.scale));
      return Math.min(part(0, .82, .14), part(.82, BIRDHOUSE.height + .05, .3));
    };
    // The butterflies come out of the trees on his bank short of his house
    // and leave up the river over the water, nowhere near either house on
    // the way in or out (on a phone's narrow river, their circle round the
    // boats passes the houses close by as the boats go by, but never
    // through them).
    for (const flyer of FLYERS) {
      for (let t = flyer.arrive[0]; t <= flyer.leave[1]; t += .01) {
        if (!flying(flyer, t)) continue;
        const p = progressAt(DATES.dating) + t * ROOM, pose = boatPose(p, width);
        const way = t < flyer.arrive[1] ? 'arriving' : t > flyer.leave[0] ? 'leaving' : 'circling';
        for (let s = 0; s < 30; s += .5) {
          const [lx, y, lz] = flightPoint(flyer, s, t);
          const point = [pose.x + Math.cos(pose.yaw) * lx + Math.sin(pose.yaw) * lz, y, pose.z - Math.sin(pose.yaw) * lx + Math.cos(pose.yaw) * lz];
          const least = way === 'circling' || width < 1 ? .05 : 2.5;
          for (const house of houses) assert.ok(clearance(point, house) > least, `${flyer.colour} ${way} by a house at ${t.toFixed(2)} (width ${width})`);
        }
      }
    }
  }
});

test('a Church St sign is fixed to the tree beside Amelia\'s house, on its bark, and both house numbers read from the boats', async () => {
  const THREE = await import('three');
  const { NodeIO } = await import('@gltf-transform/core');
  const { EXTMeshoptCompression } = await import('@gltf-transform/extensions');
  const { MeshoptDecoder } = await import('meshoptimizer');
  const { treePlacements, treeBase } = await import('../src/components/garden/gardenTreeSpots.ts');
  const { treeMatrix } = await import('../src/components/garden/eggs/barkCarvingGeometry.ts');
  const { BLADE, NUMBER_RECTS, SIGN_GAP, bladeHeight, signMount } = await import('../src/components/garden/eggs/streetSign.ts');
  const { PLAQUE, birdhousesGeometry } = await import('../src/components/garden/eggs/birdhouseGeometry.ts');
  const { NEST_EVENTS, SIGN, nestSpots, nestTriggers, signFaces, signTree } = await import('../src/components/garden/eggs/nesting.ts');
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions([EXTMeshoptCompression]).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  const models = {};
  for (const [type, file] of ['ash-1', 'ash-2', 'ash-1-distant', 'ash-2-distant'].entries()) {
    const primitive = (await io.read(`public/models/garden/${file}.glb`)).getRoot().listNodes().find(n => n.getName() === 'branches').getMesh().listPrimitives()[0];
    const normal = primitive.getAttribute('NORMAL');
    models[type] = { position: primitive.getAttribute('POSITION').getArray(), normal: Array.from({ length: normal.getCount() }, (_, i) => normal.getElement(i, [])).flat(), index: primitive.getIndices().getArray() };
  }
  const triggers = nestTriggers(), move = NEST_EVENTS.findIndex(e => e.moves?.amelia?.house === 'patrick');
  // Pixels tall a thing `size` high is, `distance` away, on each layout (CSS pixels).
  const pixels = (size, distance, width) => degrees(Math.atan(size / distance)) * (width < 1 ? 844 / 68 : 900 / 24 / 2);
  for (const width of [1, MOBILE_RIVER_WIDTH]) {
    const houses = nestSpots(width), tree = signTree(width), length = BLADE.length * (width < 1 ? BLADE.mobile : 1);
    // A real tree on Amelia's bank, the nearest to her house, standing by the water.
    assert.ok(treePlacements(width, width < 1).some(t => t.x === tree.x && t.z === tree.z && t.type === tree.type));
    assert.ok(tree.x < riverCenter(tree.z, width) - bankEdge(tree.z, width) && tree.x - riverCenter(tree.z, width) > -bankEdge(tree.z, width) - 2, 'by the water on her bank');
    assert.ok(Math.hypot(tree.x - houses.amelia.x, tree.z - houses.amelia.z) < 2.5, 'beside her house');
    // Flat on the trunk, facing the camera: touching the bark and sunk into it nowhere.
    const matrix = treeMatrix({ ...tree, y: treeBase(tree, width) }), height = width < 1 ? SIGN.height.mobile : SIGN.height.desktop;
    const { centre, normal, right } = signMount(models[tree.type], matrix, signFaces(width), height, length);
    const triangles = [], m = models[tree.type];
    for (let t = 0; t < m.index.length; t += 3) {
      const corners = [0, 1, 2].map(k => new THREE.Vector3().fromArray(m.position, m.index[t + k] * 3));
      if (corners.every(c => c.y < 3.6 && Math.hypot(c.x, c.z) < .8)) triangles.push(corners.map(c => c.applyMatrix4(matrix)));
    }
    let touch = Infinity, hits = 0;
    const ray = new THREE.Ray(), hit = new THREE.Vector3();
    for (let a = 0; a <= 20; a++) for (let b = 0; b <= 8; b++) {
      const back = centre.clone().addScaledVector(right, (a / 20 - .5) * length).add(new THREE.Vector3(0, (b / 8 - .5) * bladeHeight(length), 0));
      ray.set(back.clone().addScaledVector(normal, -2), normal);
      for (const [p, q, r] of triangles) if (ray.intersectTriangle(p, q, r, false, hit)) {
        const gap = back.clone().sub(hit).dot(normal);
        assert.ok(gap > 0, `sunk into the bark (width ${width})`);
        touch = Math.min(touch, gap); hits++;
      }
    }
    assert.ok(hits > 0 && touch < SIGN_GAP + .01, `on the bark, not floating (${touch}, width ${width})`);
    const { x: cx, z: cz } = signFaces(width), toCamera = new THREE.Vector3(cx - centre.x, 0, cz - centre.z).normalize();
    assert.ok(normal.dot(toCamera) > .999, 'facing the camera');
    // In the picture and legible, its capitals (.55 of the blade) at least 5
    // pixels tall from the living together's stop, and 6.5 from dating's,
    // until her bird has flown over to his and well after, as the houses
    // are; above her roof.
    assert.ok(centre.y - bladeHeight(length) / 2 > houses.amelia.y + 1.3 * houses.amelia.scale, `above her roof (${centre.y - bladeHeight(length) / 2} over ${houses.amelia.y + 1.3 * houses.amelia.scale}, width ${width})`);
    const fromStop = STOPS[MILESTONES.findIndex(m => m.id === 'living-together') + 1];
    for (let p = fromStop; p <= triggers[move] + .4 * ROOM; p += .002) {
      const { bearing, distance } = seen(p, width, centre.x, centre.z);
      assert.ok(Math.abs(bearing) + degrees(Math.atan(length / 2 / distance)) < halfView(width), `the sign in the picture at ${p}`);
      const least = p < STOPS[MILESTONES.findIndex(m => m.id === 'dating') + 1] ? 5 : 6.5;
      assert.ok(pixels(bladeHeight(length) * .55, distance, width) > least, `the sign legible at ${p} (width ${width})`);
    }
    // The numbers at the apartments' stop: at least 6 pixels tall on desktop,
    // and as legible as a phone allows, then larger as the boats come up.
    const atStop = STOPS[MILESTONES.findIndex(m => m.id === 'apartments') + 1];
    for (const owner of ['amelia', 'patrick']) {
      const figures = PLAQUE.width * NUMBER_RECTS[owner].height / NUMBER_RECTS[owner].width * .65 * houses[owner].scale;
      const { distance } = seen(atStop, width, houses[owner].x, houses[owner].z);
      assert.ok(pixels(figures, distance, width) > (width < 1 ? 3.5 : 6), `${owner}'s number at the apartments' stop (width ${width})`);
    }
    // Within the egg's budget: both houses, their numbers and the
    // scaffolding in one mesh, the birds in another and the sign a third.
    const { geometry } = birdhousesGeometry(houses);
    assert.ok(geometry.attributes.position.count / 3 < 600, 'the houses in one small mesh');
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
    const others = [...Object.values(nestSpots(width)), ...YEAR_MARKERS.map(marker => yearMarkerSpot(marker, width))];
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

test('the bullet stands on Patrick\'s bank across the river from the 2025 snowmen, on land, clear of the trees and the other scenery', async () => {
  const { BULLET, bulletFootprint, bulletSpot } = await import('../src/components/garden/eggs/bulletOrnament.ts');
  const { BULLET_MODEL } = await import('../src/components/garden/eggs/bulletGeometry.ts');
  const { SNOW_SPOTS, snowSpot } = await import('../src/components/garden/eggs/flurry.ts');
  const { groundHeight } = await import('../src/components/garden/gardenGeometry.ts');
  const { treePlacements } = await import('../src/components/garden/gardenTreeSpots.ts');
  const { plantSites } = await import('../src/components/garden/gardenPlantGeometry.ts');
  const { YEAR_MARKERS, yearMarkerSpot } = await import('../src/components/garden/eggs/yearMarkerSpots.ts');
  const { nestSpots } = await import('../src/components/garden/eggs/nesting.ts');
  const { RIGS, hangSpot } = await import('../src/components/garden/eggs/circusRigs.ts');
  const { truckSpot } = await import('../src/components/garden/eggs/engagementTruck.ts');
  const { ORNAMENTS, ornamentSpot } = await import('../src/components/garden/eggs/careerSpots.ts');
  // Not a milestone: Bullet was released in October 2025, and it stands
  // there from about the snow trip's stretch, with the snowmen.
  assert.equal(BULLET.from, snowAgain.month);
  for (const width of [1, MOBILE_RIVER_WIDTH]) {
    const spot = bulletSpot(width), snow = snowSpot(SNOW_SPOTS[2025], snowAgain.month, width);
    assert.ok(onLand(spot.x, spot.z, width) && spot.x > riverCenter(spot.z, width), 'on Patrick\'s bank, the right');
    // Its whole plinth on the bank above the waterline, whichever way it turns.
    const corner = BULLET_MODEL.plinth * Math.SQRT2 * spot.scale;
    assert.ok(spot.x - corner - riverCenter(spot.z, width) > bankEdge(spot.z, width), 'its plinth clear of the water');
    assert.ok(spot.y > .02, `above the waterline (${spot.y})`);
    for (let k = 0; k < 8; k++) assert.ok(groundHeight(spot.x + Math.cos(k) * corner, spot.z + Math.sin(k) * corner, width) >= spot.y - 1e-9, 'no corner floats');
    // Across the river from the snowmen, a little further on.
    assert.ok(snow.x < riverCenter(snow.z, width), 'the snowmen on the other bank');
    assert.ok(spot.z < snow.z && snow.z - spot.z < 2.5, `opposite the snowmen (${snow.z - spot.z} on)`);
    // Clear of every trunk, and of the other scenery on the banks.
    for (const tree of treePlacements(width, width < 1)) assert.ok(Math.hypot(tree.x - spot.x, tree.z - spot.z) > 2.5, `a tree at ${tree.x}, ${tree.z} (width ${width})`);
    const others = [
      ...YEAR_MARKERS.map(marker => [marker.year, yearMarkerSpot(marker, width)]),
      ...Object.entries(nestSpots(width)).map(([owner, house]) => [`${owner}'s birdhouse`, house]),
      ...Object.entries(RIGS).map(([name, rig]) => [name, hangSpot(rig, width)]),
      ...ORNAMENTS.map(ornament => [`${ornament.facing} ornament`, ornamentSpot(ornament, width)]),
      ['truck', truckSpot(width)],
    ];
    for (const [name, other] of others) assert.ok(Math.hypot(other.x - spot.x, other.z - spot.z) > 5, `${name} crowds the bullet (width ${width})`);
    assert.ok(Math.hypot(snow.x - spot.x, snow.z - spot.z) > 4, 'the river between it and the snowmen');
    // Nothing grows up through its plinth, nor stands on it.
    const under = bulletFootprint(width);
    for (const kind of ['grass', 'clover', 'fern', 'meadow', 'reed', 'cattail']) assert.ok(plantSites(kind, width, width < 1).every(site => !under(site.x, site.z)), `${kind} through its plinth (width ${width})`);
  }
});

test('the bullet is whole in the picture beside the snowmen from the snow trip\'s date through its stop, and stands there until the camera has passed', async () => {
  const { BULLET, bulletShown, bulletSpot } = await import('../src/components/garden/eggs/bulletOrnament.ts');
  const { BULLET_MODEL } = await import('../src/components/garden/eggs/bulletGeometry.ts');
  const { SNOW_SPOTS, snowSpot } = await import('../src/components/garden/eggs/flurry.ts');
  const at = progressAt(snowAgain.month), stop = STOPS[MILESTONES.indexOf(snowAgain) + 1];
  const dating = STOPS[MILESTONES.findIndex(m => m.id === 'dating') + 1];
  for (const width of [1, MOBILE_RIVER_WIDTH]) {
    const mobile = width < 1, spot = bulletSpot(width), snow = snowSpot(SNOW_SPOTS[2025], snowAgain.month, width);
    const shown = p => bulletShown(spot, p, cameraPose(p, width).position[2], mobile);
    // Not there at dating's stop or long before the trip; dissolving in just before its date.
    assert.equal(shown(dating), 0);
    assert.equal(shown(at - BULLET.arrive * ROOM - 1e-9), 0);
    assert.ok(shown(at - BULLET.arrive * ROOM / 2) > 0 && shown(at - BULLET.arrive * ROOM / 2) < 1);
    // Fully in at the date and the still under reduced motion.
    assert.equal(shown(stillProgress(at + .2 * ROOM)), 1);
    // Whole in the picture with a margin, right of the boats while the
    // snowmen stand left of them, from the date to the trip's stop on a
    // phone, whose narrow lens loses Patrick's bank soon after, and on
    // through most of the share on desktop.
    const until = mobile ? stop : at + .75 * ROOM, margin = mobile ? 1.4 : 3;
    for (let p = at; p <= until; p += .001) {
      const pose = cameraPose(p, width), [cx, cy, cz] = pose.position;
      assert.equal(shown(p), 1, `shown at ${p}`);
      const { bearing, distance } = seen(p, width, spot.x, spot.z), half = degrees(Math.atan(BULLET_MODEL.radius * spot.scale / distance));
      assert.ok(bearing - half > 0 && bearing + half < halfView(width) - margin, `bearing ${bearing.toFixed(1)}° at ${p} (width ${width})`);
      assert.ok(seen(p, width, snow.x, snow.z).bearing < 0, 'the snowmen left of the middle');
      // Plinth to tip within the picture's height, and large enough to read.
      const tilt = degrees(Math.atan2(pose.target[1] - cy, Math.hypot(pose.target[0] - cx, pose.target[2] - cz)));
      const top = degrees(Math.atan2(spot.y + spot.scale - cy, distance)) - tilt, foot = degrees(Math.atan2(spot.y - cy, distance)) - tilt;
      assert.ok(top < halfHeight(width) - 3 && foot > -halfHeight(width) + 3, `plinth to tip in the picture at ${p}`);
      // At least 70 pixels tall on a 390 × 844 phone, 110 on a 1440 × 900 desktop.
      const pixels = (top - foot) / (2 * halfHeight(width)) * (mobile ? 844 : 900);
      assert.ok(pixels > (mobile ? 70 : 110), `${pixels.toFixed(0)} pixels tall at ${p}`);
    }
    // Gone once the camera has passed it.
    let p = at;
    while (cameraPose(p, width).position[2] > spot.z - 4) p += .001;
    assert.equal(shown(p), 0);
  }
});

test('the bullet is as large as a garden sculpture beside the snowmen, in two small meshes that cast no shadow', async () => {
  const { readFileSync } = await import('node:fs');
  const { BULLET } = await import('../src/components/garden/eggs/bulletOrnament.ts');
  const { BULLET_MODEL, bulletGeometry, bulletPlinthGeometry } = await import('../src/components/garden/eggs/bulletGeometry.ts');
  const { SNOWMAN } = await import('../src/components/garden/eggs/snowmanGeometry.ts');
  const { COMPONENT } = await import('../src/components/garden/sceneryCatalog.ts');
  // Taller than the snowmen across the river (as SecondSnowTrip.tsx sizes them), but not towering.
  for (const [size, snowmen] of [[BULLET.size.desktop, SNOWMAN.height * COMPONENT.snowScale], [BULLET.size.mobile, SNOWMAN.height * COMPONENT.snowScale * COMPONENT.snowMobile]]) {
    assert.ok(size > snowmen * 1.05 && size < snowmen * 1.5, `${size} beside snowmen ${snowmen} tall`);
  }
  const triangles = geometry => (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3;
  const bullet = bulletGeometry(), plinth = bulletPlinthGeometry();
  assert.ok(triangles(bullet) + triangles(plinth) < 1500, `${triangles(bullet) + triangles(plinth)} triangles`);
  for (const geometry of [bullet, plinth]) {
    assert.equal(geometry.groups.length, 0, 'one draw call each');
    assert.ok([...geometry.attributes.position.array].every(Number.isFinite));
    geometry.computeBoundingBox();
  }
  // Upright, its tip 1 above the ground, standing on the plinth's top, the plinth sunk a little into the lawn.
  assert.ok(Math.abs(bullet.boundingBox.max.y - 1) < 1e-6 && Math.abs(bullet.boundingBox.min.y - BULLET_MODEL.top) < 1e-6);
  assert.ok(Math.abs(plinth.boundingBox.max.y - BULLET_MODEL.top) < 1e-6 && plinth.boundingBox.min.y < 0);
  assert.ok(Math.abs(plinth.boundingBox.max.x - BULLET_MODEL.plinth) < 1e-6 && bullet.boundingBox.max.x <= BULLET_MODEL.radius + 1e-6);
  // Brass below and copper at the tip.
  const colours = bullet.attributes.color, positions = bullet.attributes.position;
  let brass = 0, copper = 0;
  for (let i = 0; i < positions.count; i++) {
    const [r, g, b] = [colours.getX(i), colours.getY(i), colours.getZ(i)];
    if (positions.getY(i) < .5) brass += g / r > .7 && r > b ? 1 : 0;
    if (positions.getY(i) > .62) copper += g / r < .7 && r > b ? 1 : 0;
  }
  assert.ok(brass > 0 && copper > 0);
  const source = readFileSync(new URL('../src/components/garden/eggs/BulletOrnament.tsx', import.meta.url), 'utf8');
  assert.ok(!source.includes('castShadow'), 'casts no shadow');
});

test('the Hagia Sophia stands far off past the S-bend, on level ground back from the left bank, under the balloon at the trip\'s stop', async () => {
  const { BALLOON_TIMES, HAGIA_TIMES, balloonSpot, hagiaCorners, hagiaShown, hagiaSophiaSpot, tripStop } = await import('../src/components/garden/eggs/balloonCourse.ts');
  const { HAGIA_SOPHIA, hagiaSophiaGeometry } = await import('../src/components/garden/eggs/hagiaSophiaGeometry.ts');
  const { RIVER_REACH, VOYAGE, groundHeight, lawnSpot, voyageClearing } = await import('../src/components/garden/gardenGeometry.ts');
  const { treeBase, treePlacements } = await import('../src/components/garden/gardenTreeSpots.ts');
  const at = progressAt(trip.month), stop = tripStop(trip.month), t = (stop - at) / ROOM;
  assert.ok(t > 0 && t < BALLOON_TIMES.climb);
  for (const [mobile, width] of [[false, 1], [true, MOBILE_RIVER_WIDTH]]) {
    const spot = hagiaSophiaSpot(trip.month, width), lawn = lawnSpot(width), corners = hagiaCorners(spot);
    // Far off down the river, where it runs straight again past the bend and
    // the dock, well short of the end of what is planted.
    assert.ok(spot.z < VOYAGE.dock.z - 20 && spot.z > RIVER_REACH.to + 40, 'past the bend');
    assert.ok(seen(stop, width, spot.x, spot.z).distance > 70, 'far off at the trip\'s stop');
    // On the left bank, its whole terrace back beyond the bank's rise from
    // the water, on the level lawn, seated on it: neither sunk into it nor floating.
    assert.ok(onLand(spot.x, spot.z, width) && spot.x < riverCenter(spot.z, width), 'on the left bank');
    for (const [x, z] of corners) assert.ok(riverCenter(z, width) - x > bankEdge(z, width) + 2.4, 'back beyond the bank\'s rise');
    const [a, b, , d] = corners;
    for (let i = 0; i <= 10; i++) for (let k = 0; k <= 10; k++) {
      const x = a[0] + (d[0] - a[0]) * i / 10 + (b[0] - a[0]) * k / 10, z = a[1] + (d[1] - a[1]) * i / 10 + (b[1] - a[1]) * k / 10;
      assert.ok(Math.abs(groundHeight(x, z, width) - spot.y) < .02, `level ground under its terrace at ${x}, ${z}`);
    }
    // The lawn leaves the water's edge and the bank's rise as they were: it is
    // level only beyond the rise, and eases back into the ground well inland.
    for (let a = 0; a < 64; a++) {
      const [c, s] = [Math.cos(a / 32 * Math.PI), Math.sin(a / 32 * Math.PI)];
      const inland = reach => riverCenter(lawn.z + s * reach, width) - (lawn.x + c * reach) - bankEdge(lawn.z + s * reach, width);
      assert.ok(inland(lawn.radius) > 2.4 && inland(lawn.radius + VOYAGE.lawn.ease) > 1, 'the lawn clear of the bank\'s rise');
    }
    // Trees keep off its field, and no trunk stands in front of it from the
    // trip's date through the stop until it starts to sink back into the haze.
    const trees = treePlacements(width, mobile);
    for (const tree of trees) assert.ok(Math.hypot(tree.x - lawn.x, tree.z - lawn.z) > lawn.field, `tree at ${tree.x}, ${tree.z} in its field`);
    // The lawn covers its terrace, so planting keeps off it too.
    for (const [x, z] of corners) assert.ok(voyageClearing(x, z, width) && Math.hypot(x - lawn.x, z - lawn.z) < lawn.radius);
    const far = mobile ? GARDEN_CAMERA.mobileFar : GARDEN_CAMERA.far;
    for (let q = at; q <= at + HAGIA_TIMES.leave * ROOM; q += .05 * ROOM) {
      const ends = corners.map(([x, z]) => seen(q, width, x, z));
      const left = Math.min(...ends.map(end => end.bearing)), right = Math.max(...ends.map(end => end.bearing));
      // The whole of it in the picture, and nearer than the far plane.
      assert.ok(left > -halfView(width) + 1 && right < halfView(width) - 1, `in the picture at ${q}`);
      assert.ok(ends.every(end => end.distance * Math.cos(end.bearing * Math.PI / 180) < far - 1), `past the far plane at ${q}`);
      const foot = above(q, width, spot.x, spot.y, spot.z);
      for (const tree of trees) {
        const { bearing, distance } = seen(q, width, tree.x, tree.z);
        if (distance > seen(q, width, spot.x, spot.z).distance - 5) continue;
        const half = degrees(Math.atan2(.32 * tree.scale, distance)), top = above(q, width, tree.x, treeBase(tree, width) + 3.2 * tree.scale, tree.z);
        assert.ok(bearing + half < left || bearing - half > right || top < foot, `trunk at ${tree.x}, ${tree.z} in front of it at ${q}`);
      }
    }
    // At the stop the balloon hangs over it: close to the same bearing, above its minarets.
    const { position: [bx, by, bz] } = balloonSpot(stop, t, mobile, width);
    const model = seen(stop, width, spot.x, spot.z), balloon = seen(stop, width, bx, bz);
    assert.ok(Math.abs(balloon.bearing - model.bearing) < (mobile ? 5 : 12), `balloon at ${balloon.bearing}, model at ${model.bearing}`);
    assert.ok(above(stop, width, bx, by, bz) > above(stop, width, spot.x, spot.y + HAGIA_SOPHIA.height * spot.scale, spot.z) + 5);
    // It is there, out of the haze, by the trip's date, and has sunk back
    // into it before the balloons are gone, long before the dock.
    assert.ok(hagiaShown(0) === 1 && hagiaShown(t) === 1 && hagiaShown(-.6) === 0);
    assert.ok(hagiaShown(BALLOON_TIMES.gone) === 0 && hagiaShown((VOYAGE_END - at) / ROOM) === 0);
  }
  const g = hagiaSophiaGeometry();
  assert.ok(g.attributes.position.count / 3 < 1500, 'one draw call under the budget');
});

test('on a phone the balloons hang below the header\'s monogram at the trip\'s stop', async () => {
  const { BALLOONS, balloonSpot, tripStop } = await import('../src/components/garden/eggs/balloonCourse.ts');
  const { BALLOON } = await import('../src/components/garden/eggs/balloonGeometry.ts');
  // The sky's open patch is under the monogram, top left, whose foot is about
  // 3.5° below the top of the picture (53 of 844px). At the stop the whole
  // balloon, basket to crown, keeps a degree below that, and the others too.
  const width = MOBILE_RIVER_WIDTH, stop = tripStop(trip.month), t = (stop - progressAt(trip.month)) / ROOM;
  for (let i = 0; i < BALLOONS.length; i++) {
    const spot = balloonSpot(stop, t, true, width, i);
    if (!spot) continue;
    const { position: [x, y, z], scale } = spot;
    assert.ok(above(stop, width, x, y + BALLOON.height * scale, z) < halfHeight(width) - 4.5, `balloon ${i}`);
  }
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
    // The headland that hides the old tree stands on the other bank, inside
    // the bend (see gardenTreeSpots.ts); the Hagia Sophia is far past it.
    assert.ok(spot.x < riverCenter(spot.z, width) && spot.z + reach < VOYAGE.bend.to - 20);
    const { tree, jetty } = voyageLandmarks(width);
    for (const landmark of [tree, jetty]) assert.ok(Math.hypot(landmark.x - spot.x, landmark.z - spot.z) > 20);
    for (const marker of YEAR_MARKERS.map(m => yearMarkerSpot(m, width))) assert.ok(Math.hypot(marker.x - spot.x, marker.z - spot.z) > 10);
  }
});
