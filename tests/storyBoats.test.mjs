import assert from 'node:assert/strict';
import test from 'node:test';
import { ARRIVAL_END, DATES, DOCKED, MILESTONES, ROOM, VOYAGE_END, progressAt, routeAt, stillProgress } from '../src/components/garden/journey.ts';
import { MOBILE_RIVER_WIDTH, VOYAGE, bankEdge, channelOffset, islandHalfWidth, launchJetties, riverCenter, voyageLandmarks } from '../src/components/garden/gardenGeometry.ts';
import { ALONGSIDE, AMELIA_JOINED_HEIRWEALTH, AMELIA_LEFT_FINOCOMP, BOAT_SCALE, CAST_OFF, CATAMARAN, boatPose, companyFlags, hullHalfBeam, joining, rigging } from '../src/components/garden/storyBoats.ts';
import { BIG_RIG, FLAG, LOGO_FLAG, logoFlagGeometry } from '../src/components/garden/storyBoatGeometry.ts';

const steps = (n = 2000) => Array.from({ length: n + 1 }, (_, i) => i / n);
const widths = [1, MOBILE_RIVER_WIDTH];
// Each hull's centre and half-beam across the river at p, in world units.
const hulls = (p, width) => {
  const pose = boatPose(p, width), half = hullHalfBeam(pose.join.morph) * BOAT_SCALE;
  return { pose, half, offsets: [-1, 1].map(side => pose.x - riverCenter(pose.z, width) + side * pose.gap * BOAT_SCALE * Math.cos(pose.yaw)) };
};

