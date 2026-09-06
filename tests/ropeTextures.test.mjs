import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { configureRopeTextures } from '../src/components/story/ropeTextures.ts';

test('rope maps uploaded before configuration are refreshed with repeating samplers', () => {
  // useTexture preloads textures into WebGL before the Rope effect configures them.
  const maps = Array.from({ length: 4 }, () => new THREE.Texture());
  maps.forEach((map) => { map.needsUpdate = true; });
  const uploadedVersions = maps.map((map) => map.version);
  configureRopeTextures(maps, maps[0], 'laid', 1, 8);
  maps.forEach((map, i) => {
    assert.equal(map.wrapS, THREE.RepeatWrapping);
    assert.equal(map.wrapT, THREE.RepeatWrapping);
    assert.ok(map.version > uploadedVersions[i], `map ${i}: GPU would retain ClampToEdgeWrapping and stretch the first tile's edge`);
    assert.deepEqual(map.repeat.toArray(), [1, 1]);
  });
  assert.equal(maps[0].colorSpace, THREE.SRGBColorSpace);
  assert.equal(maps[1].colorSpace, THREE.NoColorSpace);
});
