import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { foldedPaper } from '../src/components/garden/paperBoatGeometry.ts';

test('both halves of the centre fold intercept rays at the paper surface', () => {
  const { geometry, creases } = foldedPaper();
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometry, material);
  try {
    for (const side of [-1, 1]) {
      for (const end of [-1, 1]) {
        const a = new THREE.Vector3(0, .15, end * .57);
        const b = new THREE.Vector3(side * .09, .07, 0);
        const c = new THREE.Vector3(side * .018, .57, 0);
        const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
        const centre = a.clone().add(b).add(c).divideScalar(3);
        for (const facing of [-1, 1]) {
          const direction = normal.clone().multiplyScalar(facing);
          const ray = new THREE.Raycaster(centre.clone().addScaledVector(direction, .01), direction.negate(), 0, .02);
          const hit = ray.intersectObject(mesh)[0];
          assert.ok(hit && Math.abs(hit.distance - .01) < 1e-6,
            `hole in centre panel: side=${side}, end=${end}, facing=${facing}`);
        }
      }
    }
  } finally {
    geometry.dispose(); creases.dispose(); material.dispose();
  }
});

test('folded paper has no open seams or overlapping internal panels', () => {
  const { geometry, creases } = foldedPaper();
  try {
    const positions = geometry.getAttribute('position');
    const edges = new Map();
    const point = (i) => [positions.getX(i), positions.getY(i), positions.getZ(i)].join(',');
    for (let i = 0; i < positions.count; i += 3) {
      for (let j = 0; j < 3; j++) {
        const key = [point(i + j), point(i + (j + 1) % 3)].sort().join('|');
        edges.set(key, (edges.get(key) ?? 0) + 1);
      }
    }
    for (const [edge, count] of edges) assert.equal(count, 2, `open or overlapping seam: ${edge}`);
  } finally {
    geometry.dispose(); creases.dispose();
  }
});
