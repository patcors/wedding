// Guests see the seasons (seasons.ts). Dev only: the Review panel's "Seasons"
// can turn them off to compare, remembered across reloads. Apart from
// seasons.ts so the page's first script can read them without pulling in
// three (see docs/VOYAGE.md, "The first script").
export const SEASONS = true;
export const REVIEW_SEASONS = 'pa_dev_seasons';
export const seasonsOn = (stored: string | null) => stored === 'on' ? true : stored === 'off' ? false : SEASONS;
