// Places along the way: far-off landscapes, low on the horizon through the
// haze beyond the avenue's trees, that change with where Patrick and Amelia
// were, so the river becomes a map of their life: the Illawarra escarpment
// through the Wollongong university years, Sydney's sandstone heads and
// harbour light while Amelia lived there, and Berry's rolling dairy hills,
// with Coolangatta Mountain far off, round the bend to the wedding. Mood, not
// objects to notice: no eggs, no text. GardenPlaces.tsx draws them,
// placesGeometry.ts builds them; this file says when each shows and what it
// looks like. Pure, so it can be tested (tests/places.test.mjs).
import { ROOM, progressAt, scrolledSince } from './journey.ts';

// Guests see the places. Dev only: the Review panel's "Places" can turn them
// off to compare, remembered across reloads.
export const PLACES = true;
export const REVIEW_PLACES = 'pa_dev_places';
export const placesOn = (stored: string | null) => stored === 'on' ? true : stored === 'off' ? false : PLACES;

export const PLACE_IDS = ['illawarra', 'sydney', 'berry'] as const;
export type PlaceId = typeof PLACE_IDS[number];

// Each place arrives and leaves over a span of scroll, in milestone shares
// since a date (scrolledSince), so its fades keep their length however a
// year's months are spread. `null`: there from the opening, or to the dock.
//  - The escarpment is there from the opening (they met at UOW in July 2017)
//    and sinks into the haze over the second half of graduation's room, gone
//    before 2021 turns.
//  - Sydney's heads rise as February 2021 nears and are fully in as its date
//    shows (where its reduced-motion still is); they sink away after January 2023's stop, gone as
//    March 2023 shows and the boats come back alongside. 2023 to 2025 have no
//    place of their own.
//  - Berry's hills come up once the Hagia Sophia has sunk back into the haze
//    (balloonCourse.ts, gone 1.1 shares after the trip's date), as the boats
//    round the bend, are fully in before 2027 turns, and stay to the dock.
export type PlaceSpan = { month: string; from: number; to: number };
export const PLACE_TIMES: Record<PlaceId, { arrive: PlaceSpan | null; leave: PlaceSpan | null }> = {
  illawarra: { arrive: null, leave: { month: '2020-08', from: .5, to: 1 } },
  sydney: { arrive: { month: '2021-02', from: -.33, to: 0 }, leave: { month: '2023-03', from: -.8, to: -.05 } },
  berry: { arrive: { month: '2026-07', from: 1.15, to: 1.9 }, leave: null },
};

const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};
const through = (span: PlaceSpan, p: number) => smooth((scrolledSince(span.month, p) - span.from) / (span.to - span.from));

// How far place `id` is shown at progress p, 0 to 1, easing in and out. Under
// reduced motion p is already the still's (JourneyProvider), so each still
// shows its place settled.
export function placeShown(id: PlaceId, p: number) {
  const { arrive, leave } = PLACE_TIMES[id];
  return (arrive ? through(arrive, p) : 1) * (leave ? 1 - through(leave, p) : 1);
}
// Where a place's fades start and end, in progress: [from, to] for each.
export function placeWindow(id: PlaceId) {
  const at = (span: PlaceSpan | null) => span && [progressAt(span.month) + span.from * ROOM, progressAt(span.month) + span.to * ROOM] as const;
  return { arrive: at(PLACE_TIMES[id].arrive), leave: at(PLACE_TIMES[id].leave) };
}

// Sydney's harbour light: while its heads are up the sun is a touch warmer
// and its glint on the river brighter. A small share, like the seasons'.
export const HARBOUR_LIGHT = { sun: [1.05, 1.0, .93], glint: 1.18 } as const;
export function placeLight(p: number, on: boolean) {
  const k = on ? placeShown('sydney', p) : 0;
  return { sun: HARBOUR_LIGHT.sun.map(v => 1 + (v - 1) * k) as [number, number, number], glint: 1 + (HARBOUR_LIGHT.glint - 1) * k };
}

