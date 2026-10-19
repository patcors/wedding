import assert from 'node:assert/strict';
import test from 'node:test';
import { AUTUMN, FEATURED, FEATURE_FRAME, NEUTRAL, ROLE, SEASON_KEYS, SPRING, SUMMER, WINTER, featuredTrees, leafColour, petalColour, petalShown, seasonAt, seasonLight, seasonName, seasonsOn, treeSeason } from '../src/components/garden/seasons.ts';
import { MILESTONES, STOPS, progressAt, stillProgress } from '../src/components/garden/journey.ts';
import { treeBase, treePlacements, oldTreePlacement } from '../src/components/garden/gardenTreeSpots.ts';
import { cameraPose } from '../src/components/garden/cameraRig.ts';
import { LAYOUTS, project, viewOf } from '../src/components/garden/voyageTimeline.ts';

const AMOUNTS = Object.keys(NEUTRAL);
const near = (a, b, eps = 1e-9) => AMOUNTS.every(k => Math.abs(a[k] - b[k]) < eps);
const index = id => MILESTONES.findIndex(m => m.id === id);
const stop = id => STOPS[index(id) + 1];
const still = id => stillProgress(progressAt(MILESTONES[index(id)].month) + 1e-6);

test('summer is the garden as it is with the seasons off', () => {
  assert.ok(near(SUMMER, NEUTRAL));
  assert.ok(near(seasonAt(0), NEUTRAL) && near(seasonAt(1), NEUTRAL));
});

test('the seasons change only a handful of times, mostly holding summer', () => {
  let changes = 0, summer = 0, previous = seasonName(0);
  const n = 20000;
  for (let i = 0; i <= n; i++) {
    const p = i / n, name = seasonName(p);
    if (name !== previous) changes++;
    if (near(seasonAt(p), SUMMER)) summer++;
    previous = name;
  }
  // Summer, winter, summer, autumn, summer, winter, spring, summer.
  assert.equal(changes, 7);
  assert.ok(summer / n > .6, `summer for ${Math.round(summer / n * 100)}% of the scroll`);
  // Every change is gentle: no ease shorter than 40svh or so (.017 of the page).
  for (let i = 1; i < SEASON_KEYS.length; i++) {
    const a = SEASON_KEYS[i - 1], b = SEASON_KEYS[i];
    assert.ok(b.at > a.at, 'keys in order');
    if (a.season !== b.season) assert.ok(b.at - a.at >= .017, `${a.name} to ${b.name} at ${a.at} eases slowly`);
  }
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

test('each season stands where the story suits it, moving or still', () => {
  for (const id of ['snow-2019', 'snow-2025']) {
    assert.ok(near(seasonAt(stop(id)), WINTER), `${id} at its stop`);
    assert.ok(near(seasonAt(still(id)), WINTER), `${id} still`);
  }
  for (const id of ['salsa', 'engaged']) {
    assert.ok(near(seasonAt(stop(id)), SPRING), `${id} at its stop`);
    assert.ok(near(seasonAt(still(id)), SPRING), `${id} still`);
  }
  assert.ok(near(seasonAt(.415), AUTUMN), 'autumn in 2021');
  // The egg-heavy milestones elsewhere are summer, as the garden always was.
  for (const id of ['meet', 'coast', 'internship', 'graduation', 'sydney', 'interim', 'amelia-heirwealth', 'heirwealth', 'apartments', 'living-together', 'dating']) {
    assert.ok(near(seasonAt(stop(id)), SUMMER), `${id} at its stop`);
    assert.ok(near(seasonAt(still(id)), SUMMER), `${id} still`);
  }
  // The dock and the bend before it: summer.
  for (const p of [.83, .9, .95, 1]) assert.ok(near(seasonAt(p), SUMMER), `summer at ${p}`);
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
  const roles = [0, 0, 0, 0];
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
    const trees = treePlacements(lens.width, mobile), counts = [0, 0, 0, 0];
    for (const t of trees) counts[treeSeason(t.x, t.z, t.type, lens.width, mobile).role]++;
    const ashes = trees.filter(t => t.type <= 3).length;
    // Most trees never change; blossom is on a handful only.
    assert.ok(counts[ROLE.still] / ashes > .75, `${layout}: ${counts[ROLE.still]} of ${ashes} ashes stay as they are`);
    assert.ok(counts[ROLE.blossom] >= 1 && counts[ROLE.blossom] <= 4, `${layout}: ${counts[ROLE.blossom]} blossoming trees`);
    // The shrubs and the old tree at the dock never change.
    for (const t of trees.filter(t => t.type > 3)) assert.equal(treeSeason(t.x, t.z, t.type, lens.width, mobile).role, ROLE.still);
    const old = oldTreePlacement(lens.width, mobile);
    assert.equal(treeSeason(old.x, old.z, old.type, lens.width, mobile).role, ROLE.still);
    // Every featured moment has its tree in the near picture.
    for (const id of ['snow-2019', 'snow-2025']) for (const p of [stop(id), still(id)]) assert.ok(pictured(p, layout)[ROLE.sparse] >= 1, `${layout}: a sparse tree at ${id} (${p})`);
    for (const id of ['salsa', 'engaged']) for (const p of [stop(id), still(id)]) {
      const n = pictured(p, layout)[ROLE.blossom];
      assert.ok(n >= 1 && n <= 3, `${layout}: ${n} blossoming trees at ${id} (${p})`);
    }
    assert.ok(featuredTrees(lens.width, mobile).size <= FEATURED.reduce((n, f) => n + f.at.length * 2, 0));
  }
});

test('falling leaves turn a little in autumn; petals pale in spring and thin a little in winter', () => {
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
  assert.equal(shown(WINTER), 50);
});

test('the Review choice: on unless turned off', () => {
  assert.equal(seasonsOn(null), true);
  assert.equal(seasonsOn('on'), true);
  assert.equal(seasonsOn('off'), false);
  assert.equal(seasonsOn('nonsense'), true);
});
