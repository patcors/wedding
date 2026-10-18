// Dev only (the Review panel): how the voyage's running date reads, to judge
// whether it's still wanted now each year is marked in the scenery, and to
// trial it in digits. Guests always see the month and year; screen readers
// hear each milestone either way. Pure, so it can be tested.
import { DATES, MILESTONES, monthIndex } from './journey.ts';

export const DATE_LABEL_MODES = { full: 'Month & year', year: 'Year only', digits: 'Digits', off: 'Off' } as const;
export type DateLabelMode = keyof typeof DATE_LABEL_MODES;

// A remembered choice, or the default for anything else.
export const dateLabelMode = (stored: string | null): DateLabelMode =>
  stored !== null && Object.hasOwn(DATE_LABEL_MODES, stored) ? stored as DateLabelMode : 'full';

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
  '2024-08-02', // they start dating
  '2025-08-29', // the second snow trip
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
  const date = new Date(Math.floor(da + (db - da) * t + 1e-4) * DAY);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${two(date.getUTCDate())}-${two(date.getUTCMonth() + 1)}-${date.getUTCFullYear()}`;
}

// How often the day, the month and the year may flip, in ms (each flip's
// animation takes this long), so a fast scroll flicks the days but never
// strobes: the days fastest, the months slower, the years slowest. Each
// group's digits flip together, each only if it changes, so the day and the
// month never read as one that can't be (a "32" or an "18"). A group that may
// not flip yet catches up once it may, straight to the date then showing.
export const FLIP_EVERY = [100, 100, 0, 240, 240, 0, 400, 400, 400, 400] as const;
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
