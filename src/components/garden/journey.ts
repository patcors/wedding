// The Voyage's story (see docs/VOYAGE.md): its milestones, how scrolling moves
// through story time, and where along the river the boats are. Boats, sky,
// eggs and the date label all read from here. Pure, so it can be tested.

export type EggId = 'balloon' | 'university' | 'snow-2019' | 'graduation' | 'sydney' | 'apartments' | 'snow-2025';
// `room` is the scroll a milestone takes at its date, in shares (ROOM), before
// the months roll on at its year's pace: its date's hold, and time for what
// happens there to be seen (HOLD, just the hold, by default). Outside the
// paced years the months have no pace of their own, so there a
// milestone's room runs up to the next date (see YEAR). `hold` is how long its
// date holds, in shares, where that isn't the usual (see HOLD).
export type Milestone = { id: string; month: string; description: string; egg?: EggId; room?: number; hold?: number };

// When Amelia left FinoComp. Her flag changes as it shows (see FLAG_CHANGES
// in storyBoats.ts).
export const AMELIA_LEFT_FINOCOMP = '2022-08';
// When Amelia moved into Patrick's apartment: March 2026 (Amelia, October
// 2026). It isn't a milestone, and nothing is timed by it: her bird's flight
// over to his birdhouse stands in for it much earlier, in 2024, while the
// houses are in view (MOVE_SHOWN in eggs/nesting.ts); she liked the whole
// sequence told in 2024 and 2025.
export const AMELIA_MOVED_IN = '2026-03';

export const MILESTONES: readonly Milestone[] = [
  // The channels join: room to come together and travel on side by side.
  { id: 'meet', month: '2017-07', description: 'Patrick and Amelia meet at university, both starting maths degrees.', egg: 'university', room: 1.4 },
  { id: 'coast', month: '2017-11', description: 'Their first trip away with friends, down the coast.', room: .5 },
  { id: 'internship', month: '2018-11', description: 'They start their internship at FinoComp.' },
  { id: 'snow-2019', month: '2019-07', description: 'A snow trip, where Amelia breaks her wrist snowboarding.', egg: 'snow-2019' },
  // Longer, early in the year, so the mortarboards land before Sydney's river
  // widens and the boats only start to drift apart once they have.
  { id: 'graduation', month: '2020-08', description: 'They graduate from university.', egg: 'graduation', room: 1.1 },
  // The boats drift apart either side of a rock, Amelia's under the Harbour
  // Bridge, still in sight, and stay apart through Amelia's two changes of
  // work, each with room enough that her interim flag, and then her
  // HeirWealth flag beside Patrick's FinoComp one, fly for most of a share
  // before the next change.
  { id: 'sydney', month: '2021-02', description: 'Amelia moves to Sydney for two years.', egg: 'sydney' },
  { id: 'interim', month: AMELIA_LEFT_FINOCOMP, description: 'Amelia leaves FinoComp for a few months of tutoring and selling haircare online.', room: .7 },
  { id: 'amelia-heirwealth', month: '2023-01', description: 'Amelia starts at HeirWealth.', room: 1 },
  { id: 'heirwealth', month: '2023-03', description: 'Amelia is back, and Patrick joins her at HeirWealth, so they start working together.' },
  // 2024 is the busiest year: its three dates take most of it, each showing
  // for about the same while, so the months round them rush. June's room
  // runs on into July, which shows for a moment before August.
  { id: 'apartments', month: '2024-05', description: 'They both buy apartments.', egg: 'apartments', room: .43 },
  { id: 'living-together', month: '2024-06', description: 'They start living together.', room: .58, hold: .27 },
  // The boats join and become one catamaran, the butterflies circling. The
  // date holds through nearly all its room, and the crossbeams go across
  // while it does.
  { id: 'dating', month: '2024-08', description: 'They start dating.', room: .45, hold: .42 },
  { id: 'snow-2025', month: '2025-08', description: 'Another snow trip.', egg: 'snow-2025' },
  // Salsa and the engagement each have room for their scene and little more,
  // the turn and then the rig change, so the trip's date still shows just as
  // the boats enter the S-bend, before it swings the river.
  { id: 'salsa', month: '2026-01', description: 'They start salsa classes.', room: .7 },
  { id: 'engaged', month: '2026-04', description: 'They get engaged.', room: .82 },
  // The last stretch rounds the bend to the wedding.
  { id: 'turkey-greece', month: '2026-07', description: 'A trip to Turkey and Greece.', egg: 'balloon', room: 2.98 },
];

