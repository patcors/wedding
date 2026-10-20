import assert from 'node:assert/strict';
import test from 'node:test';
import { AUTUMN, AUTUMN_TREE_COLOURS, BLOSSOM_COLOURS, CLOVER_FLOWERS, FEATURED, FEATURE_FRAME, FLOWER_COLOURS, FLOWER_GROWTH, NEUTRAL, OLD_TREE_TYPE, PART, SEASON_KEYS, SHARES, SPRING, SUMMER, WINTER, featuredTrees, leafColour, petalColour, petalShown, seasonAt, seasonLight, seasonName, seasonsOn, treeSeason } from '../src/components/garden/seasons.ts';
import { MILESTONES, STOPS, progressAt, stillProgress } from '../src/components/garden/journey.ts';
import { treeBase, treePlacements, oldTreePlacement } from '../src/components/garden/gardenTreeSpots.ts';
import { cameraPose } from '../src/components/garden/cameraRig.ts';
import { LAYOUTS, project, timeline, viewOf } from '../src/components/garden/voyageTimeline.ts';
import { sceneryCatalog } from '../src/components/garden/sceneryCatalog.ts';

const AMOUNTS = Object.keys(NEUTRAL);
const near = (a, b, eps = 1e-9) => AMOUNTS.every(k => Math.abs(a[k] - b[k]) < eps);
const index = id => MILESTONES.findIndex(m => m.id === id);
const stop = id => STOPS[index(id) + 1];
const still = id => stillProgress(progressAt(MILESTONES[index(id)].month) + 1e-6);

// The one cycle over the story's years, and the January each change stands for.
const CYCLE = [['winter', 2017], ['spring', 2020], ['summer', 2023], ['autumn', 2026]];
const SEASONS = { winter: WINTER, spring: SPRING, summer: SUMMER, autumn: AUTUMN };
const changes = () => SEASON_KEYS.flatMap((b, i) => i && SEASON_KEYS[i - 1].season !== b.season ? [[SEASON_KEYS[i - 1], b]] : []);

test('summer is the garden as it is with the seasons off; the voyage opens in winter and ends in autumn', () => {
  assert.ok(near(SUMMER, NEUTRAL));
  assert.ok(near(seasonAt(0), WINTER) && near(seasonAt(1), AUTUMN));
});

test('one cycle over the whole journey: winter, spring, summer, autumn, three gentle changes', () => {
  let names = [seasonName(0)];
  for (let i = 0; i <= 20000; i++) {
    const name = seasonName(i / 20000);
    if (name !== names[names.length - 1]) names.push(name);
  }
  assert.deepEqual(names, CYCLE.map(([name]) => name));
  for (let i = 1; i < SEASON_KEYS.length; i++) assert.ok(SEASON_KEYS[i].at > SEASON_KEYS[i - 1].at, 'keys in order');
  const eases = changes();
  assert.equal(eases.length, 3);
  eases.forEach(([a, b], i) => {
    // Gentle: no ease shorter than 40svh or so (.017 of the page).
    assert.ok(b.at - a.at >= .017, `${a.name} to ${b.name} at ${a.at} eases slowly`);
    // Near the January it stands for.
    const january = progressAt(`${CYCLE[i + 1][1]}-01`), middle = (a.at + b.at) / 2;
    assert.ok(Math.abs(middle - january) < .015, `${a.name} to ${b.name} at ${middle.toFixed(3)}, ${CYCLE[i + 1][1]} at ${january.toFixed(3)}`);
  });
});

test('the season moves smoothly with the scroll, never snapping', () => {
  let previous = seasonAt(0);
  for (let p = 0; p <= 1; p += 1e-5) {
    const s = seasonAt(p);
    for (const k of AMOUNTS) {
      assert.ok(s[k] >= 0 && s[k] <= 1);
      assert.ok(Math.abs(s[k] - previous[k]) < .002, `${k} jumps at ${p}`);
    }
    previous = s;
  }
});

test('each milestone stands wholly in its year’s season, moving or still', () => {
  const seasonOf = id => {
    const year = Number(MILESTONES[index(id)].month.slice(0, 4));
    return SEASONS[CYCLE.filter(([, from]) => from <= year).at(-1)[0]];
  };
  for (const { id } of MILESTONES) {
    assert.ok(near(seasonAt(stop(id)), seasonOf(id)), `${id} at its stop`);
    assert.ok(near(seasonAt(still(id)), seasonOf(id)), `${id} still`);
  }
  // The story's own seasons: they met in winter, both snow trips' years as asked, engaged in autumn.
  assert.ok(near(seasonAt(stop('meet')), WINTER) && near(seasonAt(stop('snow-2019')), WINTER));
  assert.ok(near(seasonAt(stop('snow-2025')), SUMMER));
  assert.ok(near(seasonAt(stop('engaged')), AUTUMN));
  // The opening title, the bend and the dock.
  assert.ok(near(seasonAt(0), WINTER));
  for (const p of [.83, .9, .95, 1]) assert.ok(near(seasonAt(p), AUTUMN), `autumn at ${p}`);
});

