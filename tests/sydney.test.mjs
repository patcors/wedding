import assert from 'node:assert/strict';
import test from 'node:test';
import { cameraPose } from '../src/components/garden/cameraRig.ts';
import { MOBILE_RIVER_WIDTH, VOYAGE, bankEdge, groundHeight, pointInland, pointSpot, riverCenter, rockHalfWidth, voyageClearing } from '../src/components/garden/gardenGeometry.ts';
import { DATES, MILESTONES, ROOM, STOPS, monthIndex, progressAt, routeAt } from '../src/components/garden/journey.ts';
import { ALONGSIDE, BOAT_SCALE, boatPose } from '../src/components/garden/storyBoats.ts';
import { HULL } from '../src/components/garden/storyBoatGeometry.ts';
import { cameraHeading } from '../src/components/garden/eggs/egg.ts';
import { BRIDGE, HARBOUR_SHOWN, OPERA, archAt, bridgeStems, harbourBridge, harbourShown, onPoint, operaHouseSpot, pointStems } from '../src/components/garden/eggs/harbour.ts';
import { pointGeometry, pointTop, rockGeometry, rockHeight, rockInland } from '../src/components/garden/voyageRock.ts';
import { YEAR_MARKERS, yearMarkerSpot, yearTurns } from '../src/components/garden/eggs/yearMarkerSpots.ts';

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
// How far past the bridge's middle her boat's stern is through it.
const bridgeLength = .9;

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

// The Opera House's podium corners and the top of its tallest shell, in the world.
const house = width => {
  const spot = operaHouseSpot(width), c = Math.cos(spot.yaw), s = Math.sin(spot.yaw);
  const at = (lx, lz, y = spot.y) => ({ x: spot.x + (c * lx + s * lz) * spot.scale, y, z: spot.z + (-s * lx + c * lz) * spot.scale });
  const half = OPERA.width / 2;
  return { spot, corners: [-1, 1].flatMap(a => [-.5, .5].map(b => at(a * half, b))), top: at(-.155, -.18, spot.y + .49 * spot.scale) };
};
const interim = STOPS[MILESTONES.findIndex(m => m.id === 'interim') + 1];

test('Sydney carries on down the river: the Opera House stands on a sandstone point on Amelia\'s bank, across from 2022\'s pile', () => {
  const pile = YEAR_MARKERS.find(m => m.year === 2022);
  for (const width of widths) {
    const point = pointSpot(width), { spot, corners } = house(width), top = pointTop(width);
    // The point juts from her bank, the left, into the river.
    assert.equal(point.side, -1);
    assert.ok(Math.abs(point.x - (riverCenter(point.z, width) - bankEdge(point.z, width))) < 1e-9);
    assert.ok(point.out > .15 && point.out < bankEdge(point.z, width) * .25, 'a little point, not across the river');
    // Downstream of the rock and across the river from 2022's pile, past where the boats are as 2022 turns.
    const across = yearMarkerSpot(pile, width);
    assert.ok(across.x > riverCenter(across.z, width) && Math.abs(spot.z - across.z) < 7, `across from the pile (width ${width})`);
    assert.ok(spot.z < VOYAGE.rock.to - 10 && spot.z < routeAt(yearTurns(2022)));
    // Its podium's corners on the point, its foot down into the point's top.
    for (const corner of corners) assert.ok(pointInland(corner.x, corner.z, width) > .1, `a corner off the point (width ${width})`);
    assert.ok(spot.y === top && spot.foot < 0);
    // Side on to the camera, its harbour front facing out over the river.
    assert.ok(Math.abs(Math.abs(spot.yaw) - Math.PI / 2) < .3);
    assert.ok(-Math.sin(spot.yaw) > .9, 'its front to the river');
  }
});