export const DATES = { meet: '2017-07', sydney: '2021-02', leftFinoComp: AMELIA_LEFT_FINOCOMP, joinedHeirWealth: '2023-01', back: '2023-03', dating: '2024-08', engaged: '2026-04', wedding: '2027-04' } as const;

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
// Each year from 2018 to 2025 gets its own scroll, YEAR shares (2024 and
// 2025 more, LONG_YEARS), so the Januaries, and with them the year markers,
// fall where the years say however the milestones fall. Inside a year, each
// milestone takes its room at its date and the rest of the year is spread
// evenly over its twelve months, so a busy year's months rush and a quiet
// year's roll by steadily. The run-in (the opening, the channels, the
// meeting) and the run from 2026 to the wedding (salsa, the engagement, the
// trip, the bend) keep their own lengths: there the months take no scroll of
// their own and each milestone's room runs up to the next.
export const PACED_YEARS = [2018, 2026] as const;
export const YEAR = 1.5;
// 2018 to 2023 are evenly spaced. 2024 and 2025 are longer, so the months
// after dating don't race to 2025 and 2025 and 2026 turn further down the
// river, spaced more evenly with 2027 round the bend (Amelia, October 2026);
// the scroll comes out of the run from 2026, salsa's, the engagement's and
// most of all the trip's.
export const LONG_YEARS: Readonly<Record<number, number>> = { 2024: 2, 2025: 1.9 };
export const yearShares = (year: number) => LONG_YEARS[year] ?? YEAR;
// Each milestone's date holds for HOLD of a share, so the label can be read,
// or for that much of its room where its room is longer (the meeting, the
// trip), or for its own `hold`, before rolling on month by month. The wedding
// holds as the bend ends.
const HOLD = .35, WEDDING_HOLD = .5;
const roomOf = (milestone: Milestone) => milestone.room ?? HOLD;
const holdOf = (milestone: Milestone) => milestone.hold ?? HOLD * Math.max(1, roomOf(milestone));
const yearOf = (m: number) => 2017 + Math.floor(m / 12);
const pacedYear = (year: number) => year >= PACED_YEARS[0] && year < PACED_YEARS[1];
// Scroll for each month of a year, in shares, besides its milestones' rooms.
const pace = (year: number) => pacedYear(year)
  ? (yearShares(year) - MILESTONES.filter(m => yearOf(monthIndex(m.month)) === year).reduce((sum, m) => sum + roomOf(m), 0)) / 12
  : 0;
const TOTAL_ROOM = START_ROOM + WEDDING_HOLD
  + Array.from({ length: PACED_YEARS[1] - PACED_YEARS[0] }, (_, i) => yearShares(PACED_YEARS[0] + i)).reduce((sum, shares) => sum + shares, 0)
  + MILESTONES.filter(m => !pacedYear(yearOf(monthIndex(m.month)))).reduce((sum, m) => sum + roomOf(m), 0);
// Scroll progress in one share: a milestone's room of HOLD is a third of it.
export const ROOM = (VOYAGE_END - ARRIVAL_END) / TOTAL_ROOM;

