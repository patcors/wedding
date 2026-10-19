import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { cameraPose } from '../src/components/garden/cameraRig.ts';
import { ARRIVAL_END, DATES, MILESTONES, ROOM, STOPS, VOYAGE_END, progressAt } from '../src/components/garden/journey.ts';
import { PROPOSAL } from '../src/components/garden/eggs/proposal.ts';
import { YEAR_MARKERS, yearTurns } from '../src/components/garden/eggs/yearMarkerSpots.ts';
import { COMPONENT, bankOf, sceneryCatalog } from '../src/components/garden/sceneryCatalog.ts';
import { CROWDED, FOG, IN_PICTURE, LAYOUTS, axis, busiest, clarity, crowdedMoments, crowding, dateAt, project, samples, spans, timeline, trackOf, viewOf, windowLabel } from '../src/components/garden/voyageTimeline.ts';

const source = file => readFileSync(new URL(`../src/components/garden/${file}`, import.meta.url), 'utf8');
const catalogues = Object.fromEntries(Object.entries(LAYOUTS).map(([name, lens]) => [name, sceneryCatalog(lens.width)]));
const seenAt = (piece, lens, p) => trackOf(piece, lens, [p]).seen[0] >= IN_PICTURE.shown;

test('the numbers copied from components match their source', () => {
  for (const file of ['eggs/SnowTrip.tsx', 'eggs/SecondSnowTrip.tsx']) assert.match(source(file), new RegExp(`scale=\\{${COMPONENT.snowScale}\\}`));
  const reveal = source('eggs/SnowReveal.tsx'), { across, up, along } = COMPONENT.flurryBox;
  assert.match(reveal, new RegExp(`const BOX = \\{ across: ${across}, up: ${up}, along: ${along} \\}`));
  assert.match(reveal, new RegExp(`size \\* \\(mobile \\? ${String(COMPONENT.snowMobile).replace(/^0/, '')} : 1\\)`));
  const circus = source('eggs/Circus.tsx').replace(/0\./g, '.');
  assert.match(circus, new RegExp(`SILK_CLEAR = ${String(COMPONENT.silkClear).replace(/^0/, '')}, LYRA_CLEAR = ${COMPONENT.lyraClear}`));
  assert.match(circus, new RegExp(`BIRD_TIP = ${COMPONENT.birdTip}, BIRD_OPEN = ${String(COMPONENT.birdOpen).replace(/^0/, '')}`));
  const sky = source('GardenSky.tsx');
  assert.match(sky, new RegExp(`const FOG = \\{ clear: \\{ desktop: ${FOG.clear.desktop}, mobile: ${FOG.clear.mobile} \\}, mist: \\{ desktop: ${FOG.mist.desktop}, mobile: ${FOG.mist.mobile} \\}, far: \\{ desktop: ${FOG.far.desktop}, mobile: ${FOG.far.mobile} \\} \\}`));
});

test('every egg and piece of scenery the scene mounts is in the catalogue', () => {
  const index = source('eggs/index.tsx');
  const mounted = [...index.matchAll(/^import (\w+) from '\.\/(\w+)';$/gm)].map(([, name]) => name);
  // Wrappers that mount pieces of their own.
  const parts = { University: ['PiSculpture', 'Ducks'], TurkeyGreece: ['Balloon', 'HagiaSophia'], SnowTrip: ['SnowTrip', 'SnowReveal'], SecondSnowTrip: ['SecondSnowTrip'] };
  for (const pieces of Object.values(catalogues)) {
    const files = new Set(pieces.map(piece => piece.file));
    for (const name of mounted) for (const part of parts[name] ?? [name]) assert.ok(files.has(`eggs/${part}.tsx`), `${part} charted`);
    assert.equal(new Set(pieces.map(piece => piece.id)).size, pieces.length, 'ids are unique');
  }
});

