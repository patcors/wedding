import assert from 'node:assert/strict';
import test from 'node:test';
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions([EXTMeshoptCompression])
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

for (const variant of [1, 2]) {
  test(`ash ${variant}: compressed assets retain usable geometry and leaf wind data`, async () => {
    const triangleCounts = [];
    for (const suffix of ['', '-distant']) {
      const document = await io.read(`public/models/garden/ash-${variant}${suffix}.glb`);
      const nodes = document.getRoot().listNodes().filter(node => node.getMesh());
      assert.deepEqual(nodes.map(node => node.getName()).sort(), ['branches', 'leaves']);
      let triangles = 0;
      for (const node of nodes) {
        // Runtime instancing uses geometry directly, so transforms must be baked.
        assert.deepEqual(node.getTranslation(), [0, 0, 0]);
        assert.deepEqual(node.getScale(), [1, 1, 1]);
        const primitive = node.getMesh().listPrimitives()[0];
        const positions = primitive.getAttribute('POSITION');
        assert.ok(positions.getCount() > 0);
        assert.ok([...positions.getArray()].every(Number.isFinite));
        const indices = primitive.getIndices();
        assert.ok([...indices.getArray()].every(index => index < positions.getCount()));
        triangles += indices.getCount() / 3;
        if (node.getName() === 'leaves') {
          const centres = primitive.getAttribute('_LEAFCENTRE');
          assert.ok(centres, 'compression must retain the custom leaf-centre attribute');
          assert.equal(centres.getCount(), positions.getCount());
          assert.ok([...centres.getArray()].every(Number.isFinite));
        }
      }
      triangleCounts.push(triangles);
    }
    assert.ok(triangleCounts[1] < triangleCounts[0] * .4, 'distant trees must substantially reduce geometry');
  });
}
