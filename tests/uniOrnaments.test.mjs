import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { cameraPose } from '../src/components/garden/cameraRig.ts';
import { MOBILE_RIVER_WIDTH, bankEdge, riverCenter } from '../src/components/garden/gardenGeometry.ts';
import { treePlacements } from '../src/components/garden/gardenTreeSpots.ts';
import { ROOM, STOPS, progressAt } from '../src/components/garden/journey.ts';
import { EGG_GROWTH, cameraHeading, eggSize, growth } from '../src/components/garden/eggs/egg.ts';
import { DUCKS, duckLaunchSpot, piSpot } from '../src/components/garden/eggs/campus.ts';
import { CAPS, capLanding } from '../src/components/garden/eggs/capToss.ts';
import { FLURRY, SNOW_GROW, SNOW_SPOTS, snowSpot } from '../src/components/garden/eggs/flurry.ts';
import { SNOWMAN } from '../src/components/garden/eggs/snowmanGeometry.ts';
import { ARRIVE, YEAR_MARKERS, markerShown, yearCarving, yearMarkerShown, yearMarkerSpot, yearTurns } from '../src/components/garden/eggs/yearMarkerSpots.ts';
import { CARVINGS, ORNAMENTS, carvedOn, carvedTree, carvingFaces, carvingShown, grownCut, CARVED_ARC, ornamentSpot } from '../src/components/garden/eggs/uniOrnaments.ts';
import { MOBIUS, MOBIUS_PLINTH, mobiusGeometry } from '../src/components/garden/eggs/mobiusGeometry.ts';
import { BENCH, parkBenchGeometry } from '../src/components/garden/eggs/parkBenchGeometry.ts';
import { LIFT, barkPatch, treeMatrix } from '../src/components/garden/eggs/barkCarvingGeometry.ts';
import { RIGS, hangSpot, rigShown, rigTree } from '../src/components/garden/eggs/circusRigs.ts';
import { harbourShown, operaHouseSpot } from '../src/components/garden/eggs/harbour.ts';
import { nestSpots } from '../src/components/garden/eggs/nesting.ts';
import { bulletSpot } from '../src/components/garden/eggs/bulletOrnament.ts';
import { CANDLE, CANDLES, CANDLESTICKS, ORNAMENTS as WORK_ORNAMENTS, PIE, ornamentShown as workShown, ornamentSpot as workSpot } from '../src/components/garden/eggs/careerSpots.ts';

const degrees = radians => radians * 180 / Math.PI;
const WIDTHS = [1, MOBILE_RIVER_WIDTH];
// Half the picture's width in degrees: desktop at 16:10, portrait at 390 × 844.
const halfView = width => degrees(width < 1 ? Math.atan(Math.tan(34 * Math.PI / 180) * 390 / 844) : Math.atan(Math.tan(24 * Math.PI / 180) * 1.6));
// Degrees right of the middle of the picture, degrees above the eye line, and distance, of a point from the camera at p.
const seen = (p, width, { x, y = 0, z }) => {
  const [cx, cy, cz] = cameraPose(p, width).position, distance = Math.hypot(x - cx, z - cz);
  return { bearing: degrees(Math.atan2(x - cx, cz - z) - cameraHeading(p, width)), elevation: degrees(Math.atan2(y - cy, distance)), distance };
};
// Each spot as its component places it (half its footprint, in its own units).
const FOOTPRINT = { mobius: MOBIUS_PLINTH.width / 2, bench: BENCH.length / 2 };
const spots = width => Object.fromEntries(Object.entries(ORNAMENTS).map(([id, ornament]) => [id, ornamentSpot(ornament, width, FOOTPRINT[id])]));
// The university years' two; the carvings further down the river are tested below.
const UNIVERSITY = ['stats', 'algebra'];
// Those cut on this layout (the spiral isn't on a phone).
const trees = width => Object.fromEntries(Object.entries(CARVINGS).filter(([, carving]) => carvedOn(carving, width)).map(([id, carving]) => [id, { ...carvedTree(carving, width), after: carving.after }]));
// The carvings show from desktop's reach on a phone too, the heart not before its month.
const shown = (spot, p, width) => 'type' in spot ? carvingShown(spot, cameraPose(p, width).position[2], p, spot.after) : markerShown(spot.z, cameraPose(p, width).position[2], width < 1);
const span = (from, to, step = .002) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);

