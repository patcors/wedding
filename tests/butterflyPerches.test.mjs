import assert from 'node:assert/strict';
import test from 'node:test';
import { availablePerch, spacedPerches } from '../src/components/garden/butterflyPerches.ts';

test('perches preserve foothold spacing, including adjacent text lines', () => {
  const letters = Array.from({ length: 30 }, (_, i) => ({ key: String(i), x: i % 15 * 20, y: i < 15 ? 100 : 150 }));
  for (const spacing of [25, 32]) {
    const spots = spacedPerches(letters, spacing);
    assert.ok(spots.length > 1 && spots.length < letters.length);
    spots.forEach((a, i) => spots.slice(i + 1).forEach(b => {
      assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= spacing);
    }));
  }
});

test('reservations spread out, refuse excess visits, and can be reused after retirement', () => {
  const spots = [0, 70, 140, 210].map(x => ({ key: String(x), x, y: 100 }));
  const occupied = new Set();
  const first = availablePerch(spots, occupied); occupied.add(first.key);
  const second = availablePerch(spots, occupied); occupied.add(second.key);
  assert.equal(Math.abs(first.x - second.x), 210);
  while (occupied.size < spots.length) {
    const spot = availablePerch(spots, occupied);
    assert.ok(!occupied.has(spot.key)); occupied.add(spot.key);
  }
  assert.equal(availablePerch(spots, occupied), undefined);
  occupied.delete(second.key);
  assert.equal(availablePerch(spots, occupied).key, second.key);
});