// What each place looks like: a few layered ridgelines, each a profile of
// crest elevations (degrees above the eye line) at bearings (degrees right of
// straight down the river, −z), on a ring round the camera that moves with
// it but never turns, so the river's bends swing the view across them as
// they would far-off hills. Nearer layers first; `distance` is a share of
// the ring's radius (PLACE_RING), `haze` how much of the fog's colour each
// takes, the further the more. `kind` picks its rows and colours
// (placesGeometry.ts). Profiles end below the horizon so nothing is cut off.
// Elevations are kept low, mostly under 4°, so the ridges show through the
// band of sky between the trunks and under the canopy, and over the river's
// vanishing point, but never reach the boats, the eggs or the date.
export type Kind = 'escarpment' | 'heads' | 'bush' | 'hills' | 'mountain';
export type Ridge = { kind: Kind; distance: number; haze: number; step: number; smooth?: boolean; seed: number; crest: readonly (readonly [number, number])[] };
export const PLACE_RIDGES: Record<PlaceId, readonly Ridge[]> = {
  // Travelling north up the coast, the escarpment is west, on the left: a
  // long, level-topped wooded wall with its sandstone cliff band near the
  // top, receding towards the river's vanishing point in spurs, each further
  // one hazier. To the east, on the right, the land falls away to the coast.
  illawarra: [
    { kind: 'escarpment', distance: .9, haze: .4, step: 1.8, seed: 11, crest: [[-100, 3.1], [-80, 3.25], [-62, 3.05], [-50, 3.15], [-38, 2.95], [-28, 3.05], [-18, 2.9], [-9, 2.85], [-3, 2.8], [-.5, 2.6], [.6, 1.7], [3, 1.0], [6.5, -.6]] },
    { kind: 'escarpment', distance: .95, haze: .54, step: 2.2, seed: 23, crest: [[-34, -.6], [-26, 1.9], [-20, 2.05], [-8, 2.15], [3, 2.05], [12, 2.1], [18, 1.95], [20.5, 1.85], [21.6, 1.15], [24, .6], [27.5, -.6]] },
    { kind: 'escarpment', distance: 1, haze: .66, step: 2.2, seed: 37, crest: [[2, -.5], [8, 1.1], [10, 1.2], [20, 1.3], [30, 1.25], [37, 1.15], [38.6, .7], [41, .3], [44, -.5]] },
  ],
  // Sydney's heads: low sandstone headlands with sheer warm cliffs and
  // rounded caps of scrub, one either side of the river's vanishing point
  // and a further one in the gap between them, so the river seems to run
  // out to the sea between them, and a low line of bush along the harbour's
  // shores either side. The Harbour Bridge and the Opera House are
  // the eggs; this is only their stone and their light.
  sydney: [
    { kind: 'heads', distance: .9, haze: .26, step: 1.4, smooth: true, seed: 5, crest: [[-36, -.6], [-31, .6], [-26, 1.15], [-21, 1.05], [-16, 1.25], [-12.5, 1.1], [-10.3, .5], [-9.5, -.6]] },
    { kind: 'heads', distance: .92, haze: .3, step: 1.4, smooth: true, seed: 9, crest: [[8.5, -.6], [9.5, .6], [12, 1.3], [18, 1.4], [25, 1.2], [31, 1.3], [37, .7], [41, -.6]] },
    { kind: 'heads', distance: 1, haze: .5, step: 1.4, smooth: true, seed: 13, crest: [[-15, -.5], [-13, .45], [-7, .7], [0, .62], [6, .7], [10, .4], [12, -.5]] },
    { kind: 'bush', distance: .96, haze: .45, step: 3, smooth: true, seed: 19, crest: [[-100, .5], [-80, .75], [-60, .55], [-42, .7], [-30, .4], [30, .4], [44, .7], [62, .55], [80, .8], [100, .5]] },
  ],
  // Berry: rolling green dairy hills, pasture with dark stands of trees in
  // the folds, a second line of them further off, and Coolangatta Mountain
  // far off, a steep wooded dome rising out of the flats, its outline
  // impressionistic. It stands just left of the river's far end at the dock,
  // where the camera turns to the old tree (and to the right of the bend's
  // view on the way there).
  berry: [
    { kind: 'hills', distance: .88, haze: .46, step: 2.5, smooth: true, seed: 3, crest: [[-100, .4], [-84, 1.3], [-70, .85], [-56, 1.5], [-43, .95], [-30, 1.35], [-18, .8], [-7, 1.15], [4, .75], [15, 1.25], [28, .85], [42, 1.45], [56, .9], [72, 1.3], [90, .65], [104, -.4]] },
    { kind: 'hills', distance: .94, haze: .58, step: 3, smooth: true, seed: 7, crest: [[-96, 1.6], [-76, 2.0], [-52, 1.6], [-38, 1.95], [-14, 1.65], [6, 1.9], [24, 1.6], [46, 2.1], [70, 1.7], [96, 1.95]] },
    { kind: 'mountain', distance: 1, haze: .66, step: 1.2, smooth: true, seed: 17, crest: [[-12, -.5], [-7, .9], [-4, 2.0], [-2, 2.75], [-.3, 3.05], [1.2, 2.9], [2.6, 3.15], [4.4, 2.85], [6.5, 2.1], [9.5, 1.3], [13.5, .75], [18, -.5]] },
  ],
};
// The ring's radius, just inside the camera's far plane (GARDEN_CAMERA: 115,
// or 90 on a phone), beyond the trees the fog has already all but hidden.
// A phone's narrow lens sees only about 17° either side of the middle, so
// there the profiles are drawn in to that share of their bearings, keeping
// the escarpment's slope, the heads' gap and Coolangatta in the picture,
// and a little taller (`lift`) into the more sky it shows.
export const PLACE_RING = { desktop: { radius: 105, squeeze: 1, lift: 1 }, mobile: { radius: 84, squeeze: .55, lift: 1.2 } } as const;
// How much more of the fog's colour they take as the day's haze gathers
// (skyCycle.ts: 0 at midday, .6 at dusk), and as each fades in or out.
export const PLACE_HAZE = { day: .45 } as const;
export const placeHaze = (skyHaze: number, shown: number) => 1 - (1 - PLACE_HAZE.day * skyHaze) * shown;
