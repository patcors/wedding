// The seasons in the garden: one cycle over the whole voyage, following the
// story's years in the Australian seasons. Winter from the opening title
// through 2017 to 2019 (they met in July 2017; the 2019 snow trip falls in
// it), spring through 2020 to 2022, summer (the garden as it always looked)
// through 2023 to 2025, and autumn through 2026 and 2027, the engagement, the
// bend and the dock. It changes three times, each easing over a quiet stretch
// of scroll near the January it stands for. Understated by design, so the
// eggs stay what the eye finds: a few trees change, not the avenue. A
// painter's wash over the trees, grass, plants and light, never a filter:
// GardenSeasons.tsx feeds it to the shaders, GardenSky.tsx to the light,
// GardenDrift.tsx to the falling leaves and petals. Pure, so it can be tested
// (tests/seasons.test.mjs).
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
// A warm, lovely autumn: the trees that turn go gold and amber, none thin.
export const AUTUMN: Season = { ...NEUTRAL, turn: 1, dry: .6, petals: .6 };
// A soft, bright winter: a few trees sparse, the grass a little paler.
export const WINTER: Season = { ...NEUTRAL, bare: .8, pale: .8, petals: .4 };
export const SPRING: Season = { ...NEUTRAL, fresh: 1, blossom: 1 };

// The seasons over scroll progress p: each holds from one key to the next of
// the same season and eases between seasons over the scroll from one key to
// the next (about 40svh), in stretches with little else in the picture (see
// /dev/timeline), each as near as it can be to the January it stands for.
export const SEASON_KEYS: readonly { at: number; season: Season; name: string }[] = [
  // 2017 to 2019, from the opening title: winter. They met in July 2017, in
  // the Australian winter, and the snow trip of July 2019 falls inside it.
  { at: 0, season: WINTER, name: 'winter' },
  // Into spring across New Year 2020 (p .3085), after the snowman's flurry
  // and before the graduation's mortarboards, so graduation's still is in
  // blossom.
  { at: .298, season: WINTER, name: 'winter' },
  { at: .318, season: SPRING, name: 'spring' },
  // 2020 to 2022: spring. Into summer over the end of 2022, after the Opera
  // House, before 2023's January (p .4932) and the HeirWealth still there.
  { at: .471, season: SPRING, name: 'spring' },
  { at: .492, season: SUMMER, name: 'summer' },
  // 2023 to 2025: summer, the 2025 snowmen bringing their own flurry. Into
  // autumn after that flurry, before salsa's still on 2026's January (p
  // .7148); autumn then holds through the engagement (April 2026), the bend
  // and the dock (April 2027).
  { at: .696, season: SUMMER, name: 'summer' },
  { at: .714, season: AUTUMN, name: 'autumn' },
  { at: 1, season: AUTUMN, name: 'autumn' },
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
// sky (skyCycle.ts): winter's sun and fill light a little brighter and its
// sun no cooler (the dawn under the title stays warm), soft rather than
// gloomy; autumn's sun a touch warmer, spring's fill a shade brighter.
// Multipliers for the sun's colour and intensity and the hemisphere light's
// intensity, never darker than summer's.
export function seasonLight(s: Season) {
  return {
    sunColor: [1 + .02 * s.turn, 1, 1 - .03 * s.turn - .01 * s.pale] as [number, number, number],
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
// Every other tree and the shrubs stay as they are all year, and the old tree
// at the dock only takes a touch of autumn (`old`): some of its cards go
// gold, never thinning or blossoming, so it stays the tree it is under the
// festoons. A few trees are featured, so each season shows on a tree or two
// the guest really sees: at each of its moments (FEATURED), the ash whose
// crown stands largest in the picture to one side, clear of the middle, on
// that layout (desktop or phone). Behind them a hash of where each ash
// stands has a few more turn (`turns` and up) and grow sparse (`sparse` and
// up), for depth. Blossom is only ever on the featured trees, so spring
// reads as a handful of flowering trees rather than a tint across many.
export const ROLE = { still: 0, turns: 1, sparse: 2, blossom: 3, old: 4 } as const;
export type Role = typeof ROLE[keyof typeof ROLE];
export const TREES = { turns: .88, sparse: .95 } as const;
// The old tree at the dock's model type (oldTreePlacement in gardenTreeSpots.ts),
// and how much of autumn's turn it takes: a share of its cards, and how far each goes.
export const OLD_TREE_TYPE = 4;
export const OLD_TREE_AUTUMN = { cards: .45, turn: .55 } as const;
// The moments each season features a tree at: a milestone's stop and its
// still (by id), or a progress. `sparse` trees also turn in autumn.
export const FEATURED: readonly { role: Role; at: readonly (string | number)[] }[] = [
  { role: ROLE.sparse, at: ['meet', 'snow-2019'] },
  { role: ROLE.blossom, at: ['graduation', .42, 'interim'] },
  { role: ROLE.turns, at: ['salsa', 'engaged', 'turkey-greece', .86, .95, 1] },
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
      // A tree another season already features is passed over for the next.
      const taken = picks.get(key(tree.x, tree.z));
      if (taken !== undefined && taken !== role) continue;
      const crown = project({ centre: [tree.x, treeBase(tree, width) + 6 * tree.scale, tree.z], radius: 3.5 * tree.scale }, view, lens);
      if (!crown.screen || crown.depth < depth[0] || crown.depth > depth[1]) continue;
      const x = Math.abs(crown.screen[0]), y = crown.screen[1];
      if (x < across[0] || x > across[1] || y < up[0] || y > up[1]) continue;
      if (!best || crown.pixels > best.pixels) best = { tree, pixels: crown.pixels };
    }
    // A stop and its still often share their tree.
    if (best) picks.set(key(best.tree.x, best.tree.z), role);
  }
  featured.set(`${width},${mobile}`, picks);
  return picks;
}

// A tree's role and its shade (0 to 1: gold to amber in autumn, pinker or
// whiter blossom), from where it stands and its model `type`
// (gardenTreeSpots.ts: 0 to 3 the ashes), on a layout.
export function treeSeason(x: number, z: number, type: number, width: number, mobile: boolean): { role: Role; shade: number } {
  const shade = hash(x, z, 7.1);
  if (type === OLD_TREE_TYPE) return { role: ROLE.old, shade };
  if (type > 3) return { role: ROLE.still, shade };
  const pick = featuredTrees(width, mobile).get(key(x, z));
  if (pick !== undefined) return { role: pick, shade };
  const h = hash(x, z);
  return { role: h >= TREES.sparse ? ROLE.sparse : h >= TREES.turns ? ROLE.turns : ROLE.still, shade };
}
