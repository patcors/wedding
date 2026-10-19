// The rock that parts the river where the boats first drift apart for Amelia's
// move to Sydney: a low, weathered outcrop of honey-coloured Sydney sandstone,
// Bennelong Point, its outline from rockHalfWidth. It rises out of the water
// in a low cliff with a ledge part way up, as sandstone weathers in beds, to
// a low back, and slopes into the water at its nose and end. And further
// down, the little point of the same sandstone on Amelia's bank, Bennelong
// Point, that the Opera House stands on (eggs/harbour.ts). Pure, so it can be
// tested.
import * as THREE from 'three';
import { POINT_ROUND, VOYAGE, groundHeight, pointInland, pointSpot, random, riverCenter, rockHalfWidth } from './gardenGeometry.ts';

// Its back, above the water, a little lower on a phone's narrower rock.
export const ROCK = { top: { desktop: .24, mobile: .15 } } as const;
// Its profile, from under the water to the middle of its back: each step
// `in` from its waterline (desktop's units; a phone's are .7 of them) at
// `up` of its back's height above the water, or `y` below it. A sheer cliff
// to a ledge, a step back, a second cliff to its back, and a gentle rise
// to its middle, as sandstone weathers in beds.
const PROFILE = [
  { in: -.18, y: -.4 }, { in: 0, y: -.12 }, { in: .015, up: .55 }, { in: .05, up: .6 },
  { in: .075, up: .64 }, { in: .095, up: 1 }, { in: .3, up: 1.04 }, { in: .33, up: 1.3 }, { in: .6, up: 1.36 }, { in: 9, up: 1.4 },
] as const;
// How uneven its back is, worn into hollows and humps, as a share of its height.
const ROUGH = .22;

const smooth = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

// Distance in from the rock's waterline at x, z; negative in the water.
export const rockInland = (x: number, z: number, width = 1) =>
  rockHalfWidth(z, width) - Math.abs(x - riverCenter(z, width));

// How high its back stands along its length: lower towards the nose and the
// end, where it slopes into the water.
const backAt = (z: number, width: number) => {
  const { from, to } = VOYAGE.rock, t = (from - z) / (from - to);
  return (width < 1 ? ROCK.top.mobile : ROCK.top.desktop) * (.55 + .45 * smooth(Math.min(t / .2, (1 - t) / .12)));
};
// Each step of the profile at z: how far in, and how high.
const steps = (z: number, width: number) => {
  const back = backAt(z, width), k = width < 1 ? .7 : 1;
  return PROFILE.map(step => ({ in: step.in * k, y: 'y' in step ? step.y : step.up * back }));
};

// How far its back is humped or hollowed at x, z, `inland` from its
// waterline: not at all at its edge, fully from a little way in.
const roughAt = (x: number, z: number, inland: number, width: number) => {
  const k = width < 1 ? .7 : 1;
  return ROUGH * backAt(z, width) * hump(x, z) * Math.min(1, Math.max(0, (inland - .095 * k) / (.305 * k)));
};

// Its height at x, z, but for the little chips taken out of it.
export function rockHeight(x: number, z: number, width = 1) {
  const inland = rockInland(x, z, width), profile = steps(z, width);
  if (inland <= profile[0].in) return profile[0].y;
  const i = profile.findIndex(step => step.in >= inland), a = profile[i - 1], b = profile[i];
  return a.y + (b.y - a.y) * (inland - a.in) / (b.in - a.in) + roughAt(x, z, inland, width);
}

// Honey sandstone in beds, each a shade darker or lighter than the next,
// dark and wet at the waterline, and its back weathered in patches of grey
// and lichen, darker in its hollows.
const BEDS = ['#4f4437', '#5f5040', '#93785a', '#86694b', '#9c8160', '#9a8466'];
const BACK = ['#9a8466', '#968b74', '#8f8571', '#8b8873', '#9f8865'];
// A little noise that is the same wherever two faces share a corner.
const grain = (x: number, z: number) => {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return n - Math.floor(n) - .5;
};
const hump = (x: number, z: number) => Math.sin(x * 4.1 + z * 1.7) * .5 + Math.sin(z * 3.3 - x * 2.9 + 1) * .35 + Math.sin(x * 9.7 - z * 6.1) * .15;

