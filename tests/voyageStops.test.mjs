import assert from 'node:assert/strict';
import test from 'node:test';
import { DOCKED, MILESTONES, STOPS, dateLabel, milestoneAt, nextStop, previousStop, progressAt, stillProgress } from '../src/components/garden/journey.ts';

test('each milestone stop shows its own date and milestone, still under reduced motion', () => {
  assert.equal(STOPS.length, MILESTONES.length + 2);
  MILESTONES.forEach((milestone, i) => {
    const stop = STOPS[i + 1];
    assert.equal(milestoneAt(stop), milestone);
    assert.equal(dateLabel(stop), dateLabel(progressAt(milestone.month)));
    assert.equal(stillProgress(stop), progressAt(milestone.month));
  });
});

test('stepping walks opening, milestones, celebration and back', () => {
  let p = 0;
  for (const stop of STOPS.slice(1)) p = nextStop(p), assert.equal(p, stop);
  assert.ok(p > DOCKED);
  assert.equal(nextStop(p), 1);
  for (const stop of STOPS.slice(0, -1).reverse()) p = previousStop(p), assert.equal(p, stop);
  // A pixel either side of a stop still steps on from it.
  assert.equal(nextStop(STOPS[3] - 6e-5), STOPS[4]);
  assert.equal(previousStop(STOPS[3] + 6e-5), STOPS[2]);
});

test('no milestone outside the voyage or before the first date', () => {
  assert.equal(milestoneAt(0), null);
  assert.equal(milestoneAt(progressAt(MILESTONES[0].month) - 1e-4), null);
  assert.equal(milestoneAt(1), null);
});
