// PROTOTYPE: deterministic botanical geometry for the /garden visual study.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { DATES, ROUTE, routeAtMonth } from './journey.ts';

export function random(seed: number) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// The camera rides `behind` the boats and looks `ahead` of them down the river
// (see cameraRig.ts). Nothing past the fog is drawn: `far` and `mobileFar`
// clear the fog's far distance on each composition.
export const GARDEN_CAMERA = { fov: 48, mobileFov: 68, height: 3.2, startZ: ROUTE.start + 12, targetY: 2.5, behind: 12, ahead: 34, far: 115, mobileFar: 90 };
// Portrait uses the same irregular shoreline as desktop, at a smaller scale,
// plus a bend at the start (see bankSwing).
export const MOBILE_RIVER_WIDTH = .45;

// How far a bank swings out into the river, peaking at `peak` and easing off
// over `near` units towards the camera and `far` units downstream.
function bankSwing(z: number, amount: number, peak: number, near: number, far: number) {
  return amount * Math.exp(-(((z - peak) / (z > peak ? near : far)) ** 2));
}

// In portrait the start of the river would run off both sides of a narrow
// screen, so both banks come into frame in a bend: the right bank swings well
// in, the left a little nearer the camera. The bottom of the screen stays open.
const rightSwing = (z: number, width: number) => width < 1 ? bankSwing(z, 2.8, 11, 2.7, 5) : 0;
const leftSwing = (z: number, width: number) => width < 1 ? bankSwing(z, 1, 12, 2.2, 2.2) : 0;

// Where the Voyage's scenery sits along the river; z falls downstream, so each
// stretch runs `from` its upstream end `to` its downstream end. The island
// splits the river from just below the opening view until shortly before they
// meet; in portrait its head starts lower, beside the little jetties, since
// the bend at the start (see bankSwing) pinches the river where it would
// begin on desktop and its reeds would close the left channel against the
// bank's. The river widens while Amelia is in Sydney, and where the boats
// first part for it a low sandstone rock stands in its middle, so they go
// either side of it (see rockHalfWidth), with the Harbour Bridge across
// Amelia's channel from it to her bank, at `bridge` (see eggs/harbour.ts).
// Further down, across from 2022's pile, a little sandstone point juts from
// her bank, Bennelong Point, for the Opera House to stand on (`point`, see
// pointSpot). The S-bend swings the river
// sideways by `swing` just before the wedding; the jetty and the old tree stand
// on the `side` bank (+1 is +x) past it, where the boats dock. Far off past
// the bend, where the river runs straight again, a level lawn lies in an
// open field back from the left bank, for July 2026's Hagia Sophia (see
// lawnSpot).
const MEET_Z = routeAtMonth(DATES.meet);
export const VOYAGE = {
  island: { from: 10, mobileFrom: 7.2, to: MEET_Z + 3, halfWidth: 1.5 },
  meet: MEET_Z,
  sydney: { from: routeAtMonth(DATES.sydney), to: routeAtMonth(DATES.back), widen: 2.2 },
  rock: { from: -53.6, to: -61.3, halfWidth: 1.25, mobileHalfWidth: .64, bridge: -60.1 },
  point: { z: -77.5, side: -1, out: 1.7, back: .72, wide: 1.95, mobile: { z: -78.3, out: .2, back: 1.1, wide: 1.15 } },
  bend: { from: -135, to: -164, swing: -12 },
  dock: { z: ROUTE.dock, side: 1, jetty: 2.4 },
  tree: { z: ROUTE.dock - 3.5, inland: 3.5 },
  lawn: { z: -202, side: -1, inland: 10, mobileInland: 7.5, radius: 7.1, mobileRadius: 5, ease: 1, field: 15, mobileField: 12 },
} as const;
// Everything planted along the river, from just behind the opening view to
// past the dock, beyond where the camera can see.
export const RIVER_REACH = { from: 26, to: -260 } as const;

const smootherstep = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * x * (x * (x * 6 - 15) + 10);
};
// The S-bend: the whole river beyond it is offset sideways by the swing.
export const bendShift = (z: number) =>
  VOYAGE.bend.swing * smootherstep((VOYAGE.bend.from - z) / (VOYAGE.bend.from - VOYAGE.bend.to));