test('each change eases over a quiet stretch, between milestones', () => {
  const step = .001, counts = Object.fromEntries(['desktop', 'phone'].map(name => [name, timeline(sceneryCatalog(LAYOUTS[name].width), LAYOUTS[name], step).counts]));
  // How many pieces compete for the eye over [from, to], on desktop and phone together.
  const busy = (from, to) => {
    let sum = 0, n = 0;
    for (let i = Math.round(from / step); i <= Math.round(to / step); i++, n++) sum += counts.desktop[i] + counts.phone[i];
    return sum / n;
  };
  const moments = MILESTONES.flatMap(({ id }) => [stop(id), still(id)]).sort((a, b) => a - b);
  for (const [a, b] of changes()) {
    // No milestone's stop or still falls inside an ease.
    const before = moments.filter(p => p <= a.at).at(-1), after = moments.find(p => p >= b.at);
    assert.ok(moments.every(p => p <= a.at || p >= b.at), `${a.name} to ${b.name} clear of the milestones`);
    // As quiet as any stretch as long between those milestones, or nearly.
    let quietest = Infinity;
    for (let from = before; from + b.at - a.at <= after; from += step) quietest = Math.min(quietest, busy(from, from + b.at - a.at));
    assert.ok(busy(a.at, b.at) <= quietest + .5, `${a.name} to ${b.name}: ${busy(a.at, b.at).toFixed(2)} in view, ${quietest.toFixed(2)} at the quietest`);
  }
});

test('each season has its own light: winter cooler and brighter, autumn warmer, never darker than summer', () => {
  for (const s of [NEUTRAL, SUMMER, AUTUMN, WINTER, SPRING]) {
    const light = seasonLight(s);
    for (const v of [...light.sunColor, ...light.hemiColor, light.sunIntensity, light.hemi]) assert.ok(Math.abs(v - 1) <= .1, 'a share of the light, not a new sky');
    assert.ok(light.sunIntensity >= 1 && light.hemi >= 1, 'never darker than summer');
  }
  const none = seasonLight(NEUTRAL);
  assert.deepEqual([...none.sunColor, ...none.hemiColor, none.sunIntensity, none.hemi], [1, 1, 1, 1, 1, 1, 1, 1]);
  // Winter: bluer sun and fill, so the shadows cool, and brighter, so it is crisp, not gloomy.
  const winter = seasonLight(WINTER), autumn = seasonLight(AUTUMN);
  assert.ok(winter.sunColor[2] > winter.sunColor[0] && winter.hemiColor[2] > winter.hemiColor[0]);
  assert.ok(winter.sunIntensity > 1 && winter.hemi > 1);
  assert.ok(autumn.sunColor[0] > autumn.sunColor[2] && autumn.hemiColor[0] > autumn.hemiColor[2]);
  assert.ok(WINTER.bare === 1 && WINTER.pale === 1 && WINTER.turn === 0);
});

// The trees whose crowns stand in the near picture at p, by part.
function pictured(p, layout) {
  const lens = LAYOUTS[layout], mobile = layout === 'phone', view = viewOf(cameraPose(p, lens.width));
  const parts = { all: 0, turns: 0, bare: 0, blossom: 0 };
  for (const tree of treePlacements(lens.width, mobile)) {
    if (tree.type > 3) continue;
    const crown = project({ centre: [tree.x, treeBase(tree, lens.width) + 6 * tree.scale, tree.z], radius: 3.5 * tree.scale }, view, lens);
    if (!crown.screen || crown.depth < FEATURE_FRAME.depth[0] || crown.depth > FEATURE_FRAME.depth[1]) continue;
    if (Math.abs(crown.screen[0]) > FEATURE_FRAME.across[1] || Math.abs(crown.screen[1]) > 1) continue;
    const { parts: bits } = treeSeason(tree.x, tree.z, tree.type, lens.width, mobile);
    parts.all++;
    for (const k of ['turns', 'bare', 'blossom']) if (bits & PART[k]) parts[k]++;
  }
  return parts;
}

