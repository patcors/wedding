import assert from 'node:assert/strict';
import test from 'node:test';
import { ARRIVAL_END, DATES, DOCKED, MILESTONES, ROOM, VOYAGE_END, progressAt, routeAt, stillProgress } from '../src/components/garden/journey.ts';
import { MOBILE_RIVER_WIDTH, VOYAGE, bankEdge, islandHalfWidth, riverCenter, voyageLandmarks } from '../src/components/garden/gardenGeometry.ts';
import { ALONGSIDE, BOAT_SCALE, CATAMARAN, boatPose, hullHalfBeam, joining, rigging } from '../src/components/garden/storyBoats.ts';

const steps = (n = 2000) => Array.from({ length: n + 1 }, (_, i) => i / n);
const widths = [1, MOBILE_RIVER_WIDTH];
// Each hull's centre and half-beam across the river at p, in world units.
const hulls = (p, width) => {
  const pose = boatPose(p, width), half = hullHalfBeam(pose.join.morph) * BOAT_SCALE;
  return { pose, half, offsets: [-1, 1].map(side => pose.x - riverCenter(pose.z, width) + side * pose.gap * BOAT_SCALE * Math.cos(pose.yaw)) };
};

test('before they meet, each boat keeps to its own channel beside the island', () => {
  for (const width of widths) {
    for (const p of steps().filter(p => routeAt(p) > VOYAGE.island.to - 1 && routeAt(p) < VOYAGE.island.from)) {
      const { pose, half, offsets } = hulls(p, width);
      const island = islandHalfWidth(pose.z, width), bank = bankEdge(pose.z, width);
      for (const offset of offsets) {
        assert.ok(Math.abs(offset) - half > island, `clear of the island at ${p}`);
        assert.ok(Math.abs(offset) + half < bank, `inside the bank at ${p}`);
      }
    }
  }
});

test('the hulls never touch and stay between the banks through the voyage', () => {
  for (const width of widths) {
    for (const p of steps().filter(p => p < VOYAGE_END)) {
      const { pose, half, offsets } = hulls(p, width);
      assert.ok(pose.gap * BOAT_SCALE > half, `apart at ${p}`);
      for (const offset of offsets) assert.ok(Math.abs(offset) + half < bankEdge(pose.z, width), `inside the bank at ${p} (${width})`);
    }
  }
});

test('side by side once they meet, further apart in Sydney, alongside again by March 2023', () => {
  for (const width of widths) {
    assert.ok(Math.abs(boatPose(progressAt(DATES.meet), width).gap - ALONGSIDE) < .01);
    const sydney = boatPose((progressAt(DATES.sydney) + progressAt(DATES.back)) / 2, width).gap;
    assert.ok(sydney > ALONGSIDE * 1.8, `apart in Sydney (${width})`);
    assert.ok(Math.abs(boatPose(progressAt(DATES.back), width).gap - ALONGSIDE) < .01);
  }
});

const bend = ARRIVAL_END + (4 - VOYAGE.bend.from) / 168 * (VOYAGE_END - ARRIVAL_END);

test('they join from dating and are one catamaran by their engagement, well before the S-bend', () => {
  const dating = progressAt(DATES.dating);
  assert.equal(joining(dating), 0);
  const before = boatPose(dating, 1).join;
  assert.equal(before.morph, 0);
  assert.ok(before.planks.every(k => k === 0) && before.beams.every(k => k === 0));
  for (const p of [progressAt(DATES.engaged), bend]) {
    const after = boatPose(p, 1);
    assert.equal(after.join.morph, 1);
    assert.ok(after.join.planks.every(k => k === 1) && after.join.beams.every(k => k === 1));
    assert.equal(after.gap, CATAMARAN);
  }
  // Planks are laid one after another, never all at once.
  for (const p of steps()) {
    const { planks } = boatPose(p, 1).join;
    for (let i = 1; i < planks.length; i++) assert.ok(planks[i] <= planks[i - 1]);
    assert.ok(planks.filter(k => k > 0 && k < 1).length <= 2);
  }
});

