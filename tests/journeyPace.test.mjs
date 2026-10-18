import assert from 'node:assert/strict';
import test from 'node:test';
import { DATES, ROOM, STOPS, YEAR, progressAt } from '../src/components/garden/journey.ts';
import { GLIDE, GLIDE_STOPS, MAX_SPEED, PACE, advancePace, createPace, glideAt, glidePlan, leashed, paceToward } from '../src/components/garden/journeyPace.ts';
import { SALSA } from '../src/components/garden/storyBoats.ts';
import { PROPOSAL } from '../src/components/garden/eggs/proposal.ts';
import { CAPS } from '../src/components/garden/eggs/capToss.ts';
import { NESTS, NEST_EVENTS } from '../src/components/garden/eggs/nesting.ts';
import { ROCKET, launchProgress } from '../src/components/garden/eggs/rocketLaunch.ts';

const FRAME = 1 / 60;

test('the story eases after a small scroll as before, and never travels faster than its pace', () => {
  // A small scroll: the old damping, untouched.
  const near = paceToward(0, .2 * ROOM, FRAME);
  assert.ok(Math.abs(near - .2 * ROOM * (1 - Math.exp(-PACE.ease * FRAME))) < 1e-12);
  // A fling to the end, or back to the start, goes at the most it may.
  assert.ok(Math.abs(paceToward(.5, 1, FRAME) - (.5 + MAX_SPEED * FRAME)) < 1e-12);
  assert.ok(Math.abs(paceToward(.5, 0, FRAME) - (.5 - MAX_SPEED * FRAME)) < 1e-12);
  // And settles exactly on where the scroll stopped.
  let p = 0, t = 0;
  while (p !== 1 && t < 100) p = paceToward(p, 1, FRAME), t += FRAME;
  assert.equal(p, 1);
  assert.ok(t >= 1 / MAX_SPEED, `the whole story took only ${t.toFixed(1)}s`);
  // Brisk: about two seconds a year at the most.
  assert.ok(PACE.max >= .6 && PACE.max <= 1.2);
  assert.ok(YEAR / PACE.max >= 1.5 && YEAR / PACE.max <= 2.5);
});

test('the scroll stays within reach of the story either way', () => {
  const lead = PACE.lead * ROOM;
  assert.equal(leashed(.5, .3), .3 + lead);
  assert.equal(leashed(.1, .3), .3 - lead);
  assert.equal(leashed(.31, .3), .31);
  // Enough that an ordinary scroll at the most the story travels never meets it.
  assert.ok(lead > MAX_SPEED / PACE.ease);
});

test('the page and the scene moving the pace in the same frame move it once', () => {
  const once = createPace(), twice = createPace();
  for (const pace of [once, twice]) pace.target = 1;
  for (let frame = 0; frame <= 60; frame++) {
    const now = frame * 1000 / 60;
    advancePace(once, now);
    advancePace(twice, now), advancePace(twice, now);
  }
  assert.equal(twice.progress, once.progress);
  assert.ok(Math.abs(once.progress - MAX_SPEED) < 1e-9);
  // A stalled second counts as a single frame.
  advancePace(once, 3000);
  assert.ok(Math.abs(once.progress - MAX_SPEED * 1.05) < 1e-9);
});

// The glide sampled each frame from progress `from`.
function glide(from) {
  const plan = glidePlan(from), frames = [];
  for (let t = 0; t <= plan.length + FRAME; t += FRAME) frames.push({ t, p: glideAt(plan, t) });
  return { plan, frames };
}

test('the glide stops at each milestone, the rocket and the celebration in turn, never faster than a guest may scroll', () => {
  const { plan, frames } = glide(STOPS[1]);
  assert.deepEqual(plan.legs.map(leg => leg.to), GLIDE_STOPS.slice(1).map(stop => stop.p));
  // Every milestone's stop, and one more between the trip and the wedding, where the rocket goes up.
  assert.deepEqual(GLIDE_STOPS.map(stop => stop.p).filter(p => STOPS.includes(p)), STOPS.slice(1));
  const rocket = GLIDE_STOPS.findIndex(stop => stop.id === 'rocket');
  assert.equal(GLIDE_STOPS[rocket - 1].id, 'turkey-greece');
  assert.equal(GLIDE_STOPS[rocket + 1].id, 'celebration');
  assert.equal(frames.at(-1).p, 1);
  for (let i = 1; i < frames.length; i++) {
    const v = (frames[i].p - frames[i - 1].p) / FRAME;
    assert.ok(v >= -1e-9 && v <= MAX_SPEED * 1.001, `${(v / ROOM).toFixed(2)} shares a second at ${frames[i].t.toFixed(2)}s`);
  }
  // It sets off and arrives gently: the first and last frames of a leg barely move.
  for (const leg of plan.legs) {
    assert.ok(glideAt(plan, leg.start + FRAME) - leg.from < .01 * ROOM);
    assert.ok(leg.to - glideAt(plan, leg.start + leg.travel - FRAME) < .01 * ROOM);
    assert.equal(glideAt(plan, leg.start + leg.travel + leg.hold / 2), leg.to);
  }
  // A minute or so from the meeting to the dock.
  assert.ok(plan.length > 60 && plan.length < 90, `${plan.length.toFixed(1)}s`);
  // From part way along a leg, it goes on to the next stop.
  assert.equal(glidePlan((STOPS[3] + STOPS[4]) / 2).legs[0].to, STOPS[4]);
  assert.deepEqual(glidePlan(1).legs, []);
  assert.equal(glideAt(glidePlan(1), 0), 1);
});

test('the glide holds long enough at a milestone for what plays out there', () => {
  const { plan, frames } = glide(STOPS[1]);
  const held = (start, id) => {
    const leg = plan.legs.find(leg => leg.to === GLIDE_STOPS.find(stop => stop.id === id).p);
    const reached = frames.find(frame => frame.p >= start).t;
    return leg.start + leg.travel + leg.hold - reached;
  };
  const scenes = [
    ['graduation', progressAt('2020-08') + Math.max(...CAPS.tosses.map(toss => toss.at)) * ROOM, CAPS.flight],
    ['apartments', progressAt('2024-05') + NEST_EVENTS[1].at * ROOM, NESTS.flight],
    ['rocket', launchProgress(), ROCKET.ignite + ROCKET.flight],
    ['salsa', progressAt('2026-01') + SALSA.cue * ROOM, SALSA.seconds],
    ['engaged', progressAt(DATES.engaged) + PROPOSAL.kneel.cue * ROOM, PROPOSAL.kneel.seconds],
  ];
  for (const [id, start, seconds] of scenes) {
    assert.ok(GLIDE.holds[id] > GLIDE.hold, id);
    assert.ok(held(start, id) >= seconds, `${id}: ${held(start, id).toFixed(2)}s of ${seconds}s`);
  }
});

test('a glide moves the pace itself, and ends at the dock', () => {
  const pace = createPace();
  pace.progress = pace.target = STOPS[15];
  pace.glide = { plan: glidePlan(pace.progress), t: 0 };
  let now = 0;
  while (pace.glide && now < 60000) advancePace(pace, now += 1000 / 60);
  assert.equal(pace.glide, null);
  assert.equal(pace.progress, 1);
  assert.equal(pace.target, 1);
});
