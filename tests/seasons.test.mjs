import assert from 'node:assert/strict';
import test from 'node:test';
import { AUTUMN, AUTUMN_TREE_COLOURS, BLOSSOM_COLOURS, CLOVER_FLOWERS, DOCK_SURROUND, FEATURED, FEATURE_FRAME, ROLE, FLOWER_COLOURS, FLOWER_GROWTH, NEUTRAL, OLD_TREE_TYPE, PART, SEASON_KEYS, SHARES, SPRING, SUMMER, TREE_TURN, WINTER, dockSurround, featuredTrees, leafColour, petalColour, petalShown, seasonAt, seasonChange, seasonLight, seasonName, seasonsOn, treeSeason, treeSeasonAt, treeTurn } from '../src/components/garden/seasons.ts';
import { MILESTONES, STOPS, progressAt, stillProgress } from '../src/components/garden/journey.ts';
import { treeBase, treePlacements, oldTreePlacement } from '../src/components/garden/gardenTreeSpots.ts';
import { cameraPose } from '../src/components/garden/cameraRig.ts';
import { LAYOUTS, project, viewOf } from '../src/components/garden/voyageTimeline.ts';

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

test('one cycle over the whole journey: winter, spring, summer, autumn, three slow drifts', () => {
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
    // A long drift over many stops (Amelia, October 2026: not a cut), five or
    // six times as long as the old 40svh.
    assert.ok(b.at - a.at >= .1, `${a.name} to ${b.name} from ${a.at} drifts slowly`);
    const stops = STOPS.filter(p => p > a.at && p < b.at).length;
    assert.ok(stops >= 2, `${a.name} to ${b.name} across ${stops} stops`);
    // Round the January it stands for.
    const january = progressAt(`${CYCLE[i + 1][1]}-01`), middle = (a.at + b.at) / 2;
    assert.ok(a.at < january && january < b.at, `${a.name} to ${b.name} across ${CYCLE[i + 1][1]}'s January`);
    assert.ok(Math.abs(middle - january) < .035, `${a.name} to ${b.name} at ${middle.toFixed(3)}, ${CYCLE[i + 1][1]} at ${january.toFixed(3)}`);
  });
  // Each season keeps a stretch of its own between the drifts.
  for (let i = 1; i < eases.length; i++) assert.ok(eases[i][0].at - eases[i - 1][1].at >= .05, `pure ${eases[i][0].name}`);
});

test('the season moves smoothly and slowly with the scroll, never snapping', () => {
  let previous = seasonAt(0);
  for (let p = 0; p <= 1; p += 1e-5) {
    const s = seasonAt(p);
    for (const k of AMOUNTS) {
      assert.ok(s[k] >= 0 && s[k] <= 1);
      assert.ok(Math.abs(s[k] - previous[k]) < .002, `${k} jumps at ${p}`);
    }
    previous = s;
  }
  // Calm: the whole picture moves no more than about a seventh of the way
  // from one season to the next over a hundredth of the scroll (about 2 or 3
  // seconds of reading).
  for (let p = 0; p <= .99; p += .001) {
    const a = seasonAt(p), b = seasonAt(p + .01);
    for (const k of AMOUNTS) assert.ok(Math.abs(b[k] - a[k]) <= .15, `${k} from ${p.toFixed(3)}: ${Math.abs(b[k] - a[k]).toFixed(3)}`);
  }
});