// Points round both hulls' rims in the world at p, from the dinghy's sections.
const SECTIONS = [[-.78, .015], [-.55, .23], [-.12, .36], [.30, .33], [.66, .22]];
const hullOutline = (p, width) => {
  const pose = boatPose(p, width), c = Math.cos(pose.yaw), s = Math.sin(pose.yaw);
  return [-1, 1].flatMap(side => {
    const turn = side * pose.turn, ct = Math.cos(turn), st = Math.sin(turn);
    return SECTIONS.flatMap(([v, w]) => [-w, w].map(u => {
      // In the boat, turned about its middle, then across to its place in the pair.
      const bu = side * pose.gap + u * ct + v * st, bv = -u * st + v * ct;
      return { x: pose.x + (c * bu + s * bv) * BOAT_SCALE, z: pose.z + (-s * bu + c * bv) * BOAT_SCALE };
    }));
  });
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

test('under the title each boat lies alongside its own jetty, then casts off into its channel', () => {
  for (const width of widths) {
    const jetties = launchJetties(width);
    // Amelia's (left) and Patrick's (right) on the outer banks of their channels.
    assert.deepEqual(jetties.map(j => j.side), [-1, 1]);
    const { pose, half, offsets } = hulls(0, width);
    assert.equal(pose.berthed, 1);
    offsets.forEach((offset, i) => {
      const jetty = jetties[i], head = Math.abs(jetty.x - pose.x) - jetty.reach;
      const outer = Math.abs(offset) + half;
      // Just clear of the jetty's head, and alongside it.
      assert.ok(outer < head && outer > head - .15, `${jetty.side} lies alongside its jetty (${width})`);
      assert.ok(Math.abs(jetty.z - pose.z) < jetty.head / 2);
      // Out of the middle of its channel, so it has somewhere to pull out to.
      // Portrait's channels are only just wider than a boat beside a jetty,
      // so there it lies about mid-channel and sets off straight down it.
      const channel = channelOffset(pose.z, width);
      assert.ok(width < 1 ? Math.abs(Math.abs(offset) - channel) < .15 : Math.abs(offset) > channel + .8, `${jetty.side} moored out by the bank (${width})`);
    });
    // Still tied up until the guest scrolls, out in the channels by the end of the opening.
    assert.equal(boatPose(CAST_OFF.from, width).berthed, 1);
    const out = boatPose(ARRIVAL_END, width);
    assert.equal(out.berthed, 0);
    assert.ok(Math.abs(out.gap * BOAT_SCALE - channelOffset(out.z, width)) < 1e-9);
    // Pulling away, no part of a hull passes over a jetty's head.
    for (const p of steps().filter(p => p < ARRIVAL_END)) {
      for (const point of hullOutline(p, width)) {
        for (const jetty of jetties) {
          const along = (jetty.x - point.x) * jetty.side;
          assert.ok(!(along > -.5 && along < jetty.reach && Math.abs(point.z - jetty.z) < jetty.head / 2), `hull over the jetty at ${p} (${width})`);
        }
      }
    }
  }
});

// Each boat's flags over p, as runs of the same company (null for none).
// Each run notes how far up its first flag is and how far up the one before
// it had got.
const flagRuns = boat => steps(40000).reduce((runs, p) => {
  const { company, hoist } = companyFlags(p)[boat];
  if (runs.at(-1)?.company !== company) runs.push({ company, from: p, hoist, after: runs.at(-1)?.last ?? 0 });
  runs.at(-1).last = hoist;
  return runs;
}, []);
const bothUp = (amelia, patrick) => [{ company: amelia, hoist: 1 }, { company: patrick, hoist: 1 }];

test('the small mastheads fly nothing until both run up FinoComp flags as November 2018 shows', () => {
  const internship = progressAt(MILESTONES.find(m => m.id === 'internship').month);
  for (const p of steps().filter(p => p < internship)) assert.ok(companyFlags(p).every(({ company }) => company === null), `a flag up before ${p}`);
  for (const p of [internship + .35 * ROOM, progressAt(DATES.sydney)]) assert.deepEqual(companyFlags(p), bothUp('finocomp', 'finocomp'));
});

test('Amelia leaves FinoComp for a while, then starts at HeirWealth before Patrick does', () => {
  const left = progressAt(AMELIA_LEFT_FINOCOMP), joined = progressAt(AMELIA_JOINED_HEIRWEALTH), patrick = progressAt(DATES.back);
  assert.ok(progressAt(DATES.sydney) < left && left < joined && joined < patrick);
  // Each change on one halyard: the flag before all the way down before the next goes up.
  const runs = [0, 1].map(flagRuns);
  assert.deepEqual(runs[0].map(run => run.company), [null, 'finocomp', 'interim', 'heirwealth', null]);
  assert.deepEqual(runs[1].map(run => run.company), [null, 'finocomp', 'heirwealth', null]);
  for (const boat of runs) for (const run of boat.slice(2, -1)) assert.ok(run.after < .02 && run.hoist < .02, `${run.company} swapped at the foot of the halyard`);
  // Each change starts as its month shows, and is done well before the next.
  const [, , interim, amelia] = runs[0], [, , heirwealth] = runs[1];
  assert.ok(interim.from >= left && amelia.from >= joined && heirwealth.from >= patrick);
  assert.deepEqual(companyFlags((left + joined) / 2 + .01 * ROOM), bothUp('interim', 'finocomp'));
  // Hers is HeirWealth's while his is still FinoComp's, into March 2023's hold, then both.
  for (const p of [(joined + patrick) / 2 + .02 * ROOM, patrick + .08 * ROOM]) assert.deepEqual(companyFlags(p), bothUp('heirwealth', 'finocomp'));
  assert.deepEqual(companyFlags(patrick + .35 * ROOM), bothUp('heirwealth', 'heirwealth'));
  assert.ok(patrick + .35 * ROOM < progressAt(DATES.dating));
});

test('the company flags come down for the change of masts, leaving the big mast its monogram', () => {
  for (const p of steps(20000)) {
    const { furl } = rigging(p);
    for (const { hoist } of companyFlags(p)) assert.ok(hoist <= 1 - furl + 1e-9, `flag up as the sails furl at ${p}`);
  }
  for (const p of steps().filter(p => p >= progressAt(DATES.engaged))) assert.ok(companyFlags(p).every(({ company }) => company === null));
});

test('reduced-motion stills show the company flags settled', () => {
  for (const { month } of MILESTONES) {
    const flying = companyFlags(stillProgress(progressAt(month)), true);
    const internship = MILESTONES.find(m => m.id === 'internship').month;
    const company = month < internship ? null : month < DATES.back ? 'finocomp' : month < DATES.engaged ? 'heirwealth' : null;
    assert.deepEqual(flying, [0, 1].map(() => ({ company, hoist: company ? 1 : 0 })), month);
  }
});

test('the big mast flies their monogram on one flag at its masthead, larger than the company flags, clear of its sail', () => {
  const flag = logoFlagGeometry();
  flag.computeBoundingBox();
  const { min, max } = flag.boundingBox;
  // Hanging from the masthead, flying to starboard, away from the sail eased to port.
  assert.ok(Math.abs(max.y) < 1e-6 && Math.abs(min.x) < 1e-6 && max.x > 0);
  assert.ok(LOGO_FLAG.length > FLAG.length * 1.4 && LOGO_FLAG.height > FLAG.height * 1.4);
  assert.ok(BIG_RIG.top - LOGO_FLAG.height > BIG_RIG.boom + .5, 'clear of the boom');
  flag.dispose();
});
