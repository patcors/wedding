import assert from 'node:assert/strict';
import test from 'node:test';
import { cameraPose } from '../src/components/garden/cameraRig.ts';
import { GARDEN_CAMERA, MOBILE_RIVER_WIDTH, bankEdge, groundHeight, islandHalfWidth, riverCenter } from '../src/components/garden/gardenGeometry.ts';
import { DATES, MILESTONES, ROOM, STOPS, progressAt } from '../src/components/garden/journey.ts';
import { boatScale, boatPose } from '../src/components/garden/storyBoats.ts';
import { cameraHeading } from '../src/components/garden/eggs/egg.ts';
import { TRUCK, TRUCK_SIZE, TRUCK_TIMES, TRUCK_WHEELS, truckFootprint, truckPoint, truckShown, truckSpot, truckWheelContacts } from '../src/components/garden/eggs/engagementTruck.ts';

const LAYOUTS = [[1, 1440 / 900, GARDEN_CAMERA.fov], [MOBILE_RIVER_WIDTH, 390 / 844, GARDEN_CAMERA.mobileFov]];
const halfView = (aspect, fov) => Math.atan(Math.tan(fov / 2 * Math.PI / 180) * aspect) * 180 / Math.PI;
const degrees = radians => radians * 180 / Math.PI;
// Degrees right of the middle of the picture, and distance, of a point from the camera at p.
const seen = (p, width, x, z) => {
  const [cx, , cz] = cameraPose(p, width).position;
  return { bearing: degrees(Math.atan2(x - cx, cz - z) - cameraHeading(p, width)), distance: Math.hypot(x - cx, z - cz) };
};
const engaged = progressAt(DATES.engaged);
const stop = STOPS[MILESTONES.findIndex(m => m.month === DATES.engaged) + 1];
// The corners of its footprint, and of the whole truck up to its top rail, in the world.
const { length, width: across } = TRUCK_SIZE;
const footprint = spot => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) => truckPoint(spot, [x * across / 2, 0, z * length / 2]));
const corners = spot => [0, 1.04].flatMap(y => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) => truckPoint(spot, [x * across / 2, y, z * length / 2])));
// How far a point on the right bank is from the water's edge, round the bend.
const toWater = (point, width) => {
  let nearest = Infinity;
  for (let z = point.z - 8; z <= point.z + 8; z += .05) nearest = Math.min(nearest, Math.hypot(point.x - riverCenter(z, width) - bankEdge(z, width), point.z - z));
  return nearest;
};

test('it stands on Patrick\'s bank past the start of the S-bend, a little back from the water on the level ground past the bank\'s rise', () => {
  assert.equal(TRUCK.from, DATES.engaged);
  for (const [width] of LAYOUTS) {
    const spot = truckSpot(width);
    assert.equal(Math.sign(spot.x - riverCenter(spot.z, width)), 1, `on the right bank (width ${width})`);
    assert.equal(islandHalfWidth(spot.z, width), 0);
    // Every corner a little back from the water, and the whole of it not far
    // back: its furthest corner no further than its own width beyond 3.3.
    const reach = footprint(spot).map(point => toWater(point, width));
    assert.ok(Math.min(...reach) > 1.5, `its nearest corner ${Math.min(...reach)} from the water (width ${width})`);
    assert.ok(Math.max(...reach) < 3.3 + TRUCK_SIZE.width * spot.scale, `its furthest corner ${Math.max(...reach)} from the water (width ${width})`);
  }
});

test('each tyre rests on the ground, tilted no more than the grass beneath it, and nothing else touches it', () => {
  for (const [width] of LAYOUTS) {
    const spot = truckSpot(width);
    for (const contact of truckWheelContacts(spot)) {
      const off = contact.y - groundHeight(contact.x, contact.z, width);
      // Within .15 of its tyre's radius, so the grass hides it.
      assert.ok(Math.abs(off) < .15 * TRUCK_WHEELS.radius * spot.scale, `a tyre ${off} off the ground (width ${width})`);
    }
    assert.ok(Math.abs(spot.pitch) < .07 && Math.abs(spot.roll) < .07, `tilted ${degrees(spot.pitch)}°, ${degrees(spot.roll)}° (width ${width})`);
    // The frame and the fenders' skirts, from front to back between the wheels, clear the grass.
    for (let z = -1.1; z <= 1.1; z += .1) {
      for (const x of [-.36, 0, .36]) {
        const under = truckPoint(spot, [x, .24, z]);
        assert.ok(under.y > groundHeight(under.x, under.z, width) + .1, `its underside at ${z} touches the ground (width ${width})`);
      }
    }
  }
});