test('each milestone leans to its year’s season, and stands wholly in it outside the drifts', () => {
  const seasonOf = id => {
    const year = Number(MILESTONES[index(id)].month.slice(0, 4));
    return CYCLE.filter(([, from]) => from <= year).at(-1)[0];
  };
  const drifting = p => changes().some(([a, b]) => p > a.at && p < b.at);
  for (const { id } of MILESTONES) for (const [p, what] of [[stop(id), 'at its stop'], [still(id), 'still']]) {
    assert.equal(seasonName(p), seasonOf(id), `${id} ${what} (${p.toFixed(4)})`);
    if (!drifting(p)) assert.ok(near(seasonAt(p), SEASONS[seasonOf(id)]), `${id} ${what} wholly ${seasonOf(id)}`);
  }
  // The story's own seasons. They met in winter, wholly.
  for (const id of ['meet', 'coast', 'internship']) assert.ok(near(seasonAt(stop(id)), WINTER) && near(seasonAt(still(id)), WINTER), id);
  // The 2019 snow trip still wintry: frosted, many trees bare.
  for (const p of [stop('snow-2019'), still('snow-2019')]) assert.ok(seasonAt(p).bare >= .6 && seasonAt(p).pale >= .6, `snow-2019 wintry at ${p}`);
  // Spring clear at graduation, whole at the Opera House and late in 2021.
  for (const p of [stop('graduation'), still('graduation')]) assert.ok(seasonAt(p).blossom >= .5 && seasonAt(p).flowers >= .5, `graduation in spring at ${p}`);
  for (const p of [stop('sydney'), still('sydney'), .42]) assert.ok(near(seasonAt(p), SPRING), `spring at ${p}`);
  for (const p of [stop('interim'), still('interim')]) assert.ok(seasonAt(p).blossom >= .7, `interim mostly spring at ${p}`);
  // Summer, the garden as it was, wholly through the apartments and dating.
  for (const id of ['apartments', 'living-together', 'dating']) assert.ok(near(seasonAt(stop(id)), SUMMER) && near(seasonAt(still(id)), SUMMER), id);
  assert.equal(seasonName(stop('snow-2025')), 'summer');
  // Autumn full by the engagement, and on through the bend to the dock.
  assert.ok(near(seasonAt(still('engaged')), AUTUMN) && near(seasonAt(stop('engaged')), AUTUMN));
  assert.ok(near(seasonAt(0), WINTER));
  for (const p of [.83, .9, .95, 1]) assert.ok(near(seasonAt(p), AUTUMN), `autumn at ${p}`);
});

test('through a drift the trees turn one by one, not in step', () => {
  const orders = Array.from({ length: 200 }, (_, i) => (i + .5) / 200);
  for (const [a, b] of changes()) {
    // At each end every tree stands in its season.
    for (const o of orders) {
      assert.ok(near(treeSeasonAt(a.at, o), a.season) && near(treeSeasonAt(b.at, o), b.season));
      assert.ok(near(treeSeasonAt((a.at + b.at) / 2, o), treeSeasonAt((a.at + b.at) / 2 + 1e-12, o), 1e-6));
    }
    // A third of the way through, some trees have turned, some not begun, the rest partway.
    for (const t of [1 / 3, 1 / 2, 2 / 3]) {
      const { reverse } = seasonChange(a.at + (b.at - a.at) * t);
      const turns = orders.map(o => treeTurn(t, o, reverse));
      const done = turns.filter(v => v === 1).length, waiting = turns.filter(v => v === 0).length;
      assert.ok(done > 0 || waiting > 0, `${a.name} to ${b.name} at ${t}: not in step`);
      assert.ok(turns.filter(v => v > 0 && v < 1).length > 40, `${a.name} to ${b.name} at ${t}: many partway`);
    }
    // Each tree turns over its own share of the drift, never at once.
    const own = (b.at - a.at) * TREE_TURN;
    assert.ok(own >= .04, `${a.name} to ${b.name}: each tree over ${own.toFixed(3)} of the scroll`);
  }
  // The first tree begins as the drift does, the last finishes with it.
  assert.ok(treeTurn(.01, 0) > 0 && treeTurn(.99, 1) < 1 && treeTurn(1, 1) === 1);
  assert.equal(treeTurn(.5, 0, true), treeTurn(.5, 1));
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
    // Away from the old tree's green setting at the dock (see below).
    const setting = dockSurround(lens.width, mobile), free = ashes.filter(t => !setting.has(`${t.x.toFixed(2)},${t.z.toFixed(2)}`));
    const share = part => free.filter(t => treeSeason(t.x, t.z, t.type, lens.width, mobile).parts & part).length / free.length;
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
    // And it shows its season whole there, even inside a drift: the bare
    // ones leaf out last, the ones that blossom do so first and keep it last,
    // the ones that turn in autumn turn first.
    const whole = { [ROLE.sparse]: s => s.bare === 1, [ROLE.blossom]: s => s.blossom === 1, [ROLE.turns]: s => s.turn === 1 };
    for (const [spot, role] of featuredTrees(lens.width, mobile)) {
      const [x, z] = spot.split(',').map(Number), tree = ashes.find(t => t.x.toFixed(2) === x.toFixed(2) && t.z.toFixed(2) === z.toFixed(2));
      const { order } = treeSeason(tree.x, tree.z, tree.type, lens.width, mobile);
      const moments = FEATURED.find(f => f.role === role).at.flatMap(at => typeof at === 'number' ? [at] : [stop(at), still(at)]);
      for (const p of moments) assert.ok(whole[role](treeSeasonAt(p, order)), `${layout}: featured ${role} tree whole at ${p}`);
    }
  }
});

