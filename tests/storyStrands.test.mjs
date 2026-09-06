import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

const result = await build({
  stdin: { contents: `
    export { buildSilkGeometry } from './src/components/story/strandGeometry';
    export { buildStoryStrandCurve } from './src/components/story/storyStrandCurve';
    export { sharedBillboards } from './src/components/story/billboards';
    export { billboardAnchor, buildCameraJourney } from './src/components/story/cameraJourney';
    export { strandPointAt, spineAt } from './src/components/story/curves';
  `, resolveDir: process.cwd() },
  bundle: true, write: false, platform: 'node', format: 'esm',
});
const { buildSilkGeometry, buildStoryStrandCurve, sharedBillboards, strandPointAt, spineAt, billboardAnchor, buildCameraJourney } =
  await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);

test('silk cross-section stays continuous through photo loops', () => {
  const curve = buildStoryStrandCurve('silk', sharedBillboards);
  const geometry = buildSilkGeometry(curve);
  const across = geometry.getAttribute('aBinormal');
  let minimumDot = 1;
  let worstSlice = 0;
  for (let i = 7; i < across.count; i += 7) {
    const dot = across.getX(i) * across.getX(i - 7) + across.getY(i) * across.getY(i - 7) + across.getZ(i) * across.getZ(i - 7);
    if (dot < minimumDot) { minimumDot = dot; worstSlice = i / 7; }
  }
  geometry.dispose();
  assert.ok(minimumDot > 0.5, `ribbon flips between slices: minimum dot ${minimumDot} at slice ${worstSlice}`);
});

test('both existing strands retain their opening and converge at the knot', () => {
  for (const side of ['rope', 'silk']) {
    const curve = buildStoryStrandCurve(side, sharedBillboards);
    assert.ok(curve.getPoint(0).distanceTo(strandPointAt(0, side)) < 1e-6);
    assert.ok(curve.getPoint(1).distanceTo(strandPointAt(1, side)) < 1e-6);
    for (let i = 0; i <= 1000; i++) assert.ok(curve.getPointAt(i / 1000).toArray().every(Number.isFinite));
  }
});

test('photo positions alternate sides and heights; camera stays finite on both screen shapes', () => {
  const anchors = sharedBillboards.map((spec, index) => billboardAnchor(spec, index));
  anchors.forEach((anchor, i) => {
    assert.equal(Math.sign(anchor.x - spineAt(sharedBillboards[i].t).x), i % 2 === 0 ? 1 : -1);
    if (i) {
      assert.ok(anchors[i - 1].z - anchor.z >= 30);
      assert.ok(Math.abs(anchors[i - 1].y - anchor.y) > 3);
    }
  });
  for (const aspect of [390 / 844, 1280 / 800]) {
    const journey = buildCameraJourney(sharedBillboards, aspect, 48);
    const position = anchors[0].clone();
    const target = position.clone();
    for (let i = 0; i <= 1000; i++) {
      journey(i / 1000, position, target);
      assert.ok([...position.toArray(), ...target.toArray()].every(Number.isFinite));
      assert.ok(position.distanceTo(target) > 1);
    }
  }
});