test('the point rises out of the water above the bank everywhere under it, seated, and planting and boats keep off it', () => {
  for (const width of widths) {
    const point = pointSpot(width), top = pointTop(width), geometry = pointGeometry(width), position = geometry.attributes.position;
    // Above the ground all over it, so it never lies in the grass, and low.
    for (let u = -point.out; u <= point.back; u += .05) for (let v = -point.wide / 2; v <= point.wide / 2; v += .05) {
      const x = point.x + point.side * u, z = point.z + v;
      if (pointInland(x, z, width) > 0) assert.ok(groundHeight(x, z, width) < top - .03, `the bank over the point at ${u}, ${v}`);
    }
    assert.ok(top > .2 && top < .65, `top at ${top}`);
    // Its sides run down under the water, and nothing of it stands above its top.
    let low = Infinity, high = -Infinity;
    for (let i = 0; i < position.count; i++) { low = Math.min(low, position.getY(i)); high = Math.max(high, position.getY(i)); }
    assert.ok(low < -.3 && high < top + .03, `${low} to ${high}`);
    // Every face of its top faces up, every face of its cliffs outwards (the
    // boulders at their foot are lower).
    for (let i = 0; i < position.count; i += 3) {
      const [a, b, c] = [0, 1, 2].map(k => ({ x: position.getX(i + k), y: position.getY(i + k), z: position.getZ(i + k) }));
      if (Math.max(a.y, b.y, c.y) < .15) continue;
      const n = { x: (b.y - a.y) * (c.z - a.z) - (b.z - a.z) * (c.y - a.y), y: (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z), z: (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x) };
      const mid = { x: (a.x + b.x + c.x) / 3, z: (a.z + b.z + c.z) / 3 }, middle = { x: point.x + point.side * (point.back - point.out) / 2, z: point.z };
      assert.ok(n.y > .5 * Math.hypot(n.x, n.y, n.z) || n.x * (mid.x - middle.x) + n.z * (mid.z - middle.z) > 0, 'faces outwards');
    }
    assert.ok(position.count / 3 < 500);
    geometry.dispose();
    // No tree, rock or plant on it, guests' boats bump off its waterline and taps on it don't launch.
    assert.ok(voyageClearing(point.x + point.side * .3, point.z, width) && !voyageClearing(point.x + point.side * (point.back + .5), point.z, width));
    assert.ok(onPoint(point.x - point.side * point.out * .5, point.z, width));
    const stems = pointStems(width);
    for (const v of [-.3, 0, .3]) assert.ok(stems.some(stem => Math.hypot(stem.x - (point.x - point.side * point.out), stem.z - (point.z + v * point.wide)) < .25));
  }
});

