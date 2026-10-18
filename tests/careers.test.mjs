import assert from 'node:assert/strict';
import test from 'node:test';
import { cameraPose } from '../src/components/garden/cameraRig.ts';
import { GARDEN_CAMERA, MOBILE_RIVER_WIDTH, bankEdge, islandHalfWidth, riverCenter } from '../src/components/garden/gardenGeometry.ts';
import { MILESTONES, ROOM, STOPS, progressAt } from '../src/components/garden/journey.ts';
import { BOAT_SCALE, boatPose } from '../src/components/garden/storyBoats.ts';
import { cameraHeading } from '../src/components/garden/eggs/egg.ts';
import { CANDLES, CANDLESTICKS, ORNAMENTS, PIE, PIE_BED, WEDGES, candleBoxes, groundUnder, ornamentShown, ornamentSpot, pieBedFootprint, wedgeAngles } from '../src/components/garden/eggs/careerSpots.ts';
import { YEAR_MARKERS, yearMarkerSpot } from '../src/components/garden/eggs/yearMarkerSpots.ts';

const LAYOUTS = [[1, 1440 / 900, GARDEN_CAMERA.fov], [MOBILE_RIVER_WIDTH, 390 / 844, GARDEN_CAMERA.mobileFov]];
const halfView = (aspect, fov) => Math.atan(Math.tan(fov / 2 * Math.PI / 180) * aspect) * 180 / Math.PI;
const degrees = radians => radians * 180 / Math.PI;
// Degrees right of the middle of the picture, and distance, of a point from the camera at p.
const seen = (p, width, x, z) => {
  const [cx, , cz] = cameraPose(p, width).position;
  return { bearing: degrees(Math.atan2(x - cx, cz - z) - cameraHeading(p, width)), distance: Math.hypot(x - cx, z - cz) };
};
const shownAt = (ornament, p, width) => ornamentShown(ornament, ornamentSpot(ornament, width), p, cameraPose(p, width).position[2], width < 1);
const stop = id => STOPS[MILESTONES.findIndex(m => m.id === id) + 1];
// Each ornament's own stretch: from the month it stands for, or when it is fully in, to the milestone stop it is seen at.
const SEEN = [[CANDLESTICKS, '2018-01', 'internship'], [PIE_BED, '2023-03', 'heirwealth']];

test('the ornaments stand for the internship year and working together at HeirWealth', () => {
  assert.deepEqual(ORNAMENTS, [CANDLESTICKS, PIE_BED]);
  assert.equal(CANDLESTICKS.facing.slice(0, 4), '2018');
  assert.equal(PIE_BED.from, '2023-03');
});

test('each stands on land, off the island, near enough the water to be seen', () => {
  for (const [width] of LAYOUTS) {
    for (const ornament of ORNAMENTS) {
      const spot = ornamentSpot(ornament, width), out = Math.abs(spot.x - riverCenter(spot.z, width)), edge = bankEdge(spot.z, width);
      // The flower bed lies a little back from the water, its whole width clear of it.
      const reach = ornament === PIE_BED ? PIE.radius * spot.scale : 0;
      assert.ok(out - reach > edge + (reach ? .6 : .2) && out < edge + (reach ? 2.2 : 1.5), `${ornament.facing} on the bank (width ${width})`);
      assert.equal(Math.sign(spot.x - riverCenter(spot.z, width)), ornament.side);
      assert.equal(islandHalfWidth(spot.z, width), 0);
    }
  }
});

test('each is in the picture, fully shown, from its month to its milestone\'s stop on desktop and a phone', () => {
  for (const [width, aspect, fov] of LAYOUTS) {
    for (const [ornament, month, at] of SEEN) {
      const spot = ornamentSpot(ornament, width);
      for (let p = progressAt(month); p <= stop(at) + .2 * ROOM; p += .002) {
        assert.equal(shownAt(ornament, p, width), 1, `${ornament.facing} shown at ${p}`);
        const { bearing, distance } = seen(p, width, spot.x, spot.z);
        assert.ok(Math.abs(bearing) < halfView(aspect, fov) - 3, `${ornament.facing} at ${bearing}° at ${p} (width ${width})`);
        assert.ok(distance > 10 && distance < 26, `${ornament.facing} ${distance} away at ${p}`);
      }
    }
  }
});

test('at its milestone\'s stop each is clear of the boats and their flags, on a phone too', () => {
  for (const [width] of LAYOUTS) {
    for (const [ornament, , at] of SEEN) {
      const p = stop(at), spot = ornamentSpot(ornament, width), pose = boatPose(p, width);
      const { bearing } = seen(p, width, spot.x, spot.z);
      for (const side of [-1, 1]) {
        const hull = seen(p, width, pose.x + side * pose.gap * BOAT_SCALE * Math.cos(pose.yaw), pose.z - side * pose.gap * BOAT_SCALE * Math.sin(pose.yaw));
        // Outside the boat and the flag flying outboard of its masthead.
        assert.ok(Math.abs(bearing - hull.bearing) > 3.5, `${ornament.facing} behind a boat at ${at} (width ${width})`);
      }
    }
  }
});

