// May 2024 to mid 2025, their apartments, told as two birds and their
// birdhouses, one on each bank of the river, facing each other across the
// water: each buys an apartment and Patrick stays at Amelia's while he
// renovates his (both houses go up, his with scaffolding round it, and both
// birds fly in to hers), they live apart for about a year (the scaffolding
// comes down and his bird flies home across the river), and then Amelia moves
// into his (her bird flies over to his). They bought on the same street, so
// each house has its number, and a street sign on the tree beside hers names
// it. Where the birdhouses and the sign stand, when each of these happens and
// where the birds perch and fly; drawn by Birdhouses.tsx with the models in
// birdhouseGeometry.ts and the sign and numbers in streetSign.ts. Pure, so it
// can be tested.
import { cameraPose } from '../cameraRig.ts';
import { bankEdge, groundHeight, riverCenter } from '../gardenGeometry.ts';
import { treePlacements, type Placement } from '../gardenTreeSpots.ts';
import { ROOM, progressAt, routeAt } from '../journey.ts';
import { BIRDHOUSE } from './birdhouseGeometry.ts';

// When Patrick's bird goes home, his renovation done: August 2024 (he moved
// out about the 12th), so they then live apart until AMELIA_MOVED_IN
// (journey.ts). It is the
// month they start dating, so it flies home across the river just before the
// date shows, as July does, while the dating butterflies come out of the
// trees on his bank beside the boats, short of his house (see datingFlight.ts).
export const PATRICK_HOME = '2024-08';
// When her bird flies over to his, standing in for AMELIA_MOVED_IN (March
// 2026). Off the true timeline, so the move is seen while both houses are
// well in the picture: by 2025 the boats are long past them.
// It is the first month after dating's date has held, so dating's stop shows
// each bird at home.
export const MOVE_SHOWN = '2024-09';

export type Owner = 'amelia' | 'patrick';
// One house each side of the river: Amelia's on her bank, the left (−1), and
// Patrick's on his, the right (1), each `lead` past where the boats are on
// PATRICK_HOME's date and `inland` of the water's edge. They face each other
// across the water: each is turned to face the camera as his bird flies home
// and then `turn` radians further round towards the river. They stand far
// enough ahead to stay in the picture through every step, up to her flight
// over and a good while after. A phone sees only about 17° either side of the
// middle, so there they stand right by the water, and Patrick's a little
// further on, as the river starts to bend left after the new year and turns
// the camera away from his bank. Hers stands short of 2025's oar further down
// the same bank (more than 5 units). Larger than life, and larger again in
// portrait's wider lens, so the birds and the house numbers read.
export const NESTS = {
  side: { amelia: -1, patrick: 1 },
  desktop: { amelia: { lead: 4.9, inland: .55 }, patrick: { lead: 5.9, inland: .6 }, scale: 1.9 },
  mobile: { amelia: { lead: 5.1, inland: .12 }, patrick: { lead: 7.9, inland: .12 }, scale: 2.2 },
  turn: .55,
  // Seconds: the houses going up (the scaffolding with them), a bird's
  // flight, the scaffolding coming down.
  rise: .9, flight: 1.5, scaffold: .7,
} as const;

// What happens, in order, and when: `at` shares after `month` shows (before
// it where `at` is negative). Each event fires once the scroll reaches it and
// then plays in real time, so a guest scrolling on has gone a way down the
// river by the time a bird lands. So each step comes early, done while the
// houses are well in the picture, and the settled scene stays a good while
// before they leave it, even on a phone: both houses spring up just before
// May 2024 shows, as 2023's last months rush by, the scaffolding already round
// his, and both birds fly in to hers as it shows, his from across the river
// as her guest, so June's living together shows the same scene; his bird
// flies home across the river as July shows (any earlier would be in June,
// while they lived together), while the dating butterflies come out of the
// trees; and her bird flies over to his as September 2024 shows (MOVE_SHOWN).
// `build` raises the houses, `scaffold` puts it up round Patrick's house (1),
// rising with it, or takes it down (0), and `moves` sends birds to a house's
// roof, where they show against the trees: `home` is its own bird's place,
// `guest` beside it.
export type Perch = { house: Owner; spot: 'home' | 'guest' };
export type NestEvent = { month: string; at: number; build?: boolean; scaffold?: 0 | 1; moves?: Partial<Record<Owner, Perch>> };
export const NEST_EVENTS: readonly NestEvent[] = [
  { month: '2024-05', at: -.05, build: true, scaffold: 1 },
  { month: '2024-05', at: 0, moves: { amelia: { house: 'amelia', spot: 'home' }, patrick: { house: 'amelia', spot: 'guest' } } },
  { month: PATRICK_HOME, at: -.15, scaffold: 0, moves: { patrick: { house: 'patrick', spot: 'home' } } },
  { month: MOVE_SHOWN, at: 0, moves: { amelia: { house: 'patrick', spot: 'guest' } } },
];

const layout = (width: number) => width < 1 ? NESTS.mobile : NESTS.desktop;

