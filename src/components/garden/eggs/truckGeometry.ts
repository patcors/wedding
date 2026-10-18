// The engagement's truck (placed in engagementTruck.ts): a 1940s Chevy
// pickup with its tray made into a whale-watching platform, as a low-poly
// toy. The rounded cab with its split windscreen, the domed bonnet and grille
// between round pontoon fenders, each with its own round headlamp, the dark
// wheels, and on the back a raised deck of weathered silver timber with
// railings round it, X-braced below the middle rail. One mesh with vertex
// colours; the paint's patina (pale cream gone sea-green in patches, and a
// lot of rust) is a small canvas (patinaTexture) mapped over the painted
// parts, which the timber, glass and tyres don't sample. It faces +z, the
// cab at the front, its tyres on y 0; about 2.4 long, .86 across and 1.04
// tall to the top rail, about 1,020 triangles.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TRUCK_WHEELS } from './engagementTruck.ts';

// The paint is white here, so the canvas shows true; everything else is its own colour.
const PAINT = '#ffffff', CHROME = '#8d8478', GLASS = '#a7b6b7', CAB_DARK = '#3d3430', GRILLE = '#2f2a26', LENS = '#e9e2c8';
const TYRE = '#2a2725', HUB = '#9a8a70', FRAME = '#3a332d';
const TIMBER = '#a2a29c', TIMBER_DARK = '#85847e', TIMBER_PALE = '#b3b3ad';
// Heights: the frame's top, the deck's top, the middle and top rails.
const FRAME_TOP = .34, DECK = .52, MID_RAIL = .78, TOP_RAIL = 1.02;
// The deck runs from the cab's back to the tail.
const DECK_FRONT = -.1, DECK_BACK = -1.2, DECK_WIDTH = .86;

// The painted parts take the canvas over the left three quarters of it,
// box-mapped from the model's bounds; everything else samples its white
// right-hand strip, so it shows its own colour.
const PATINA_SPAN = .75, PLAIN: readonly [number, number] = [.9, .5];
const BOUNDS = { x: [-.5, .5], y: [0, 1.1], z: [-1.25, 1.25] } as const;
const unit = (value: number, [low, high]: readonly [number, number]) => (value - low) / (high - low);

function painter() {
  const pieces: THREE.BufferGeometry[] = [];
  const c = new THREE.Color(), a = new THREE.Vector3(), b = new THREE.Vector3(), n = new THREE.Vector3();
  const add = (geometry: THREE.BufferGeometry, colour: string | ((face: number) => string), painted = false) => {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    if (g !== geometry) geometry.dispose();
    for (const name of Object.keys(g.attributes)) if (name !== 'position') g.deleteAttribute(name);
    const p = g.attributes.position, colours: number[] = [], uvs: number[] = [];
    for (let i = 0; i < p.count; i += 3) {
      c.set(typeof colour === 'string' ? colour : colour(i / 3));
      // Box-mapped by the face's facing, so the patina lies across each face.
      a.fromBufferAttribute(p, i + 1).sub(n.fromBufferAttribute(p, i));
      b.fromBufferAttribute(p, i + 2).sub(n);
      n.crossVectors(a, b);
      const [ax, ay, az] = [Math.abs(n.x), Math.abs(n.y), Math.abs(n.z)];
      for (let k = 0; k < 3; k++) {
        c.toArray(colours, (i + k) * 3);
        if (!painted) { uvs.push(...PLAIN); continue; }
        const x = unit(p.getX(i + k), BOUNDS.x), y = unit(p.getY(i + k), BOUNDS.y), z = unit(p.getZ(i + k), BOUNDS.z);
        const [u, v] = ax >= ay && ax >= az ? [z, y] : ay >= az ? [z, x] : [x, y];
        uvs.push(Math.min(1, Math.max(0, u)) * PATINA_SPAN, Math.min(1, Math.max(0, v)));
      }
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    pieces.push(g);
  };
  // A box `w` across, `h` tall and `d` long, its foot's middle at x, y, z.
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, colour: string, painted = false) =>
    add(new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z), colour, painted);
  // A slat from one point to another, `t` thick: the railings and their braces.
  const slat = (from: THREE.Vector3, to: THREE.Vector3, t: number, colour: string) => {
    const length = from.distanceTo(to);
    const g = new THREE.BoxGeometry(t, t, length);
    g.lookAt(to.clone().sub(from));
    add(g.translate((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2), colour);
  };
  const merge = () => {
    const geometry = mergeGeometries(pieces);
    pieces.forEach(piece => piece.dispose());
    geometry.computeVertexNormals();
    return geometry;
  };
  return { add, box, slat, merge };
}

