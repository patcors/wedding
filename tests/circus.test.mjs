import assert from 'node:assert/strict';
import test from 'node:test';
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { cameraPose } from '../src/components/garden/cameraRig.ts';
import { GARDEN_CAMERA, MOBILE_RIVER_WIDTH, bankEdge, riverCenter } from '../src/components/garden/gardenGeometry.ts';
import { MILESTONES, ROOM, STOPS, progressAt } from '../src/components/garden/journey.ts';
import { treePlacements } from '../src/components/garden/gardenTreeSpots.ts';
import { cameraHeading } from '../src/components/garden/eggs/egg.ts';
import { BIRD, LYRA, RIGS, SILK, hangSpot, onTree, rigShown, rigTree } from '../src/components/garden/eggs/circusRigs.ts';
import { YEAR_MARKERS, yearMarkerSpot } from '../src/components/garden/eggs/yearMarkerSpots.ts';

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions([EXTMeshoptCompression]).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
// The models GardenTrees.tsx draws for each type of tree, near enough to be seen.
const MODELS = ['ash-1', 'ash-2', 'ash-1-distant', 'ash-2-distant'];
const branches = {};
for (const [type, file] of MODELS.entries()) {
  const document = await io.read(`public/models/garden/${file}.glb`);
  const node = document.getRoot().listNodes().find(n => n.getName() === 'branches');
  branches[type] = node.getMesh().listPrimitives()[0].getAttribute('POSITION').getArray();
}

const LAYOUTS = [[1, 1440 / 900, GARDEN_CAMERA.fov], [MOBILE_RIVER_WIDTH, 390 / 844, GARDEN_CAMERA.mobileFov]];
const halfView = (aspect, fov) => Math.atan(Math.tan(fov / 2 * Math.PI / 180) * aspect) * 180 / Math.PI;
const degrees = radians => radians * 180 / Math.PI;
const stop = id => STOPS[MILESTONES.findIndex(m => m.id === id) + 1];
const limb = (rig, width) => width < 1 ? rig.limb.mobile : rig.limb.desktop;
const inland = (x, z, width) => riverCenter(z, width) - x - bankEdge(z, width);
// Each one's stretch in the picture: the silk from November 2022 to January
// 2023's stop, the lyra and the bird from October 2025 to just past salsa's stop.
const SEEN = [[SILK, '2022-11', stop('amelia-heirwealth')], [LYRA, '2025-10', stop('salsa')], [BIRD, '2025-10', stop('salsa')]];

test('each hangs on Amelia\'s bank, the left, from a tree standing there', () => {
  for (const [width] of LAYOUTS) {
    for (const rig of Object.values(RIGS)) {
      const tree = rigTree(rig, width), spot = hangSpot(rig, width);
      assert.ok(treePlacements(width, width < 1).some(t => t.x === tree.x && t.z === tree.z && t.type === tree.type));
      assert.ok(inland(tree.x, tree.z, width) > 2 && inland(tree.x, tree.z, width) < 6, `its tree stands near the water (width ${width})`);
      assert.ok(spot.x < riverCenter(spot.z, width), `left of the river (width ${width})`);
      assert.ok(inland(spot.x, spot.z, width) > -.2, 'over the bank, not the river');
    }
  }
  // Between the 2022 and 2023 year turns, once Amelia's interim flag is up.
  assert.ok(SILK.from > '2022-08' && SILK.from < '2023-01', 'the silk late in 2022');
  // October 2025: her circus show that year (Amelia asked for about 2024; see circusRigs.ts).
  assert.equal(LYRA.from, '2025-10');
});

test('each hangs from the underside of a real branch, with nothing in the way below', () => {
  for (const [width] of LAYOUTS) {
    for (const [id, rig] of Object.entries(RIGS)) {
      const tree = rigTree(rig, width), vertices = branches[tree.type], [lx, ly, lz] = limb(rig, width);
      let nearest = Infinity;
      for (let i = 0; i < vertices.length; i += 3) nearest = Math.min(nearest, Math.hypot(vertices[i] - lx, vertices[i + 1] - ly, vertices[i + 2] - lz));
      assert.ok(nearest < .01, `${id}'s limb is on the bark (${nearest})`);
      // Out on a limb, not the trunk, and above the tree's first branches.
      assert.ok(Math.hypot(lx, lz) > 2 && ly > 3, `${id} hangs from a limb`);
      // The rope, strop or feet drop straight down from it, clear of other branches.
      const drop = id === 'bird' ? .4 : 1.5;
      for (let i = 0; i < vertices.length; i += 3) {
        const below = ly - vertices[i + 1];
        if (below > .02 && below < drop) assert.ok(Math.hypot(vertices[i] - lx, vertices[i + 2] - lz) > .1, `${id} hangs clear (width ${width})`);
      }
      const spot = hangSpot(rig, width), on = onTree(tree, [lx, ly, lz], width);
      assert.deepEqual([spot.x, spot.y, spot.z], [on.x, on.y, on.z]);
      // Hung high enough to read: the silk's tails reach nearly to the ground from well overhead.
      assert.ok(spot.y - spot.ground > (id === 'bird' ? 3.5 : 4.5), `${id} hangs ${spot.y - spot.ground} up`);
    }
  }
});

