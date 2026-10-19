// The apartments' street (see nesting.ts): a street-name blade reading
// "Church St" fixed to the trunk of the tree beside Amelia's birdhouse, and
// each birdhouse's number on a little enamel plaque, 29 for hers and 54 for
// his, as they both bought on the same street. The sign and the numbers are
// drawn into one small canvas atlas, which the birdhouses' material shares,
// so the numbers add no draw call and the sign one. The sign is an
// Australian street blade: white letters on a blue-green panel inside a thin
// white border.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { TreeMesh } from './barkCarvingGeometry.ts';

type Rect = { x: number; y: number; width: number; height: number };
// The atlas, in canvas pixels: the blade across the top, the two plaques
// under it, and a patch of plain white that everything untextured samples.
const ATLAS = { width: 512, height: 256 } as const;
export const SIGN_RECT: Rect = { x: 0, y: 0, width: 512, height: 112 };
export const NUMBER_RECTS: Record<'amelia' | 'patrick', Rect> = {
  amelia: { x: 8, y: 128, width: 172, height: 118 },
  patrick: { x: 196, y: 128, width: 172, height: 118 },
};
export const HOUSE_NUMBERS = { amelia: '29', patrick: '54' } as const;
const WHITE: Rect = { x: 392, y: 128, width: 120, height: 128 };
// A rect's place in the texture (v up, as a canvas texture is flipped).
export const uvRect = ({ x, y, width, height }: Rect) =>
  ({ u: x / ATLAS.width, v: 1 - (y + height) / ATLAS.height, w: width / ATLAS.width, h: height / ATLAS.height });
export const WHITE_UV = [(WHITE.x + WHITE.width / 2) / ATLAS.width, 1 - (WHITE.y + WHITE.height / 2) / ATLAS.height] as const;

// The blade's size in world units, its proportions the atlas rect's; a
// phone's wider lens draws it smaller, so it is longer there (`mobile`).
export const BLADE = { length: 1.1, mobile: 1.32, thick: .025, colour: '#245f63', edge: '#e9ecea' } as const;
export const bladeHeight = (length: number) => length * SIGN_RECT.height / SIGN_RECT.width;
// Each plaque's border, in its house's roof colour, darker.
const PLAQUE_BORDER = { amelia: '#3f6f69', patrick: '#b39a52' } as const;
const INK = '#1f2b33';
const SANS = '"Helvetica Neue", Helvetica, Arial, "Liberation Sans", sans-serif';

function roundRect(ctx: CanvasRenderingContext2D, { x, y, width, height }: Rect, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, r);
}
// Text as large as fits the box, centred in it.
function fitText(ctx: CanvasRenderingContext2D, text: string, font: (size: number) => string, box: Rect, size: number) {
  ctx.font = font(size);
  const scale = Math.min(1, box.width / ctx.measureText(text).width);
  ctx.font = font(size * scale);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, box.x + box.width / 2, box.y + box.height / 2 + size * scale * .04);
}

