import assert from 'node:assert/strict';
import test from 'node:test';
import { plantGeometry, plantSites } from '../src/components/garden/gardenPlantGeometry.ts';
import { bankEdge, groundHeight, riverCenter } from '../src/components/garden/gardenGeometry.ts';

test('land plants stay on land while wetland plants follow the shoreline on both compositions', () => {
  for (const [width, mobile] of [[1, false], [.45, true]]) {
    for (const kind of ['grass', 'clover', 'fern', 'meadow', 'reed', 'cattail']) {
      const sites = plantSites(kind, width, mobile);
      assert.deepEqual(sites, plantSites(kind, width, mobile), 'switching should preserve planting');
      const geometry = plantGeometry(kind);
      geometry.computeBoundingBox();
      const box = geometry.boundingBox;
      const radius = Math.hypot(Math.max(Math.abs(box.min.x), Math.abs(box.max.x)), Math.max(Math.abs(box.min.z), Math.abs(box.max.z)));
      for (const site of sites) {
        if (kind === 'cattail' || kind === 'reed') {
          const shoreDistance = bankEdge(site.z, width) - Math.abs(site.x - riverCenter(site.z, width));
          const min = kind === 'cattail' ? .39 : -.78;
          const max = kind === 'cattail' ? .81 : 1.06;
          assert.ok(shoreDistance >= min && shoreDistance <= max, `${kind} stays in the shallow margin`);
          if (shoreDistance > 0) assert.ok(site.y < 0, `${kind} roots are submerged`);
          else assert.equal(site.y, groundHeight(site.x, site.z, width) - .025);
          assert.ok(site.y + box.max.y * site.scale > (kind === 'cattail' ? .8 : .25), `${kind} remains above water`);
          continue;
        }
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

test('every reed patch overlaps the shoreline along its whole length', () => {
  for (const [width, mobile] of [[1, false], [.45, true]]) {
    const sites = plantSites('reed', width, mobile);
    const patchSize = sites.length / 6;
    for (let patch = 0; patch < 6; patch++) {
      const group = sites.slice(patch * patchSize, (patch + 1) * patchSize).sort((a, b) => a.z - b.z);
      for (let band = 0; band < 4; band++) {
        const strip = group.slice(band * patchSize / 4, (band + 1) * patchSize / 4);
        const offsets = strip.map(site => Math.abs(site.x - riverCenter(site.z, width)) - bankEdge(site.z, width));
        assert.ok(offsets.some(offset => offset < -.5), 'reeds surround the cattails in water');
        assert.ok(offsets.some(offset => Math.abs(offset) < .2), 'reeds fill the shoreline');
        assert.ok(offsets.some(offset => offset > .3), 'reeds connect onto the bank');
        assert.ok(offsets.every(offset => offset < .78), 'bank overlap stays limited');
      }
    }
  }
});

test('instanced plant geometry remains finite and within its mobile triangle budget', () => {
  let mobileTriangles = 0;
  for (const kind of ['grass', 'clover', 'fern', 'meadow', 'reed', 'cattail']) {
    const geometry = plantGeometry(kind);
    for (const attribute of Object.values(geometry.attributes)) {
      assert.ok([...attribute.array].every(Number.isFinite), `${kind}: invalid attribute`);
    }
    for (const index of geometry.index.array) assert.ok(index < geometry.attributes.position.count);
    mobileTriangles += geometry.index.count / 3 * plantSites(kind, .45, true).length;
    geometry.dispose();
  }
  assert.ok(mobileTriangles < 400_000, `mobile plants: ${mobileTriangles} triangles per pass`);
});
