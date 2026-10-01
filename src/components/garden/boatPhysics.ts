// Small planar rigid bodies: a few floaters need no general-purpose 3D engine.
export const BOAT_KINDS = ['paper', 'sailboat', 'tugboat', 'duck'] as const;
export type BoatKind = typeof BOAT_KINDS[number];
export type BoatLaunch = { id: number; z: number; lateral: number; kind: BoatKind; yaw?: number };
export const BOAT_MARGIN = .88;
export const BOAT_LIFETIME = 48;
export const RIPPLE_COUNT = 6;
export const RIPPLE_INTERVAL = .55;
const STEP = 1 / 120;
type Point = { x: number; z: number };
// A reed or cattail where it meets the water: a fixed post that hulls bump off.
export type Stem = Point & { radius: number };
type River = { center: (z: number, width: number) => number; halfWidth: (z: number, width: number) => number };

const sections = (values: number[][]): Point[] => [
  ...values.map(([z, x]) => ({ x: -x * .8, z: z * .8 })),
  ...values.slice().reverse().map(([z, x]) => ({ x: x * .8, z: z * .8 })),
];
// Outlines follow the visible hull rims; masts and sails don't widen contact.
// Spin scales the slow eddy turn: ducks twirl so their faces come round.
const HULLS: Record<BoatKind, { mass: number; points: Point[]; spin?: number }> = {
  paper: { mass: .65, points: [{ x: 0, z: -.82 }, { x: .43, z: 0 }, { x: 0, z: .82 }, { x: -.43, z: 0 }] },
  sailboat: { mass: 1.4, points: sections([[-.78, .015], [-.55, .23], [-.12, .36], [.30, .33], [.66, .22]]) },
  tugboat: { mass: 2.4, points: sections([[-.76, .015], [-.58, .24], [-.25, .34], [.20, .34], [.56, .27], [.68, .15]]) },
  // The duck's round body at the waterline; the beak and tail overhang it.
  duck: { mass: .5, spin: 4, points: Array.from({ length: 10 }, (_, i) => ({ x: Math.sin(i / 10 * Math.PI * 2) * .26, z: .02 - Math.cos(i / 10 * Math.PI * 2) * .34 })) },
};

// How far each hull reaches from its centre, for a cheap first test.
const REACH = Object.fromEntries(Object.entries(HULLS).map(([kind, hull]) =>
  [kind, Math.max(...hull.points.map(p => Math.hypot(p.x, p.z)))])) as Record<BoatKind, number>;

export type BoatBody = BoatLaunch & {
  x: number; vx: number; vz: number; yaw: number; omega: number;
  age: number; inverseMass: number; inverseInertia: number; eddy: number;
  wake: { x: number; z: number; born: number }[]; nextRipple: number;
};

export function createBoatBody(launch: BoatLaunch, width: number, river: River): BoatBody {
  const phase = launch.id * 2.399963;
  const hull = HULLS[launch.kind];
  const spanX = Math.max(...hull.points.map(p => p.x)) - Math.min(...hull.points.map(p => p.x));
  const spanZ = Math.max(...hull.points.map(p => p.z)) - Math.min(...hull.points.map(p => p.z));
  return { ...launch,
    x: river.center(launch.z, width) + launch.lateral * Math.max(.1, river.halfWidth(launch.z, width) - BOAT_MARGIN),
    vx: 0, vz: -.82, yaw: launch.yaw ?? Math.sin(phase) * .12,
    omega: 0, age: 0, inverseMass: 1 / hull.mass,
    inverseInertia: 12 / (hull.mass * (spanX * spanX + spanZ * spanZ)),
    eddy: (launch.id % 2 ? 1 : -1) * (.10 + (.5 + Math.sin(phase) * .5) * .06) * (hull.spin ?? 1),
    wake: Array.from({ length: RIPPLE_COUNT }, () => ({ x: 0, z: 0, born: -1 })), nextRipple: 0,
  };
}

// Kept until the hull moves: crowded launches test each outline many times a step.
const outlines = new WeakMap<BoatBody, { x: number; z: number; yaw: number; points: Point[] }>();
export function boatOutline(body: BoatBody): Point[] {
  const cached = outlines.get(body);
  if (cached && cached.x === body.x && cached.z === body.z && cached.yaw === body.yaw) return cached.points;
  const c = Math.cos(body.yaw), s = Math.sin(body.yaw);
  const points = HULLS[body.kind].points.map(p => ({ x: body.x + c * p.x + s * p.z, z: body.z - s * p.x + c * p.z }));
  outlines.set(body, { x: body.x, z: body.z, yaw: body.yaw, points });
  return points;
}
const dot = (p: Point, n: Point) => p.x * n.x + p.z * n.z;
// Y-axis torque follows Three's X/Z rotation convention.
const torque = (r: Point, n: Point) => r.z * n.x - r.x * n.z;
function project(points: Point[], n: Point) {
  let min = Infinity, max = -Infinity;
  for (const p of points) { const d = dot(p, n); min = Math.min(min, d); max = Math.max(max, d); }
  return { min, max };
}

