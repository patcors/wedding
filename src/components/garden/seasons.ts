// The seasons in the garden, chosen for the story rather than the calendar.
// Summer, the garden as it always looked, holds for most of the voyage; it
// turns only a handful of times, each over a long stretch of scroll where the
// scenery is quiet: a mild winter for each snow trip (July 2019, August 2025),
// a short autumn in the quiet stretch after the Harbour Bridge (2021), and
// spring blossom after the second snow trip, through salsa and the
// engagement. Understated by design, so the eggs stay what the eye finds: a
// few trees change, not the avenue. A painter's wash over the trees, grass,
// plants and light, never a filter: GardenSeasons.tsx feeds it to the
// shaders, GardenSky.tsx to the light, GardenDrift.tsx to the falling leaves
// and petals. Pure, so it can be tested (tests/seasons.test.mjs).
import { MILESTONES, STOPS, progressAt } from './journey.ts';
import { treeBase, treePlacements } from './gardenTreeSpots.ts';
import { cameraPose } from './cameraRig.ts';
import { LAYOUTS, project, viewOf } from './voyageTimeline.ts';

// Guests see the seasons. Dev only: the Review panel's "Seasons" can turn
// them off to compare, remembered across reloads.
export const SEASONS = true;
export const REVIEW_SEASONS = 'pa_dev_seasons';
export const seasonsOn = (stored: string | null) => stored === 'on' ? true : stored === 'off' ? false : SEASONS;

// Each amount runs 0 to 1. `turn` is autumn colour on the few trees that
// turn, `bare` how sparse a few of them grow in winter, `fresh` spring's new
// growth, `blossom` spring flowers on a handful of trees, `pale` winter's
// paler, frost-dried grass, `dry` autumn's straw in the grass, and `petals`
// how many of the petals drifting in the air are out (1 is all of them, as
// without seasons).
export type Season = { turn: number; bare: number; fresh: number; blossom: number; pale: number; dry: number; petals: number };
export const NEUTRAL: Season = { turn: 0, bare: 0, fresh: 0, blossom: 0, pale: 0, dry: 0, petals: 1 };
const AMOUNTS = Object.keys(NEUTRAL) as (keyof Season)[];

// Summer is the garden exactly as it is with the seasons off.
export const SUMMER: Season = { ...NEUTRAL };
export const AUTUMN: Season = { ...NEUTRAL, turn: 1, bare: .15, dry: 1, petals: .7 };
// A soft, bright, crisp winter: a few trees sparse, the grass a little paler.
export const WINTER: Season = { ...NEUTRAL, bare: 1, pale: 1, petals: .5 };
export const SPRING: Season = { ...NEUTRAL, fresh: 1, blossom: 1 };

// The seasons over scroll progress p: each holds from one key to the next of
// the same season and eases between seasons over the scroll from one key to
// the next (about 40 to 80svh), in stretches with little else in the
// picture (see /dev/timeline). Dates are where those stretches fall.
export const SEASON_KEYS: readonly { at: number; season: Season; name: string }[] = [
  { at: 0, season: SUMMER, name: 'summer' },
  // Coming into 2019 (after the internship's November), winter by April for
  // the snowman's flurry in July, gone by the summer of 2020.
  { at: .238, season: SUMMER, name: 'summer' },
  { at: .262, season: WINTER, name: 'winter' },
  { at: .29, season: WINTER, name: 'winter' },
  { at: .312, season: SUMMER, name: 'summer' },
  // After the Harbour Bridge (February 2021), autumn through 2021's middle.
  { at: .389, season: SUMMER, name: 'summer' },
  { at: .407, season: AUTUMN, name: 'autumn' },
  { at: .423, season: AUTUMN, name: 'autumn' },
  { at: .441, season: SUMMER, name: 'summer' },
  // Early 2025 into winter for the snowmen holding hands (August 2025), then
  // spring from that October, blossom through salsa and the engagement,
  // back to summer over the trip (July 2026), before the bend.
  { at: .645, season: SUMMER, name: 'summer' },
  { at: .665, season: WINTER, name: 'winter' },
  { at: .69, season: WINTER, name: 'winter' },
  { at: .712, season: SPRING, name: 'spring' },
  { at: .775, season: SPRING, name: 'spring' },
  { at: .81, season: SUMMER, name: 'summer' },
  { at: 1, season: SUMMER, name: 'summer' },
];

