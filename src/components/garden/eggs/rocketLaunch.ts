// 2025: Bullet, the product Patrick worked on, as a brass bullet of a
// rocket on a launch stand on the right bank. It comes out of the haze on its
// stand, and as the scroll passes its moment it fires and climbs away up the
// river's open sky, trailing puffs of smoke. It isn't a milestone, so it
// keeps its own time. Where it stands and flies; drawn by Rocket.tsx with the
// models in rocketGeometry.ts. Pure, so it can be tested.
import { cameraPose } from '../cameraRig.ts';
import { bankEdge, groundHeight, riverCenter } from '../gardenGeometry.ts';
import { ROOM, progressAt, routeAt } from '../journey.ts';
import { heightAt, inView, overRiver } from './egg.ts';
import { STAND } from './rocketGeometry.ts';

// It launches `at` shares after `month` shows, just after January 2025
// turns, as a rocket goes up at New Year. Through the rest of 2025 the river
// bends left and turns the camera with it, putting the right bank at the edge
// of a phone's picture, so it fires before that, while the whole launch plays
// out well inside it (at the snow trip's stop, where it used to fire before
// 2024 and 2025 grew longer, it would now go up at the picture's edge). It
// stands `lead` past where the boats are then (about z −117), on the `side`
// bank, `inland` of the water's edge: short of the second pair of birdhouses
// on the same bank, further inland on desktop and right by the water on a
// phone, across the river from 2025's oar. Larger than life, and larger
// again in portrait's wider lens. Seconds: the flame burns on the stand for
// `ignite`, then it takes `flight` to climb out of sight. It rises `lift`
// straight up off its rod, then turns away up the river to `to`:
// `distance` ahead of the camera as it launches, `bearing` degrees right of
// the middle of the picture and `elevation` degrees above the eye line, in
// the open sky between the canopies and below the date label.
export const ROCKET = {
  month: '2025-01', at: .05,
  side: 1, lead: 7.3, inland: { desktop: 1.3, mobile: .4 },
  scale: { desktop: 1.5, mobile: 1.9 },
  ignite: .5, flight: 3.4, lift: 1.6,
  to: { desktop: { distance: 44, bearing: -2, elevation: 8 }, mobile: { distance: 44, bearing: -1, elevation: 16 } },
} as const;
// Its smoke, in seconds and world units at desktop's scale: a few puffs
// billow round the stand as it fires, and more are left along its climb, at
// these points of its course; each grows to its size and thins away over
// `linger`.
export const EXHAUST = {
  pad: 3, padSize: .22, trail: [.02, .04, .07, .1, .14, .18, .23, .29, .35, .42, .5, .58, .67], trailSize: .13, linger: 2.6,
} as const;
export const EXHAUST_COUNT = EXHAUST.pad + EXHAUST.trail.length;

type Point = [number, number, number];
export const launchProgress = () => progressAt(ROCKET.month) + ROCKET.at * ROOM;
// Shares since its launch at progress p: negative while it waits on its stand.
export const rocketTime = (p: number) => (p - launchProgress()) / ROOM;
const smooth = (t: number) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };
// How much of it shows, 0 to 1: it comes out of the haze as the months
// after dating roll on, once dating's date has held and the second pair of
// birdhouses has gone up, rather than as soon as it is in reach, at the
// apartments.
export const rocketShown = (t: number) => smooth((t + .3) / .2);

// Where its stand stands: on the ground, turned to face the camera as it launches.
export function rocketSpot(width: number) {
  const mobile = width < 1, p = launchProgress(), z = routeAt(p) - ROCKET.lead;
  const x = riverCenter(z, width) + ROCKET.side * (bankEdge(z, width) + (mobile ? ROCKET.inland.mobile : ROCKET.inland.desktop));
  const [cx, , cz] = cameraPose(p, width).position;
  return { x, y: groundHeight(x, z, width), z, yaw: Math.atan2(cx - x, cz - z), scale: mobile ? ROCKET.scale.mobile : ROCKET.scale.desktop };
}

export type Course = { from: Point; to: Point; controls: Point[]; scale: number };
// Its course, a curve from its seat on the stand's deck to its last point up
// the river: straight up off the stand, out over the middle of the river,
// then away up it, climbing.
export function rocketCourse(width: number): Course {
  const spot = rocketSpot(width), view = width < 1 ? ROCKET.to.mobile : ROCKET.to.desktop;
  const from: Point = [spot.x, spot.y + STAND.deck * spot.scale, spot.z], lift = ROCKET.lift * spot.scale / ROCKET.scale.desktop;
  const to = overRiver(inView(launchProgress(), width, { distance: view.distance, bearing: view.bearing, height: heightAt(view.distance, view.elevation) }), width, .5);
  const turn = from[2] + (to[2] - from[2]) * .3;
  const controls: Point[] = [from, [from[0], from[1] + lift, from[2]], [riverCenter(turn, width), from[1] + lift * 1.8, turn], to];
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

export type Puff = { x: number; y: number; z: number; size: number };
// Each puff of its exhaust `air` seconds after it fired: those round the
// stand from the moment it fires, the others as it passes their point.
// A puff not yet made, or gone, has size 0.
export function exhaust(course: Course, air: number | null): Puff[] {
  const k = course.scale / ROCKET.scale.desktop, [x, y, z] = course.from;
  const puff = (born: number | null, size: number, at: Point, drift: Point): Puff => {
    const age = air === null || born === null ? -1 : air - born;
    if (age < 0 || age > EXHAUST.linger) return { x: at[0], y: at[1], z: at[2], size: 0 };
    // Billows out fast, then thins away, drifting as it goes.
    const grow = smooth(age / .5) * (1 - smooth((age - EXHAUST.linger * .45) / (EXHAUST.linger * .55)));
    const spread = 1 - Math.exp(-age * 1.5);
    return { x: at[0] + drift[0] * spread, y: at[1] + drift[1] * spread, z: at[2] + drift[2] * spread, size: size * k * (.5 + .7 * spread) * grow };
  };
  const pad = Array.from({ length: EXHAUST.pad }, (_, i) => {
    const angle = i / EXHAUST.pad * Math.PI * 2 + .6;
    return puff(i * .12, EXHAUST.padSize, [x, y - .1 * k, z], [Math.cos(angle) * .5 * k, .25 * k, Math.sin(angle) * .5 * k]);
  });
  // A trail puff is made as the rocket passes its point.
  const trail = EXHAUST.trail.map((s, i) => {
    let born: number | null = null;
    if (air !== null && travelled(air) >= s) born = ROCKET.ignite + ROCKET.flight * s ** (1 / 1.7);
    return puff(born, EXHAUST.trailSize * (1 + i * .06), along(course, s).point, [0, .3 * k, 0]);
  });
  return [...pad, ...trail];
}