test('it is parked along the bank, its deck\'s side looking out over the water, three-quarters on to the camera so the cab and the deck both show', () => {
  for (const [width] of LAYOUTS) {
    const spot = truckSpot(width);
    // Its nose and tail about as far from the water: along the bank, as the truck stood along the clifftop.
    const nose = truckPoint(spot, [0, 0, 1.1]), tail = truckPoint(spot, [0, 0, -1.1]);
    assert.ok(Math.abs(toWater(nose, width) - toWater(tail, width)) < .8, `along the bank (width ${width})`);
    // Its nose towards the camera at the stop, turned well round so its side shows.
    const [cx, , cz] = cameraPose(stop, width).position;
    const look = Math.atan2(cx - spot.x, cz - spot.z), off = Math.abs(degrees(Math.atan2(Math.sin(look - spot.yaw), Math.cos(look - spot.yaw))));
    assert.ok(off > 35 && off < 75, `turned ${off}° from the camera (width ${width})`);
  }
});

test('it is in the picture, wholly and fully shown, from the engagement\'s date through its stop to the proposal\'s end, on desktop and a phone', () => {
  for (const [width, aspect, fov] of LAYOUTS) {
    const spot = truckSpot(width), half = halfView(aspect, fov);
    for (let p = engaged; p <= engaged + .62 * ROOM; p += .001) {
      assert.equal(truckShown(p), 1, `shown at ${p}`);
      for (const corner of corners(spot)) {
        const { bearing, distance } = seen(p, width, corner.x, corner.z);
        assert.ok(Math.abs(bearing) < half - 1, `a corner at ${bearing}° at ${p} (width ${width})`);
        assert.ok(distance > 12 && distance < 32, `${distance} away at ${p}`);
      }
    }
    // At the stop, well inside the picture.
    const { bearing } = seen(stop, width, spot.x, spot.z);
    assert.ok(bearing > 0 && bearing < half - 3.5, `${bearing}° at the stop (width ${width})`);
  }
});

test('at the engagement\'s stop it is beside the catamaran, right of its starboard hull, not behind the proposal on the deck', () => {
  for (const [width] of LAYOUTS) {
    const spot = truckSpot(width), pose = boatPose(stop, width);
    const hulls = [-1, 1].map(side => seen(stop, width, pose.x + side * pose.gap * boatScale(width) * Math.cos(pose.yaw), pose.z - side * pose.gap * boatScale(width) * Math.sin(pose.yaw)).bearing);
    const deck = seen(stop, width, pose.x, pose.z).bearing;
    const nearest = Math.min(...corners(spot).map(corner => seen(stop, width, corner.x, corner.z).bearing));
    assert.ok(nearest > Math.max(...hulls) + 1, `its nearest corner ${nearest}° against the hull at ${Math.max(...hulls)}° (width ${width})`);
    assert.ok(nearest - deck > 4, `${nearest - deck}° from the deck (width ${width})`);
    // Further off than the boats, so it reads as their setting.
    assert.ok(seen(stop, width, spot.x, spot.z).distance > seen(stop, width, pose.x, pose.z).distance * 1.6);
  }
});

