import assert from 'node:assert/strict';
import test from 'node:test';
import { AMELIA_LEFT_FINOCOMP, ARRIVAL_END, DATES, DOCKED, MILESTONES, ROOM, STOPS, VOYAGE_END, progressAt, routeAt, scrolledSince, stillProgress } from '../src/components/garden/journey.ts';
import { MOBILE_RIVER_WIDTH, VOYAGE, bankEdge, bendShift, channelOffset, islandHalfWidth, launchJetties, riverCenter, voyageLandmarks } from '../src/components/garden/gardenGeometry.ts';
import { ALONGSIDE, BOAT_SCALE, CAST_OFF, CATAMARAN, SALSA, boatPose, companyFlags, ensignStaffs, hullHalfBeam, joining, rigging, salsaClock, salsaTime, salsaTurn, universityFlag } from '../src/components/garden/storyBoats.ts';
import { BIG_RIG, ENSIGN, FLAGS, HULL, LOGO_FLAG, ensignStaff, logoFlagGeometry } from '../src/components/garden/storyBoatGeometry.ts';

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
    // Nothing starts before the deck is finished, and all is done before July's balloon, as they enter the bend.
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
  // The engagement comes before the S-bend, and July's balloon as they enter
  // it, before it has swung the river.
  assert.ok(lastPlank < engaged && engaged < bend && Math.abs(bendShift(routeAt(balloon))) < .1);
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
      // Portrait's river opens out under the title, so there is room there too.
      const channel = channelOffset(pose.z, width);
      assert.ok(Math.abs(offset) > channel + (width < 1 ? .3 : .8), `${jetty.side} moored out by the bank (${width})`);
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

test('the boats fly no company flag until both run up FinoComp\'s as November 2018 shows', () => {
  const internship = progressAt(MILESTONES.find(m => m.id === 'internship').month);
  for (const p of steps().filter(p => p < internship)) assert.ok(companyFlags(p).every(({ company }) => company === null), `a flag up before ${p}`);
  for (const p of [internship + .35 * ROOM, progressAt(DATES.sydney)]) assert.deepEqual(companyFlags(p), bothUp('finocomp', 'finocomp'));
});

test('Amelia leaves FinoComp for a while, then starts at HeirWealth before Patrick does, each change a milestone of its own', () => {
  assert.equal(DATES.leftFinoComp, AMELIA_LEFT_FINOCOMP);
  const left = progressAt(DATES.leftFinoComp), joined = progressAt(DATES.joinedHeirWealth), patrick = progressAt(DATES.back);
  assert.ok(progressAt(DATES.sydney) < left && left < joined && joined < patrick);
  for (const month of [DATES.leftFinoComp, DATES.joinedHeirWealth]) assert.ok(MILESTONES.some(m => m.month === month), month);
  // Each change on one staff: the flag before all the way down before the next goes up.
  const runs = [0, 1].map(flagRuns);
  assert.deepEqual(runs[0].map(run => run.company), [null, 'finocomp', 'interim', 'heirwealth', null]);
  assert.deepEqual(runs[1].map(run => run.company), [null, 'finocomp', 'heirwealth', null]);
  for (const boat of runs) for (const run of boat.slice(2, -1)) assert.ok(run.after < .02 && run.hoist < .02, `${run.company} swapped at the foot of the staff`);
  // Each change starts as its month shows and is done while its date holds.
  const [, , interim, amelia] = runs[0], [, , heirwealth] = runs[1];
  assert.ok(interim.from >= left && amelia.from >= joined && heirwealth.from >= patrick);
  // Long enough to be seen: the interim flag, then hers HeirWealth's beside
  // his FinoComp, each fly fully up for most of a share.
  const fullyUp = (from, to, amelia, patrick) => steps(40000).filter(p => p >= from && p < to)
    .filter(p => JSON.stringify(companyFlags(p)) === JSON.stringify(bothUp(amelia, patrick))).length / 40000 / ROOM;
  assert.ok(fullyUp(left, joined, 'interim', 'finocomp') > .6);
  assert.ok(fullyUp(joined, patrick + .35 * ROOM, 'heirwealth', 'finocomp') > .7);
  assert.deepEqual(companyFlags(left + .35 * ROOM), bothUp('interim', 'finocomp'));
  for (const p of [joined + .35 * ROOM, patrick - .01 * ROOM]) assert.deepEqual(companyFlags(p), bothUp('heirwealth', 'finocomp'));
  assert.deepEqual(companyFlags(patrick + .35 * ROOM), bothUp('heirwealth', 'heirwealth'));
  // Each change is done by its milestone's stop, where the arrow keys and the scroll cue land.
  const stopAt = id => STOPS[MILESTONES.findIndex(m => m.id === id) + 1];
  assert.deepEqual(companyFlags(stopAt('internship')), bothUp('finocomp', 'finocomp'));
  assert.deepEqual(companyFlags(stopAt('interim')), bothUp('interim', 'finocomp'));
  assert.deepEqual(companyFlags(stopAt('amelia-heirwealth')), bothUp('heirwealth', 'finocomp'));
  assert.deepEqual(companyFlags(stopAt('heirwealth')), bothUp('heirwealth', 'heirwealth'));
  assert.ok(patrick + .35 * ROOM < progressAt(DATES.dating));
  // The boats are well apart in Sydney's river through both, so each boat's flag reads on its own.
  for (const p of [left + .35 * ROOM, joined + .35 * ROOM]) for (const width of widths) assert.ok(boatPose(p, width).gap > ALONGSIDE * 1.8, `apart at ${p} (${width})`);
  assert.ok(scrolledSince(DATES.back, joined + .35 * ROOM) < -.6);
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
    // Amelia's own changes have stills of their own, Patrick's flag unchanged.
    const hers = month === DATES.leftFinoComp ? 'interim' : month === DATES.joinedHeirWealth ? 'heirwealth' : company;
    assert.deepEqual(flying, [hers, company].map(company => ({ company, hoist: company ? 1 : 0 })), month);
  }
});

