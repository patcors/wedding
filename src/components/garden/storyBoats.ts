// Where Patrick's and Amelia's boats are at progress p, and how far they have
// become a catamaran (see docs/VOYAGE.md). Pure, so it can be tested; drawn by
// VoyageBoats.tsx with the models in storyBoatGeometry.ts.
import { ARRIVAL_END, DATES, DOCKED, MILESTONES, ROUTE, VOYAGE_END, progressAt, routeAt, scrolledSince } from './journey.ts';
import { VOYAGE, bankEdge, channelOffset, launchJetties, riverCenter, voyageLandmarks } from './gardenGeometry.ts';

// The models are built in their own units; this sizes them in the world so
// they read as the protagonists on a portrait phone, where the camera's lens
// is wider (see GARDEN_CAMERA).
export const BOAT_SCALE = 1.2;
// Half the distance between the two hulls' centres, in model units: side by
// side with room between, then as the catamaran with the deck across.
export const ALONGSIDE = .62, CATAMARAN = .48;
// Each hull's half-beam, in model units, as the dinghy and as a catamaran hull.
export const HULL_HALF_BEAM = { dinghy: .36, catamaran: .135 } as const;
export const DECK = { beams: 2, planks: 12 } as const;

const clamp = (x: number) => Math.min(1, Math.max(0, x));
const ease = (t: number) => {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
};

// The boats start to join when they start dating and are one catamaran by
// their engagement, when its two masts give way to one (see `rigging`), well
// before the S-bend, so they round it together under the one sail.
const JOIN_FROM = progressAt(DATES.dating), JOIN_TO = progressAt(DATES.engaged);
export const joining = (p: number) => clamp((p - JOIN_FROM) / (JOIN_TO - JOIN_FROM));

// How far through `joining` each part of the catamaran happens: the boats close
// in first and the crossbeams go across while dating's date holds, so its stop
// shows them going across, then the planks are laid one by one from bow to
// stern while the hulls grow long and slim. `rigid` is when the beams hold
// the hulls together, so they stop bobbing on their own.
export const catamaran = (j: number) => ({
  close: ease(j / .07),
  morph: ease((j - .05) / .8),
  rigid: ease((j - .035) / .05),
  beams: Array.from({ length: DECK.beams }, (_, i) => clamp((j - .035 - i * .015) / .03)),
  planks: Array.from({ length: DECK.planks }, (_, i) => clamp((j - .2) / .72 * DECK.planks - i * .95)),
});

// The last plank is down a little before they get engaged. Then, as April
// 2026 shows, the two masts give way to one: each boat furls its sail and
// strikes its flag, and its mast is lowered aft along its hull; one tall mast
// rises from the middle of the deck while the date holds, its sail, striped
// in both their colours, unfurls, and their monogram's flag is run up to its
// masthead. Each step runs over these spans of scroll since the date first
// shows, in milestone shares, and all is done before July 2026's balloon
// and the bend.
export const RIG_CHANGE = { furl: [-.3, -.1], lower: [-.2, .04], raise: [.04, .34], unfurl: [.3, .58], hoist: [.5, .8] } as const;
export type Rigging = Record<keyof typeof RIG_CHANGE, number>;
// A reduced-motion still shows the rig settled: the two masts before the
// engagement's date, the one from it.
export function rigging(p: number, still = false): Rigging {
  const s = scrolledSince(DATES.engaged, p), t = still ? (s < -1e-9 ? -Infinity : Infinity) : s;
  return Object.fromEntries(Object.entries(RIG_CHANGE).map(([step, [from, to]]) => [step, ease((t - from) / (to - from))])) as Rigging;
}

