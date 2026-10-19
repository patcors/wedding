// The apartments' birdhouses and birds (see nesting.ts). Each birdhouse is a
// little box on a post with a pitched roof, a round door and a peg to perch
// on, facing +z and standing on y 0, about 1.3 tall: Amelia's wooden with a
// teal roof, Patrick's soft yellow with a cream one, as their boats are. On
// its post, under the house, is its number on a little enamel plaque (29 and
// 54; the plaques are drawn in streetSign.ts's atlas). Scaffolding, a ladder
// and a paint pot go up round Patrick's while he renovates (about 130
// triangles). Both houses and the scaffolding are one mesh with vertex
// colours and the atlas, 320 triangles. The birds are a few flat
// triangles each, a body, a tail, a beak and two wings that fold and flap,
// rewritten each frame into one mesh.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { NUMBER_RECTS, WHITE_UV, uvRect } from './streetSign.ts';

type Point = [number, number, number];
type Owner = 'amelia' | 'patrick';
type Rect = Parameters<typeof uvRect>[0];
const POST = '#75644f', HOLE = '#2f2924', PEG = '#5d5142';
const HOUSE_COLOURS: Record<Owner, { walls: string; roof: string }> = {
  amelia: { walls: '#c99f65', roof: '#6f9e96' },
  patrick: { walls: '#e6cf86', roof: '#f1e6c8' },
};
// The house's body, how high it sits on its post, and where birds perch on
// its roof, side by side either side of the ridge as seen from the front:
// its own bird on the left, a guest on the right.
const BODY = { width: .34, height: .3, depth: .3, floor: .82 };
const RIDGE = BODY.floor + BODY.height + .14, PITCH = (RIDGE - BODY.floor - BODY.height) / (BODY.width / 2);
const onRoof = (x: number, z: number): Point => [x, RIDGE + .025 - Math.abs(x) * PITCH, z];
// The number plaque on the front of the post, under the house: its middle's
// height, and its width (its height follows from the atlas).
export const PLAQUE = { y: .6, width: .36, thick: .012 } as const;
export const BIRDHOUSE = { perches: { home: onRoof(-.07, .03), guest: onRoof(.08, 0) }, height: RIDGE, post: .06 };

function painter() {
  const pieces: THREE.BufferGeometry[] = [];
  const c = new THREE.Color();
  // Paints a piece in a colour, and maps its own 0–1 UVs onto `rect` of the
  // atlas, or all of it onto the atlas's plain white.
  const add = (geometry: THREE.BufferGeometry, colour: string, rect?: Rect) => {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    if (g !== geometry) geometry.dispose();
    const colours: number[] = [], uv = g.attributes.uv, area = rect && uvRect(rect);
    c.set(colour);
    for (let i = 0; i < g.attributes.position.count; i++) {
      c.toArray(colours, i * 3);
      if (area) uv.setXY(i, area.u + uv.getX(i) * area.w, area.v + uv.getY(i) * area.h);
      else uv.setXY(i, WHITE_UV[0], WHITE_UV[1]);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
    pieces.push(g);
  };
  const merge = () => {
    const geometry = mergeGeometries(pieces);
    pieces.forEach(piece => piece.dispose());
    return geometry;
  };
  // A box from a to b, as for posts, rails and planks.
  const beam = (a: Point, b: Point, thick: number, colour: string) => {
    const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), length = from.distanceTo(to);
    const g = new THREE.BoxGeometry(thick, length, thick).translate(0, length / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize()));
    add(g.translate(...a), colour);
  };
  return { add, merge, beam };
}

