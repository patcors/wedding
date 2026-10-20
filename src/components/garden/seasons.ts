// The seasons in the garden: one cycle over the whole voyage, following the
// story's years in the Australian seasons. Winter from the opening title
// through 2017 to 2019 (they met in July 2017; the 2019 snow trip falls in
// it), spring through 2020 to 2022, summer (the garden as it always looked)
// through 2023 to 2025, and autumn through 2026 and 2027, the engagement, the
// bend and the dock. The old tree at the dock is an evergreen, the same in
// every season. It changes three times, each easing over a quiet stretch
// of scroll near the January it stands for. Each season has its own palette
// (Amelia, October 2026): a crisp, cool winter with many trees bare and the
// grass frosted, cherry blossom and flowers on the banks in spring, the
// garden as it always was in summer, amber, orange, rust and red in autumn;
// the motion stays as calm as ever, so the eggs stay what the eye finds. A
// painter's wash over the trees, grass, plants, flowers and light, never a
// filter: GardenSeasons.tsx feeds it to the shaders, GardenSky.tsx to the
// light, GardenDrift.tsx to the falling leaves and petals. Pure, so it can be tested
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

// Each amount runs 0 to 1. `turn` is autumn colour on the trees that turn,
// `bare` how bare the trees that stand bare grow in winter, `fresh` spring's
// new growth, `blossom` spring flowers on the trees that blossom, `flowers`
// the flowers out on the banks in spring, `pale` winter's frost on the grass,
// `dry` autumn's straw in the grass, and `petals` how many of the petals
// drifting in the air are out (1 is all of them, as without seasons).
export type Season = { turn: number; bare: number; fresh: number; blossom: number; flowers: number; pale: number; dry: number; petals: number };
export const NEUTRAL: Season = { turn: 0, bare: 0, fresh: 0, blossom: 0, flowers: 0, pale: 0, dry: 0, petals: 1 };
const AMOUNTS = Object.keys(NEUTRAL) as (keyof Season)[];

// Summer is the garden exactly as it is with the seasons off.
export const SUMMER: Season = { ...NEUTRAL };
// Autumn: much of the avenue amber, orange, rust and red, the grass straw.
export const AUTUMN: Season = { ...NEUTRAL, turn: 1, dry: 1, petals: .4 };
// Winter: crisp and bright, not grey: many trees bare, the grass frosted, the light cooler.
export const WINTER: Season = { ...NEUTRAL, bare: 1, pale: 1, petals: .2 };
// Spring: cherry-pink blossom, fresh green, flowers along the banks.
export const SPRING: Season = { ...NEUTRAL, fresh: 1, blossom: 1, flowers: 1 };

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

// The light's share of the season, small beside the day's sky (skyCycle.ts)
// but enough to set each season's palette: winter's sun and fill light
// cooler and brighter, so the shadows go blue and the frost glints, crisp
// rather than gloomy; autumn's sun and fill warmer; spring's fill a shade
// brighter. Multipliers for the sun's colour and intensity and the
// hemisphere light's colour and intensity, never darker than summer's.
export function seasonLight(s: Season) {
  return {
    sunColor: [1 + .04 * s.turn - .03 * s.pale, 1, 1 - .07 * s.turn + .05 * s.pale] as [number, number, number],
    sunIntensity: 1 + .04 * s.pale,
    hemiColor: [1 + .02 * s.turn - .04 * s.pale, 1, 1 - .04 * s.turn + .06 * s.pale] as [number, number, number],
    hemi: 1 + .08 * s.pale + .04 * s.fresh,
  };
}

// The falling leaves' colours: olive and tan; in autumn most turn amber,
// orange, rust or red; fresh green in spring.
export const LEAF_COLOURS = {
  green: [0x92 / 255, 0x99 / 255, 0x6d / 255], tan: [0xba / 255, 0x95 / 255, 0x65 / 255],
  amber: [.86, .58, .2], orange: [.88, .4, .12], rust: [.68, .27, .12], red: [.76, .18, .12],
  fresh: [.62, .74, .32],
} as const;
const AUTUMN_LEAVES = [LEAF_COLOURS.amber, LEAF_COLOURS.orange, LEAF_COLOURS.rust, LEAF_COLOURS.red];
type Rgb = [number, number, number];
const mixRgb = (a: readonly number[], b: readonly number[], t: number): Rgb => [0, 1, 2].map(i => a[i] + (b[i] - a[i]) * t) as Rgb;
// The i-th falling leaf's colour in season s; without seasons, every third is
// tan and the rest olive. In autumn three in four turn, round the palette.
export function leafColour(i: number, s: Season): Rgb {
  const base = i % 3 ? LEAF_COLOURS.green : LEAF_COLOURS.tan;
  const c = mixRgb(base, AUTUMN_LEAVES[i % 4], Math.min(1, s.turn) * (i % 4 === 3 ? 0 : .9));
  return mixRgb(c, LEAF_COLOURS.fresh, s.fresh * .5 * (i % 3 ? 1 : 0));
}
// The drifting petals: their usual rose, cherry pink in spring.
export const PETAL_COLOURS = { rose: [0xc8 / 255, 0x88 / 255, 0x89 / 255], blossom: [.96, .52, .68] } as const;
export const petalColour = (s: Season): Rgb => mixRgb(PETAL_COLOURS.rose, PETAL_COLOURS.blossom, s.blossom);
// How much of the i-th of n petals shows: all of them with petals 1, the
// later ones fading out as fewer are about.
export const petalShown = (i: number, n: number, s: Season) => Math.min(1, Math.max(0, s.petals * n - i));