test('each keeps clear of the year markers and the other eggs on the banks', async () => {
  const { piSpot } = await import('../src/components/garden/eggs/campus.ts');
  const { SNOW_SPOTS, snowSpot } = await import('../src/components/garden/eggs/flurry.ts');
  const { CAPS, capLanding } = await import('../src/components/garden/eggs/capToss.ts');
  const { nestSpots } = await import('../src/components/garden/eggs/nesting.ts');
  for (const [width] of LAYOUTS) {
    const others = [
      ...YEAR_MARKERS.map(marker => [marker.year, yearMarkerSpot(marker, width)]),
      ['π', piSpot(width < 1, width)],
      ['2019 snowman', snowSpot(SNOW_SPOTS[2019], '2019-07', width)],
      ['2025 snowmen', snowSpot(SNOW_SPOTS[2025], '2025-08', width)],
      ...CAPS.tosses.map(toss => ['mortarboard', capLanding('2020-08', toss, width)]),
      ...nestSpots(width).flatMap(pair => [['birdhouse', pair.amelia], ['birdhouse', pair.patrick]]),
    ];
    const spots = ORNAMENTS.map(ornament => ornamentSpot(ornament, width));
    for (const spot of spots) {
      for (const [name, other] of others) assert.ok(Math.hypot(other.x - spot.x, other.z - spot.z) > 5, `${name} crowds an ornament (width ${width})`);
      for (const another of spots) assert.ok(another === spot || Math.abs(another.z - spot.z) > 20);
    }
  }
});

test('the bank\'s rocks keep out of the flower bed, and only there', () => {
  for (const [width] of LAYOUTS) {
    const spot = ornamentSpot(PIE_BED, width), under = pieBedFootprint(width), r = PIE.radius * spot.scale;
    // Across the bed, and along it towards the camera, where it runs longer.
    const across = [Math.cos(spot.yaw), -Math.sin(spot.yaw)], along = [Math.sin(spot.yaw) * PIE.stretch, Math.cos(spot.yaw) * PIE.stretch];
    assert.ok(under(spot.x, spot.z));
    for (const [dx, dz] of [across, along]) {
      for (const side of [-1, 1]) {
        assert.ok(under(spot.x + side * dx * r * .98, spot.z + side * dz * r * .98), `rim inside (width ${width})`);
        assert.ok(!under(spot.x + side * dx * r * 1.05, spot.z + side * dz * r * 1.05), `beyond the rim (width ${width})`);
        assert.ok(under(spot.x + side * dx * (r + .2), spot.z + side * dz * (r + .2), .3), `a rock's width beyond (width ${width})`);
      }
    }
  }
});

test('each dissolves in no earlier than its month, and is gone once the camera has passed it', () => {
  for (const [width] of LAYOUTS) {
    for (const ornament of ORNAMENTS) {
      const spot = ornamentSpot(ornament, width);
      assert.equal(shownAt(ornament, progressAt(ornament.from) - .4 * ROOM, width), 0, `${ornament.facing} hidden before`);
      assert.equal(shownAt(ornament, progressAt(ornament.from), width), 1);
      let p = progressAt(ornament.from);
      while (cameraPose(p, width).position[2] > spot.z - 4) p += 1e-3;
      assert.equal(shownAt(ornament, p, width), 0, `${ornament.facing} gone once passed`);
    }
  }
});

test('the candles read as a stock chart and the bed as a pie chart, each in budget', async () => {
  const { FLOWER_HEADS, flowerHeadGeometry, pieBedGeometry, pieFlowers } = await import('../src/components/garden/eggs/careerGeometry.ts');
  // Wicks run from the ground through each body to its high; green months close up, red down.
  assert.ok(CANDLES.every(([open, close, high, low]) => high >= Math.max(open, close) && low <= Math.min(open, close)));
  assert.ok(CANDLES.some(([open, close]) => close < open) && CANDLES.some(([open, close]) => close > open));
  assert.equal(Math.max(...CANDLES.map(([, close]) => close)), CANDLES.at(-1)[1]);
  const boxes = candleBoxes();
  assert.equal(boxes.length, CANDLES.length * 2);
  // The wedges fill the circle, each its own colour, one of them HeirWealth's purple.
  assert.ok(Math.abs(WEDGES.reduce((sum, wedge) => sum + wedge.share, 0) - 1) < 1e-9);
  assert.equal(new Set(WEDGES.map(wedge => wedge.flowers)).size, WEDGES.length);
  assert.deepEqual(WEDGES.filter(wedge => wedge.heirWealth).map(wedge => wedge.flowers), ['#9c78b8']);
  const angles = wedgeAngles();
  assert.ok(Math.abs(angles.at(-1).to - angles[0].from - Math.PI * 2) < 1e-9);
  // Flowers on the ground, not a raised bed: every head low over the ground
  // beneath it and inside its own wedge, as many in each wedge as its share.
  for (const [width] of LAYOUTS) {
    const ground = groundUnder(ornamentSpot(PIE_BED, width), width), heads = pieFlowers(ground);
    const bed = pieBedGeometry(ground).attributes.position;
    for (let i = 0; i < bed.count; i++) {
      const lift = bed.getY(i) - ground(bed.getX(i), bed.getZ(i));
      assert.ok(lift > 0 && lift < .06, `the bed ${lift} off the ground (width ${width})`);
    }
    WEDGES.forEach((wedge, w) => {
      const inside = heads.filter(head => {
        const turn = Math.atan2(-head.z / PIE.stretch, head.x) - angles[w].from;
        return turn - Math.floor(turn / (Math.PI * 2)) * Math.PI * 2 < angles[w].to - angles[w].from && Math.hypot(head.x, head.z / PIE.stretch) < PIE.radius;
      });
      assert.equal(inside.length, Math.round(wedge.share * FLOWER_HEADS), `${wedge.flowers}'s flowers (width ${width})`);
      for (const head of inside) assert.ok(head.y - ground(head.x, head.z) < .15, 'a head low over the ground');
    });
  }
  const triangles = geometry => (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3;
  const budget = {
    candles: boxes.length * 12,
    bed: triangles(pieBedGeometry()) + pieFlowers().length * triangles(flowerHeadGeometry()),
  };
  for (const [name, count] of Object.entries(budget)) assert.ok(count < 1500, `${name}: ${count} triangles`);
});
