import assert from 'node:assert/strict';
import test from 'node:test';
import { cameraPose } from '../src/components/garden/cameraRig.ts';
import { MOBILE_RIVER_WIDTH, VOYAGE, bankEdge, groundHeight, riverCenter, rockHalfWidth } from '../src/components/garden/gardenGeometry.ts';
import { DATES, MILESTONES, ROOM, STOPS, progressAt, routeAt } from '../src/components/garden/journey.ts';
import { ALONGSIDE, BOAT_SCALE, boatPose } from '../src/components/garden/storyBoats.ts';
import { HULL } from '../src/components/garden/storyBoatGeometry.ts';
import { cameraHeading } from '../src/components/garden/eggs/egg.ts';
import { BRIDGE, HARBOUR_SHOWN, OPERA, archAt, bridgeStems, harbourBridge, harbourShown, operaHouseSpot } from '../src/components/garden/eggs/harbour.ts';
import { rockGeometry, rockHeight, rockInland } from '../src/components/garden/voyageRock.ts';

const widths = [1, MOBILE_RIVER_WIDTH];
const degrees = radians => radians * 180 / Math.PI;
const halfView = width => degrees(width < 1 ? Math.atan(Math.tan(34 * Math.PI / 180) * 390 / 844) : Math.atan(Math.tan(24 * Math.PI / 180) * 1.6));
// Degrees right of the middle of the picture, and distance, of a point from the camera at p.
const seen = (p, width, x, z) => {
  const [cx, , cz] = cameraPose(p, width).position;
  return { bearing: degrees(Math.atan2(x - cx, cz - z) - cameraHeading(p, width)), distance: Math.hypot(x - cx, z - cz) };
};
const sydney = MILESTONES.find(m => m.id === 'sydney');
const stop = STOPS[MILESTONES.indexOf(sydney) + 1];
const p0 = progressAt('2020-08'), p1 = progressAt(DATES.back);
const range = (from, to, step = .0005) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);

// Points round one boat's hull rim in the world at p (Amelia's is −1), and
// where its mast stands, from the dinghy's sections.
const SECTIONS = [[-.78, .015], [-.55, .23], [-.12, .36], [.30, .33], [.66, .22]];
const boat = (p, width, side) => {
  const pose = boatPose(p, width), c = Math.cos(pose.yaw), s = Math.sin(pose.yaw);
  const turn = side * pose.turn, ct = Math.cos(turn), st = Math.sin(turn);
  const at = (u, v) => {
    const bu = side * pose.gap + u * ct + v * st, bv = -u * st + v * ct;
    return { x: pose.x + (c * bu + s * bv) * BOAT_SCALE, z: pose.z + (-s * bu + c * bv) * BOAT_SCALE };
  };
  return { hull: SECTIONS.flatMap(([v, w]) => [at(-w, v), at(w, v)]), mast: at(0, HULL.mast.dinghy) };
};
// When the boats reach z.
const reach = z => { let p = p0; while (routeAt(p) > z) p += 1e-5; return p; };

test('a rock stands in the middle of the river where the boats first part for Sydney', () => {
  for (const width of widths) {
    const { from, to } = VOYAGE.rock;
    // Alongside a little way above its nose, apart from its nose on and all the way past it.
    assert.ok(boatPose(reach(from + 3), width).gap < ALONGSIDE * 1.05, 'still alongside above the rock');
    assert.ok(boatPose(reach(from), width).gap > ALONGSIDE * 1.15, 'parting at its nose');
    for (let z = from; z > to; z -= .25) assert.ok(boatPose(reach(z), width).gap > ALONGSIDE * 1.15);
    // In the middle of the river, within the reach Sydney widens, and narrower than the river.
    assert.ok(from < VOYAGE.sydney.from + 6 && to > VOYAGE.sydney.to);
    for (let z = from - .1; z > to; z -= .25) assert.ok(rockHalfWidth(z, width) > 0 && rockHalfWidth(z, width) < bankEdge(z, width) * .3);
    assert.equal(rockHalfWidth(from + .1, width), 0);
    assert.equal(rockHalfWidth(to - .1, width), 0);
  }
});