const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};
const mixSeason = (a: Season, b: Season, t: number) =>
  Object.fromEntries(AMOUNTS.map(name => [name, a[name] + (b[name] - a[name]) * t])) as Season;

// The season at progress p. The same for a moving scene and a reduced-motion
// still (which stands at its milestone's own p), so a still shows the season
// the guest would see there. Remembers the last answer, as the scene asks
// several times a frame.
let last: { p: number; season: Season } | null = null;
export function seasonAt(p: number): Season {
  if (last && last.p === p) return last.season;
  let season: Season = { ...SEASON_KEYS[SEASON_KEYS.length - 1].season };
  if (p <= 0) season = { ...SEASON_KEYS[0].season };
  else for (let i = 1; i < SEASON_KEYS.length; i++) {
    const a = SEASON_KEYS[i - 1], b = SEASON_KEYS[i];
    if (p > b.at) continue;
    season = a.season === b.season ? { ...a.season } : mixSeason(a.season, b.season, smooth((p - a.at) / (b.at - a.at)));
    break;
  }
  last = { p, season };
  return season;
}

// The season's name at p, for the docs and tests: the nearer key's, halfway
// through an ease.
export function seasonName(p: number) {
  const i = SEASON_KEYS.findIndex(k => k.at >= p);
  if (i <= 0) return SEASON_KEYS[0].name;
  const a = SEASON_KEYS[i - 1], b = SEASON_KEYS[i];
  return p - a.at < b.at - p ? a.name : b.name;
}

// The light's share of the season, kept tiny so it never fights the day's
// sky (skyCycle.ts): winter's sun a shade whiter and its fill light a little
// brighter, crisp rather than gloomy; autumn's sun a touch warmer, spring's
// fill a shade brighter. Multipliers for the sun's colour and intensity and
// the hemisphere light's intensity, never darker than summer's.
export function seasonLight(s: Season) {
  return {
    sunColor: [1 + .02 * s.turn - .01 * s.pale, 1, 1 - .03 * s.turn + .02 * s.pale] as [number, number, number],
    sunIntensity: 1 + .02 * s.pale,
    hemi: 1 + .04 * s.pale + .02 * s.fresh,
  };
}

// The falling leaves' colours: olive and tan, a few turning gold and amber
// in autumn, fresh green in spring.
export const LEAF_COLOURS = {
  green: [0x92 / 255, 0x99 / 255, 0x6d / 255], tan: [0xba / 255, 0x95 / 255, 0x65 / 255],
  gold: [.8, .63, .3], amber: [.76, .5, .25],
  fresh: [.62, .7, .36],
} as const;
type Rgb = [number, number, number];
const mixRgb = (a: readonly number[], b: readonly number[], t: number): Rgb => [0, 1, 2].map(i => a[i] + (b[i] - a[i]) * t) as Rgb;
// The i-th falling leaf's colour in season s; without seasons, every third is
// tan and the rest olive. In autumn every other leaf turns, gold or amber.
export function leafColour(i: number, s: Season): Rgb {
  const base = i % 3 ? LEAF_COLOURS.green : LEAF_COLOURS.tan;
  const autumn = i % 4 < 2 ? LEAF_COLOURS.gold : LEAF_COLOURS.amber;
  const c = mixRgb(base, autumn, Math.min(1, s.turn) * (i % 2 ? .7 : 0));
  return mixRgb(c, LEAF_COLOURS.fresh, s.fresh * .4 * (i % 3 ? 1 : 0));
}
// The drifting petals: their usual rose, paler like blossom in spring.
export const PETAL_COLOURS = { rose: [0xc8 / 255, 0x88 / 255, 0x89 / 255], blossom: [.96, .85, .87] } as const;
export const petalColour = (s: Season): Rgb => mixRgb(PETAL_COLOURS.rose, PETAL_COLOURS.blossom, s.blossom * .7);
// How much of the i-th of n petals shows: all of them with petals 1, the
// later ones fading out as fewer are about.
export const petalShown = (i: number, n: number, s: Season) => Math.min(1, Math.max(0, s.petals * n - i));

