// April 2026, they get engaged: rose petals trail behind the catamaran. From
// as the date shows they blow off the deck's after edge onto the water between
// the sterns and spread out in its wake, and a few flutter down from the big
// sail as it unrolls (as if rolled up in it). They thin out and stop as the
// trip's date shows, and each sinks out of sight a little way behind, so the
// trail is gone as the boats enter the S-bend, before it swings the river. Drawn by EngagementPetals.tsx. Pure, so it
// can be tested.
import { DATES, ROOM, progressAt, scrolledSince } from '../journey.ts';
import { bankEdge, random, riverCenter } from '../gardenGeometry.ts';
import { BIG_RIG } from '../storyBoatGeometry.ts';
import { BOAT_SCALE, CATAMARAN, HULL_HALF_BEAM, RIG_CHANGE, boatPose, rigging } from '../storyBoats.ts';

// In milestone shares since the engagement's date: the wake's petals are
// released from `from` to `to`, thinning out towards the end, and the sail's
// over its unrolling. Each floats for `life`, the last of it sinking.
// `settled` petals rest on the water at the engagement's still under reduced
// motion. Sizes are a petal's length in world units, larger than life so
// they read on a phone.
export const PETALS = {
  wake: { count: 84, from: .02, to: .62 },
  sail: { count: 14 },
  life: .38, sink: .35,
  settled: 14,
  size: { desktop: .13, mobile: .17 },
  colours: ['#f2b8c3', '#e89aab', '#f7d4da', '#d95f77', '#c4405a', '#eaa7b4'],
} as const;
// Soft pinks mostly, a few rose reds.
const COLOUR_WEIGHTS = [3, 3, 2, 2, 1, 2];

type Point = [number, number, number];
export type Petal = {
  // When it is released, in shares since the date, and from where in the
  // catamaran's frame (model units: x to starboard, y up, z aft).
  at: number; from: Point;
  // Where it lands, in the same frame as it was released, and how far it then
  // spreads sideways in the wake.
  to: [number, number]; spread: number;
  // Seconds falling to the water; its size and turn; its colour's index.
  fall: number; size: number; turn: number; colour: number;
};

export const petalTime = (p: number) => scrolledSince(DATES.engaged, p);

// Every petal, the wake's then the sail's, in a fixed order.
export const PETAL_LIST: readonly Petal[] = (() => {
  const rand = random(4026), { wake, sail } = PETALS;
  const colour = () => {
    let r = rand() * COLOUR_WEIGHTS.reduce((a, b) => a + b);
    return COLOUR_WEIGHTS.findIndex(w => (r -= w) < 0);
  };
  // Between the hulls, clear of them.
  const between = CATAMARAN - HULL_HALF_BEAM.catamaran - .06;
  const wakePetals = Array.from({ length: wake.count }, (_, i): Petal => {
    // Spaced out more and more towards the end, so the trail eases off.
    const k = (i + rand() * .8) / wake.count, x = (rand() - .5) * 2 * .45;
    return {
      at: wake.from + (wake.to - wake.from) * k ** 1.6,
      from: [x, .25, .66], to: [Math.max(-between, Math.min(between, x * .8 + (rand() - .5) * .2)), .85 + rand() * .45],
      spread: (rand() - .5) * 1.4, fall: .45 + rand() * .25, size: .8 + rand() * .4, turn: rand() * Math.PI * 2, colour: colour(),
    };
  });
  // From the cloth as it unrolls aft along the boom, out to port, landing
  // outboard of the port hull.
  const [unrollFrom, unrollTo] = RIG_CHANGE.unfurl, swing = -BIG_RIG.eased;
  const sailPetals = Array.from({ length: sail.count }, (_, i): Petal => {
    const at = unrollFrom + (unrollTo - unrollFrom) * (i + rand()) / sail.count;
    const up = rand() * .8, along = rigging(progressAt(DATES.engaged) + at * ROOM).unfurl * BIG_RIG.foot * (1 - up) * (.35 + rand() * .65);
    const x = Math.sin(swing) * along, z = BIG_RIG.z + Math.cos(swing) * along, y = BIG_RIG.deck + BIG_RIG.boom + up * (BIG_RIG.head - BIG_RIG.boom);
    return {
      at, from: [x, y, z], to: [Math.min(x, -(CATAMARAN + HULL_HALF_BEAM.catamaran + .15)) - rand() * .5, z + .3 + rand() * .7],
      spread: -rand() * .5, fall: 1.4 + y * 1.1 + rand() * .6, size: .9 + rand() * .3, turn: rand() * Math.PI * 2, colour: colour(),
    };
  });
  return [...wakePetals, ...sailPetals];
})();

