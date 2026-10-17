// The Voyage's story (see docs/VOYAGE.md): its milestones, how scrolling moves
// through story time, and where along the river the boats are. Boats, sky,
// eggs and the date label all read from here. Pure, so it can be tested.

export type EggId = 'balloon';
// `room` is the milestone's share of the voyage's scroll, up to the next one
// (1 by default). Shares follow the story, not the calendar, so a quiet year
// doesn't become a long empty stretch.
export type Milestone = { id: string; month: string; description: string; egg?: EggId; room?: number };

export const MILESTONES: readonly Milestone[] = [
  // The channels join: room to come together and travel on side by side.
  { id: 'meet', month: '2017-07', description: 'Patrick and Amelia meet at university, both starting maths degrees.', room: 1.4 },
  { id: 'coast', month: '2017-11', description: 'Their first trip away with friends, down the coast.' },
  { id: 'internship', month: '2018-11', description: 'They start their internship at FinoComp.' },
  { id: 'snow-2019', month: '2019-07', description: 'A snow trip, where Amelia breaks her wrist snowboarding.' },
  { id: 'graduation', month: '2020-08', description: 'They graduate from university.' },
  // Room for the boats to drift apart, still in sight.
  { id: 'sydney', month: '2021-02', description: 'Amelia moves to Sydney for two years.', room: 1.3 },
  { id: 'heirwealth', month: '2023-03', description: 'Amelia is back, and they start working together at HeirWealth.' },
  { id: 'apartments', month: '2024-05', description: 'They both buy apartments.', room: .8 },
  { id: 'living-together', month: '2024-06', description: 'They start living together.', room: .8 },
  // The boats join and become one catamaran.
  { id: 'dating', month: '2024-08', description: 'They start dating.', room: 1.6 },
  { id: 'snow-2025', month: '2025-08', description: 'Another snow trip.' },
  { id: 'salsa', month: '2026-01', description: 'They start salsa classes.' },
  { id: 'engaged', month: '2026-04', description: 'They get engaged.' },
  // The last stretch rounds the bend to the wedding.
  { id: 'turkey-greece', month: '2026-07', description: 'A trip to Turkey and Greece.', egg: 'balloon', room: 3 },
];

export const DATES = { meet: '2017-07', sydney: '2021-02', back: '2023-03', dating: '2024-08', engaged: '2026-04', wedding: '2027-04' } as const;

// Scroll progress p runs 0 to 1: the opening title, the voyage, then the
// celebration with the catamaran docked. The boats glide into the jetty over
// the start of the dock chapter and are moored from DOCKED.
export const ARRIVAL_END = .05, VOYAGE_END = .92, DOCKED = .97;
export type Chapter = 'arrival' | 'voyage' | 'dock';
export const CHAPTERS: Record<Chapter, readonly [number, number]> = { arrival: [0, ARRIVAL_END], voyage: [ARRIVAL_END, VOYAGE_END], dock: [VOYAGE_END, 1] };
export const chapterAt = (p: number): Chapter => p < ARRIVAL_END ? 'arrival' : p < VOYAGE_END ? 'voyage' : 'dock';

// Story time is in months since January 2017, so July 2017 is 6.
export const monthIndex = (month: string) => {
  const [year, m] = month.split('-').map(Number);
  return (year - 2017) * 12 + m - 1;
};
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// The voyage opens in the separate channels, half a year before they meet.
const VOYAGE_START = '2017-01', START_ROOM = 1.4;
// Each milestone's date holds for this much of its share, so the label can be
// read, before rolling on month by month. The wedding holds as the bend ends.
const HOLD = .35, WEDDING_HOLD = .5;
const TOTAL_ROOM = START_ROOM + MILESTONES.reduce((sum, m) => sum + (m.room ?? 1), 0) + WEDDING_HOLD;
// Scroll progress in one ordinary milestone's share.
export const ROOM = (VOYAGE_END - ARRIVAL_END) / TOTAL_ROOM;

