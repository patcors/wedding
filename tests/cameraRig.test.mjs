import assert from 'node:assert/strict';
import test from 'node:test';
import { cameraPose, dockView } from '../src/components/garden/cameraRig.ts';
import { ARRIVAL_END, VOYAGE_END, routeAt } from '../src/components/garden/journey.ts';
import { GARDEN_CAMERA, MOBILE_RIVER_WIDTH, bankEdge, riverCenter, voyageLandmarks } from '../src/components/garden/gardenGeometry.ts';

const degrees = radians => radians * 180 / Math.PI;
// Half the horizontal field of view of a 390 x 844 portrait screen.
const PORTRAIT = degrees(Math.atan(Math.tan(GARDEN_CAMERA.mobileFov / 2 * Math.PI / 180) * 390 / 844));

test('the opening keeps the Garden\'s original viewpoint', () => {
  const { position, target } = cameraPose(0, 1);
  assert.deepEqual([position[1], position[2]], [GARDEN_CAMERA.height, GARDEN_CAMERA.startZ]);
  assert.equal(target[1], GARDEN_CAMERA.targetY);
  assert.ok(Math.abs(position[0]) < .5 && Math.abs(target[0]) < 1);
});

test('through the voyage the camera rides over the river and keeps the boats in frame, bend included', () => {
  for (const width of [1, MOBILE_RIVER_WIDTH]) {
    for (let p = 0; p <= VOYAGE_END; p += .001) {
      const { position: [x, y, z], target } = cameraPose(p, width);
      assert.ok(Math.abs(x - riverCenter(z, width)) < bankEdge(z, width) * .5, `over the water at ${p}`);
      assert.ok(y > 2);
      const boats = routeAt(p), heading = Math.atan2(target[0] - x, z - target[2]);
      const toBoats = Math.atan2(riverCenter(boats, width) - x, z - boats);
      assert.ok(Math.abs(degrees(toBoats - heading)) < PORTRAIT * .8, `boats leave the frame at ${p.toFixed(3)}: ${degrees(toBoats - heading).toFixed(1)}°`);
    }
  }
  assert.ok(ARRIVAL_END < VOYAGE_END);
});

test('the dock view looks across the river at the jetty and the tree, from upstream', () => {
  for (const width of [1, MOBILE_RIVER_WIDTH]) {
    const { position, target } = cameraPose(1, width), { jetty, tree } = voyageLandmarks(width);
    assert.deepEqual({ position, target }, dockView(width));
    for (const point of [jetty, tree]) {
      const heading = Math.atan2(target[0] - position[0], position[2] - target[2]);
      const toPoint = Math.atan2(point.x - position[0], position[2] - point.z);
      assert.ok(Math.abs(degrees(toPoint - heading)) < PORTRAIT, 'in frame on portrait');
    }
    assert.ok(Math.abs(position[0] - riverCenter(position[2], width)) < bankEdge(position[2], width), 'over the water');
  }
});
