import assert from 'node:assert/strict';
import test from 'node:test';
import { cameraPose } from '../src/components/garden/cameraRig.ts';
import { MOBILE_RIVER_WIDTH, bankEdge, riverCenter } from '../src/components/garden/gardenGeometry.ts';
import { progressAt } from '../src/components/garden/journey.ts';
import { cameraHeading } from '../src/components/garden/eggs/egg.ts';
import { DUCKS, duckLaunchSpot, piSpot } from '../src/components/garden/eggs/campus.ts';
import { CAPS, capLanding } from '../src/components/garden/eggs/capToss.ts';
import { SNOW_SPOTS, snowSpot } from '../src/components/garden/eggs/flurry.ts';
import { YEAR_MARKERS, markerShown, yearMarkerSpot, yearTurns } from '../src/components/garden/eggs/yearMarkerSpots.ts';
import { ORNAMENTS, ornamentSpot } from '../src/components/garden/eggs/uniOrnaments.ts';
import { MOBIUS, MOBIUS_PLINTH, mobiusGeometry } from '../src/components/garden/eggs/mobiusGeometry.ts';
import { TABLE, picnicTableGeometry } from '../src/components/garden/eggs/picnicTableGeometry.ts';
import { CANDLE, CANDLES, ORNAMENTS as WORK_ORNAMENTS, PIE, ornamentShown as workShown, ornamentSpot as workSpot } from '../src/components/garden/eggs/careerSpots.ts';

const degrees = radians => radians * 180 / Math.PI;
const WIDTHS = [1, MOBILE_RIVER_WIDTH];
// Half the picture's width in degrees: desktop at 16:10, portrait at 390 × 844.
const halfView = width => degrees(width < 1 ? Math.atan(Math.tan(34 * Math.PI / 180) * 390 / 844) : Math.atan(Math.tan(24 * Math.PI / 180) * 1.6));
// Degrees right of the middle of the picture, and distance, of a point from the camera at p.
const seen = (p, width, { x, z }) => {
  const [cx, , cz] = cameraPose(p, width).position;
  return { bearing: degrees(Math.atan2(x - cx, cz - z) - cameraHeading(p, width)), distance: Math.hypot(x - cx, z - cz) };
};
// Each spot as its component places it (half its footprint, in its own units).
const FOOTPRINT = { mobius: MOBIUS_PLINTH.width / 2, table: TABLE.length / 2, statsTrunk: .6, algebraTrunk: .6 };
const spots = width => Object.fromEntries(Object.entries(ORNAMENTS).map(([id, ornament]) => [id, ornamentSpot(ornament, width, FOOTPRINT[id])]));
const shown = (spot, p, width) => markerShown(spot.z, cameraPose(p, width).position[2], width < 1);
const span = (from, to, step = .002) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);

test('the university years\' ornaments stand on the banks, the trunks across the river from each other', () => {
  for (const width of WIDTHS) {
    const all = spots(width);
    for (const [id, spot] of Object.entries(all)) {
      const inland = Math.abs(spot.x - riverCenter(spot.z, width)) - bankEdge(spot.z, width);
      assert.ok(inland > 1, `${id} on land, ${inland} from the water`);
      assert.equal(Math.sign(spot.x - riverCenter(spot.z, width)), ORNAMENTS[id].side, `${id} on its own bank`);
    }
    // Across from each other, and from the π: the Möbius on its bank, the table on the other.
    assert.ok(Math.abs(all.statsTrunk.z - all.algebraTrunk.z) < 3);
    assert.equal(ORNAMENTS.statsTrunk.side, -ORNAMENTS.algebraTrunk.side);
    assert.equal(ORNAMENTS.mobius.side, 1);
    assert.equal(ORNAMENTS.table.side, -1);
  }
});

