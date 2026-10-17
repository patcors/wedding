// A π for the university years, as a garden sculpture: three tapering strokes
// of cast bronze, like a pen's, weathered to a green patina where the rain
// sits, on a squat stone plinth. The top bar sweeps up to the right from a
// curl at its left end; the left leg falls straight with a slight lean; the
// right leg curves down and flicks out at its foot. One mesh with vertex
// colours, about 1,100 triangles. It faces +z; the plinth's base is at y 0.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

type Point = [number, number, number];
const BRONZE = '#5c3d24', BRONZE_LIGHT = '#a7783f', PATINA = '#6fa08f', STONE = '#cfc8b6', STONE_DARK = '#9a9282';
// The plinth, and the glyph's strokes above it: each a path and its radius
// at the start and end. The glyph is about 1.6 tall and 1.4 wide.
export const PI_PLINTH = { width: 1.45, height: .55, depth: .55 };
const BASE = PI_PLINTH.height;
const STROKES: { path: Point[]; from: number; to: number }[] = [
  // The bar: a curl at the left end, then a long rising sweep that tapers to a point.
  { path: [[-.5, BASE + 1.3, 0], [-.66, BASE + 1.36, 0], [-.62, BASE + 1.5, 0], [-.42, BASE + 1.5, 0], [0, BASE + 1.45, 0], [.42, BASE + 1.48, 0], [.7, BASE + 1.6, 0]], from: .035, to: .035 },
  // The left leg falls from under the bar, bowing out a little to the left.
  { path: [[-.2, BASE + 1.48, 0], [-.24, BASE + 1.0, 0], [-.33, BASE + .45, 0], [-.42, BASE - .02, 0]], from: .1, to: .045 },
  // The right leg comes down straighter and flicks out to the right at its foot.
  { path: [[.3, BASE + 1.48, 0], [.29, BASE + 1.0, 0], [.32, BASE + .4, 0], [.42, BASE + .03, 0], [.56, BASE + .07, 0], [.66, BASE + .2, 0]], from: .095, to: .03 },
];
// The bar's middle is its thickest part, as a brush stroke's would be.
const barRadius = (u: number) => .035 + .06 * Math.sin(Math.PI * Math.min(1, u * 1.15)) ** .8;

function stroke({ path, from, to }: typeof STROKES[number], bar: boolean) {
  const curve = new THREE.CatmullRomCurve3(path.map(p => new THREE.Vector3(...p)), false, 'centripetal');
  const segments = bar ? 24 : 14, radial = 8;
  const tube = new THREE.TubeGeometry(curve, segments, 1, radial, false);
  const position = tube.attributes.position;
  const centre = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    const u = i / segments, radius = bar ? barRadius(u) : from + (to - from) * u;
    curve.getPointAt(u, centre);
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      v.fromBufferAttribute(position, k).sub(centre).normalize();
      // A little flatter front to back, like a cast letter.
      position.setXYZ(k, centre.x + v.x * radius, centre.y + v.y * radius, centre.z + v.z * radius * .7);
    }
  }
  tube.deleteAttribute('uv');
  tube.computeVertexNormals();
  return tube;
}

export function piSculptureGeometry() {
  const pieces: THREE.BufferGeometry[] = STROKES.map((s, i) => stroke(s, i === 0));
  // The tube's open ends: small domes where a stroke stops in the air.
  for (const [s, end] of [[STROKES[2], 1], [STROKES[0], 0], [STROKES[0], 1]] as const) {
    const p = s.path[end ? s.path.length - 1 : 0], r = end ? s.to : s.from;
    pieces.push(new THREE.SphereGeometry(r, 8, 6).scale(1, 1, .7).translate(...p).deleteAttribute('uv'));
  }
  // Verdigris over most of it, thickest where it faces the sky; the bronze
// shows warm on its front and dark underneath.
  const bronze = new THREE.Color(BRONZE), light = new THREE.Color(BRONZE_LIGHT), patina = new THREE.Color(PATINA), c = new THREE.Color();
  const glyph = mergeGeometries(pieces.map(piece => piece.toNonIndexed()));
  pieces.forEach(piece => piece.dispose());
  const n = glyph.attributes.normal, gp = glyph.attributes.position, colours: number[] = [];
  for (let i = 0; i < gp.count; i++) {
    const up = n.getY(i), facing = Math.abs(n.getZ(i));
    c.copy(bronze).lerp(light, .6 * facing).lerp(patina, .2 + .65 * THREE.MathUtils.smoothstep(up, .1, .95));
    colours.push(c.r, c.g, c.b);
  }
  glyph.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));

  // The plinth: a stone block with a slightly narrower cap, darker at its foot.
  const { width, height, depth } = PI_PLINTH;
  const block = new THREE.BoxGeometry(width, height * .8, depth).translate(0, height * .4 - .1, 0).toNonIndexed();
  const cap = new THREE.BoxGeometry(width * .92, height * .25, depth * .88).translate(0, height * .875 - .02, 0).toNonIndexed();
  const stone = new THREE.Color(STONE), dark = new THREE.Color(STONE_DARK);
  for (const box of [block, cap]) {
    box.deleteAttribute('uv');
    const bp = box.attributes.position, tint: number[] = [];
    for (let i = 0; i < bp.count; i++) {
      c.copy(dark).lerp(stone, THREE.MathUtils.clamp((bp.getY(i) + .1) / (height + .1), 0, 1));
      tint.push(c.r, c.g, c.b);
    }
    box.setAttribute('color', new THREE.Float32BufferAttribute(tint, 3));
  }
  const geometry = mergeGeometries([glyph, block, cap]);
  [glyph, block, cap].forEach(g => g.dispose());
  return geometry;
}
