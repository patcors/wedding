import * as THREE from 'three';

export function foldedPaper() {
  const positions: number[] = [], colors: number[] = [];
  type Point = [number, number, number];
  const bow: Point = [0, .23, -.82], stern: Point = [0, .23, .82];
  const left: Point = [-.43, .19, 0], right: Point = [.43, .19, 0];
  const keel: Point = [0, -.035, 0];
  const innerLeft: Point = [-.09, .07, 0], innerRight: Point = [.09, .07, 0];
  const peakLeft: Point = [-.018, .57, 0], peakRight: Point = [.018, .57, 0];
  const frontFold: Point = [0, .15, -.57], backFold: Point = [0, .15, .57];
  const triangle = (a: Point, b: Point, c: Point, tint: string) => {
    const color = new THREE.Color(tint);
    positions.push(...a, ...b, ...c);
    for (let i = 0; i < 3; i++) colors.push(color.r, color.g, color.b);
  };
  // Four folded hull panels, an open trough, and the upright centre fold.
  // Separate triangle normals preserve the crisp creases of folded paper.
  triangle(bow, keel, left, '#e7d6b6');
  triangle(left, keel, stern, '#f4e8ce');
  triangle(bow, right, keel, '#fff4df');
  triangle(stern, keel, right, '#eadcc0');
  triangle(bow, left, innerLeft, '#fcf1db');
  triangle(left, stern, innerLeft, '#e3cfaa');
  triangle(bow, innerRight, right, '#e8d8b8');
  triangle(stern, right, innerRight, '#fff6e5');
  // Join the trough to the centre fold at both ends, without open seams.
  triangle(bow, innerLeft, frontFold, '#fcf1db');
  triangle(bow, frontFold, innerRight, '#e8d8b8');
  triangle(stern, backFold, innerLeft, '#e3cfaa');
  triangle(stern, innerRight, backFold, '#fff6e5');
  // Four outer panels and two narrow ridge caps form the upright fold.
  // A triangle spanning frontFold/peak/backFold would cut through its interior.
  triangle(frontFold, innerLeft, peakLeft, '#f0e0bf');
  triangle(backFold, peakLeft, innerLeft, '#fff9ea');
  triangle(backFold, peakRight, innerRight, '#f7eacd');
  triangle(frontFold, innerRight, peakRight, '#dfc9a2');
  triangle(frontFold, peakRight, peakLeft, '#fff9ea');
  triangle(backFold, peakLeft, peakRight, '#fff9ea');
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const creases = new THREE.BufferGeometry();
  creases.setAttribute('position', new THREE.Float32BufferAttribute([
    ...bow, ...left, ...left, ...stern, ...stern, ...right, ...right, ...bow,
    ...frontFold, ...peakLeft, ...peakLeft, ...backFold,
  ], 3));
  return { geometry, creases };
}
