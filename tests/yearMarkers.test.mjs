import assert from 'node:assert/strict';
import test from 'node:test';
import { cameraPose } from '../src/components/garden/cameraRig.ts';
import { GARDEN_CAMERA, MOBILE_RIVER_WIDTH, VOYAGE, bankEdge, islandHalfWidth, riverCenter, voyageLandmarks } from '../src/components/garden/gardenGeometry.ts';
import { ROOM, VOYAGE_END, dateLabel, routeAt, scrolledSince } from '../src/components/garden/journey.ts';
import { boatScale, HULL_HALF_BEAM, boatPose } from '../src/components/garden/storyBoats.ts';
import { MARKER_REACH, YEAR_MARKERS, markerShown, markerSide, yearMarkerShown, yearMarkerSpot, yearTurns } from '../src/components/garden/eggs/yearMarkerSpots.ts';
import { hagiaShown, tripStop } from '../src/components/garden/eggs/balloonCourse.ts';
import { yearMarkerModel } from '../src/components/garden/eggs/yearMarkerGeometry.ts';

const LAYOUTS = [[1, 1440 / 900, GARDEN_CAMERA.fov], [MOBILE_RIVER_WIDTH, 390 / 844, GARDEN_CAMERA.mobileFov]];
const halfView = (aspect, fov) => Math.atan(Math.tan(fov / 2 * Math.PI / 180) * aspect) * 180 / Math.PI;

test('each year from 2017 to 2027 is marked once, each in its own medium', () => {
  assert.deepEqual(YEAR_MARKERS.map(m => m.year), [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027]);
  assert.equal(new Set(YEAR_MARKERS.map(m => m.medium)).size, YEAR_MARKERS.length);
});

test('the voyage opens in 2017, and every year turns during it', () => {
  assert.equal(dateLabel(yearTurns(2017) + 1e-6), 'January 2017');
  for (const { year } of YEAR_MARKERS) assert.equal(dateLabel(yearTurns(year) + 1e-6), `January ${year}`);
});

test('as its year turns, each marker stands just past the boats, in clear view', () => {
  for (const [width, aspect, fov] of LAYOUTS) {
    for (const marker of YEAR_MARKERS) {
      const p = yearTurns(marker.year), spot = yearMarkerSpot(marker, width);
      const [cx, , cz] = cameraPose(p, width).position, [tx, , tz] = cameraPose(p, width).target;
      assert.ok(spot.z < routeAt(p) && spot.z > routeAt(p) - 10, `${marker.year} beside the boats`);
      const ahead = cz - spot.z;
      assert.ok(ahead > 12 && ahead < 22, `${marker.year} is ${ahead} ahead`);
      assert.equal(markerShown(spot.z, cz, width < 1), 1, `${marker.year} fully shown`);
      // Within the picture, with a margin, on a phone's narrow lens too.
      const bearing = (Math.atan2(spot.x - cx, cz - spot.z) - Math.atan2(tx - cx, cz - tz)) * 180 / Math.PI;
      assert.ok(Math.abs(bearing) < halfView(aspect, fov) - 3, `${marker.year} at ${bearing}° (width ${width})`);
    }
  }
});

test('markers on the banks stand on land and those in the river keep clear of the boats', () => {
  for (const [width] of LAYOUTS) {
    for (const marker of YEAR_MARKERS) {
      const spot = yearMarkerSpot(marker, width), out = Math.abs(spot.x - riverCenter(spot.z, width));
      // Carved into a tree's trunk, the tree standing on the bank near the water, its foot on the ground.
      if ('carved' in marker) {
        assert.ok(out > bankEdge(spot.z, width) + .5 && out < bankEdge(spot.z, width) + 3, `${marker.year}'s tree near the water (width ${width})`);
        assert.equal(Math.sign(spot.x - riverCenter(spot.z, width)), markerSide(marker, width));
        continue;
      }
      if ('inland' in marker) {
        assert.ok(Math.abs(out - bankEdge(spot.z, width)) < 1, `${marker.year} at the water's edge`);
        assert.ok(islandHalfWidth(spot.z, width) === 0 || out > bankEdge(spot.z, width) - .2, `${marker.year} off the island`);
        continue;
      }
      assert.ok(out < bankEdge(spot.z, width), `${marker.year} in the river`);
      // Find where the boats pass it and check each hull clears it.
      let p = yearTurns(marker.year);
      while (routeAt(p) > spot.z) p += 1e-4;
      const pose = boatPose(p, width);
      for (const side of [-1, 1]) {
        const hull = pose.x + side * pose.gap * boatScale(width) * Math.cos(pose.yaw);
        assert.ok(Math.abs(hull - spot.x) > HULL_HALF_BEAM.dinghy * boatScale(width) + .4 * spot.scale, `${marker.year} clear of the hull (width ${width})`);
      }
    }
  }
});

