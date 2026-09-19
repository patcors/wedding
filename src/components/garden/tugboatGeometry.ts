import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function toyTugboat() {
  type Point = [number, number, number];
  const pieces: THREE.BufferGeometry[] = [], lines: number[] = [];
  const paint = (geometry: THREE.BufferGeometry, tint: string) => {
    const result = geometry.index ? geometry.toNonIndexed() : geometry;
    if (result !== geometry) geometry.dispose();
    result.deleteAttribute('uv');
    const colour = new THREE.Color(tint);
    const colours = new Float32Array(result.attributes.position.count * 3);
    for (let i = 0; i < colours.length; i += 3) colour.toArray(colours, i);
    result.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    pieces.push(result);
    return result;
  };
  const box = (size: Point, at: Point, tint: string) =>
    paint(new THREE.BoxGeometry(...size).translate(...at), tint);
  const rod = (a: Point, b: Point, radius: number, tint: string) => {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    const direction = end.clone().sub(start);
    const geometry = new THREE.CylinderGeometry(radius, radius, direction.length(), 8);
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()));
    geometry.translate(...start.add(end).multiplyScalar(.5).toArray());
    return paint(geometry, tint);
  };
  const line = (a: Point, b: Point) => lines.push(...a, ...b);
  const triangle = (a: Point, b: Point, c: Point, tint: string) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c], 3));
    geometry.computeVertexNormals();
    paint(geometry, tint);
  };
  const sections = [[-.76, .015], [-.58, .24], [-.25, .34], [.20, .34], [.56, .27], [.68, .15]];
  const rings = sections.map(([z, w]): Point[] => [
    [-w, .22, z], [-w * .94, .075, z], [-w * .60, -.07, z],
    [w * .60, -.07, z], [w * .94, .075, z], [w, .22, z],
  ]);
  // Grey upper hull, red lower hull, and a warm wooden deck.
  for (let i = 1; i < rings.length; i++) {
    for (let j = 0; j < 6; j++) {
      const next = (j + 1) % 6;
      const tint = j === 5 ? '#b9955b' : j === 0 || j === 4 ? '#69776e' : '#a74736';
      triangle(rings[i - 1][j], rings[i][j], rings[i][next], tint);
      triangle(rings[i - 1][j], rings[i][next], rings[i - 1][next], tint);
    }
    for (const side of [-1, 1]) {
      const [z, w] = sections[i], [previousZ, previousW] = sections[i - 1];
      rod([side * previousW, .34, previousZ], [side * w, .34, z], .010, '#eee3c9');
      rod([side * w, .22, z], [side * w, .34, z], .009, '#eee3c9');
      line([side * previousW * .97, .15, previousZ], [side * w * .97, .15, z]);
    }
  }
  for (const ring of [rings[0], rings[rings.length - 1]]) {
    for (let i = 1; i < ring.length - 1; i++) triangle(ring[0], ring[i], ring[i + 1], '#69776e');
  }
  rod([-.15, .34, .68], [.15, .34, .68], .010, '#eee3c9');

  // Two-storey cream wheelhouse with wood roof caps and dark inset windows.
  box([.43, .23, .48], [0, .335, .02], '#eee4cf');
  box([.48, .025, .53], [0, .4625, .02], '#ccaf79');
  box([.35, .19, .36], [0, .57, .06], '#f3ead6');
  box([.43, .025, .44], [0, .6775, .06], '#b8965c');
  for (const side of [-1, 1]) {
    for (const z of [-.12, .02, .16]) box([.006, .075, .065], [side * .218, .35, z], '#333c36');
    for (const z of [-.045, .095]) box([.006, .085, .07], [side * .178, .57, z], '#333c36');
  }
  for (const z of [-.123, .243]) {
    for (const x of [-.105, 0, .105]) box([.055, .085, .006], [x, .57, z], '#333c36');
  }
  // Bow-facing porthole, funnel with black cap, and the forward timber mast.
  paint(new THREE.CylinderGeometry(.034, .034, .009, 16).rotateX(Math.PI / 2).translate(0, .35, -.225), '#39423c');
  paint(new THREE.TorusGeometry(.038, .006, 4, 16).translate(0, .35, -.232), '#b9ab87');
  rod([0, .69, .08], [0, .95, .08], .065, '#ba3c2e');
  rod([0, .95, .08], [0, 1.025, .08], .068, '#30352f');
  rod([0, .22, -.43], [0, .94, -.43], .018, '#8a6d43');
  line([0, .94, -.43], [0, .34, -.75]);
  line([0, .94, -.43], [0, .94, .08]);

  // Small exposed wheel behind the cabin, visible as the boat turns.
  rod([0, .22, .43], [0, .55, .43], .012, '#8a6d43');
  paint(new THREE.TorusGeometry(.065, .009, 4, 16).translate(0, .51, .43), '#81683f');
  for (let i = 0; i < 8; i++) {
    const angle = i / 8 * Math.PI * 2;
    rod([0, .51, .43], [Math.cos(angle) * .084, .51 + Math.sin(angle) * .084, .43], .005, '#81683f');
  }
  const geometry = mergeGeometries(pieces);
  pieces.forEach(piece => piece.dispose());
  const creases = new THREE.BufferGeometry();
  creases.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
  geometry.scale(.8, .8, .8);
  creases.scale(.8, .8, .8);
  return { geometry, creases };
}
