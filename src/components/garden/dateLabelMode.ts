// Dev only (the Review panel): how the voyage's running date reads, to judge
// whether it's still wanted now each year is marked in the scenery. Guests
// always see the month and year; screen readers hear each milestone either
// way. Pure, so it can be tested.
export const DATE_LABEL_MODES = { full: 'Month & year', year: 'Year only', off: 'Off' } as const;
export type DateLabelMode = keyof typeof DATE_LABEL_MODES;

// A remembered choice, or the default for anything else.
export const dateLabelMode = (stored: string | null): DateLabelMode =>
  stored !== null && Object.hasOwn(DATE_LABEL_MODES, stored) ? stored as DateLabelMode : 'full';

// What the label shows for a date like "July 2017": its month and year, the
// year alone, or nothing.
export function shownDate(label: string, mode: DateLabelMode) {
  const [month = '', year = ''] = label.split(' ');
  return { month: mode === 'full' ? month : '', year: mode === 'off' ? '' : year };
}
