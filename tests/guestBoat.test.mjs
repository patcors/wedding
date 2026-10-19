import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { CARD_TYPE, GUEST_ARRIVAL, GUEST_BOAT, fitGreeting, greetingLines, guestBerth, guestBoatPose, guestBoatStems, guestScale } from '../src/components/garden/guestBoat.ts';
import { dockView } from '../src/components/garden/cameraRig.ts';
import { DOCKED, VOYAGE_END, progressAt, DATES } from '../src/components/garden/journey.ts';
import { GARDEN_CAMERA, MOBILE_RIVER_WIDTH, bankEdge, riverCenter } from '../src/components/garden/gardenGeometry.ts';
import { mooredStems } from '../src/components/garden/storyBoats.ts';
import { underJetty } from '../src/components/garden/voyageDock.ts';
import { parties } from '../src/data/parties.ts';

// Cormorant Garamond 500's advance widths, in ems, as measured in the browser.
const WIDTHS = { a: .42, b: .512, c: .415, d: .512, e: .411, f: .305, g: .447, h: .502, i: .27, j: .259, k: .491, l: .261, m: .768, n: .52, o: .482, p: .511, q: .492, r: .369, s: .338, t: .338, u: .497, v: .436, w: .675, x: .439, y: .432, z: .405,
  A: .706, B: .57, C: .684, D: .696, E: .542, F: .513, G: .719, H: .761, I: .335, J: .327, K: .652, L: .537, M: .842, N: .73, O: .766, P: .546, Q: .766, R: .681, S: .499, T: .637, U: .7, V: .664, W: .925, X: .65, Y: .612, Z: .598, ' ': .234, ',': .222, '&': .703 };
const measure = text => [...text].reduce((sum, ch) => sum + (WIDTHS[ch] ?? .8), 0);
const CARD = { width: 1024, height: Math.round(1024 * GUEST_BOAT.card.height / GUEST_BOAT.card.width) };

const SCREENS = [{ width: 1, w: 1440, h: 900, fov: GARDEN_CAMERA.fov }, { width: MOBILE_RIVER_WIDTH, w: 390, h: 844, fov: GARDEN_CAMERA.mobileFov }];
const lens = (screen) => {
  const { position, target } = dockView(screen.width);
  const camera = new THREE.PerspectiveCamera(screen.fov, screen.w / screen.h, .2, 200);
  camera.position.set(...position);
  camera.lookAt(new THREE.Vector3(...target));
  camera.updateMatrixWorld();
  return camera;
};
// The card's middle and top in the world when moored.
function cardAt(width) {
  const { x, z } = guestBerth(width), scale = guestScale(width), { foot, card } = GUEST_BOAT;
  return { middle: new THREE.Vector3(x, (foot + card.height / 2) * scale, z), top: new THREE.Vector3(x, (foot + card.height) * scale, z) };
}

test('a greeting breaks only after a comma or before an "&", into one to three lines', () => {
  assert.deepEqual(greetingLines('Paula'), [['Paula']]);
  assert.deepEqual(greetingLines('Dean & Kelly'), [['Dean', '& Kelly'], ['Dean & Kelly']]);
  const crash = greetingLines('Kirsten, Michael & Kai');
  assert.ok(crash.some(lines => lines.join('|') === 'Kirsten,|Michael|& Kai'));
  for (const { greeting } of parties) {
    for (const lines of greetingLines(greeting)) {
      assert.equal(lines.join(' '), greeting);
      assert.ok(lines.length >= 1 && lines.length <= 3);
      for (const line of lines) assert.ok(!/^,|&$/.test(line), `no stray comma or "&" at a break: ${line}`);
    }
  }
});

test('every Party\'s names fit the card, set larger on fewer lines where they can be', () => {
  const inside = { width: CARD.width * (1 - 2 * CARD_TYPE.margin), height: CARD.height * (1 - 2 * CARD_TYPE.margin) };
  for (const { greeting } of parties) {
    const { lines, size } = fitGreeting(greeting, measure, CARD);
    for (const line of lines) assert.ok(measure(line) * size <= inside.width + 1e-6, `${line} fits across`);
    assert.ok(lines.length * size * CARD_TYPE.lineHeight <= inside.height + 1e-6, `${greeting} fits down`);
    assert.ok(size <= CARD_TYPE.max);
  }
  assert.equal(fitGreeting('Kirsten, Michael & Kai', measure, CARD).lines.length, 3);
  assert.equal(fitGreeting('Paula', measure, CARD).lines.length, 1);
});