test('each is in the picture and near enough to read through its stretch on desktop and a phone', () => {
  for (const [width, aspect, fov] of LAYOUTS) {
    const half = halfView(aspect, fov), vertical = (width < 1 ? GARDEN_CAMERA.mobileFov : GARDEN_CAMERA.fov) / 2;
    for (const [rig, month, until] of SEEN) {
      const spot = hangSpot(rig, width);
      for (let p = progressAt(month); p <= until; p += .002) {
        const pose = cameraPose(p, width), [cx, cy, cz] = pose.position;
        assert.equal(rigShown(rig, spot, p, cz, width < 1), 1, `${rig.from} shown at ${p}`);
        const bearing = degrees(Math.atan2(spot.x - cx, cz - spot.z) - cameraHeading(p, width));
        assert.ok(Math.abs(bearing) < half - 1.5, `${rig.from} at ${bearing.toFixed(1)}° at ${p} (width ${width})`);
        const distance = Math.hypot(spot.x - cx, spot.z - cz);
        assert.ok(distance > 12 && distance < 27, `${rig.from} ${distance} away at ${p}`);
        // From where it hangs to the ground beneath it, within the picture's height.
        const [, ty] = pose.target, tilt = degrees(Math.atan2(ty - cy, Math.hypot(pose.target[0] - cx, pose.target[2] - cz)));
        for (const y of [spot.y, spot.ground]) assert.ok(Math.abs(degrees(Math.atan2(y - cy, distance)) - tilt) < vertical - 2);
      }
    }
  }
});

test('each keeps clear of the year markers and the other eggs on the banks', async () => {
  const { piSpot } = await import('../src/components/garden/eggs/campus.ts');
  const { SNOW_SPOTS, snowSpot } = await import('../src/components/garden/eggs/flurry.ts');
  const { CAPS, capLanding } = await import('../src/components/garden/eggs/capToss.ts');
  const { nestSpots } = await import('../src/components/garden/eggs/nesting.ts');
  const { ORNAMENTS: WORK, ornamentSpot: workSpot } = await import('../src/components/garden/eggs/careerSpots.ts');
  const { ORNAMENTS: UNI, ornamentSpot: uniSpot } = await import('../src/components/garden/eggs/uniOrnaments.ts');
  const { rocketSpot } = await import('../src/components/garden/eggs/rocketLaunch.ts');
  const { hagiaSophiaSpot } = await import('../src/components/garden/eggs/balloonCourse.ts');
  const { operaHouseSpot } = await import('../src/components/garden/eggs/harbour.ts');
  for (const [width] of LAYOUTS) {
    const others = [
      ...YEAR_MARKERS.map(marker => [marker.year, yearMarkerSpot(marker, width)]),
      ['π', piSpot(width < 1, width)],
      ['2019 snowman', snowSpot(SNOW_SPOTS[2019], '2019-07', width)],
      ['2025 snowmen', snowSpot(SNOW_SPOTS[2025], '2025-08', width)],
      ...CAPS.tosses.map(toss => ['mortarboard', capLanding('2020-08', toss, width)]),
      ...nestSpots(width).flatMap(pair => [['birdhouse', pair.amelia], ['birdhouse', pair.patrick]]),
      ...WORK.map(ornament => [`${ornament.facing} ornament`, workSpot(ornament, width)]),
      ...Object.entries(UNI).map(([name, ornament]) => [name, uniSpot(ornament, width)]),
      ['rocket', rocketSpot(width)],
      ['Hagia Sophia', hagiaSophiaSpot('2026-07', width)],
      ['Opera House', operaHouseSpot(width)],
    ];
    for (const [id, rig] of Object.entries(RIGS)) {
      const spot = hangSpot(rig, width);
      for (const [name, other] of others) assert.ok(Math.hypot(other.x - spot.x, other.z - spot.z) > 5, `${name} crowds the ${id} (width ${width})`);
    }
    // The lyra and the bird hang together, a little apart; the silk on its own, years before them.
    const [silk, lyra, bird] = [SILK, LYRA, BIRD].map(rig => hangSpot(rig, width));
    const apart = Math.hypot(lyra.x - bird.x, lyra.z - bird.z);
    assert.ok(apart > 1.5 && apart < 4, `the lyra and the bird ${apart} apart`);
    assert.ok(Math.abs(silk.z - lyra.z) > 40);
  }
});

