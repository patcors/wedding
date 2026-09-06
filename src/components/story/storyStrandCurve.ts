import * as THREE from 'three';
import { billboardAnchor, billboardNormal } from './cameraJourney';
import type { BillboardSpec } from './billboards';
import { buildStrandCurve, strandPointAt, type Side } from './curves';
import { OUTER_H, OUTER_W } from './frameGeometry';

/** Open, descending sweeps replace the repeated coils and background detours. */
export function buildStoryStrandCurve(side: Side, specs: BillboardSpec[]) {
  if (!specs.length) return buildStrandCurve(side);
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= 32; i++) points.push(strandPointAt(0.20 * i / 32, side));

  specs.forEach((spec, index) => {
    const center = billboardAnchor(spec, index).add(new THREE.Vector3(0, -6.5, 0));
    const normal = billboardNormal(index);
    const right = new THREE.Vector3(normal.z, 0, -normal.x);
    const silk = side === 'silk';
    const edge = (index % 2 === 0 ? 1 : -1) * (silk ? -1 : 1);
    // Approach from above the outer shoulder, leaving the photograph's viewing
    // corridor clear while the camera moves in from the previous side.
    const approach = center.clone().addScaledVector(right, edge * 7)
      .add(new THREE.Vector3(0, OUTER_H / 2 + 8, 0)).addScaledVector(normal, 2);
    points.push(approach);
    points.push(center.clone().addScaledVector(right, edge * 4.5)
      .add(new THREE.Vector3(0, OUTER_H / 2 + 4.5, 0)).addScaledVector(normal, -1));
    // Each strand traces just one shoulder of the photograph. Both continue
    // forward in depth, so the connection never doubles back into another coil.
    for (let j = 0; j <= 8; j++) {
      const u = j / 8;
      const x = edge * (1.6 + Math.sin(u * Math.PI) * (OUTER_W / 2 - 0.1));
      const y = (0.5 - u) * (OUTER_H + 4.0) + (silk ? 0.4 : 0);
      const depth = -3.8 - u * 7 - (silk ? 0.8 : 0);
      points.push(center.clone().addScaledVector(right, x)
        .add(new THREE.Vector3(0, y, 0)).addScaledVector(normal, depth));
    }
  });
  // A quiet final approach to the original shared knot.
  for (let i = 0; i <= 20; i++) points.push(strandPointAt(0.97 + 0.03 * i / 20, side));
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  curve.arcLengthDivisions = 6000;
  return curve;
}
