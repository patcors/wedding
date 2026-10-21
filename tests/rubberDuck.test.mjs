import assert from 'node:assert/strict';
import test from 'node:test';
import { computeSimplifiedRubberDuck, simplifiedRubberDuck } from '../src/components/garden/rubberDuckGeometry.ts';

// The voyage's far ducks are baked (scripts/bake-rubber-duck.mjs) rather than
// simplified on every load; the baked duck must be the one the code makes.
test('the baked far duck is exactly the simplified duck (re-run the bake script if not)', () => {
  const baked = simplifiedRubberDuck(.1), made = computeSimplifiedRubberDuck(.1);
  assert.deepEqual(Object.keys(baked.attributes).sort(), Object.keys(made.attributes).sort());
  for (const name of Object.keys(made.attributes)) {
    assert.equal(baked.attributes[name].itemSize, made.attributes[name].itemSize, name);
    assert.deepEqual(baked.attributes[name].array, made.attributes[name].array, name);
  }
  assert.deepEqual(baked.index.array, made.index.array);
  // Other shares are still worked out.
  assert.ok(simplifiedRubberDuck(.2).attributes.position.count > baked.attributes.position.count);
});
