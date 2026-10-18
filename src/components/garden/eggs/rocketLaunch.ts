// October 2026: Bullet, the product Patrick worked on, as a small brass
// bullet of a rocket on a launch stand on the right bank down the river. It
// comes out of the haze on its stand, and as the scroll passes its moment it
// fires and climbs away in a gentle arc down the open corridor of mist,
// trailing a thin streak of smoke, and melts into the haze. It isn't a
// milestone, so it keeps its own time. Where it stands and flies; drawn by
// Rocket.tsx with the models in rocketGeometry.ts. Pure, so it can be tested.
import { cameraPose } from '../cameraRig.ts';
import { bankEdge, groundHeight, riverCenter } from '../gardenGeometry.ts';
import { BULLET_LAUNCH, ROOM, progressAt, routeAt } from '../journey.ts';
import { heightAt, inView } from './egg.ts';
import { STAND } from './rocketGeometry.ts';

// It launches `at` shares after `month` shows (BULLET_LAUNCH in journey.ts,
// so the glide can wait for it): as October 2026 shows, when it went into
// production, a quiet stretch of the S-bend once the trip's balloons have
// climbed away and the Hagia Sophia has gone, long after the proposal and
// before 2027's heart is in. (It used to fire, larger and nearer, as January
// 2025 turned, in the busy months round the snowmen and the lyra.) It stands
// `lead` past where the boats are then (about z −160, 23 units from the
// camera), on the `side` bank, `inland` of the water's edge: on the point of
// the bank just short of the headland's shrubs, right of the boats' sail, with
// the mist of the open field past 2027's heart behind it. Seconds: the flame
// burns on the stand for `ignite`, then it takes `flight` to climb away. It
// rises `lift` straight up off its rod, then leans over in a gentle arc to
// `to`: `distance` ahead of the camera as it launches, `bearing` degrees right
// of the middle of the picture and `elevation` degrees above the eye line,
// down the corridor below the date label, so far off that the haze takes it.
export const ROCKET = {
  ...BULLET_LAUNCH,
  side: 1, lead: 9.5, inland: { desktop: .6, mobile: .5 },
  scale: { desktop: .8, mobile: 1.15 },
  ignite: .5, flight: 3.4, lift: 1,
  to: { desktop: { distance: 90, bearing: -6, elevation: 6 }, mobile: { distance: 90, bearing: -6, elevation: 6 } },
} as const;
// Its smoke, in seconds and world units at a scale of 1: a few small puffs
// billow round the stand as it fires, and a thin trail is left along its
// climb, a slim streak between each of these points of its course and the
// next, drawn out behind the rocket as it passes; each grows to its size and
// thins away over `linger`.
export const EXHAUST = {
  pad: 3, padSize: .16, trail: [0, .02, .045, .075, .11, .15, .2, .26, .33, .41, .5, .6, .72, .85], trailSize: .06, linger: 2.6,
} as const;
export const EXHAUST_COUNT = EXHAUST.pad + EXHAUST.trail.length - 1;
// Seconds after it fires by when it has flown and the last of its trail has thinned away.
export const FLOWN = ROCKET.ignite + ROCKET.flight + EXHAUST.linger;

type Point = [number, number, number];
export const launchProgress = () => progressAt(ROCKET.month) + ROCKET.at * ROOM;
// Shares since its launch at progress p: negative while it waits on its stand.
export const rocketTime = (p: number) => (p - launchProgress()) / ROOM;
const smooth = (t: number) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };
// How much of it shows, 0 to 1: it comes out of the haze once the trip's
// stop is behind, and its empty stand goes back into it from .1 to .3 of a
// share after it fires, once the glide has waited for it and moved on, as
// 2027's heart dissolves in across the river and well before December's
// frame of the two hearts. Once fired, the rocket flies on and its trail
// thins away whether or not its stand has gone (FLOWN).
export const rocketShown = (t: number) => smooth((t + .35) / .25) * (1 - smooth((t - .1) / .2));

// Where its stand stands: on the ground, turned to face the camera as it launches.
export function rocketSpot(width: number) {
  const mobile = width < 1, p = launchProgress(), z = routeAt(p) - ROCKET.lead;
  const x = riverCenter(z, width) + ROCKET.side * (bankEdge(z, width) + (mobile ? ROCKET.inland.mobile : ROCKET.inland.desktop));
  const [cx, , cz] = cameraPose(p, width).position;
  return { x, y: groundHeight(x, z, width), z, yaw: Math.atan2(cx - x, cz - z), scale: mobile ? ROCKET.scale.mobile : ROCKET.scale.desktop };
}