test('Amelia goes round it on the left and Patrick on the right, both well clear, on desktop and a phone', () => {
  for (const width of widths) {
    for (const p of range(p0, p1)) {
      for (const side of [-1, 1]) {
        for (const point of boat(p, width, side).hull) {
          const half = rockHalfWidth(point.z, width);
          if (!half) continue;
          const across = point.x - riverCenter(point.z, width);
          assert.equal(Math.sign(across), side, `${side < 0 ? 'Amelia' : 'Patrick'} on the wrong side at ${p} (width ${width})`);
          assert.ok(Math.abs(across) - half > .25, `${side < 0 ? 'Amelia' : 'Patrick'} ${(Math.abs(across) - half).toFixed(2)} off the rock at ${p} (width ${width})`);
        }
      }
    }
  }
});

test('the rock rises out of the water in low cliffs and is seated in it, cheaply', () => {
  for (const width of widths) {
    const geometry = rockGeometry(width), position = geometry.attributes.position;
    assert.ok([...position.array].every(Number.isFinite));
    // Its lowest edge is under the water all round, its back low above it.
    let low = Infinity, high = -Infinity;
    for (let i = 0; i < position.count; i++) { low = Math.min(low, position.getY(i)); high = Math.max(high, position.getY(i)); }
    assert.ok(low < -.3 && high > .15 && high < .45, `${low} to ${high}`);
    const middle = (VOYAGE.rock.from + VOYAGE.rock.to) / 2, x = riverCenter(middle, width);
    assert.ok(rockHeight(x, middle, width) > .15);
    assert.ok(rockHeight(x + rockHalfWidth(middle, width) + .05, middle, width) < 0, 'water just off its waterline');
    assert.ok(position.count / 3 < 2000, `${position.count / 3} triangles`);
    geometry.dispose();
  }
});

test('the Opera House stands on the rock\'s back, seated, between the boats at Sydney\'s stop', () => {
  for (const width of widths) {
    const spot = operaHouseSpot(width), c = Math.cos(spot.yaw), s = Math.sin(spot.yaw);
    assert.ok(VOYAGE.rock.from > OPERA.z && OPERA.z > VOYAGE.rock.bridge);
    // Its podium's corners on the rock, its foot below the rock under every one.
    for (const a of [-1, 1]) for (const b of [-.5, .5]) {
      const lx = a * OPERA.width / 2 * spot.scale, lz = b * spot.scale, x = spot.x + c * lx + s * lz, z = spot.z - s * lx + c * lz;
      assert.ok(rockInland(x, z, width) > -.02, `a corner off the rock (width ${width})`);
      assert.ok(spot.y + spot.foot * spot.scale < rockHeight(x, z, width), 'seated');
    }
    // Side on to the camera, its shells rising one behind another.
    assert.ok(Math.abs(Math.abs(spot.yaw) - Math.PI / 2) < .3);
    const house = seen(stop, width, spot.x, spot.z).bearing;
    const [amelia, patrick] = [-1, 1].map(side => boat(stop, width, side).mast).map(({ x, z }) => seen(stop, width, x, z).bearing);
    assert.ok(amelia < house && house < patrick, `between the boats (width ${width})`);
  }
});

