import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// A small moulded bath toy, sharing the boats' material and ripple renderer.
export function rubberDuck() {
  type Point = [number, number, number];
  const pieces: THREE.BufferGeometry[] = [];
  const paint = (source: THREE.BufferGeometry, tint: string) => {
    const geometry = source.toNonIndexed();
    source.dispose();
    geometry.deleteAttribute('uv');
    const color = new THREE.Color(tint);
    const colors = new Float32Array(geometry.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) color.toArray(colors, i);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    pieces.push(geometry);
  };
  const oval = (size: Point, at: Point, tint: string, segments = 16) =>
    paint(new THREE.SphereGeometry(1, segments, 10).scale(...size).translate(...at), tint);

  oval([.37, .30, .49], [0, .23, .05], '#ffd332');
  oval([.25, .26, .25], [0, .60, -.26], '#ffdd3d');
  oval([.20, .065, .19], [0, .55, -.51], '#f48b23');
  for (const side of [-1, 1]) {
    oval([.075, .16, .29], [side * .325, .29, .10], '#efbc24');
    oval([.028, .034, .027], [side * .194, .67, -.405], '#252a24', 10);
    oval([.009, .010, .009], [side * .205, .682, -.422], '#fff9e8', 8);
  }
  paint(new THREE.ConeGeometry(.16, .30, 12).rotateX(.65).translate(0, .40, .43), '#ffd332');

  const geometry = mergeGeometries(pieces);
  pieces.forEach(piece => piece.dispose());
  // The bill's subtle seam uses the same line material as the boats' creases.
  const creases = new THREE.BufferGeometry();
  creases.setAttribute('position', new THREE.Float32BufferAttribute([
    -.14, .55, -.638, 0, .55, -.699,
    0, .55, -.699, .14, .55, -.638,
  ], 3));
  // Keep the bath toy noticeably smaller than the boats, including its bill.
  geometry.scale(.5, .5, .5);
  creases.scale(.5, .5, .5);
  return { geometry, creases };
}
