// "Our story": the voyage told in words, for anyone who would rather read it
// than scroll (a screen-reader user, a guest whose scene didn't load, someone
// coming back to it). Each milestone's date, written out, and its words (the
// `description` screen readers hear as the guest scrolls), in order, ending
// with the wedding. Opened from the header (StoryDialog in Garden.tsx). Pure,
// so it can be tested.
import { MILESTONES, STOPS } from './journey.ts';
import { MILESTONE_DAYS, WEDDING_ON } from './dateLabelMode.ts';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// A date written out: '2021-02-27' as "27 February 2021", or a month alone,
// '2017-11', as "November 2017".
export function writtenDate(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  const written = `${MONTH_NAMES[month - 1]} ${year}`;
  return day ? `${day} ${written}` : written;
}

// The day a milestone happened, if Amelia has given it (MILESTONE_DAYS), or
// else just its month. The running digits hold an unknown day on the 1st
// (settledOn), but written out that would read as a fact, so here it is left
// at the month until the day is known.
export const storyDay = (month: string) => MILESTONE_DAYS.find(day => day.startsWith(month)) ?? month;

// The wedding's words, after the milestones' descriptions: its venue as the
// celebration's copy gives it.
export const WEDDING_WORDS = 'They get married at Jasper’s Berry, in Berry, NSW.';

// One entry: `datetime` for <time>, the date as written, its words, and the
// stop the scene goes to to see it (a milestone's in STOPS; the celebration
// for the wedding).
export type StoryEntry = { id: string; datetime: string; date: string; words: string; stop: number };

export const STORY: readonly StoryEntry[] = [
  ...MILESTONES.map(({ id, month, description }, i) => {
    const datetime = storyDay(month);
    return { id, datetime, date: writtenDate(datetime), words: description, stop: STOPS[i + 1] };
  }),
  { id: 'wedding', datetime: WEDDING_ON, date: writtenDate(WEDDING_ON), words: WEDDING_WORDS, stop: STOPS[STOPS.length - 1] },
];