export function boatContact(a: BoatBody, b: BoatBody) {
  const reach = REACH[a.kind] + REACH[b.kind];
  if ((a.x - b.x) ** 2 + (a.z - b.z) ** 2 > reach * reach) return null;
  const pa = boatOutline(a), pb = boatOutline(b);
  let depth = Infinity, normal: Point = { x: 1, z: 0 };
  let tiedNormals: Point[] = [];
  for (const polygon of [pa, pb]) {
    for (let i = 0; i < polygon.length; i++) {
      const p = polygon[i], q = polygon[(i + 1) % polygon.length];
      const length = Math.hypot(q.x - p.x, q.z - p.z);
      const axis = { x: -(q.z - p.z) / length, z: (q.x - p.x) / length };
      const aa = project(pa, axis), bb = project(pb, axis);
      if (aa.max <= bb.min || bb.max <= aa.min) return null;
      const forward = aa.max - bb.min, backward = bb.max - aa.min;
      const overlap = Math.min(forward, backward);
      const sign = forward <= backward ? 1 : -1;
      const candidate = { x: axis.x * sign, z: axis.z * sign };
      if (overlap < depth - 1e-8) {
        depth = overlap;
        normal = candidate;
        tiedNormals = [candidate];
      } else if (Math.abs(overlap - depth) < 1e-8) tiedNormals.push(candidate);
    }
  }
  // Symmetric bow-to-bow contact touches two faces. Averaging those normals
  // prevents an arbitrary polygon edge from sending a centred hit sideways.
  const sum = tiedNormals.reduce((p, n) => ({ x: p.x + n.x, z: p.z + n.z }), { x: 0, z: 0 });
  const length = Math.hypot(sum.x, sum.z);
  if (length > .001) {
    const average = { x: sum.x / length, z: sum.z / length };
    const alignment = dot(normal, average);
    if (alignment > .1) { depth /= alignment; normal = average; }
  }
  // Midpoint of the touching features, preserving the lever arm on glancing hits.
  const aa = project(pa, normal), bb = project(pb, normal);
  const tangent = { x: -normal.z, z: normal.x };
  const edgeA = project(pa.filter(p => dot(p, normal) >= aa.max - .025), tangent);
  const edgeB = project(pb.filter(p => dot(p, normal) <= bb.min + .025), tangent);
  const along = (Math.max(edgeA.min, edgeB.min) + Math.min(edgeA.max, edgeB.max)) / 2;
  const across = (aa.max + bb.min) / 2;
  return { depth, normal, point: { x: normal.x * across + tangent.x * along, z: normal.z * across + tangent.z * along } };
}

// How far a stem sits inside a hull, and which way to push the hull out.
export function stemContact(body: BoatBody, stem: Stem, outline = boatOutline(body)) {
  const reach = REACH[body.kind] + stem.radius;
  if ((stem.x - body.x) ** 2 + (stem.z - body.z) ** 2 > reach * reach) return null;
  let distance = Infinity, closest: Point = stem, inside = true, outward: Point = { x: 1, z: 0 };
  for (let i = 0; i < outline.length; i++) {
    const p = outline[i], q = outline[(i + 1) % outline.length];
    const ex = q.x - p.x, ez = q.z - p.z, length = Math.hypot(ex, ez);
    // Hulls are convex around their centre, so the outward normal faces away from it.
    const flip = (p.x - body.x) * ez - (p.z - body.z) * ex < 0 ? -1 : 1;
    const n = { x: flip * ez / length, z: -flip * ex / length };
    if (dot({ x: stem.x - p.x, z: stem.z - p.z }, n) > 0) inside = false;
    const t = Math.max(0, Math.min(1, ((stem.x - p.x) * ex + (stem.z - p.z) * ez) / (length * length)));
    const c = { x: p.x + ex * t, z: p.z + ez * t };
    const d = Math.hypot(stem.x - c.x, stem.z - c.z);
    if (d < distance) { distance = d; closest = c; outward = n; }
  }
  if (inside) return { depth: distance + stem.radius, normal: { x: -outward.x, z: -outward.z }, point: closest };
  if (distance >= stem.radius) return null;
  return { depth: stem.radius - distance, normal: { x: (closest.x - stem.x) / distance, z: (closest.z - stem.z) / distance }, point: closest };
}