// How much wider each bank sits during Sydney, easing in and out over 6 units.
export const sydneyWiden = (z: number, width = 1) => {
  const { from, to, widen } = VOYAGE.sydney;
  return widen * width * Math.min(smootherstep((from + 6 - z) / 6), smootherstep((z - to + 6) / 6));
};

export function riverCenter(z: number, width = 1) {
  return (Math.sin(z * .12 + .7) * 1.15 + Math.sin(z * .26 - 1.2) * .25) * width
    + (leftSwing(z, width) - rightSwing(z, width)) / 2 + bendShift(z);
}

export function bankEdge(z: number, width = 1) {
  return (5.5 + Math.sin(z * .17) * 1.15 + Math.sin(z * .48) * .38) * width
    - (leftSwing(z, width) + rightSwing(z, width)) / 2 + sydneyWiden(z, width);
}

// Where the island runs on each composition.
export const islandSpan = (width = 1) => ({ from: width < 1 ? VOYAGE.island.mobileFrom : VOYAGE.island.from, to: VOYAGE.island.to });

// The island's half-width across the river at z, 0 outside it. Its upstream
// head is blunt and rounded, it runs a little uneven along its length, and it
// tapers off in a long tail towards where the channels rejoin. The island
// itself is built in VoyageWorld; the story boats keep to the channels either
// side of it.
export function islandHalfWidth(z: number, width = 1) {
  const { from, to } = islandSpan(width), { halfWidth } = VOYAGE.island;
  const t = (from - z) / (from - to);
  if (t <= 0 || t >= 1) return 0;
  const head = t < .16 ? Math.sqrt(1 - (1 - t / .16) ** 2) : 1;
  const tail = t > .45 ? Math.pow((1 + Math.cos(Math.PI * (t - .45) / .55)) / 2, .7) : 1;
  return halfWidth * width * head * tail * (1 + Math.sin(z * .9 + 1) * .06);
}

// The Sydney rock's half-width across the river at z, 0 outside it: a blunt
// nose upstream where the boats first part, a long back on which the Opera
// House stands, and a rounded end just past the bridge. A phone's narrower
// river takes a narrower rock, with room for both boats either side.
export function rockHalfWidth(z: number, width = 1) {
  const { from, to, halfWidth, mobileHalfWidth } = VOYAGE.rock;
  const t = (from - z) / (from - to);
  if (t <= 0 || t >= 1) return 0;
  const nose = t < .45 ? Math.pow(t / .45, .7) : 1;
  const end = t > .84 ? Math.sqrt(1 - ((t - .84) / .16) ** 2) : 1;
  return (width < 1 ? mobileHalfWidth : halfWidth) * nose * end * (1 + Math.sin(z * 1.9 + 2) * .05 + Math.sin(z * 5.3) * .03);
}

// The middle of the channel on `side` of the island, as an x offset from the
// river's centre. Past the island's end it is the middle of that half of the river.
export const channelOffset = (z: number, width = 1) => (islandHalfWidth(z, width) + bankEdge(z, width)) / 2;

// The jetty runs out from the bank on the dock side; the catamaran moors at its
// end. The old tree stands inland of it, a little downstream.
export function voyageLandmarks(width = 1) {
  const { z, side, jetty } = VOYAGE.dock;
  const bank = riverCenter(z, width) + side * bankEdge(z, width);
  const reach = jetty * Math.max(width, .6);
  const tree = VOYAGE.tree.z;
  return {
    jetty: { x: bank, z, side, reach },
    mooring: { x: bank - side * (reach + .8), z },
    tree: { x: riverCenter(tree, width) + side * (bankEdge(tree, width) + VOYAGE.tree.inland * Math.max(width, .6)), z: tree },
  };
}