test('every Party\'s names read at the dock on a phone: a dozen pixels to the em or more', () => {
  for (const screen of SCREENS) {
    const camera = lens(screen), { middle } = cardAt(screen.width);
    const distance = camera.position.distanceTo(middle);
    const pixelsPerUnit = screen.h / 2 / Math.tan(screen.fov / 2 * Math.PI / 180) / distance;
    let smallest = Infinity;
    for (const { greeting } of parties) {
      const { size } = fitGreeting(greeting, measure, CARD);
      smallest = Math.min(smallest, size / CARD.width * GUEST_BOAT.card.width * guestScale(screen.width) * pixelsPerUnit);
    }
    assert.ok(smallest >= 12, `${smallest.toFixed(1)}px to the em on ${screen.w}`);
  }
});

test('moored, it lies on the water by the jetty\'s bank, clear of the catamaran and the jetty, low in the dock\'s picture below the copy', () => {
  for (const screen of SCREENS) {
    const { width } = screen, berth = guestBerth(width), scale = guestScale(width);
    const hull = guestBoatStems(width);
    for (const point of hull) {
      assert.ok(Math.abs(point.x - riverCenter(point.z, width)) < bankEdge(point.z, width) + .1, `on the water (${screen.w})`);
      assert.ok(!underJetty(point.x, point.z, width), `clear of the jetty (${screen.w})`);
      for (const stem of mooredStems(width)) assert.ok(Math.hypot(point.x - stem.x, point.z - stem.z) > .3, `clear of the catamaran (${screen.w})`);
    }
    assert.ok(Math.abs(berth.x - riverCenter(berth.z, width)) < bankEdge(berth.z, width) - GUEST_BOAT.halfBeam * scale * .5);
    const camera = lens(screen), { middle, top } = cardAt(width);
    const at = middle.clone().project(camera), high = top.clone().project(camera);
    assert.ok(at.x > -.9 && at.x < .9, `card across the picture (${screen.w})`);
    assert.ok((1 - high.y) / 2 > .7 && (1 - at.y) / 2 < .95, `card low, below the copy's button (${screen.w}): ${((1 - high.y) / 2).toFixed(2)}`);
    // Its names face the camera.
    const facing = berth.yaw + berth.card, toCamera = Math.atan2(camera.position.x - berth.x, camera.position.z - berth.z);
    assert.ok(Math.abs(facing - toCamera) < 1e-9);
  }
});

test('it drifts in as the wedding\'s date shows and has settled before the copy starts to show', () => {
  assert.ok(Math.abs(GUEST_ARRIVAL.from - (progressAt(DATES.wedding) - .022)) < 1e-9);
  assert.ok(GUEST_ARRIVAL.to < VOYAGE_END && GUEST_ARRIVAL.to < DOCKED);
  for (const { width } of SCREENS) {
    const berth = guestBerth(width);
    assert.equal(guestBoatPose(GUEST_ARRIVAL.from - .001, width).shown, false);
    assert.equal(guestBoatPose(0, width).shown, false);
    for (const p of [GUEST_ARRIVAL.to, VOYAGE_END, DOCKED, 1]) {
      const pose = guestBoatPose(p, width);
      assert.ok(pose.shown && pose.settled === 1);
      assert.ok(Math.abs(pose.x - berth.x) < 1e-9 && Math.abs(pose.z - berth.z) < 1e-9 && Math.abs(pose.yaw - berth.yaw) < 1e-9 && Math.abs(pose.card - berth.card) < 1e-9);
    }
    let last = guestBoatPose(GUEST_ARRIVAL.from, width);
    for (let p = GUEST_ARRIVAL.from; p <= GUEST_ARRIVAL.to; p += .0005) {
      const pose = guestBoatPose(p, width);
      assert.ok(pose.z <= last.z + 1e-9, 'only ever downstream');
      assert.ok(Math.hypot(pose.x - last.x, pose.z - last.z) < .3, 'no jumps');
      assert.ok(Math.abs(pose.x - riverCenter(pose.z, width)) < bankEdge(pose.z, width), 'on the water');
      last = pose;
    }
  }
});
