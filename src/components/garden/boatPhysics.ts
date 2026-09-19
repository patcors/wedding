// Small planar rigid bodies: four floaters need no general-purpose 3D engine.
export const BOAT_KINDS = ['paper', 'sailboat', 'tugboat', 'duck'] as const;
export type BoatKind = typeof BOAT_KINDS[number];
export type BoatLaunch = { id: number; z: number; lateral: number; kind: BoatKind };
export const BOAT_MARGIN = .88;
export const BOAT_LIFETIME = 48;
export const RIPPLE_COUNT = 6;
export const RIPPLE_INTERVAL = .55;
const STEP = 1 / 120;
type Point = { x: number; z: number };
type River = { center: (z: number, width: number) => number; halfWidth: (z: number, width: number) => number };

const sections = (values: number[][]): Point[] => [
  ...values.map(([z, x]) => ({ x: -x * .8, z: z * .8 })),
  ...values.slice().reverse().map(([z, x]) => ({ x: x * .8, z: z * .8 })),
];
// Outlines follow the visible hull rims; masts and sails don't widen contact.
const HULLS: Record<BoatKind, { mass: number; points: Point[] }> = {
  paper: { mass: .65, points: [{ x: 0, z: -.82 }, { x: .43, z: 0 }, { x: 0, z: .82 }, { x: -.43, z: 0 }] },
  sailboat: { mass: 1.4, points: sections([[-.78, .015], [-.55, .23], [-.12, .36], [.30, .33], [.66, .22]]) },
  tugboat: { mass: 2.4, points: sections([[-.76, .015], [-.58, .24], [-.25, .34], [.20, .34], [.56, .27], [.68, .15]]) },
  duck: { mass: .4, points: Array.from({ length: 12 }, (_, i) => {
    const angle = i * Math.PI / 6;
    return { x: Math.cos(angle) * .20, z: Math.sin(angle) * .31 - .035 };
  }) },
};

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
    vx: 0, vz: -.82, yaw: Math.sin(phase) * .12 + (launch.kind === 'duck' ? .45 : 0),
    omega: 0, age: 0, inverseMass: 1 / hull.mass,
    inverseInertia: 12 / (hull.mass * (spanX * spanX + spanZ * spanZ)),
    eddy: (launch.id % 2 ? 1 : -1) * (.10 + (.5 + Math.sin(phase) * .5) * .06),
    wake: Array.from({ length: RIPPLE_COUNT }, () => ({ x: 0, z: 0, born: -1 })), nextRipple: 0,
  };
}

export function boatOutline(body: BoatBody): Point[] {
  const c = Math.cos(body.yaw), s = Math.sin(body.yaw);
  return HULLS[body.kind].points.map(p => ({ x: body.x + c * p.x + s * p.z, z: body.z - s * p.x + c * p.z }));
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
  if (Math.hypot(a.x - b.x, a.z - b.z) > 1.8) return null;
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

export class BoatSimulation {
  bodies: BoatBody[] = [];
  private accumulator = 0;
  private width: number;
  private river: River;
  constructor(river: River, width: number) { this.river = river; this.width = width; }

  launch(launch: BoatLaunch, width: number) {
    this.resize(width);
    const body = createBoatBody(launch, width, this.river);
    this.bodies = [...this.bodies.slice(-3), body];
    this.solve();
    return body;
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
    for (let iteration = 0; iteration < 8; iteration++) {
      for (let i = 0; i < this.bodies.length; i++) {
        for (let j = i + 1; j < this.bodies.length; j++) resolveBoatContact(this.bodies[i], this.bodies[j]);
      }
      for (const body of this.bodies) this.bank(body);
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
