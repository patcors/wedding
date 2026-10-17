import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ARRIVAL_END, CHAPTERS, DATES, DOCKED, EVEN_YEARS, MILESTONES, ROOM, ROUTE, VOYAGE_END, YEAR, chapterAt, dateLabel, monthIndex,
  progressAt, routeAt, routeAtMonth, scrolledSince, since, stillProgress, storyMonth,
} from '../src/components/garden/journey.ts';
import { VOYAGE, bankEdge, channelOffset, groundHeight, islandHalfWidth, riverCenter, voyageLandmarks, MOBILE_RIVER_WIDTH } from '../src/components/garden/gardenGeometry.ts';

const steps = (n = 2000) => Array.from({ length: n + 1 }, (_, i) => i / n);

test('the sixteen milestones run in order, each with a description', () => {
  assert.equal(MILESTONES.length, 16);
  for (let i = 1; i < MILESTONES.length; i++) assert.ok(monthIndex(MILESTONES[i].month) > monthIndex(MILESTONES[i - 1].month));
  for (const m of MILESTONES) assert.match(m.month, /^\d{4}-\d{2}$/), assert.ok(m.description.length > 10);
  assert.deepEqual(MILESTONES.filter(m => m.egg).map(m => [m.month, m.egg]), [['2017-07', 'university'], ['2019-07', 'snow-2019'], ['2020-08', 'graduation'], ['2024-05', 'apartments'], ['2025-08', 'snow-2025'], ['2026-07', 'balloon']]);
  for (const date of Object.values(DATES).slice(0, -1)) assert.ok(MILESTONES.some(m => m.month === date), date);
});

test('the chapters cover the scroll in order', () => {
  assert.deepEqual(CHAPTERS, { arrival: [0, ARRIVAL_END], voyage: [ARRIVAL_END, VOYAGE_END], dock: [VOYAGE_END, 1] });
  assert.equal(chapterAt(0), 'arrival');
  assert.equal(chapterAt((ARRIVAL_END + VOYAGE_END) / 2), 'voyage');
  assert.equal(chapterAt(1), 'dock');
  assert.ok(VOYAGE_END < DOCKED && DOCKED < 1);
});

test('story time never runs backwards and reaches each milestone in turn', () => {
  let previous = -Infinity;
  for (const p of steps()) {
    const m = storyMonth(p);
    assert.ok(m >= previous - 1e-9, `story time fell at ${p}`);
    previous = m;
  }
  assert.equal(storyMonth(0), monthIndex('2017-01'));
  assert.equal(storyMonth(1), monthIndex(DATES.wedding));
  for (const m of MILESTONES) {
    const p = progressAt(m.month);
    assert.ok(p > ARRIVAL_END && p < VOYAGE_END);
    assert.ok(Math.abs(storyMonth(p) - monthIndex(m.month)) < 1e-9);
    // First reached here: a moment earlier is still before it.
    assert.ok(storyMonth(p - 1e-4) < monthIndex(m.month));
  }
});

test('progressAt inverts storyMonth', () => {
  for (const p of steps(400)) {
    if (chapterAt(p) !== 'voyage') continue;
    const m = storyMonth(p);
    assert.ok(Math.abs(storyMonth(progressAt(m)) - m) < 1e-9);
    assert.ok(progressAt(m) <= p + 1e-9);
  }
  assert.equal(progressAt('2010-01'), ARRIVAL_END);
  assert.equal(progressAt('2030-01'), VOYAGE_END);
});

test('every year from 2018 to 2026 gets the same scroll, however its milestones fall', () => {
  const january = year => progressAt(`${year}-01`);
  for (let year = EVEN_YEARS[0]; year < EVEN_YEARS[1]; year++) assert.ok(Math.abs(january(year + 1) - january(year) - YEAR * ROOM) < 1e-9, `${year}`);
  // About a screen and a half a year, and the whole voyage about as long as before.
  assert.ok(YEAR > 1.3 && YEAR < 1.7);
  assert.ok(ROOM > .039 && ROOM < .043);
  // The run-in, from the opening through the meeting to 2018, and the run from
  // 2026 round the bend, keep lengths of their own.
  assert.ok(january(2018) - ARRIVAL_END > 2 * YEAR * ROOM);
  assert.ok(VOYAGE_END - january(2026) > 3 * YEAR * ROOM);
});

