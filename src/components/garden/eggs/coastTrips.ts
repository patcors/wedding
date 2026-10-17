// November 2017, their first trip away with friends, down the coast, and a
// trip down the coast with friends every November or December after it until
// 2023: friends' paper boats join the two boats on the river for a while.
// Where each is, as scroll since its trip's month; drawn by FriendsFleet.tsx.
// Pure, so it can be tested.
import { GARDEN_CAMERA, bankEdge, groundHeight, riverCenter } from '../gardenGeometry.ts';
import { ARRIVAL_END, ROOM, progressAt, routeAt, scrolledSince } from '../journey.ts';
import { BOAT_SCALE, HULL_HALF_BEAM, boatPose } from '../storyBoats.ts';

// Each friend's boat, folded from its own paper: `paper` tints the whole
// boat, and `trim`, if set, colours its upright centre fold. Plain for now;
// add fields here as particular friends' boats are given features of their own.
export type Friend = { paper: string; trim: string | null };
export const FRIENDS: readonly Friend[] = [
  { paper: '#ffffff', trim: null },
  { paper: '#fff6e8', trim: null },
  { paper: '#f2f5fb', trim: null },
  { paper: '#fdeeea', trim: null },
  { paper: '#f2f6ea', trim: null },
  { paper: '#fff8dc', trim: null },
  { paper: '#f6f1fb', trim: null },
  { paper: '#fbf3e6', trim: null },
];

// A visitor's course is keyed by time `t`, in milestone shares since its
// trip's month first shows (see eggTime; negative is before). At each key it
// is `v` world units astern of the boats (negative is ahead of them) and
// `lane` of the way from the river's middle out to the bank on its `side`
// (+1 is +x, Patrick's), and `shown` (1 if left out) is how solid it is: a
// visitor sailing on ahead fades into the distance. It eases from key to
// key. Beside the boats a visitor keeps outside them, whatever its lane (see
// `keepOut`). Paper boats drift with the current, so a visitor may
// overtake the boats as fast as it likes but falls back past them no faster
// than they sail (tested).
export type Key = readonly [t: number, v: number, lane: number, shown?: number];
export type Visitor = {
  friend: number; side: -1 | 1; keys: readonly Key[];
  // Tossed in from behind the bank on its side at `at`, ahead of the boats:
  // it drifts, and sails out from the bank, until they catch it up at its
  // first key, LAUNCH.settle later.
  launch?: { at: number };
  // Left behind from `at`: it stops sailing on with the boats and drifts,
  // so they draw away from it and it falls out of the bottom of the
  // picture, or if `fade` is set, it fades out over that many shares as it goes.
  behind?: { at: number; fade?: number };
};
// Lights strung between the visitors while they gather round the boats: up
// from `lights[0]` to `[1]`, down from `[2]` to `[3]`; each string runs from
// one visitor's peak to another's (indices into `visitors`).
export type Party = { lights: readonly [number, number, number, number]; strings: readonly (readonly [number, number])[] };
export type CoastTrip = { month: string; visitors: readonly Visitor[]; party?: Party };

// Visitors come up from astern out of the bottom of the picture: from below
// it at ENTER, slowing to their stations from below its edge at ENTERED.
const ENTER = 13, ENTERED = 8.5;
const from = (t: number, lane = .15): Key[] => [[t, ENTER, lane], [t + .08, ENTERED, lane]];

