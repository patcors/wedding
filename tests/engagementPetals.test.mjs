import assert from 'node:assert/strict';
import test from 'node:test';
import { DATES, DOCKED, MILESTONES, ROOM, progressAt, routeAt, stillProgress } from '../src/components/garden/journey.ts';
import { MOBILE_RIVER_WIDTH, bankEdge, bendShift, riverCenter } from '../src/components/garden/gardenGeometry.ts';
import { CATAMARAN, HULL_HALF_BEAM, RIG_CHANGE, boatPose } from '../src/components/garden/storyBoats.ts';
import { PETALS, PETAL_LIST, PETAL_WINDOW, afloat, floatPoint, petalCourse, petalScale, petalTime, petalsShown, restingPetals } from '../src/components/garden/eggs/petalTrail.ts';

const widths = [1, MOBILE_RIVER_WIDTH];
const engaged = progressAt(DATES.engaged);
// Shares since the engagement when the S-bend has swung the river half a
// unit under the boats: the trip's date shows just as they enter it.
const bend = (() => { let p = engaged; while (Math.abs(bendShift(routeAt(p))) < .5) p += 1e-5; return petalTime(p); })();
const wake = PETAL_LIST.slice(0, PETALS.wake.count), sail = PETAL_LIST.slice(PETALS.wake.count);

test('the petals trail only from the engagement until the S-bend starts to swing the river', () => {
  assert.ok(!petalsShown(petalTime(engaged - .01 * ROOM)) && !petalsShown(0));
  assert.ok(petalsShown(PETALS.wake.from + .01), 'the first are let go as the date shows');
  assert.ok(PETAL_WINDOW[0] > 0 && PETAL_WINDOW[0] < .05);
  assert.ok(PETAL_WINDOW[1] < bend - .02, `gone before the bend (${PETAL_WINDOW[1]} of ${bend})`);
  for (const t of [bend, petalTime(DOCKED), petalTime(1)]) assert.ok(!petalsShown(t));
  for (const petal of PETAL_LIST) {
    assert.ok(!afloat(petal, petal.at - 1e-6) && afloat(petal, petal.at) && !afloat(petal, petal.at + PETALS.life));
    assert.ok(petal.at >= PETAL_WINDOW[0] && petal.at + PETALS.life <= PETAL_WINDOW[1]);
  }
  // By the next milestone's date the trail is thinning out: well under half as
  // many afloat as at its fullest.
  const next = MILESTONES[MILESTONES.findIndex(m => m.month === DATES.engaged) + 1];
  const count = t => PETAL_LIST.filter(petal => afloat(petal, t)).length;
  const fullest = Math.max(...Array.from({ length: 140 }, (_, i) => count(i / 100)));
  assert.ok(count(petalTime(progressAt(next.month))) < fullest / 2.5);
});

test('the wake\'s petals thin out towards the end, and the sail\'s fall as it unrolls', () => {
  const gaps = wake.slice(1).map((petal, i) => petal.at - wake[i].at);
  const third = Math.floor(gaps.length / 3), mean = list => list.reduce((a, b) => a + b) / list.length;
  assert.ok(mean(gaps.slice(-third)) > 1.5 * mean(gaps.slice(0, third)));
  assert.ok(wake.every(petal => petal.at >= PETALS.wake.from && petal.at <= PETALS.wake.to));
  assert.ok(sail.length > 0 && sail.every(petal => petal.at >= RIG_CHANGE.unfurl[0] && petal.at <= RIG_CHANGE.unfurl[1]));
});

test('each petal lands on the water, the wake\'s between the sterns and the sail\'s outboard of the port hull', () => {
  const between = CATAMARAN - HULL_HALF_BEAM.catamaran, outboard = CATAMARAN + HULL_HALF_BEAM.catamaran;
  for (const petal of wake) assert.ok(Math.abs(petal.to[0]) < between && petal.to[1] > .66);
  for (const petal of sail) assert.ok(petal.to[0] < -outboard && petal.from[1] > .4);
  for (const width of widths) {
    for (const petal of PETAL_LIST) {
      const course = petalCourse(petal, width);
      for (const age of [0, .1, PETALS.life]) {
        const [x, y, z] = floatPoint(petal, course, age, width);
        assert.ok(Math.abs(x - riverCenter(z, width)) < bankEdge(z, width) * .9, `on the water (${width})`);
        assert.equal(y, 0);
      }
      // Let go from aboard, above the water, behind or beside where it was.
      assert.ok(course.from[1] > .2);
    }
  }
});

test('a petal floats full size, then sinks out of sight at the end of its life', () => {
  assert.equal(petalScale(-.01), 0);
  assert.equal(petalScale(0), 1);
  assert.equal(petalScale(PETALS.life * .5), 1);
  assert.ok(petalScale(PETALS.life) < 1e-9 && petalScale(PETALS.life + .01) === 0);
  for (let age = .01; age < PETALS.life; age += .01) assert.ok(petalScale(age) <= petalScale(age - .01) && petalScale(age) > 0);
});

test('under reduced motion a few petals rest on the water behind the catamaran at the engagement\'s still', () => {
  assert.equal(stillProgress(engaged + .5 * ROOM), engaged);
  for (const width of widths) {
    const resting = restingPetals(width), pose = boatPose(engaged, width);
    assert.equal(resting.length, PETALS.settled);
    for (const { position: [x, , z] } of resting) {
      assert.ok(Math.abs(x - riverCenter(z, width)) < bankEdge(z, width));
      // Behind the sterns, along the heading.
      const back = (x - pose.x) * Math.sin(pose.yaw) + (z - pose.z) * Math.cos(pose.yaw);
      assert.ok(back > 1, `behind (${back})`);
    }
  }
});

test('the trail stays small: one instanced mesh of about a hundred petals', () => {
  assert.ok(PETAL_LIST.length <= 110);
});