test('each is in the picture, near enough to read, while the boats pass, on desktop and a phone', () => {
  // When each is seen: the Möbius and the table from the meeting into the
  // spring, the table only briefly on a phone's narrow lens, around the
  // meeting's stop; the trunks from the internship into 2019, the algebra
  // trunk on a phone until 2019 turns, as it keeps outside the buoy.
  const windows = {
    mobius: [[1, progressAt('2017-07'), progressAt('2017-11')], [MOBILE_RIVER_WIDTH, progressAt('2017-07') + .003, progressAt('2017-09')]],
    table: [[1, progressAt('2017-08'), progressAt('2017-11') - .01], [MOBILE_RIVER_WIDTH, progressAt('2017-07') + .006, progressAt('2017-08') - .005]],
    statsTrunk: [[1, progressAt('2018-11'), progressAt('2019-07')], [MOBILE_RIVER_WIDTH, progressAt('2018-11'), progressAt('2019-07')]],
    algebraTrunk: [[1, progressAt('2018-11'), progressAt('2019-07')], [MOBILE_RIVER_WIDTH, progressAt('2018-11'), progressAt('2019-01')]],
  };
  for (const [id, layouts] of Object.entries(windows)) {
    for (const [width, from, to] of layouts) {
      const spot = spots(width)[id];
      for (const p of span(from, to)) {
        const { bearing, distance } = seen(p, width, spot);
        assert.ok(Math.abs(bearing) < halfView(width) - 2.5, `${id} at ${bearing}° at ${p} (width ${width})`);
        assert.ok(distance < 28, `${id} ${distance} away at ${p}`);
        assert.equal(shown(spot, p, width), 1, `${id} fully shown at ${p}`);
      }
    }
  }
});

test('they keep clear of the π, the year markers, the ducks, the snowman, the mortarboards and each other', () => {
  for (const width of WIDTHS) {
    const all = spots(width);
    const others = [piSpot(width < 1, width), snowSpot(SNOW_SPOTS[2019], '2019-07', width),
      ...YEAR_MARKERS.map(marker => yearMarkerSpot(marker, width)),
      ...CAPS.tosses.map(toss => capLanding('2020-08', toss, width)),
      ...DUCKS.launches.map((_, i) => duckLaunchSpot(i, width))];
    for (const [id, spot] of Object.entries(all)) {
      for (const other of [...others, ...Object.values(all).filter(o => o !== spot)]) {
        assert.ok(Math.hypot(other.x - spot.x, other.z - spot.z) > 4.8, `${id} clear of the scenery at ${other.x}, ${other.z}`);
      }
    }
  }
});

test('the Möbius stands just outside the π in the picture, so the two never overlap', () => {
  for (const width of WIDTHS) {
    const mobius = spots(width).mobius, pi = piSpot(width < 1, width);
    const reach = (MOBIUS.radius + MOBIUS.band) * mobius.scale, piReach = .73 * pi.scale;
    for (const p of span(progressAt('2017-01'), progressAt('2018-01'))) {
      if (!shown(mobius, p, width)) continue;
      const m = seen(p, width, mobius), q = seen(p, width, pi);
      const gap = m.bearing - degrees(Math.atan(reach / m.distance)) - q.bearing - degrees(Math.atan(piReach / q.distance));
      assert.ok(gap > 0, `${gap}° apart at ${p} (width ${width})`);
    }
  }
});

test('the table has gone from the picture before 2018\'s rock, and nothing stands in front of a year marker as its year turns', () => {
  for (const width of WIDTHS) {
    const all = spots(width);
    const { bearing } = seen(yearTurns(2018), width, all.table);
    assert.ok(Math.abs(bearing) > halfView(width), `table at ${bearing}° as 2018 turns`);
    // As each year turns, an ornament in the picture is well to the side of its marker.
    for (const marker of YEAR_MARKERS.filter(m => m.year >= 2017 && m.year <= 2020)) {
      const p = yearTurns(marker.year), m = seen(p, width, yearMarkerSpot(marker, width));
      for (const [id, spot] of Object.entries(all)) {
        const o = seen(p, width, spot);
        if (!shown(spot, p, width) || Math.abs(o.bearing) > halfView(width) || o.distance > m.distance + 12) continue;
        assert.ok(Math.abs(o.bearing - m.bearing) > 2.5, `${id} beside ${marker.year} (${o.bearing}° and ${m.bearing}°, width ${width})`);
      }
    }
  }
});

