// The year turning in the garden, by story time: they live in New South
// Wales, so the canopy turns amber round April and May, July and August are
// cooler, sparser and greyer-green (both snow trips fall then), September
// and October bring blossom and fresh growth, and December to February are
// lush. A painter's wash over the trees, grass, plants and light, never a
// filter: GardenSeasons.tsx feeds it to the shaders, GardenSky.tsx to the
// light, GardenDrift.tsx to the falling leaves and petals. Pure, so it can be
// tested (tests/seasons.test.mjs).
import { ROOM, storyMonth } from './journey.ts';

// Guests see the seasons. Dev only: the Review panel's "Seasons" can turn
// them off to compare, remembered across reloads.
export const SEASONS = true;
export const REVIEW_SEASONS = 'pa_dev_seasons';
export const seasonsOn = (stored: string | null) => stored === 'on' ? true : stored === 'off' ? false : SEASONS;

// Each amount runs 0 to 1. `turn` is autumn colour on the deciduous trees,
// `bare` how many of their leaves have fallen, `fresh` spring's new growth,
// `blossom` spring flowers on some of them, `lush` summer's richer green,
// `grey` winter's cooler, greyer wash on everything green, `dry` autumn's
// straw-gold in the grass, and `petals` how many of the petals drifting in
// the air are out (1 is all of them, as without seasons).
export type Season = { turn: number; bare: number; fresh: number; blossom: number; lush: number; grey: number; dry: number; petals: number };
export const NEUTRAL: Season = { turn: 0, bare: 0, fresh: 0, blossom: 0, lush: 0, grey: 0, dry: 0, petals: 1 };
const AMOUNTS = Object.keys(NEUTRAL) as (keyof Season)[];

export const SUMMER: Season = { ...NEUTRAL, lush: 1 };
// Late autumn's first leaves are already down.
export const AUTUMN: Season = { ...NEUTRAL, turn: 1, bare: .2, dry: 1, petals: .6 };
export const WINTER: Season = { ...NEUTRAL, turn: .15, bare: 1, grey: 1, petals: .35 };
export const SPRING: Season = { ...NEUTRAL, fresh: 1, blossom: 1 };

// Each key holds from `from` to `to`, in months of the year from the 1st of
// January (so July is 6 to 7), and the year eases from one to the next
// between them. A milestone's date holds on the 1st of its month, so
// April 2026 and 2027 (3) are autumn, July 2019 (6) and August 2025 (7)
// winter, November 2018 (10) spring and February 2021 (1) summer.
export const SEASON_KEYS: readonly { from: number; to: number; key: Season; name: string }[] = [
  { from: 3, to: 4.7, key: AUTUMN, name: 'autumn' },
  { from: 6, to: 7.4, key: WINTER, name: 'winter' },
  { from: 8.5, to: 10.1, key: SPRING, name: 'spring' },
  { from: 11.3, to: 13.7, key: SUMMER, name: 'summer' },
];

const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};
const mixSeason = (a: Season, b: Season, t: number) =>
  Object.fromEntries(AMOUNTS.map(name => [name, a[name] + (b[name] - a[name]) * t])) as Season;

// The season at a month of the year (any number; it wraps every twelve).
export function seasonOfYear(month: number): Season {
  let m = ((month % 12) + 12) % 12;
  // Summer runs on past the year's end.
  if (m < SEASON_KEYS[0].from) m += 12;
  for (let i = 0; i < SEASON_KEYS.length; i++) {
    const key = SEASON_KEYS[i], next = SEASON_KEYS[(i + 1) % SEASON_KEYS.length];
    const nextFrom = next.from + (i + 1 === SEASON_KEYS.length ? 12 : 0);
    if (m <= key.to) return { ...key.key };
    if (m < nextFrom) return mixSeason(key.key, next.key, smooth((m - key.to) / (nextFrom - key.to)));
  }
  return { ...SEASON_KEYS[0].key };
}

// Months pass unevenly in scroll: about 148svh a year, but a busy year's
// other months rush (2023's April to December go by in about 12svh), so the
// season read straight from the month would flicker through a whole year.
// So the time of year is averaged over the scroll around p, as an angle round
// the year, weighted by a triangle SMOOTHING shares either side: where the
// months roll by steadily it follows them, a little behind and ahead, and
// where they rush the angles cancel and the wash fades towards none
// (`strength`), rather than flashing through the seasons. Story time is
// sampled once on a fine grid of progress; it is straight between its
// points, so the average is worked out exactly on each piece and moves
// smoothly with p.
export const SMOOTHING = .3;
const GRID = 4096;
let grid: Float64Array | null = null;
const months = () => {
  if (!grid) {
    grid = new Float64Array(GRID + 1);
    for (let i = 0; i <= GRID; i++) grid[i] = storyMonth(i / GRID);
  }
  return grid;
};

// ∫ (c + d x) e^{i(a + b x)} dx from x1 to x2, as [re, im].
function piece(a: number, b: number, c: number, d: number, x1: number, x2: number): [number, number] {
  if (Math.abs(b) < 1e-9) {
    const w = c * (x2 - x1) + d * (x2 * x2 - x1 * x1) / 2;
    return [Math.cos(a) * w, Math.sin(a) * w];
  }
  // F(x) = e^{iθ} ((c + d x) / (i b) + d / b²) = e^{iθ} (d / b² − i (c + d x) / b)
  const at = (x: number): [number, number] => {
    const theta = a + b * x, re = d / (b * b), im = -(c + d * x) / b;
    return [Math.cos(theta) * re - Math.sin(theta) * im, Math.sin(theta) * re + Math.cos(theta) * im];
  };
  const [r2, i2] = at(x2), [r1, i1] = at(x1);
  return [r2 - r1, i2 - i1];
}