// The carvings' patches, built on the trees' own models as BarkCarvings.tsx builds them.
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions([EXTMeshoptCompression]).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const MODELS = ['ash-1', 'ash-2', 'ash-1-distant', 'ash-2-distant'];
const meshes = await Promise.all(MODELS.map(async file => {
  const document = await io.read(`public/models/garden/${file}.glb`);
  const primitive = document.getRoot().listNodes().find(node => node.getName() === 'branches').getMesh().listPrimitives()[0];
  const position = primitive.getAttribute('POSITION'), normal = primitive.getAttribute('NORMAL');
  // getElement unpacks the packed normals.
  return { position: position.getArray(), normal: Array.from({ length: normal.getCount() }, (_, i) => normal.getElement(i, [])).flat(), index: primitive.getIndices().getArray() };
}));
const patch = (id, width) => {
  const carving = grownCut(CARVINGS[id], width), tree = carvedTree(carving, width);
  return barkPatch(meshes[tree.type], { matrix: treeMatrix(tree), toward: carvingFaces(carving, width), arc: carving.arc, from: carving.from, to: carving.to });
};
// The patch's point at (u, v) on the carving's canvas, and the normal of the face it is on.
const onPatch = ({ positions, uvs }, u, v) => {
  for (let t = 0; t < uvs.length / 2; t += 3) {
    const [a, b, c] = [0, 1, 2].map(k => new THREE.Vector2(uvs[(t + k) * 2], uvs[(t + k) * 2 + 1]));
    const weights = new THREE.Vector3();
    THREE.Triangle.getBarycoord(new THREE.Vector3(u, v, 0), new THREE.Vector3(a.x, a.y, 0), new THREE.Vector3(b.x, b.y, 0), new THREE.Vector3(c.x, c.y, 0), weights);
    if (Math.min(weights.x, weights.y, weights.z) < -1e-6) continue;
    const [pa, pb, pc] = [0, 1, 2].map(k => new THREE.Vector3().fromArray(positions, (t + k) * 3));
    const point = pa.clone().multiplyScalar(weights.x).addScaledVector(pb, weights.y).addScaledVector(pc, weights.z);
    return { point, normal: pb.clone().sub(pa).cross(pc.clone().sub(pa)).normalize() };
  }
  return null;
};
// The carving in the picture: the range of degrees across and up it covers at p.
const carvingInView = (id, width, p) => {
  const corners = [[0, 0], [1, 0], [0, 1], [1, 1], [.5, .5]].map(([u, v]) => seen(p, width, onPatch(patch(id, width), u, v).point));
  const range = key => [Math.min(...corners.map(c => c[key])), Math.max(...corners.map(c => c[key]))];
  return { bearing: range('bearing'), elevation: range('elevation'), distance: corners[4].distance };
};
const overlap = (a, b) => Math.min(a[1], b[1]) - Math.max(a[0], b[0]);

test('the university years\' ornaments stand on their banks, the Möbius across the river from the π', () => {
  for (const width of WIDTHS) {
    const all = spots(width);
    for (const [id, spot] of Object.entries(all)) {
      const inland = Math.abs(spot.x - riverCenter(spot.z, width)) - bankEdge(spot.z, width);
      assert.ok(inland > .5, `${id} on land, ${inland} from the water`);
      assert.equal(Math.sign(spot.x - riverCenter(spot.z, width)), ORNAMENTS[id].side, `${id} on its own bank`);
    }
    // The Möbius on Amelia's bank, the π on Patrick's, facing each other a little apart along the river.
    const pi = piSpot(width < 1, width);
    assert.equal(ORNAMENTS.mobius.side, -1);
    assert.equal(Math.sign(pi.x - riverCenter(pi.z, width)), 1);
    assert.ok(Math.abs(all.mobius.z - pi.z) < 4, `Möbius ${pi.z - all.mobius.z} upstream of the π`);
    // The bench back from the water, further than the π stands.
    const benchInland = Math.abs(all.bench.x - riverCenter(all.bench.z, width)) - bankEdge(all.bench.z, width);
    assert.equal(ORNAMENTS.bench.side, 1);
    assert.ok(benchInland > Math.abs(pi.x - riverCenter(pi.z, width)) - bankEdge(pi.z, width) + 1, `bench ${benchInland} from the water`);
  }
});