// Each boat sets out from its own little jetty on its channel's outer bank,
// beside where it starts under the opening title: Amelia's on the −x bank,
// Patrick's on +x. They sit a little apart along the river, his longer at the
// head, as his and hers. Each runs `reach` out over the water to a head
// `head` long along the bank, where its boat lies alongside, stern to the
// head and bow free downstream, ready to leave: in portrait the river's
// middle drifts towards Patrick's bank as they set off. In portrait the
// channels are only just wider than a boat beside a jetty, so each is a
// landing stage along the bank and its boat lies about mid-channel, setting
// off straight down it.
export const LAUNCH_JETTY = { reach: 1.05, mobileReach: .27, headDepth: .4, neck: .5, landing: .5 } as const;
export function launchJetties(width = 1) {
  const middle = riverCenter(ROUTE.start, width);
  const banks = ([[-1, .25, 1.15], [1, .4, 1.4]] as const).map(([side, dz, head]) => {
    const z = ROUTE.start + dz;
    return { side, x: riverCenter(z, width) + side * bankEdge(z, width), z, head };
  });
  // The nearer bank's jetty is the shortest; the other reaches out as far
  // from the river's middle, so both boats lie alongside.
  const nearest = Math.min(...banks.map(bank => Math.abs(bank.x - middle)));
  return banks.map(bank => {
    const reach = (width < 1 ? LAUNCH_JETTY.mobileReach : LAUNCH_JETTY.reach) + Math.abs(bank.x - middle) - nearest;
    return { ...bank, reach, headDepth: Math.min(LAUNCH_JETTY.headDepth, reach) };
  });
}

// Ground kept clear of generated planting: the old tree's trunk and roots,
// the level lawn far off past the bend, Bennelong Point, and the jetties with
// their landings on the bank. `margin` widens each, for plants and trees with a spread.
export function voyageClearing(x: number, z: number, width = 1, margin = 0) {
  const { jetty, tree } = voyageLandmarks(width);
  if (Math.hypot(x - tree.x, z - tree.z) < 2.2 + margin) return true;
  const lawn = lawnSpot(width);
  if (Math.hypot(x - lawn.x, z - lawn.z) < lawn.radius + margin) return true;
  if (Math.abs(z - pointSpot(width).z) < 3 + margin && pointInland(x, z, width) > -margin) return true;
  const along = (x - jetty.x) * jetty.side;
  if (along > -jetty.reach - .4 - margin && along < 1.8 + margin && Math.abs(z - jetty.z) < .9 + margin) return true;
  return launchJetties(width).some(launch => {
    const inland = (x - launch.x) * launch.side;
    return inland > -launch.reach - .2 - margin && inland < LAUNCH_JETTY.landing + .5 + margin && Math.abs(z - launch.z) < launch.head / 2 + .2 + margin;
  });
}

// Instances are batched by stretch of river, and a batch is drawn only while
// its stretch is in reach of the camera: not behind it, less a little for
// shadows cast forward, nor past its far plane. Fog hides anything that far.
export const RIVER_CHUNK = 20;
export function riverChunks<T extends { z: number }>(items: T[]) {
  const chunks = new Map<number, T[]>();
  for (const item of items) {
    const key = Math.floor(item.z / RIVER_CHUNK);
    const chunk = chunks.get(key);
    if (chunk) chunk.push(item); else chunks.set(key, [item]);
  }
  return [...chunks.values()];
}
export const chunkSpan = (items: { z: number }[]) =>
  items.reduce((span, { z }) => ({ near: Math.max(span.near, z), far: Math.min(span.far, z) }), { near: -Infinity, far: Infinity });
export const inReach = (span: { near: number; far: number }, cameraZ: number, cameraFar: number) =>
  span.far < cameraZ + 3 && span.near > cameraZ - cameraFar;

// The bank rises from the water over its first 2.4 units inland, then levels.
const bankRise = (inland: number) => -.12 + Math.min(1, Math.max(0, inland / 2.4)) * .85;
export function groundHeight(x: number, z: number, width = 1) {
  const inland = Math.abs(x - riverCenter(z, width)) - bankEdge(z, width);
  // The ground's wobble is calmer at the water's edge, so the shore always
  // rises out of the water a little inland of the bank, never on it, and
  // boats held at the bank stay clear of visible land.
  const wobble = .4 + .6 * Math.min(1, Math.max(0, inland / 1.2));
  const ground = bankRise(inland) + (Math.sin(x * 1.1 + z * .31) * .10 + Math.sin(z * 1.7 + x * 2.4) * .045) * wobble;
  return onLawn(x, z, width, inland, ground);
}

