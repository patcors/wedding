// May 2024 to mid 2025, their apartments, told as two birds and their
// birdhouses on the bank: each buys an apartment (a birdhouse goes up for
// each, and a bird flies in to each), Patrick stays at Amelia's while he
// renovates his (his bird flies over to hers, and scaffolding goes up round
// his), they live apart for about a year (his bird flies home and the
// scaffolding comes down), and then Amelia moves into his (her bird flies
// over to his). Where the birdhouses stand, when each of these happens and
// where the birds perch and fly; drawn by Birdhouses.tsx with the models in
// birdhouseGeometry.ts. Pure, so it can be tested.
import { cameraPose } from '../cameraRig.ts';
import { bankEdge, groundHeight, riverCenter } from '../gardenGeometry.ts';
import { AMELIA_MOVED_IN, ROOM, progressAt, routeAt } from '../journey.ts';
import { BIRDHOUSE } from './birdhouseGeometry.ts';

// When Patrick's bird goes home, his renovation done. Not a date they have
// given: a month after he moved in, so they then live apart about a year
// until AMELIA_MOVED_IN. Change it here if Amelia gives the month.
export const PATRICK_HOME = '2024-07';

export type Owner = 'amelia' | 'patrick';
// The birds are seen in two pairs of birdhouses, so each stage plays close to
// the camera: the first goes up as May 2024 shows, a little way past the
// boats, and is passed after Patrick's bird has flown home; the second comes
// out of the haze once he has, on the other bank, each bird at home, and is
// passed after Amelia's has flown over to his. Each stands `lead` past where
// the boats are on its last stage's date, `inland` of the water's edge
// (portrait's in `mobile`), on the `side` bank. Its two houses stand `apart`
// either side of it across the picture, Amelia's on the left as her boat is,
// turned to face the camera then. Larger than life, and larger again in
// portrait's wider lens, so the birds read.
export const NESTS = {
  pairs: [{ side: -1, last: PATRICK_HOME, lead: 4.5 }, { side: 1, last: AMELIA_MOVED_IN, lead: 3.5 }],
  desktop: { inland: 1.1, apart: .8, scale: 1.5 },
  mobile: { inland: .6, apart: .52, scale: 1.9 },
  // The second pair comes up out of the haze this far from the camera.
  reach: { desktop: 30, mobile: 26 },
  // Seconds: a house going up, a bird's flight, the scaffolding going up or down.
  rise: .9, flight: 1.5, scaffold: .7,
} as const;

// What happens, in order, and when: `at` shares after `month` shows. Each
// event fires once the scroll reaches it and then plays in real time.
// `build` raises a pair of houses, `scaffold` puts it up round Patrick's
// house in the first pair (1) or takes it down (0), and `moves` sends birds
// to a house's roof, where they show against the trees: `home` is its own
// bird's place, `guest` beside it.
export type Perch = { house: Owner; spot: 'home' | 'guest' };
export type NestEvent = { month: string; at: number; pair: 0 | 1; build?: boolean; scaffold?: 0 | 1; moves?: Partial<Record<Owner, Perch>> };
export const NEST_EVENTS: readonly NestEvent[] = [
  { month: '2024-05', at: .02, pair: 0, build: true },
  { month: '2024-05', at: .1, pair: 0, moves: { amelia: { house: 'amelia', spot: 'home' }, patrick: { house: 'patrick', spot: 'home' } } },
  { month: '2024-06', at: .06, pair: 0, scaffold: 1, moves: { patrick: { house: 'amelia', spot: 'guest' } } },
  { month: PATRICK_HOME, at: 0, pair: 0, scaffold: 0, moves: { patrick: { house: 'patrick', spot: 'home' } } },
  // The second pair rises as it comes into reach (see nestTriggers), its
  // birds already at home.
  { month: PATRICK_HOME, at: 0, pair: 1, build: true },
  { month: AMELIA_MOVED_IN, at: 0, pair: 1, moves: { amelia: { house: 'patrick', spot: 'guest' } } },
];
// Each pair's birds before its first move: none yet in the first (they fly
// in from the trees), each at home in the second.
const START: Record<0 | 1, Record<Owner, Perch | null>> = {
  0: { amelia: null, patrick: null },
  1: { amelia: { house: 'amelia', spot: 'home' }, patrick: { house: 'patrick', spot: 'home' } },
};

const layout = (width: number) => width < 1 ? NESTS.mobile : NESTS.desktop;