test('the bench stands among the trees, near one but clear of every trunk', () => {
  for (const width of WIDTHS) {
    const bench = spots(width).bench, c = Math.cos(bench.yaw), s = Math.sin(bench.yaw);
    // The gap from a trunk (about .45 across at its foot, in the tree's units) to the bench's footprint, back and all.
    const gaps = treePlacements(width, width < 1).map(tree => {
      const dx = tree.x - bench.x, dz = tree.z - bench.z, along = dx * c - dz * s, across = dx * s + dz * c;
      return Math.hypot(Math.max(0, Math.abs(along) - BENCH.length / 2 * bench.scale), Math.max(0, Math.abs(across) - (BENCH.depth / 2 + BENCH.rake) * bench.scale)) - .45 * tree.scale;
    });
    assert.ok(Math.min(...gaps) > .15, `bench ${Math.min(...gaps)} from a trunk (width ${width})`);
    assert.ok(Math.min(...gaps) < 1, `bench out in the open, ${Math.min(...gaps)} from the nearest trunk (width ${width})`);
  }
});

test('the carvings are cut into real riverside trees on their own banks', () => {
  for (const width of WIDTHS) {
    const placed = treePlacements(width, width < 1);
    for (const [id, tree] of Object.entries(trees(width))) {
      assert.ok(placed.some(p => p.x === tree.x && p.z === tree.z && p.type === tree.type), `${id} on a tree that stands there`);
      const inland = Math.abs(tree.x - riverCenter(tree.z, width)) - bankEdge(tree.z, width);
      assert.equal(Math.sign(tree.x - riverCenter(tree.z, width)), CARVINGS[id].side, `${id} on its own bank`);
      assert.ok(inland > 1 && inland < 7, `${id}'s tree ${inland} from the water`);
    }
    assert.equal(CARVINGS.stats.side, -1);
    assert.equal(CARVINGS.algebra.side, 1);
  }
});

test('each carving lies on its tree\'s bark, a hair proud of it, and faces the boats', () => {
  for (const width of WIDTHS) {
    for (const [id, tree] of Object.entries(trees(width))) {
      const piece = patch(id, width), matrix = treeMatrix(tree), mesh = meshes[tree.type];
      assert.ok(piece.positions.length / 9 < 100, `${id}: ${piece.positions.length / 9} triangles`);
      // Every corner of the patch sits just off a corner of the trunk, so it can't float or sink into it.
      const trunk = [];
      for (let i = 0; i < mesh.position.length; i += 3) if (mesh.position[i + 1] < 2.4 && Math.hypot(mesh.position[i], mesh.position[i + 2]) < .8) trunk.push(new THREE.Vector3().fromArray(mesh.position, i).applyMatrix4(matrix));
      for (let i = 0; i < piece.positions.length; i += 3) {
        const p = new THREE.Vector3().fromArray(piece.positions, i), lift = Math.min(...trunk.map(q => q.distanceTo(p)));
        assert.ok(Math.abs(lift - LIFT * tree.scale) < 1e-4, `${id} ${lift} off the bark (width ${width})`);
      }
      // The whole carving is on the patch: none of it runs off the faces copied.
      for (const u of span(0, 1, .1)) for (const v of span(0, 1, .1)) assert.ok(onPatch(piece, u, v), `${id} off its patch at ${u}, ${v}`);
      // Its middle faces the camera as its month shows, within half a face of the trunk's seven.
      const { point, normal } = onPatch(piece, .5, .5), camera = carvingFaces(CARVINGS[id], width);
      const toward = new THREE.Vector3(camera.x - point.x, 0, camera.z - point.z).normalize();
      assert.ok(degrees(Math.acos(normal.setY(0).normalize().dot(toward))) < 32, `${id} turned from the camera`);
    }
  }
});