// Rings round the rock, one for each step of its profile, from under the
// water to its middle, joined face by face: its outline runs down Amelia's
// side from the nose and back up Patrick's. Flat shaded, a little chipped,
// so it reads as weathered stone.
export function rockGeometry(width = 1) {
  const { from, to } = VOYAGE.rock, rand = random(5101);
  const along = 48, ring = along * 2 + 2;
  const rings = PROFILE.map(() => [] as THREE.Vector3[]);
  for (let k = 0; k <= along; k++) {
    // Closer together towards the nose and the end, where it curves most.
    const t = (1 - Math.cos(Math.PI * k / along)) / 2, z = from + .02 - t * (from - to + .04);
    const center = riverCenter(z, width), half = rockHalfWidth(z, width), profile = steps(z, width);
    // Its cliffs stand a little higher or lower along its length.
    const cliffs = 1 + Math.sin(z * 3.7) * .12 + Math.sin(z * 8.9 + 1) * .07;
    profile.forEach((step, level) => {
      for (const side of [-1, 1]) {
        // Each bed's edge wanders in and out on its own, and is chipped.
        const wander = level > 1 && level < PROFILE.length - 1 ? (Math.sin(z * (2.3 + level * .7) + side * 1.7 + level) * .05 + grain(z, side + level) * .03) * (level > 5 ? 2 : 1) : 0;
        const chip = wander;
        const x = center + side * Math.max(0, half - step.in + chip);
        // Its back humped and hollowed, more so towards its middle.
        const rough = level > 5 ? roughAt(x, z, step.in, width) + ROUGH * backAt(z, width) * grain(x, z) * .6 : 0;
        const y = (level > 1 && level < 6 ? step.y * cliffs : step.y) + rough + (level > 1 ? grain(z + level, x) * .014 : 0);
        rings[level][side < 0 ? k : ring - 1 - k] = new THREE.Vector3(x, y, z);
      }
    });
  }
  const positions: number[] = [], colors: number[] = [], color = new THREE.Color();
  for (let level = 0; level < PROFILE.length - 1; level++) for (let i = 0; i < ring; i++) {
    const a = rings[level][i], b = rings[level][(i + 1) % ring], c = rings[level + 1][i], d = rings[level + 1][(i + 1) % ring];
    if (!a || !b || !c || !d) continue;
    // Each face in its bed's colour, a shade lighter or darker.
    for (const [p, q, r] of [[a, c, b], [b, c, d]]) {
      if (level < BEDS.length - 1) color.set(BEDS[level]);
      else color.set(BACK[Math.floor((hump(p.x * 1.7, p.z * 1.3) * .5 + .5) * BACK.length * .999)]).multiplyScalar(1 + (p.y + q.y + r.y - 3 * backAt(p.z, width) * 1.15) * .8);
      color.multiplyScalar(.94 + rand() * .1);
      for (const corner of [p, q, r]) { positions.push(corner.x, corner.y, corner.z); color.toArray(colors, colors.length); }
    }
  }
  // Boulders fallen from its cliffs, half in the water along its shores
  // towards its end, where the boats are well apart.
  for (const [t, side, size] of BOULDERS) {
    const z = from - t * (from - to), half = rockHalfWidth(z, width), k = width < 1 ? .65 : 1;
    const boulder = new THREE.IcosahedronGeometry(size * k, 0), p = boulder.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), zz = p.getZ(i), n = 1 + grain(x * 9 + t, zz * 9 + y) * .5;
      p.setXYZ(i, riverCenter(z, width) + side * (half - size * k * .8) + x * n * 1.1, Math.max(y * n * .75, -size * k) - .03, z + zz * n);
    }
    for (let i = 0; i < p.count; i += 3) {
      color.set(BEDS[2 + Math.floor(rand() * 3)]).multiplyScalar(.9 + rand() * .15);
      for (let c = 0; c < 3; c++) { positions.push(p.getX(i + c), p.getY(i + c), p.getZ(i + c)); color.toArray(colors, colors.length); }
    }
    boulder.dispose();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}
// Where along it (0 at the nose, 1 at the end), on which side, and how big.
const BOULDERS = [[.5, 1, .2], [.62, -1, .16], [.75, 1, .14], [.9, 1, .18], [.97, -1, .13]] as const;

