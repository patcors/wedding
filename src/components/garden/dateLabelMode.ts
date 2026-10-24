// How the voyage's running date reads: in digits rolling day by day, as
// guests see it (Amelia, October 2026), or, in the Review panel only, as month and year, the year
// alone or not at all. Screen readers hear each milestone either way. Pure,
// so it can be tested.
import { DATES, MILESTONES, monthIndex } from './journey.ts';

// Digits come in four looks to compare (Amelia, October 2026): each digit
// flipping over like a flip clock's card (`digits`), simply changing with no
// animation (`blink`), rolling like a cryptex's ring or an old iPhone's date
// picker (`roll`), or rolling through every day on the way (`count`, as
// guests see it since Amelia chose it, October 2026).
export const DATE_LABEL_MODES = { full: 'Month & year', year: 'Year only', digits: 'Digits, flipping', blink: 'Digits, no animation', roll: 'Digits, rolling', count: 'Digits, rolling every day', off: 'Off' } as const;
export type DateLabelMode = keyof typeof DATE_LABEL_MODES;
export type DigitLook = 'flip' | 'blink' | 'roll' | 'count';
export const digitLook = (mode: DateLabelMode): DigitLook | null =>
  mode === 'digits' ? 'flip' : mode === 'blink' || mode === 'roll' || mode === 'count' ? mode : null;

// A remembered choice, or the default for anything else.
export const DEFAULT_DATE_LABEL: DateLabelMode = 'count';
export const dateLabelMode = (stored: string | null): DateLabelMode =>
  stored !== null && Object.hasOwn(DATE_LABEL_MODES, stored) ? stored as DateLabelMode : DEFAULT_DATE_LABEL;

// What the label shows for a date like "July 2017": its month and year, the
// year alone, or nothing. Digits show their own date (digitDate).
export function shownDate(label: string, mode: DateLabelMode) {
  const [month = '', year = ''] = label.split(' ');
  return { month: mode === 'full' ? month : '', year: mode === 'full' || mode === 'year' ? year : '' };
}

// Digits: the date as DD-MM-YYYY, its days ticking over with story time as
// the guest scrolls. It counts up from the voyage's start to the day they met,
// then on through each milestone to the wedding, holding on each milestone's
// own day: MET_ON, the days Amelia gave (October 2026) in MILESTONE_DAYS, and
// WEDDING_ON. A milestone whose day isn't known yet holds on MILESTONE_DAY of
// its month. Only the label changes: each still holds at its month's place on
// the river, so nothing in the scenery moves.
export const VOYAGE_FROM = '2017-01-01', MET_ON = '2017-07-25', WEDDING_ON = '2027-04-16';
export const MILESTONE_DAYS: readonly string[] = [
  MET_ON,
  '2018-11-18', // the FinoComp internship starts
  '2019-07-20', // Amelia breaks her wrist on the snow trip
  '2021-02-27', // Amelia moves to Sydney
  '2023-01-01', // Amelia starts at HeirWealth
  '2023-03-20', // Patrick starts at HeirWealth
  '2024-05-02', // Amelia's apartment settles (Patrick's on 24 July)
  '2024-06-04', // Patrick moves into hers
  '2024-08-02', // they start dating
  '2025-08-29', // the second snow trip
  '2026-01-28', // their first salsa class
  '2026-04-16', // they get engaged, a year to the day before the wedding
  '2026-07-07', // the balloon flight, three days after the Hagia Sophia
  WEDDING_ON,
];
export const MILESTONE_DAY = 1;
export const settledOn = (month: string) =>
  MILESTONE_DAYS.find(day => day.startsWith(month)) ?? `${month}-${String(MILESTONE_DAY).padStart(2, '0')}`;

const DAY = 864e5;
const dayNumber = (iso: string) => {
  const [year, month, day] = iso.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / DAY;
};
// The day at each milestone's story month (and the voyage's start and the
// wedding's); straight lines between, so the days run evenly from one to the next.
const KNOTS: readonly (readonly [number, number])[] = [
  [monthIndex(VOYAGE_FROM.slice(0, 7)), dayNumber(VOYAGE_FROM)],
  ...MILESTONES.map(({ month }) => [monthIndex(month), dayNumber(settledOn(month))] as const),
  [monthIndex(DATES.wedding), dayNumber(WEDDING_ON)],
];

