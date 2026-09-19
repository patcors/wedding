import assert from 'node:assert/strict';
import test from 'node:test';
import { plantGeometry, plantSites } from '../src/components/garden/gardenPlantGeometry.ts';
import { bankEdge, groundHeight, riverCenter } from '../src/components/garden/gardenGeometry.ts';

test('plant colonies stay grounded and out of the river on both compositions', () => {
  for (const [width, mobile] of [[1, false], [.45, true]]) {
    for (const kind of ['grass', 'clover', 'fern']) {
      const sites = plantSites(kind, width, mobile);
      assert.deepEqual(sites, plantSites(kind, width, mobile), 'switching should preserve planting');
      const geometry = plantGeometry(kind);
      geometry.computeBoundingBox();
      const box = geometry.boundingBox;
      const radius = Math.hypot(Math.max(Math.abs(box.min.x), Math.abs(box.max.x)), Math.max(Math.abs(box.min.z), Math.abs(box.max.z)));
      for (const site of sites) {
        assert.equal(site.y, groundHeight(site.x, site.z, width) - .025);
        // Check the clump footprint, including bends in the bank around its root.
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
          const x = site.x + Math.cos(angle) * radius * site.scale;
          const z = site.z + Math.sin(angle) * radius * site.scale;
          assert.ok(Math.abs(x - riverCenter(z, width)) > bankEdge(z, width), `${kind} crosses the water`);
        }
      }
      geometry.dispose();
    }
  }
});

test('instanced plant geometry remains finite and within its mobile triangle budget', () => {
  let mobileTriangles = 0;
  for (const kind of ['grass', 'clover', 'fern']) {
    const geometry = plantGeometry(kind);
    for (const attribute of Object.values(geometry.attributes)) {
      assert.ok([...attribute.array].every(Number.isFinite), `${kind}: invalid attribute`);
    }
    for (const index of geometry.index.array) assert.ok(index < geometry.attributes.position.count);
    mobileTriangles += geometry.index.count / 3 * plantSites(kind, .45, true).length;
    geometry.dispose();
  }
  assert.ok(mobileTriangles < 180_000, `mobile plants: ${mobileTriangles} triangles per pass`);
});