test('while they are at university both fly its flag, alone and then beside FinoComp\'s', () => {
  const stopAt = id => STOPS[MILESTONES.findIndex(m => m.id === id) + 1];
  const at = id => progressAt(MILESTONES.find(m => m.id === id).month);
  for (const p of steps().filter(p => p < progressAt(DATES.meet) || p >= stopAt('graduation'))) assert.equal(universityFlag(p), 0, `up at ${p}`);
  // Run up as they meet and settled by the meeting's stop, flying alone.
  assert.equal(universityFlag(stopAt('meet')), 1);
  assert.equal(universityFlag(stopAt('coast')), 1);
  assert.ok(companyFlags(stopAt('coast')).every(({ company }) => company === null));
  // Both flying by the internship's stop and through 2019, and struck as they graduate.
  for (const id of ['internship', 'snow-2019']) {
    assert.equal(universityFlag(stopAt(id)), 1, id);
    assert.deepEqual(companyFlags(stopAt(id)), bothUp('finocomp', 'finocomp'), id);
  }
  assert.equal(universityFlag(at('graduation') - .01 * ROOM), 1);
  assert.ok(universityFlag(at('graduation') + .07 * ROOM) < 1);
  assert.deepEqual(companyFlags(stopAt('graduation')), bothUp('finocomp', 'finocomp'));
  // It goes up and comes down smoothly: no jumps between steps.
  let last = universityFlag(0);
  for (const p of steps(40000)) {
    const flag = universityFlag(p);
    assert.ok(Math.abs(flag - last) < .05, `jumps at ${p}`);
    last = flag;
  }
});

test('reduced-motion stills show the university\'s flag settled', () => {
  for (const { id, month } of MILESTONES) {
    const up = ['meet', 'coast', 'internship', 'snow-2019'].includes(id) ? 1 : 0;
    assert.equal(universityFlag(stillProgress(progressAt(month)), true), up, id);
  }
});

