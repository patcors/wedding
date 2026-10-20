import assert from 'node:assert/strict';
import test from 'node:test';
import { ARRIVAL_END, VOYAGE_END } from '../src/components/garden/journey.ts';
import { placeToKeep, placeToReopen, progressFor, scrollFor } from '../src/components/garden/voyagePlace.ts';

test('turning the phone keeps the story at the same progress, not the same pixels', () => {
  // The scroll space is about 2300svh: about 844px tall upright, 390px on its side.
  const portrait = 23 * 844 - 844, landscape = 23 * 390 - 390;
  for (const top of [9000, 600]) {
    const before = progressFor(top, portrait);
    const after = scrollFor(before, landscape);
    assert.ok(Math.abs(progressFor(after, landscape) - before) < 2 / landscape, `${progressFor(after, landscape).toFixed(4)} is not ${before.toFixed(4)}`);
    // Keeping the pixels instead is the old jump, some way on in the story.
    if (top === 9000) assert.ok(progressFor(top, landscape) - before > .4);
    // And back again lands where it started, to the pixel.
    assert.ok(Math.abs(scrollFor(progressFor(after, landscape), portrait) - top) <= 2);
  }
  // Whole pixels, within the page.
  assert.ok(Number.isInteger(scrollFor(.5, 101)));
  assert.equal(scrollFor(1, 500), 500);
  assert.equal(scrollFor(1.2, 500), 500);
  assert.equal(scrollFor(0, 500), 0);
  assert.equal(scrollFor(-.1, 500), 0);
  assert.equal(progressFor(500, 500), 1);
  assert.equal(progressFor(0, 500), 0);
});

test('leaving for the details mid-story reopens there once back', () => {
  const kept = placeToKeep(.4);
  assert.equal(placeToReopen(kept), .4);
  // From the dock, or on the way into it, it reopens at the dock's rest.
  assert.equal(placeToReopen(placeToKeep(1)), 1);
  assert.equal(placeToReopen(placeToKeep(VOYAGE_END + .01)), 1);
  assert.equal(placeToReopen(placeToKeep(VOYAGE_END - .01)), VOYAGE_END - .01);
});

test('a fresh visit, or leaving from the opening, opens at the title', () => {
  // Nothing kept: a new tab or visit (sessionStorage is empty).
  assert.equal(placeToReopen(null), null);
  // From under the title there is nothing to come back to.
  assert.equal(placeToKeep(0), null);
  assert.equal(placeToKeep(ARRIVAL_END / 2), null);
  assert.equal(placeToKeep(NaN), null);
  // Anything unreadable opens at the title rather than somewhere odd.
  for (const junk of ['', 'nope', 'null', '{}', '{"p":"0.4"}', '{"p":2}', '{"p":0.01}']) assert.equal(placeToReopen(junk), null, junk);
});
