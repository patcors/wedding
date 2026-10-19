import assert from 'node:assert/strict';
import test from 'node:test';
import { HARBOUR_LIGHT, PLACES, PLACE_IDS, PLACE_RIDGES, PLACE_RING, PLACE_TIMES, placeHaze, placeLight, placeShown, placeWindow, placesOn } from '../src/components/garden/places.ts';
import { KIND_ROWS, crestAt, placeGeometry } from '../src/components/garden/placesGeometry.ts';
import { MILESTONES, STOPS, VOYAGE_END, progressAt, scrolledSince, stillProgress } from '../src/components/garden/journey.ts';
import { GARDEN_CAMERA } from '../src/components/garden/gardenGeometry.ts';
import { hagiaShown } from '../src/components/garden/eggs/balloonCourse.ts';
import { namedEntry, taggedEntry } from '../src/components/garden/inspect/inspect.ts';
import { sceneryCatalog } from '../src/components/garden/sceneryCatalog.ts';

const stop = id => STOPS[MILESTONES.findIndex(m => m.id === id) + 1];
const shownAll = p => Object.fromEntries(PLACE_IDS.map(id => [id, placeShown(id, p)]));

test('the Review panel can turn the places off, and they are on by default', () => {
  assert.equal(PLACES, true);
  assert.equal(placesOn(null), true);
  assert.equal(placesOn('on'), true);
  assert.equal(placesOn('off'), false);
  assert.equal(placesOn('rubbish'), PLACES);
});

test('each reduced-motion still shows its place, settled, and no other', () => {
  const expect = {
    illawarra: ['meet', 'coast', 'internship', 'snow-2019', 'graduation'],
    sydney: ['sydney', 'interim', 'amelia-heirwealth'],
    none: ['heirwealth', 'apartments', 'living-together', 'dating', 'snow-2025', 'salsa', 'engaged', 'turkey-greece'],
  };
  assert.deepEqual(new Set(Object.values(expect).flat()), new Set(MILESTONES.map(m => m.id)), 'every milestone is checked');
  const check = (p, place, what) => {
    const shown = shownAll(stillProgress(p));
    for (const id of PLACE_IDS) assert.equal(shown[id], id === place ? 1 : 0, `${what}: ${id}`);
  };
  check(0, 'illawarra', 'the opening');
  check(1, 'berry', 'the dock');
  for (const [place, ids] of Object.entries(expect)) for (const id of ids) {
    check(stop(id), place, id);
    check(progressAt(MILESTONES.find(m => m.id === id).month), place, `${id}'s date`);
  }
});

test('one place at a time, easing smoothly in and out', () => {
  let last = shownAll(0);
  for (let p = 0; p <= 1; p += .0002) {
    const shown = shownAll(p);
    assert.ok(PLACE_IDS.filter(id => shown[id] > 0).length <= 1, `two places at p ${p.toFixed(4)}`);
    for (const id of PLACE_IDS) {
      assert.ok(shown[id] >= 0 && shown[id] <= 1);
      assert.ok(Math.abs(shown[id] - last[id]) < .03, `${id} jumps at p ${p.toFixed(4)}`);
    }
    last = shown;
  }
  for (const id of PLACE_IDS) {
    const { arrive, leave } = placeWindow(id);
    if (arrive) {
      assert.equal(placeShown(id, arrive[0]), 0);
      assert.equal(placeShown(id, arrive[1]), 1);
      for (let p = arrive[0]; p < arrive[1]; p += .0005) assert.ok(placeShown(id, p + .0005) >= placeShown(id, p), `${id} only rises as it arrives`);
    }
    if (leave) {
      assert.equal(placeShown(id, leave[0]), 1);
      assert.equal(placeShown(id, leave[1]), 0);
    }
  }
});

test('each place keeps to its years', () => {
  const { illawarra, sydney, berry } = Object.fromEntries(PLACE_IDS.map(id => [id, placeWindow(id)]));
  // The escarpment through university: gone before 2021 turns, after graduation's stop.
  assert.equal(illawarra.arrive, null);
  assert.ok(illawarra.leave[0] > stop('graduation') && illawarra.leave[1] < progressAt('2021-01'));
  // Sydney from February 2021, fully in by its date, gone as the boats come back alongside in March 2023.
  assert.ok(sydney.arrive[0] > illawarra.leave[1] && sydney.arrive[1] <= stop('sydney'));
  assert.ok(sydney.leave[0] > stop('amelia-heirwealth') && sydney.leave[1] <= progressAt('2023-03'));
  // Nothing from 2023 to 2025: no place of their own.
  for (let p = progressAt('2023-03'); p < progressAt('2026-07'); p += .001) assert.deepEqual(Object.values(shownAll(p)), [0, 0, 0]);
  // Berry only once the Hagia Sophia has sunk into the haze, fully in before 2027 turns, and to the dock.
  for (let p = 0; p <= 1; p += .0005) if (placeShown('berry', p) > 0) assert.equal(hagiaShown(scrolledSince('2026-07', p)), 0, `the Hagia Sophia is still up at p ${p.toFixed(4)}`);
  assert.ok(berry.arrive[1] < progressAt('2027-01') && berry.arrive[1] < VOYAGE_END);
  assert.equal(berry.leave, null);
  assert.equal(PLACE_TIMES.berry.leave, null);
});