// The date at story month `month` (storyMonth(p)), e.g. "25-07-2017".
export function digitDate(month: number) {
  let i = 1;
  while (i < KNOTS.length - 1 && month > KNOTS[i][0]) i++;
  const [[ma, da], [mb, db]] = [KNOTS[i - 1], KNOTS[i]];
  const t = Math.min(1, Math.max(0, (month - ma) / (mb - ma)));
  // Hold exactly on a day despite rounding in story time.
  return dayDigits(Math.floor(da + (db - da) * t + 1e-4));
}
const dayDigits = (day: number) => {
  const date = new Date(day * DAY), two = (n: number) => String(n).padStart(2, '0');
  return `${two(date.getUTCDate())}-${two(date.getUTCMonth() + 1)}-${date.getUTCFullYear()}`;
};
const digitsDay = (digits: string) => dayNumber(digits.split('-').reverse().join('-'));

// Whether digits "DD-MM-YYYY" `next` are an earlier date than `shown`, so a
// rolling digit rolls back the other way.
const sortable = (digits: string) => digits.split('-').reverse().join('');
export const goesBack = (shown: string, next: string) => sortable(next) < sortable(shown);

// "Digits, rolling every day": the date steps a day at a time towards the
// story's, every one a real date. Each step takes `within` ms shared over
// the days still to go, no more than `most` and no less than `least`, so it
// keeps close to a guest scrolling steadily but never rolls more than twenty
// days a second (it could reach thirty, a touch too quick for Patrick,
// October 2026). It
// is never more than `behind` days behind: scrolled faster than it can
// count (Sail on, a quick scroll, a jump as "Back to the beginning" makes or
// a page reopened part way), it skips days to stay that close, so when the
// guest stops it counts those last two weeks and settles in under a second.
// It counted up to 120 days, which Amelia found took too long to settle
// (October 2026). A step is due a few ms early, so frame timing never makes
// it wait a whole extra frame.
export const COUNT_PACE = { within: 400, most: 260, least: 50, early: 4, behind: 14 } as const;
export type Count = { shown: string; at: number; step: number };
export const startCount = (shown: string): Count => ({ shown, at: -Infinity, step: COUNT_PACE.most });
export function countTowards(count: Count, target: string, now: number): Count {
  if (count.shown === target || now - count.at < count.step - COUNT_PACE.early) return count;
  const to = digitsDay(target), from = Math.min(to + COUNT_PACE.behind, Math.max(to - COUNT_PACE.behind, digitsDay(count.shown))), left = Math.abs(to - from);
  const step = Math.min(COUNT_PACE.most, Math.max(COUNT_PACE.least, COUNT_PACE.within / left));
  return { shown: dayDigits(from + Math.sign(to - from)), at: now, step };
}

// How often the day, the month and the year may flip, in ms (each flip's
// animation takes this long), so a fast scroll steps the days along a few at
// a time but never strobes: the days fastest, the months slower, the years
// slowest. Calmed (October 2026) from 100, 240 and 400, which Amelia found
// too busy. Each
// group's digits flip together, each only if it changes, so the day and the
// month never read as one that can't be (a "32" or an "18"). A group that may
// not flip yet catches up once it may, straight to the date then showing.
export const FLIP_EVERY = [300, 300, 0, 500, 500, 0, 700, 700, 700, 700] as const;
const GROUPS = [[0, 2], [3, 5], [6, 10]] as const;
export type Flips = { shown: string; at: readonly number[] };
export const startFlips = (shown: string): Flips => ({ shown, at: GROUPS.map(() => -Infinity) });
// The digits showing at `now` (ms) on their way to `target`; the same object
// while nothing flips.
export function flipTowards(flips: Flips, target: string, now: number): Flips {
  if (flips.shown === target) return flips;
  let shown = flips.shown, changed = false;
  const at = GROUPS.map(([from, to], g) => {
    if (shown.slice(from, to) === target.slice(from, to) || now - flips.at[g] < FLIP_EVERY[from]) return flips.at[g];
    shown = shown.slice(0, from) + target.slice(from, to) + shown.slice(to);
    changed = true;
    return now;
  });
  return changed ? { shown, at } : flips;
}