test('markers stand apart along the river, further still when on the same bank', () => {
  for (const [width] of LAYOUTS) {
    const spots = YEAR_MARKERS.map(m => yearMarkerSpot(m, width));
    for (let i = 1; i < spots.length; i++) assert.ok(spots[i - 1].z - spots[i].z > 5, `${YEAR_MARKERS[i].year} apart`);
    // Two on the same bank are further apart still, so each reads on its own.
    const bank = m => ('inland' in m || 'carved' in m) && m.side;
    for (let i = 1; i < spots.length; i++) if (bank(YEAR_MARKERS[i]) === bank(YEAR_MARKERS[i - 1])) assert.ok(spots[i - 1].z - spots[i].z > 10, `${YEAR_MARKERS[i].year} crowds ${YEAR_MARKERS[i - 1].year}`);
  }
});

test('a marker dissolves in a little way ahead and is gone once passed', () => {
  const { desktop, fade, behind } = MARKER_REACH;
  assert.equal(markerShown(-50, -50 + desktop + 1, false), 0);
  assert.ok(Math.abs(markerShown(-50, -50 + desktop - fade / 2, false) - .5) < 1e-9);
  assert.equal(markerShown(-50, -40, false), 1);
  assert.equal(markerShown(-50, -50 - behind - .1, false), 0);
  // Not seen from the far end of the river: no marker shows before a year or so ahead of its own.
  for (const marker of YEAR_MARKERS.slice(1)) {
    const spot = yearMarkerSpot(marker, 1);
    const first = cameraPose(yearTurns(marker.year) - 2.6 * ROOM, 1).position[2];
    assert.equal(markerShown(spot.z, first, false), 0, `${marker.year} hidden well before`);
  }
});

test('2025\'s oar is slight: a slim oar stood in the bank, its year on the blade, in two draw calls', () => {
  const marker = YEAR_MARKERS.find(m => m.year === 2025);
  assert.equal(marker.medium, 'oar');
  const { body, face, hanging } = yearMarkerModel(marker, YEAR_MARKERS.indexOf(marker));
  assert.ok(face && !hanging);
  body.computeBoundingBox();
  face.computeBoundingBox();
  // Under half a unit across and about two tall, its loom pushed into the bank.
  const { min, max } = body.boundingBox;
  assert.ok(max.x - min.x < .5 && max.z - min.z < .5, 'slim');
  assert.ok(max.y > 1.7 && max.y < 2.1 && min.y < 0, 'stood in the bank');
  // The year is up on the blade, clear of the grass, and the face no wider than the blade.
  assert.ok(face.boundingBox.min.y > 1.1 && face.boundingBox.max.x - face.boundingBox.min.x < .3);
  const triangles = ((body.index ? body.index.count : body.attributes.position.count) + face.index.count) / 3;
  assert.ok(triangles < 400, `${triangles} triangles`);
});