type Anchor = { p: number; m: number };
const ANCHORS: Anchor[] = (() => {
  const anchors = [{ p: ARRIVAL_END, m: monthIndex(VOYAGE_START) }];
  let p = ARRIVAL_END + START_ROOM * ROOM;
  for (const milestone of MILESTONES) {
    const m = monthIndex(milestone.month), room = (milestone.room ?? 1) * ROOM;
    anchors.push({ p, m }, { p: p + HOLD * room, m });
    p += room;
  }
  anchors.push({ p, m: monthIndex(DATES.wedding) }, { p: VOYAGE_END, m: monthIndex(DATES.wedding) });
  return anchors;
})();

// Piecewise-linear through points sorted by `from`.
function interpolate<T>(points: T[], value: number, from: (point: T) => number, to: (point: T) => number) {
  if (value <= from(points[0])) return to(points[0]);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    if (value <= from(b)) return from(b) === from(a) ? to(b) : to(a) + (to(b) - to(a)) * (value - from(a)) / (from(b) - from(a));
  }
  return to(points[points.length - 1]);
}

// Continuous story time at progress p. Before the voyage it is the start, after it the wedding.
export const storyMonth = (p: number) => interpolate(ANCHORS, p, a => a.p, a => a.m);

// The first progress at which story time reaches `month` (a 'YYYY-MM' string
// or a story month). For a milestone, that's when its date first shows.
export function progressAt(month: string | number) {
  const m = typeof month === 'string' ? monthIndex(month) : month;
  // Story time never falls, so the first anchor at or past it brackets it.
  const i = ANCHORS.findIndex(a => a.m >= m);
  if (i < 0) return VOYAGE_END;
  if (i === 0) return ANCHORS[0].p;
  const a = ANCHORS[i - 1], b = ANCHORS[i];
  return a.p + (b.p - a.p) * (m - a.m) / (b.m - a.m);
}

// The running date, e.g. "July 2017", only during the voyage.
export function dateLabel(p: number) {
  if (chapterAt(p) !== 'voyage') return null;
  // Hold exactly on a month despite rounding in the interpolation.
  const m = Math.floor(storyMonth(p) + 1e-6);
  return `${MONTH_NAMES[m % 12]} ${2017 + Math.floor(m / 12)}`;
}

// Story months elapsed since `month` at progress p, negative before it. It
// stands still while a date holds.
export const since = (month: string, p: number) => storyMonth(p) - monthIndex(month);
// Scroll elapsed since `month` first showed, in milestone shares (ROOM): a
// clock that keeps running through holds, for scenery tied to scroll.
export const scrolledSince = (month: string, p: number) => (p - progressAt(month)) / ROOM;

// Where the boats are along the river: z, falling downstream (x follows from
// riverCenter). They drift a little under the opening title, travel at a
// steady pace through the voyage, and glide the last stretch into the jetty.
export const ROUTE = { start: 6, voyage: 4, approach: -164, dock: -172 } as const;
const ROUTE_POINTS = [[0, ROUTE.start], [ARRIVAL_END, ROUTE.voyage], [VOYAGE_END, ROUTE.approach], [DOCKED, ROUTE.dock], [1, ROUTE.dock]];
export const routeAt = (p: number) => interpolate(ROUTE_POINTS, p, ([q]) => q, ([, z]) => z);
// Where the boats are when story time reaches `month`.
export const routeAtMonth = (month: string) => routeAt(progressAt(month));

// Reduced motion shows still views instead of a glide: the opening, the latest
// milestone reached (or the voyage's start before the first), or the dock.
export function stillProgress(p: number) {
  if (p < ARRIVAL_END) return 0;
  if (p >= VOYAGE_END) return 1;
  let still = ARRIVAL_END;
  for (const milestone of MILESTONES) {
    const at = progressAt(milestone.month);
    if (at <= p) still = at;
  }
  return still;
}