// Story time at the start of the voyage, on each January of the paced years,
// and at each milestone's date and the end of its hold; straight lines between.
type Anchor = { p: number; m: number };
const ANCHORS: Anchor[] = (() => {
  const anchors = [{ p: ARRIVAL_END, m: monthIndex(VOYAGE_START) }];
  let p = ARRIVAL_END + START_ROOM * ROOM;
  for (let m = monthIndex(MILESTONES[0].month); m < monthIndex(DATES.wedding); m++) {
    const milestone = MILESTONES.find(({ month }) => monthIndex(month) === m);
    if (milestone) {
      anchors.push({ p, m }, { p: p + holdOf(milestone) * ROOM, m });
      p += roomOf(milestone) * ROOM;
    } else if (m % 12 === 0 && pacedYear(yearOf(m))) anchors.push({ p, m });
    p += pace(yearOf(m)) * ROOM;
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
// riverCenter). They set off from their jetties under the opening title (see
// openingRoute), travel at a
// steady pace through the voyage, and glide the last stretch into the jetty.
export const ROUTE = { start: 6, voyage: 4, approach: -164, dock: -172 } as const;
const ROUTE_POINTS = [[0, ROUTE.start], [ARRIVAL_END, ROUTE.voyage], [VOYAGE_END, ROUTE.approach], [DOCKED, ROUTE.dock], [1, ROUTE.dock]];
// The opening's travel (Amelia, October 2026, on a real iPhone: the first
// scroll felt stuck, the boats barely moving with it compared to later
// scrolls). They used to drift just 2 units under the title, a fifth of the
// voyage's pace, for over a screen of scroll. Now, from the title to the
// meeting's date (OPENING_END), they ease away from their jetties as the
// guest starts to scroll, up to speed by `LAUNCH` (about 10svh), and
// travel steadily to where the voyage has them at the meeting, which is
// unchanged, as is everything from there on. That stretch also takes less
// scroll (OPENING_CUT, see progressAtScroll), so every svh of it moves the
// boats as far as an svh of the voyage does.
export const OPENING_END = progressAt(MILESTONES[0].month);
export const LAUNCH = .006;
// The voyage's pace, z a unit of progress, and where it has the boats.
const VOYAGE_PACE = (ROUTE.voyage - ROUTE.approach) / (VOYAGE_END - ARRIVAL_END);
const voyageLine = (p: number) => ROUTE.voyage - VOYAGE_PACE * (p - ARRIVAL_END);
const OPENING_PACE = (ROUTE.start - voyageLine(OPENING_END)) / (OPENING_END - LAUNCH / 2);
function openingRoute(p: number) {
  const run = p < LAUNCH ? p * p / (2 * LAUNCH) : p - LAUNCH / 2;
  return ROUTE.start - OPENING_PACE * run;
}
export const routeAt = (p: number) => p < OPENING_END ? openingRoute(Math.max(0, p)) : interpolate(ROUTE_POINTS, p, ([q]) => q, ([, z]) => z);

// How the page's scroll maps to progress. The page is shorter than it was by
// OPENING_CUT of the old page's scroll, all taken from the opening, so the
// title and the channels run up to the meeting's date in that much less
// scroll (about 85svh: the meeting's date shows after about 160svh, not 247)
// and progress there runs faster per svh; from the meeting's date on each
// share takes just the scroll it did. `f` is how far down the page is
// scrolled, 0 to 1 of as far as it goes. The scroll space in garden.css is
// SCROLL_SPACE svh to match.
export const OPENING_CUT = OPENING_END * (1 - OPENING_PACE / VOYAGE_PACE);
export const SCROLL_SPACE = 2400 - 2300 * OPENING_CUT;
const KNEE = (OPENING_END - OPENING_CUT) / (1 - OPENING_CUT);
export const progressAtScroll = (f: number) => {
  const x = Math.min(1, Math.max(0, f));
  return x < KNEE ? x * OPENING_END / KNEE : OPENING_CUT + x * (1 - OPENING_CUT);
};
export const scrollAtProgress = (p: number) => {
  const x = Math.min(1, Math.max(0, p));
  return x < OPENING_END ? x * KNEE / OPENING_END : (x - OPENING_CUT) / (1 - OPENING_CUT);
};
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

// The milestone the voyage has reached at p (its date has shown), or null
// before the first and outside the voyage.
export function milestoneAt(p: number) {
  if (chapterAt(p) !== 'voyage') return null;
  let reached: Milestone | null = null;
  for (const milestone of MILESTONES) if (progressAt(milestone.month) <= p) reached = milestone;
  return reached;
}

// Where the page's controls step to: the opening, each milestone halfway
// through its date's hold, and the celebration with the boats moored.
export const STOPS: readonly number[] = [0, ...MILESTONES.map(({ month }) => {
  const m = monthIndex(month);
  return (progressAt(m) + progressAt(m + 1e-3)) / 2;
}), 1];
// A scroll position rounds to a pixel, so a stop counts as reached within this.
const AT_STOP = 5e-4;
export const nextStop = (p: number) => STOPS.find(stop => stop > p + AT_STOP) ?? 1;
export const previousStop = (p: number) => STOPS.findLast(stop => stop < p - AT_STOP) ?? 0;