test('on a phone 2025\'s oar stands on Patrick\'s bank, clear of his birdhouse in the picture and on the ground, out of the way of the 2025 snowmen on Amelia\'s', async () => {
  const { nestSpots, onHouse, signTree } = await import('../src/components/garden/eggs/nesting.ts');
  const { SNOW_SPOTS, snowSpot } = await import('../src/components/garden/eggs/flurry.ts');
  const { LYRA, hangSpot, rigTree } = await import('../src/components/garden/eggs/circusRigs.ts');
  const { progressAt } = await import('../src/components/garden/journey.ts');
  const marker = YEAR_MARKERS.find(m => m.year === 2025), width = MOBILE_RIVER_WIDTH;
  const oar = yearMarkerSpot(marker, width), house = nestSpots(width).patrick;
  assert.equal(markerSide(marker, width), 1);
  assert.ok(oar.x > riverCenter(oar.z, width) + bankEdge(oar.z, width), 'on Patrick\'s bank');
  const seen = (p, { x, z }) => {
    const [cx, , cz] = cameraPose(p, width).position, [tx, , tz] = cameraPose(p, width).target;
    return { bearing: (Math.atan2(x - cx, cz - z) - Math.atan2(tx - cx, cz - tz)) * 180 / Math.PI, distance: Math.hypot(x - cx, z - cz) };
  };
  // The corners of his house's roof, in its own frame: the oar stands left of them, further off.
  const roof = [[-.25, -.19], [.25, -.19], [-.25, .19], [.25, .19]].map(([x, z]) => onHouse(house, [x, 1.26, z]));
  for (let p = progressAt('2024-12'); p <= progressAt('2025-03'); p += .0005) {
    const left = Math.min(...roof.map(corner => seen(p, corner).bearing)), { bearing, distance } = seen(p, oar);
    // The blade's far edge, a fifth of a unit from its middle at a phone's scale, clear of the roof's left edge.
    assert.ok(bearing + (Math.atan(.2 * oar.scale / distance) * 180 / Math.PI) < left - .5, `oar behind the roof at ${p}`);
  }
  for (const other of [house, nestSpots(width).amelia, signTree(width), snowSpot(SNOW_SPOTS[2025], '2025-08', width), hangSpot(LYRA, width), rigTree(LYRA, width)]) {
    assert.ok(Math.hypot(other.x - oar.x, other.z - oar.z) > 4.5, `crowds ${other.x}, ${other.z}`);
  }
  // On desktop it stands where it did, on Amelia's bank.
  assert.equal(markerSide(marker, 1), -1);
  assert.ok(yearMarkerSpot(marker, 1).y >= 0);
});

test('2027\'s heart stands on the left bank round the S-bend, clear of the Hagia Sophia, and is out of the picture by the dock', () => {
  const marker = YEAR_MARKERS.find(m => m.year === 2027);
  assert.equal(marker.medium, 'heart');
  for (const [width, aspect, fov] of LAYOUTS) {
    const spot = yearMarkerSpot(marker, width), { jetty, tree } = voyageLandmarks(width);
    // On the outside of the bend's second curve, across the river from the
    // headland that hides the old tree, and well clear of the tree and jetty.
    assert.ok(spot.z < VOYAGE.bend.from - 15 && spot.z > VOYAGE.bend.to, `heart at z ${spot.z}`);
    assert.ok(spot.x < riverCenter(spot.z, width) - bankEdge(spot.z, width), `heart on the left bank (width ${width})`);
    assert.ok(Math.hypot(spot.x - tree.x, spot.z - tree.z) > 15 && Math.hypot(spot.x - jetty.x, spot.z - jetty.z) > 12, `heart clear of the dock (width ${width})`);
    // Passed before the dock's view, so it never crowds the jetty or the copy.
    for (let p = VOYAGE_END; p <= 1; p += .005) {
      const [cx, , cz] = cameraPose(p, width).position, [tx, , tz] = cameraPose(p, width).target;
      const bearing = (Math.atan2(spot.x - cx, cz - spot.z) - Math.atan2(tx - cx, cz - tz)) * 180 / Math.PI;
      assert.ok(markerShown(spot.z, cz, width < 1) === 0 || Math.abs(bearing) > halfView(aspect, fov) + 3, `heart in the dock's picture at p ${p} (width ${width})`);
    }
  }
  // Held back until the Hagia Sophia, far off down the river and just right of
  // it in the picture at the trip's stop, has sunk back into the haze.
  for (const [width] of LAYOUTS) {
    const spot = yearMarkerSpot(marker, width);
    assert.equal(yearMarkerShown(marker, spot.z, tripStop('2026-07'), cameraPose(tripStop('2026-07'), width).position[2], width < 1), 0);
    for (let p = tripStop('2026-07'); p < yearTurns(2027); p += .002) {
      if (yearMarkerShown(marker, spot.z, p, cameraPose(p, width).position[2], width < 1) === 0) continue;
      assert.equal(hagiaShown(scrolledSince('2026-07', p)), 0, `heart and Hagia Sophia both showing at p ${p} (width ${width})`);
    }
    assert.equal(yearMarkerShown(marker, spot.z, yearTurns(2027), cameraPose(yearTurns(2027), width).position[2], width < 1), 1);
  }
  // Two draw calls, like the others, and under budget.
  const { body, face, hanging } = yearMarkerModel(marker, YEAR_MARKERS.indexOf(marker));
  assert.ok(face && !hanging);
  const triangles = (body.attributes.position.count + face.index.count) / 3;
  assert.ok(triangles < 1500, `${triangles} triangles`);
});