export type Course = { from: Point; to: Point; controls: Point[]; scale: number };
// Its course, a curve from its seat on the stand's deck to its last point far
// down the river: straight up off the stand, then leaning over in a gentle
// arc away into the mist, climbing.
export function rocketCourse(width: number): Course {
  const spot = rocketSpot(width), view = width < 1 ? ROCKET.to.mobile : ROCKET.to.desktop;
  const from: Point = [spot.x, spot.y + STAND.deck * spot.scale, spot.z], lift = ROCKET.lift * spot.scale;
  const to = inView(launchProgress(), width, { distance: view.distance, bearing: view.bearing, height: heightAt(view.distance, view.elevation) });
  const up: Point = [from[0], from[1] + lift, from[2]];
  const lean: Point = [up[0] + (to[0] - up[0]) * .3, up[1] + (to[1] - up[1]) * .55, up[2] + (to[2] - up[2]) * .3];
  const controls: Point[] = [from, up, lean, to];
  return { from, to, controls, scale: spot.scale };
}

// A point `s` (0 to 1) along the course, and which way it is heading there.
function along({ controls }: Course, s: number) {
  const point = [0, 1, 2].map(axis => {
    const [a, b, c, d] = controls.map(q => q[axis]), u = 1 - s;
    return u * u * u * a + 3 * u * u * s * b + 3 * u * s * s * c + s * s * s * d;
  }) as Point;
  const heading = [0, 1, 2].map(axis => {
    const [a, b, c, d] = controls.map(q => q[axis]), u = 1 - s;
    return 3 * u * u * (b - a) + 6 * u * s * (c - b) + 3 * s * s * (d - c);
  });
  const length = Math.hypot(...heading);
  return { point, heading: heading.map(v => v / length) as Point };
}

// How far along its course it is `air` seconds after it fired: still on the
// stand while it ignites, then gathering speed.
const travelled = (air: number) => Math.min(1, Math.max(0, (air - ROCKET.ignite) / ROCKET.flight)) ** 1.7;

// Where the rocket is `air` seconds after it fired (null: still waiting), the
// way its nose points, how hard its flame burns (0 to 1) and whether it has
// gone out of sight.
export function rocketInFlight(course: Course, air: number | null) {
  if (air === null) return { position: course.from, heading: [0, 1, 0] as Point, burn: 0, gone: false };
  const s = travelled(air), { point, heading } = along(course, s);
  return { position: point, heading, burn: air < ROCKET.flight + ROCKET.ignite ? 1 : 0, gone: s >= 1 };
}

// A puff, or a streak of the trail: a ball `size` across stretched to
// `length` along `dir`.
export type Puff = { x: number; y: number; z: number; size: number; length: number; dir: Point };
const UP: Point = [0, 1, 0];
// Each puff of its exhaust `air` seconds after it fired: those round the
// stand from the moment it fires, and each streak of the trail drawn out
// behind the rocket from its point to the next as it passes. One not yet
// made, or gone, has size 0.
export function exhaust(course: Course, air: number | null): Puff[] {
  const k = course.scale, [x, y, z] = course.from, s = air === null ? -1 : travelled(air);
  const puff = (born: number | null, size: number, at: Point, drift: Point, length = 0, dir = UP): Puff => {
    const age = air === null || born === null ? -1 : air - born;
    if (age < 0 || age > EXHAUST.linger) return { x: at[0], y: at[1], z: at[2], size: 0, length: 0, dir };
    // Billows out fast, then thins away, drifting as it goes.
    const grow = smooth(age / .5) * (1 - smooth((age - EXHAUST.linger * .45) / (EXHAUST.linger * .55)));
    const spread = 1 - Math.exp(-age * 1.5), across = size * k * (.5 + .7 * spread) * grow;
    return { x: at[0] + drift[0] * spread, y: at[1] + drift[1] * spread, z: at[2] + drift[2] * spread, size: across, length: Math.max(across, length), dir };
  };
  const pad = Array.from({ length: EXHAUST.pad }, (_, i) => {
    const angle = i / EXHAUST.pad * Math.PI * 2 + .6;
    return puff(i * .12, EXHAUST.padSize, [x, y - .1 * k, z], [Math.cos(angle) * .5 * k, .25 * k, Math.sin(angle) * .5 * k]);
  });
  // A streak starts as the rocket passes its point and reaches on behind it
  // to the next, overlapping it a little so the trail runs unbroken.
  const trail = EXHAUST.trail.slice(0, -1).map((from, i) => {
    const born = s >= from ? ROCKET.ignite + ROCKET.flight * from ** (1 / 1.7) : null;
    const a = along(course, from).point, b = along(course, Math.max(from, Math.min(s, EXHAUST.trail[i + 1]))).point;
    const half = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 2;
    const dir = half > 1e-6 ? [0, 1, 2].map(axis => (b[axis] - a[axis]) / (half * 2)) as Point : UP;
    return puff(born, EXHAUST.trailSize, [0, 1, 2].map(axis => (a[axis] + b[axis]) / 2) as Point, [0, .2 * k, 0], half * 1.15, dir);
  });
  return [...pad, ...trail];
}
