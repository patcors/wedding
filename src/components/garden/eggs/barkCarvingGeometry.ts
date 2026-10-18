// The university years' bark carvings (see uniOrnaments.ts): a patch laid on
// the bark of a real tree, cut with distribution curves (a normal bell, a
// right-skewed curve, a Poisson's bars and an exponential's decay) or the
// quadratic formula. The patch is the trunk's own faces where the carving
// goes, copied from the tree's model and lifted a hair off the bark along its
// normals, so it follows every facet and lump and can't float or sink in; the
// carving is mapped round the trunk on it, the rest of it clear, so the bark
// shows through. Its canvas is drawn with carving.ts, its grooves through the
// bark to paler wood, with a bump map from their depth.
import * as THREE from 'three';
import { carvedTextures, incise, lettering, line, type Carver } from './carving.ts';
import type { CarvedTree, CarvingId } from './uniOrnaments.ts';

// The tree model's branches as plain arrays: positions and normals, three
// numbers a vertex, and the triangles' vertex indices.
export type TreeMesh = { position: ArrayLike<number>; normal: ArrayLike<number>; index: ArrayLike<number> };
export type PatchPlace = { matrix: THREE.Matrix4; toward: { x: number; z: number }; arc: number; from: number; to: number };
// The trunk below its first branches (the distant ashes fork above 4), and
// how far the patch is lifted off it, in the tree's units.
const TRUNK = { radius: .8, top: 2.4 } as const;
export const LIFT = .004;

// Where GardenTrees puts the tree: at its foot, turned about +y and scaled.
export const treeMatrix = ({ x, y, z, rotation, scale }: CarvedTree) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z),
  new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotation), new THREE.Vector3().setScalar(scale));

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
// The middle of the trunk at height y, from the vertices round it there.
function axisAt(mesh: TreeMesh, y: number) {
  let x = 0, z = 0, n = 0;
  for (let i = 0; i < mesh.position.length; i += 3) {
    const px = mesh.position[i], py = mesh.position[i + 1], pz = mesh.position[i + 2];
    if (Math.abs(py - y) < .6 && py < TRUNK.top && Math.hypot(px, pz) < TRUNK.radius) { x += px; z += pz; n++; }
  }
  return n ? { x: x / n, z: z / n } : { x: 0, z: 0 };
}

// The patch, in world units: every trunk triangle that reaches into the
// carving (a little to spare), each vertex lifted along its normal, and UVs
// that put the carving's canvas round the trunk centred on the face turned
// `toward` a point, `arc` either side, `from` to `to` up it, and beyond that
// off the canvas's clear edge.
export function barkPatch(mesh: TreeMesh, { matrix, toward, arc, from, to }: PatchPlace) {
  const axis = axisAt(mesh, (from + to) / 2);
  const local = new THREE.Vector3(toward.x, 0, toward.z).applyMatrix4(matrix.clone().invert());
  const facing = Math.atan2(local.z - axis.z, local.x - axis.x), spare = arc + .3;
  const angleOf = (i: number) => wrap(Math.atan2(mesh.position[i * 3 + 2] - axis.z, mesh.position[i * 3] - axis.x) - facing);
  const onTrunk = (i: number) => mesh.position[i * 3 + 1] < TRUNK.top && Math.hypot(mesh.position[i * 3], mesh.position[i * 3 + 2]) < TRUNK.radius;
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [];
  const p = new THREE.Vector3(), n = new THREE.Vector3(), normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);
  for (let t = 0; t < mesh.index.length; t += 3) {
    const corners = [mesh.index[t], mesh.index[t + 1], mesh.index[t + 2]];
    if (!corners.every(onTrunk)) continue;
    const ys = corners.map(i => mesh.position[i * 3 + 1]);
    if (Math.max(...ys) < from - .1 || Math.min(...ys) > to + .1 || corners.every(i => Math.abs(angleOf(i)) > spare)) continue;
    for (const i of corners) {
      n.fromArray(mesh.normal, i * 3).normalize();
      p.fromArray(mesh.position, i * 3).addScaledVector(n, LIFT).applyMatrix4(matrix);
      n.applyMatrix3(normalMatrix).normalize();
      positions.push(p.x, p.y, p.z);
      normals.push(n.x, n.y, n.z);
      // Round the trunk to the right as seen from outside it, and up it.
      uvs.push(.5 - angleOf(i) / (2 * arc), (mesh.position[i * 3 + 1] - from) / (to - from));
    }
  }
  return { positions, normals, uvs };
}

