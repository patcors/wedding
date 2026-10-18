// The bark carvings (see uniOrnaments.ts): a patch laid on the bark of a real
// tree, cut with distribution curves (a normal bell, a right-skewed curve, a
// Poisson's bars and an exponential's decay), the quadratic formula, a sloop,
// a golden spiral, two sloops or a heart with P + A. The patch is the trunk's own faces where the carving
// goes, copied from the tree's model and lifted a hair off the bark along its
// normals, so it follows every facet and lump and can't float or sink in; the
// carving is mapped round the trunk on it, the rest of it clear, so the bark
// shows through. Its canvas is drawn with carving.ts, its grooves through the
// bark to paler wood, with a bump map from their depth.
import * as THREE from 'three';
import { carvedTextures, incise, lettering, line, type Carver, type Shape } from './carving.ts';
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
const MARGIN = 28, CANVAS = { stats: [512, 512], algebra: [640, 420], sloop: [440, 480], spiral: [600, 380], sloops: [600, 400], heart: [480, 440] } as const;

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

// A toy sloop, bow to the right, in a box `wide` across from (left, top):
// its hull, mast, main and jib, cut in outline as initials are.
function sloop(carver: Carver, left: number, top: number, wide: number, high: number, stroke: number) {
  const at = (u: number, v: number) => [left + u * wide, top + v * high] as const;
  incise(carver, line([at(0, .74), at(1, .74), at(.84, .94), at(.12, .94), at(0, .74)]), stroke);
  incise(carver, line([at(.47, .74), at(.47, 0)]), stroke * .8);
  incise(carver, line([at(.41, .06), at(.41, .66), at(.06, .66), at(.41, .06)]), stroke * .8);
  incise(carver, line([at(.53, .14), at(.53, .66), at(.88, .66), at(.53, .14)]), stroke * .8);
}

// One sloop on a ripple, before they meet.
function oneSloop(carver: Carver) {
  const [wide, high] = CANVAS.sloop, stroke = 30;
  sloop(carver, MARGIN + 20, MARGIN + 10, wide - MARGIN * 2 - 40, (high - MARGIN * 2) * .82, stroke);
  const y = MARGIN + (high - MARGIN * 2) * .96, left = MARGIN + 10, right = wide - MARGIN - 10;
  incise(carver, line(Array.from({ length: 25 }, (_, i) => [left + (right - left) * i / 24, y + Math.sin(i / 24 * Math.PI * 4) * 9] as const)), stroke * .55);
}

// Two sloops side by side, alongside again.
function twoSloops(carver: Carver) {
  const [wide, high] = CANVAS.sloops, gap = 34, each = (wide - MARGIN * 2 - gap) / 2;
  for (const i of [0, 1]) sloop(carver, MARGIN + i * (each + gap), MARGIN, each, high - MARGIN * 2, 26);
}

// A golden spiral over the Fibonacci squares it grows from (1, 1, 2, 3, 5
// and 8, in a 13 by 8 rectangle), each quarter turn a quarter circle across
// its square: the squares cut fine and the spiral deep.
function goldenSpiral(carver: Carver) {
  const [wide, high] = CANVAS.spiral, unit = Math.min((wide - MARGIN * 2) / 13, (high - MARGIN * 2) / 8);
  const left = (wide - unit * 13) / 2, top = (high - unit * 8) / 2;
  // Each square's corner (in units from the rectangle's top left), size, and
  // the corner its quarter circle turns about, the spiral running inwards.
  const squares = [[0, 0, 8, 8, 8, Math.PI, Math.PI * 1.5], [8, 0, 5, 8, 5, Math.PI * 1.5, Math.PI * 2], [10, 5, 3, 10, 5, 0, Math.PI * .5],
    [8, 6, 2, 10, 6, Math.PI * .5, Math.PI], [8, 5, 1, 9, 6, Math.PI, Math.PI * 1.5], [9, 5, 1, 9, 6, Math.PI * 1.5, Math.PI * 2]] as const;
  const box: Shape = (ctx, width) => {
    ctx.lineWidth = width;
    for (const [x, y, size] of squares) ctx.strokeRect(left + x * unit, top + y * unit, size * unit, size * unit);
  };
  incise(carver, box, 11, false);
  const spiral: Shape = (ctx, width) => {
    ctx.lineWidth = width;
    ctx.beginPath();
    for (const [, , size, cx, cy, from, to] of squares) ctx.arc(left + cx * unit, top + cy * unit, size * unit, from, to);
    ctx.stroke();
  };
  incise(carver, spiral, 26);
}

// The lovers' carving: a heart cut in outline with P + A inside it.
function heart(carver: Carver) {
  const [wide, high] = CANVAS.heart, middle = wide / 2, w = (wide - MARGIN * 2) / 2 - 14, top = MARGIN + 14, bottom = high - MARGIN - 10;
  const outline: Shape = (ctx, width) => {
    ctx.lineWidth = width;
    const dip = top + (bottom - top) * .22;
    ctx.beginPath();
    ctx.moveTo(middle, dip);
    ctx.bezierCurveTo(middle + w * .1, top - 12, middle + w * 1.05, top - 18, middle + w, dip + 30);
    ctx.bezierCurveTo(middle + w * .96, top + (bottom - top) * .62, middle + w * .3, bottom - 50, middle, bottom);
    ctx.bezierCurveTo(middle - w * .3, bottom - 50, middle - w * .96, top + (bottom - top) * .62, middle - w, dip + 30);
    ctx.bezierCurveTo(middle - w * 1.05, top - 18, middle - w * .1, top - 12, middle, dip);
    ctx.stroke();
  };
  incise(carver, outline, 30);
  const size = 132;
  incise(carver, lettering('P + A', middle, top + (bottom - top) * .58, size, false), size * .1, false);
}

const PAINT: Record<CarvingId, (carver: Carver) => void> = { stats, algebra, sloop: oneSloop, spiral: goldenSpiral, sloops: twoSloops, heart };

export function barkCarvingTextures(carving: CarvingId) {
  const [wide, high] = CANVAS[carving], textures = carvedTextures(wide, high, PAINT[carving]);
  for (const texture of [textures.map, textures.bumpMap]) texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  return textures;
}
