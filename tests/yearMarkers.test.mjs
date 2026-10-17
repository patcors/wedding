import assert from 'node:assert/strict';
import test from 'node:test';
import { cameraPose } from '../src/components/garden/cameraRig.ts';
import { GARDEN_CAMERA, MOBILE_RIVER_WIDTH, bankEdge, islandHalfWidth, riverCenter } from '../src/components/garden/gardenGeometry.ts';
import { ROOM, dateLabel, routeAt } from '../src/components/garden/journey.ts';
import { BOAT_SCALE, HULL_HALF_BEAM, boatPose } from '../src/components/garden/storyBoats.ts';
import { MARKER_REACH, YEAR_MARKERS, markerShown, yearMarkerSpot, yearTurns } from '../src/components/garden/eggs/yearMarkerSpots.ts';

const LAYOUTS = [[1, 1440 / 900, GARDEN_CAMERA.fov], [MOBILE_RIVER_WIDTH, 390 / 844, GARDEN_CAMERA.mobileFov]];
const halfView = (aspect, fov) => Math.atan(Math.tan(fov / 2 * Math.PI / 180) * aspect) * 180 / Math.PI;

test('each year from 2017 to 2026 is marked once, each in its own medium', () => {
  assert.deepEqual(YEAR_MARKERS.map(m => m.year), [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]);
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
        const hull = pose.x + side * pose.gap * BOAT_SCALE * Math.cos(pose.yaw);
        assert.ok(Math.abs(hull - spot.x) > HULL_HALF_BEAM.dinghy * BOAT_SCALE + .4 * spot.scale, `${marker.year} clear of the hull (width ${width})`);
      }
    }
  }
});

test('markers stand apart along the river, and the 2022/2023 pair on opposite sides', () => {
  const spots = YEAR_MARKERS.map(m => yearMarkerSpot(m, 1));
  for (let i = 1; i < spots.length; i++) assert.ok(spots[i - 1].z - spots[i].z > 3, `${YEAR_MARKERS[i].year} apart`);
  const [y22, y23] = [2022, 2023].map(year => YEAR_MARKERS.find(m => m.year === year));
  assert.notEqual(y22.side, y23.side);
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