export type HouseSpot = { x: number; y: number; z: number; yaw: number; scale: number };
// Where each pair's two houses stand: on the ground, facing the camera as
// its last stage's date shows.
export function nestSpots(width: number): Record<Owner, HouseSpot>[] {
  const { inland, apart, scale } = layout(width);
  return NESTS.pairs.map(({ side, last, lead }) => {
    const p = progressAt(last), z = routeAt(p) - lead;
    const x = riverCenter(z, width) + side * (bankEdge(z, width) + inland);
    const [cx, , cz] = cameraPose(p, width).position;
    const yaw = Math.atan2(cx - x, cz - z);
    // Across the picture: the pair's own +x, Amelia's to the left.
    const across = (owner: Owner) => (owner === 'amelia' ? -1 : 1) * apart;
    const house = (owner: Owner): HouseSpot => {
      const hx = x + Math.cos(yaw) * across(owner), hz = z - Math.sin(yaw) * across(owner);
      // Its post sunk to the lowest ground under it, so it never floats.
      return { x: hx, y: Math.min(groundHeight(hx, hz, width), groundHeight(hx, hz + .1, width)) - .03, z: hz, yaw, scale };
    };
    return { amelia: house('amelia'), patrick: house('patrick') };
  });
}

// The first progress at which the boats are at z (routeAt falls through the voyage).
function progressAtRoute(z: number) {
  let lo = 0, hi = 1;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (routeAt(mid) > z) lo = mid; else hi = mid; }
  return hi;
}
// The progress at which each event fires. The second pair's houses go up
// once Patrick's bird is home and the camera is within reach of them.
export function nestTriggers(width: number) {
  const spots = nestSpots(width), reach = width < 1 ? NESTS.reach.mobile : NESTS.reach.desktop;
  return NEST_EVENTS.map(({ month, at, pair, build }) => {
    const p = progressAt(month) + at * ROOM;
    if (!build || pair === 0) return p;
    const behind = cameraPose(p, width).position[2] - routeAt(p);
    return Math.max(p, progressAtRoute(spots[pair].patrick.z + reach - behind));
  });
}
// Whether event i has fired at progress p. Under reduced motion the camera
// cuts to each milestone's still, at its date, so an event a little after a
// date counts from the date.
export const fired = (i: number, triggers: readonly number[], p: number, reduced: boolean) =>
  p >= triggers[i] - (reduced ? NEST_EVENTS[i].at * ROOM : 0) - 1e-9;

type Point = { x: number; y: number; z: number };
// A perch on a house's roof, in the world.
export function perchPoint(house: HouseSpot, spot: Perch['spot']): Point {
  const [lx, ly, lz] = BIRDHOUSE.perches[spot];
  const c = Math.cos(house.yaw), s = Math.sin(house.yaw), k = house.scale;
  return { x: house.x + (c * lx + s * lz) * k, y: house.y + ly * k, z: house.z + (-s * lx + c * lz) * k };
}
// Where a bird flying in to its first house sets out from: the trees behind it.
const fromTrees = (house: HouseSpot, side: number, owner: Owner): Point =>
  ({ x: house.x + side * 2.2, y: house.y + 2.6 * house.scale, z: house.z + (owner === 'amelia' ? .9 : -.9) });

export type BirdPose = { x: number; y: number; z: number; heading: number; flying: number; shown: boolean };
const smooth = (t: number) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };
// Where each pair's birds are, given seconds since each event fired (null
// before it has) and the houses (nestSpots). A bird in flight is on an arc from its last perch to the
// next; `heading` is the yaw it faces (towards +z at 0), and `flying` how
// much it is flapping, 0 to 1.
export function birdPoses(since: readonly (number | null)[], spots: Record<Owner, HouseSpot>[]): Record<Owner, BirdPose>[] {
  return ([0, 1] as const).map(pair => {
    const houses = spots[pair], side = NESTS.pairs[pair].side;
    const pose = (owner: Owner): BirdPose => {
      let perch = START[pair][owner], from: Point | null = null, air = Infinity;
      NEST_EVENTS.forEach((event, i) => {
        const to = event.pair === pair ? event.moves?.[owner] : undefined, s = since[i];
        if (!to || s == null) return;
        from = perch ? perchPoint(houses[perch.house], perch.spot) : fromTrees(houses[to.house], side, owner);
        perch = to; air = s;
      });
      if (!perch) return { x: 0, y: 0, z: 0, heading: 0, flying: 0, shown: false };
      const house = houses[perch.house], end = perchPoint(house, perch.spot);
      // Perched, it faces the camera, turned a little to show its side.
      const rest = house.yaw + (owner === 'amelia' ? -.7 : .7);
      const k = air / NESTS.flight;
      if (!from || k >= 1) return { ...end, heading: rest, flying: 0, shown: true };
      const start: Point = from, u = smooth(k);
      const hop = .55 * house.scale + Math.abs(end.y - start.y) * .3;
      const heading = Math.atan2(end.x - start.x, end.z - start.z);
      return {
        x: start.x + (end.x - start.x) * u, y: start.y + (end.y - start.y) * u + hop * Math.sin(Math.PI * u), z: start.z + (end.z - start.z) * u,
        // Turns to the camera as it lands, the shorter way round.
        heading: heading + Math.atan2(Math.sin(rest - heading), Math.cos(rest - heading)) * smooth((k - .8) / .2), flying: 1 - smooth((k - .85) / .15), shown: true,
      };
    };
    return { amelia: pose('amelia'), patrick: pose('patrick') };
  });
}