function impulse(body: BoatBody, at: Point, direction: Point, magnitude: number) {
  body.vx += direction.x * magnitude * body.inverseMass;
  body.vz += direction.z * magnitude * body.inverseMass;
  body.omega += torque(at, direction) * magnitude * body.inverseInertia;
}

export function resolveBoatContact(a: BoatBody, b: BoatBody) {
  const contact = boatContact(a, b);
  if (!contact) return;
  const { normal: n, point, depth } = contact;
  const ra = { x: point.x - a.x, z: point.z - a.z }, rb = { x: point.x - b.x, z: point.z - b.z };
  const relativeVelocity = () => ({ x: b.vx + b.omega * rb.z - a.vx - a.omega * ra.z,
    z: b.vz - b.omega * rb.x - a.vz + a.omega * ra.x });
  const inverseEffectiveMass = (axis: Point) => a.inverseMass + b.inverseMass
    + torque(ra, axis) ** 2 * a.inverseInertia + torque(rb, axis) ** 2 * b.inverseInertia;
  const speed = dot(relativeVelocity(), n);
  if (speed < 0) {
    // Soft impacts in water; resting contacts do not keep bouncing.
    const j = -(1 + (speed < -.15 ? .18 : 0)) * speed / inverseEffectiveMass(n);
    impulse(a, ra, n, -j); impulse(b, rb, n, j);
    const tangent = { x: -n.z, z: n.x };
    const friction = Math.max(-j * .18, Math.min(j * .18, -dot(relativeVelocity(), tangent) / inverseEffectiveMass(tangent)));
    impulse(a, ra, tangent, -friction); impulse(b, rb, tangent, friction);
  }
  // Separate overlapping launches without injecting explosive kinetic energy.
  const correction = Math.max(0, depth - .001) * .8 / (a.inverseMass + b.inverseMass);
  a.x -= n.x * correction * a.inverseMass; a.z -= n.z * correction * a.inverseMass;
  b.x += n.x * correction * b.inverseMass; b.z += n.z * correction * b.inverseMass;
}

// Reeds give a little, so hulls barely bounce and slide along them.
function resolveStemContact(body: BoatBody, stem: Stem, outline: Point[]) {
  const contact = stemContact(body, stem, outline);
  if (!contact) return false;
  const { normal: n, point, depth } = contact;
  const r = { x: point.x - body.x, z: point.z - body.z };
  const velocity = () => ({ x: body.vx + body.omega * r.z, z: body.vz - body.omega * r.x });
  const speed = dot(velocity(), n);
  if (speed < 0) {
    const j = -1.1 * speed / (body.inverseMass + torque(r, n) ** 2 * body.inverseInertia);
    impulse(body, r, n, j);
    const tangent = { x: -n.z, z: n.x };
    const slip = -dot(velocity(), tangent) / (body.inverseMass + torque(r, tangent) ** 2 * body.inverseInertia);
    impulse(body, r, tangent, Math.max(-j * .1, Math.min(j * .1, slip)));
  }
  body.x += n.x * depth * .8; body.z += n.z * depth * .8;
  return true;
}

export class BoatSimulation {
  bodies: BoatBody[] = [];
  private stems: Stem[] = [];
  private accumulator = 0;
  private width: number;
  private river: River;
  constructor(river: River, width: number) { this.river = river; this.width = width; }

  // Stems belong to one river width, so they arrive with it.
  setStems(stems: Stem[], width: number) {
    this.stems = stems.slice().sort((a, b) => a.z - b.z);
    if (width === this.width) this.solve();
    else this.resize(width);
  }

  launch(launch: BoatLaunch, width: number) {
    this.resize(width);
    const body = createBoatBody(launch, width, this.river);
    // A boat dropped into a reed bed starts at its open-water edge instead of
    // being pushed out through the stems.
    const center = this.river.center(body.z, width);
    for (let step = 0; step < 40 && this.touchesStem(body); step++) body.x += Math.sign(center - body.x) * Math.min(.05, Math.abs(center - body.x));
    this.bodies = [...this.bodies, body];
    this.solve();
    return body;
  }