test('inside a year, clustered milestones still get time for their dates to be read', () => {
  const share = i => (progressAt(MILESTONES[i + 1].month) - progressAt(MILESTONES[i].month)) / ROOM;
  const at = id => MILESTONES.findIndex(m => m.id === id);
  // Each date holds for at least a third of a share, so even 2024's May, June
  // and August each show for a while.
  for (let i = 0; i < MILESTONES.length - 1; i++) assert.ok(share(i) > .35, MILESTONES[i].id);
  for (const m of MILESTONES) assert.equal(dateLabel(progressAt(m.month) + .34 * ROOM), dateLabel(progressAt(m.month)), m.id);
  // Amelia's months between jobs, and her months at HeirWealth before
  // Patrick, each get about a share, though the months round them rush.
  assert.ok(share(at('interim')) > 1 && share(at('amelia-heirwealth')) > 1);
  // The meeting gets more than an ordinary milestone's hold, and so does the
  // dating, whose date holds while the crossbeams go across.
  assert.ok(share(at('meet')) > 1.2 && share(at('dating')) > 1.1);
  assert.equal(dateLabel(progressAt(DATES.dating) + .4 * ROOM), 'August 2024');
  // 2024's three dates each show for a while, though the year is no longer
  // than any other, and July, when Patrick's bird flies home, for a moment.
  const shows = month => (progressAt(monthIndex(month) + 1) - progressAt(month)) / ROOM;
  for (const month of ['2024-05', '2024-06', '2024-08']) assert.ok(shows(month) > .42, `${month} shows for ${shows(month)}`);
  assert.ok(shows('2024-07') > .15);
  // The last stretch, round the bend, gets the most.
  assert.ok(MILESTONES.slice(0, -1).every((_, i) => (VOYAGE_END - progressAt(MILESTONES.at(-1).month)) / ROOM > share(i)));
});

test('the date label shows during the voyage, holding on each milestone', () => {
  assert.equal(dateLabel(0), null);
  assert.equal(dateLabel(.99), null);
  assert.equal(dateLabel(progressAt('2017-07')), 'July 2017');
  assert.equal(dateLabel(progressAt('2024-06') + ROOM * .2), 'June 2024');
  assert.equal(dateLabel(VOYAGE_END - 1e-4), 'April 2027');
  for (const p of steps(300)) if (chapterAt(p) === 'voyage') assert.match(dateLabel(p), /^[A-Z][a-z]+ 20\d\d$/);
});

test('since counts story months and scrolledSince keeps going through holds', () => {
  const p = progressAt('2026-07');
  assert.equal(since('2026-07', p), 0);
  assert.ok(since('2026-07', p - .01) < 0);
  assert.equal(since('2017-07', p), monthIndex('2026-07') - monthIndex('2017-07'));
  assert.equal(scrolledSince('2026-07', p), 0);
  assert.ok(Math.abs(scrolledSince('2026-07', p + ROOM * .2) - .2) < 1e-9);
  assert.equal(since('2026-07', p + ROOM * .2), 0, 'the date is still holding');
});

test('the route runs steadily downstream from the opening to the dock', () => {
  assert.equal(routeAt(0), ROUTE.start);
  assert.equal(routeAt(DOCKED), ROUTE.dock);
  assert.equal(routeAt(1), ROUTE.dock);
  let previous = Infinity;
  for (const p of steps()) {
    const z = routeAt(p);
    assert.ok(z <= previous, 'the boats never go upstream');
    previous = z;
  }
  // Steady pace through the voyage: equal scroll, equal distance.
  const a = routeAt(.3) - routeAt(.4), b = routeAt(.6) - routeAt(.7);
  assert.ok(Math.abs(a - b) < 1e-9);
  assert.equal(routeAtMonth(DATES.meet), routeAt(progressAt(DATES.meet)));
});

test('reduced motion stills sit on the opening, each milestone reached, or the dock', () => {
  assert.equal(stillProgress(0), 0);
  assert.equal(stillProgress(ARRIVAL_END + 1e-4), ARRIVAL_END);
  assert.equal(stillProgress(VOYAGE_END), 1);
  const stills = new Set(steps().map(stillProgress));
  assert.equal(stills.size, MILESTONES.length + 3);
  for (const m of MILESTONES) {
    const at = progressAt(m.month);
    assert.equal(stillProgress(at), at);
    assert.equal(stillProgress(at + ROOM * .3), at);
  }
});

test('the scenery sits in story order along the river', () => {
  const { island, meet, sydney, bend, dock, tree } = VOYAGE;
  assert.ok(island.from > ROUTE.start && island.to > meet, 'the boats start in the channels, which rejoin before they meet');
  assert.ok(meet > sydney.from && sydney.from > sydney.to);
  assert.ok(routeAtMonth('2026-07') > bend.from, 'the balloon comes before the bend');
  assert.ok(bend.to > dock.z && dock.z > tree.z);
  assert.ok(bend.to >= routeAt(VOYAGE_END), 'the bend is rounded by the end of the voyage');
});

test('the channels, mooring and tree fit the river on both compositions', () => {
  for (const width of [1, MOBILE_RIVER_WIDTH]) {
    for (let z = VOYAGE.island.from; z >= VOYAGE.island.to; z -= .25) {
      const island = islandHalfWidth(z, width), edge = bankEdge(z, width), channel = channelOffset(z, width);
      assert.ok(island < edge - .6, `the island leaves room for a boat at ${z}`);
      assert.ok(channel - island > .3 && edge - channel > .3, 'a boat in the channel clears both shores');
    }
    const { jetty, mooring, tree } = voyageLandmarks(width);
    assert.ok(Math.abs(mooring.x - riverCenter(mooring.z, width)) < bankEdge(mooring.z, width) - .4, 'the catamaran moors in open water');
    assert.ok(Math.sign(mooring.x - jetty.x) === -jetty.side);
    assert.ok(groundHeight(tree.x, tree.z, width) > .2, 'the old tree stands on dry land');
  }
});