// Which trees take part, and how (GardenTrees.tsx hands each tree's role to
// its leaves' shader as the instance's colour; GardenSeasons.tsx reads it).
// Every other tree, the shrubs and the old tree at the dock stay as they are
// all year. A few trees are featured, so each season shows on a tree or two
// the guest really sees: at each of its moments (FEATURED), the ash whose
// crown stands largest in the picture to one side, clear of the middle, on
// that layout (desktop or phone). Behind them a hash of where each ash
// stands has a few more turn (`turns` and up) and grow sparse (`sparse` and
// up), for depth. Blossom is only ever on the featured trees, so spring
// reads as a handful of flowering trees rather than a tint across many.
export const ROLE = { still: 0, turns: 1, sparse: 2, blossom: 3 } as const;
export type Role = typeof ROLE[keyof typeof ROLE];
export const TREES = { turns: .88, sparse: .95 } as const;
// The moments each season features a tree at: a milestone's stop and its
// still (by id), or a progress. `sparse` trees also turn in autumn.
export const FEATURED: readonly { role: Role; at: readonly (string | number)[] }[] = [
  { role: ROLE.sparse, at: ['snow-2019', 'snow-2025'] },
  { role: ROLE.turns, at: [.405, .415, .425] },
  { role: ROLE.blossom, at: ['salsa', 'engaged'] },
];
// Where a featured crown must stand: its middle this far in front of the
// camera, and across the picture (0 the middle, 1 the edge) and up it.
export const FEATURE_FRAME = { depth: [12, 34], across: [.2, .85], up: [-.3, .7] } as const;

const hash = (x: number, z: number, salt = 0) => {
  const v = Math.sin(x * 12.9898 + z * 78.233 + salt) * 43758.5453;
  return v - Math.floor(v);
};
const key = (x: number, z: number) => `${x.toFixed(2)},${z.toFixed(2)}`;
const moments = (at: string | number) => {
  if (typeof at === 'number') return [at];
  const i = MILESTONES.findIndex(m => m.id === at);
  return [STOPS[i + 1], progressAt(MILESTONES[i].month)];
};

// The featured trees on a layout, by where they stand, and their roles.
const featured = new Map<string, Map<string, Role>>();
export function featuredTrees(width: number, mobile: boolean): Map<string, Role> {
  const cached = featured.get(`${width},${mobile}`);
  if (cached) return cached;
  const lens = LAYOUTS[mobile ? 'phone' : 'desktop'], picks = new Map<string, Role>();
  const ashes = treePlacements(width, mobile).filter(t => t.type <= 3);
  const { depth, across, up } = FEATURE_FRAME;
  for (const { role, at } of FEATURED) for (const p of at.flatMap(moments)) {
    const view = viewOf(cameraPose(p, width));
    let best: { tree: typeof ashes[number]; pixels: number } | null = null;
    for (const tree of ashes) {
      const crown = project({ centre: [tree.x, treeBase(tree, width) + 6 * tree.scale, tree.z], radius: 3.5 * tree.scale }, view, lens);
      if (!crown.screen || crown.depth < depth[0] || crown.depth > depth[1]) continue;
      const x = Math.abs(crown.screen[0]), y = crown.screen[1];
      if (x < across[0] || x > across[1] || y < up[0] || y > up[1]) continue;
      if (!best || crown.pixels > best.pixels) best = { tree, pixels: crown.pixels };
    }
    // A stop and its still often share their tree, which keeps its first role.
    if (best && !picks.has(key(best.tree.x, best.tree.z))) picks.set(key(best.tree.x, best.tree.z), role);
  }
  featured.set(`${width},${mobile}`, picks);
  return picks;
}

// A tree's role and its shade (0 to 1: gold to amber in autumn, pinker or
// whiter blossom), from where it stands and its model `type`
// (gardenTreeSpots.ts: 0 to 3 the ashes), on a layout.
export function treeSeason(x: number, z: number, type: number, width: number, mobile: boolean): { role: Role; shade: number } {
  const shade = hash(x, z, 7.1);
  if (type > 3) return { role: ROLE.still, shade };
  const pick = featuredTrees(width, mobile).get(key(x, z));
  if (pick !== undefined) return { role: pick, shade };
  const h = hash(x, z);
  return { role: h >= TREES.sparse ? ROLE.sparse : h >= TREES.turns ? ROLE.turns : ROLE.still, shade };
}