// One house, in its own frame.
function house(owner: Owner, add: ReturnType<typeof painter>['add'], beam: ReturnType<typeof painter>['beam']) {
  const { walls, roof } = HOUSE_COLOURS[owner], { width, height, depth, floor } = BODY;
  // Sunk into the ground, so it stands on any slope.
  beam([0, -.3, 0], [0, floor, 0], BIRDHOUSE.post, POST);
  add(new THREE.BoxGeometry(width, height, depth).translate(0, floor + height / 2, 0), walls);
  // The gables, front and back, up to the ridge.
  const top = floor + height, gable = new THREE.Shape([new THREE.Vector2(-width / 2, top), new THREE.Vector2(width / 2, top), new THREE.Vector2(0, RIDGE - .01)]);
  for (const z of [depth / 2, -depth / 2]) {
    const g = new THREE.ShapeGeometry(gable);
    if (z < 0) g.rotateY(Math.PI);
    add(g.translate(0, 0, z), walls);
  }
  // Two roof slabs meeting at the ridge, overhanging the walls.
  const slope = Math.atan2(RIDGE - top, width / 2), length = Math.hypot(RIDGE - top, width / 2) + .06;
  for (const side of [-1, 1]) {
    const g = new THREE.BoxGeometry(length, .025, depth + .08).translate(side * length / 2, 0, 0).rotateZ(side * -slope);
    add(g.translate(0, RIDGE + .012, 0), roof);
  }
  // The round door and the peg under it.
  add(new THREE.CircleGeometry(.055, 10).translate(0, floor + height * .55, depth / 2 + .002), HOLE);
  add(new THREE.CylinderGeometry(.012, .012, .09, 5).rotateX(Math.PI / 2).translate(0, floor + .06, depth / 2 + .045), PEG);
  // Its number, on a plaque screwed to the front of the post.
  const rect = NUMBER_RECTS[owner], tall = PLAQUE.width * rect.height / rect.width, front = BIRDHOUSE.post / 2;
  add(new THREE.BoxGeometry(PLAQUE.width, tall, PLAQUE.thick).translate(0, PLAQUE.y, front + PLAQUE.thick / 2), roof);
  add(new THREE.PlaneGeometry(PLAQUE.width, tall).translate(0, PLAQUE.y, front + PLAQUE.thick + .001), '#ffffff', rect);
}

export type PlacedHouse = { x: number; y: number; z: number; yaw: number; scale: number };
// The parts of the birdhouses' mesh: each house's vertices, and the
// scaffolding's, with the height each stands on, so each can be raised out
// of the ground (or the scaffolding taken down) by scaling it up from there.
export type BirdhousePart = { start: number; count: number; foot: number };
// Both houses and the scaffolding round Patrick's in one mesh, in world units.
export function birdhousesGeometry(houses: Record<Owner, PlacedHouse>) {
  const placed: THREE.BufferGeometry[] = [], parts: Record<Owner | 'scaffold', BirdhousePart> = {} as never;
  let start = 0;
  const place = (geometry: THREE.BufferGeometry, spot: PlacedHouse, name: Owner | 'scaffold') => {
    geometry.scale(spot.scale, spot.scale, spot.scale).rotateY(spot.yaw).translate(spot.x, spot.y, spot.z);
    parts[name] = { start, count: geometry.attributes.position.count, foot: spot.y };
    start += geometry.attributes.position.count;
    placed.push(geometry);
  };
  for (const owner of ['amelia', 'patrick'] as const) {
    const { add, merge, beam } = painter();
    house(owner, add, beam);
    place(merge(), houses[owner], owner);
  }
  place(scaffoldGeometry(), houses.patrick, 'scaffold');
  const geometry = mergeGeometries(placed);
  placed.forEach(piece => piece.dispose());
  geometry.computeVertexNormals();
  return { geometry, parts };
}

// Scaffolding round Patrick's house while he renovates, in the house's frame:
// two poles and a plank across the front, a brace, a ladder leaning on its
// post and a pot of his yellow paint at its foot.
function scaffoldGeometry() {
  const { add, merge, beam } = painter(), POLE = '#a89878', PLANK = '#b08f62';
  const front = BODY.depth / 2 + .1;
  for (const x of [-.27, .27]) beam([x, -.1, front], [x, RIDGE - .05, front], .025, POLE);
  beam([-.27, .5, front], [.27, 1.05, front], .018, POLE);
  add(new THREE.BoxGeometry(.66, .022, .1).translate(0, BODY.floor - .1, front), PLANK);
  // The ladder against the post's side.
  const rail = (dz: number): [Point, Point] => [[.42, -.05, dz], [.07, BODY.floor - .05, dz]];
  for (const dz of [-.06, .06]) beam(...rail(dz), .018, POLE);
  for (let i = 1; i <= 3; i++) {
    const k = i / 4, [[ax, ay], [bx, by]] = rail(0);
    add(new THREE.BoxGeometry(.016, .016, .13).translate(ax + (bx - ax) * k, ay + (by - ay) * k, 0), POLE);
  }
  // The paint pot, its lid off and yellow inside.
  add(new THREE.CylinderGeometry(.05, .045, .08, 8, 1, true).translate(.5, .04, .22), '#cfd2d1');
  add(new THREE.CircleGeometry(.048, 8).rotateX(-Math.PI / 2).translate(.5, .07, .22), '#e8c95e');
  return merge();
}

