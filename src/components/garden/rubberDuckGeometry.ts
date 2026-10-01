import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// A bath duck facing -z like the boats' bows: round body with an upturned
// tail, a big head, an orange beak, and black eyes with a glint.
export function rubberDuck() {
  type Point = [number, number, number];
  const pieces: THREE.BufferGeometry[] = [];
  const shadow = new THREE.Color('#e49c00'), light = new THREE.Color('#ffd21f'), colour = new THREE.Color();
  // Yellow parts darken towards the water, the way the plastic catches the sky.
  const paint = (geometry: THREE.BufferGeometry, tint: string | null) => {
    const result = geometry.index ? geometry.toNonIndexed() : geometry;
    if (result !== geometry) geometry.dispose();
    result.deleteAttribute('uv');
    const position = result.attributes.position;
    const colours = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i++) {
      if (tint) colour.set(tint);
      else colour.copy(shadow).lerp(light, THREE.MathUtils.clamp((position.getY(i) + .05) / .5, 0, 1));
      colour.toArray(colours, i * 3);
    }
    result.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    pieces.push(result);
  };
  const blob = (radius: Point, at: Point, tint: string | null, tilt: Point = [0, 0, 0], detail = 24) =>
    paint(new THREE.SphereGeometry(1, detail, Math.round(detail * .75)).scale(...radius)
      .rotateX(tilt[0]).rotateY(tilt[1]).rotateZ(tilt[2]).translate(...at), tint);

  blob([.26, .2, .34], [0, .09, .02], null);
  // The tail lifts out of the back of the body.
  blob([.16, .13, .18], [0, .22, .22], null, [-.7, 0, 0]);
  // A big head set straight into the body, with no neck.
  blob([.18, .17, .175], [0, .37, -.16], null);
  for (const side of [-1, 1]) {
    blob([.03, .08, .15], [side * .225, .17, .04], null, [-.25, 0, side * -.15], 16);
    blob([.028, .03, .02], [side * .112, .43, -.285], '#1d1d1b', [0, side * -.55, 0], 12);
    blob([.009, .009, .006], [side * .119, .442, -.302], '#fbfbf5', [0, side * -.55, 0], 8);
  }
  // Upper and lower beak, slightly parted.
  blob([.095, .034, .11], [0, .35, -.33], '#ec5f24', [.15, 0, 0], 16);
  blob([.08, .022, .09], [0, .31, -.32], '#d24c1a', [.05, 0, 0], 16);

  const geometry = mergeGeometries(pieces);
  pieces.forEach(piece => piece.dispose());
  // Smooth plastic, so there are no creases to ink.
  const creases = new THREE.BufferGeometry();
  creases.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
  return { geometry, creases };
}
