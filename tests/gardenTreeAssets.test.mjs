import assert from 'node:assert/strict';
import test from 'node:test';
import { MeshoptDecoder } from 'meshoptimizer';
import { treeIO } from './treeModels.mjs';

await MeshoptDecoder.ready;
// The models as the scene loads them (tests/treeModels.mjs).
const io = treeIO;

for (const variant of [1, 2]) {
  test(`ash ${variant}: compressed assets retain usable geometry and leaf wind data`, async () => {
    const triangleCounts = [];
    for (const suffix of ['', '-distant']) {
      const document = await io.read(`public/models/garden/ash-${variant}${suffix}.glb`);
      const nodes = document.getRoot().listNodes().filter(node => node.getMesh());
      assert.deepEqual(nodes.map(node => node.getName()).sort(), ['branches', 'leaves']);
      let triangles = 0;
      for (const node of nodes) {
        // Runtime instancing uses geometry directly, so transforms must be baked
        // (gardenModels.ts does so as they load; treeIO here, the same way).
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

// Triangles in each named mesh of a generated tree.
async function meshTriangles(file) {
  const document = await io.read(`public/models/garden/${file}.glb`);
  return Object.fromEntries(document.getRoot().listNodes().filter(node => node.getMesh()).map(node =>
    [node.getName(), node.getMesh().listPrimitives()[0].getIndices().getCount() / 3]));
}

for (const variant of [1, 2]) {
  test(`ash ${variant}: far branches keep a third or less of the distant tree's faces`, async () => {
    const [distant, far] = [await meshTriangles(`ash-${variant}-distant`), await meshTriangles(`ash-${variant}-far`)];
    assert.deepEqual(Object.keys(far), ['branches'], 'far trees borrow the distant leaves');
    assert.ok(far.branches > 0 && far.branches < distant.branches * .35);
  });
}

test('the old tree and the shrub are whole trees, the old tree within a single-instance budget', async () => {
  for (const file of ['old-tree', 'bush']) {
    const triangles = await meshTriangles(file);
    assert.deepEqual(Object.keys(triangles).sort(), ['branches', 'leaves']);
    assert.ok(triangles.branches + triangles.leaves < (file === 'bush' ? 10_000 : 35_000), `${file}: ${JSON.stringify(triangles)}`);
  }
});

test('the tree models are stored quantized, each mesh with a plain scale and offset back to world units', async () => {
  for (const file of ['ash-1', 'ash-2', 'ash-1-distant', 'ash-2-distant', 'old-tree', 'bush', 'ash-1-far', 'ash-2-far']) {
    const document = await treeIO.raw.read(`public/models/garden/${file}.glb`);
    assert.ok(document.getRoot().listExtensionsUsed().some(extension => extension.extensionName === 'KHR_mesh_quantization'), file);
    for (const node of document.getRoot().listNodes().filter(node => node.getMesh())) {
      const [x, y, z] = node.getScale();
      assert.ok(x === y && y === z && x > 0, `${file} ${node.getName()}: a uniform scale, so normals need no change`);
      assert.deepEqual(node.getRotation(), [0, 0, 0, 1]);
      assert.equal(node.getMesh().listPrimitives()[0].getAttribute('POSITION').getComponentType(), 5122, `${file}: 16-bit positions`);
    }
  }
});
