import assert from 'node:assert/strict';
import test from 'node:test';
import { BoatSimulation, boatContact, boatOutline, createBoatBody, resolveBoatContact } from '../src/components/garden/boatPhysics.ts';
import { riverCenter, bankEdge, MOBILE_RIVER_WIDTH } from '../src/components/garden/gardenGeometry.ts';

const river = { center: riverCenter, halfWidth: bankEdge };
const body = (id, kind = 'paper') => Object.assign(createBoatBody({ id, kind, lateral: 0, z: 0 }, 1, river),
  { x: 0, z: 0, yaw: 0, omega: 0, vx: 0, vz: 0 });
const energy = b => (b.vx ** 2 + b.vz ** 2) / (2 * b.inverseMass) + b.omega ** 2 / (2 * b.inverseInertia);
const close = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);

test('bow-on impact transfers momentum with a soft rebound and no spurious spin', () => {
  const a = body(1), b = body(2);
  Object.assign(a, { z: .8, vz: -1 }); Object.assign(b, { z: -.8, vz: 1 });
  const before = energy(a) + energy(b);
  resolveBoatContact(a, b);
  assert.ok(a.vz > 0 && b.vz < 0);
  close(a.vz + b.vz, 0); close(a.omega, 0); close(b.omega, 0);
  assert.ok(energy(a) + energy(b) < before * .1);
});

test('glancing hull impact produces a turn while conserving linear momentum', () => {
  const a = body(1), b = body(2);
  Object.assign(a, { x: .2, z: .6, vz: -1 }); Object.assign(b, { z: -.6, vz: .3 });
  const before = energy(a) + energy(b);
  const momentum = a.vz / a.inverseMass + b.vz / b.inverseMass;
  assert.ok(boatContact(a, b));
  resolveBoatContact(a, b);
  assert.ok(Math.abs(a.omega) + Math.abs(b.omega) > .1);
  close(a.vz / a.inverseMass + b.vz / b.inverseMass, momentum);
  close(a.vx / a.inverseMass + b.vx / b.inverseMass, 0);
  assert.ok(energy(a) + energy(b) <= before);
});

test('overlapping launches separate without an explosive impulse, including paused launches', () => {
  const world = new BoatSimulation(river, MOBILE_RIVER_WIDTH);
  for (let id = 1; id <= 12; id++) {
    world.launch({ id, kind: id % 3 === 0 ? 'tugboat' : 'paper', lateral: 0, z: 8 }, MOBILE_RIVER_WIDTH);
    world.advance(0, MOBILE_RIVER_WIDTH, true);
  }
  assert.equal(world.bodies.length, 4);
  for (const a of world.bodies) {
    assert.ok(Math.hypot(a.vx, a.vz) < 1);
    for (const b of world.bodies) {
      if (a.id === b.id) continue;
      assert.ok((boatContact(a, b)?.depth ?? 0) < .01);
    }
  }
});

test('fixed timesteps give matching collision paths at 30 and 120 fps', () => {
  const run = fps => {
    const world = new BoatSimulation(river, MOBILE_RIVER_WIDTH);
    for (let id = 1; id <= 4; id++) world.launch({ id, kind: id === 3 ? 'sailboat' : 'paper', lateral: 0, z: 8 }, MOBILE_RIVER_WIDTH);
    for (let i = 0; i < fps * 4; i++) world.advance(1 / fps, MOBILE_RIVER_WIDTH, false);
    return world.bodies;
  };
  const slow = run(30), fast = run(120);
  slow.forEach((a, i) => { for (const key of ['x', 'z', 'yaw', 'vx', 'vz', 'omega', 'age']) close(a[key], fast[i][key]); });
});

test('curved banks contain rotating hulls after a resize and collisions remain stable', () => {
  const world = new BoatSimulation(river, 1);
  for (let id = 1; id <= 4; id++) world.launch({ id, kind: 'paper', lateral: id % 2 ? 1 : -1, z: 8 }, 1);
  for (let i = 0; i < 1200; i++) {
    world.advance(1 / 60, MOBILE_RIVER_WIDTH, false);
    for (const a of world.bodies) {
      assert.ok(Number.isFinite(a.yaw) && Math.hypot(a.vx, a.vz) < 3);
      for (const p of boatOutline(a)) assert.ok(Math.abs(p.x - riverCenter(p.z, MOBILE_RIVER_WIDTH)) < bankEdge(p.z, MOBILE_RIVER_WIDTH), 'hull crossed bank');
      for (const b of world.bodies) if (a.id !== b.id) assert.ok((boatContact(a, b)?.depth ?? 0) < .01);
    }
  }
});

test('pause freezes physics and wakes; resuming does not catch up hidden time; boats retire', () => {
  const world = new BoatSimulation(river, 1);
  const a = world.launch({ id: 1, kind: 'paper', lateral: 0, z: 8 }, 1);
  world.advance(.1, 1, false);
  const snapshot = structuredClone(a);
  world.advance(30, 1, true);
  assert.deepEqual(a, snapshot);
  world.advance(30, 1, false);
  close(a.age, .2);
  const wake = structuredClone(a.wake[0]);
  a.vx = .8;
  for (let i = 0; i < 60; i++) world.advance(1 / 60, 1, false);
  assert.deepEqual(a.wake[0], wake, 'old rings must stay where emitted');
  assert.ok(a.wake[1].born > 0 && a.wake[1].x !== wake.x);
  for (let i = 0; i < 480; i++) world.advance(.1, 1, false);
  assert.equal(world.bodies.length, 0);
});
