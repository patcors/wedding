// A graduate's mortarboard in one mesh with vertex colours: a black square
// board on a skull cap, with a button in the middle and a tassel on a cord
// hanging over one edge. The tassel is white so an instance colour tints it
// (black stays black). Sits on y 0, the board about .36 across. About 100
// triangles.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

type Point = [number, number, number];
const BLACK = '#232123', EDGE = '#3a373a', TASSEL = '#ffffff';
export const MORTARBOARD = { board: .36, skull: .1 } as const;

export function mortarboardGeometry() {
  const pieces: THREE.BufferGeometry[] = [];
  const c = new THREE.Color();
  const add = (geometry: THREE.BufferGeometry, colour: string) => {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    if (g !== geometry) geometry.dispose();
    g.deleteAttribute('uv');
    const colours: number[] = [];
    c.set(colour);
    for (let i = 0; i < g.attributes.position.count; i++) c.toArray(colours, i * 3);
    g.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
    pieces.push(g);
  };
  const { board, skull } = MORTARBOARD;
  // The skull cap, a little wider at the brim, and the board on top.
  add(new THREE.CylinderGeometry(.12, .13, skull, 10, 1).translate(0, skull / 2, 0), EDGE);
  add(new THREE.BoxGeometry(board, .022, board).translate(0, skull + .011, 0), BLACK);
  add(new THREE.CylinderGeometry(.018, .018, .012, 6).translate(0, skull + .028, 0), BLACK);
  // The cord from the button out to a corner, then hanging over its edge.
  const corner: Point = [board * .42, skull + .024, board * .42];
  const cord = new THREE.CatmullRomCurve3([[0, skull + .03, 0], [board * .3, skull + .03, board * .3], corner, [board * .45, skull - .05, board * .45]]
    .map(p => new THREE.Vector3(...(p as Point))));
  add(new THREE.TubeGeometry(cord, 6, .007, 3, false), TASSEL);
  // The tassel: a short fringe, wider at the foot.
  add(new THREE.CylinderGeometry(.012, .03, .08, 6).translate(board * .45, skull - .09, board * .45), TASSEL);
  const geometry = mergeGeometries(pieces);
  pieces.forEach(piece => piece.dispose());
  return geometry;
}