// Each boat flies the mark of whoever its sailor works for from an ensign
// staff on its outboard stern quarter, not the masthead, and nothing before
// their internship. Both run up FinoComp's as November 2018 shows and keep
// them into Sydney. Amelia leaves FinoComp and takes a few months off,
// tutoring and selling haircare online (the interim flag), then starts at
// HeirWealth in January 2023; Patrick follows as March 2023 shows,
// so for a while hers is HeirWealth's and his still FinoComp's. Each change
// is a milestone (journey.ts) with room for its flag to be seen;
// AMELIA_LEFT_FINOCOMP there sets when she left.
export type Company = 'finocomp' | 'interim' | 'heirwealth';
const monthOf = (id: string) => MILESTONES.find(m => m.id === id)!.month;
type Change = { month: string; company: Company; strike: readonly [number, number]; hoist: readonly [number, number] };
// Each boat's changes in order, Amelia's then Patrick's: the flag before is
// struck, then this one run up the same staff, over these spans of scroll
// since the month first shows, in shares: each is done early in its date's
// hold, as the camera glides into the milestone's stop (STOPS), so the stop
// shows the new flag flying. The first waits for its staff to be stepped
// (ENSIGN_STAFFS).
const internship: Change = { month: monthOf('internship'), company: 'finocomp', strike: [0, 0], hoist: [.05, .15] };
const SWAP = { strike: [0, .07], hoist: [.07, .15] } as const;
export const FLAG_CHANGES: readonly (readonly Change[])[] = [
  [
    internship,
    { month: monthOf('interim'), company: 'interim', ...SWAP },
    { month: monthOf('amelia-heirwealth'), company: 'heirwealth', ...SWAP },
  ],
  [
    internship,
    { month: monthOf('heirwealth'), company: 'heirwealth', ...SWAP },
  ],
];
export type CompanyFlag = { company: Company | null; hoist: number };
// Amelia's and Patrick's at p: whose flag is up, and how far up its staff.
// They come down as the small sails furl for the change of masts, and go
// with the small masts. A reduced-motion still shows each change settled
// from its month on.
export function companyFlags(p: number, still = false): CompanyFlag[] {
  const span = (t: number, [from, to]: readonly [number, number]) => to > from ? ease((t - from) / (to - from)) : t >= from ? 1 : 0;
  const { furl } = rigging(p, still);
  return FLAG_CHANGES.map(changes => {
    const clocks = changes.map(({ month }) => {
      const t = scrolledSince(month, p);
      return still ? (t < -1e-9 ? -Infinity : Infinity) : t;
    });
    // The latest change under way, and how far through it.
    const k = clocks.findLastIndex((t, i) => t >= changes[i].strike[0]);
    if (k < 0) return { company: null, hoist: 0 };
    const change = changes[k], up = span(clocks[k], change.hoist);
    const [company, height] = up > 0 ? [change.company, up] : [changes[k - 1]?.company ?? null, 1 - span(clocks[k], change.strike)];
    const hoist = height * (1 - furl);
    return company && hoist > 0 ? { company, hoist } : { company: null, hoist: 0 };
  });
}

// While they're at university, from the meeting to graduation, both boats
// also fly the University of Wollongong's flag, from the ensign staff on the
// inboard stern quarter, towards the other boat and away from the sail, so
// it reads beside the company's flag, which flies outboard. Run up as July
// 2017 shows, once its staff is stepped, and struck as August 2020 shows,
// over spans of scroll since each date, in shares, as for FLAG_CHANGES, so
// each stop shows it settled.
export const UNIVERSITY_FLAG = {
  hoist: { month: DATES.meet, span: [.05, .15] },
  strike: { month: monthOf('graduation'), span: [0, .08] },
} as const;
type Span = { month: string; span: readonly [number, number] };
// How far through a span of scroll since a date p is; a reduced-motion still
// shows it done from the date on.
const through = ({ month, span: [from, to] }: Span, p: number, still: boolean) => {
  const t = scrolledSince(month, p);
  return still ? (t < -1e-9 ? 0 : 1) : ease((t - from) / (to - from));
};
// How far up its staff it is (0 down, 1 up): the same on both boats.
export const universityFlag = (p: number, still = false) =>
  through(UNIVERSITY_FLAG.hoist, p, still) * (1 - through(UNIVERSITY_FLAG.strike, p, still));

// The ensign staffs stand only while they carry a flag, so the sterns are
// bare before the meeting and at the dock: each is stepped just before its
// first flag is run up, the outboard one for the company's flags and the
// inboard one for the university's, and unshipped once its last is struck,
// the university's just after graduation's and the company's as the small
// masts are lowered. Spans of scroll since each date, in shares.
export const ENSIGN_STAFFS = {
  company: { step: { month: monthOf('internship'), span: [0, .05] }, unship: { month: DATES.engaged, span: [-.1, .04] } },
  university: { step: { month: DATES.meet, span: [0, .05] }, unship: { month: monthOf('graduation'), span: [.08, .12] } },
} as const;
// How far each staff stands (0 down, 1 up): the same on both boats.
export function ensignStaffs(p: number, still = false) {
  const stands = ({ step, unship }: { step: Span; unship: Span }) => through(step, p, still) * (1 - through(unship, p, still));
  return { company: stands(ENSIGN_STAFFS.company), university: stands(ENSIGN_STAFFS.university) };
}