// November 2017 tosses six boats in from both banks, one after another just
// ahead of the bows as its date holds; the boats catch them up and they sail
// along, then gather round in a horseshoe open towards the camera, with
// lights strung between them. Then those on the right sail on ahead down
// the coast, fading into the distance, and those on the left, where
// 2018's rock is coming up at the water's edge, fall behind and fade, all
// before the internship. November 2019 is the other party.
// The rest bring two or three boats each, up from astern as their month
// shows, that sail with them a while and sail on or fall behind. Each keeps
// to a side clear of that year's markers in the river and at the water's
// edge, and of July 2017's ducks: December 2018's two keep beside the boats
// as 2019's buoy comes past them, and December 2020's keep beside them on
// the right, between 2020's boathouse astern on the left and 2021's flowers
// ahead on the right, as they draw apart for Sydney.
export const COAST_TRIPS: readonly CoastTrip[] = [
  {
    month: '2017-11',
    visitors: [
      { friend: 0, side: -1, launch: { at: .15 }, keys: [[.45, -2.3, .5], [.52, -2.4, .45], [.58, -2.3, .3], [.66, -2.3, .3]], behind: { at: .66, fade: .28 } },
      { friend: 1, side: -1, launch: { at: .09 }, keys: [[.39, -.9, .45], [.52, -.6, .45], [.58, -.5, 0], [.66, -.5, 0]], behind: { at: .66, fade: .28 } },
      { friend: 2, side: -1, launch: { at: .03 }, keys: [[.33, -.2, .5], [.53, .7, .45], [.64, 1.2, 0], [.66, 1.2, 0]], behind: { at: .66, fade: .28 } },
      { friend: 5, side: 1, launch: { at: .06 }, keys: [[.36, -.3, .45], [.55, -.25, .4], [.64, -.25, 0], [.72, -.25, 0], [.95, -8, .25, 0]] },
      { friend: 4, side: 1, launch: { at: .12 }, keys: [[.42, -1, .45], [.52, -1.2, .4], [.58, -1.35, 0], [.68, -1.35, 0], [.9, -9, .15, 0]] },
      { friend: 6, side: 1, launch: { at: .18 }, keys: [[.48, -2, .45], [.58, -2.5, .3], [.66, -2.5, .3], [.88, -9, .3, 0]] },
    ],
    // The horseshoe: from the left's stern quarter up past the bows and back
    // down the right, which stops short of the stern quarter: in portrait,
    // July 2017's ducks float there at November's reduced-motion still.
    party: { lights: [.53, .59, .62, .67], strings: [[2, 1], [1, 0], [0, 5], [5, 4], [4, 3]] },
  },
  {
    month: '2018-12',
    visitors: [
      { friend: 1, side: 1, keys: [...from(-.15), [.15, -.6, .3], [.3, -.4, .35]], behind: { at: .3, fade: .22 } },
      { friend: 7, side: 1, keys: [...from(-.08), [.2, 1.2, .3], [.32, 1.4, .35]], behind: { at: .32, fade: .22 } },
    ],
  },
  {
    // Gathered before graduation's date; as in 2017, those on the left fall
    // behind, here clear of 2020's boathouse.
    month: '2019-11',
    visitors: [
      { friend: 0, side: -1, keys: [...from(-.2), [.1, -2.6, .45], [.17, -2.3, .3], [.4, -2.3, .3]], behind: { at: .4, fade: .28 } },
      { friend: 1, side: -1, keys: [...from(-.14), [.14, -.6, .1], [.2, -.5, 0], [.4, -.5, 0]], behind: { at: .4, fade: .28 } },
      { friend: 3, side: -1, keys: [...from(-.08), [.18, 1.2, .1], [.22, 1.3, 0], [.4, 1.3, 0]], behind: { at: .4, fade: .28 } },
      { friend: 5, side: 1, keys: [...from(-.05), [.19, 1.2, .1], [.22, 1.3, 0], [.42, 1.3, 0], [.66, -7.5, .3, 0]] },
      { friend: 4, side: 1, keys: [...from(-.11), [.15, -.6, .1], [.2, -.5, 0], [.4, -.5, 0], [.63, -8, .3, 0]] },
      { friend: 2, side: 1, keys: [...from(-.17), [.11, -2.6, .45], [.17, -2.3, .3], [.38, -2.3, .3], [.6, -9, .45, 0]] },
    ],
    party: { lights: [.2, .26, .34, .4], strings: [[2, 1], [1, 0], [0, 5], [5, 4], [4, 3]] },
  },
  {
    month: '2020-12',
    visitors: [
      { friend: 4, side: 1, keys: [...from(-.15), [.12, -.5, .3], [.34, -.3, .35]], behind: { at: .34, fade: .28 } },
      { friend: 6, side: 1, keys: [...from(-.1), [.17, 1.2, .3], [.36, 1.4, .35]], behind: { at: .36, fade: .28 } },
      { friend: 5, side: 1, keys: [...from(-.05), [.22, 2.9, .35], [.36, 3.1, .4]], behind: { at: .36, fade: .25 } },
    ],
  },
  {
    month: '2021-11',
    visitors: [
      { friend: 7, side: -1, keys: [...from(-.15), [.12, -2.8, .45], [.3, -3, .5], [.52, -9, .5, 0]] },
      { friend: 0, side: -1, keys: [...from(-.08), [.2, -.4, .3], [.36, -.2, .35], [.6, -7.5, .3, 0]] },
    ],
  },
  {
    month: '2022-12',
    visitors: [
      { friend: 3, side: 1, keys: [...from(-.2), [.08, -2.5, .35], [.25, -2.8, .4], [.45, -9, .45, 0]] },
      { friend: 1, side: 1, keys: [...from(-.14), [.12, -.2, .3], [.3, .2, .35], [.5, -8, .35, 0]] },
      { friend: 2, side: -1, keys: [...from(-.08), [.18, .6, .3], [.34, .8, .35]], behind: { at: .34, fade: .3 } },
    ],
  },
  {
    month: '2023-11',
    visitors: [
      { friend: 6, side: -1, keys: [...from(-.2), [.08, -2.7, .55], [.25, -3, .55], [.47, -9, .5, 0]] },
      { friend: 0, side: -1, keys: [...from(-.14), [.14, .1, .4], [.3, -.1, .45], [.52, -8, .35, 0]] },
      { friend: 7, side: -1, keys: [...from(-.08), [.18, 1.4, .5], [.36, 1.5, .45]], behind: { at: .36, fade: .3 } },
    ],
  },
];