export type HouseSpot = { x: number; y: number; z: number; yaw: number; scale: number };
// Where each house stands: on the ground on its own bank, facing across the
// river and up it towards the boats.
export function nestSpots(width: number): Record<Owner, HouseSpot> {
  const place = layout(width), p = progressAt(PATRICK_HOME), [cx, , cz] = cameraPose(p, width).position;
  const house = (owner: Owner): HouseSpot => {
    const side = NESTS.side[owner], { lead, inland } = place[owner];
    const z = routeAt(p) - lead, x = riverCenter(z, width) + side * (bankEdge(z, width) + inland);
    // Its post sunk to the lowest ground under it, so it never floats.
    return { x, y: Math.min(groundHeight(x, z, width), groundHeight(x, z + .1, width)) - .03, z,
      yaw: Math.atan2(cx - x, cz - z) - side * NESTS.turn, scale: place.scale };
  };
  return { amelia: house('amelia'), patrick: house('patrick') };
}

// The progress at which each event fires.
export const nestTriggers = () => NEST_EVENTS.map(({ month, at }) => progressAt(month) + at * ROOM);
// Whether event i has fired at progress p. Under reduced motion the camera
// cuts to each milestone's still, at its date, so an event a little before or
// after a date counts from the date.
export const fired = (i: number, triggers: readonly number[], p: number, reduced: boolean) =>
  p >= triggers[i] - (reduced ? NEST_EVENTS[i].at * ROOM : 0) - 1e-9;

type Point = { x: number; y: number; z: number };
// A point in a house's own frame, in the world.
export function onHouse(house: HouseSpot, [lx, ly, lz]: readonly [number, number, number]): Point {
  const c = Math.cos(house.yaw), s = Math.sin(house.yaw), k = house.scale;
  return { x: house.x + (c * lx + s * lz) * k, y: house.y + ly * k, z: house.z + (-s * lx + c * lz) * k };
}
// A perch on a house's roof, in the world.
export const perchPoint = (house: HouseSpot, spot: Perch['spot']) => onHouse(house, BIRDHOUSE.perches[spot]);
// Where a bird flying in for the first time sets out from: the trees on its
// own bank behind its own house, so Patrick's crosses the river to hers.
const fromTrees = (own: HouseSpot, side: number): Point => ({ x: own.x + side * 2.2, y: own.y + 2.6 * own.scale, z: own.z - .9 });

export type BirdPose = { x: number; y: number; z: number; heading: number; flying: number; shown: boolean };
const smooth = (t: number) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };
// Where the birds are, given seconds since each event fired (null before it
// has) and the houses (nestSpots). A bird in flight is on an arc from its
// last perch to the next, higher the further it goes, so it crosses the river
// well above the boats' masts; `heading` is the yaw it faces (towards +z at
// 0), and `flying` how much it is flapping, 0 to 1.
export function birdPoses(since: readonly (number | null)[], houses: Record<Owner, HouseSpot>): Record<Owner, BirdPose> {
  const pose = (owner: Owner): BirdPose => {
    let perch: Perch | null = null, from: Point | null = null, air = Infinity;
    NEST_EVENTS.forEach((event, i) => {
      const to = event.moves?.[owner], s = since[i];
      if (!to || s == null) return;
      from = perch ? perchPoint(houses[perch.house], perch.spot) : fromTrees(houses[owner], NESTS.side[owner]);
      perch = to; air = s;
    });
    if (!perch) return { x: 0, y: 0, z: 0, heading: 0, flying: 0, shown: false };
    const { house: at, spot } = perch as Perch, house = houses[at], end = perchPoint(house, spot);
    // Perched, it faces the camera, turned a little to show its side.
    const rest = house.yaw + NESTS.side[at] * NESTS.turn + (owner === 'amelia' ? -.7 : .7);
    const k = air / NESTS.flight;
    if (!from || k >= 1) return { ...end, heading: rest, flying: 0, shown: true };
    const start: Point = from, u = smooth(k);
    const hop = .55 * house.scale + Math.abs(end.y - start.y) * .3 + Math.hypot(end.x - start.x, end.z - start.z) * .06;
    const heading = Math.atan2(end.x - start.x, end.z - start.z);
    return {
      x: start.x + (end.x - start.x) * u, y: start.y + (end.y - start.y) * u + hop * Math.sin(Math.PI * u), z: start.z + (end.z - start.z) * u,
      // Turns to the camera as it lands, the shorter way round.
      heading: heading + Math.atan2(Math.sin(rest - heading), Math.cos(rest - heading)) * smooth((k - .8) / .2), flying: 1 - smooth((k - .85) / .15), shown: true,
    };
  };
  return { amelia: pose('amelia'), patrick: pose('patrick') };
}

// The street sign: on the tree on Amelia's bank standing nearest her house
// (an ash planted by the water just past it for the sign, gardenTreeSpots.ts),
// fixed flat to the face of its trunk turned to the camera as his bird flies
// home, `height` up the trunk in world units. Shown, like the carvings,
// while its tree is near the camera, as street signs are always there.
export const SIGN = { height: { desktop: 2.7, mobile: 3 } } as const;
export function signTree(width: number): Placement {
  const mobile = width < 1, { x, z } = nestSpots(width).amelia;
  const left = treePlacements(width, mobile).filter(t => t.type < 4 && t.y === undefined && t.x < riverCenter(t.z, width) - bankEdge(t.z, width));
  return left.reduce((best, t) => Math.hypot(t.x - x, t.z - z) < Math.hypot(best.x - x, best.z - z) ? t : best);
}
// Where the sign faces from: the camera as his bird flies home.
export const signFaces = (width: number) => {
  const [x, , z] = cameraPose(nestTriggers()[2], width).position;
  return { x, z };
};