// The trees' palettes, in sRGB (GardenSeasons.tsx turns them to the shaders'
// linear light, so they stay as saturated on screen as written): autumn's
// amber, orange, rust and red, most trees amber or orange; spring's cherry
// blossom, from a deeper to a paler pink, never white, so it never reads as
// snow.
export const AUTUMN_TREE_COLOURS = [[.92, .64, .2], [.93, .47, .13], [.74, .31, .13], [.74, .2, .13]] as const;
export const BLOSSOM_COLOURS = [[.93, .38, .6], [.98, .6, .74]] as const;

// The flowers on the banks in spring (GardenSeasons.tsx's seasonalFlowers
// and seasonalClover): cherry pink, buttercup yellow, white and violet, one
// colour to a clump; the bank flowers grow by `FLOWER_GROWTH` and about half
// the clover's colonies (`CLOVER_FLOWERS`) lift their heads above the grass.
export const FLOWER_COLOURS = [[1, .42, .64], [1, .8, .2], [1, .97, .9], [.62, .42, .92]] as const;
export const FLOWER_GROWTH = 1.4, CLOVER_FLOWERS = { share: .5, lift: .2 } as const;

// Which trees take part, and how (GardenTrees.tsx hands each tree's part to
// its leaves' shader as the instance's colour; GardenSeasons.tsx reads it).
// Each ash takes part in each season by a hash of where it stands, a share of
// the avenue apiece (SHARES): in winter a good number stand bare, in autumn
// most turn, in spring a fair few blossom. The rest of the avenue changes only
// a little (its leaves cooler in winter, fresher in spring, warmer in
// autumn), and the shrubs not at all. The old tree at the dock (`old`) is an
// evergreen, as the real one is: no season touches it. A few trees are featured besides, so each season shows on a
// tree the guest really sees: at each of its moments (FEATURED), the ash
// whose crown stands largest in the picture to one side, clear of the middle,
// on that layout (desktop or phone).
export const ROLE = { still: 0, turns: 1, sparse: 2, blossom: 3 } as const;
export type Role = typeof ROLE[keyof typeof ROLE];
// A tree's parts, as bits: it turns in autumn, stands bare in winter,
// blossoms in spring, or is the old tree at the dock, which stays as it is.
export const PART = { turns: 1, bare: 2, blossom: 4, old: 8 } as const;
export const SHARES = { turns: .6, bare: .6, blossom: .16 } as const;
// The old tree at the dock's model type (oldTreePlacement in gardenTreeSpots.ts).
export const OLD_TREE_TYPE = 4;
// The moments each season features a tree at: a milestone's stop and its
// still (by id), or a progress. `sparse` trees, bare in winter, also turn in autumn.
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

// A tree's parts (PART's bits) and its shade (0 to 1: amber through orange
// and rust to red in autumn, deeper or paler pink blossom), from where it
// stands and its model `type` (gardenTreeSpots.ts: 0 to 3 the ashes), on a
// layout.
const FEATURED_PART: Record<Role, number> = { [ROLE.still]: 0, [ROLE.turns]: PART.turns, [ROLE.sparse]: PART.bare | PART.turns, [ROLE.blossom]: PART.blossom };
export function treeSeason(x: number, z: number, type: number, width: number, mobile: boolean): { parts: number; shade: number } {
  const shade = hash(x, z, 7.1);
  if (type === OLD_TREE_TYPE) return { parts: PART.old, shade };
  if (type > 3) return { parts: 0, shade };
  const pick = featuredTrees(width, mobile).get(key(x, z));
  const parts = (hash(x, z) < SHARES.turns ? PART.turns : 0)
    | (hash(x, z, 3.3) < SHARES.bare ? PART.bare : 0)
    | (hash(x, z, 5.9) < SHARES.blossom ? PART.blossom : 0);
  return { parts: parts | (pick === undefined ? 0 : FEATURED_PART[pick]), shade };
}
