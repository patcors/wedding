// The university years' park bench (see uniOrnaments.ts): a plain wooden
// bench of weathered slats, three to sit on and two across its back, on a
// frame at each end of a front leg, a back leg raked up into the back's post,
// a rail under the seat and an arm on top. 180 triangles in one mesh,
// every piece wrapped in one canvas of weathered grain. Built in its own
// units: it looks out along +z, y 0 is the ground.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { random } from '../gardenGeometry.ts';

export const BENCH = { length: 1.5, seat: .45, depth: .44, slat: .12, back: .82, rake: .2 } as const;
const W = 512, H = 512;

type Axis = 0 | 1 | 2;
// A box, its grain along `along` (its own axis), wrapped in the grain at a
// place of its own, and tinted a shade lighter or darker, as weathered slats are.
function piece(size: [number, number, number], along: Axis, seed: number) {
  const geometry = new THREE.BoxGeometry(...size).toNonIndexed();
  const position = geometry.attributes.position, normal = geometry.attributes.normal, uv = geometry.attributes.uv;
  const rand = random(seed), offset = .1 + rand() * .7, tint = .86 + rand() * .18, colours: number[] = [];
  for (let i = 0; i < position.count; i++) {
    const p = [position.getX(i), position.getY(i), position.getZ(i)], n = [normal.getX(i), normal.getY(i), normal.getZ(i)];
    const facing = n.map(Math.abs).indexOf(Math.max(...n.map(Math.abs))) as Axis;
    // Across the grain: whichever of the face's own axes isn't along it.
    const across = ([0, 1, 2] as Axis[]).find(a => a !== facing && a !== along) ?? ((along + 1) % 3) as Axis;
    uv.setXY(i, .5 + p[along] / 1.6, offset + p[across] * 1.2);
    colours.push(tint, tint, tint);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  return geometry;
}
// A post from `from` to `to`, its section `thick` across and `wide`.
function post(from: THREE.Vector3, to: THREE.Vector3, thick: number, wide: number, seed: number) {
  const length = from.distanceTo(to), direction = to.clone().sub(from).normalize();
  return piece([thick, length, wide], 1, seed).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction))
    .translate(...from.clone().add(to).multiplyScalar(.5).toArray());
}

export function parkBenchGeometry() {
  const { length, seat, depth, slat, back, rake } = BENCH, parts: THREE.BufferGeometry[] = [];
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  // The seat's slats, front to back, with a gap between each.
  for (let i = 0; i < 3; i++) parts.push(piece([length, .035, slat], 0, 3 + i).translate(0, seat, depth / 2 - slat / 2 - i * (slat + .03)));
  // The back's slats, leaning back with its posts, just in front of them.
  const lean = rake / (back - seat);
  for (const [i, y] of [.6, .75].entries()) {
    parts.push(piece([length, slat * .85, .03], 0, 7 + i).rotateX(-Math.atan(lean)).translate(0, y, -depth / 2 + .073 - (y - seat) * lean));
  }
  for (const side of [-1, 1]) {
    const x = side * (length / 2 - .1);
    parts.push(post(v(x, 0, depth / 2 - .06), v(x, .66, depth / 2 - .06), .055, .055, 11 + side));
    parts.push(post(v(x, 0, -depth / 2 + .03), v(x, seat, -depth / 2 + .03), .055, .055, 13 + side));
    parts.push(post(v(x, seat, -depth / 2 + .03), v(x, back, -depth / 2 - rake + .03), .055, .055, 15 + side));
    // The rail under the seat and the arm, running front to back.
    parts.push(piece([.05, .07, depth], 2, 17 + side).translate(x, seat - .053, 0));
    parts.push(piece([.07, .035, depth + .1], 2, 19 + side).translate(x, .68, -.03));
  }
  const geometry = mergeGeometries(parts)!;
  parts.forEach(part => part.dispose());
  return geometry;
}

// Weathered boards: silvered brown with long darker grain and a few knots.
export function parkBenchTexture() {
  const canvas = Object.assign(document.createElement('canvas'), { width: W, height: H });
  const ctx = canvas.getContext('2d')!, rand = random(5);
  ctx.fillStyle = '#93826c';
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < H / 1.6; i++) {
    const at = rand() * H, sway = (rand() - .5) * 8;
    ctx.globalAlpha = .18 + rand() * .35;
    ctx.strokeStyle = rand() < .7 ? '#5e5041' : '#b8a68c';
    ctx.lineWidth = .8 + rand() * 2.4;
    ctx.beginPath(); ctx.moveTo(0, at);
    ctx.bezierCurveTo(W * .33, at + sway, W * .66, at - sway, W, at + sway * .4);
    ctx.stroke();
  }
  for (let i = 0; i < 8; i++) {
    ctx.globalAlpha = .5; ctx.fillStyle = '#4f4234';
    ctx.beginPath(); ctx.ellipse(rand() * W, rand() * H, 4 + rand() * 6, 2 + rand() * 3, 0, 0, Math.PI * 2); ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}