export function barkPatchGeometry(mesh: TreeMesh, place: PatchPlace) {
  const { positions, normals, uvs } = barkPatch(mesh, place);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  return geometry;
}

// Each canvas: the carving within a clear margin, which the clamped edge
// carries on over the rest of the patch. The formula's is wider than tall.
const MARGIN = 28, CANVAS = { stats: [512, 512], algebra: [640, 420] } as const;

// Four distributions in two rows, each over its own axis.
function stats(carver: Carver) {
  const cell = (CANVAS.stats[0] - MARGIN * 2) / 2, pad = cell * .12, width = cell - pad * 2, tall = cell * .62, samples = 40;
  const axis = (left: number, base: number) => incise(carver, line([[left - 4, base], [left + width + 4, base]]), 22);
  const curve = (column: number, row: number, f: (u: number) => number) => {
    const left = MARGIN + column * cell + pad, base = MARGIN + (row + .82) * cell;
    axis(left, base);
    incise(carver, line(Array.from({ length: samples + 1 }, (_, i) => [left + width * i / samples, base - tall * f(i / samples)] as const)), 36);
  };
  // A normal bell and a right-skewed gamma above; a Poisson's bars (λ 3) and an exponential below.
  curve(0, 0, u => Math.exp(-(((u - .5) * 6) ** 2) / 2));
  curve(1, 0, u => { const x = u * 7; return x * x * Math.exp(-x) / (4 * Math.exp(-2)); });
  const left = MARGIN + pad, base = MARGIN + 1.82 * cell;
  axis(left, base);
  for (let k = 0; k < 6; k++) {
    let p = Math.exp(-3);
    for (let j = 1; j <= k; j++) p *= 3 / j;
    const x = left + width * (k + .5) / 6;
    incise(carver, line([[x, base], [x, base - tall * p / .2241]]), 24, false);
  }
  curve(1, 1, u => Math.exp(-u * 4.2));
}

// The quadratic formula: x =, and the fraction under it, filling the canvas.
function algebra(carver: Carver) {
  const { colour: ctx } = carver, [wide, high] = CANVAS.algebra, middle = wide / 2;
  const lead = '−b ± ', under = 'b  − 4ac';
  const measure = (text: string, size: number) => {
    ctx.font = `italic 500 ${size}px "Cormorant Garamond", Georgia, serif`;
    return ctx.measureText(text).width;
  };
  const fit = (measure(lead, 100) + 50 + measure(under, 100)) / 100;
  const size = Math.min((high - MARGIN * 2) / 3.1, (wide - MARGIN * 2) / fit), stroke = size * .11;
  const leadWidth = measure(lead, size), underWidth = measure(under, size), b = measure('b', size);
  const sign = size * .5, total = leadWidth + sign + underWidth, start = middle - total / 2;
  const row1 = high / 2 - size * 1.55 + size * .8, row2 = row1 + size * 1.25, bar = row2 + size * .22, row3 = bar + size * .83;
  incise(carver, lettering('x =', middle, row1, size), stroke, false);
  incise(carver, lettering(lead, start + leadWidth / 2, row2, size), stroke, false);
  const radical = start + leadWidth, over = row2 - size * .78;
  incise(carver, line([[radical, row2 - size * .3], [radical + sign * .3, row2 - size * .38], [radical + sign * .58, row2 + size * .1], [radical + sign, over], [radical + sign + underWidth + 4, over]]), size * .13);
  incise(carver, lettering(under, radical + sign + underWidth / 2, row2, size), stroke, false);
  // The square, raised and smaller, after the first b.
  incise(carver, lettering('2', radical + sign + b + size * .17, row2 - size * .42, size * .55, false), stroke * .8, false);
  incise(carver, line([[start - 4, bar], [start + total + 4, bar]]), size * .14);
  incise(carver, lettering('2a', middle, row3, size), stroke, false);
}

export function barkCarvingTextures(carving: CarvingId) {
  const [wide, high] = CANVAS[carving], textures = carvedTextures(wide, high, carving === 'stats' ? stats : algebra);
  for (const texture of [textures.map, textures.bumpMap]) texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  return textures;
}