// Bennelong Point (VOYAGE.point, pointSpot): a low platform of the rock's
// sandstone jutting from Amelia's bank into the river, flat on top for the
// Opera House. Its top stands a little above the bank everywhere under it,
// so it never lies in the grass, and it rises out of the water in a low cliff
// with a ledge, as the rock does, its sides running on down under the water
// and into the bank, so it is seated with no gap.
const POINT_PROFILE = [{ in: -.14, y: -.45 }, { in: 0, y: -.12 }, { in: .02, up: .45 }, { in: .08, up: .52 }, { in: .1, up: 1 }] as const;
// The height of its top: its own `top`, low, the bank cut down under and
// round it (see underPoint in gardenGeometry.ts), or just above the highest
// ground under it, if that were higher.
export function pointTop(width = 1) {
  const point = pointSpot(width);
  let top = 0;
  for (let u = -point.out; u <= point.back; u += .05) for (let v = -point.wide / 2; v <= point.wide / 2; v += .05) {
    const x = point.x + point.side * u, z = point.z + v;
    if (pointInland(x, z, width) > -.15) top = Math.max(top, groundHeight(x, z, width));
  }
  return Math.max(top + .05, point.top);
}
// Boulders fallen from its cliffs, half in the water round its end: how far
// round its outline (0 to 1, from its upstream corner on the bank), and how
// big, at desktop's size.
const POINT_BOULDERS = [[.18, .17], [.34, .13], [.47, .2], [.6, .12], [.83, .15]] as const;
export function pointGeometry(width = 1) {
  const point = pointSpot(width), top = pointTop(width), rand = random(7707), round = point.wide * POINT_ROUND;
  // Round its outline: a rectangle with rounded corners (as pointInland),
  // each corner a quarter circle, its edge wandering a little in and out at
  // each bed, as the rock's does. `u` runs inland from the water's edge, `v`
  // along the river.
  const middle = (point.back - point.out) / 2, hu = (point.back + point.out) / 2 - round, hv = point.wide / 2 - round;
  const around = ([[1, 1], [-1, 1], [-1, -1], [1, -1]] as const).flatMap(([su, sv], c) => Array.from({ length: 6 }, (_, i) => {
    const a = (c + i / 5) * Math.PI / 2;
    return { u: middle + su * hu + Math.cos(a) * round, v: sv * hv + Math.sin(a) * round, nu: Math.cos(a), nv: Math.sin(a) };
  }));
  const world = (u: number, v: number, y: number) => new THREE.Vector3(point.x + point.side * u, y, point.z + v);
  const rings = POINT_PROFILE.map((step, level) => around.map(({ u, v, nu, nv }, i) => {
    const inset = step.in + (level > 1 ? Math.sin(i * 1.9 + level) * .02 + grain(u, v + level) * .015 : 0);
    const y = 'y' in step ? step.y : step.up * top + (level > 1 ? grain(v + level, u) * .012 : 0);
    return world(u - nu * inset, v - nv * inset, y);
  }));
  const positions: number[] = [], colors: number[] = [], color = new THREE.Color(), normal = new THREE.Vector3(), edge = new THREE.Vector3();
  // Each face in its colour, a shade lighter or darker, wound to face `out`.
  const face = (p: THREE.Vector3, q: THREE.Vector3, r: THREE.Vector3, shade: string, out: THREE.Vector3) => {
    color.set(shade).multiplyScalar(.94 + rand() * .1);
    normal.subVectors(q, p).cross(edge.subVectors(r, p));
    for (const corner of normal.dot(out) > 0 ? [p, q, r] : [p, r, q]) { positions.push(corner.x, corner.y, corner.z); color.toArray(colors, colors.length); }
  };
  for (let level = 0; level < rings.length - 1; level++) for (let i = 0; i < around.length; i++) {
    const j = (i + 1) % around.length, [a, b, c, d] = [rings[level][i], rings[level][j], rings[level + 1][i], rings[level + 1][j]];
    const out = new THREE.Vector3(point.side * (around[i].nu + around[j].nu), 0, around[i].nv + around[j].nv);
    face(a, b, c, BEDS[level + 1], out); face(b, d, c, BEDS[level + 1], out);
  }
  // Its top, weathered in patches like the rock's back.
  const last = rings[rings.length - 1], centre = world(middle, 0, top), up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < around.length; i++) {
    const a = last[i], b = last[(i + 1) % around.length];
    face(a, b, centre, BACK[Math.floor((hump(a.x * 1.7, a.z * 1.3) * .5 + .5) * BACK.length * .999)], up);
  }
  // Boulders at the foot of its cliffs, only on its river side.
  const k = width < 1 ? .65 : 1, river = around.map((corner, i) => ({ corner, i })).filter(({ corner }) => corner.u < 0);
  for (const [t, size] of POINT_BOULDERS) {
    const { corner } = river[Math.floor(t * (river.length - 1))], r = size * k;
    const boulder = new THREE.IcosahedronGeometry(r, 0), p = boulder.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), zz = p.getZ(i), n = 1 + grain(x * 9 + t, zz * 9 + y) * .5;
      const at = world(corner.u + corner.nu * r * .5 + x * n * 1.1, corner.v + corner.nv * r * .5 + zz * n, Math.max(y * n * .75, -r) - .03);
      p.setXYZ(i, at.x, at.y, at.z);
    }
    for (let i = 0; i < p.count; i += 3) {
      const [a, b, c] = [0, 1, 2].map(j => new THREE.Vector3(p.getX(i + j), p.getY(i + j), p.getZ(i + j)));
      const centroid = a.clone().add(b).add(c).divideScalar(3);
      face(a, b, c, BEDS[2 + Math.floor(rand() * 3)], centroid.sub(world(corner.u + corner.nu * r * .5, corner.v + corner.nv * r * .5, 0)));
    }
    boulder.dispose();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}
