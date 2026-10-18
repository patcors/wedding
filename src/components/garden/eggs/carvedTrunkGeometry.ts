// The university years' carved trunks (see uniOrnaments.ts): two old trees
// cut down to tall stumps, one on each bank, their bark carved where it faces
// the river. One with statistics, four distributions each over its own axis:
// a normal bell, a right-skewed curve, a Poisson's bars and an exponential's
// decay. The other with algebra: the quadratic formula, large. Each stump is
// a tapering trunk flaring into its roots, its top sawn across with the rings
// showing, about 450 triangles, wrapped in one canvas (bark round the trunk,
// the carvings cut into it, the sawn top) with a bump map from its carvings'
// depth. Built in its own units: the carving faces +z, y 0 is where it stands.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { random } from '../gardenGeometry.ts';
import { carvedTextures, incise, lettering, line, type Carver } from './carving.ts';

export type Carving = 'stats' | 'algebra';
export const TRUNK = { radius: .5, height: 1.8, tilt: .05, flare: .45, roots: 5, radial: 24 } as const;
// Heights of the trunk's rings of vertices, close together where it flares.
const ROWS = [-.12, 0, .07, .16, .28, .45, .75, 1.1, 1.45];
// The canvas: a band of bark round each trunk, the stats trunk's above the
// algebra trunk's, and the sawn top below them. A band's middle faces +z.
const W = 1024, BAND = 640, TOP = 512, H = BAND * 2 + TOP;
const TALL = TRUNK.height + TRUNK.tilt;
// The carvings take the face within ARC radians either side of +z, from
// FACE[0] to FACE[1] up the trunk.
const ARC = .92, ALGEBRA_ARC = 1.25, FACE = [.42, 1.66] as const;

const topAt = (a: number) => TRUNK.height + TRUNK.tilt * Math.cos(a - .4);
// The trunk's radius at angle a and height y: a slight taper, a little
// lumpy, and flaring into its roots near the ground.
function radiusAt(a: number, y: number, seed: number) {
  const low = Math.max(0, 1 - Math.max(0, y) / TRUNK.flare);
  const roots = .55 + .45 * Math.cos(TRUNK.roots * a + seed);
  return TRUNK.radius * (1 - .03 * y) * (1 + .025 * Math.sin(7 * a + 3 * y + seed) + .45 * low * low * roots);
}

// One stump, with UVs into its carving's band of the canvas and the sawn top.
function stump(carving: Carving, seed: number) {
  const band = carving === 'stats' ? 0 : 1, rows = [...ROWS, 0], n = TRUNK.radial;
  const positions: number[] = [], uvs: number[] = [], colours: number[] = [], index: number[] = [];
  const c = new THREE.Color(), soil = new THREE.Color('#6c6152'), moss = new THREE.Color('#9fb08a'), white = new THREE.Color('#ffffff');
  rows.forEach((row, r) => {
    for (let i = 0; i <= n; i++) {
      // Round from −z, so the band's seam is at the back and its middle at +z.
      const a = -Math.PI / 2 + i / n * Math.PI * 2;
      const y = r === rows.length - 1 ? topAt(a) : row, radius = radiusAt(a, y, seed);
      positions.push(Math.cos(a) * radius, y, Math.sin(a) * radius);
      uvs.push(1 - i / n, 1 - (band * BAND + BAND * (1 - Math.max(0, y) / TALL)) / H);
      // Earthy at its foot, a little moss on the side away from the sun.
      c.copy(white).lerp(soil, THREE.MathUtils.smoothstep(.3 - y, 0, .3)).lerp(moss, .25 * Math.max(0, -Math.cos(a + .6)) * THREE.MathUtils.smoothstep(.7 - y, 0, .5));
      colours.push(c.r, c.g, c.b);
    }
  });
  for (let r = 0; r < rows.length - 1; r++) for (let i = 0; i < n; i++) {
    const k = r * (n + 1) + i, up = k + n + 1;
    index.push(k, up, k + 1, k + 1, up, up + 1);
  }
  const side = new THREE.BufferGeometry();
  side.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  side.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  side.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  side.setIndex(index);
  side.computeVertexNormals();
  // The seam's two columns share a place, so they share a normal.
  const normal = side.attributes.normal, v = new THREE.Vector3(), w = new THREE.Vector3();
  for (let r = 0; r < rows.length; r++) {
    const a = r * (n + 1), b = a + n;
    v.fromBufferAttribute(normal, a).add(w.fromBufferAttribute(normal, b)).normalize();
    normal.setXYZ(a, v.x, v.y, v.z); normal.setXYZ(b, v.x, v.y, v.z);
  }

  // The sawn top: a fan from the middle, mapped onto the rings.
  const middle = BAND * 2 + TOP / 2, scale = TOP * .48 / (TRUNK.radius * 1.08);
  const top: number[] = [0, TRUNK.height, 0], topUv: number[] = [TOP / 2 / W, 1 - middle / H], fan: number[] = [];
  const rim = rows.length - 1;
  for (let i = 0; i <= n; i++) {
    const k = rim * (n + 1) + i, x = positions[k * 3], z = positions[k * 3 + 2];
    top.push(x, positions[k * 3 + 1], z);
    topUv.push((TOP / 2 + x * scale) / W, 1 - (middle - z * scale) / H);
    if (i) fan.push(0, i + 1, i);
  }
  const cap = new THREE.BufferGeometry();
  cap.setAttribute('position', new THREE.Float32BufferAttribute(top, 3));
  cap.setAttribute('uv', new THREE.Float32BufferAttribute(topUv, 2));
  cap.setAttribute('color', new THREE.Float32BufferAttribute(new Array(top.length).fill(1), 3));
  cap.setIndex(fan);
  cap.computeVertexNormals();
  const geometry = mergeGeometries([side, cap])!;
  side.dispose(); cap.dispose();
  return geometry;
}

