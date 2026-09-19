import assert from 'node:assert/strict';
import test from 'node:test';
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions([EXTMeshoptCompression]).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
test('prepared rocks preserve atlas coordinates and ground-level origins for instancing', async () => {
  const document = await io.read('public/models/garden/ground/moss-rocks.glb');
  const nodes = document.getRoot().listNodes().filter(n => n.getMesh());
  assert.deepEqual(nodes.map(n => n.getName()).sort(), ['rock-1', 'rock-2', 'rock-3']);
  for (const node of nodes) {
    assert.deepEqual(node.getTranslation(), [0, 0, 0]);
    assert.deepEqual(node.getScale(), [1, 1, 1]);
    const p = node.getMesh().listPrimitives()[0];
    const position = p.getAttribute('POSITION');
    for (const semantic of ['NORMAL', 'TEXCOORD_0']) {
      const attribute = p.getAttribute(semantic);
      assert.ok(attribute, `${node.getName()} must retain ${semantic} for the external texture atlas`);
      assert.equal(attribute.getCount(), position.getCount());
      assert.ok([...attribute.getArray()].every(Number.isFinite));
    }
    const min = position.getMin([]), max = position.getMax([]);
    assert.ok(Math.abs(min[1]) < .06, 'rock base stays close to y=0 after simplification');
    assert.ok(Math.max(max[0] - min[0], max[2] - min[2]) <= 2.05);
    assert.ok(p.getIndices().getCount() / 3 < 1000, 'each repeated rock remains lightweight');
  }
});
