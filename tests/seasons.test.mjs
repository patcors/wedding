import assert from 'node:assert/strict';
import test from 'node:test';
import { AUTUMN, NEUTRAL, SEASON_KEYS, SPRING, SUMMER, WINTER, leafColour, petalColour, petalShown, seasonAt, seasonLight, seasonOfYear, seasonsOn, yearAround } from '../src/components/garden/seasons.ts';
import { DATES, MILESTONES, ROOM, STOPS, monthIndex, progressAt, stillProgress, storyMonth } from '../src/components/garden/journey.ts';

const AMOUNTS = Object.keys(NEUTRAL);
const near = (a, b, eps = 1e-9) => AMOUNTS.every(k => Math.abs(a[k] - b[k]) < eps);
const stop = id => STOPS[MILESTONES.findIndex(m => m.id === id) + 1];
const wintry = s => s.grey > .9 && s.bare > .9 && s.turn < .2 && s.lush === 0;

test('each season holds through its months, NSW style', () => {
  for (const m of [3, 3.5, 4.5]) assert.ok(near(seasonOfYear(m), AUTUMN), `autumn at ${m}`);
  for (const m of [6, 6.5, 7, 7.3]) assert.ok(near(seasonOfYear(m), WINTER), `winter at ${m}`);
  for (const m of [8.5, 9, 10]) assert.ok(near(seasonOfYear(m), SPRING), `spring at ${m}`);
  for (const m of [11.5, 0, 1, 1.5]) assert.ok(near(seasonOfYear(m), SUMMER), `summer at ${m}`);
  // It wraps every twelve months, story months included.
  for (const m of [0, 2.3, 5.1, 8, 10.7]) assert.ok(near(seasonOfYear(m), seasonOfYear(m + 12 * 7)));
  assert.ok(near(seasonOfYear(-1), seasonOfYear(11)));
});

test('the keys run round the year in order, each easing into the next', () => {
  for (let i = 0; i < SEASON_KEYS.length; i++) {
    const key = SEASON_KEYS[i], next = SEASON_KEYS[(i + 1) % SEASON_KEYS.length];
    assert.ok(key.to > key.from);
    assert.ok((next.from + (i + 1 === SEASON_KEYS.length ? 12 : 0)) - key.to >= 1, `${key.name} eases over a month or more`);
  }
  // Every amount stays within 0 and 1 and moves smoothly through the year.
  let previous = seasonOfYear(0);
  for (let m = .001; m <= 24; m += .001) {
    const s = seasonOfYear(m);
    for (const k of AMOUNTS) {
      assert.ok(s[k] >= 0 && s[k] <= 1);
      assert.ok(Math.abs(s[k] - previous[k]) < .005, `${k} jumps at month ${m}`);
    }
    previous = s;
  }
});

test('the year turns smoothly with the scroll, never flickering', () => {
  let previous = seasonAt(0), autumns = 0, wasAutumn = false;
  for (let p = 0; p <= 1; p += 2e-5) {
    const s = seasonAt(p);
    for (const k of AMOUNTS) assert.ok(Math.abs(s[k] - previous[k]) < .01, `${k} jumps at ${p}`);
    previous = s;
    // Count each autumn once: it comes and goes like the year, not in flashes.
    const isAutumn = s.turn > (wasAutumn ? .3 : .6);
    if (isAutumn && !wasAutumn) autumns++;
    wasAutumn = isAutumn;
  }
  // Eleven Aprils from 2017 to 2027; 2023's rushes past in a few svh and
  // barely shows, as its months cancel out.
  assert.ok(autumns >= 9 && autumns <= 11, `${autumns} autumns`);
});

