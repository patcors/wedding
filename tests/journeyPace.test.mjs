import assert from 'node:assert/strict';
import test from 'node:test';
import { ROOM, STOPS, YEAR } from '../src/components/garden/journey.ts';

// Each milestone's date holds for this much of a share (HOLD in journey.ts, not exported).
const HOLD = .35;
import { GLIDE, MAX_SPEED, OPENING_RUN, PACE, REST, advancePace, atRest, createPace, glideAt, glidePlan, leashed, maxSpeedAt, paceToward } from '../src/components/garden/journeyPace.ts';

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

test('a hard scroll leaves the opening briskly, and is at the story\'s pace by the meeting', () => {
  // Under the title the cap is above anything the eased chase reaches.
  assert.ok(maxSpeedAt(0) / ROOM >= PACE.ease * PACE.lead);
  assert.ok(Math.abs(maxSpeedAt(OPENING_RUN[1]) - MAX_SPEED) < 1e-12);
  assert.ok(OPENING_RUN[1] < STOPS[1]);
  // The guest keeps scrolling hard: the leash holds the scroll ahead of the story.
  const pace = createPace(), reached = {};
  for (let t = 0; t < 10 && pace.progress < STOPS[1]; t += FRAME) {
    pace.target = leashed(1, pace.progress);
    advancePace(pace, t * 1000);
    for (const [name, p] of [['voyage', OPENING_RUN[0]], ['meeting', STOPS[1]]]) if (reached[name] === undefined && pace.progress >= p) reached[name] = t;
  }
  assert.ok(reached.voyage < .6, `the title took ${reached.voyage.toFixed(2)}s to clear`);
  assert.ok(reached.meeting < 2, `the meeting took ${reached.meeting.toFixed(2)}s to reach`);
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
  for (const pace of [once, twice]) pace.progress = .5, pace.target = 1;
  for (let frame = 0; frame <= 60; frame++) {
    const now = frame * 1000 / 60;
    advancePace(once, now);
    advancePace(twice, now), advancePace(twice, now);
  }
  assert.equal(twice.progress, once.progress);
  assert.ok(Math.abs(once.progress - .5 - MAX_SPEED) < 1e-9);
  // A stalled second counts as a single frame.
  advancePace(once, 3000);
  assert.ok(Math.abs(once.progress - .5 - MAX_SPEED * 1.05) < 1e-9);
});

// The glide sampled each frame from progress `from`.
function glide(from) {
  const plan = glidePlan(from), frames = [];
  for (let t = 0; t <= plan.length + FRAME; t += FRAME) frames.push({ t, p: glideAt(plan, t) });
  return { plan, frames };
}

test('the glide sails on to the dock without stopping, steadily and slower than a guest may scroll', () => {
  const { plan, frames } = glide(STOPS[1]);
  assert.equal(frames[0].p, STOPS[1]);
  assert.equal(frames.at(-1).p, 1);
  const cruise = GLIDE.speed * ROOM;
  for (let i = 1; i < frames.length; i++) {
    const { t } = frames[i], v = (frames[i].p - frames[i - 1].p) / FRAME;
    assert.ok(v >= -1e-9 && v <= cruise * 1.001, `${(v / ROOM).toFixed(2)} shares a second at ${t.toFixed(2)}s`);
    // Between setting off and arriving it never slows, let alone stops.
    if (t > GLIDE.ramp + FRAME && t < plan.length - GLIDE.ramp) assert.ok(Math.abs(v - cruise) < cruise * 1e-6, `slowed at ${t.toFixed(2)}s`);
  }
  // It sets off and arrives gently.
  assert.ok(glideAt(plan, FRAME) - STOPS[1] < .01 * ROOM);
  assert.ok(1 - glideAt(plan, plan.length - FRAME) < .01 * ROOM);
  // Slower than the most a guest may scroll, so each egg can be taken in,
  // and each milestone's date still shows for over half a second.
  assert.ok(GLIDE.speed < PACE.max && GLIDE.speed >= .3);
  assert.ok(HOLD / GLIDE.speed > .6);
  // Under a minute from the meeting to the dock.
  assert.ok(plan.length > 35 && plan.length < 60, `${plan.length.toFixed(1)}s`);
});

test('a short glide still arrives gently, and one from the dock is already there', () => {
  const near = glidePlan(1 - .2 * ROOM);
  assert.ok(near.cruise < GLIDE.speed && near.length > 2 * GLIDE.ramp - 1e-9);
  for (let t = 0; t < near.length; t += FRAME) assert.ok(glideAt(near, t + FRAME) >= glideAt(near, t));
  assert.equal(glideAt(near, near.length), 1);
  assert.equal(glidePlan(1).length, 0);
  assert.equal(glideAt(glidePlan(1), 0), 1);
});

test('the story is at rest once it has as good as stopped, not while it glides or travels', () => {
  const pace = createPace();
  assert.ok(atRest(pace));
  pace.target = 2 * ROOM;
  assert.ok(!atRest(pace));
  // Coasting to a stop, it counts as at rest well before the last of the drift.
  let now = 0, rested = null;
  while (pace.progress !== pace.target && now < 20000) { advancePace(pace, now += 1000 / 60); if (rested === null && atRest(pace)) rested = now; }
  assert.ok(rested !== null && now - rested > 1000, `rested ${((now - rested) / 1000).toFixed(1)}s before stopping`);
  assert.ok(Math.abs(pace.target - pace.progress) < REST * ROOM);
  pace.glide = { plan: glidePlan(pace.progress), t: 0 };
  assert.ok(!atRest(pace));
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
