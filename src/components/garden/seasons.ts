// The seasons in the garden: one cycle over the whole voyage, following the
// story's years in the Australian seasons. Winter from the opening title
// through 2017 to 2019 (they met in July 2017; the 2019 snow trip falls in
// it), spring through 2020 to 2022, summer (the garden as it always looked)
// through 2023 to 2025, and autumn through 2026 and 2027, the engagement, the
// bend and the dock. The old tree at the dock is an evergreen, the same in
// every season. It changes three times, each a slow drift over a long
// stretch of the journey (across two or three stops) round the January it
// stands for, the trees turning one by one. Each season has its own palette
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
// the same season and drifts slowly into the next season over the long
// stretch from one key to the next, across several stops and the January it
// stands for, so the guest sees the season turning rather than a cut
// (Amelia, October 2026: "it reads as hard cuts between seasons rather than
// seasons slowly changing"). Each season keeps a short stretch of its own,
// holding its featured moments (FEATURED).
export const SEASON_KEYS: readonly { at: number; season: Season; name: string }[] = [
  // 2017 to 2019, from the opening title: winter. They met in July 2017, in
  // the Australian winter. Pure winter through the internship's stop.
  { at: 0, season: WINTER, name: 'winter' },
  // Into spring from the end of 2018 to early 2021, across New Year 2020 (p
  // .3085): the 2019 snow trip still mostly winter (about three quarters),
  // graduation well into spring, and the Opera House in full spring.
  { at: .235, season: WINTER, name: 'winter' },
  { at: .37, season: SPRING, name: 'spring' },
  // 2020 to 2022: spring, pure through 2021 (p .42). Into summer from early
  // 2022 to mid-2023, across 2023's January (p .4932): the interim's still
  // mostly spring, the HeirWealth's mostly summer.
  { at: .43, season: SPRING, name: 'spring' },
  { at: .55, season: SUMMER, name: 'summer' },
  // 2023 to 2025: summer, pure through the apartments, living together and
  // dating. Into autumn from late 2024 to the engagement, across the 2025
  // snowmen (still leaning summer) and salsa (well into autumn), ending
  // before the engagement's still (April 2026, p .7435), so autumn is full
  // there and through the trip, the bend and the dock (April 2027). It
  // stands a little before 2026's January (p .7148), as the engagement is only
  // three months after it.
  { at: .63, season: SUMMER, name: 'summer' },
  { at: .742, season: AUTUMN, name: 'autumn' },
  { at: 1, season: AUTUMN, name: 'autumn' },
];

const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};
// The whole picture's drift through a change (the grass, flowers, light and
// drift): half straight, half smoothstep, so it moves at much the same pace
// all the way and only softens at its ends.
const gentle = (t: number) => .5 * t + .5 * smooth(t);
const mixSeason = (a: Season, b: Season, t: number) =>
  Object.fromEntries(AMOUNTS.map(name => [name, a[name] + (b[name] - a[name]) * t])) as Season;

// Where p stands in the changes: the season it is leaving (`from`) and going
// to (`to`), how far through the change it is (`t`, straight from 0 to 1;
// `from` and `to` the same season, and `t` 0, where one holds), and whether
// the trees turn in the opposite order this time (`reverse`; see treeTurn).
export type SeasonChange = { from: Season; to: Season; t: number; reverse: boolean };
export function seasonChange(p: number): SeasonChange {
  if (p <= 0) return { from: SEASON_KEYS[0].season, to: SEASON_KEYS[0].season, t: 0, reverse: false };
  for (let i = 1; i < SEASON_KEYS.length; i++) {
    const a = SEASON_KEYS[i - 1], b = SEASON_KEYS[i];
    if (p > b.at) continue;
    if (a.season === b.season) return { from: a.season, to: a.season, t: 0, reverse: false };
    // Out of spring the trees go in reverse, so those that blossomed first
    // keep their blossom longest.
    return { from: a.season, to: b.season, t: Math.min(1, Math.max(0, (p - a.at) / (b.at - a.at))), reverse: a.season === SPRING };
  }
  const last = SEASON_KEYS[SEASON_KEYS.length - 1].season;
  return { from: last, to: last, t: 0, reverse: false };
}

// The trees don't change in step: each takes its own share of a change
// (TREE_TURN of it), starting when its `order` (0 to 1, from treeSeason)
// comes round, so across a change they turn one by one, the first before
// the grass has gone far and the last as it finishes. A tree's own turn at
// t: 0 before its start, 1 once it has turned. The leaves' shader
// (GardenSeasons.tsx) works the same sum.
export const TREE_TURN = .4;
export function treeTurn(t: number, order: number, reverse = false) {
  const o = reverse ? 1 - order : order;
  return smooth((t - o * (1 - TREE_TURN)) / TREE_TURN);
}
// The season a tree of that order shows at p.
export function treeSeasonAt(p: number, order: number): Season {
  const { from, to, t, reverse } = seasonChange(p);
  return from === to ? { ...from } : mixSeason(from, to, treeTurn(t, order, reverse));
}

// The season at progress p, for the grass, plants, flowers, light and drift:
// the whole picture's drift. The same for a moving scene and a reduced-motion
// still (which stands at its milestone's own p), so a still shows the season
// the guest would see there. Remembers the last answer, as the scene asks
// several times a frame.
let last: { p: number; season: Season } | null = null;
export function seasonAt(p: number): Season {
  if (last && last.p === p) return last.season;
  const { from, to, t } = seasonChange(p);
  const season = from === to ? { ...from } : mixSeason(from, to, gentle(t));
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

// A tree's parts (PART's bits), its shade (0 to 1: amber through orange
// and rust to red in autumn, deeper or paler pink blossom) and its order in
// each change (0 to 1, treeTurn), from where it stands and its model `type`
// (gardenTreeSpots.ts: 0 to 3 the ashes), on a layout. A featured tree turns
// so its season is whole at its moments: a bare one leafs out last, one that
// blossoms blossoms first (and, as the trees go in reverse out of spring,
// keeps it last), and one that turns in autumn turns first.
const FEATURED_PART: Record<Role, number> = { [ROLE.still]: 0, [ROLE.turns]: PART.turns, [ROLE.sparse]: PART.bare | PART.turns, [ROLE.blossom]: PART.blossom };
const FEATURED_ORDER: Record<Role, number | undefined> = { [ROLE.still]: undefined, [ROLE.turns]: 0, [ROLE.sparse]: 1, [ROLE.blossom]: 0 };
export function treeSeason(x: number, z: number, type: number, width: number, mobile: boolean): { parts: number; shade: number; order: number } {
  const shade = hash(x, z, 7.1), order = hash(x, z, 9.7);
  if (type === OLD_TREE_TYPE) return { parts: PART.old, shade, order };
  if (type > 3) return { parts: 0, shade, order };
  const pick = featuredTrees(width, mobile).get(key(x, z));
  const parts = (hash(x, z) < SHARES.turns ? PART.turns : 0)
    | (hash(x, z, 3.3) < SHARES.bare ? PART.bare : 0)
    | (hash(x, z, 5.9) < SHARES.blossom ? PART.blossom : 0);
  if (pick === undefined) return { parts, shade, order };
  return { parts: parts | FEATURED_PART[pick], shade, order: FEATURED_ORDER[pick] ?? order };
}