// Their size, and how far they keep from the banks (half a boat's beam and a
// little more). Portrait's river is narrower, so they are a little smaller.
export const PAPER = {
  scale: { desktop: .56, mobile: .45 }, margin: { desktop: .45, mobile: .34 },
  // The folded paper's half-length and half-beam in model units (paperBoatGeometry).
  bow: .82, beam: .43,
} as const;
// Launched boats: their arc from behind the bank's grass (seconds in the air,
// and its height), how long they take to sail out to their first key (in
// shares), and how fast they drift downstream until then (units a share).
export const LAUNCH = { flight: .7, arc: .55, settle: .3, drift: 2 } as const;
// A visitor left behind drifts at this speed (units a share) and is gone
// once it is this far astern, below the bottom of the picture.
const ADRIFT = { drift: .9, gone: 9 } as const;
// How far the boats travel in a share.
const PACE = routeAt(ARRIVAL_END) - routeAt(ARRIVAL_END + ROOM);
// How far the visitors keep off the story boats' hulls. Their eased booms
// reach a little further out, but above a paper boat's peak.
const CLEARANCE = .15;
// Idle wandering about each station, in world units along and in lane.
const WANDER = { along: .22, lane: .04 } as const;

const smooth = (t: number) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };
const sizeOf = (width: number) => width < 1 ? 'mobile' : 'desktop';
export const paperScale = (width: number) => PAPER.scale[sizeOf(width)];

// The trip's clock and when it is under way: from the first boat's
// launch or arrival to the last one gone (left-behind boats go after their
// last key; see visitorSpot).
export const tripTime = (trip: CoastTrip, p: number) => scrolledSince(trip.month, p);
export function tripSpan(trip: CoastTrip) {
  const starts = trip.visitors.map(v => v.launch?.at ?? v.keys[0][0]);
  const ends = trip.visitors.map(({ keys, behind }) => !behind ? keys[keys.length - 1][0]
    : behind.at + (behind.fade ?? (ADRIFT.gone - along(keys, behind.at).v + WANDER.along) / (PACE - ADRIFT.drift)));
  return { from: Math.min(...starts), to: Math.max(...ends) };
}

// How far out from the river's middle the visitors keep at `v` astern of the
// boats (negative is ahead): clear of the hulls beside them, and ahead of
// them clear of where the hulls stand in the picture, which grows with
// distance, so none hides behind them. Full from `full` ahead to `astern`,
// easing off over `ease` ahead and `fade` astern.
const KEEP = { full: -4, ease: 2, astern: 2.6, fade: 6.4 } as const;
const zone = (v: number) => smooth((v - KEEP.full + KEEP.ease) / KEEP.ease) * (1 - smooth((v - KEEP.astern) / KEEP.fade));
function keepOut(p: number, width: number, v: number) {
  // As the boats draw apart or together, each turns, swinging its bow or stern out.
  const { gap, turn } = boatPose(p, width);
  const hulls = (gap + HULL_HALF_BEAM.dinghy + Math.abs(turn) * .8) * BOAT_SCALE;
  return (hulls * (1 + Math.max(0, -v) / GARDEN_CAMERA.behind) + PAPER.beam * paperScale(width) + CLEARANCE) * zone(v);
}
const room = (z: number, width: number) => bankEdge(z, width) - PAPER.margin[sizeOf(width)];

// Where along its course a visitor is at t: v, lane and shown, eased between keys.
function along(keys: readonly Key[], t: number) {
  let i = keys.findIndex(([at]) => at > t);
  if (i < 0) i = keys.length - 1;
  if (i === 0) i = 1;
  const [ta, va, la, sa = 1] = keys[i - 1], [tb, vb, lb, sb = 1] = keys[i];
  const k = smooth((t - ta) / (tb - ta));
  return { v: va + (vb - va) * k, lane: la + (lb - la) * k, shown: sa + (sb - sa) * k };
}

