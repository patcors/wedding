// The circus on Amelia's bank (see circusRigs.ts): an aerial silk and a lyra.
// Each hangs from y 0, where it meets the limb, and faces +z. The silk is two long tails of purple fabric from one rigging point
// under a short rope, rewritten each frame as it sways (about 90 triangles).
// The lyra is a cream-taped hoop on a teal strop and swivel (about 420).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// A soft, rich aerial-silk purple, a deeper plum where it folds.
const FABRIC = '#8a68a6', FOLD = '#674a83', ROPE = '#4b423a';
// The silk: its rope from the limb to the rigging point, each tail's width
// where it leaves the rigging and once it has opened out, how far apart the
// two tails hang at the foot, and how many lengths each is drawn in.
export const SILK_SHAPE = { rope: .25, ropeWidth: .03, top: .035, open: .15, apart: .2, segments: 22 } as const;
const TAIL_VERTICES = (SILK_SHAPE.segments + 1) * 2;
// Two crossed strips for the rope, then the two tails.
const SILK_VERTICES = 8 + TAIL_VERTICES * 2;

const colourArray = (count: number, at: (i: number) => string) => {
  const colours = new Float32Array(count * 3), c = new THREE.Color();
  for (let i = 0; i < count; i++) c.set(at(i)).toArray(colours, i * 3);
  return colours;
};

export function silkGeometry() {
  const { segments } = SILK_SHAPE;
  const index: number[] = [];
  for (const start of [0, 4]) index.push(start, start + 1, start + 2, start + 2, start + 1, start + 3);
  for (let tail = 0; tail < 2; tail++) {
    const base = 8 + tail * TAIL_VERTICES;
    for (let s = 0; s < segments; s++) {
      const a = base + s * 2;
      index.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SILK_VERTICES * 3), 3).setUsage(THREE.DynamicDrawUsage));
  // Each tail darker along its inner edge, where the fabric folds.
  geometry.setAttribute('color', new THREE.BufferAttribute(colourArray(SILK_VERTICES, i =>
    i < 8 ? ROPE : (i - 8) % 2 === Math.floor((i - 8) / TAIL_VERTICES) ? FOLD : FABRIC), 3));
  geometry.setIndex(index);
  return geometry;
}

// Writes the silk hanging `length` below its limb, swaying in a breeze at
// time `t` (seconds): the tails hang straight under the rigging and swing
// more the further down, turning a little as fabric does.
export function writeSilk(geometry: THREE.BufferGeometry, length: number, t: number, sway: number) {
  const { rope, ropeWidth, top, open, apart, segments } = SILK_SHAPE;
  const positions = geometry.attributes.position.array as Float32Array;
  let i = 0;
  const put = (x: number, y: number, z: number) => { positions[i++] = x; positions[i++] = y; positions[i++] = z; };
  const w = ropeWidth / 2;
  put(-w, 0, 0); put(w, 0, 0); put(-w, -rope, 0); put(w, -rope, 0);
  put(0, 0, -w); put(0, 0, w); put(0, -rope, -w); put(0, -rope, w);
  const fall = length - rope;
  for (let tail = 0; tail < 2; tail++) {
    const side = tail ? 1 : -1;
    for (let s = 0; s <= segments; s++) {
      const u = s / segments, y = -rope - u * fall;
      const swing = sway * u ** 1.6;
      const x = side * (.012 + apart / 2 * u) + swing * (Math.sin(t * .9) * .16 + Math.sin(t * 2.1 + u * 3) * .03);
      const z = swing * Math.sin(t * .7 + 1.3) * .1 + side * .008;
      const half = (top + (open - top) * Math.min(1, u * 5)) / 2;
      // The fabric turns about its own fall, the two tails each their own way.
      const turn = sway * (.35 * u * Math.sin(t * .8 + side + u * 4) + side * .25 * Math.min(1, u * 4));
      const dx = Math.cos(turn) * half, dz = Math.sin(turn) * half;
      put(x - dx, y, z - dz); put(x + dx, y, z + dz);
    }
  }
  geometry.attributes.position.needsUpdate = true;
  geometry.computeVertexNormals();
}

type Painted = [THREE.BufferGeometry, string];
function painted(parts: Painted[]) {
  const pieces = parts.map(([geometry, colour]) => {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    if (g !== geometry) geometry.dispose();
    g.deleteAttribute('uv');
    g.setAttribute('color', new THREE.BufferAttribute(colourArray(g.attributes.position.count, () => colour), 3));
    return g;
  });
  const merged = mergeGeometries(pieces)!;
  pieces.forEach(piece => piece.dispose());
  merged.computeVertexNormals();
  return merged;
}

const HOOP = '#f0e8d6', STROP = '#5f8a81', STEEL = '#8d918f';
// The lyra: the hoop's radius and its taped tube, the strop's width, and the
// swivel and the tab it hangs from at the top of the hoop.
export const LYRA_SHAPE = { radius: .45, tube: .024, strop: .035, swivel: .06, tab: .07 } as const;
// The lyra hanging `drop` below its limb to the top of its hoop.
export function lyraGeometry(drop: number) {
  const { radius, tube, strop, swivel, tab } = LYRA_SHAPE;
  const hoop = new THREE.TorusGeometry(radius, tube, 6, 32);
  hoop.translate(0, -drop - radius, 0);
  const line = new THREE.BoxGeometry(strop, drop - swivel - tab, strop * .4);
  line.translate(0, -(drop - swivel - tab) / 2, 0);
  const turn = new THREE.BoxGeometry(swivel * .6, swivel, swivel * .6);
  turn.translate(0, -drop + tab + swivel / 2, 0);
  const loop = new THREE.BoxGeometry(tube * 2.4, tab, tube * 2.4);
  loop.translate(0, -drop + tab / 2, 0);
  return painted([[hoop, HOOP], [line, STROP], [turn, STEEL], [loop, HOOP]]);
}