test('each is in the picture while the boats pass, the ornaments near enough to read, on desktop and a phone', () => {
  // When each is seen: the Möbius and the bench from the meeting into the
  // spring, on a phone from just past the meeting's stop; the
  // carvings from the internship into 2019, though a phone sees a riverside
  // trunk only from well up the river: Amelia's through the first half of
  // 2018 and Patrick's from the spring until the internship.
  const windows = {
    mobius: [[1, progressAt('2017-07') + .006, progressAt('2017-11')], [MOBILE_RIVER_WIDTH, progressAt('2017-07') + .012, progressAt('2017-11')]],
    bench: [[1, progressAt('2017-07') + .006, progressAt('2017-10')], [MOBILE_RIVER_WIDTH, progressAt('2017-07') + .004, progressAt('2017-10')]],
    stats: [[1, progressAt('2018-11'), progressAt('2019-09')], [MOBILE_RIVER_WIDTH, progressAt('2018-01'), progressAt('2018-07')]],
    algebra: [[1, progressAt('2018-11'), progressAt('2019-05')], [MOBILE_RIVER_WIDTH, progressAt('2018-04'), progressAt('2018-11')]],
  };
  for (const [id, layouts] of Object.entries(windows)) {
    for (const [width, from, to] of layouts) {
      const spot = id in ORNAMENTS ? spots(width)[id] : trees(width)[id];
      for (const p of span(from, to)) {
        const { bearing, distance } = seen(p, width, spot);
        assert.ok(Math.abs(bearing) < halfView(width) - 2, `${id} at ${bearing}° at ${p} (width ${width})`);
        if (id in ORNAMENTS) assert.ok(distance < 28, `${id} ${distance} away at ${p}`);
        assert.equal(shown(spot, p, width), 1, `${id} fully shown at ${p}`);
      }
    }
  }
  // On desktop each carving comes near enough to make out, as near as the
  // trees along its bank allow.
  for (const id of UNIVERSITY) {
    const nearest = Math.min(...span(progressAt('2018-11'), progressAt('2019-09')).filter(p => Math.abs(seen(p, 1, trees(1)[id]).bearing) < halfView(1) - 2).map(p => seen(p, 1, trees(1)[id]).distance));
    assert.ok(nearest < 24, `${id} no nearer than ${nearest}`);
  }
});

test('they keep clear of the π, the year markers, the ducks, the snowman, the mortarboards and each other', () => {
  // The carvings take no ground of their own, so their trees need only keep
  // a little apart from the rest; the picture is what matters (see below).
  for (const width of WIDTHS) {
    const all = { ...spots(width), ...trees(width) };
    const others = [piSpot(width < 1, width), snowSpot(SNOW_SPOTS[2019], '2019-07', width),
      ...YEAR_MARKERS.map(marker => yearMarkerSpot(marker, width)),
      ...CAPS.tosses.map(toss => capLanding('2020-08', toss, width)),
      ...DUCKS.launches.map((_, i) => duckLaunchSpot(i, width))];
    for (const [id, spot] of Object.entries(all)) {
      for (const other of [...others, ...Object.values(all).filter(o => o !== spot)]) {
        assert.ok(Math.hypot(other.x - spot.x, other.z - spot.z) > (id in CARVINGS ? 3.5 : 4.8), `${id} clear of the scenery at ${other.x}, ${other.z}`);
      }
    }
  }
});