test('it keeps clear of the other scenery round the engagement, the trees and the reeds in front of it', async () => {
  const { YEAR_MARKERS, yearMarkerSpot } = await import('../src/components/garden/eggs/yearMarkerSpots.ts');
  const { RIGS, hangSpot } = await import('../src/components/garden/eggs/circusRigs.ts');
  const { SNOW_SPOTS, snowSpot } = await import('../src/components/garden/eggs/flurry.ts');
  const { bulletSpot } = await import('../src/components/garden/eggs/bulletOrnament.ts');
  const { nestSpots } = await import('../src/components/garden/eggs/nesting.ts');
  const { hagiaSophiaSpot } = await import('../src/components/garden/eggs/balloonCourse.ts');
  const { treePlacements } = await import('../src/components/garden/gardenTreeSpots.ts');
  const { plantGeometry, plantSites } = await import('../src/components/garden/gardenPlantGeometry.ts');
  for (const [width] of LAYOUTS) {
    const spot = truckSpot(width), under = truckFootprint(width);
    const others = [
      ...YEAR_MARKERS.map(marker => [marker.year, yearMarkerSpot(marker, width)]),
      ...Object.entries(RIGS).map(([name, rig]) => [name, hangSpot(rig, width)]),
      ['2025 snowmen', snowSpot(SNOW_SPOTS[2025], '2025-08', width)],
      ['bullet', bulletSpot(width)],
      ['Hagia Sophia', hagiaSophiaSpot('2026-07', width)],
      ...Object.values(nestSpots(width)).map(house => ['birdhouse', house]),
    ];
    for (const [name, other] of others) assert.ok(Math.hypot(other.x - spot.x, other.z - spot.z) > 5, `${name} crowds the truck (width ${width})`);
    // 2026's arch is on the other bank and well apart in the picture.
    const arch = yearMarkerSpot(YEAR_MARKERS.find(marker => marker.year === 2026), width);
    assert.ok(seen(stop, width, spot.x, spot.z).bearing - seen(stop, width, arch.x, arch.z).bearing > 15);
    // No trunk stands in it, nor a shrub's crown over it.
    for (const tree of treePlacements(width, width < 1)) assert.ok(!under(tree.x, tree.z, tree.type === 5 ? 1.2 : .6), `a tree at ${tree.x}, ${tree.z} (width ${width})`);
    // Nothing grows up through it, and no reed or cattail by the water rises
    // in front of its wheels as the camera sees it at the stop.
    for (const kind of ['grass', 'clover', 'fern', 'meadow']) assert.ok(plantSites(kind, width, width < 1).every(site => !under(site.x, site.z)), `${kind} under the truck`);
    const [cx, , cz] = cameraPose(stop, width).position, far = Math.hypot(spot.x - cx, spot.z - cz);
    const span = footprint(spot).map(corner => seen(stop, width, corner.x, corner.z).bearing), axles = spot.y + TRUCK_WHEELS.radius * spot.scale;
    for (const [kind, height] of [['reed', .94], ['cattail', 1.52]]) {
      const model = plantGeometry(kind);
      model.computeBoundingBox();
      assert.ok(Math.abs(model.boundingBox.max.y - height) < .01, `${kind}s as tall as they were`);
      for (const plant of plantSites(kind, width, width < 1)) {
        const { bearing, distance } = seen(stop, width, plant.x, plant.z);
        if (bearing < Math.min(...span) || bearing > Math.max(...span) || distance > far) continue;
        const line = GARDEN_CAMERA.height + (axles - GARDEN_CAMERA.height) * distance / far;
        assert.ok(plant.y + height * plant.scale < line, `a ${kind} at ${plant.x}, ${plant.z} in front of its wheels (width ${width})`);
      }
    }
  }
});

test('it dissolves in out of the haze just before the date, stays while the engagement plays, and is gone by the trip\'s stop', async () => {
  const { RIG_CHANGE } = await import('../src/components/garden/storyBoats.ts');
  const { PROPOSAL } = await import('../src/components/garden/eggs/proposal.ts');
  const trip = MILESTONES.find(m => m.month === '2026-07');
  const tripStop = STOPS[MILESTONES.indexOf(trip) + 1];
  assert.equal(truckShown(engaged - .4 * ROOM), 0, 'hidden before');
  assert.equal(truckShown(progressAt('2025-08')), 0, 'hidden at the snow trip');
  // Coming in as the old masts come down and the proposal's figures come out on deck.
  const arriving = truckShown(engaged + PROPOSAL.appear.cue * ROOM);
  assert.ok(arriving > 0 && arriving < 1, 'dissolving in as they come out on deck');
  assert.ok(TRUCK_TIMES.arrive <= RIG_CHANGE.furl[0], 'coming in as the small sails start to furl');
  // Wholly there from the date until the monogram is up, and the trip's date has shown.
  for (let t = 0; t <= Math.max(RIG_CHANGE.hoist[1], (progressAt(trip.month) - engaged) / ROOM); t += .01) assert.equal(truckShown(engaged + t * ROOM), 1, `at ${t}`);
  assert.equal(truckShown(tripStop), 0, 'gone at the trip\'s stop');
  for (const [width] of LAYOUTS) {
    let p = engaged;
    while (cameraPose(p, width).position[2] > truckSpot(width).z - 4) p += 1e-3;
    assert.equal(truckShown(p), 0, 'gone once passed');
  }
});

test('it is one small mesh within its budget, coloured and mapped all over', async () => {
  const { truckGeometry } = await import('../src/components/garden/eggs/truckGeometry.ts');
  const geometry = truckGeometry();
  const triangles = geometry.attributes.position.count / 3;
  assert.ok(triangles < 1200, `${triangles} triangles`);
  assert.equal(geometry.groups.length, 0, 'one draw call');
  assert.equal(geometry.attributes.color.count, geometry.attributes.position.count);
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) assert.ok(uv.getX(i) >= 0 && uv.getX(i) <= 1 && uv.getY(i) >= 0 && uv.getY(i) <= 1);
  // Its tyres stand on y 0, and it is about the size it says.
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox;
  assert.ok(Math.abs(min.y) < 1e-6, `its lowest point at ${min.y}`);
  assert.ok(max.z - min.z <= length && max.x - min.x <= across, 'within its footprint');
  geometry.dispose();
});
