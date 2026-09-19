import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function woodenSailboat() {
  type Point = [number, number, number];
  const positions: number[] = [], colours: number[] = [], lines: number[] = [];
  const triangle = (a: Point, b: Point, c: Point, tint: string) => {
    positions.push(...a, ...b, ...c);
    const colour = new THREE.Color(tint);
    for (let i = 0; i < 3; i++) colours.push(colour.r, colour.g, colour.b);
  };
  const line = (a: Point, b: Point) => lines.push(...a, ...b);
  const sections = [[-.78, .015], [-.55, .23], [-.12, .36], [.30, .33], [.66, .22]];
  const rings = sections.map(([z, width]): Point[] => [
    [-width, .15, z], [-width * .65, -.015, z], [0, -.07, z],
    [width * .65, -.015, z], [width, .15, z],
  ]);
  // Pale wooden dinghy with an open, recessed interior and a raised rim.
  for (let i = 1; i < rings.length; i++) {
    for (let j = 0; j < 4; j++) {
      const next = j + 1;
      const tint = j === 0 || j === 3 ? '#d3ad76' : '#ac824f';
      triangle(rings[i - 1][j], rings[i][j], rings[i][next], tint);
      triangle(rings[i - 1][j], rings[i][next], rings[i - 1][next], tint);
    }
    const inside = (section: number): Point[] => {
      const [z, width] = sections[section];
      return [rings[section][0], [-width * .88, .15, z], [-width * .70, .065, z],
        [width * .70, .065, z], [width * .88, .15, z], rings[section][4]];
    };
    const previous = inside(i - 1), current = inside(i);
    for (let j = 0; j < current.length - 1; j++) {
      const tint = j === 0 || j === 4 ? '#ebcc96' : j === 2 ? '#c99f65' : '#bd9058';
      triangle(previous[j], current[j], current[j + 1], tint);
      triangle(previous[j], current[j + 1], previous[j + 1], tint);
    }
    line(rings[i - 1][0], rings[i][0]);
    line(rings[i - 1][4], rings[i][4]);
    // Fine plank seams across the recessed floor.
    line([-sections[i][1] * .70, .067, sections[i][0]], [sections[i][1] * .70, .067, sections[i][0]]);
  }
  for (const ring of [rings[0], rings[rings.length - 1]]) {
    for (let i = 1; i < ring.length - 1; i++) triangle(ring[0], ring[i], ring[i + 1], '#d3ad76');
  }

  // One ivory mainsail on a forward mast, like the simple wooden toy boats.
  const sail = (a: Point, b: Point, c: Point, fullness: number) => {
    const vertices: number[] = [], indices: number[] = [], rows: number[][] = [];
    const segments = 12;
    for (let i = 0; i <= segments; i++) {
      rows[i] = [];
      for (let j = 0; j <= segments - i; j++) {
        const u = i / segments, v = j / segments, w = 1 - u - v;
        rows[i][j] = vertices.length / 3;
        vertices.push(
          a[0] * u + b[0] * w + c[0] * v + fullness * 27 * u * v * w,
          a[1] * u + b[1] * w + c[1] * v,
          a[2] * u + b[2] * w + c[2] * v,
        );
      }
    }
    for (let i = 0; i < segments; i++) {
      for (let j = 0; j < segments - i; j++) {
        indices.push(rows[i][j], rows[i + 1][j], rows[i][j + 1]);
        if (j < segments - i - 1) indices.push(rows[i + 1][j], rows[i + 1][j + 1], rows[i][j + 1]);
      }
    }
    const cloth = new THREE.BufferGeometry();
    cloth.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    cloth.setIndex(indices);
    // Shared vertices smooth the lighting across triangles; the cloth has one
    // ivory colour, with its gentle billow providing the only tonal variation.
    cloth.computeVertexNormals();
    const tint = new THREE.Color('#fff6df');
    const values = new Float32Array(vertices.length);
    for (let i = 0; i < values.length; i += 3) tint.toArray(values, i);
    cloth.setAttribute('color', new THREE.BufferAttribute(values, 3));
    line(a, b); line(b, c); line(c, a);
    const result = cloth.toNonIndexed();
    cloth.dispose();
    return result;
  };
  const cloth = sail([0, 1.16, -.39], [0, .26, -.39], [0, .26, .56], .06);
  line([0, .26, .56], [0, .15, .65]);

  const panels = new THREE.BufferGeometry();
  panels.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  panels.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  panels.computeVertexNormals();
  const spar = (a: Point, b: Point, radius: number) => {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    const direction = end.clone().sub(start);
    const cylinder = new THREE.CylinderGeometry(radius, radius, direction.length(), 8).toNonIndexed();
    cylinder.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()));
    cylinder.translate(...start.add(end).multiplyScalar(.5).toArray());
    cylinder.deleteAttribute('uv');
    const colour = new THREE.Color('#d8b47d');
    const values = new Float32Array(cylinder.attributes.position.count * 3);
    for (let i = 0; i < values.length; i += 3) colour.toArray(values, i);
    cylinder.setAttribute('color', new THREE.BufferAttribute(values, 3));
    return cylinder;
  };
  const mast = spar([0, .065, -.42], [0, 1.23, -.42], .019);
  const geometry = mergeGeometries([panels, cloth, mast]);
  panels.dispose(); cloth.dispose(); mast.dispose();
  const creases = new THREE.BufferGeometry();
  creases.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
  geometry.scale(.8, .8, .8);
  creases.scale(.8, .8, .8);
  return { geometry, creases };
}