test('a sphere is in the picture straight ahead, not behind the camera, past the far plane or off the side', () => {
  const lens = LAYOUTS.desktop, view = viewOf({ position: [0, 0, 0], target: [0, 0, -1] });
  const at = (x, y, z, radius = .5) => project({ centre: [x, y, z], radius }, view, lens);
  assert.ok(at(0, 0, -10).inside);
  assert.deepEqual(at(0, 0, -10).screen.map(v => Math.round(v * 1e6) / 1e6), [0, 0]);
  assert.equal(at(0, 0, 10).inside, false);
  assert.equal(at(0, 0, -lens.far - 1).inside, false);
  // The frame's right edge 10 ahead, then half a radius past it, and more.
  const edge = 10 * Math.tan(lens.fov / 2 * Math.PI / 180) * lens.aspect;
  assert.ok(Math.abs(at(edge, 0, -10).screen[0] - 1) < 1e-9);
  assert.ok(at(edge, 0, -10).inside);
  assert.equal(at(edge + 2, 0, -10).inside, false);
  // Too small to see at that distance.
  assert.equal(at(0, 0, -100, .001).inside, false);
});

test('the fog clears near the camera and hides everything at its far end', () => {
  for (const lens of Object.values(LAYOUTS)) for (const p of [0, .3, .95]) {
    assert.equal(clarity(1, p, lens), 1);
    assert.equal(clarity(lens.fog.far, p, lens), 0);
    assert.ok(clarity(30, p, lens) >= clarity(60, p, lens));
  }
});

test('spans find each stretch at or over the threshold', () => {
  const ps = [0, .1, .2, .3, .4, .5];
  assert.deepEqual(spans([0, 1, 1, 0, .6, .6], ps), [[.1, .2], [.4, .5]]);
  assert.deepEqual(spans([.4, .4, 0, 0, 0, 0], ps), []);
  assert.deepEqual(spans([.4, .4, 0, 0, 0, 0], ps, 1e-6), [[0, .1]]);
});

test('crowding counts the competing pieces in view and finds the moments with more than two', () => {
  const ps = samples(.1), piece = (id, counts = true) => ({ id, name: id, group: 'g', file: 'f', bank: 'river', counts, shown: () => 1, spheres: () => [] });
  const on = (...is) => ({ seen: ps.map((_, i) => is.includes(i) ? 1 : 0), drawn: ps.map(() => 1) });
  const pieces = [piece('a'), piece('b'), piece('c'), piece('d', false), piece('e', p => p > .45)];
  const tracks = [on(1, 2, 3, 4), on(2, 3, 4, 5), on(3, 4, 5, 6), on(0, 1, 2, 3, 4, 5, 6, 7), on(3, 4, 5, 6, 7)];
  const counts = crowding(pieces, tracks, ps);
  assert.deepEqual(counts, [0, 1, 2, 3, 3, 3, 2, 1, 0, 0, 0]);
  const moments = crowdedMoments(pieces, tracks, ps, counts, .15);
  assert.equal(moments.length, 1);
  assert.equal(moments[0].peak, 3);
  assert.ok(Math.abs(moments[0].from - .3) < 1e-9 && Math.abs(moments[0].to - .5) < 1e-9);
  assert.deepEqual(moments[0].pieces.map(p => p.id), ['a', 'b', 'c', 'e']);
  const top = busiest(pieces, tracks, ps, 0);
  assert.ok(top.every(m => m.count > CROWDED));
  assert.deepEqual(top.map(m => m.pieces.map(p => p.id).join()), ['a,b,c', 'b,c,e']);
  // Shorter than the least, a moment isn't one.
  assert.deepEqual(busiest(pieces, tracks, ps, .05).map(m => m.count), [3]);
});

test('dates read as the label does, the opening and the dock outside the voyage', () => {
  assert.equal(dateAt(0), 'the opening');
  assert.equal(dateAt(VOYAGE_END + .01), 'the dock');
  assert.equal(dateAt(progressAt(DATES.meet) + 1e-6), 'Jul 2017');
  assert.equal(dateAt(progressAt('2024-08') + 1e-6), 'Aug 2024');
  assert.equal(windowLabel(progressAt('2017-07') + 1e-6, progressAt('2018-03') + 1e-6), `Jul 2017 – Mar 2018 (p ${(progressAt('2017-07') + 1e-6).toFixed(3).slice(1)}–${(progressAt('2018-03') + 1e-6).toFixed(3).slice(1)})`);
  assert.match(windowLabel(.5, .5), /^\w{3} \d{4} \(p \.500–\.500\)$/);
});

