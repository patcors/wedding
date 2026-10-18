// The university years' picnic table (see uniOrnaments.ts): a weathered park
// picnic table, its top of five planks and a bench seat of two along each
// side, carried on A-frame legs at each end with a crosspiece under the top,
// a support under the seats and a brace up to the middle of the top. Carved
// into the top, along it and facing the camera, is Euler's identity,
// e^{iπ} + 1 = 0, large. It has settled out of level on the bank, leaning
// `lean` radians towards its long side, which tips the carving up to the
// camera on the river (level, from the boats' height, the top is too
// foreshortened to read); each leg reaches down to the ground. About 230
// triangles in one mesh, every plank wrapped in one canvas (the top's carved
// face, and weathered grain for the rest) with a bump map from the carving's
// depth. Built in its own units: its long side faces +z, y 0 is the ground.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { random } from '../gardenGeometry.ts';
import { carvedTextures, incise, lettering, line, type Carver } from './carving.ts';

export const TABLE = { length: 1.9, plank: .145, gap: .012, planks: 5, height: .76, lean: .36 } as const;
const DEPTH = TABLE.planks * TABLE.plank + (TABLE.planks - 1) * TABLE.gap;
// The canvas: the top's face above, weathered grain below.
const W = 1024, FACE = Math.round(W * DEPTH / TABLE.length), GRAIN = 440, H = 1024;
const lean = new THREE.Matrix4().makeRotationX(TABLE.lean);

type Axis = 0 | 1 | 2;
// A box, its grain along `along` (its own axis), wrapped in the grain, and
// tinted a shade lighter or darker, as weathered planks are.
function plank(size: [number, number, number], along: Axis, seed: number) {
  const geometry = new THREE.BoxGeometry(...size).toNonIndexed();
  const position = geometry.attributes.position, normal = geometry.attributes.normal, uv = geometry.attributes.uv;
  const rand = random(seed), offset = .15 + rand() * .6, tint = .86 + rand() * .18, colours: number[] = [];
  for (let i = 0; i < position.count; i++) {
    const p = [position.getX(i), position.getY(i), position.getZ(i)], n = [normal.getX(i), normal.getY(i), normal.getZ(i)];
    const facing = n.map(Math.abs).indexOf(Math.max(...n.map(Math.abs))) as Axis;
    // Across the grain: whichever of the face's own axes isn't along it.
    const across = ([0, 1, 2] as Axis[]).find(a => a !== facing && a !== along) ?? ((along + 1) % 3) as Axis;
    uv.setXY(i, .5 + p[along] / 2, 1 - (GRAIN + (offset + p[across] * 1.4) * (H - GRAIN)) / H);
    colours.push(tint, tint, tint);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  return geometry;
}
// A plank of the top: its upper face mapped onto the carved face, by where it is on the top.
function topPlank(z: number, seed: number) {
  const geometry = plank([TABLE.length, .045, TABLE.plank], 0, seed).translate(0, TABLE.height - .0225, z);
  const position = geometry.attributes.position, normal = geometry.attributes.normal, uv = geometry.attributes.uv;
  for (let i = 0; i < position.count; i++) if (normal.getY(i) > .9) {
    uv.setXY(i, .5 + position.getX(i) / TABLE.length, 1 - (DEPTH / 2 + position.getZ(i)) / DEPTH * FACE / H);
  }
  return geometry;
}
// A strut from `from` down to `to`, its section `thick` across and `wide`.
function strut(from: THREE.Vector3, to: THREE.Vector3, thick: number, wide: number, seed: number) {
  const length = from.distanceTo(to), direction = to.clone().sub(from).normalize();
  return plank([thick, length, wide], 1, seed).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction))
    .translate(...from.clone().add(to).multiplyScalar(.5).toArray());
}