test('Sydney brings a warmer harbour light, and only Sydney, only while on', () => {
  const neutral = { sun: [1, 1, 1], glint: 1 };
  assert.deepEqual(placeLight(stop('meet'), true), neutral);
  assert.deepEqual(placeLight(1, true), neutral);
  assert.deepEqual(placeLight(stop('interim'), false), neutral);
  const harbour = placeLight(stop('interim'), true);
  assert.deepEqual(harbour.sun, [...HARBOUR_LIGHT.sun]);
  assert.equal(harbour.glint, HARBOUR_LIGHT.glint);
  assert.ok(harbour.sun[0] > 1 && harbour.sun[2] < 1, 'warmer');
  for (const v of harbour.sun) assert.ok(Math.abs(v - 1) <= .08, 'a small share of the light');
});

test('the haze lifts them out of the fog as they come and thickens with the day', () => {
  assert.equal(placeHaze(0, 0), 1);
  assert.equal(placeHaze(.6, 0), 1);
  assert.equal(placeHaze(0, 1), 0);
  assert.ok(placeHaze(.6, 1) > placeHaze(.2, 1));
  for (let s = 0; s < 1; s += .1) assert.ok(placeHaze(.3, s + .1) < placeHaze(.3, s));
});

test('the ridges are cheap, far off, low on the horizon and end below it', () => {
  let total = 0;
  for (const mobile of [false, true]) {
    const ring = mobile ? PLACE_RING.mobile : PLACE_RING.desktop, far = mobile ? GARDEN_CAMERA.mobileFar : GARDEN_CAMERA.far;
    for (const id of PLACE_IDS) {
      const geometry = placeGeometry(id, mobile), position = geometry.attributes.position, normal = geometry.attributes.normal, haze = geometry.attributes.haze;
      const triangles = position.count / 3;
      if (!mobile) total += triangles;
      assert.ok(triangles < 1200, `${id}: ${triangles} triangles`);
      assert.equal(geometry.attributes.color.count, position.count);
      let facing = 0, top = 0;
      for (let i = 0; i < position.count; i++) {
        const x = position.getX(i), y = position.getY(i), z = position.getZ(i), flat = Math.hypot(x, z);
        assert.ok(flat > ring.radius * .8 && Math.hypot(x, y, z) < far, `${id} within the far plane`);
        assert.ok(Math.abs(Math.atan2(x, -z)) * 180 / Math.PI < 105, `${id} is ahead, down the river`);
        top = Math.max(top, Math.atan2(y, flat) * 180 / Math.PI);
        assert.ok(haze.getX(i) >= 0 && haze.getX(i) <= 1);
        if (normal.getX(i) * -x + normal.getY(i) * -y + normal.getZ(i) * -z > 0) facing++;
      }
      assert.ok(top < 4, `${id} keeps under 4° (${top.toFixed(2)}°)`);
      assert.ok(facing / position.count > .97, `${id} faces the camera`);
      geometry.dispose();
    }
  }
  assert.ok(total < 3500, `${total} triangles in all`);
  for (const id of PLACE_IDS) for (const ridge of PLACE_RIDGES[id]) {
    // Each end dips below the horizon, or lies so far round (95° or more,
    // 52° on a phone) that no turn of the camera brings it into the picture.
    for (const [bearing, crest] of [ridge.crest[0], ridge.crest.at(-1)]) assert.ok(crest < 0 || Math.abs(bearing) >= 95, `${id}'s ridges end below the horizon or out of sight`);
    assert.ok(ridge.haze >= .25 && ridge.haze < 1 && ridge.distance <= 1, `${id} is softened by haze`);
    assert.ok(KIND_ROWS[ridge.kind]);
    assert.ok(Math.abs(crestAt(ridge, ridge.crest[1][0]) - ridge.crest[1][1]) < 1e-9);
  }
  // Further ridges are hazier, so they read as further.
  for (const id of PLACE_IDS) {
    const ridges = [...PLACE_RIDGES[id]].filter(r => r.kind !== 'bush').sort((a, b) => a.distance - b.distance);
    for (let i = 1; i < ridges.length; i++) assert.ok(ridges[i].haze >= ridges[i - 1].haze, `${id}: further is hazier`);
  }
});

test('Inspect names the places and the timeline charts them as landforms, not counted', () => {
  for (const id of PLACE_IDS) {
    const entry = namedEntry(`place-${id}`);
    assert.ok(entry && entry.name.includes('far off'), id);
    assert.ok(entry.file.endsWith('places.ts'));
  }
  assert.ok(taggedEntry('places'));
  for (const width of [1, .45]) {
    const pieces = sceneryCatalog(width).filter(piece => piece.id.startsWith('place-'));
    assert.deepEqual(pieces.map(piece => piece.id), PLACE_IDS.map(id => `place-${id}`));
    for (const piece of pieces) {
      assert.equal(piece.counts, false);
      assert.equal(piece.fog, false);
      assert.equal(piece.group, 'World');
    }
  }
});