  private nearbyStems(z: number) {
    let low = 0, high = this.stems.length;
    while (low < high) { const mid = (low + high) >> 1; if (this.stems[mid].z < z - 1) low = mid + 1; else high = mid; }
    let end = low;
    while (end < this.stems.length && this.stems[end].z <= z + 1) end++;
    return this.stems.slice(low, end);
  }

  private touchesStem(body: BoatBody) {
    const outline = boatOutline(body);
    return this.nearbyStems(body.z).some(stem => stemContact(body, stem, outline));
  }

  private bank(body: BoatBody) {
    for (const side of [-1, 1]) {
      let deepest = 0, contact: Point | undefined;
      for (const p of boatOutline(body)) {
        const edge = this.river.center(p.z, this.width) + side * (this.river.halfWidth(p.z, this.width) - .06);
        const depth = side * (p.x - edge);
        if (depth > deepest) { deepest = depth; contact = p; }
      }
      if (!contact) continue;
      const edgeAt = (z: number) => this.river.center(z, this.width) + side * this.river.halfWidth(z, this.width);
      const slope = (edgeAt(contact.z + .01) - edgeAt(contact.z - .01)) / .02;
      const length = Math.hypot(1, slope), n = { x: -side / length, z: side * slope / length };
      const r = { x: contact.x - body.x, z: contact.z - body.z };
      const speed = dot({ x: body.vx + body.omega * r.z, z: body.vz - body.omega * r.x }, n);
      if (speed < 0) impulse(body, r, n, -1.08 * speed / (body.inverseMass + torque(r, n) ** 2 * body.inverseInertia));
      body.x += n.x * deepest / length; body.z += n.z * deepest / length;
    }
  }

  private solve() {
    // Sorted along the river, each hull only meets the ones just downstream.
    const order = this.bodies.slice().sort((a, b) => a.z - b.z);
    for (let iteration = 0; iteration < 8; iteration++) {
      for (let i = 0; i < order.length; i++) {
        for (let j = i + 1; j < order.length && order[j].z - order[i].z <= 1.8; j++) resolveBoatContact(order[i], order[j]);
      }
      for (const body of this.bodies) {
        let outline = boatOutline(body);
        for (const stem of this.nearbyStems(body.z)) if (resolveStemContact(body, stem, outline)) outline = boatOutline(body);
        this.bank(body);
      }
    }
  }

  private resize(width: number) {
    if (width === this.width) return;
    for (const body of this.bodies) {
      const previousChannel = Math.max(.1, this.river.halfWidth(body.z, this.width) - BOAT_MARGIN);
      const channel = Math.max(.1, this.river.halfWidth(body.z, width) - BOAT_MARGIN);
      body.x = this.river.center(body.z, width) + (body.x - this.river.center(body.z, this.width)) * channel / previousChannel;
      // Old ripples belong to the previous river composition.
      for (const ripple of body.wake) ripple.born = -1;
    }
    this.width = width;
    this.solve();
  }

  advance(dt: number, width: number, paused: boolean) {
    this.resize(width);
    if (paused || !Number.isFinite(dt) || dt <= 0) return false;
    // Bound catch-up after a suspended tab; fixed substeps also prevent tunnelling.
    this.accumulator += Math.min(dt, .1);
    while (this.accumulator + 1e-10 >= STEP) {
      this.accumulator -= STEP;
      for (const body of this.bodies) {
        body.age += STEP;
        const center = this.river.center(body.z, width);
        const slope = (this.river.center(body.z + .05, width) - this.river.center(body.z - .05, width)) / .1;
        const flowX = -.82 * slope - (body.x - center) * .035 + Math.cos(body.age * .48 + body.id) * .034;
        const drag = 1 - Math.exp(-.65 * STEP);
        body.vx += (flowX - body.vx) * drag;
        body.vz += (-.82 - body.vz) * drag;
        body.omega += (body.eddy - body.omega) * (1 - Math.exp(-1.2 * STEP));
        body.x += body.vx * STEP; body.z += body.vz * STEP; body.yaw += body.omega * STEP;
      }
      this.solve();
      for (const body of this.bodies) {
        if (body.age >= body.nextRipple * RIPPLE_INTERVAL) {
          const ripple = body.wake[body.nextRipple % RIPPLE_COUNT];
          ripple.x = body.x; ripple.z = body.z; ripple.born = body.age;
          body.nextRipple++;
        }
      }
    }
    const alive = this.bodies.filter(body => body.age < BOAT_LIFETIME);
    if (alive.length === this.bodies.length) return false;
    this.bodies = alive;
    return true;
  }
}