export function picnicTableGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  for (let i = 0; i < TABLE.planks; i++) parts.push(topPlank(-DEPTH / 2 + TABLE.plank / 2 + i * (TABLE.plank + TABLE.gap), 3 + i));
  for (const side of [-1, 1]) {
    // Bench seats, two planks each, on the seat supports.
    for (const [k, z] of [.535, .668].entries()) parts.push(plank([TABLE.length, .04, .125], 0, 11 + k + side * 7).translate(0, .47, side * z));
    const end = side * .7;
    // The crosspiece under the top, the seat support, and the brace between them.
    parts.push(plank([.06, .05, DEPTH - .04], 2, 21 + side).translate(end, TABLE.height - .07, 0));
    parts.push(plank([.06, .09, 1.5], 2, 23 + side).translate(end, .405, 0));
    parts.push(strut(v(side * .66, .42, 0), v(side * .18, TABLE.height - .07, 0), .045, .08, 25 + side));
  }
  // Every part leans together; then each leg runs from under the top down to the ground.
  for (const part of parts) part.applyMatrix4(lean);
  for (const side of [-1, 1]) for (const front of [-1, 1]) {
    const top = v(side * .755, TABLE.height - .06, front * .2).applyMatrix4(lean), foot = v(side * .755, 0, front * .66).applyMatrix4(lean);
    parts.push(strut(top, top.clone().add(foot.sub(top).multiplyScalar(top.y / (top.y - foot.y))), .045, .1, 31 + side * 2 + front));
  }
  const geometry = mergeGeometries(parts)!;
  parts.forEach(part => part.dispose());
  return geometry;
}

// Weathered boards: silvered brown with long darker grain and a few knots.
function grain({ colour: ctx }: Carver, y: number, height: number, seed: number) {
  const rand = random(seed);
  ctx.fillStyle = '#93826c';
  ctx.fillRect(0, y, W, height);
  for (let i = 0; i < height / 2.2; i++) {
    const at = y + rand() * height, sway = (rand() - .5) * 8;
    ctx.globalAlpha = .18 + rand() * .35;
    ctx.strokeStyle = rand() < .7 ? '#5e5041' : '#b8a68c';
    ctx.lineWidth = .8 + rand() * 2.4;
    ctx.beginPath(); ctx.moveTo(0, at);
    ctx.bezierCurveTo(W * .33, at + sway, W * .66, at - sway, W, at + sway * .4);
    ctx.stroke();
  }
  for (let i = 0; i < 6; i++) {
    ctx.globalAlpha = .5; ctx.fillStyle = '#4f4234';
    ctx.beginPath(); ctx.ellipse(rand() * W, y + rand() * height, 5 + rand() * 7, 3 + rand() * 3, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// Euler's identity along the top, upright to someone on the +z side, as
// large as the top allows: e, the raised iπ, then + 1 = 0, each cut on its
// own with room between, so the signs don't run together from the river.
// The equals sign is cut as two bars, wider apart than the font sets them.
function euler(carver: Carver) {
  const { colour: ctx } = carver;
  const measure = (text: string) => {
    ctx.font = 'italic 500 100px "Cormorant Garamond", Georgia, serif';
    return ctx.measureText(text).width / 100;
  };
  // Each piece: its width at size 1, and how it is cut centred on x.
  type Piece = { width: number; cut: (x: number, baseline: number, size: number, stroke: number) => void };
  const glyph = (text: string, scale = 1, rise = 0): Piece => ({ width: measure(text) * scale,
    cut: (x, baseline, size, stroke) => incise(carver, lettering(text, x, baseline - size * rise, size * scale), stroke * (scale < 1 ? .85 : 1), false) });
  const equals: Piece = { width: .5, cut: (x, baseline, size, stroke) => {
    for (const rise of [.2, .42]) incise(carver, line([[x - size * .25, baseline - size * rise], [x + size * .25, baseline - size * rise]]), stroke * 1.6);
  } };
  // The raised iπ sits close against its e; the rest a little apart.
  const pieces = [glyph('e'), glyph('iπ', .7, .42), glyph('+'), glyph('1'), equals, glyph('0')];
  const gaps = pieces.map((_, i) => i === 0 ? .09 : i < pieces.length - 1 ? .3 : 0);
  const fit = pieces.reduce((sum, piece, i) => sum + piece.width + gaps[i], 0);
  const size = Math.min(FACE * .8, W * .9 / fit), stroke = size * .06, baseline = FACE * .5 + size * .28;
  let x = W / 2 - fit * size / 2;
  pieces.forEach((piece, i) => {
    piece.cut(x + piece.width * size / 2, baseline, size, stroke);
    x += (piece.width + gaps[i]) * size;
  });
}

export function picnicTableTextures() {
  return carvedTextures(W, H, carver => {
    grain(carver, 0, FACE, 5);
    euler(carver);
    grain(carver, GRAIN, H - GRAIN, 9);
  });
}