// The averaged time of year at p, as a month of the year, and how settled it is (0 to 1).
export function yearAround(p: number, shares = SMOOTHING) {
  const g = months(), h = shares * ROOM, turn = Math.PI * 2 / 12;
  let re = 0, im = 0;
  // Triangle weight: rising (x − p + h) / h before p, falling (p + h − x) / h after.
  const halves: [number, number, number, number][] = [[p - h, p, (h - p) / h, 1 / h], [p, p + h, (p + h) / h, -1 / h]];
  for (const [from, to, c, d] of halves) {
    // Outside [0, 1] story time stands still at its ends.
    const ends: [number, number, number][] = [];
    if (from < 0) ends.push([from, Math.min(to, 0), g[0]]);
    if (to > 1) ends.push([Math.max(from, 1), to, g[GRID]]);
    for (const [x1, x2, m] of ends) if (x2 > x1) {
      const [r, i] = piece(m * turn, 0, c, d, x1, x2);
      re += r; im += i;
    }
    const lo = Math.max(0, from), hi = Math.min(1, to);
    if (hi <= lo) continue;
    for (let k = Math.floor(lo * GRID); k < GRID && k / GRID < hi; k++) {
      const x1 = Math.max(lo, k / GRID), x2 = Math.min(hi, (k + 1) / GRID);
      if (x2 <= x1) continue;
      // θ = turn (m_k + slope (x − x_k))
      const slope = (g[k + 1] - g[k]) * GRID;
      const [r, i] = piece(turn * (g[k] - slope * k / GRID), turn * slope, c, d, x1, x2);
      re += r; im += i;
    }
  }
  // The triangle's weights add up to h.
  const strength = Math.min(1, Math.hypot(re, im) / h);
  const month = ((Math.atan2(im, re) / turn) % 12 + 12) % 12;
  return { month, strength };
}

// The season at progress p. Smoothed over the scroll round it while the
// story moves; a reduced-motion still shows its own month's season exactly.
// Remembers the last answer, as the scene asks several times a frame.
let last: { p: number; smoothed: boolean; season: Season } | null = null;
export function seasonAt(p: number, smoothed = true): Season {
  if (last && last.p === p && last.smoothed === smoothed) return last.season;
  let season: Season;
  if (!smoothed) season = seasonOfYear(storyMonth(p));
  else {
    const { month, strength } = yearAround(p);
    season = mixSeason(NEUTRAL, seasonOfYear(month), strength);
  }
  last = { p, smoothed, season };
  return season;
}

// The light's share of the season, kept small so it never fights the day's
// sky (skyCycle.ts): winter's sun a little cooler and weaker, autumn's a
// touch warmer, spring's fill light a shade brighter. Multipliers for the
// sun's colour and intensity and the hemisphere light's intensity.
export function seasonLight(s: Season) {
  return {
    sunColor: [1 + .03 * s.turn - .035 * s.grey, 1 - .015 * s.grey, 1 - .05 * s.turn + .03 * s.grey] as [number, number, number],
    sunIntensity: 1 - .08 * s.grey + .02 * s.lush,
    hemi: 1 - .03 * s.grey + .02 * s.fresh,
  };
}

// The falling leaves' colours: olive and tan, turning gold, amber and russet
// in autumn and dull brown in winter, fresh green in spring.
export const LEAF_COLOURS = {
  green: [0x92 / 255, 0x99 / 255, 0x6d / 255], tan: [0xba / 255, 0x95 / 255, 0x65 / 255],
  gold: [.83, .64, .25], amber: [.8, .48, .2], russet: [.62, .3, .17],
  brown: [.52, .46, .38], fresh: [.62, .7, .36],
} as const;
type Rgb = [number, number, number];
const mixRgb = (a: readonly number[], b: readonly number[], t: number): Rgb => [0, 1, 2].map(i => a[i] + (b[i] - a[i]) * t) as Rgb;
// The i-th falling leaf's colour in season s; without seasons, every third is tan and the rest olive.
export function leafColour(i: number, s: Season): Rgb {
  const base = i % 3 ? LEAF_COLOURS.green : LEAF_COLOURS.tan;
  const autumn = [LEAF_COLOURS.gold, LEAF_COLOURS.amber, LEAF_COLOURS.russet][i % 3];
  let c = mixRgb(base, autumn, Math.min(1, s.turn) * .85);
  c = mixRgb(c, LEAF_COLOURS.brown, s.grey * .6);
  return mixRgb(c, LEAF_COLOURS.fresh, s.fresh * .5 * (i % 3 ? 1 : 0));
}
// The drifting petals: their usual rose, paler like blossom in spring.
export const PETAL_COLOURS = { rose: [0xc8 / 255, 0x88 / 255, 0x89 / 255], blossom: [.93, .78, .8] } as const;
export const petalColour = (s: Season): Rgb => mixRgb(PETAL_COLOURS.rose, PETAL_COLOURS.blossom, s.blossom * .6);
// How much of the i-th of n petals shows: all of them with petals 1, the
// later ones fading out as fewer are about.
export const petalShown = (i: number, n: number, s: Season) => Math.min(1, Math.max(0, s.petals * n - i));
