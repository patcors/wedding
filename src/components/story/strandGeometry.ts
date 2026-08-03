import * as THREE from 'three';

/**
 * Both strands are displaced in the vertex shader (see strandMaterial.ts).
 * To wave a swept solid without deforming its cross-section, the shader needs
 * to know, per vertex:
 *
 *   aCenter   - the point on the curve this vertex belongs to
 *   aOffset   - this vertex's rigid offset from that centre
 *   aTangent  - curve direction there (used to sample the wave one step along)
 *   aBinormal - the across direction (used to rebuild normals)
 *   aU, aV    - parametric coords, baked rather than reusing `uv` because
 *               three.js only declares `attribute vec2 uv` when the material
 *               actually has a texture bound.
 *
 * Displacing along the vertex normal instead would inflate and pinch the tube
 * rather than wave it.
 */

function addStrandAttributes(
  geo: THREE.BufferGeometry,
  centers: number[],
  offsets: number[],
  tangents: number[],
  binormals: number[],
  us: number[],
  vs: number[],
) {
  geo.setAttribute('aCenter', new THREE.Float32BufferAttribute(centers, 3));
  geo.setAttribute('aOffset', new THREE.Float32BufferAttribute(offsets, 3));
  geo.setAttribute('aTangent', new THREE.Float32BufferAttribute(tangents, 3));
  geo.setAttribute('aBinormal', new THREE.Float32BufferAttribute(binormals, 3));
  geo.setAttribute('aU', new THREE.Float32BufferAttribute(us, 1));
  geo.setAttribute('aV', new THREE.Float32BufferAttribute(vs, 1));
}

/**
 * Rope: a tube. Generous along its length (the wave needs the segments) but
 * cheap around its circumference — the fibre detail comes from a normal map,
 * not geometry. 1400 x 8 is only ~11k verts.
 */
export function buildRopeGeometry(
  curve: THREE.Curve<THREE.Vector3>,
  radius = 0.62,
  tubularSegments = 1400,
  radialSegments = 8,
) {
  const geo = new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const count = pos.count;

  const centers: number[] = [];
  const offsets: number[] = [];
  const tangents: number[] = [];
  const binormals: number[] = [];
  const us: number[] = [];
  const vs: number[] = [];

  const up = new THREE.Vector3(0, 1, 0);
  const c = new THREE.Vector3();
  const tan = new THREE.Vector3();
  const bin = new THREE.Vector3();

  // TubeGeometry lays u along the length and v around the circumference.
  const uvAttr = geo.attributes.uv as THREE.BufferAttribute;

  for (let i = 0; i < count; i++) {
    const u = THREE.MathUtils.clamp(uvAttr.getX(i), 0, 1);
    const v = uvAttr.getY(i);

    curve.getPointAt(u, c);
    curve.getTangentAt(u, tan).normalize();
    bin.crossVectors(tan, up);
    if (bin.lengthSq() < 1e-8) bin.set(1, 0, 0);
    bin.normalize();

    centers.push(c.x, c.y, c.z);
    // Computed as a difference, so any mismatch between getPointAt and the
    // centre TubeGeometry actually used is absorbed exactly.
    offsets.push(pos.getX(i) - c.x, pos.getY(i) - c.y, pos.getZ(i) - c.z);
    tangents.push(tan.x, tan.y, tan.z);
    binormals.push(bin.x, bin.y, bin.z);
    us.push(u);
    vs.push(v);
  }

  addStrandAttributes(geo, centers, offsets, tangents, binormals, us, vs);
  return geo;
}

/**
 * Silk: a ribbon swept along the curve.
 *
 * Uses a fixed world-up reference to derive the across direction rather than
 * Frenet frames, which twist unpredictably through inflection points and would
 * make the ribbon barrel-roll.
 */
export function buildSilkGeometry(
  curve: THREE.Curve<THREE.Vector3>,
  width = 2.8,
  lengthSegments = 1400,
  widthSegments = 6,
) {
  const positions: number[] = [];
  const centers: number[] = [];
  const offsets: number[] = [];
  const tangents: number[] = [];
  const binormals: number[] = [];
  const us: number[] = [];
  const vs: number[] = [];
  const indices: number[] = [];

  const up = new THREE.Vector3(0, 1, 0);
  const c = new THREE.Vector3();
  const tan = new THREE.Vector3();
  const bin = new THREE.Vector3();
  const off = new THREE.Vector3();

  for (let i = 0; i <= lengthSegments; i++) {
    const u = i / lengthSegments;
    curve.getPointAt(u, c);
    curve.getTangentAt(u, tan).normalize();
    bin.crossVectors(tan, up);
    if (bin.lengthSq() < 1e-8) bin.set(1, 0, 0);
    bin.normalize();

    for (let j = 0; j <= widthSegments; j++) {
      const v = j / widthSegments;
      off.copy(bin).multiplyScalar((v - 0.5) * width);

      positions.push(c.x + off.x, c.y + off.y, c.z + off.z);
      centers.push(c.x, c.y, c.z);
      offsets.push(off.x, off.y, off.z);
      tangents.push(tan.x, tan.y, tan.z);
      binormals.push(bin.x, bin.y, bin.z);
      us.push(u);
      vs.push(v);
    }
  }

  const stride = widthSegments + 1;
  for (let i = 0; i < lengthSegments; i++) {
    for (let j = 0; j < widthSegments; j++) {
      const a = i * stride + j;
      const b = a + stride;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  const uvs: number[] = [];
  for (let i = 0; i < us.length; i++) uvs.push(us[i]!, vs[i]!);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  // Normals are recomputed in the shader; this is just a sane starting basis.
  geo.computeVertexNormals();
  addStrandAttributes(geo, centers, offsets, tangents, binormals, us, vs);
  return geo;
}
