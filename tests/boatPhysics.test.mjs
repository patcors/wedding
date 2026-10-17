import assert from 'node:assert/strict';
import test from 'node:test';
import { BoatSimulation, boatContact, boatOutline, createBoatBody, resolveBoatContact, stemContact } from '../src/components/garden/boatPhysics.ts';
import { riverCenter, bankEdge, groundHeight, islandHalfWidth, voyageLandmarks, MOBILE_RIVER_WIDTH } from '../src/components/garden/gardenGeometry.ts';
import { jettyStems } from '../src/components/garden/voyageDock.ts';
import { mooredStems } from '../src/components/garden/storyBoats.ts';
import { plantSites } from '../src/components/garden/gardenPlantGeometry.ts';

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

test('every launch stays, and overlapping launches separate without an explosive impulse', () => {
  const world = new BoatSimulation(river, MOBILE_RIVER_WIDTH);
  for (let id = 1; id <= 12; id++) {
    world.launch({ id, kind: id % 3 === 0 ? 'tugboat' : 'paper', lateral: 0, z: 8 }, MOBILE_RIVER_WIDTH);
    world.advance(0, MOBILE_RIVER_WIDTH, true);
  }
  assert.equal(world.bodies.length, 12);
  for (const a of world.bodies) assert.ok(Math.hypot(a.vx, a.vz) < 1);
  // A dozen hulls dropped on one spot need a moment of drifting to spread out.
  for (let i = 0; i < 60; i++) world.advance(1 / 60, MOBILE_RIVER_WIDTH, false);
  for (const a of world.bodies) {
    assert.ok(Math.hypot(a.vx, a.vz) < 2);
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

const reeds = (width, mobile) => ['reed', 'cattail'].flatMap(kind => plantSites(kind, width, mobile)
  .filter(site => Math.abs(site.x - riverCenter(site.z, width)) < bankEdge(site.z, width))
  .map(site => ({ x: site.x, z: site.z, radius: (kind === 'reed' ? .07 : .05) * site.scale })));

test('a stem inside or touching any hull pushes it away from the stem', () => {
  for (const kind of ['paper', 'sailboat', 'tugboat', 'duck']) {
    const a = body(1, kind);
    for (const side of [-1, 1]) {
      for (const x of [.05, .15, .25]) {
        const contact = stemContact(a, { x: side * x, z: 0, radius: .07 });
        assert.ok(contact && contact.depth > 0 && Math.sign(contact.normal.x) === -side, `${kind} ${side * x}`);
      }
      assert.equal(stemContact(a, { x: side * .6, z: 0, radius: .07 }), null);
    }
  }
});

test('a hull drifting into a stem turns aside and loses speed instead of passing through', () => {
  const world = new BoatSimulation(river, 1);
  const a = world.launch({ id: 1, kind: 'sailboat', lateral: 0, z: 8 }, 1);
  const stem = { x: a.x + .1, z: a.z - 1.5, radius: .07 };
  world.setStems([stem], 1);
  let hit = false;
  for (let i = 0; i < 240; i++) {
    world.advance(1 / 60, 1, false);
    const contact = stemContact(a, stem);
    hit ||= !!contact;
    assert.ok((contact?.depth ?? 0) < .03, 'stem sank into the hull');
  }
  assert.ok(hit && Math.abs(a.omega - a.eddy) > .01 || a.x < stem.x - .2, 'the stem changed the boat\'s course');
});

test('boats launched into the reed beds start clear of the stems and never cross them', () => {
  for (const [width, mobile] of [[1, false], [MOBILE_RIVER_WIDTH, true]]) {
    const stems = reeds(width, mobile);
    const world = new BoatSimulation(river, width);
    world.setStems(stems, width);
    let id = 0;
    for (const z of [8, -4, -22]) for (const lateral of [-1, 1]) world.launch({ id: ++id, kind: id % 2 ? 'sailboat' : 'paper', lateral, z }, width);
    for (const a of world.bodies) assert.ok(stems.every(stem => !stemContact(a, stem)), `launch overlaps a stem at ${a.z}`);
    for (let i = 0; i < 60 * 20; i++) {
      world.advance(1 / 60, width, false);
      if (i % 10) continue;
      for (const a of world.bodies) {
        assert.ok(Number.isFinite(a.x) && Math.hypot(a.vx, a.vz) < 3);
        for (const stem of stems) assert.ok((stemContact(a, stem)?.depth ?? 0) < .05, 'hull crossed a stem');
      }
    }
  }
});

test('the ground where boats stop is always under water, on both compositions', () => {
  for (const width of [1, MOBILE_RIVER_WIDTH]) {
    for (let z = -110; z <= 20; z += .05) {
      for (const side of [-1, 1]) {
        // Hulls stop .12 short of the bank; check the ground out to the bank itself.
        for (const inland of [-.12, -.06, 0]) {
          const x = riverCenter(z, width) + side * (bankEdge(z, width) + inland);
          assert.ok(groundHeight(x, z, width) < -.01, `land above water at z=${z.toFixed(2)}`);
        }
      }
    }
  }
});

test('boats keep to the channels round the island and bump off the jetty and the moored catamaran, on both compositions', () => {
  for (const width of [1, MOBILE_RIVER_WIDTH]) {
    const islandRiver = { ...river, island: islandHalfWidth };
    const world = new BoatSimulation(islandRiver, width);
    const stems = [...jettyStems(width), ...mooredStems(width)];
    world.setStems(stems, width);
    let id = 0;
    // Dropped above the island's head and beside it. (In portrait the channels
    // at the head are narrower than a paper boat, which may catch there.)
    for (const z of [16, 12, 6, -2]) for (const lateral of [-.8, -.1, .1, .8]) world.launch({ id: ++id, kind: id % 3 ? 'sailboat' : 'duck', lateral, z }, width);
    const { jetty } = voyageLandmarks(width);
    // Out in the river they slide past the catamaran and the jetty's end; one
    // beside the bank may come to rest in the corner of the jetty's head.
    for (const lateral of [-.2, .3, .5, .9]) world.launch({ id: ++id, kind: 'tugboat', lateral, z: jetty.z + 3 }, width);
    const start = world.bodies.map(b => b.z);
    for (let i = 0; i < 60 * 30; i++) {
      world.advance(1 / 60, width, false);
      if (i % 10) continue;
      for (const a of world.bodies) {
        for (const p of boatOutline(a)) {
          const island = islandHalfWidth(p.z, width);
          assert.ok(!island || Math.abs(p.x - riverCenter(p.z, width)) > island + .1, `a hull crossed onto the island at z=${p.z.toFixed(2)}`);
        }
        for (const stem of stems) assert.ok((stemContact(a, stem)?.depth ?? 0) < .05, 'a hull sailed through the jetty or the catamaran');
      }
    }
    world.bodies.slice(0, -1).forEach((a, i) => assert.ok(a.z < (start[i] < jetty.z + 5 ? jetty.z - 3 : start[i] - 12), `boat ${a.id} stuck at z=${a.z.toFixed(2)}`));
  }
});