// January 2026, they start salsa classes: as the date shows, the catamaran
// turns once on the spot like a dancer and sails on. The turn plays in real
// time once the scroll reaches it, as the rubber ducks' tosses do, so it never
// stops part way round when the guest does: it starts `cue` shares after the
// date first shows, and a guest who arrives after `late` (a jump, or coming
// back up the river) finds it done. It plays again once they go back before
// the date. A little prep the other way, then once round to the right (seen
// from above, clockwise, as a lead turns his partner), rising and heeling a
// touch into it, then a small overshoot it settles back from, as a dancer
// spots the finish. It turns about the hulls' middle, `pivot` forward of the
// pair's (model units), so the bows sweep as little water as they can: in
// portrait the river narrows through salsa's share. The camera holds steady;
// nothing turns under reduced motion.
export const SALSA = { cue: .03, late: .3, seconds: 3.6, prep: .2, overshoot: .12, heel: .05, rise: .03, pivot: -.175 } as const;
export const salsaTime = (p: number) => scrolledSince(monthOf('salsa'), p);
// Seconds into the turn at p, from `turn` the frame before and the frame's
// `step` (0 while paused): null until it starts, Infinity once it is done or missed.
export function salsaClock(turn: number | null, p: number, step: number, reduced = false): number | null {
  const t = salsaTime(p);
  if (t < 0 && (turn === null || turn >= SALSA.seconds)) return null;
  if (reduced) return Infinity;
  if (turn === null) return t < SALSA.cue ? null : t < SALSA.late ? 0 : Infinity;
  return turn >= SALSA.seconds ? Infinity : turn + step;
}
// The catamaran's turn `s` seconds in: how far round (radians of yaw, negative
// to the right), heeled (radians of roll) and risen (model units). At rest
// before and after, so it ends on the heading it started on. `shift` is how
// far the pair's middle moves (world x, z) to turn about the pivot, heading `yaw`.
export function salsaTurn(s: number | null, yaw = 0) {
  const u = (s ?? 0) / SALSA.seconds;
  if (!(u > 0 && u < 1)) return { spin: 0, heel: 0, rise: 0, shift: [0, 0] as [number, number] };
  // Up and back down between a and b, gently at both ends.
  const swell = (a: number, b: number) => Math.sin(Math.PI * clamp((u - a) / (b - a))) ** 2;
  const round = clamp((u - .1) / .72), turned = round ** 3 * (round * (round * 6 - 15) + 10);
  const spin = -2 * Math.PI * turned + SALSA.prep * swell(0, .3) - SALSA.overshoot * swell(.7, 1), pivot = SALSA.pivot * BOAT_SCALE;
  return {
    spin, heel: SALSA.heel * swell(.1, .82), rise: SALSA.rise * swell(.1, .82),
    shift: [pivot * (Math.sin(yaw) - Math.sin(yaw + spin)), pivot * (Math.cos(yaw) - Math.cos(yaw + spin))] as [number, number],
  };
}

export const hullHalfBeam = (morph: number) => HULL_HALF_BEAM.dinghy + (HULL_HALF_BEAM.catamaran - HULL_HALF_BEAM.dinghy) * morph;

// Under the opening title each boat lies alongside the head of its own jetty
// (see launchJetties), held by its lines, its sail sheeted in. As the guest
// starts to scroll they cast off and pull out into their channels by the end
// of the opening. `berth` is half the distance between the hulls' centres
// there, in model units: each hull just clear of its jetty's head.
export const CAST_OFF = { from: .004, to: ARRIVAL_END * .85 } as const;
export const castingOff = (p: number) => ease((p - CAST_OFF.from) / (CAST_OFF.to - CAST_OFF.from));
export const berth = (width: number) => Math.min(...launchJetties(width).map(jetty =>
  Math.abs(jetty.x - riverCenter(ROUTE.start, width)) - jetty.reach - .1)) / BOAT_SCALE - HULL_HALF_BEAM.dinghy;

