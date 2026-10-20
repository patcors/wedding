import assert from 'node:assert/strict';
import test from 'node:test';
import { AUTUMN, FEATURED, FEATURE_FRAME, NEUTRAL, OLD_TREE_TYPE, ROLE, SEASON_KEYS, SPRING, SUMMER, WINTER, featuredTrees, leafColour, petalColour, petalShown, seasonAt, seasonLight, seasonName, seasonsOn, treeSeason } from '../src/components/garden/seasons.ts';
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

test('winter is soft and bright: sparse trees and paler grass, no grey, no darker light', () => {
  assert.equal(WINTER.turn, 0);
  assert.ok(WINTER.pale > 0 && WINTER.bare > 0);
  for (const s of [NEUTRAL, SUMMER, AUTUMN, WINTER, SPRING]) {
    const light = seasonLight(s);
    for (const v of [...light.sunColor, light.sunIntensity, light.hemi]) assert.ok(Math.abs(v - 1) <= .05, 'only a nudge');
    assert.ok(light.sunIntensity >= 1 && light.hemi >= 1, 'never darker than summer');
  }
  const none = seasonLight(NEUTRAL);
  assert.deepEqual([...none.sunColor, none.sunIntensity, none.hemi], [1, 1, 1, 1, 1]);
});

// The trees whose crowns stand in the near picture at p, by role.
function pictured(p, layout) {
  const lens = LAYOUTS[layout], mobile = layout === 'phone', view = viewOf(cameraPose(p, lens.width));
  const roles = [0, 0, 0, 0, 0];
  for (const tree of treePlacements(lens.width, mobile)) {
    const crown = project({ centre: [tree.x, treeBase(tree, lens.width) + 6 * tree.scale, tree.z], radius: 3.5 * tree.scale }, view, lens);
    if (!crown.screen || crown.depth < FEATURE_FRAME.depth[0] || crown.depth > FEATURE_FRAME.depth[1]) continue;
    const x = Math.abs(crown.screen[0]);
    if (x > FEATURE_FRAME.across[1] || Math.abs(crown.screen[1]) > 1) continue;
    roles[treeSeason(tree.x, tree.z, tree.type, lens.width, mobile).role]++;
  }
  return roles;
}

test('a few trees change, and the ones that do are in view at their season’s milestones', () => {
  for (const layout of ['desktop', 'phone']) {
    const lens = LAYOUTS[layout], mobile = layout === 'phone';
    const trees = treePlacements(lens.width, mobile), counts = [0, 0, 0, 0, 0];
    for (const t of trees) counts[treeSeason(t.x, t.z, t.type, lens.width, mobile).role]++;
    const ashes = trees.filter(t => t.type <= 3).length;
    // Most trees never change; blossom is on a handful only.
    assert.ok(counts[ROLE.still] / ashes > .75, `${layout}: ${counts[ROLE.still]} of ${ashes} ashes stay as they are`);
    assert.ok(counts[ROLE.blossom] >= 2 && counts[ROLE.blossom] <= 5, `${layout}: ${counts[ROLE.blossom]} blossoming trees`);
    // The shrubs never change; the old tree at the dock only takes a touch of autumn.
    for (const t of trees.filter(t => t.type > 3)) assert.equal(treeSeason(t.x, t.z, t.type, lens.width, mobile).role, ROLE.still);
    const old = oldTreePlacement(lens.width, mobile);
    assert.equal(old.type, OLD_TREE_TYPE);
    assert.equal(treeSeason(old.x, old.z, old.type, lens.width, mobile).role, ROLE.old);
    assert.equal(counts[ROLE.old], 0, 'only the old tree');
    // Every featured moment has its tree in the near picture: bare branches
    // in winter, blossom in spring (a couple, not an avenue), gold in autumn.
    for (const id of ['meet', 'snow-2019']) for (const p of [stop(id), still(id)]) assert.ok(pictured(p, layout)[ROLE.sparse] >= 1, `${layout}: a sparse tree at ${id} (${p})`);
    for (const p of [stop('graduation'), still('graduation'), .41, stop('interim'), still('interim')]) {
      const n = pictured(p, layout)[ROLE.blossom];
      assert.ok(n >= 1 && n <= 3, `${layout}: ${n} blossoming trees at ${p}`);
    }
    for (const id of ['salsa', 'engaged', 'turkey-greece']) for (const p of [stop(id), still(id)]) {
      const n = pictured(p, layout);
      assert.ok(n[ROLE.turns] + n[ROLE.sparse] >= 1, `${layout}: a turning tree at ${id} (${p})`);
    }
    assert.ok(featuredTrees(lens.width, mobile).size <= FEATURED.reduce((n, f) => n + f.at.length * 2, 0));
  }
});

test('falling leaves turn a little in autumn; petals pale in spring and thin through autumn and winter', () => {
  const hex = c => '#' + c.map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
  // Without seasons, the leaves and petals keep their old colours.
  assert.deepEqual([hex(leafColour(1, NEUTRAL)), hex(leafColour(3, NEUTRAL)), hex(petalColour(NEUTRAL))], ['#92996d', '#ba9565', '#c88889']);
  // In autumn half the leaves turn warm and the rest stay as they were.
  for (let i = 0; i < 8; i++) {
    const [r, g, b] = leafColour(i, AUTUMN);
    if (i % 2) assert.ok(r > g && g > b && r - b > .3, `leaf ${i} warm in autumn`);
    else assert.deepEqual(leafColour(i, AUTUMN), leafColour(i, NEUTRAL));
  }
  // Winter doesn't brown them.
  for (let i = 0; i < 6; i++) assert.deepEqual(leafColour(i, WINTER), leafColour(i, NEUTRAL));
  const [r, g, b] = petalColour(SPRING);
  assert.ok(r > .9 && g > .7 && b > .7);
  const shown = s => Array.from({ length: 100 }, (_, i) => petalShown(i, 100, s)).reduce((a, v) => a + v, 0);
  assert.equal(shown(NEUTRAL), 100);
  assert.equal(shown(SPRING), 100);
  assert.equal(shown(WINTER), 40);
  assert.equal(shown(AUTUMN), 60);
});

test('the Review choice: on unless turned off', () => {
  assert.equal(seasonsOn(null), true);
  assert.equal(seasonsOn('on'), true);
  assert.equal(seasonsOn('off'), false);
  assert.equal(seasonsOn('nonsense'), true);
});