test('the boats move smoothly and turn with the river', () => {
  for (const width of widths) {
    let previous = boatPose(0, width);
    for (const p of steps(4000).slice(1)) {
      const pose = boatPose(p, width);
      assert.ok(Math.abs(pose.x - previous.x) < .2 && Math.abs(pose.gap - previous.gap) < .05, `jump at ${p}`);
      assert.ok(Math.abs(pose.yaw - previous.yaw) < .05, `yaw jumps at ${p}`);
      previous = pose;
    }
  }
  // Through the S-bend they head towards −x, where the river swings.
  const mid = ARRIVAL_END + (4 - (VOYAGE.bend.from + VOYAGE.bend.to) / 2) / 168 * (VOYAGE_END - ARRIVAL_END);
  assert.ok(boatPose(mid, 1).yaw > .3);
});

test('moored off the jetty from DOCKED, the outer hull just clear of its end', () => {
  for (const width of widths) {
    const { mooring, jetty } = voyageLandmarks(width);
    for (const p of [DOCKED, (DOCKED + 1) / 2, 1]) {
      const pose = boatPose(p, width);
      assert.ok(Math.abs(pose.x - mooring.x) < 1e-9 && Math.abs(pose.z - mooring.z) < 1e-9);
      assert.deepEqual(boatPose(p, width).yaw, boatPose(DOCKED, width).yaw);
    }
    const outer = (CATAMARAN + hullHalfBeam(1)) * BOAT_SCALE;
    const end = jetty.x - jetty.side * jetty.reach;
    assert.ok(Math.abs(mooring.x - end) > outer, `clear of the jetty (${width})`);
  }
});

test('once the last plank is down, the two masts give way to one tall mast as they get engaged', () => {
  const lastPlank = steps(20000).find(p => boatPose(p, 1).join.planks.every(k => k === 1));
  const engaged = progressAt(DATES.engaged), balloon = progressAt('2026-07');
  const order = ['furl', 'lower', 'raise', 'unfurl', 'hoist'];
  let previous = rigging(0);
  for (const p of steps(20000)) {
    const rig = rigging(p);
    // Nothing starts before the deck is finished, and all is done before July's balloon and the bend.
    if (p <= lastPlank) assert.ok(order.every(step => rig[step] === 0), `rigging under way at ${p}`);
    if (p >= balloon) assert.ok(order.every(step => rig[step] === 1), `rigging unfinished at ${p}`);
    // Each step only goes forward, and in order: a sail is furled before its mast
    // comes down, both masts are down before the big one rises, the big sail
    // unfurls only once it stands, and the flags go up it last.
    for (const step of order) assert.ok(rig[step] >= previous[step]);
    assert.ok(rig.lower === 0 || rig.furl > .5);
    assert.ok(rig.raise === 0 || rig.lower === 1, `both masts up at ${p}`);
    assert.ok(rig.unfurl === 0 || rig.raise > .8);
    assert.ok(rig.hoist === 0 || rig.unfurl > .5);
    previous = rig;
  }
  assert.ok(lastPlank < engaged && balloon < bend);
  // The big mast rises while April 2026 holds, a third of its share.
  assert.ok(rigging(engaged).raise === 0 && rigging(engaged + .35 * ROOM).raise === 1);
});

test('reduced-motion stills show the rig settled: two masts before the engagement, one from it', () => {
  for (const { month } of MILESTONES) {
    const p = stillProgress(progressAt(month)), rig = rigging(p, true);
    for (const k of Object.values(rig)) assert.ok(k === 0 || k === 1, `${month} still catches the rig mid-change`);
    assert.equal(rig.hoist, month >= DATES.engaged ? 1 : 0);
  }
  assert.ok(Object.values(rigging(1, true)).every(k => k === 1) && Object.values(rigging(DOCKED)).every(k => k === 1));
});