test('the Harbour Bridge spans Amelia\'s channel from the rock to her bank, and only hers', () => {
  for (const width of widths) {
    const bridge = harbourBridge(width), middle = riverCenter(bridge.z, width);
    // A pair of pylons at each end, one each side of the deck: on the rock and on her bank.
    assert.equal(bridge.pylons.length, 4);
    for (const pylon of bridge.pylons) {
      const onRock = pylon.x === bridge.near;
      if (onRock) assert.ok(rockInland(pylon.x, pylon.z, width) > bridge.size.pylon.across / 2 - .05, 'on the rock');
      else assert.ok(middle - pylon.x - bankEdge(pylon.z, width) > bridge.size.pylon.across / 2, 'on her bank');
      assert.ok(Math.abs(Math.abs(pylon.z - bridge.z) - bridge.size.half) < bridge.size.pylon.along, 'beside the deck');
      assert.ok(pylon.foot < (onRock ? rockHeight : groundHeight)(pylon.x, pylon.z, width) - .05, 'down into the rock or the bank');
    }
    assert.ok(bridge.near < middle && bridge.far < bridge.near);
    // A through arch: its bottom chord springs low by the pylons and rises through the deck.
    assert.ok(archAt(bridge, 0).bottom < bridge.deck && archAt(bridge, .5).bottom > bridge.top + .3);
    assert.ok(archAt(bridge, .5).top > archAt(bridge, 0).top && archAt(bridge, .5).top < 4);
    // Patrick's boat goes the other way round the rock, nowhere near it.
    const p = reach(bridge.z);
    for (const point of boat(p, width, 1).hull) assert.ok(point.x > middle + rockHalfWidth(bridge.z, width));
  }
});

test('Amelia\'s boat sails under it between the piers, her masthead well clear of the deck, as Sydney\'s date holds', () => {
  const masthead = HULL.mastTop * BOAT_SCALE + .02;
  for (const width of widths) {
    const bridge = harbourBridge(width);
    assert.ok(bridge.deck - masthead > .3, `deck ${bridge.deck} over a masthead at ${masthead}`);
    // Every moment any part of her hull is under the bridge, between its pylons' inner faces.
    for (const p of range(stop - .5 * ROOM, stop + .5 * ROOM, .0002)) {
      const { hull, mast } = boat(p, width, -1);
      const near = hull.filter(point => Math.abs(point.z - bridge.z) < bridge.size.half + bridge.size.pylon.along);
      for (const point of near) assert.ok(point.x < bridge.from - .25 && point.x > bridge.to + .25, `between the piers at ${p} (width ${width})`);
      if (Math.abs(mast.z - bridge.z) < bridge.size.half + .05) {
        // Where her mast passes, the arch's bottom chord is up above the deck.
        const u = (mast.x - bridge.from) / (bridge.to - bridge.from);
        assert.ok(archAt(bridge, u).bottom > bridge.top, `the arch over her mast at ${u}`);
      }
    }
    // She passes under it while Sydney's date holds, just after its stop.
    const under = reach(bridge.z);
    assert.ok(under > progressAt(sydney.month) && under < progressAt(sydney.month) + .35 * ROOM);
    assert.ok(under > stop && under - stop < .1 * ROOM, `under at ${under}, the stop at ${stop}`);
  }
});

test('at Sydney\'s stop the arch over her boat is in the picture, on a phone too', () => {
  for (const width of widths) {
    const bridge = harbourBridge(width), { mast } = boat(stop, width, -1);
    const u = (mast.x - bridge.from) / (bridge.to - bridge.from);
    for (const v of [Math.max(0, u - .15), u, .5]) {
      const { x } = archAt(bridge, v), { bearing } = seen(stop, width, x, bridge.z);
      assert.ok(Math.abs(bearing) < halfView(width) - 1, `the arch at ${v} is ${bearing.toFixed(1)}° off (width ${width})`);
    }
    // Its rock end is in the picture too.
    assert.ok(Math.abs(seen(stop, width, bridge.near, bridge.z).bearing) < halfView(width) - 1);
  }
});