test('the average is exact: it matches a fine sum over the scroll', () => {
  for (const p of [.12, .3, .551, .62, .8, .95]) {
    const h = .3 * ROOM, n = 4000;
    let re = 0, im = 0, total = 0;
    for (let k = -n; k <= n; k++) {
      const x = Math.min(1, Math.max(0, p + k * h / n)), w = 1 - Math.abs(k) / n, angle = storyMonth(x) * Math.PI / 6;
      re += w * Math.cos(angle); im += w * Math.sin(angle); total += w;
    }
    const { month, strength } = yearAround(p);
    assert.ok(Math.abs(strength - Math.hypot(re, im) / total) < 2e-3, `strength at ${p}`);
    if (strength > .1) {
      const want = ((Math.atan2(im, re) * 6 / Math.PI) % 12 + 12) % 12;
      assert.ok(Math.min(Math.abs(month - want), 12 - Math.abs(month - want)) < 1e-2, `month at ${p}`);
    }
  }
});

test('both snow trips stand in winter, moving or still', () => {
  for (const id of ['snow-2019', 'snow-2025']) {
    assert.ok(wintry(seasonAt(stop(id))), `${id} at its stop`);
    const month = MILESTONES.find(m => m.id === id).month;
    assert.ok(near(seasonAt(stillProgress(progressAt(month)), false), WINTER), `${id} still`);
  }
});

test('each milestone stop shows its season', () => {
  assert.ok(seasonAt(stop('internship')).blossom > .9, 'November 2018 in blossom');
  assert.ok(seasonAt(stop('sydney')).lush > .9, 'February 2021 lush');
  assert.ok(seasonAt(stop('apartments')).turn > .9, 'May 2024 amber');
  assert.ok(seasonAt(stop('engaged')).turn > .9, 'April 2026 amber');
  // The dock is April 2027, autumn at dusk, and the opening January, summer.
  assert.ok(near(seasonAt(1), AUTUMN, 1e-6) && near(seasonAt(1, false), AUTUMN));
  assert.ok(near(seasonAt(0, false), SUMMER) && seasonAt(0).lush > .95);
  assert.equal(storyMonth(1), monthIndex(DATES.wedding));
});

test('reduced-motion stills show each milestone’s own month exactly', () => {
  for (const { month } of MILESTONES) {
    const p = stillProgress(progressAt(month) + 1e-6);
    assert.ok(near(seasonAt(p, false), seasonOfYear(monthIndex(month))), month);
  }
});

test('the light only nudges the day: within a tenth either way', () => {
  for (const s of [NEUTRAL, SUMMER, AUTUMN, WINTER, SPRING]) {
    const light = seasonLight(s);
    for (const v of [...light.sunColor, light.sunIntensity, light.hemi]) assert.ok(Math.abs(v - 1) <= .1);
  }
  const none = seasonLight(NEUTRAL);
  assert.deepEqual([...none.sunColor, none.sunIntensity, none.hemi], [1, 1, 1, 1, 1]);
  // Winter's sun is cooler and weaker than summer's.
  const winter = seasonLight(WINTER), summer = seasonLight(SUMMER);
  assert.ok(winter.sunIntensity < summer.sunIntensity && winter.sunColor[2] > winter.sunColor[0]);
});

test('falling leaves turn amber in autumn; petals pale in spring and thin in winter', () => {
  const hex = c => '#' + c.map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
  // Without seasons, the leaves and petals keep their old colours.
  assert.deepEqual([hex(leafColour(1, NEUTRAL)), hex(leafColour(3, NEUTRAL)), hex(petalColour(NEUTRAL))], ['#92996d', '#ba9565', '#c88889']);
  for (let i = 0; i < 6; i++) {
    const [r, g, b] = leafColour(i, AUTUMN);
    assert.ok(r > g && g > b && r - b > .3, `leaf ${i} warm in autumn`);
  }
  const [r, g, b] = petalColour(SPRING);
  assert.ok(r > .85 && g > .65 && b > .65);
  const shown = s => Array.from({ length: 100 }, (_, i) => petalShown(i, 100, s)).reduce((a, v) => a + v, 0);
  assert.equal(shown(NEUTRAL), 100);
  assert.equal(shown(SPRING), 100);
  assert.ok(shown(WINTER) < 40);
});

test('the Review choice: on unless turned off', () => {
  assert.equal(seasonsOn(null), true);
  assert.equal(seasonsOn('on'), true);
  assert.equal(seasonsOn('off'), false);
  assert.equal(seasonsOn('nonsense'), true);
});