test('the Möbius is in the picture with 2018\'s rock only well apart from it, and nothing stands beside a year marker as its year turns', () => {
  for (const width of WIDTHS) {
    const all = { ...spots(width), ...trees(width) };
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

test('they keep apart from the working lives\' ornaments, on the ground and in the picture', () => {
  // Each piece's face as a level line across it, half its width either side
  // of its spot (in its own units): the Möbius across its loop, the bench
  // along its length, the candlesticks' whole row and the pie's bed with its
  // pulled wedge.
  const HALF = { mobius: MOBIUS.radius + MOBIUS.band, bench: BENCH.length / 2 };
  const WORK_HALF = [CANDLE.spacing * (CANDLES.length - 1) / 2 + CANDLE.body / 2, PIE.radius];
  // Degrees right of the middle of the picture of its two ends at p.
  const across = (p, width, spot, half) => {
    const ends = [-1, 1].map(s => seen(p, width, { x: spot.x + s * half * spot.scale * Math.cos(spot.yaw), z: spot.z - s * half * spot.scale * Math.sin(spot.yaw) }).bearing);
    return [Math.min(...ends), Math.max(...ends)];
  };
  for (const width of WIDTHS) {
    const all = spots(width), view = halfView(width);
    WORK_ORNAMENTS.forEach((work, i) => {
      const other = workSpot(work, width);
      // The carvings take no ground of their own, so their trees need only keep a little apart.
      for (const [id, spot] of Object.entries({ ...all, ...trees(width) })) {
        assert.ok(Math.hypot(other.x - spot.x, other.z - spot.z) > (id in CARVINGS ? 3.5 : 5), `${id} crowds the ornament for ${work.facing} on the ground (width ${width})`);
      }
      for (const [id, spot] of Object.entries(all)) {
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

test('Amelia\'s carving shows above her candlestick posts in the picture, not behind them', () => {
  for (const width of WIDTHS) {
    const row = workSpot(CANDLESTICKS, width), tree = trees(width).stats;
    for (const p of span(progressAt('2018-01'), progressAt('2019-07'))) {
      if (!shown(tree, p, width) || !workShown(CANDLESTICKS, row, p, cameraPose(p, width).position[2], width < 1)) continue;
      const carving = carvingInView('stats', width, p);
      if (carving.bearing[1] < -halfView(width)) continue;
      // Each post's painted body, from the ground to the top of its month.
      CANDLES.forEach(([open, close], i) => {
        const along = (i - (CANDLES.length - 1) / 2) * CANDLE.spacing * row.scale;
        const foot = { x: row.x + along * Math.cos(row.yaw), y: row.y, z: row.z - along * Math.sin(row.yaw) };
        const top = seen(p, width, { ...foot, y: row.y + Math.max(open, close) * row.scale }), half = degrees(Math.atan(CANDLE.body / 2 * row.scale / top.distance));
        const covered = overlap(carving.bearing, [top.bearing - half, top.bearing + half]) > 0 && overlap(carving.elevation, [seen(p, width, foot).elevation, top.elevation]) > 0;
        assert.ok(!covered, `post ${i} in front of the carving at ${p} (width ${width})`);
      });
    }
  }
});

test('on Amelia\'s bank the 2019 snowman stands clear of her carving in the picture', () => {
  for (const width of WIDTHS) {
    const tree = trees(width).stats, snowman = snowSpot(SNOW_SPOTS[2019], '2019-07', width);
    // Its bottom ball's half width, at SnowTrip's scale (portrait's a little smaller), and its height.
    const size = 1.25 * (width < 1 ? .9 : 1) * growth(width < 1, SNOW_GROW), half = SNOWMAN.balls[0][0] * size;
    // From as the flurry clears until the carving is passed.
    for (const p of span(progressAt('2019-07') + FLURRY.clear * ROOM, progressAt('2020-08'))) {
      if (!shown(tree, p, width)) continue;
      const carving = carvingInView('stats', width, p), s = seen(p, width, snowman), wide = degrees(Math.atan(half / s.distance));
      const covered = overlap(carving.bearing, [s.bearing - wide, s.bearing + wide]) > 0 && overlap(carving.elevation, [s.elevation, seen(p, width, { ...snowman, y: snowman.y + 2 * size }).elevation]) > 0;
      assert.ok(!covered, `snowman in front of the carving at ${p} (width ${width})`);
    }
  }
});

test('each is drawn only while near the camera: not from the far end of the river, and gone once passed', () => {
  for (const width of WIDTHS) {
    for (const [id, spot] of Object.entries({ ...spots(width), ...trees(width) })) {
      assert.equal(shown(spot, 0, width), 0, `${id} hidden at the opening`);
      const passed = span(0, 1, .001).find(p => cameraPose(p, width).position[2] < spot.z - 3.5);
      assert.equal(shown(spot, passed, width), 0, `${id} hidden once passed`);
    }
    // The Möbius and the bench are gone by the snow trip; the carvings aren't drawn as the boats meet.
    for (const spot of Object.values(spots(width))) assert.equal(shown(spot, progressAt('2019-07'), width), 0);
    for (const id of UNIVERSITY) assert.equal(shown(trees(width)[id], progressAt('2017-09'), width), 0);
  }
});

test('the Möbius and the bench are small meshes: well under 1,500 triangles and one draw call each', () => {
  const triangles = geometry => (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3;
  for (const [name, geometry] of [['Möbius', mobiusGeometry()], ['bench', parkBenchGeometry()]]) {
    assert.ok(triangles(geometry) < 1500, `${name}: ${triangles(geometry)} triangles`);
    assert.equal(geometry.groups.length, 0, `${name} in one draw call`);
  }
});

test('the Möbius strip\'s half twist is spread evenly round the loop and it stands on its plinth', () => {
  const geometry = mobiusGeometry(), position = geometry.attributes.position;
  // The band comes first in the mesh, before the plinth: a ring of eight round its section at each step.
  const band = Array.from({ length: MOBIUS.segments * 8 * 6 }, (_, i) =>
    new THREE.Vector3().fromBufferAttribute(position, i).applyAxisAngle(new THREE.Vector3(0, 1, 0), -MOBIUS.turn));
  // Its lowest point rests on the plinth's top.
  const lowest = Math.min(...band.map(p => p.y));
  assert.ok(Math.abs(lowest - (MOBIUS_PLINTH.height - .025)) < 1e-6, `loop's foot at ${lowest}`);
  // At each point on its edges, the band's width points round from the loop
  // by half as far as that point is round the loop from its foot.
  const middle = band.reduce((sum, p) => sum + p.y, 0) / band.length;
  let edges = 0;
  for (const p of band) {
    const u = Math.atan2(p.y - middle, p.x), out = new THREE.Vector3(Math.cos(u), Math.sin(u), 0);
    const offset = new THREE.Vector3(p.x, p.y - middle, p.z).addScaledVector(out, -MOBIUS.radius);
    if (offset.length() < MOBIUS.band * .95) continue;
    edges++;
    const round = (u + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2), twist = Math.atan2(offset.z, offset.dot(out));
    const off = twist - MOBIUS.phase - round / 2, wrapped = Math.atan2(Math.sin(2 * off), Math.cos(2 * off)) / 2;
    assert.ok(Math.abs(wrapped) < .03, `band turned ${wrapped} from an even twist at ${round}`);
  }
  assert.ok(edges >= MOBIUS.segments * 2, `${edges} points on its edges`);
});

// The carvings further down the river, each in a quiet stretch of its own:
// a sloop on Amelia's bank before they meet, a golden spiral on Patrick's
// through 2021, two sloops side by side there as the boats come back
// alongside, and a heart with P + A in the S-bend as the wedding comes.
const FOUND = ['sloop', 'spiral', 'sloops', 'heart'];
const stopAfter = month => STOPS.find(stop => stop > progressAt(month));
// When each is wholly in the picture, desktop then phone.
const FOUND_WINDOWS = {
  sloop: [[progressAt('2017-03'), progressAt('2017-07')], [progressAt('2017-03'), progressAt('2017-05')]],
  spiral: [[progressAt('2021-07'), progressAt('2022-08')], null],
  sloops: [[progressAt('2022-09'), stopAfter('2023-03')], [progressAt('2022-09'), progressAt('2022-12')]],
  heart: [[progressAt('2026-11') + ARRIVE * ROOM + 1e-6, progressAt('2027-03')], [progressAt('2026-11') + ARRIVE * ROOM + 1e-6, progressAt('2027-02')]],
};

test('the carvings further down the river are on real trees of their own, on their banks, clear of the trees already used', () => {
  assert.equal(CARVINGS.sloop.side, -1);
  for (const id of ['spiral', 'sloops', 'heart']) assert.equal(CARVINGS[id].side, 1);
  for (const width of WIDTHS) {
    const all = trees(width), mine = Object.entries(all).filter(([id]) => FOUND.includes(id));
    // Not the university years' trees, 2020's ash or the circus's ashes.
    const used = [...UNIVERSITY.map(id => all[id]), yearCarving(YEAR_MARKERS.find(m => 'carved' in m), width).tree, ...Object.values(RIGS).map(rig => rigTree(rig, width))];
    // And none of the trees round 2024's birdhouses, which keep their own scenery.
    const houses = Object.values(nestSpots(width));
    for (const [id, tree] of mine) {
      for (const other of used) assert.ok(other.x !== tree.x || other.z !== tree.z, `${id} on a tree already used (width ${width})`);
      for (const house of houses) assert.ok(Math.hypot(house.x - tree.x, house.z - tree.z) > 12, `${id} among the birdhouses' trees (width ${width})`);
    }
    // One tree each.
    assert.equal(new Set(mine.map(([, tree]) => `${tree.x},${tree.z}`)).size, mine.length);
  }
});

test('the heart with P + A waits until November 2026, then dissolves in with 2027\'s heart across the river; the others aren\'t held back', async () => {
  const { tripStop } = await import('../src/components/garden/eggs/balloonCourse.ts');
  const hold = progressAt(CARVINGS.heart.after), board = YEAR_MARKERS.find(m => m.year === 2027);
  assert.equal(CARVINGS.heart.after, board.from);
  for (const id of FOUND.filter(id => id !== 'heart')) assert.equal(CARVINGS[id].after, undefined);
  for (const width of WIDTHS) {
    const tree = trees(width).heart, spot = yearMarkerSpot(board, width);
    // Hidden as the Hagia Sophia comes, at the trip's stop and on until
    // November 2026 shows, near as its tree is.
    for (const p of span(progressAt('2026-05'), hold)) assert.equal(shown(tree, p, width), 0, `heart carving at ${p} (width ${width})`);
    assert.ok(markerShown(tree.z, cameraPose(tripStop('2026-07'), width).position[2], false) === 1, 'its tree in reach at the trip\'s stop');
    // In step with the board: never more in than it, and in full with it.
    for (const p of span(hold, progressAt('2027-01'), .0005)) {
      const cz = cameraPose(p, width).position[2], carving = shown(tree, p, width), heart = yearMarkerShown(board, spot.z, p, cz, width < 1);
      assert.ok(carving <= heart + 1e-9, `carving ahead of the board at ${p} (width ${width})`);
      if (heart === 1) assert.equal(carving, 1, `carving behind the board at ${p} (width ${width})`);
    }
  }
});

test('each is wholly in the picture through its stretch, near enough to make out on desktop', () => {
  for (const id of FOUND) {
    WIDTHS.forEach((width, layout) => {
      if (!FOUND_WINDOWS[id][layout]) return assert.equal(carvedOn(CARVINGS[id], width), false);
      const [from, to] = FOUND_WINDOWS[id][layout], tree = trees(width)[id];
      let nearest = Infinity;
      for (const p of span(from, to)) {
        const { bearing, distance } = carvingInView(id, width, p);
        assert.ok(bearing[0] > -halfView(width) + 1 && bearing[1] < halfView(width) - 1, `${id} at ${bearing}° at ${p} (width ${width})`);
        assert.equal(shown(tree, p, width), 1, `${id} fully shown at ${p} (width ${width})`);
        nearest = Math.min(nearest, distance);
      }
      // As near as the trees along its bank allow: on a phone the sloop and the spiral are seen only from well up the river.
      const near = width < 1 ? { sloop: 27, sloops: 28, heart: 14 } : { sloop: 26, spiral: 25, sloops: 19, heart: 12 };
      assert.ok(nearest < near[id], `${id} no nearer than ${nearest} (width ${width})`);
    });
  }
});

test('they keep clear of the other scenery, on the ground and in the picture', () => {
  for (const width of WIDTHS) {
    const mobile = width < 1, all = trees(width);
    const ground = [piSpot(mobile, width), snowSpot(SNOW_SPOTS[2019], '2019-07', width), snowSpot(SNOW_SPOTS[2025], '2025-08', width), operaHouseSpot(width), bulletSpot(width),
      ...YEAR_MARKERS.map(marker => yearMarkerSpot(marker, width)), ...CAPS.tosses.map(toss => capLanding('2020-08', toss, width)),
      ...DUCKS.launches.map((_, i) => duckLaunchSpot(i, width)), ...Object.values(spots(width)), ...WORK_ORNAMENTS.map(work => workSpot(work, width)),
      ...Object.values(RIGS).map(rig => hangSpot(rig, width)), ...Object.values(nestSpots(width))];
    for (const id of FOUND.filter(id => id in all)) {
      const tree = all[id];
      for (const other of [...ground, ...Object.values(all).filter(t => t !== tree)]) {
        assert.ok(Math.hypot(other.x - tree.x, other.z - tree.z) > 3.5, `${id} crowds the scenery at ${other.x}, ${other.z} (width ${width})`);
      }
      // Whenever it shows in the picture, nothing else on the banks that shows
      // stands beside it there: each taken as up to 1.5 above its foot.
      const others = [
        ...YEAR_MARKERS.map(marker => { const spot = yearMarkerSpot(marker, width); return { name: marker.year, spot, shown: (p, cz) => yearMarkerShown(marker, spot.z, p, cz, mobile) }; }),
        ...Object.entries(RIGS).map(([name, rig]) => { const spot = hangSpot(rig, width); return { name, spot, shown: (p, cz) => rigShown(rig, spot, p, cz, mobile) }; }),
        ...WORK_ORNAMENTS.map(work => { const spot = workSpot(work, width); return { name: work.facing, spot, shown: (p, cz) => workShown(work, spot, p, cz, mobile) }; }),
        { name: 'Opera House', spot: operaHouseSpot(width), shown: (p, cz) => harbourShown(p, cz, mobile).opera },
        ...Object.entries(all).filter(([other]) => other !== id).map(([name, spot]) => ({ name, spot, shown: (p, cz) => carvingShown(spot, cz, p, spot.after) })),
      ];
      for (const p of span(.05, .92, .004)) {
        const cz = cameraPose(p, width).position[2];
        if (!shown(tree, p, width)) continue;
        const carving = carvingInView(id, width, p);
        if (carving.bearing[1] < -halfView(width) || carving.bearing[0] > halfView(width)) continue;
        for (const other of others) {
          if (!other.shown(p, cz)) continue;
          const o = seen(p, width, other.spot), top = seen(p, width, { ...other.spot, y: other.spot.y + 1.5 * (other.spot.scale ?? 1) });
          if (Math.abs(o.bearing) > halfView(width) || o.distance > 34) continue;
          const gap = Math.max(o.bearing - carving.bearing[1], carving.bearing[0] - o.bearing);
          const above = Math.max(o.elevation - carving.elevation[1], carving.elevation[0] - top.elevation);
          assert.ok(gap > 2 || above > 1, `${id} beside ${other.name} in the picture (${gap}° apart, ${above}° above) at ${p} (width ${width})`);
        }
      }
    }
  }
});

test('nothing beside a year marker as its year turns, and never more than two carvings in the picture at once', () => {
  for (const width of WIDTHS) {
    const all = trees(width);
    for (const marker of YEAR_MARKERS) {
      const p = yearTurns(marker.year), m = seen(p, width, yearMarkerSpot(marker, width));
      for (const id of FOUND.filter(id => id in all)) {
        const o = seen(p, width, all[id]);
        if (!shown(all[id], p, width) || Math.abs(o.bearing) > halfView(width)) continue;
        assert.ok(Math.abs(o.bearing - m.bearing) > 2.5, `${id} beside ${marker.year} (width ${width})`);
      }
    }
    for (const p of span(0, 1, .002)) {
      // Those shown but out of the picture, behind the camera or off to the side, are culled.
      const drawn = Object.values(all).filter(tree => shown(tree, p, width) > 0 && Math.abs(seen(p, width, tree).bearing) < halfView(width) + 5).length;
      assert.ok(drawn <= 2, `${drawn} carvings in the picture at ${p} (width ${width})`);
    }
  }
});

test('the eggs grow more on a phone than on desktop, each by its own growth where it has one', () => {
  assert.ok(EGG_GROWTH.mobile > EGG_GROWTH.desktop && EGG_GROWTH.desktop >= 1);
  assert.equal(eggSize({ desktop: 2, mobile: 3 }, false), 2 * EGG_GROWTH.desktop);
  assert.equal(eggSize({ desktop: 2, mobile: 3 }, true), 3 * EGG_GROWTH.mobile);
  assert.equal(eggSize({ desktop: 2, mobile: 3 }, true, { desktop: 1.1 }), 3 * EGG_GROWTH.mobile);
  assert.equal(eggSize({ desktop: 2, mobile: 3 }, false, { desktop: 1.1 }), 2 * 1.1);
});

test('a carving grows round its trunk only so far, and up it from its foot keeping its shape', () => {
  for (const width of WIDTHS) {
    for (const carving of [...Object.values(CARVINGS), ...YEAR_MARKERS.filter(marker => 'carved' in marker).map(marker => marker.carved)]) {
      const cut = grownCut(carving, width);
      assert.equal(cut.from, carving.from, 'its foot stays where it was');
      assert.ok(cut.arc >= carving.arc && cut.arc <= Math.max(carving.arc, CARVED_ARC));
      assert.ok(cut.arc <= carving.arc * growth(width < 1) + 1e-9);
      // Up the trunk as much as it looks wider round it.
      assert.ok(Math.abs((cut.to - cut.from) / (carving.to - carving.from) - Math.sin(cut.arc) / Math.sin(carving.arc)) < 1e-9);
      assert.ok(cut.to < 2.4, 'still on the trunk, below its first branches');
    }
  }
});
