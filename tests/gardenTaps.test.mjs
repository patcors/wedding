import assert from 'node:assert/strict';
import test from 'node:test';
import { isTap, tapSlack } from '../src/components/garden/gardenTaps.ts';

test('a tap allows a wandering thumb more slack than a mouse', () => {
  assert.equal(tapSlack('mouse'), 6);
  assert.equal(tapSlack('touch'), 16);
  assert.equal(tapSlack('pen'), 16);
  // Safari's click may carry no pointer type: treated as touch.
  assert.equal(tapSlack(undefined), 16);
});

test('a drag or a scroll is not a tap', () => {
  const down = { clientX: 100, clientY: 200 };
  assert.ok(isTap(down, { clientX: 104, clientY: 203 }, 'mouse'));
  assert.ok(!isTap(down, { clientX: 105, clientY: 205 }, 'mouse'));
  assert.ok(isTap(down, { clientX: 110, clientY: 212 }, 'touch'));
  assert.ok(!isTap(down, { clientX: 100, clientY: 240 }, 'touch'));
});