// The birds: Patrick's soft yellow, Amelia's teal with wooden wings.
export const BIRD_COLOURS: Record<Owner, { body: string; wings: string }> = {
  patrick: { body: '#ecc95a', wings: '#d2a944' },
  amelia: { body: '#5f9a92', wings: '#b98a55' },
};
const BEAK = '#c27b34';
// A bird's shape, facing +z with its feet on y 0, about .2 long at scale 1:
// a body of eight faces, a tail, a beak, and two wings.
const BODY_POINTS = { nose: [0, .06, .1], tail: [0, .055, -.09], top: [0, .1, 0], belly: [0, 0, 0], left: [-.04, .05, 0], right: [.04, .05, 0] } as const;
const BODY_FACES = [['nose', 'top', 'left'], ['nose', 'right', 'top'], ['nose', 'left', 'belly'], ['nose', 'belly', 'right'],
  ['tail', 'left', 'top'], ['tail', 'top', 'right'], ['tail', 'belly', 'left'], ['tail', 'right', 'belly']] as const;
export const BIRD_TRIANGLES = BODY_FACES.length + 1 + 2 + 2;

// The geometry for `owners.length` birds, coloured; positions come from writeBird.
export function birdsGeometry(owners: Owner[]) {
  const vertices = owners.length * BIRD_TRIANGLES * 3, colours = new Float32Array(vertices * 3), c = new THREE.Color();
  owners.forEach((owner, b) => {
    const { body, wings } = BIRD_COLOURS[owner];
    const parts = [...Array(BODY_FACES.length + 1).fill(body), BEAK, BEAK, wings, wings];
    parts.forEach((colour, f) => { c.set(colour); for (let v = 0; v < 3; v++) c.toArray(colours, ((b * BIRD_TRIANGLES + f) * 3 + v) * 3); });
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices * 3), 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  return geometry;
}

const local = new THREE.Vector3(), turn = new THREE.Matrix4();
// Writes bird `b` into the positions: at `at`, facing `heading` (yaw, +z at
// 0), `scale` large. `open` spreads its wings from folded (0) to flying (1),
// and `flap` beats them, −1 to 1; a bird not `shown` is folded away to nothing.
export function writeBird(positions: Float32Array, b: number, at: { x: number; y: number; z: number }, heading: number, scale: number, open: number, flap: number, shown: boolean) {
  turn.makeRotationY(heading).scale(local.setScalar(shown ? scale : 0)).setPosition(at.x, at.y, at.z);
  let i = b * BIRD_TRIANGLES * 9;
  const put = (p: readonly number[]) => {
    local.set(p[0], p[1], p[2]).applyMatrix4(turn);
    positions[i++] = local.x; positions[i++] = local.y; positions[i++] = local.z;
  };
  for (const face of BODY_FACES) face.forEach(name => put(BODY_POINTS[name]));
  const { tail, nose } = BODY_POINTS;
  put(tail); put([-.035, .085, -.16]); put([.035, .085, -.16]);
  // The beak, a little wedge at the nose.
  put([0, nose[1] + .012, nose[2] - .005]); put([0, nose[1] - .01, nose[2] + .035]); put([-.012, nose[1], nose[2]]);
  put([0, nose[1] + .012, nose[2] - .005]); put([.012, nose[1], nose[2]]); put([0, nose[1] - .01, nose[2] + .035]);
  // Wings: folded along the back, or spread from the shoulder and beating.
  for (const side of [-1, 1]) {
    const angle = open * (.35 + .75 * flap);
    const span = .045 + .13 * open, sweep = -.09 + .07 * open;
    const tip = [side * span * Math.cos(angle), .085 + span * Math.sin(angle), sweep];
    put([side * .03, .085, .035]); put([side * .03, .085, -.045]); put(tip);
  }
}
