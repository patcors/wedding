import * as THREE from 'three';
import type { BillboardSpec } from './billboards';
import { cameraPositionAt, cameraTargetAt, spineAt } from './curves';
import { OUTER_H, OUTER_W } from './frameGeometry';

/** One composition shared by photos, camera and the two strands. */
export function billboardAnchor(spec: BillboardSpec, index = 0) {
  const point = spineAt(spec.t);
  point.x += (index % 2 === 0 ? 1 : -1) * 13;
  point.y = [5, -4, 8, -6, 4, -2][index % 6];
  point.z = -170 - index * 36;
  return point;
}

export function billboardNormal(index: number) {
  return new THREE.Vector3(index % 2 === 0 ? -0.22 : 0.22, 0, 1).normalize();
}

/** A short establishing shot, then equal reading time for each photograph. */
export function buildCameraJourney(specs: BillboardSpec[], aspect: number, fov: number) {
  const keys = [{ p: 0, position: cameraPositionAt(0), target: cameraTargetAt(0) }];
  const establishingT = 0.20;
  keys.push({ p: 0.15, position: cameraPositionAt(establishingT), target: cameraTargetAt(establishingT) });
  const halfFov = THREE.MathUtils.degToRad(fov / 2);
  // Fill the limiting viewport dimension, keeping the complete frame in view.
  const distance = Math.max((OUTER_H + 1.8) / 0.92, OUTER_W / (aspect * 0.88)) / (2 * Math.tan(halfFov));
  specs.forEach((spec, i) => {
    const anchor = billboardAnchor(spec, i);
    const target = anchor.clone().add(new THREE.Vector3(0, -6.5, 0));
    const normal = billboardNormal(i);
    const right = new THREE.Vector3(normal.z, 0, -normal.x);
    const p = 0.28 + i / Math.max(1, specs.length - 1) * 0.59;
    // Small dolly across each image; generous arcs between alternating sides.
    for (const offset of [-0.018, 0.018]) {
      keys.push({ p: p + offset,
        position: target.clone().addScaledVector(normal, distance * (offset < 0 ? 1.08 : 1)).addScaledVector(right, (i % 2 === 0 ? 1 : -1) * (offset < 0 ? -0.7 : 0.7))
          .add(new THREE.Vector3(0, (i % 2 === 0 ? 1 : -1) * (offset < 0 ? 0.8 : -0.4), 0)),
        target: target.clone().add(new THREE.Vector3(0, -0.65, 0)),
      });
    }
  });
  keys.push({ p: 1, position: cameraPositionAt(1), target: cameraTargetAt(1) });
  return (progress: number, position: THREE.Vector3, target: THREE.Vector3) => {
    const end = keys.findIndex((key) => key.p >= progress);
    const b = keys[end < 0 ? keys.length - 1 : Math.max(1, end)];
    const a = keys[Math.max(0, (end < 0 ? keys.length - 1 : Math.max(1, end)) - 1)];
    const t = THREE.MathUtils.clamp((progress - a.p) / (b.p - a.p), 0, 1);
    const eased = t * t * (3 - 2 * t);
    position.lerpVectors(a.position, b.position, eased);
    target.lerpVectors(a.target, b.target, eased);
    // Pull out between photos so a lateral move reads as travel through space.
    if (b.p - a.p > 0.05) {
      const arc = Math.sin(Math.PI * t) ** 2;
      position.z += arc * 9;
      position.y += arc * (b.target.y >= a.target.y ? 4 : -4);
    }
  };
}