// The level lawn (`VOYAGE.lawn`): its middle, how far round it is level, how
// far round it the field is open (trees keep off it, so none stands in front
// of the Hagia Sophia), and its height, the bank's level top without the
// wobble. It lies `inland` from the water, far enough that it is level
// beyond the bank's rise (2.4), which it leaves as it was.
export function lawnSpot(width = 1) {
  const { z, side, inland: desktop, mobileInland, radius, mobileRadius, field, mobileField } = VOYAGE.lawn;
  const inland = width < 1 ? mobileInland : desktop;
  return { x: riverCenter(z, width) + side * (bankEdge(z, width) + inland), z, radius: width < 1 ? mobileRadius : radius, field: width < 1 ? mobileField : field, height: bankRise(inland) };
}
// Bennelong Point (`VOYAGE.point`): where it meets the water's edge on its
// bank, how far it juts `out` into the river and runs `back` into the bank
// from there (only a little, where the bank is still low, so the point can
// be low too), and how `wide` it is along the river; a phone's narrower river
// takes a smaller point (`mobile`), a little further down, where its narrow
// lens still sees the bank as August 2022 shows. Built in voyageRock.ts.
export function pointSpot(width = 1) {
  const { side, mobile, ...desktop } = VOYAGE.point, { z, out, back, wide } = width < 1 ? mobile : desktop;
  return { x: riverCenter(z, width) + side * bankEdge(z, width), z, side, out, back, wide };
}
// How far in from the point's waterline a spot is (negative off it): its
// outline is a rectangle with corners rounded `POINT_ROUND` of its width, so planting and guests' boats
// keep off it.
export const POINT_ROUND = .2;
export function pointInland(x: number, z: number, width = 1) {
  const point = pointSpot(width), round = point.wide * POINT_ROUND;
  const u = (x - point.x) * point.side - (point.back - point.out) / 2, v = z - point.z;
  const qu = Math.abs(u) - ((point.back + point.out) / 2 - round), qv = Math.abs(v) - (point.wide / 2 - round);
  return round - Math.hypot(Math.max(qu, 0), Math.max(qv, 0)) - Math.min(Math.max(qu, qv), 0);
}

// The ground eases from the bank's into the lawn's level over `ease` round
// it, but not at the water's edge, which keeps its shore.
function onLawn(x: number, z: number, width: number, inland: number, ground: number) {
  const { ease } = VOYAGE.lawn;
  if (Math.abs(z - VOYAGE.lawn.z) > VOYAGE.lawn.radius + ease) return ground;
  const lawn = lawnSpot(width), out = (Math.hypot(x - lawn.x, z - lawn.z) - lawn.radius) / ease;
  if (out >= 1) return ground;
  const t = Math.min(1, Math.max(0, out)), shore = Math.min(1, Math.max(0, inland / .3));
  const level = (1 - t * t * (3 - 2 * t)) * shore * shore * (3 - 2 * shore);
  return ground + (lawn.height - ground) * level;
}

export function bankGeometry(side: number, width = 1) {
  const length = RIVER_REACH.from - RIVER_REACH.to;
  const geometry = new THREE.PlaneGeometry(54, length, 90, Math.round(length * 1.3));
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  const colors = [], inlands = [];
  const color = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    const z = position.getY(i) + (RIVER_REACH.from + RIVER_REACH.to) / 2;
    const inland = position.getX(i) + 27;
    inlands.push(inland);
    const x = riverCenter(z, width) + (bankEdge(z, width) + inland) * side;
    const y = groundHeight(x, z, width);
    position.setXYZ(i, x, y, z);
    uv.setXY(i, x / 16, z / 16);
    color.set(inland < .6 ? '#797866' : '#e3dfc8');
    colors.push(color.r, color.g, color.b);
  }
  // PlaneGeometry faces +Z; mapping to X/Y/Z here needs the opposite winding on +X.
  if (side === 1) {
    const index = geometry.index!;
    for (let i = 0; i < index.count; i += 3) {
      const a = index.getX(i); index.setX(i, index.getX(i + 2)); index.setX(i + 2, a);
    }
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  // Distance from the water's edge, for shaders that dampen the shore.
  geometry.setAttribute('inland', new THREE.Float32BufferAttribute(inlands, 1));
  geometry.computeVertexNormals();
  return geometry;
}