export type FriendSpot = { x: number; z: number; shown: number };
// Where a trip's visitor is on the water at t (shares since its month) with
// the voyage at p, `idle` seconds into its wandering, or null while it isn't
// out. Always on the water, clear of the banks and of the story boats.
export function visitorSpot(trip: CoastTrip, visitor: Visitor, t: number, p: number, width: number, idle = 0): FriendSpot | null {
  const { keys, launch, behind, side } = visitor;
  const first = launch ? launch.at : keys[0][0], last = keys[keys.length - 1][0];
  if (t < first || (!behind && t > last)) return null;
  const phase = visitor.friend * 2.4 + side;
  const wander = (s: number) => ({ v: Math.sin(idle * .31 + phase) * WANDER.along * s, lane: Math.sin(idle * .23 + phase * 1.7) * WANDER.lane * s });
  const pairZ = routeAt(p);
  // Its course, relative to the boats, or once left behind, adrift.
  let { v, lane, shown } = along(keys, Math.min(t, behind?.at ?? Infinity));
  if (behind && t > behind.at) {
    const since = t - behind.at;
    v += routeAt(p - since * ROOM) - pairZ - ADRIFT.drift * since;
    if (behind.fade) shown *= 1 - smooth(since / behind.fade);
    if (v > ADRIFT.gone || shown <= 0) return null;
  }
  // Wanders about its station, but not while it is being launched.
  const w = wander(launch ? smooth((t - launch.at - LAUNCH.settle) / .1) : 1);
  v += w.v; lane += w.lane;
  let z = pairZ + v, off = side * lane * room(z, width);
  // Launched: drifting from where it landed, and out from the bank to its course.
  if (launch && t < launch.at + LAUNCH.settle) {
    const landed = landingSpot(trip, visitor, t, width), k = smooth((t - launch.at) / LAUNCH.settle);
    z = landed.z;
    off = landed.off + (side * lane * room(z, width) - landed.off) * k;
    shown = 1;
  }
  // Clear of the story boats beside and just ahead of them, and on the water.
  const reach = room(z, width);
  const a = Math.min(reach, Math.max(Math.abs(off), keepOut(p, width, z - pairZ)));
  return { x: riverCenter(z, width) + side * a, z, shown };
}

// Where a launched boat lands, and drifts, just off its bank: z and its offset from the river's middle.
export function landingSpot(trip: CoastTrip, visitor: Visitor, t: number, width: number) {
  const caught = visitor.launch!.at + LAUNCH.settle, [, v] = visitor.keys[0];
  const z = routeAt(progressAt(trip.month) + caught * ROOM) + v + LAUNCH.drift * (caught - Math.max(t, visitor.launch!.at));
  return { z, off: visitor.side * (room(z, width) - .05) };
}
// Where it is tossed from: behind the bank's grass, beside where it lands.
export function throwSpot(trip: CoastTrip, visitor: Visitor, width: number) {
  const { z } = landingSpot(trip, visitor, visitor.launch!.at, width);
  const x = riverCenter(z, width) + visitor.side * (bankEdge(z, width) + .7 * Math.max(width, .6));
  return { x, y: groundHeight(x, z, width) - .25, z };
}

// Its heading (yaw about +y, 0 straight downstream): down the river, turned
// a little as it moves across it.
export function visitorYaw(trip: CoastTrip, visitor: Visitor, t: number, p: number, width: number, idle = 0) {
  const e = .01, a = visitorSpot(trip, visitor, t - e, p - e * ROOM, width, idle), b = visitorSpot(trip, visitor, t + e, p + e * ROOM, width, idle);
  const here = visitorSpot(trip, visitor, t, p, width, idle);
  if (!here) return 0;
  const z = here.z, river = Math.atan2(riverCenter(z + .5, width) - riverCenter(z - .5, width), 1);
  if (!a || !b) return river;
  // Across the river per unit it travels down it, or the boats do if it is
  // slower (adrift, it still points downstream).
  const travel = Math.max(.05, routeAt(p - e * ROOM) - routeAt(p + e * ROOM), a.z - b.z);
  const across = ((b.x - riverCenter(b.z, width)) - (a.x - riverCenter(a.z, width))) / travel;
  return river - Math.max(-.2, Math.min(.2, Math.atan(across)));
}

// How bright the party's lights are at t, 0 to 1.
export function lightsAt(trip: CoastTrip, t: number) {
  if (!trip.party) return 0;
  const [up, full, dim, out] = trip.party.lights;
  return smooth((t - up) / (full - up)) * (1 - smooth((t - dim) / (out - dim)));
}

// Under reduced motion, November 2017's still shows its party at this time.
export const FLEET = { settled: .6 } as const;

// The most strings of lights at once, to size their meshes.
export const MOST_STRINGS = Math.max(...COAST_TRIPS.map(trip => trip.party?.strings.length ?? 0));