test('a good share of the avenue takes part in each season, in view at its milestones', () => {
  for (const layout of ['desktop', 'phone']) {
    const lens = LAYOUTS[layout], mobile = layout === 'phone';
    const trees = treePlacements(lens.width, mobile), ashes = trees.filter(t => t.type <= 3);
    const share = part => ashes.filter(t => treeSeason(t.x, t.z, t.type, lens.width, mobile).parts & part).length / ashes.length;
    // Each season's share of the ashes, by the hash and the featured trees together.
    for (const [k, v] of Object.entries(SHARES)) {
      const got = share(PART[k]);
      assert.ok(got >= v - .08 && got <= v + .1, `${layout}: ${Math.round(got * 100)}% of the ashes ${k}, meant ${v * 100}%`);
    }
    // The shrubs take no part; the old tree at the dock is an evergreen, which no season touches.
    for (const t of trees.filter(t => t.type > 3)) assert.equal(treeSeason(t.x, t.z, t.type, lens.width, mobile).parts, 0);
    const old = oldTreePlacement(lens.width, mobile);
    assert.equal(old.type, OLD_TREE_TYPE);
    assert.equal(treeSeason(old.x, old.z, old.type, lens.width, mobile).parts, PART.old);
    // Every featured moment has its season's tree in the near picture: bare
    // branches in winter, blossom in spring, autumn colour.
    for (const id of ['meet', 'snow-2019']) for (const p of [stop(id), still(id)]) assert.ok(pictured(p, layout).bare >= 1, `${layout}: a bare tree at ${id} (${p})`);
    for (const p of [stop('graduation'), still('graduation'), .42, stop('interim'), still('interim')]) assert.ok(pictured(p, layout).blossom >= 1, `${layout}: blossom at ${p}`);
    for (const id of ['salsa', 'engaged', 'turkey-greece']) for (const p of [stop(id), still(id)]) assert.ok(pictured(p, layout).turns >= 1, `${layout}: a turning tree at ${id} (${p})`);
    assert.ok(featuredTrees(lens.width, mobile).size <= FEATURED.reduce((n, f) => n + f.at.length * 2, 0));
  }
});

// Saturation, 0 for grey or white, 1 for a pure colour.
const saturation = c => (Math.max(...c) - Math.min(...c)) / Math.max(...c);
test('the blossom and the flowers are real colours, never white like snow; autumn runs amber to red', () => {
  for (const c of BLOSSOM_COLOURS) {
    assert.ok(saturation(c) >= .35, `blossom ${c} is pink, not white`);
    assert.ok(c[0] > c[2] && c[2] > c[1], `blossom ${c} is a pink`);
  }
  assert.ok(FLOWER_COLOURS.filter(c => saturation(c) >= .5).length >= 3, 'most of the bank flowers are bright colours');
  for (const c of AUTUMN_TREE_COLOURS) assert.ok(c[0] > c[1] && c[1] > c[2] && saturation(c) > .6, `autumn ${c} is warm`);
  // From amber to red, the green falling away.
  assert.ok(AUTUMN_TREE_COLOURS.every((c, i) => !i || c[1] < AUTUMN_TREE_COLOURS[i - 1][1]));
  assert.ok(FLOWER_GROWTH > 0 && CLOVER_FLOWERS.share > 0 && CLOVER_FLOWERS.lift > 0);
  assert.equal(SPRING.flowers, 1);
  for (const s of [WINTER, SUMMER, AUTUMN]) assert.equal(s.flowers, 0);
});

test('falling leaves turn amber to red in autumn; petals cherry pink in spring and thin through autumn and winter', () => {
  const hex = c => '#' + c.map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
  // Without seasons, the leaves and petals keep their old colours.
  assert.deepEqual([hex(leafColour(1, NEUTRAL)), hex(leafColour(3, NEUTRAL)), hex(petalColour(NEUTRAL))], ['#92996d', '#ba9565', '#c88889']);
  // In autumn three in four leaves turn warm and the rest stay as they were;
  // there are no more of them, so nothing more moves.
  for (let i = 0; i < 12; i++) {
    const [r, g, b] = leafColour(i, AUTUMN);
    if (i % 4 !== 3) assert.ok(r > g && g > b && r - b > .4, `leaf ${i} warm in autumn`);
    else assert.deepEqual(leafColour(i, AUTUMN), leafColour(i, NEUTRAL));
  }
  for (let i = 0; i < 6; i++) assert.deepEqual(leafColour(i, WINTER), leafColour(i, NEUTRAL));
  const pink = petalColour(SPRING);
  assert.ok(pink[0] > .9 && pink[1] < .6 && saturation(pink) > .4, 'spring petals cherry pink');
  const shown = s => Array.from({ length: 100 }, (_, i) => petalShown(i, 100, s)).reduce((a, v) => a + v, 0);
  assert.equal(shown(NEUTRAL), 100);
  assert.equal(shown(SPRING), 100);
  assert.equal(shown(WINTER), 20);
  assert.equal(shown(AUTUMN), 40);
});

test('the Review choice: on unless turned off', () => {
  assert.equal(seasonsOn(null), true);
  assert.equal(seasonsOn('on'), true);
  assert.equal(seasonsOn('off'), false);
  assert.equal(seasonsOn('nonsense'), true);
});