export function leafGeometry(petal = false) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(-.40, .28, -.40, .68, 0, 1);
  shape.bezierCurveTo(.40, .68, .40, .28, 0, 0);
  const geometry = new THREE.ShapeGeometry(shape, 5);
  const p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    p.setZ(i, Math.sin(y * Math.PI) * (petal ? .23 : .12) + x * x * .5);
  }
  geometry.computeVertexNormals();
  return geometry;
}

export type LeafPlacement = { position: THREE.Vector3; scale: number };

export function treeGeometry(seed: number, distant = false) {
  const rand = random(seed);
  const branches: THREE.BufferGeometry[] = [];
  const leaves: LeafPlacement[] = [];
  function grow(start: THREE.Vector3, direction: THREE.Vector3, length: number, radius: number, depth: number) {
    const end = start.clone().addScaledVector(direction, length);
    const middle = start.clone().lerp(end, .5).add(new THREE.Vector3((rand() - .5) * length * .14, .12, (rand() - .5) * length * .14));
    const curve = new THREE.CatmullRomCurve3([start, middle, end]);
    const radial = distant ? 5 : depth < 2 ? 14 : 7;
    const segments = distant ? 4 : depth === 0 ? 16 : 8;
    const tube = new THREE.TubeGeometry(curve, segments, radius, radial, false);
    const positions = tube.attributes.position;
    for (let i = 0; i <= segments; i++) {
      const center = curve.getPointAt(i / segments);
      for (let j = 0; j <= radial; j++) {
        const index = i * (radial + 1) + j;
        const v = new THREE.Vector3().fromBufferAttribute(positions, index);
        v.sub(center).multiplyScalar(1 - i / segments * .96).add(center);
        positions.setXYZ(index, v.x, v.y, v.z);
      }
    }
    tube.deleteAttribute('normal');
    const smoothTube = mergeVertices(tube);
    smoothTube.computeVertexNormals();
    branches.push(smoothTube);
    tube.dispose();
    if (depth >= (distant ? 2 : 3)) {
      for (let i = 0; i < (distant ? 7 : 10); i++) {
        const t = .25 + rand() * .9;
        const position = start.clone().lerp(end, t);
        position.add(new THREE.Vector3((rand() - .5) * 1.15, (rand() - .5) * .8, (rand() - .5) * 1.15));
        leaves.push({ position, scale: (distant ? .45 : .27) + rand() * .27 });
      }
    }
    if (depth >= (distant ? 3 : 4)) return;
    const count = depth === 0 ? 7 : depth === 1 ? 4 : 3;
    for (let i = 0; i < count; i++) {
      const t = depth === 0 ? .45 + i / count * .55 : .50 + rand() * .50;
      const origin = curve.getPoint(t);
      const angle = i * 2.399 + rand() * 1.4 + depth;
      const next = new THREE.Vector3(Math.cos(angle) * .8, .5 + rand() * .7, Math.sin(angle) * .8);
      if (depth > 0) next.addScaledVector(direction, .55);
      next.normalize();
      grow(origin, next, length * (depth === 0 ? .66 : .57) * (.85 + rand() * .3), radius * (depth === 0 ? .40 : .46), depth + 1);
    }
  }
  grow(new THREE.Vector3(), new THREE.Vector3(.06, 1, -.03).normalize(), 6.6, .32, 0);
  // Visible spreading roots marry the trunk to the bank.
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, .4, 0), new THREE.Vector3(Math.cos(a) * .6, .05, Math.sin(a) * .6),
      new THREE.Vector3(Math.cos(a) * 1.1, -.1, Math.sin(a) * 1.1),
    ]);
    branches.push(new THREE.TubeGeometry(curve, 5, .07, 5, false));
  }
  const trunk = mergeGeometries(branches);
  branches.forEach(g => g.dispose());
  return { trunk, leaves };
}

export function barkTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#aea895'; ctx.fillRect(0, 0, 128, 512);
  const rand = random(829);
  for (let i = 0; i < 1600; i++) {
    ctx.strokeStyle = `rgba(${rand() > .45 ? '70,66,52' : '228,219,193'},${.07 + rand() * .25})`;
    ctx.lineWidth = .3 + rand() * 2;
    const x = rand() * 128, y = rand() * 512;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (rand() - .5) * 4, y + rand() * 80); ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 3);
  return texture;
}