test('both stay hidden through the snow trip, come out of the haze before 2020, and go before they block the view', () => {
  for (const width of widths) {
    const shown = p => harbourShown(p, cameraPose(p, width).position[2], width < 1);
    const snow = shown(STOPS[MILESTONES.findIndex(m => m.id === 'snow-2019') + 1]);
    assert.equal(snow.opera + snow.bridge, 0);
    assert.ok(HARBOUR_SHOWN.from < '2020-01');
    // Both fully in from 2020's turn until she is through, past the date's hold.
    const through = progressAt(sydney.month) + .35 * ROOM;
    for (const p of range(progressAt('2020-01'), through)) assert.deepEqual(shown(p), { opera: 1, bridge: 1 }, `shown at ${p}`);
    // The bridge has gone before its rock end comes between the camera and her boat.
    const bridge = harbourBridge(width);
    for (const p of range(through, progressAt('2022-06'))) {
      if (!shown(p).bridge) break;
      const { mast } = boat(p, width, -1), pylon = seen(p, width, bridge.near, bridge.z), her = seen(p, width, mast.x, mast.z);
      const wide = degrees(Math.atan(bridge.size.pylon.across / 2 / pylon.distance));
      assert.ok(Math.abs(pylon.bearing - her.bearing) > wide + 1.5, `the pylon in front of her boat at ${p} (width ${width})`);
    }
    // The Opera House goes once the camera has passed it.
    let p = stop;
    while (cameraPose(p, width).position[2] > OPERA.z - 4) p += 1e-3;
    assert.deepEqual(shown(p), { opera: 0, bridge: 0 });
  }
});

test('2020\'s milestone stands on Amelia\'s bank, clear of the rock and the bridge on the ground and in the picture', async () => {
  const { YEAR_MARKERS, yearMarkerSpot, yearTurns } = await import('../src/components/garden/eggs/yearMarkerSpots.ts');
  const { CAPS, capLanding } = await import('../src/components/garden/eggs/capToss.ts');
  const marker = YEAR_MARKERS.find(m => m.year === 2020);
  assert.equal(marker.medium, 'milestone');
  assert.equal(marker.side, -1);
  for (const width of widths) {
    const spot = yearMarkerSpot(marker, width), bridge = harbourBridge(width);
    assert.ok(riverCenter(spot.z, width) - spot.x > bankEdge(spot.z, width), 'on the bank');
    assert.ok(spot.z > VOYAGE.rock.bridge + 4);
    for (const pylon of bridge.pylons) assert.ok(Math.hypot(pylon.x - spot.x, pylon.z - spot.z) > 4);
    // August's teal mortarboard lands in front of it, nearer the camera.
    const cap = capLanding('2020-08', CAPS.tosses[0], width);
    assert.ok(cap.z > spot.z && Math.hypot(cap.x - spot.x, cap.z - spot.z) < 5);
    // Through 2020 it never stands in front of the bridge's pylons on its bank.
    for (const p of range(yearTurns(2020), progressAt('2020-08'), .002)) {
      const at = seen(p, width, spot.x, spot.z), half = degrees(Math.atan(.36 * spot.scale / at.distance));
      for (const pylon of bridge.pylons.filter(pylon => pylon.x === bridge.far)) {
        const there = seen(p, width, pylon.x, pylon.z), wide = degrees(Math.atan(bridge.size.pylon.across / 2 / there.distance));
        assert.ok(at.bearing - there.bearing > half + wide, `beside a pylon at ${p} (width ${width})`);
      }
    }
  }
});

test('guests\' boats bump off the bridge\'s pylons, and the two cost two draw calls within the egg budget', async () => {
  const { harbourGeometry } = await import('../src/components/garden/eggs/sydneyGeometry.ts');
  for (const width of widths) {
    const stems = bridgeStems(width), { pylons, size } = harbourBridge(width);
    for (const pylon of pylons) assert.ok(stems.some(stem => Math.hypot(stem.x - pylon.x, stem.z - pylon.z) > size.pylon.along / 2 - .01 && Math.hypot(stem.x - pylon.x, stem.z - pylon.z) < size.pylon.across));
    // One draw call each, under the egg budget between them.
    const { opera, bridge } = harbourGeometry(width), triangles = (opera.attributes.position.count + bridge.attributes.position.count) / 3;
    for (const geometry of [opera, bridge]) {
      assert.ok(geometry.groups.length <= 1);
      assert.ok([...geometry.attributes.position.array].every(Number.isFinite));
      geometry.dispose();
    }
    assert.ok(triangles < 1500, `${triangles} triangles`);
  }
  assert.ok(BRIDGE.deck > 2);
});
