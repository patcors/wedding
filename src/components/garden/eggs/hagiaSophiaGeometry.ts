// July 2026's Hagia Sophia, a model for the far distance (see balloonCourse.ts):
// a low stone terrace, the warm terracotta-plastered body and the square
// tower over its crossing, buttressed at the corners, a drum ringed with
// dark windows under the great lead dome, a semi-dome stepping down either
// side with two little ones below each, and four slender pencil minarets with
// a balcony each and lead caps. Its long axis runs across the picture (x), so
// the domes step down left and right as on the postcards. One mesh with
// vertex colours, about 900 triangles; it faces +z on y 0, about 1.15
// wide and .93 tall to the minarets' tips.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const STONE = '#cbbda3', STONE_DARK = '#9d927e', PLASTER = '#c98b69', PLASTER_LIGHT = '#d9a27d', PLASTER_DARK = '#b07457';
const LEAD = '#8b9399', WINDOW = '#4a3b33', MINARET = '#e6d8bf', GOLD = '#c9a24a';
// Heights: the terrace's top, the body's, the crossing tower's, and the
// drum's. The terrace runs down to `sunk` below its foot, so no gap shows
// under it should the ground it stands on dip a little.
const PLINTH = .1, BODY = .35, TOWER = .48, DRUM = .53;
export const HAGIA_SOPHIA = { width: 1.15, depth: .82, height: .93, sunk: .12 } as const;

function painter() {
  const pieces: THREE.BufferGeometry[] = [];
  const c = new THREE.Color();
  // Coloured a triangle at a time, so a colour can pick out every other face.
  const add = (geometry: THREE.BufferGeometry, colour: string | ((face: number) => string)) => {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    if (g !== geometry) geometry.dispose();
    g.deleteAttribute('uv');
    const colours: number[] = [];
    for (let i = 0; i < g.attributes.position.count; i += 3) {
      c.set(typeof colour === 'string' ? colour : colour(i / 3));
      for (let k = 0; k < 3; k++) c.toArray(colours, (i + k) * 3);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
    pieces.push(g);
  };
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, colour: string) =>
    add(new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z), colour);
  const merge = () => {
    const geometry = mergeGeometries(pieces);
    pieces.forEach(piece => piece.dispose());
    geometry.computeVertexNormals();
    return geometry;
  };
  return { add, box, merge };
}

// A dome of `radius` on a rim at y, `squash` its height over its radius: a
// whole one, or half of one (a semi-dome) bulging towards `facing`, radians
// about y from +x.
const dome = (radius: number, y: number, squash: number, segments: number, rings: number, facing?: number) => {
  const half = facing !== undefined;
  // Three's sphere sweeps phi from −x round through +z; start it so a half faces `facing`.
  const g = new THREE.SphereGeometry(radius, segments, rings, half ? facing! + Math.PI / 2 : 0, half ? Math.PI : Math.PI * 2, 0, Math.PI / 2);
  return g.scale(1, squash, 1).translate(0, y, 0);
};

export function hagiaSophiaGeometry() {
  const { add, box, merge } = painter();
  const { width, depth, sunk } = HAGIA_SOPHIA;
  box(width, PLINTH - .03 + sunk, depth, 0, -sunk, 0, STONE_DARK);
  box(width - .04, .03, depth - .04, 0, PLINTH - .03, 0, STONE);
  // The body, and the square tower over the crossing that carries the dome.
  box(.8, BODY - PLINTH, .6, 0, PLINTH, 0, PLASTER);
  box(.46, TOWER - BODY, .46, 0, BODY, 0, PLASTER_LIGHT);
  // Buttresses at its corners, rising a little above it.
  for (const [x, z] of [[1, 1], [1, -1], [-1, -1], [-1, 1]]) box(.08, TOWER - BODY + .07, .1, x * .22, BODY, z * .25, PLASTER_DARK);
  // The drum, its ring of windows every other face, and the great dome with a gilt finial.
  add(new THREE.CylinderGeometry(.19, .2, DRUM - TOWER, 20, 1, true).translate(0, (TOWER + DRUM) / 2, 0), face => face % 4 < 2 ? WINDOW : PLASTER_LIGHT);
  add(dome(.2, DRUM, .62, 20, 5), LEAD);
  add(new THREE.ConeGeometry(.014, .07, 6).translate(0, DRUM + .2 * .62 + .03, 0), GOLD);
  for (const side of [-1, 1]) {
    // A semi-dome against the tower on each side, over a lower bay of the body.
    const x = side * .23, facing = side < 0 ? Math.PI : 0;
    box(.18, .07, .38, side * .32, BODY, 0, PLASTER);
    add(dome(.17, BODY + .07, .72, 10, 4, facing).translate(x, 0, 0), LEAD);
    // And two little ones below it, at the corners of the bay.
    for (const z of [-1, 1]) add(dome(.075, BODY, .8, 6, 3, facing + side * z * -.6).translate(side * .36, 0, z * .12), LEAD);
  }
  // The four minarets, out at the corners: a tapering shaft, a balcony, a
  // slimmer top and a tall pointed lead cap.
  for (const [x, z] of [[1, 1], [1, -1], [-1, -1], [-1, 1]]) {
    const mx = x * .51, mz = z * .35, shaft = .6;
    add(new THREE.CylinderGeometry(.021, .027, shaft, 8, 1, true).translate(mx, PLINTH + shaft / 2, mz), MINARET);
    add(new THREE.CylinderGeometry(.036, .03, .02, 8).translate(mx, PLINTH + shaft * .82, mz), MINARET);
    add(new THREE.CylinderGeometry(.017, .019, .1, 8, 1, true).translate(mx, PLINTH + shaft + .05, mz), MINARET);
    add(new THREE.ConeGeometry(.022, .13, 8, 1, true).translate(mx, PLINTH + shaft + .1 + .065, mz), LEAD);
  }
  return merge();
}
