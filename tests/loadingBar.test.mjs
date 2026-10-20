import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { BAR, CREEP, LOAD_STAGES, announced, barSpan, barStep, laterStage, onItems, reportItems } from '../src/components/garden/loadingBar.ts';

const css = readFileSync(new URL('../src/components/garden/gardenLoader.css', import.meta.url), 'utf8');

test('the stages share the bar out end to end, from empty to full', () => {
  assert.equal(BAR.page[0], 0);
  assert.equal(BAR.ready[0], 1);
  for (let i = 1; i < LOAD_STAGES.length; i++) assert.equal(BAR[LOAD_STAGES[i]][0], BAR[LOAD_STAGES[i - 1]][1], LOAD_STAGES[i]);
  for (const stage of LOAD_STAGES) assert.ok(BAR[stage][0] <= BAR[stage][1], stage);
});

test('the creep before any script stops where the script takes over, as the CSS has it', () => {
  const keyframes = css.match(/@keyframes garden-loading-creep \{ to \{ transform: scaleX\(([\d.]+)\); \} \}/);
  assert.ok(keyframes, 'the creep keyframes');
  assert.equal(Number(keyframes[1]), BAR.page[1]);
  assert.equal(Number(keyframes[1]), BAR.script[0]);
  assert.match(css, new RegExp(`animation: garden-loading-creep ${CREEP.seconds.page}s `));
  // A plain fill under reduced motion: steps, not a glide.
  assert.match(css, /prefers-reduced-motion: reduce\) \{ \.garden-loading-fill \{ animation-timing-function: steps\(/);
});

test('stages only move forwards', () => {
  assert.equal(laterStage('assets', 'script'), 'assets');
  assert.equal(laterStage('building', 'assets'), 'building');
  assert.equal(laterStage('script', 'prepared'), 'prepared');
  assert.equal(laterStage('ready', 'page'), 'ready');
});

test('downloads fill their stretch by the square of the share arrived, creeping on towards its end', () => {
  const [start, end] = BAR.assets;
  assert.deepEqual(barSpan('assets', { loaded: 0, total: 20 }), { floor: start, ceiling: end });
  assert.equal(barSpan('assets', { loaded: 10, total: 20 }).floor, start + (end - start) / 4);
  assert.equal(barSpan('assets', { loaded: 20, total: 20 }).floor, end);
  // Nothing counted yet, or more reported than started: still inside the stretch.
  assert.deepEqual(barSpan('assets'), { floor: start, ceiling: end });
  assert.equal(barSpan('assets', { loaded: 30, total: 20 }).floor, end);
  // The creep goes most of the way to the end, never past it.
  const step = barStep(start, 'assets', { loaded: 10, total: 20 });
  assert.ok(step.creep > step.to && step.creep < end);
});

test('the bar never goes back, whatever arrives when', () => {
  // A load like the one on throttled 3G: the script, downloads arriving in
  // bursts, the scene's own second wave of textures (the total growing after
  // all had arrived), a late item after the scene was prepared, then ready.
  const reports = [['script'], ['assets', 0, 21], ...Array.from({ length: 21 }, (_, i) => ['assets', i + 1, 21]),
    ['building', 21, 21], ['assets', 21, 25], ['assets', 22, 25], ['prepared'], ['assets', 25, 25], ['ready']];
  for (const seed of [0, .3, .7, 1]) for (const reduced of [false, true]) {
    let shown = .05, stage = 'page', items;
    for (const [reported, loaded, total] of reports) {
      if (loaded !== undefined) items = { loaded, total };
      stage = laterStage(stage, reported);
      const step = barStep(shown, stage, items, reduced);
      assert.equal(step.from, shown);
      assert.ok(step.to >= shown, `${reported} ${loaded}/${total}: ${step.to} < ${shown}`);
      assert.ok(step.creep >= step.to && step.creep <= 1);
      if (reduced) { assert.equal(step.creep, step.to); assert.equal(step.seconds, 0); }
      // However far the animation has got when the next report comes.
      shown = step.to + (step.creep - step.to) * seed;
    }
    assert.equal(shown, 1);
  }
});

test('ready fills it to the end at once, without creeping', () => {
  assert.deepEqual(barStep(.83, 'ready'), { from: .83, to: 1, creep: 1, seconds: 0 });
  assert.deepEqual(barStep(1.2, 'prepared'), { from: 1, to: 1, creep: 1, seconds: CREEP.seconds.prepared });
});

test('screen readers hear it in tens of percent', () => {
  assert.equal(announced(0), 0);
  assert.equal(announced(.16), 10);
  assert.equal(announced(.7), 70);
  assert.equal(announced(.999), 90);
  assert.equal(announced(1), 100);
});

test('a listener that comes late still hears the latest count', () => {
  reportItems(3, 20);
  const heard = [];
  const stop = onItems(items => heard.push(items));
  reportItems(4, 20);
  stop();
  reportItems(5, 20);
  assert.deepEqual(heard, [{ loaded: 3, total: 20 }, { loaded: 4, total: 20 }]);
});