// When the trail is drawn, in shares since the date: from the first release
// until the last petal has sunk.
export const PETAL_WINDOW = [Math.min(...PETAL_LIST.map(petal => petal.at)), Math.max(...PETAL_LIST.map(petal => petal.at)) + PETALS.life] as const;
export const petalsShown = (t: number) => t > PETAL_WINDOW[0] && t < PETAL_WINDOW[1];
// Afloat (or falling) at t, shares since the date.
export const afloat = (petal: Petal, t: number) => t >= petal.at && t < petal.at + PETALS.life;
// How large it is, as a share of its size, `age` shares after its release:
// full while it floats, shrinking as it sinks at the end.
export const petalScale = (age: number) => {
  const sink = (age - PETALS.life * (1 - PETALS.sink)) / (PETALS.life * PETALS.sink);
  return age < 0 || sink >= 1 ? 0 : 1 - Math.max(0, sink) ** 2;
};

// From the catamaran's frame at p into the world, in world units.
function aboard(p: number, width: number, [u, y, v]: Point): Point {
  const { x, z, yaw } = boatPose(p, width), c = Math.cos(yaw), s = Math.sin(yaw);
  return [x + (c * u + s * v) * BOAT_SCALE, y * BOAT_SCALE, z + (-s * u + c * v) * BOAT_SCALE];
}
const onWater = ([x, y, z]: Point, width: number): Point => {
  const middle = riverCenter(z, width), reach = bankEdge(z, width) * .85;
  return [Math.min(middle + reach, Math.max(middle - reach, x)), y, z];
};

// Where a petal is released in the world, where it lands, and the heading
// its wake spreads across, from where the catamaran was as it let it go: the
// boat sails on and leaves it behind. Worked out once for each petal.
export type Course = { from: Point; to: Point; yaw: number };
export function petalCourse(petal: Petal, width: number): Course {
  const p = progressAt(DATES.engaged) + petal.at * ROOM;
  return { from: aboard(p, width, petal.from), to: onWater(aboard(p, width, [petal.to[0], 0, petal.to[1]]), width), yaw: boatPose(p, width).yaw };
}
// Where it floats `age` shares after its release: spreading out sideways in
// the wake, across the catamaran's heading as it was let go.
export function floatPoint(petal: Petal, { to: [x, y, z], yaw }: Course, age: number, width: number): Point {
  const out = petal.spread * BOAT_SCALE * (1 - Math.exp(-Math.max(0, age) / .12));
  return onWater([x + Math.cos(yaw) * out, y, z - Math.sin(yaw) * out], width);
}

// Under reduced motion, at the engagement's still: a few petals resting on
// the water between and behind the sterns, as a short trail, in the world.
export function restingPetals(width: number) {
  const p = progressAt(DATES.engaged), rand = random(417);
  return PETAL_LIST.slice(0, PETALS.settled).map((petal, i) => {
    const back = 1 + i / PETALS.settled * 2.2, side = (rand() - .5) * (.4 + back * .35);
    return { petal, position: onWater(aboard(p, width, [side, 0, back]), width) };
  });
}
