import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { dequantizeModel } from '../src/components/garden/gardenModels.ts';
import { treeIO } from './treeModels.mjs';

// The tree models are stored quantized; gardenModels.ts turns each mesh back
// into world-unit floats with no node transform as it loads. Built here from
// the stored file's own integers and node transform, as three's loader does,
// it must give what gltf-transform's own dequantize does (tests/treeModels.mjs).
test('the stored trees come back as the same world-unit geometry', async () => {
  for (const file of ['ash-1', 'old-tree', 'ash-2-far']) {
    const raw = await treeIO.raw.read(`public/models/garden/${file}.glb`), plain = await treeIO.read(`public/models/garden/${file}.glb`);
    const scene = new THREE.Group();
    for (const node of raw.getRoot().listNodes().filter(node => node.getMesh())) {
      const primitive = node.getMesh().listPrimitives()[0], geometry = new THREE.BufferGeometry();
      for (const [semantic, name] of [['POSITION', 'position'], ['TEXCOORD_0', 'uv']]) {
        const accessor = primitive.getAttribute(semantic);
        geometry.setAttribute(name, new THREE.BufferAttribute(accessor.getArray().slice(), accessor.getElementSize(), accessor.getNormalized()));
      }
      const mesh = new THREE.Mesh(geometry);
      mesh.name = node.getName();
      mesh.position.fromArray(node.getTranslation()); mesh.quaternion.fromArray(node.getRotation()); mesh.scale.fromArray(node.getScale());
      scene.add(mesh);
    }
    dequantizeModel({ scene });
    for (const node of plain.getRoot().listNodes().filter(node => node.getMesh())) {
      const mesh = scene.getObjectByName(node.getName()), primitive = node.getMesh().listPrimitives()[0];
      assert.deepEqual([mesh.position.toArray(), mesh.scale.toArray()], [[0, 0, 0], [1, 1, 1]]);
      for (const [semantic, name] of [['POSITION', 'position'], ['TEXCOORD_0', 'uv']]) {
        const want = primitive.getAttribute(semantic).getArray(), got = mesh.geometry.getAttribute(name).array;
        assert.ok(got instanceof Float32Array, `${file} ${name} as floats`);
        assert.equal(got.length, want.length);
        let worst = 0;
        for (let i = 0; i < got.length; i++) worst = Math.max(worst, Math.abs(got[i] - want[i]));
        assert.ok(worst < 1e-5, `${file} ${node.getName()} ${name}: off by ${worst}`);
      }
    }
    // A second call leaves it be.
    const before = scene.getObjectByName('branches').geometry.getAttribute('position');
    dequantizeModel({ scene });
    assert.equal(scene.getObjectByName('branches').geometry.getAttribute('position'), before);
  }
});