export function streetAtlas() {
  const canvas = Object.assign(document.createElement('canvas'), { width: ATLAS.width, height: ATLAS.height });
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(WHITE.x, WHITE.y, WHITE.width, WHITE.height);
  // The blade: the panel, a thin white border inset, and the name.
  const s = SIGN_RECT;
  ctx.fillStyle = BLADE.colour;
  ctx.fillRect(s.x, s.y, s.width, s.height);
  ctx.strokeStyle = BLADE.edge;
  ctx.lineWidth = 4;
  roundRect(ctx, { x: s.x + 6, y: s.y + 6, width: s.width - 12, height: s.height - 12 }, 9);
  ctx.stroke();
  ctx.fillStyle = BLADE.edge;
  fitText(ctx, 'Church St', size => `700 ${size}px ${SANS}`, { x: s.x + 22, y: s.y + 8, width: s.width - 44, height: s.height - 16 }, 86);
  // The plaques: white enamel, a border in the roof's colour, dark figures.
  for (const owner of ['amelia', 'patrick'] as const) {
    const r = NUMBER_RECTS[owner];
    ctx.fillStyle = PLAQUE_BORDER[owner];
    ctx.fillRect(r.x - 8, r.y - 8, r.width + 16, r.height + 16);
    ctx.fillStyle = '#f6f3ec';
    roundRect(ctx, { x: r.x + 5, y: r.y + 5, width: r.width - 10, height: r.height - 10 }, 9);
    ctx.fill();
    ctx.fillStyle = INK;
    fitText(ctx, HOUSE_NUMBERS[owner], size => `700 ${size}px ${SANS}`, { x: r.x + 10, y: r.y + 6, width: r.width - 20, height: r.height - 12 }, 140);
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  return map;
}

// The trunk below the tree's first branches (the distant ashes fork above 4).
const TRUNK = { radius: .8, top: 3.6 } as const;
// How far the blade's back stands off the bark where it touches, in world units.
export const SIGN_GAP = .004;
export type SignMount = { centre: THREE.Vector3; normal: THREE.Vector3; right: THREE.Vector3 };
// Where the blade goes on a tree (its model's branches, placed by `matrix`):
// flat against the trunk at `height` above the tree's foot (world units),
// facing horizontally `toward` a point. Its back is set against the bark's
// frontmost point within the blade's outline, so it touches the bark there and
// sinks into it nowhere; a flat blade on a round trunk stands off it towards
// its ends, as a real one does.
export function signMount(mesh: TreeMesh, matrix: THREE.Matrix4, toward: { x: number; z: number }, height: number, length: number): SignMount {
  // The trunk's middle at that height, from the vertices round it.
  const localY = height / new THREE.Vector3().setFromMatrixScale(matrix).x;
  let ax = 0, az = 0, n = 0;
  for (let i = 0; i < mesh.position.length; i += 3) {
    const x = mesh.position[i], y = mesh.position[i + 1], z = mesh.position[i + 2];
    if (Math.abs(y - localY) < .7 && y < TRUNK.top && Math.hypot(x, z) < TRUNK.radius) { ax += x; az += z; n++; }
  }
  const axis = new THREE.Vector3(ax / n, localY, az / n).applyMatrix4(matrix);
  const normal = new THREE.Vector3(toward.x - axis.x, 0, toward.z - axis.z).normalize();
  const right = new THREE.Vector3(0, 1, 0).cross(normal).normalize();
  const tall = bladeHeight(length);
  // The trunk's triangles, in the world.
  const triangles: THREE.Triangle[] = [];
  const at = (i: number) => new THREE.Vector3(mesh.position[i * 3], mesh.position[i * 3 + 1], mesh.position[i * 3 + 2]);
  for (let t = 0; t < mesh.index.length; t += 3) {
    const corners = [mesh.index[t], mesh.index[t + 1], mesh.index[t + 2]].map(at);
    if (corners.every(c => c.y < TRUNK.top && Math.hypot(c.x, c.z) < TRUNK.radius)) triangles.push(new THREE.Triangle(...corners.map(c => c.applyMatrix4(matrix)) as [THREE.Vector3, THREE.Vector3, THREE.Vector3]));
  }
  // The bark's frontmost point within the blade's outline: the trunk's
  // corners inside it, and rays from in front of it back towards the trunk
  // round and across it.
  let front = -Infinity;
  const up = new THREE.Vector3(0, 1, 0), offset = new THREE.Vector3();
  const inside = (point: THREE.Vector3) => {
    offset.copy(point).sub(axis);
    return Math.abs(offset.dot(right)) <= length / 2 && Math.abs(offset.y) <= tall / 2;
  };
  for (const { a, b, c } of triangles) for (const corner of [a, b, c]) if (inside(corner)) front = Math.max(front, offset.copy(corner).sub(axis).dot(normal));
  const ray = new THREE.Ray(), hit = new THREE.Vector3();
  for (let i = 0; i <= 40; i++) for (let j = 0; j <= 16; j++) {
    const origin = axis.clone().addScaledVector(right, (i / 40 - .5) * length).addScaledVector(up, (j / 16 - .5) * tall).addScaledVector(normal, 3);
    ray.set(origin, normal.clone().negate());
    for (const { a, b, c } of triangles) {
      if (ray.intersectTriangle(a, b, c, false, hit)) front = Math.max(front, hit.sub(axis).dot(normal));
    }
  }
  return { centre: axis.addScaledVector(normal, front + SIGN_GAP), normal, right };
}

// The blade on its mount: a thin panel in the sign's colour, its face
// carrying the atlas's blade, in world units. Vertex colours and UVs as the
// birdhouses', so it shares their material.
export function signGeometry({ centre, normal, right }: SignMount, length: number) {
  const tall = bladeHeight(length), up = new THREE.Vector3(0, 1, 0);
  const basis = new THREE.Matrix4().makeBasis(right, up, normal).setPosition(centre);
  const colour = (geometry: THREE.BufferGeometry, hex: string) => {
    const c = new THREE.Color(hex), colours = new Float32Array(geometry.attributes.position.count * 3);
    for (let i = 0; i < geometry.attributes.position.count; i++) c.toArray(colours, i * 3);
    geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    return geometry;
  };
  const body = new THREE.BoxGeometry(length, tall, BLADE.thick).translate(0, 0, BLADE.thick / 2).toNonIndexed();
  const uv = body.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, WHITE_UV[0], WHITE_UV[1]);
  colour(body, BLADE.colour);
  const face = new THREE.PlaneGeometry(length, tall).translate(0, 0, BLADE.thick + .001).toNonIndexed();
  const { u, v, w, h } = uvRect(SIGN_RECT), fuv = face.attributes.uv;
  for (let i = 0; i < fuv.count; i++) fuv.setXY(i, u + fuv.getX(i) * w, v + fuv.getY(i) * h);
  colour(face, '#ffffff');
  const geometry = mergeGeometries([body, face]);
  body.dispose(); face.dispose();
  return geometry.applyMatrix4(basis);
}
