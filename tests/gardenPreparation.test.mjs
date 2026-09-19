import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareGardenScene } from '../src/components/garden/gardenPreparation.ts';

test('readiness waits for compilation, two complete renders and a paint opportunity', async () => {
  const calls = [];
  let finishCompilation;
  const compiling = new Promise(resolve => { finishCompilation = resolve; });
  const scene = {}, camera = {};
  const renderer = {
    compileAsync(s, c) { assert.equal(s, scene); assert.equal(c, camera); calls.push('compile'); return compiling; },
    render(s, c) { assert.equal(s, scene); assert.equal(c, camera); calls.push('render'); },
  };
  let ready = false;
  const preparation = prepareGardenScene(renderer, scene, camera, () => false, async () => { calls.push('frame'); })
    .then(value => { ready = value; });
  await Promise.resolve();
  assert.equal(ready, false);
  assert.deepEqual(calls, ['frame', 'compile']);
  finishCompilation();
  await preparation;
  assert.equal(ready, true);
  assert.deepEqual(calls, ['frame', 'compile', 'frame', 'render', 'frame', 'render', 'frame']);
});

test('an unmounted or failed scene cannot signal readiness', async () => {
  let cancelled = false;
  const renderer = {
    async compileAsync() { cancelled = true; },
    render() { assert.fail('cancelled scene rendered'); },
  };
  assert.equal(await prepareGardenScene(renderer, {}, {}, () => cancelled, async () => {}), false);
  const failedRenderer = { async compileAsync() {}, render() { throw new Error('GPU render failed'); } };
  await assert.rejects(prepareGardenScene(failedRenderer, {}, {}, () => false, async () => {}), /GPU render failed/);
});