// Half the distance between the hulls' centres at p, in model units.
export function boatGap(p: number, width: number) {
  const z = routeAt(p);
  // Each in its own channel beside the island, closing in once it ends; at
  // its jetty before that.
  const channel = channelOffset(z, width) / BOAT_SCALE;
  const apart = berth(width) + (channel - berth(width)) * castingOff(p);
  const met = ease((VOYAGE.island.to - z) / (VOYAGE.island.to - VOYAGE.meet));
  let gap = apart + (ALONGSIDE - apart) * met;
  // Drifting apart into Sydney's wider river as its date arrives, still in
  // sight, and back alongside as March 2023 does, so the reduced-motion stills
  // on those dates show both. They stay apart through Amelia's changes of
  // flag, so each boat's reads on its own, though not so far out that the
  // year markers on the banks pass behind the flags at the milestones' stops,
  // and never less than twice as far apart as alongside, where a phone's
  // river runs narrow. Story months rush between dates, so this goes by scroll.
  const away = Math.max(0, ease((scrolledSince(DATES.sydney, p) + .8) / .85) - ease((scrolledSince(DATES.back, p) + .7) / .7));
  gap += (Math.max(ALONGSIDE * 2, bankEdge(z, width) * .4 / BOAT_SCALE) - gap) * away;
  return gap + (CATAMARAN - gap) * catamaran(joining(p)).close;
}

// The middle of the pair in the world at p: down the middle of the river, then
// across to the mooring off the end of the jetty over the start of the dock
// chapter. The catamaran's outer hull lies just off the jetty's end there.
function middle(p: number, width: number) {
  const z = routeAt(p), docking = ease((p - VOYAGE_END) / (DOCKED - VOYAGE_END));
  const x = riverCenter(z, width);
  return { x: x + (voyageLandmarks(width).mooring.x - x) * docking, z };
}

// Headings are yaw about +y for a model whose bow points to −z: 0 is straight
// downstream. A step either side of p gives the direction of travel.
const STEP = .001;
const heading = (dx: number, dz: number) => Math.atan2(-dx, -dz);

export type BoatPose = {
  x: number; z: number; yaw: number;
  // Half the distance between the hulls (model units), and how far each boat
  // turns in towards the other (+) or away while that changes.
  gap: number; turn: number;
  join: ReturnType<typeof catamaran>;
  // How far into the mooring at the dock (the sails come in as it settles),
  // and how far still tied up at the jetties at the start.
  docking: number; berthed: number;
};

export function boatPose(p: number, width: number): BoatPose {
  const { x, z } = middle(p, width);
  // Moored from DOCKED: hold the heading it came in on.
  const q = Math.min(p, DOCKED - STEP);
  const a = middle(q - STEP, width), b = middle(q + STEP, width);
  const yaw = heading(b.x - a.x, b.z - a.z);
  const gap = boatGap(p, width);
  const run = Math.hypot(b.x - a.x, b.z - a.z) / BOAT_SCALE;
  const turn = Math.max(-.22, Math.min(.22, -Math.atan((boatGap(q + STEP, width) - boatGap(q - STEP, width)) / run)));
  return { x, z, yaw, gap, turn, join: catamaran(joining(p)), docking: ease((p - VOYAGE_END) / (DOCKED - VOYAGE_END)), berthed: 1 - castingOff(p) };
}

// The moored catamaran's footprint on the water, as posts round its edge for
// guests' boats to bump off once it is tied up (see boatPhysics' stems): both
// hulls and the deck between. Its upstream end, the sterns, is drawn back
// slantwise from the jetty, so a boat the current carries onto it glances off
// towards open water rather than lodging between it and the jetty. In model units.
const MOORED_HULLS = { bow: -1.5, stern: 1.15, half: CATAMARAN + HULL_HALF_BEAM.catamaran, point: 1 };
export function mooredStems(width: number) {
  const { x, z, yaw } = boatPose(DOCKED, width), c = Math.cos(yaw), s = Math.sin(yaw);
  const { bow, stern, half, point } = MOORED_HULLS;
  const side = VOYAGE.dock.side;
  const corners = [[-half, bow], [half, bow], [half, stern], [-half, stern], [-half, bow]].map(([u, v]) => [u, v === stern && u * side < 0 ? stern - point : v]);
  const stems: { x: number; z: number; radius: number; grip: number }[] = [];
  for (let i = 1; i < corners.length; i++) {
    const [ax, az] = corners[i - 1], [bx, bz] = corners[i], steps = Math.ceil(Math.hypot(bx - ax, bz - az) * BOAT_SCALE / .1);
    for (let k = 0; k < steps; k++) {
      const u = (ax + (bx - ax) * k / steps) * BOAT_SCALE, v = (az + (bz - az) * k / steps) * BOAT_SCALE;
      stems.push({ x: x + c * u + s * v, z: z - s * u + c * v, radius: .1, grip: 0 });
    }
  }
  return stems;
}
