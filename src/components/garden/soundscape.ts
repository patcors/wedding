// The voyage's optional sound, the parts that can be tested (see
// docs/VOYAGE.md, "Sound"; tests/soundscape.test.mjs). The ambience follows
// the day in skyCycle.ts: quiet river and a few birds at dawn, birds at their
// brightest at midday, calmer at dusk, and the festoons' warmth coming up
// with their lights. A chime marks each milestone once its date has settled,
// never twice in quick succession however the guest flings back and forth.
// A few scenery touches play as the scroll passes their moments, as the
// scenes themselves do. soundEngine.ts makes the sounds; soundPlayer.ts ties
// them to the page.
import { BULLET_LAUNCH, MILESTONES, ROOM, chapterAt, monthIndex, progressAt, type Milestone } from './journey.ts';
import { AFTERNOON, DAWN, DUSK, GOLDEN, LATE, MIDDAY, MORNING, SKY_KEYS, lampsAt, type SkyKey } from './skyCycle.ts';
import { NEST_EVENTS, NESTS, type Owner } from './eggs/nesting.ts';

// The ambience at each of the sky's keys, each 0 to 1: `level` the whole bed,
// `water` the river, `waterTone` how bright it sounds (its filters open),
// `birds` how often distant birds sing, `birdTone` how bright they sound.
export type AmbienceKey = { level: number; water: number; waterTone: number; birds: number; birdTone: number };
const AMBIENCE_AT = new Map<SkyKey, AmbienceKey>([
  [DAWN, { level: .55, water: .8, waterTone: .25, birds: .25, birdTone: .35 }],
  [MORNING, { level: .8, water: .85, waterTone: .55, birds: .75, birdTone: .65 }],
  [MIDDAY, { level: .9, water: .85, waterTone: .75, birds: 1, birdTone: 1 }],
  [AFTERNOON, { level: .85, water: .85, waterTone: .6, birds: .75, birdTone: .75 }],
  [LATE, { level: .8, water: .85, waterTone: .5, birds: .55, birdTone: .55 }],
  [GOLDEN, { level: .72, water: .8, waterTone: .35, birds: .35, birdTone: .35 }],
  [DUSK, { level: .6, water: .75, waterTone: .15, birds: .08, birdTone: .15 }],
]);
// On the sky's own keyframes, so the sound turns with the light.
export const AMBIENCE_KEYS: readonly (readonly [number, AmbienceKey])[] = SKY_KEYS.map(([p, key]) => [p, AMBIENCE_AT.get(key)!] as const);

// `warmth` is the festoons' glow, 0 to 1, coming up with their lights (lampsAt).
export type Ambience = AmbienceKey & { warmth: number };
const NAMES = ['level', 'water', 'waterTone', 'birds', 'birdTone'] as const;
// The ambience at progress p: straight between keys, as the sky is.
export function ambienceAt(p: number): Ambience {
  let i = 1;
  while (i < AMBIENCE_KEYS.length - 1 && p > AMBIENCE_KEYS[i][0]) i++;
  const [pa, a] = AMBIENCE_KEYS[i - 1], [pb, b] = AMBIENCE_KEYS[i];
  const t = Math.min(1, Math.max(0, (p - pa) / (pb - pa)));
  const mixed = Object.fromEntries(NAMES.map(name => [name, a[name] + (b[name] - a[name]) * t])) as AmbienceKey;
  return { ...mixed, warmth: lampsAt(p) };
}

// The milestone whose date is holding at p, settled on its day (the label's
// settledOn), or null while the date rolls between them and outside the voyage.
export function heldMilestone(p: number): Milestone | null {
  if (chapterAt(p) !== 'voyage') return null;
  return MILESTONES.find(({ month }) => progressAt(month) <= p && p <= progressAt(monthIndex(month) + 1e-3)) ?? null;
}