test('the silk never hangs in front of or behind the Opera House in the picture, on the same bank', async () => {
  const { OPERA, harbourShown, operaHouseSpot } = await import('../src/components/garden/eggs/harbour.ts');
  for (const [width, aspect, fov] of LAYOUTS) {
    const half = halfView(aspect, fov), house = operaHouseSpot(width), silk = hangSpot(SILK, width);
    const c = Math.cos(house.yaw), s = Math.sin(house.yaw);
    for (let p = progressAt('2022-01'); p < progressAt('2023-03'); p += .001) {
      const [cx, , cz] = cameraPose(p, width).position;
      if (!rigShown(SILK, silk, p, cz, width < 1) || !harbourShown(p, cz, width < 1).opera) continue;
      const bearing = (x, z) => degrees(Math.atan2(x - cx, cz - z) - cameraHeading(p, width));
      const corners = [-1, 1].flatMap(a => [-.5, .5].map(b => bearing(house.x + (c * a * OPERA.width / 2 + s * b) * house.scale, house.z + (-s * a * OPERA.width / 2 + c * b) * house.scale)));
      if (Math.max(...corners) < -half) continue;
      // Its tails, spread a little either side of where it hangs.
      const tails = degrees(Math.atan(.25 * silk.scale / Math.hypot(silk.x - cx, silk.z - cz)));
      assert.ok(bearing(silk.x, silk.z) - tails - Math.max(...corners) > 2, `the silk beside the Opera House at ${p} (width ${width})`);
    }
  }
});

test('each dissolves in no earlier than its month, and is gone once the camera has passed it', () => {
  for (const [width] of LAYOUTS) {
    for (const rig of Object.values(RIGS)) {
      const spot = hangSpot(rig, width);
      const cameraZ = p => cameraPose(p, width).position[2];
      const before = progressAt(rig.from) - (rig.arrive + .05) * ROOM;
      assert.equal(rigShown(rig, spot, before, cameraZ(before), width < 1), 0, `${rig.from} hidden before`);
      assert.equal(rigShown(rig, spot, 0, cameraZ(0), width < 1), 0, 'hidden at the opening');
      let p = progressAt(rig.from);
      while (cameraZ(p) > spot.z - 4) p += 1e-3;
      assert.equal(rigShown(rig, spot, p, cameraZ(p), width < 1), 0, `${rig.from} gone once passed`);
      assert.equal(rigShown(rig, spot, 1, cameraZ(1), width < 1), 0, 'hidden at the dock');
    }
  }
});

test('the silk, the lyra and the bird are each one small mesh', async () => {
  const { SILK_SHAPE, silkGeometry, writeSilk, lyraGeometry, hangingBirdGeometry, writeHangingBird, HANGING_BIRD_TRIANGLES } = await import('../src/components/garden/eggs/circusGeometry.ts');
  const triangles = geometry => (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3;
  const silk = silkGeometry(), bird = hangingBirdGeometry(), lyra = lyraGeometry(2.4);
  writeSilk(silk, 5, 1.3, 1);
  writeHangingBird(bird, 1.15, .3);
  for (const geometry of [silk, bird, lyra]) {
    assert.ok(triangles(geometry) < 1500);
    assert.ok([...geometry.attributes.position.array].every(Number.isFinite));
    assert.equal(geometry.groups.length, 0, 'one draw call');
  }
  assert.equal(triangles(bird), HANGING_BIRD_TRIANGLES);
  // The silk hangs from its limb at y 0 down to its length, its two tails apart at the foot.
  silk.computeBoundingBox();
  assert.ok(Math.abs(silk.boundingBox.max.y) < 1e-9 && Math.abs(silk.boundingBox.min.y + 5) < 1e-9);
  assert.ok(silk.boundingBox.max.x - silk.boundingBox.min.x > SILK_SHAPE.apart);
  // The bird hangs beneath its feet, only its tail tipped up past them, as in a handstand.
  bird.computeBoundingBox();
  assert.ok(bird.boundingBox.max.y < .12 && bird.boundingBox.min.y < -.12);
});