test('the axis has the chapters, every January, each milestone and its stop, and the sky', () => {
  const { chapters, years, milestones, keys, sky } = axis();
  assert.deepEqual(chapters.map(c => [c.name, c.from, c.to]), [['arrival', 0, ARRIVAL_END], ['voyage', ARRIVAL_END, VOYAGE_END], ['dock', VOYAGE_END, 1]]);
  assert.deepEqual(years.map(y => y.year), Array.from({ length: 11 }, (_, i) => 2017 + i));
  for (let i = 1; i < years.length; i++) assert.ok(years[i].p > years[i - 1].p);
  assert.equal(milestones.length, MILESTONES.length);
  milestones.forEach((m, i) => { assert.equal(m.stop, STOPS[i + 1]); assert.ok(m.stop > m.p); });
  assert.deepEqual(keys.map(k => k.name).filter((n, i, a) => a.indexOf(n) === i), ['dawn', 'morning', 'midday', 'afternoon', 'late', 'golden', 'dusk']);
  assert.ok(sky.every(s => /^#[0-9a-f]{6}$/.test(s.zenith) && /^#[0-9a-f]{6}$/.test(s.horizon)));
});

test('banks follow the river: its middle is the river, either side past the banks is a bank', () => {
  assert.equal(bankOf(0 + Math.sin(.7) * 1.15 + Math.sin(-1.2) * .25, 0, 1), 'river');
  assert.equal(bankOf(-40, -50, 1), 'left');
  assert.equal(bankOf(40, -50, 1), 'right');
});

test('it agrees with the scene\'s own tests: each year marker in the picture as its year turns, on both layouts', () => {
  for (const [name, pieces] of Object.entries(catalogues)) {
    for (const marker of YEAR_MARKERS) {
      const piece = pieces.find(p => p.id === `year-${marker.year}`);
      assert.ok(seenAt(piece, LAYOUTS[name], yearTurns(marker.year) + 1e-4), `${marker.year} on ${name}`);
    }
  }
});

test('it agrees with the scene\'s own tests: the truck in the picture from the engagement\'s date to the proposal\'s end', () => {
  for (const [name, pieces] of Object.entries(catalogues)) {
    const truck = pieces.find(p => p.id === 'truck'), from = progressAt(DATES.engaged);
    for (let p = from; p <= from + (PROPOSAL.rise.cue + .1) * ROOM; p += .002) assert.ok(seenAt(truck, LAYOUTS[name], p), `truck at ${p} on ${name}`);
  }
});

test('every piece is in the picture at some point, and the boats\' pieces whenever they are shown', () => {
  for (const [name, pieces] of Object.entries(catalogues)) {
    const result = timeline(pieces, LAYOUTS[name], .001);
    assert.equal(result.counts.length, 1001);
    for (const piece of result.pieces) {
      assert.ok(piece.seen.length > 0, `${piece.name} never in the picture on ${name}`);
      for (const [a, b] of [...piece.seen, ...piece.drawn]) assert.ok(a >= 0 && b <= 1 && a <= b);
      if (piece.group === 'On the boats') assert.deepEqual(piece.seen, piece.drawn, `${piece.name} on ${name}`);
    }
    assert.ok(result.crowded.every(m => m.peak > CROWDED && m.pieces.length >= m.peak));
  }
});

test('the camera the timeline uses is the scene\'s', () => {
  const pieces = catalogues.desktop, pi = pieces.find(p => p.id === 'pi'), p = STOPS[1];
  assert.ok(seenAt(pi, LAYOUTS.desktop, p));
  // Straight behind the camera at that moment, it would not be.
  const [x, , z] = cameraPose(p, 1).position;
  const behind = { ...pi, spheres: () => [{ centre: [x, 1, z + 5], radius: 1 }] };
  assert.equal(seenAt(behind, LAYOUTS.desktop, p), false);
});