// Seconds: a held date must stay put for `settle` before it chimes (about
// when its digits have flipped to its day and screen readers hear it, 700ms
// in Garden.tsx); no chime comes within `gap` of the last, and a milestone
// doesn't chime again within `again`. A chime that can't play is dropped, not
// queued, so flinging back and forth never builds up a run of them.
export const CHIME = { settle: .6, gap: 2.5, again: 30 } as const;
export type Chimes = { held: string | null; since: number; done: boolean; last: number; chimed: Map<string, number> };
export const createChimes = (): Chimes => ({ held: null, since: 0, done: false, last: -Infinity, chimed: new Map() });
// Called as time passes with the milestone held now (its id, or null): the
// milestone to chime for now, if any.
export function chimeStep(chimes: Chimes, held: string | null, now: number): string | null {
  if (held !== chimes.held) Object.assign(chimes, { held, since: now, done: false });
  if (held === null || chimes.done || now - chimes.since < CHIME.settle - 1e-9) return null;
  // Settled: this visit gets one chance, so a chime blocked now isn't played late.
  chimes.done = true;
  if (now - chimes.last < CHIME.gap || now - (chimes.chimed.get(held) ?? -Infinity) < CHIME.again) return null;
  chimes.last = now;
  chimes.chimed.set(held, now);
  return held;
}

// The chimes keep to D major pentatonic, in the octave above middle C's
// (D5 to E6). Each milestone rings two notes, the second a pentatonic third
// above the first, and the first steps round the scale by fifths from one
// milestone to the next (D, A, E, B, F♯), so a run of them makes a gentle tune.
const PENTATONIC = [0, 2, 4, 7, 9];
const D5 = 74;
export const pentatonic = (degree: number) => {
  const semitones = 12 * Math.floor(degree / 5) + PENTATONIC[degree % 5];
  return 440 * 2 ** ((D5 + semitones - 69) / 12);
};
export function chimeNotes(id: string): [number, number] {
  const i = Math.max(0, MILESTONES.findIndex(milestone => milestone.id === id)), degree = i * 3 % 5;
  return [pentatonic(degree), pentatonic(degree + 2)];
}

// The scenery's touches, each at the progress where its scene starts to play.
// `pan` runs from the left bank (−1) to the right (1), `to` where it ends
// (a bird's flight); `delay` staggers two at once, in seconds.
export type CueKind = 'rocket' | 'burner' | 'bird';
export type Cue = { id: string; kind: CueKind; at: number; pan: number; to?: number; owner?: Owner; delay?: number };
// Each bird on its own bank, the other's house a little nearer the middle,
// as it is in the picture.
const BANK_PAN = .5;
const birdCues = (): Cue[] => {
  const where: Record<Owner, number> = { amelia: NESTS.side.amelia * BANK_PAN, patrick: NESTS.side.patrick * BANK_PAN };
  return NEST_EVENTS.flatMap(({ month, at, moves }, i) => (Object.entries(moves ?? {}) as [Owner, { house: Owner }][]).map(([owner, { house }], k) => {
    const from = where[owner], to = NESTS.side[house] * BANK_PAN * (house === owner ? 1 : .8);
    where[owner] = to;
    return { id: `bird-${i}-${owner}`, kind: 'bird', at: progressAt(month) + at * ROOM, pan: from, to, owner, delay: k * .3 } as Cue;
  }));
};
// The rocket fires on the right bank (rocketLaunch.ts); the first balloon's
// burner sounds once the balloons have faded in over the trip's date, before
// its stop (balloonCourse.ts, BALLOON_TIMES.arrive), left of the middle; the
// birds call as they take off for each flight on Church St (nesting.ts).
export const CUES: readonly Cue[] = [
  { id: 'rocket', kind: 'rocket', at: progressAt(BULLET_LAUNCH.month) + BULLET_LAUNCH.at * ROOM, pan: .35 },
  { id: 'burner', kind: 'burner', at: progressAt('2026-07') + .3 * ROOM, pan: -.3 },
  ...birdCues(),
];

// A touch plays when the eased progress passes its moment going forward, but
// not when a jump lands more than `window` past it (the scene then shows it
// done), and not again within `again` seconds, so flinging back and forth
// over it plays it once. Never under reduced motion, where the scenes don't
// play either (soundPlayer.ts doesn't ask).
export const CUE = { window: .25 * ROOM, again: 20 } as const;
export type CueState = Map<string, number>;
export const createCues = (): CueState => new Map();
export function cuesCrossed(state: CueState, from: number, to: number, now: number): Cue[] {
  if (!(to > from)) return [];
  const crossed = CUES.filter(cue => from < cue.at && cue.at <= to && to - cue.at <= CUE.window && now - (state.get(cue.id) ?? -Infinity) >= CUE.again);
  crossed.forEach(cue => state.set(cue.id, now));
  return crossed;
}