// A side profile (z along, y up) extruded across x, `w` wide and centred.
function profile(points: readonly (readonly [number, number])[], w: number, curve?: (shape: THREE.Shape) => void) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (const [z, y] of points.slice(1)) shape.lineTo(z, y);
  curve?.(shape);
  shape.closePath();
  // The shape's x runs along the truck: turned so it lies along z.
  return new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false, curveSegments: 4 }).translate(0, 0, -w / 2).rotateY(-Math.PI / 2);
}

export function truckGeometry() {
  const { add, box, slat, merge } = painter();
  const { track, front, rear, radius, width: tyre } = TRUCK_WHEELS;
  // The wheels: dark tyres with a pale hub, the rear ones under the deck.
  // Ten-sided, each standing on a flat, its axle that far above the ground.
  const axle = radius * Math.cos(Math.PI / 10);
  for (const z of [front, rear]) {
    for (const side of [-1, 1]) {
      add(new THREE.CylinderGeometry(radius, radius, tyre, 10).rotateZ(Math.PI / 2).translate(side * track, axle, z), TYRE);
      add(new THREE.CylinderGeometry(radius * .45, radius * .45, .02, 6).rotateZ(Math.PI / 2).translate(side * (track + tyre / 2), axle, z), HUB);
    }
  }
  // The frame, and the bumper across the front.
  box(.5, .1, 2.2, 0, FRAME_TOP - .1, -.08, FRAME);
  box(.8, .07, .06, 0, .24, 1.15, CHROME);
  // The cab: a rounded roof over a split windscreen raked back, its back
  // upright against the deck.
  add(profile([[-.06, .3], [.38, .3], [.38, .66], [.3, .7], [.2, .98]], .74, shape => {
    shape.quadraticCurveTo(.12, 1.06, .02, 1.04);
    shape.quadraticCurveTo(-.06, 1.02, -.06, .92);
  }), PAINT, true);
  // Its windows: the windscreen's two panes, split down the middle, and a
  // dark side window either side.
  const rake = Math.atan2(.12, .28);
  for (const side of [-1, 1]) {
    add(new THREE.BoxGeometry(.31, .24, .012).rotateX(-rake).translate(side * .175, .845, .253), GLASS);
    box(.012, .2, .24, side * .372, .7, .1, CAB_DARK);
  }
  // The bonnet, domed across the top, narrower than the cab, and a dark
  // grille with three bright bars across it.
  add(profile([[.36, .3], [1.04, .3], [1.06, .56], [1.03, .64], [.36, .64]], .46), PAINT, true);
  add(new THREE.CylinderGeometry(.23, .23, .67, 8, 1, false, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2).scale(1, .32, 1).translate(0, .64, .695), PAINT, true);
  box(.3, .26, .03, 0, .33, 1.06, GRILLE);
  for (const y of [.39, .47, .55]) box(.32, .022, .02, 0, y, 1.08, CHROME);
  // Round pontoon fenders over the front wheels, sweeping back to the
  // running boards, each with its own round headlamp beside the grille.
  for (const side of [-1, 1]) {
    add(new THREE.SphereGeometry(1, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(.13, .26, .42).translate(side * .36, .32, front + .06), PAINT, true);
    box(.14, .03, .5, side * .38, .28, .14, CHROME);
    // The lamp on the fender, its pale lens to the front.
    add(new THREE.CylinderGeometry(.06, .065, .07, 8).rotateX(Math.PI / 2).translate(side * .3, .55, .97), PAINT, true);
    add(new THREE.CircleGeometry(.05, 8).translate(side * .3, .55, 1.006), LENS);
  }
  // The deck: a bed of weathered timber over its beams.
  box(DECK_WIDTH + .02, DECK - .07 - FRAME_TOP, DECK_FRONT - DECK_BACK + .02, 0, FRAME_TOP, (DECK_FRONT + DECK_BACK) / 2, TIMBER_DARK);
  box(DECK_WIDTH, .07, DECK_FRONT - DECK_BACK, 0, DECK - .07, (DECK_FRONT + DECK_BACK) / 2, TIMBER_PALE);
  // Its railings: a post at each corner and halfway along each side, a top
  // and a middle rail round the sides and back, and a top rail across the
  // front against the cab; below the middle rail each panel is braced with an X.
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const half = DECK_WIDTH / 2 - .025, middle = (DECK_FRONT + DECK_BACK) / 2;
  for (const side of [-1, 1]) for (const z of [DECK_FRONT - .025, middle, DECK_BACK + .025]) box(.05, TOP_RAIL - DECK + .02, .05, side * half, DECK, z, TIMBER);
  const corners = [v(-half, 0, DECK_FRONT - .025), v(-half, 0, DECK_BACK + .025), v(half, 0, DECK_BACK + .025), v(half, 0, DECK_FRONT - .025)];
  for (let i = 0; i < 3; i++) {
    const [from, to] = [corners[i], corners[i + 1]];
    for (const y of [MID_RAIL, TOP_RAIL]) slat(from.clone().setY(y), to.clone().setY(y), .045, i === 1 ? TIMBER_PALE : TIMBER);
  }
  slat(corners[3].clone().setY(TOP_RAIL), corners[0].clone().setY(TOP_RAIL), .045, TIMBER);
  // The X braces, a panel either side of each side's middle post and one across the back.
  const panels: [THREE.Vector3, THREE.Vector3][] = [];
  for (const side of [-1, 1]) {
    panels.push([v(side * half, 0, DECK_FRONT - .025), v(side * half, 0, middle)], [v(side * half, 0, middle), v(side * half, 0, DECK_BACK + .025)]);
  }
  panels.push([corners[1], corners[2]]);
  for (const [from, to] of panels) {
    slat(from.clone().setY(DECK + .02), to.clone().setY(MID_RAIL - .02), .03, TIMBER_DARK);
    slat(to.clone().setY(DECK + .02), from.clone().setY(MID_RAIL - .02), .03, TIMBER_DARK);
  }
  return merge();
}

// The paint's patina, for the left three quarters of a small canvas: pale
// cream gone grey, worn through to sea-green in soft washes, and a lot of
// rust, thickest low down where the water sat: soft blooms with dark hearts,
// flecks, and streaks running down. The canvas's foot is the truck's (the
// sides are mapped with y up). The right quarter is white, for the parts
// that show their own colour.
export function patinaTexture() {
  const size = 128, canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d')!;
  const span = size * PATINA_SPAN;
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  // Low down more often: rust gathers along the sills and the fenders' skirts.
  const low = () => size * (1 - rand() * rand());
  g.fillStyle = '#d4cebb';
  g.fillRect(0, 0, span, size);
  // A soft-edged patch, its colour fading out to nothing.
  const wash = (x: number, y: number, r: number, colour: string, alpha: number) => {
    const fill = g.createRadialGradient(x, y, 0, x, y, r);
    fill.addColorStop(0, colour);
    fill.addColorStop(1, `${colour}00`);
    g.globalAlpha = alpha;
    g.fillStyle = fill;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  };
  for (let i = 0; i < 18; i++) wash(rand() * span, rand() * size, 4 + rand() * 10, '#bdbfb0', .7);
  for (let i = 0; i < 16; i++) wash(rand() * span, rand() * size, 8 + rand() * 14, '#6f9e8b', .85);
  for (let i = 0; i < 46; i++) {
    const x = rand() * span, y = low(), r = 3 + rand() * 8;
    wash(x, y, r, '#b8622f', .9);
    wash(x, y, r * .45, '#7e3f20', .8);
  }
  // Flecks of rust through the paint, and streaks running down from them.
  g.globalAlpha = .75;
  for (let i = 0; i < 140; i++) {
    g.fillStyle = rand() < .5 ? '#8a4524' : '#a95f34';
    g.fillRect(rand() * span, low(), 1 + rand() * 1.5, 1 + rand() * 1.5);
  }
  g.globalAlpha = .4;
  g.fillStyle = '#93502c';
  for (let i = 0; i < 24; i++) g.fillRect(rand() * span, rand() * size * .7, 1, 6 + rand() * 18);
  g.globalAlpha = 1;
  g.fillStyle = '#ffffff';
  g.fillRect(span, 0, size - span, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