test('the flags fly from ensign staffs at the sterns, the company\'s outboard and the university\'s inboard, clear of each other', () => {
  for (const morph of [0, .5, 1]) {
    for (const side of [-1, 1]) {
      const [x, top, z] = ensignStaff(side, morph);
      // Aft, at the stern, low beside the sail: well under the masthead.
      assert.ok(z > .55 && top < HULL.mastTop / 2, `${side} at ${morph}`);
      assert.ok(side * x >= 0);
    }
  }
  // On the dinghies the two staffs stand apart, so the two flags fly from
  // their own; on the catamaran each hull's company flag flies from its stern.
  assert.ok(ensignStaff(1, 0)[0] - ensignStaff(-1, 0)[0] > .2);
  assert.equal(ensignStaff(1, 1)[2], ensignStaff(-1, 1)[2]);
  assert.ok(ensignStaff(1, 1)[2] > ensignStaff(1, 0)[2] + .4);
  // Alongside, the two inboard flags, the university's shields, leave water between them.
  const [inboard] = ensignStaff(1, 0);
  assert.ok(ALONGSIDE - inboard - FLAGS.shield.length > .08);
  // Each is hoisted to the top of a staff taller than the flag.
  for (const [shape, { height }] of Object.entries(FLAGS)) assert.ok(ENSIGN.height > height * 1.6, shape);
});

test('each staff stands only while it has a flag to carry, so both stand while the university\'s flies beside FinoComp\'s', () => {
  const stopAt = id => STOPS[MILESTONES.findIndex(m => m.id === id) + 1];
  for (const p of steps(40000)) {
    const { company, university } = ensignStaffs(p);
    // A flag only goes up a staff that is fully stepped.
    assert.ok(companyFlags(p).every(({ hoist }) => hoist === 0 || company === 1), `a company flag on a falling staff at ${p}`);
    assert.ok(universityFlag(p) === 0 || university === 1, `the university's flag on a falling staff at ${p}`);
  }
  // Bare sterns under the title and at the dock.
  for (const p of [0, progressAt(DATES.meet) - .001, DOCKED, 1]) assert.deepEqual(ensignStaffs(p), { company: 0, university: 0 }, `${p}`);
  // Both stand, each with its flag fully up, from the internship's stop through 2019.
  for (const id of ['internship', 'snow-2019']) {
    assert.deepEqual(ensignStaffs(stopAt(id)), { company: 1, university: 1 }, id);
    assert.equal(universityFlag(stopAt(id)), 1, id);
  }
  // The university's is unshipped after graduation; the company's stays until the small masts go.
  assert.deepEqual(ensignStaffs(stopAt('graduation')), { company: 1, university: 0 });
  assert.deepEqual(ensignStaffs(stopAt('salsa')), { company: 1, university: 0 });
  assert.deepEqual(ensignStaffs(stopAt('engaged')), { company: 0, university: 0 });
  // Reduced-motion stills show them settled.
  for (const { id, month } of MILESTONES) {
    const p = stillProgress(progressAt(month));
    const university = ['meet', 'coast', 'internship', 'snow-2019'].includes(id) ? 1 : 0;
    const company = month >= MILESTONES.find(m => m.id === 'internship').month && month < DATES.engaged ? 1 : 0;
    assert.deepEqual(ensignStaffs(p, true), { company, university }, id);
  }
});

test('the big mast flies their monogram on one flag at its masthead, larger than the company flags, clear of its sail', () => {
  const flag = logoFlagGeometry();
  flag.computeBoundingBox();
  const { min, max } = flag.boundingBox;
  // Hanging from the masthead, flying to starboard, away from the sail eased to port.
  assert.ok(Math.abs(max.y) < 1e-6 && Math.abs(min.x) < 1e-6 && max.x > 0);
  for (const [shape, { length, height }] of Object.entries(FLAGS)) assert.ok(LOGO_FLAG.length > length * 1.4 && LOGO_FLAG.height > height * 1.4, shape);
  assert.ok(BIG_RIG.top - LOGO_FLAG.height > BIG_RIG.boom + .5, 'clear of the boom');
  flag.dispose();
});

// January 2026's salsa turn, played frame by frame at 60 a second as the
// eased scroll glides from the milestone before into salsa's stop and holds.
const salsaAt = progressAt(MILESTONES.find(m => m.id === 'salsa').month);
const salsaStop = STOPS.find(stop => stop > salsaAt);
function dance(from, to, { seconds = 8, reduced = false, turn = null } = {}) {
  const frames = [];
  for (let i = 0; i <= seconds * 60; i++) {
    const p = to + (from - to) * Math.exp(-2 * i / 60);
    turn = salsaClock(turn, p, 1 / 60, reduced);
    frames.push({ p, turn, ...salsaTurn(turn) });
  }
  return frames;
}