test('they keep apart from the working lives\' ornaments, on the ground and in the picture', async () => {
  const { TRUNK } = await import('../src/components/garden/eggs/carvedTrunkGeometry.ts');
  // Each piece's face as a level line across it, half its width either side
  // of its spot (in its own units): the trunks across their bodies above the
  // root flare, the Möbius across its loop, the table along its length, the
  // candlesticks' whole row, the duck's plinth and the pie's bed with its
  // pulled wedge.
  const HALF = { mobius: MOBIUS.radius + MOBIUS.band, table: TABLE.length / 2, statsTrunk: TRUNK.radius, algebraTrunk: TRUNK.radius };
  const WORK_HALF = [CANDLE.spacing * (CANDLES.length - 1) / 2 + CANDLE.body / 2, .5, PIE.radius + PIE.pull];
  // Degrees right of the middle of the picture of its two ends at p.
  const across = (p, width, spot, half) => {
    const ends = [-1, 1].map(s => seen(p, width, { x: spot.x + s * half * spot.scale * Math.cos(spot.yaw), z: spot.z - s * half * spot.scale * Math.sin(spot.yaw) }).bearing);
    return [Math.min(...ends), Math.max(...ends)];
  };
  for (const width of WIDTHS) {
    const all = spots(width), view = halfView(width);
    WORK_ORNAMENTS.forEach((work, i) => {
      const other = workSpot(work, width);
      for (const [id, spot] of Object.entries(all)) {
        assert.ok(Math.hypot(other.x - spot.x, other.z - spot.z) > 5, `${id} crowds the ornament for ${work.facing} on the ground (width ${width})`);
        // Whenever both show and both are in the picture, neither stands in front of the other.
        for (const p of span(progressAt('2017-07'), progressAt('2021-02'))) {
          if (!shown(spot, p, width) || !workShown(work, other, p, cameraPose(p, width).position[2], width < 1)) continue;
          const a = across(p, width, spot, HALF[id]), b = across(p, width, other, WORK_HALF[i]);
          if (a[1] < -view || a[0] > view || b[1] < -view || b[0] > view) continue;
          const gap = Math.max(a[0] - b[1], b[0] - a[1]);
          assert.ok(gap > 0, `${id} and the ornament for ${work.facing} overlap by ${-gap}° at ${p} (width ${width})`);
        }
      }
    });
  }
});

test('on Amelia\'s bank the 2019 snowman stands beside her carved trunk in the picture, never behind it', async () => {
  const { FLURRY } = await import('../src/components/garden/eggs/flurry.ts');
  const { TRUNK } = await import('../src/components/garden/eggs/carvedTrunkGeometry.ts');
  const { SNOWMAN } = await import('../src/components/garden/eggs/snowmanGeometry.ts');
  const { ROOM } = await import('../src/components/garden/journey.ts');
  for (const width of WIDTHS) {
    const trunk = spots(width).statsTrunk, snowman = snowSpot(SNOW_SPOTS[2019], '2019-07', width);
    // Its bottom ball's half width, at SnowTrip's scale (portrait's a little smaller).
    const half = SNOWMAN.balls[0][0] * 1.25 * (width < 1 ? .9 : 1);
    // From as the flurry clears until the trunk is passed.
    for (const p of span(progressAt('2019-07') + FLURRY.clear * ROOM, progressAt('2019-07') + ROOM)) {
      if (!shown(trunk, p, width)) continue;
      const t = seen(p, width, trunk), s = seen(p, width, snowman);
      const gap = s.bearing - degrees(Math.atan(half / s.distance)) - t.bearing - degrees(Math.atan(TRUNK.radius * trunk.scale / t.distance));
      assert.ok(gap > 0, `snowman behind the trunk by ${-gap}° at ${p} (width ${width})`);
    }
  }
});

test('each is drawn only while near the camera: not from the far end of the river, and gone once passed', () => {
  for (const width of WIDTHS) {
    for (const [id, spot] of Object.entries(spots(width))) {
      assert.equal(shown(spot, 0, width), 0, `${id} hidden at the opening`);
      assert.equal(shown(spot, progressAt('2021-02'), width), 0, `${id} hidden by Sydney`);
    }
    // The trunks wait until well after the meeting.
    const { statsTrunk, algebraTrunk } = spots(width);
    for (const trunk of [statsTrunk, algebraTrunk]) assert.equal(shown(trunk, progressAt('2017-09'), width), 0);
  }
});

test('each is a small mesh: well under 1,500 triangles and one draw call', async () => {
  const THREE = await import('three');
  const { carvedTrunksGeometry } = await import('../src/components/garden/eggs/carvedTrunkGeometry.ts');
  const triangles = geometry => (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3;
  const trunks = carvedTrunksGeometry(['stats', 'algebra'].map(carving => ({ carving, matrix: new THREE.Matrix4() })));
  for (const [name, geometry] of [['Möbius', mobiusGeometry()], ['table', picnicTableGeometry()], ['both trunks', trunks]]) {
    assert.ok(triangles(geometry) < 1500, `${name}: ${triangles(geometry)} triangles`);
    assert.equal(geometry.groups.length, 0, `${name} in one draw call`);
  }
});
