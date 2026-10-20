// Sydney's miniatures (see harbour.ts): the Opera House, its white shells on
// a podium, and the Harbour Bridge, the grey steel through-arch with its deck
// hung from it between a pair of granite pylons at each end. Each is one
// mesh in vertex colours, built in the world where it stands, so they cost
// two draw calls; the bridge's truss members are flat strips in the planes of
// its two arches, so the material draws both sides.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { random } from '../gardenGeometry.ts';
import { OPERA, archAt, harbourBridge, operaHouseSpot, type HarbourBridge } from './harbour.ts';

type V = THREE.Vector3;
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const TILE = '#f3f0e6', TILE_SHADE = '#e6e1d4', GLASS = '#6f5d4a', PODIUM = '#a88f7a', STEPS = '#b9a28c';
// The bridge's steel is a dark grey (Amelia, October 2026: it read too pale;
// it was #6f797d, #5f686c and the road #4f5354).
const GRANITE = '#aaa395', GRANITE_LIGHT = '#bab3a5', GRANITE_DARK = '#8f897e', STEEL = '#4a5155', STEEL_DARK = '#3b4144', ROAD = '#3a3d3e';

// Pieces in vertex colours, each a shade lighter or darker face by face so it
// looks weathered rather than new, merged into one geometry. Each keeps the
// normals it comes with: smooth over a shell, flat elsewhere.
function painter(seed: number) {
  const pieces: THREE.BufferGeometry[] = [], rand = random(seed), c = new THREE.Color();
  const add = (geometry: THREE.BufferGeometry, colour: string | ((normal: V, centre: V) => string), jitter = .04, smooth = false) => {
    if (!smooth) geometry.deleteAttribute('normal');
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    if (g !== geometry) geometry.dispose();
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    if (!g.attributes.normal) g.computeVertexNormals();
    const p = g.attributes.position, n = g.attributes.normal, colours = new Float32Array(p.count * 3);
    const normal = v(0, 0, 0), centre = v(0, 0, 0);
    for (let i = 0; i < p.count; i += 3) {
      normal.set(n.getX(i) + n.getX(i + 1) + n.getX(i + 2), n.getY(i) + n.getY(i + 1) + n.getY(i + 2), n.getZ(i) + n.getZ(i + 1) + n.getZ(i + 2)).normalize();
      centre.set((p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3, (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3);
      c.set(typeof colour === 'string' ? colour : colour(normal, centre)).multiplyScalar(1 + (rand() - .5) * 2 * jitter);
      for (let k = 0; k < 3; k++) c.toArray(colours, (i + k) * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    pieces.push(g);
  };
  // A flat four-cornered strip, in order round its edge.
  const quad = (a: V, b: V, c2: V, d: V, colour: string, jitter = .03) => {
    const g = new THREE.BufferGeometry().setFromPoints([a, b, c2, a, c2, d]);
    add(g, colour, jitter);
  };
  const merge = () => {
    const geometry = mergeGeometries(pieces)!;
    pieces.forEach(piece => piece.dispose());
    return geometry;
  };
  return { add, quad, merge };
}

// A box from y0 to y1 about (x, z), `w` across x and `d` along z, its top
// `taper` of its foot, turned `yaw` about its own middle; no underside.
function block(w: number, d: number, y0: number, y1: number, taper = 1) {
  const g = new THREE.BoxGeometry(w, y1 - y0, d).translate(0, (y0 + y1) / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > (y0 + y1) / 2) p.setXYZ(i, p.getX(i) * taper, p.getY(i), p.getZ(i) * taper);
  // Drop the two faces underneath (BoxGeometry's −y group).
  const index = Array.from(g.index!.array), bottom = g.groups[3];
  g.setIndex(index.filter((_, i) => i < bottom.start || i >= bottom.start + bottom.count));
  g.clearGroups();
  return g;
}

// One of the Opera House's shells, its open mouth facing −z: a curved
// triangle of tiles each side of the ridge, the ridge arching from the apex,
// which leans out over its mouth (`lean` of its height forward), back and
// down to a foot behind (`d`), and the front edge curving down from the
// apex to a foot at each side, as a pointed arch; each side swells
// outwards between them. Bronze-tinted glass fills its mouth, set back a
// little. In the model's units, standing on y 0.
const SHELL_ROWS = 4, SHELL_COLUMNS = 3;
function shell(paint: ReturnType<typeof painter>, w: number, h: number, d: number, lean: number, at: THREE.Matrix4) {
  const apex = v(0, h, -lean * h), back = v(0, 0, d);
  const bezier = (a: V, c: V, b: V, u: number) => a.clone().multiplyScalar((1 - u) ** 2).addScaledVector(c, 2 * u * (1 - u)).addScaledVector(b, u * u);
  const ridge = (u: number) => bezier(apex, v(0, h * 1.02, d * .55), back, u);
  const front = (side: number, u: number) => bezier(apex, v(side * w * .52, h * .62, -lean * h * .35), v(side * w / 2, 0, 0), u);
  for (const side of [-1, 1]) {
    const out = v(side * .8, .6, .1).normalize(), positions: number[] = [], index: number[] = [];
    for (let i = 0; i <= SHELL_ROWS; i++) for (let j = 0; j <= SHELL_COLUMNS; j++) {
      const u = i / SHELL_ROWS, t = j / SHELL_COLUMNS;
      const p = ridge(u).lerp(front(side, u), t).addScaledVector(out, .1 * Math.max(w, h) * Math.sin(Math.PI * t) * Math.sin(Math.PI * Math.min(1, u * 1.15 + .05)));
      positions.push(...p.toArray());
      if (i < SHELL_ROWS && j < SHELL_COLUMNS) {
        const a = i * (SHELL_COLUMNS + 1) + j, b = a + 1, c = a + SHELL_COLUMNS + 1, e = c + 1;
        index.push(a, c, b, b, c, e);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(index);
    g.computeVertexNormals();
    g.applyMatrix4(at);
    paint.add(g, (normal) => normal.y > .5 ? TILE : TILE_SHADE, .025, true);
  }
  // The glass wall across its mouth, between the two front edges.
  const glass: V[] = [], set = v(0, 0, .04 * h);
  for (let i = 0; i < SHELL_ROWS; i++) {
    const [a, b, c, e] = [front(-1, i / SHELL_ROWS), front(-1, (i + 1) / SHELL_ROWS), front(1, (i + 1) / SHELL_ROWS), front(1, i / SHELL_ROWS)].map(p => p.add(set).applyMatrix4(at));
    glass.push(a, b, c, a, c, e);
  }
  paint.add(new THREE.BufferGeometry().setFromPoints(glass), GLASS, .05);
}

// The Opera House, a unit long along z with its harbour front to −z: a
// podium of pink granite with the broad stairs up its landward end, the
// Concert Hall's shells on its western side and the smaller theatre's
// beside them, each three shells facing the harbour rising one behind
// another and one facing back, and the restaurant's two little shells by
// the stairs. Its podium runs down to `foot` (model units) so it is seated
// on the rock however the rock falls away under it.
const PODIUM_TOP = .07;
export function operaHouseGeometry(foot: number, at: THREE.Matrix4) {
  const paint = painter(2101);
  const { width } = OPERA, podium = PODIUM_TOP, half = width / 2;
  paint.add(block(width, .8, foot, podium).translate(0, 0, -.1).applyMatrix4(at), PODIUM, .03);
  // The stairs: a wedge from the podium's top down to its foot at the back.
  const stair = [v(-half, podium, .3), v(half, podium, .3), v(half, foot, .5), v(-half, foot, .5)].map(p => p.applyMatrix4(at));
  paint.quad(stair[0], stair[3], stair[2], stair[1], STEPS);
  for (const s of [-1, 1]) {
    const [a, b, c] = [v(s * half, podium, .3), v(s * half, foot, .5), v(s * half, foot, .3)].map(p => p.applyMatrix4(at));
    paint.add(new THREE.BufferGeometry().setFromPoints([a, b, c]), PODIUM, .03);
  }
  const place = (x: number, z: number, facing: number) =>
    at.clone().multiply(new THREE.Matrix4().makeRotationY(facing).setPosition(x, podium - .005, z));
  // Each hall's shells, front to back: [z, width, height, depth, lean, facing].
  const HALL: [number, number, number, number, number, number][] = [
    [-.32, .3, .3, .16, .55, 0], [-.18, .34, .42, .2, .5, 0], [0, .32, .36, .18, .45, 0], [.18, .26, .24, .14, .4, Math.PI],
  ];
  for (const [x, k] of [[-.155, 1], [.165, .84]]) {
    for (const [z, w, h, d, lean, facing] of HALL) shell(paint, w * k, h * k, d * k, lean, place(x, z * k, facing));
  }
  shell(paint, .15, .13, .08, .45, place(-.22, .3, 0));
  shell(paint, .13, .1, .07, .4, place(-.22, .33, Math.PI));
  return paint.merge();
}

// The bridge, in the world (see harbourBridge). Each pylon is a tapering
// granite tower with a band near its top and a cap, standing either side of
// the deck; a low plinth between each pair carries the arch's bearings. The
// two arches, one each side of the deck, are a top and a bottom chord with
// posts and diagonals between them, braced across the top, and the deck
// hangs from the bottom chords where they rise above it.
export function harbourBridgeGeometry(bridge: HarbourBridge) {
  const paint = painter(2203);
  const { z, size, pylons, near, far, deck, top } = bridge;
  const { across, along, above } = size.pylon, peak = top + above;
  // Each pylon: a base course, the tapering shaft, a band of darker
  // courses near its top, and a cap stepped in from it.
  const shaft = (y: number) => 1 - .1 * (y - deck * .2) / (peak - deck * .2);
  for (const { x, z: pz, foot } of pylons) {
    const tower = (y0: number, y1: number, inset: number, colour: string) =>
      paint.add(block(across * shaft(y0) * inset, along * shaft(y0) * inset, y0, y1, shaft(y1) / shaft(y0)).translate(x, 0, pz), colour, .04);
    tower(foot, deck * .2, 1.06, GRANITE_DARK);
    tower(deck * .2, peak - .24, 1, GRANITE);
    tower(peak - .24, peak - .1, 1.03, GRANITE_LIGHT);
    tower(peak - .1, peak, .86, GRANITE_DARK);
  }
  // The plinths between each pair, up to the bearings, a little proud of the pylons' inner faces.
  for (const x of [near, far]) {
    const foot = Math.min(...pylons.filter(p => p.x === x).map(p => p.foot)), inward = Math.sign(near - far) * (x === near ? -1 : 1);
    paint.add(block(across + .08, size.half * 2 + .04, foot, size.bearing + .05).translate(x + inward * .04, 0, z), GRANITE_DARK, .04);
  }
  // The deck, from one pair's outer faces to the other's, its road on top.
  const left = Math.min(near, far) - across / 2, right = Math.max(near, far) + across / 2;
  paint.add(block(right - left, size.half * 2, deck, top).translate((left + right) / 2, 0, z), (normal) => normal.y > .5 ? ROAD : STEEL_DARK, .03);
  // The arches, each in the plane of a side of the deck.
  const panels = size.panels, chord = size.member * 2.4, rib = size.half - .03;
  const nodes = Array.from({ length: panels + 1 }, (_, i) => archAt(bridge, i / panels));
  // A chord as a square-sectioned tube through points in the plane at z.
  const tube = (points: { x: number; y: number }[], z0: number, h: number, colour: string) => {
    const at = (i: number) => {
      const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
      const tx = b.x - a.x, ty = b.y - a.y, l = Math.hypot(tx, ty);
      return { x: points[i].x, y: points[i].y, nx: -ty / l * h / 2, ny: tx / l * h / 2 };
    };
    for (let i = 0; i < points.length - 1; i++) {
      const a = at(i), b = at(i + 1), w = size.member * .6;
      const corner = (p: typeof a, s: number, t: number) => v(p.x + s * p.nx, p.y + s * p.ny, z0 + t * w);
      for (const [s0, t0, s1, t1] of [[1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1], [-1, -1, 1, -1]]) {
        paint.quad(corner(a, s0, t0), corner(b, s0, t0), corner(b, s1, t1), corner(a, s1, t1), colour, .03);
      }
    }
  };
  // A thin flat member between two points in the plane at z.
  const member = (a: { x: number; y: number }, b: { x: number; y: number }, z0: number, w: number, colour: string) => {
    const l = Math.hypot(b.x - a.x, b.y - a.y), nx = -(b.y - a.y) / l * w / 2, ny = (b.x - a.x) / l * w / 2;
    paint.quad(v(a.x + nx, a.y + ny, z0), v(b.x + nx, b.y + ny, z0), v(b.x - nx, b.y - ny, z0), v(a.x - nx, a.y - ny, z0), colour);
  };
  for (const s of [-1, 1]) {
    const z0 = z + s * rib;
    tube(nodes.map(n => ({ x: n.x, y: n.top })), z0, chord, STEEL);
    tube(nodes.map(n => ({ x: n.x, y: n.bottom })), z0, chord * 1.2, STEEL);
    nodes.forEach((n, i) => {
      if (i > 0 && i < panels) member({ x: n.x, y: n.bottom }, { x: n.x, y: n.top }, z0, size.member, STEEL_DARK);
      const next = nodes[i + 1];
      // Crossed diagonals in each panel, so the truss reads dense, as the
      // real arch's does from across the harbour.
      if (next) {
        member({ x: n.x, y: n.bottom }, { x: next.x, y: next.top }, z0, size.member * .8, STEEL_DARK);
        member({ x: n.x, y: n.top }, { x: next.x, y: next.bottom }, z0, size.member * .6, STEEL_DARK);
      }
      // Hangers down to the deck where the bottom chord is above it.
      if (n.bottom > top + .08) member({ x: n.x, y: top }, { x: n.x, y: n.bottom }, z0, size.member * .5, STEEL_DARK);
    });
  }
  // Bracing across the tops of the two arches.
  nodes.slice(1, -1).forEach(n => paint.quad(v(n.x - .02, n.top + chord / 2, z - rib), v(n.x + .02, n.top + chord / 2, z - rib), v(n.x + .02, n.top + chord / 2, z + rib), v(n.x - .02, n.top + chord / 2, z + rib), STEEL_DARK));
  return paint.merge();
}

// Both, where they stand on a composition: the Opera House and the bridge,
// a geometry each, as they leave the picture at different times.
export function harbourGeometry(width: number) {
  const spot = operaHouseSpot(width);
  const at = new THREE.Matrix4().compose(new THREE.Vector3(spot.x, spot.y, spot.z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), spot.yaw), new THREE.Vector3().setScalar(spot.scale));
  const opera = operaHouseGeometry(spot.foot, at), bridge = harbourBridgeGeometry(harbourBridge(width));
  opera.computeBoundingSphere(); bridge.computeBoundingSphere();
  return { opera, bridge };
}