test('as salsa\'s date shows the catamaran turns once on the spot while the date holds, and ends on its heading', () => {
  const frames = dance(salsaAt - ROOM, salsaStop);
  const first = frames.findIndex(f => f.turn !== null);
  assert.ok(salsaTime(frames[first].p) >= SALSA.cue && salsaTime(frames[first - 1].p) < SALSA.cue, 'starts as the date shows');
  // Started early in the date's hold, before its stop.
  assert.ok(frames[first].p > salsaAt && frames[first].p < salsaStop && SALSA.late < .35);
  const turning = frames.filter(f => f.turn !== null && f.turn < SALSA.seconds);
  assert.ok(Math.abs(turning.length / 60 - SALSA.seconds) < .05, 'turns for SALSA.seconds');
  // Once right round, a little further, and smoothly, never a jump.
  assert.ok(Math.min(...frames.map(f => f.spin)) < -2 * Math.PI && Math.min(...frames.map(f => f.spin)) > -2 * Math.PI - .2);
  assert.ok(Math.max(...frames.map(f => f.spin)) < .25, 'only a little prep the other way');
  // (−2π at the end is the same heading as 0.)
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  for (let i = 1; i < frames.length; i++) assert.ok(Math.abs(wrap(frames[i].spin - frames[i - 1].spin)) < .12, `jumps at frame ${i}`);
  // Done, back on the heading it started on, upright and level.
  const last = frames.at(-1);
  assert.equal(last.turn, Infinity);
  assert.deepEqual([last.spin, last.heel, last.rise, ...last.shift], [0, 0, 0, 0, 0]);
  // Nothing before the date.
  assert.ok(frames.filter(f => salsaTime(f.p) < 0).every(f => f.turn === null && f.spin === 0));
});

test('the salsa turn holds while paused, is missed by a guest arriving late, plays again after going back, and never under reduced motion', () => {
  const half = salsaClock(SALSA.seconds / 2, salsaStop, 0);
  assert.equal(half, SALSA.seconds / 2);
  assert.equal(salsaClock(null, salsaAt + .6 * ROOM, 1 / 60), Infinity);
  assert.equal(salsaClock(Infinity, salsaStop, 1 / 60), Infinity);
  assert.equal(salsaClock(Infinity, salsaAt - .1 * ROOM, 1 / 60), null);
  assert.ok(dance(salsaAt - ROOM, salsaStop, { reduced: true }).every(f => f.spin === 0 && f.heel === 0));
  assert.equal(salsaTurn(salsaClock(null, stillProgress(salsaStop), 0, true)).spin, 0);
});

test('turning on the spot, the catamaran stays between the banks all through salsa\'s share', () => {
  // Each hull's pointed bow and square stern, in model units.
  const { bow, stern, half } = { bow: -1.5, stern: 1.15, half: CATAMARAN + hullHalfBeam(1) };
  for (const width of widths) {
    for (let p = salsaAt; p < salsaAt + ROOM; p += ROOM / 20) {
      const pose = boatPose(p, width), edge = bankEdge(pose.z, width);
      for (let s = .01; s < SALSA.seconds; s += .02) {
        const { spin, shift } = salsaTurn(s, pose.yaw), a = pose.yaw + spin;
        for (const [u, v] of [[-CATAMARAN, bow], [CATAMARAN, bow], [-half, stern], [half, stern]]) {
          const x = pose.x + shift[0] + (Math.cos(a) * u + Math.sin(a) * v) * BOAT_SCALE;
          assert.ok(Math.abs(x - riverCenter(pose.z, width)) < edge, `over the bank at ${s}s, p ${p} (${width})`);
        }
      }
    }
  }
});


test('the big sail is the toy sloops\' white cloth, each stripe a band of Amelia\'s teal under one of Patrick\'s yellow', async () => {
  const { JOINED_STRIPES } = await import('../src/components/garden/boatLooks.ts');
  assert.equal(JOINED_STRIPES.length % 2, 0);
  JOINED_STRIPES.forEach(([from, to, owner], i) => {
    assert.ok(from >= 0 && to > from && to < .7, 'low on the sail, where it is wide');
    assert.equal(owner, i % 2 ? 'patrick' : 'amelia');
    // Each yellow band joins the teal below it; ivory between the pairs.
    if (i % 2) assert.equal(from, JOINED_STRIPES[i - 1][1]);
    else if (i) assert.ok(from > JOINED_STRIPES[i - 1][1] + .1);
  });
});