// Both stumps, each placed in the world by its matrix, merged into one mesh.
export function carvedTrunksGeometry(placed: { carving: Carving; matrix: THREE.Matrix4 }[]) {
  const pieces = placed.map(({ carving, matrix }, i) => stump(carving, 1.3 + i * 2.1).applyMatrix4(matrix));
  const geometry = mergeGeometries(pieces)!;
  pieces.forEach(piece => piece.dispose());
  return geometry;
}

// Canvas pixels across the carved face, from its left edge, and up it.
const faceLeft = W / 2 - ARC / (Math.PI * 2) * W, faceWidth = ARC / Math.PI * W;
const yAt = (band: number, y: number) => band * BAND + BAND * (1 - y / TALL);

// Bark: dark, deeply fissured and ridged along the trunk, with pale lichen.
function bark({ colour: ctx }: Carver, band: number, seed: number) {
  const rand = random(seed), top = band * BAND;
  ctx.fillStyle = '#58483a';
  ctx.fillRect(0, top, W, BAND);
  for (let i = 0; i < 260; i++) {
    const x = rand() * W, y = top + rand() * BAND, length = 40 + rand() * 260, sway = (rand() - .5) * 10;
    ctx.globalAlpha = .35 + rand() * .45;
    ctx.strokeStyle = rand() < .62 ? '#2f251d' : '#7d6a56';
    ctx.lineWidth = 1.5 + rand() * 5;
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + sway, y + length * .33, x - sway, y + length * .66, x + sway * .5, y + length);
    ctx.stroke();
  }
  ctx.fillStyle = '#a7ab95';
  for (let i = 0; i < 26; i++) {
    ctx.globalAlpha = .12 + rand() * .2;
    ctx.beginPath(); ctx.ellipse(rand() * W, top + rand() * BAND, 6 + rand() * 22, 4 + rand() * 14, rand() * 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// Four distributions, one above another, each over its own axis.
function stats(carver: Carver) {
  const width = faceWidth * .82, left = faceLeft + (faceWidth - width) / 2;
  const rows = 4, top = yAt(0, FACE[1]), height = yAt(0, FACE[0]) - top, rowHeight = height / rows;
  const curve = (row: number, f: (u: number) => number, samples = 48) => {
    const base = top + rowHeight * (row + .86), tall = rowHeight * .68;
    incise(carver, line([[left - 6, base], [left + width + 6, base]]), 9);
    incise(carver, line(Array.from({ length: samples + 1 }, (_, i) => [left + width * i / samples, base - tall * f(i / samples)] as const)), 13);
  };
  // A normal bell; a right-skewed gamma; a Poisson's bars (λ 3); an exponential.
  curve(0, u => Math.exp(-(((u - .5) * 6) ** 2) / 2));
  curve(1, u => { const x = u * 7; return x * x * Math.exp(-x) / (4 * Math.exp(-2)); });
  const base = top + rowHeight * 2.86, tall = rowHeight * .68 / .2241;
  incise(carver, line([[left - 6, base], [left + width + 6, base]]), 9);
  for (let k = 0; k < 8; k++) {
    let p = Math.exp(-3);
    for (let j = 1; j <= k; j++) p *= 3 / j;
    const x = left + width * (k + .5) / 8;
    incise(carver, line([[x, base], [x, base - tall * p]]), 15, false);
  }
  curve(3, u => Math.exp(-u * 4.2));
}

// The quadratic formula: x =, and the fraction under it, as large as the face allows.
function algebra(carver: Carver) {
  const { colour: ctx } = carver, middle = W / 2, top = yAt(1, FACE[1]), bottom = yAt(1, FACE[0]);
  // The numerator: −b ± , then the radical over b² − 4ac, sized to fill the
  // face a little wider than the statistics' (it reads well round to ALGEBRA_ARC).
  const lead = '−b ± ', under = 'b  − 4ac';
  const measure = (text: string, size: number) => {
    ctx.font = `italic 500 ${size}px "Cormorant Garamond", Georgia, serif`;
    return ctx.measureText(text).width;
  };
  const fit = (measure(lead, 100) + 50 + measure(under, 100)) / 100;
  const size = Math.min(120, ALGEBRA_ARC / Math.PI * W * .94 / fit), stroke = size * .055;
  const leadWidth = measure(lead, size), underWidth = measure(under, size), b = measure('b', size);
  const sign = size * .5, total = leadWidth + sign + underWidth, start = middle - total / 2;
  const gap = (bottom - top - size * 3.1) / 2;
  const row1 = top + gap + size * .8, row2 = row1 + size * 1.25, bar = row2 + size * .22, row3 = bar + size * .83;
  incise(carver, lettering('x =', middle, row1, size), stroke, false);
  incise(carver, lettering(lead, start + leadWidth / 2, row2, size), stroke, false);
  const radical = start + leadWidth, over = row2 - size * .78;
  incise(carver, line([[radical, row2 - size * .3], [radical + sign * .3, row2 - size * .38], [radical + sign * .58, row2 + size * .1], [radical + sign, over], [radical + sign + underWidth + 4, over]]), 7);
  incise(carver, lettering(under, radical + sign + underWidth / 2, row2, size), stroke, false);
  // The square, raised and smaller, after the first b.
  incise(carver, lettering('2', radical + sign + b + size * .17, row2 - size * .42, size * .55, false), stroke * .8, false);
  incise(carver, line([[start - 6, bar], [start + total + 6, bar]]), 8);
  incise(carver, lettering('2a', middle, row3, size), stroke, false);
}

// The sawn top: pale end grain, growth rings a little off centre, a few checks.
function rings({ colour: ctx }: Carver, seed: number) {
  const rand = random(seed), cx = TOP / 2, cy = BAND * 2 + TOP / 2;
  ctx.fillStyle = '#b49a78';
  ctx.fillRect(0, BAND * 2, TOP, TOP);
  ctx.strokeStyle = '#7d6449';
  for (let r = 10; r < TOP * .46; r += 7 + rand() * 9) {
    ctx.globalAlpha = .35 + rand() * .4; ctx.lineWidth = 1 + rand() * 2.5;
    ctx.beginPath(); ctx.ellipse(cx + 14 - r * .04, cy - 8, r, r * .97, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.globalAlpha = .7; ctx.strokeStyle = '#4d3b2b';
  for (let i = 0; i < 5; i++) {
    const a = rand() * Math.PI * 2, from = TOP * (.1 + rand() * .15);
    ctx.lineWidth = 1.5 + rand() * 2;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * from, cy + Math.sin(a) * from); ctx.lineTo(cx + Math.cos(a) * TOP * .46, cy + Math.sin(a) * TOP * .46); ctx.stroke();
  }
  // The bark's edge round the cut.
  ctx.globalAlpha = 1; ctx.lineWidth = TOP * .05; ctx.strokeStyle = '#4a3b2e';
  ctx.beginPath(); ctx.arc(cx, cy, TOP * .47, 0, Math.PI * 2); ctx.stroke();
}

export function carvedTrunkTextures() {
  return carvedTextures(W, H, carver => {
    bark(carver, 0, 11); bark(carver, 1, 23);
    stats(carver); algebra(carver);
    rings(carver, 37);
  });
}