test('the Opera House is in the picture through 2022 to August\'s stop on desktop and a phone, clear of her boat and its sails there', () => {
  for (const width of widths) {
    const { corners, top } = house(width);
    for (const p of range(progressAt('2022-01'), interim, .001)) {
      assert.equal(harbourShown(p, cameraPose(p, width).position[2], width < 1).opera, 1, `shown at ${p}`);
      for (const { x, z } of [...corners, top]) {
        const at = seen(p, width, x, z);
        assert.ok(Math.abs(at.bearing) < halfView(width) - .6 && at.distance < 26, `${at.bearing.toFixed(1)}°, ${at.distance.toFixed(1)} away at ${p} (width ${width})`);
      }
    }
    // At August 2022's stop it stands clear of her boat's sails, to their left.
    const { hull, mast } = boat(interim, width, -1), sails = Math.min(...hull.map(({ x, z }) => seen(interim, width, x, z).bearing), seen(interim, width, mast.x - .5, mast.z).bearing);
    for (const { x, z } of corners) assert.ok(seen(interim, width, x, z).bearing < sails - .3, `behind her sails at August's stop (width ${width})`);
    // Amelia's boat passes well clear of the point.
    for (const p of range(progressAt('2022-08'), progressAt('2023-01'))) {
      for (const { x, z } of boat(p, width, -1).hull) assert.ok(pointInland(x, z, width) < -.3, `her boat near the point at ${p} (width ${width})`);
    }
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

test('the bridge comes in soon after graduation, well before Sydney, and the Opera House with 2022, and each goes before it blocks the view', () => {
  for (const width of widths) {
    const shown = p => harbourShown(p, cameraPose(p, width).position[2], width < 1);
    // Neither down the river through the snow trip or graduation.
    for (const id of ['snow-2019', 'graduation']) assert.deepEqual(shown(STOPS[MILESTONES.findIndex(m => m.id === id) + 1]), { opera: 0, bridge: 0 });
    assert.ok(HARBOUR_SHOWN.bridge.from >= '2020-09' && HARBOUR_SHOWN.bridge.from <= '2020-10');
    // Not while graduation's date holds, so the caps land first, but fully in
    // for at least half a share before Sydney's date shows.
    const graduation = progressAt(monthIndex('2020-08') + 1e-3);
    for (const p of range(0, graduation, .0005)) assert.equal(shown(p).bridge, 0, `bridge at graduation, ${p}`);
    assert.ok(progressAt(DATES.sydney) - progressAt(HARBOUR_SHOWN.bridge.from) > .5 * ROOM);
    for (const p of range(0, progressAt(HARBOUR_SHOWN.bridge.from) - (HARBOUR_SHOWN.bridge.arrive + .01) * ROOM, .002)) assert.equal(shown(p).bridge, 0, `bridge at ${p}`);
    // The bridge fully in from its month until she is through, past the date's stop.
    const through = reach(VOYAGE.rock.bridge - bridgeLength);
    for (const p of range(progressAt(HARBOUR_SHOWN.bridge.from), through)) assert.equal(shown(p).bridge, 1, `bridge shown at ${p}`);
    // It fades away quickly once she is through, and evenly (see Sydney.tsx).
    const gone = range(through, progressAt('2022-01')).find(p => shown(p).bridge === 0);
    assert.ok(gone - through < .2 * ROOM, `the bridge takes ${(gone - through) / ROOM} of a share to go`);
    // Before its rock end comes between the camera and her boat.
    const bridge = harbourBridge(width);
    for (const p of range(through, gone)) {
      const { mast } = boat(p, width, -1), pylon = seen(p, width, bridge.near, bridge.z), her = seen(p, width, mast.x, mast.z);
      const wide = degrees(Math.atan(bridge.size.pylon.across / 2 / pylon.distance));
      assert.ok(Math.abs(pylon.bearing - her.bearing) > wide + 1.5, `the pylon in front of her boat at ${p} (width ${width})`);
    }
    // The Opera House waits for 2022, not years early: hidden as the camera passes the rock in 2021.
    for (const p of range(0, progressAt(HARBOUR_SHOWN.opera.from) - (HARBOUR_SHOWN.opera.arrive + .01) * ROOM, .002)) assert.equal(shown(p).opera, 0, `Opera House at ${p}`);
    assert.ok(HARBOUR_SHOWN.opera.from >= '2021-11' && HARBOUR_SHOWN.opera.from <= '2022-01');
    assert.equal(shown(progressAt(HARBOUR_SHOWN.opera.from)).opera, 1);
    // And goes once the camera has passed it.
    let p = progressAt('2022-06');
    while (cameraPose(p, width).position[2] > pointSpot(width).z - 4) p += 1e-3;
    assert.deepEqual(shown(p), { opera: 0, bridge: 0 });
  }
});

test('2020 is carved into a tree on Amelia\'s bank as 2020 turns, before the bridge comes in, with August\'s mortarboard at its foot', async () => {
  const { yearCarving } = await import('../src/components/garden/eggs/yearMarkerSpots.ts');
  const { treePlacements } = await import('../src/components/garden/gardenTreeSpots.ts');
  const { CAPS, capLanding } = await import('../src/components/garden/eggs/capToss.ts');
  const { SNOW_SPOTS, snowSpot } = await import('../src/components/garden/eggs/flurry.ts');
  const marker = YEAR_MARKERS.find(m => m.year === 2020);
  assert.equal(marker.medium, 'carving');
  assert.equal(marker.side, -1);
  for (const width of widths) {
    const { tree } = yearCarving(marker, width), spot = yearMarkerSpot(marker, width), inland = riverCenter(tree.z, width) - tree.x - bankEdge(tree.z, width);
    // A real tree standing by the water on her bank, broad enough in the trunk for the year to read.
    assert.ok(treePlacements(width, width < 1).some(t => t.x === tree.x && t.z === tree.z && t.type === tree.type));
    assert.ok(inland > .8 && inland < 2.5, `its tree ${inland} from the water (width ${width})`);
    assert.ok(tree.scale >= 1.1);
    // On the face of its trunk turned to the camera as the year turns.
    const [cx, , cz] = cameraPose(yearTurns(2020), width).position;
    assert.ok(Math.hypot(spot.x - cx, spot.z - cz) < Math.hypot(tree.x - cx, tree.z - cz) - .3);
    // Well up the river from the bridge, which isn't in yet.
    assert.ok(spot.z > VOYAGE.rock.bridge + 4);
    for (const p of range(yearTurns(2020), STOPS[MILESTONES.indexOf(MILESTONES.find(m => m.id === 'graduation')) + 1], .002)) assert.equal(harbourShown(p, cameraPose(p, width).position[2], width < 1).bridge, 0);
    // August's teal mortarboard lands in front of it, near its foot.
    const cap = capLanding('2020-08', CAPS.tosses[0], width);
    assert.ok(cap.z > tree.z && Math.hypot(cap.x - tree.x, cap.z - tree.z) < 4.5 && Math.hypot(cap.x - tree.x, cap.z - tree.z) > 1.5);
    // Above the 2019 snowman's head in the picture, so it isn't hidden behind it.
    const snowman = snowSpot(SNOW_SPOTS[2019], '2019-07', width), size = 1.25 * (width < 1 ? .9 : 1);
    for (const p of range(yearTurns(2020), progressAt('2020-10'), .002)) {
      const [, cy] = cameraPose(p, width).position, at = seen(p, width, spot.x, spot.z), him = seen(p, width, snowman.x, snowman.z);
      const carving = degrees(Math.atan2(tree.y + marker.carved.from * tree.scale - cy, at.distance)), head = degrees(Math.atan2(snowman.y + 1.52 * size - cy, him.distance));
      assert.ok(carving > head + .3, `behind the snowman at ${p} (width ${width})`);
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
