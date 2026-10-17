import assert from 'node:assert/strict';
import test from 'node:test';
import { DATES, MILESTONES, ROOM, progressAt, stillProgress } from '../src/components/garden/journey.ts';
import { catamaran, joining } from '../src/components/garden/storyBoats.ts';
import { BUTTERFLY_COLORS } from '../src/components/garden/butterflyColors.ts';
import { DANCE, FLYERS, courtshipTime, flightPoint, flying, perch } from '../src/components/garden/eggs/datingFlight.ts';

const dating = progressAt(DATES.dating);
const next = MILESTONES[MILESTONES.findIndex(m => m.month === DATES.dating) + 1];

test('the butterflies arrive as they start dating, while the crossbeams go across, and are gone before the next milestone', () => {
  const firstBeam = (() => { let p = dating; while (catamaran(joining(p)).beams[0] === 0) p += 1e-4; return p; })();
  for (const flyer of FLYERS) {
    assert.ok(Math.abs(flyer.arrive[0]) < .25 && flyer.arrive[1] * ROOM + dating > firstBeam - ROOM * .2, flyer.colour);
    assert.ok(!flying(flyer, courtshipTime(dating - .3 * ROOM)));
    assert.ok(flying(flyer, courtshipTime(firstBeam)), `${flyer.colour} circles as the beams go across`);
    assert.ok(!flying(flyer, courtshipTime(progressAt(next.month))), `${flyer.colour} gone by ${next.month}`);
  }
});

test('a teal and a yellow butterfly fly as a pair, dancing round each other, and leave last', () => {
  const pair = FLYERS.filter(f => f.partner);
  assert.deepEqual(pair.map(f => f.colour).sort(), ['butter', 'turquoise']);
  for (const flyer of FLYERS) assert.ok(flyer.colour in BUTTERFLY_COLORS);
  const others = FLYERS.filter(f => !f.partner);
  assert.ok(others.every(f => f.leave[1] <= pair[0].leave[1]));
  for (const s of [0, 3.3, 10, 41.7]) {
    const [a, b] = pair.map(f => flightPoint(f, s, .8));
    const apart = Math.hypot(a[0] - b[0], a[2] - b[2]);
    assert.ok(Math.abs(apart - 2 * DANCE.radius) < 1e-9, `apart ${apart}`);
  }
});

test('circling, they stay round the boats and above the water', () => {
  for (const flyer of FLYERS) {
    for (let s = 0; s < 60; s += .37) {
      const [x, y, z] = flightPoint(flyer, s, (flyer.arrive[1] + flyer.leave[0]) / 2);
      const out = Math.hypot(x, z / flyer.orbit.stretch);
      assert.ok(out > .8 && out < 2.8, `${flyer.colour} ${out} out`);
      assert.ok(y > .5 && y < 2.4, `${flyer.colour} at ${y}`);
    }
  }
});

test('they come out of the trees and leave the way they came, continuously', () => {
  for (const flyer of FLYERS) {
    assert.deepEqual(flightPoint(flyer, 0, flyer.arrive[0]).map(v => Math.round(v * 10)), flyer.from.map(v => Math.round(v * 10)));
    const end = flightPoint(flyer, 0, flyer.leave[1]);
    assert.ok(Math.hypot(end[0] - flyer.to[0], end[2] - flyer.to[2]) < .6);
    let last = flightPoint(flyer, 5, flyer.arrive[0]);
    for (let t = flyer.arrive[0]; t < flyer.leave[1]; t += .01) {
      const point = flightPoint(flyer, 5, t);
      assert.ok(Math.hypot(...point.map((v, i) => v - last[i])) < .5, `${flyer.colour} jumps at ${t}`);
      last = point;
    }
  }
});

test('under reduced motion the pair rest on the bows at dating\'s still', () => {
  const still = stillProgress(dating + .5 * ROOM);
  assert.equal(still, dating);
  assert.equal(courtshipTime(still), 0);
  const [a, b] = FLYERS.filter(f => f.partner).map(f => perch(f, .75));
  assert.ok(a && b && Math.sign(a[0]) !== Math.sign(b[0]));
  assert.equal(FLYERS.filter(f => !f.partner).map(f => perch(f, .75)).filter(Boolean).length, 0);
});