test('the old tree at the dock stands in a green setting, with autumn still in the dock\'s picture', () => {
  for (const layout of ['desktop', 'phone']) {
    const lens = LAYOUTS[layout], mobile = layout === 'phone';
    const ashes = treePlacements(lens.width, mobile).filter(t => t.type <= 3), at = t => `${t.x.toFixed(2)},${t.z.toFixed(2)}`;
    const setting = dockSurround(lens.width, mobile), old = oldTreePlacement(lens.width, mobile);
    // A few of the ashes, no more than one in six, all beyond the dock's camera.
    assert.ok(setting.size >= 5 && setting.size <= ashes.length / 6, `${layout}: ${setting.size} ashes in the setting`);
    const eye = cameraPose(DOCK_SURROUND.at[0], lens.width).position;
    for (const t of ashes.filter(t => setting.has(at(t)))) {
      assert.ok(t.z < eye[2], `${layout}: ${at(t)} beyond the camera`);
      const { parts } = treeSeason(t.x, t.z, t.type, lens.width, mobile);
      assert.ok(parts & PART.green && !(parts & PART.turns), `${layout}: ${at(t)} stays green in autumn`);
    }
    // Seen from the dock, the ashes showing through the old tree's canopy stay
    // green: on desktop, those above the title, behind the festoons; on a
    // phone, those round the old tree's crown.
    const view = viewOf(cameraPose(1, lens.width));
    const crown = project({ centre: [old.x, treeBase(old, lens.width) + 9.5 * old.scale, old.z], radius: 0 }, view, lens).screen;
    const behind = ashes.filter(t => {
      const c = project({ centre: [t.x, treeBase(t, lens.width) + 8.5 * t.scale, t.z], radius: 0 }, view, lens).screen;
      if (!c) return false;
      return mobile ? Math.hypot(c[0] - crown[0], c[1] - crown[1]) < .35 : Math.abs(c[0]) < .3 && c[1] > .45 && c[1] < 1;
    });
    assert.ok(behind.length > 0 && behind.every(t => setting.has(at(t))), `${layout}: ${behind.length} ashes right behind the crown, all green`);
    // Autumn is never featured there, and still turns elsewhere in the dock's picture.
    for (const [spot, role] of featuredTrees(lens.width, mobile)) if (role === ROLE.turns) assert.ok(!setting.has(spot));
    for (const p of DOCK_SURROUND.at) {
      const v = viewOf(cameraPose(p, lens.width));
      const turning = ashes.filter(t => {
        if (!(treeSeason(t.x, t.z, t.type, lens.width, mobile).parts & PART.turns)) return false;
        const c = project({ centre: [t.x, treeBase(t, lens.width) + 8.5 * t.scale, t.z], radius: 5 * t.scale }, v, lens);
        return c.inside && c.screen && Math.abs(c.screen[0]) < 1 && Math.abs(c.screen[1]) < 1;
      });
      assert.ok(turning.length >= (mobile ? 2 : 8), `${layout}: ${turning.length} turned ashes in the picture at ${p}`);
    }
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
