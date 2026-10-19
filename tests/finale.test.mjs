import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FINALE, FINALE_LENGTH, aerialView, cameraPose, dockView, finaleLift, finalePose } from '../src/components/garden/cameraRig.ts';
import { DOCKED, VOYAGE_END } from '../src/components/garden/journey.ts';
import { GARDEN_CAMERA, MOBILE_RIVER_WIDTH, voyageLandmarks } from '../src/components/garden/gardenGeometry.ts';

const SCREENS = [{ width: 1, w: 1440, h: 900, fov: GARDEN_CAMERA.fov }, { width: MOBILE_RIVER_WIDTH, w: 390, h: 844, fov: GARDEN_CAMERA.mobileFov }];
// Where a world point lands in the picture, x and y from 0 to 1 (y down).
function project({ position, target }, screen, point) {
  const camera = new THREE.PerspectiveCamera(screen.fov, screen.w / screen.h, .2, 200);
  camera.position.set(...position);
  camera.lookAt(new THREE.Vector3(...target));
  camera.updateMatrixWorld();
  const v = new THREE.Vector3(...point).project(camera);
  return { x: (v.x + 1) / 2, y: (1 - v.y) / 2, ahead: v.z < 1 };
}

test('the flight rises, holds at the top and settles back, smoothly', () => {
  const { delay, rise, hold } = FINALE;
  assert.equal(finaleLift(0), 0);
  assert.equal(finaleLift(delay), 0);
  for (let t = delay + rise; t <= delay + rise + hold; t += .1) assert.equal(finaleLift(t), 1);
  assert.equal(finaleLift(FINALE_LENGTH), 0);
  assert.equal(finaleLift(FINALE_LENGTH + 5), 0);
  let last = 0;
  for (let t = 0; t <= FINALE_LENGTH + .5; t += 1 / 60) {
    const lift = finaleLift(t);
    assert.ok(lift >= 0 && lift <= 1);
    assert.ok(Math.abs(lift - last) < .02, `no jump at ${t.toFixed(2)}s`);
    last = lift;
  }
  // Slow, but over well within a quarter of a minute.
  assert.ok(rise >= 3 && FINALE_LENGTH < 15);
});

test('without the flight, and once it is over, every view is as it was: the copy and the dock at p 1 are untouched', () => {
  for (const { width } of SCREENS) {
    for (let p = 0; p <= 1; p += .005) assert.deepEqual(finalePose(p, width, 0), cameraPose(p, width));
    assert.deepEqual(finalePose(1, width, finaleLift(FINALE_LENGTH)), dockView(width));
    assert.deepEqual(cameraPose(1, width), dockView(width));
  }
  // The flight waits for the mooring, which is after the copy has shown.
  assert.ok(DOCKED > VOYAGE_END);
});

test('at the top the camera has risen and pulled back over the bend, the moored catamaran and the old tree in the picture, below the copy', () => {
  for (const screen of SCREENS) {
    const dock = dockView(screen.width), aerial = aerialView(screen.width);
    const { mooring, tree, jetty } = voyageLandmarks(screen.width);
    assert.ok(aerial.position[1] > dock.position[1] + 3, 'it rises');
    assert.ok(aerial.position[2] > dock.position[2] + 2, 'it pulls back upstream');
    // It looks downstream, as the voyage does, so what the river's culling
    // keeps (only what lies ahead of the camera) is all it can see.
    assert.ok(aerial.target[2] < aerial.position[2] - 10);
    const catamaran = project(aerial, screen, [mooring.x, .3, mooring.z]);
    assert.ok(catamaran.ahead && catamaran.x > .15 && catamaran.x < .85, `catamaran across (${screen.w})`);
    assert.ok(catamaran.y > .66 && catamaran.y < .95, `catamaran low, below the copy's button (${screen.w}): ${catamaran.y.toFixed(2)}`);
    const trunk = project(aerial, screen, [tree.x, 2, tree.z]);
    assert.ok(trunk.ahead && trunk.x > 0 && trunk.x < 1.05 && trunk.y > 0 && trunk.y < 1, `old tree in view (${screen.w})`);
    const head = project(aerial, screen, [jetty.x - jetty.side * jetty.reach, .36, jetty.z]);
    assert.ok(head.x > 0 && head.x < 1 && head.y > .5 && head.y < 1, `jetty in view (${screen.w})`);
    // Partway up it stays over the water and the near bank, never in the canopy.
    for (const lift of [.25, .5, .75]) {
      const { position } = finalePose(1, screen.width, lift);
      assert.ok(position[1] <= aerial.position[1] && position[1] >= dock.position[1]);
    }
  }
});

test('a flight coming down while the guest scrolls back off the mooring eases down where the camera is, not back to the dock', () => {
  for (const { width } of SCREENS) {
    const aerial = aerialView(width), dock = dockView(width);
    for (const p of [VOYAGE_END, (VOYAGE_END + DOCKED) / 2, DOCKED]) {
      const base = cameraPose(p, width), lifted = finalePose(p, width, .5);
      for (let i = 0; i < 3; i++) {
        assert.ok(Math.abs(lifted.position[i] - base.position[i] - (aerial.position[i] - dock.position[i]) / 2) < 1e-9);
        assert.ok(Math.abs(lifted.target[i] - base.target[i] - (aerial.target[i] - dock.target[i]) / 2) < 1e-9);
      }
    }
  }
});
