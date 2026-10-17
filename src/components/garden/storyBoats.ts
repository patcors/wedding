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
// in first, the crossbeams go across, then the planks are laid one by one from
// bow to stern while the hulls grow long and slim. `rigid` is when the beams
// hold the hulls together, so they stop bobbing on their own.
export const catamaran = (j: number) => ({
  close: ease(j / .1),
  morph: ease((j - .05) / .8),
  rigid: ease((j - .06) / .14),
  beams: Array.from({ length: DECK.beams }, (_, i) => clamp((j - .08 - i * .06) / .07)),
  planks: Array.from({ length: DECK.planks }, (_, i) => clamp((j - .2) / .72 * DECK.planks - i * .95)),
});

// The last plank is down a little before they get engaged. Then, as April
// 2026 shows, the two masts give way to one: each boat furls its sail and
// strikes its flag, and its mast is lowered aft along its hull; one tall mast
// rises from the middle of the deck while the date holds, its plain sail
// unfurls, and their monogram's flag is run up to its masthead. Each step
// runs over these spans of scroll since the date first shows, in milestone
// shares, and all is done before July 2026's balloon and the bend.
export const RIG_CHANGE = { furl: [-.3, -.1], lower: [-.2, .04], raise: [.04, .34], unfurl: [.3, .58], hoist: [.5, .8] } as const;
export type Rigging = Record<keyof typeof RIG_CHANGE, number>;
// A reduced-motion still shows the rig settled: the two masts before the
// engagement's date, the one from it.
export function rigging(p: number, still = false): Rigging {
  const s = scrolledSince(DATES.engaged, p), t = still ? (s < -1e-9 ? -Infinity : Infinity) : s;
  return Object.fromEntries(Object.entries(RIG_CHANGE).map(([step, [from, to]]) => [step, ease((t - from) / (to - from))])) as Rigging;
}

// Each small masthead flies the mark of whoever its sailor works for, and
// nothing before their internship. Both run up FinoComp's as November 2018
// shows and keep them into Sydney. Amelia leaves FinoComp and takes a few
// months off, tutoring and selling haircare online (the interim flag), then
// starts at HeirWealth in January 2023; Patrick follows as March 2023 shows,
// so for a while hers is HeirWealth's and his still FinoComp's. Each change
// is a milestone (journey.ts), so it has a share of scroll to be seen;
// AMELIA_LEFT_FINOCOMP there sets when she left.
export type Company = 'finocomp' | 'interim' | 'heirwealth';
const monthOf = (id: string) => MILESTONES.find(m => m.id === id)!.month;
type Change = { month: string; company: Company; strike: readonly [number, number]; hoist: readonly [number, number] };
// Each boat's changes in order, Amelia's then Patrick's: the flag before is
// struck, then this one run up the same halyard, over these spans of scroll
// since the month first shows, in shares: each is done early in its date's
// hold, as the camera glides into the milestone's stop (STOPS), so the stop
// shows the new flag flying.
const internship: Change = { month: monthOf('internship'), company: 'finocomp', strike: [0, 0], hoist: [0, .15] };
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
// Amelia's and Patrick's at p: whose flag is up, and how far up its halyard.
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
  // year markers on the banks pass behind the flags at the milestones' stops.
  // Story months rush between dates, so this goes by scroll.
  const away = Math.max(0, ease((scrolledSince(DATES.sydney, p) + .8) / .85) - ease((scrolledSince(DATES.back, p) + .7) / .7));
  gap += (bankEdge(z, width) * .4 / BOAT_SCALE - gap) * away;
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
