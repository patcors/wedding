import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  ARRIVAL_END, LAUNCH, MILESTONES, OPENING_CUT, OPENING_END, ROUTE, SCROLL_SPACE, VOYAGE_END, progressAt, progressAtScroll, routeAt, scrollAtProgress,
} from '../src/components/garden/journey.ts';
import { paceToward } from '../src/components/garden/journeyPace.ts';
import { NAMES_GONE } from '../src/components/garden/openingNames.ts';

// The opening used to take 2300svh of scroll for the whole page; it is now that
// much shorter (SCROLL_SPACE less a screen), all taken from the opening.
const SPAN = SCROLL_SPACE - 100;
const svhAt = p => scrollAtProgress(p) * SPAN;
const pAt = svh => progressAtScroll(svh / SPAN);
// The boats' travel downstream per svh of scroll from `from` to `to` svh.
const travel = (from, to) => (routeAt(pAt(from)) - routeAt(pAt(to))) / (to - from);
// The voyage's steady pace as it was: z 4 to −164 from ARRIVAL_END to VOYAGE_END, over 2300svh of page.
const VOYAGE_SVH = (ROUTE.voyage - ROUTE.approach) / ((VOYAGE_END - ARRIVAL_END) * 2300);

test('the first scroll from the title moves the boats about as far as a later one', () => {
  const later = travel(svhAt(OPENING_END), svhAt(VOYAGE_END));
  assert.ok(Math.abs(later - VOYAGE_SVH) < 1e-3, `the voyage's pace changed: ${later}`);
  // Over the first 150svh, and over the first small swipe, not much below the later average.
  assert.ok(travel(0, 150) > .95 * later, `the opening moves ${travel(0, 150).toFixed(4)} a svh, the voyage ${later.toFixed(4)}`);
  assert.ok(travel(0, 30) > .85 * later, `the first 30svh move ${travel(0, 30).toFixed(4)} a svh`);
  for (let s = 20; s < svhAt(OPENING_END) - 5; s += 5) assert.ok(Math.abs(travel(s, s + 5) - later) < .02 * later, `at ${s}svh`);
  // It used to be a fifth of it: 2 units over the title's 115svh.
  assert.ok(2 / 115 < .25 * later);
  // Never faster than the voyage either, and never back upstream.
  for (let s = 0; s < 400; s += 1) assert.ok(travel(s, s + 1) <= later * 1.001 && travel(s, s + 1) >= 0, `at ${s}svh`);
});

test('the boats start at their jetties and ease away from rest', () => {
  assert.equal(routeAt(0), ROUTE.start);
  assert.ok(routeAt(LAUNCH / 4) > ROUTE.start - .05, 'they leap off the jetties');
  // Up to speed in about 10svh of scroll.
  assert.ok(svhAt(LAUNCH) > 5 && svhAt(LAUNCH) < 15, `${svhAt(LAUNCH)}`);
});

test('from the meeting on, every date and place is where it was, and takes the scroll it did', () => {
  const meetToCoast = progressAt(MILESTONES[1].month) - progressAt(MILESTONES[0].month);
  for (const { month } of MILESTONES) {
    const p = progressAt(month);
    // On the voyage's line, as before.
    assert.ok(Math.abs(routeAt(p) - (ROUTE.voyage - (p - ARRIVAL_END) / (VOYAGE_END - ARRIVAL_END) * (ROUTE.voyage - ROUTE.approach))) < 1e-9, month);
  }
  // A share of progress after the meeting is as many svh as it was, so each date holds as long.
  const share = svhAt(progressAt(MILESTONES[1].month)) - svhAt(progressAt(MILESTONES[0].month));
  assert.ok(Math.abs(share - meetToCoast * 2300) < 1e-6, `${share} svh`);
  for (const p of [OPENING_END, .3, .6, VOYAGE_END]) assert.ok(Math.abs((svhAt(p + .01) - svhAt(p)) - 23) < 1e-6, `${p}`);
  // Everything comes OPENING_CUT of the old page sooner: about 85svh.
  assert.ok(Math.abs(svhAt(.5) - (.5 * 2300 - OPENING_CUT * 2300)) < 1e-6);
  assert.ok(OPENING_CUT * 2300 > 70 && OPENING_CUT * 2300 < 100);
});

test('the title still clears over the first swipe or two, not at a flick', () => {
  // The names have gone, and the date shows, after about 70 to 80svh.
  assert.ok(svhAt(NAMES_GONE) > 60, `the names are gone after ${svhAt(NAMES_GONE)}svh`);
  assert.ok(svhAt(ARRIVAL_END) > 65 && svhAt(ARRIVAL_END) < 100, `${svhAt(ARRIVAL_END)}`);
});

test('scroll and progress map both ways, continuously, and the page is as long as the map says', () => {
  for (let i = 0; i <= 1000; i++) {
    const f = i / 1000;
    assert.ok(Math.abs(scrollAtProgress(progressAtScroll(f)) - f) < 1e-12);
    if (i) assert.ok(progressAtScroll(f) > progressAtScroll((i - 1) / 1000));
  }
  assert.equal(progressAtScroll(0), 0);
  assert.equal(progressAtScroll(1), 1);
  assert.ok(Math.abs(progressAtScroll(scrollAtProgress(OPENING_END) + 1e-9) - OPENING_END) < 1e-8);
  // Out of range is held to the ends.
  assert.equal(progressAtScroll(-1), 0);
  assert.equal(scrollAtProgress(2), 1);
  const css = readFileSync(new URL('../src/components/garden/garden.css', import.meta.url), 'utf8');
  const height = Number(css.match(/\.garden-scroll-space \{ height: ([\d.]+)svh/)[1]);
  assert.ok(Math.abs(height - SCROLL_SPACE) < 1, `garden.css has ${height}svh, the journey ${SCROLL_SPACE.toFixed(1)}`);
});

test('with the story\'s pace, a first swipe sets the boats off about as briskly as one later on', () => {
  // A swipe of `svh` from `from` svh: how far the boats have gone two seconds on.
  const swipe = (from, svh) => {
    let p = pAt(from);
    const target = pAt(from + svh), z = routeAt(p);
    for (let t = 0; t < 2; t += 1 / 60) p = paceToward(p, target, 1 / 60);
    return z - routeAt(p);
  };
  const later = svhAt(progressAt('2019-03'));
  for (const svh of [30, 60]) {
    const first = swipe(0, svh), again = swipe(later, svh);
    assert.ok(first > .8 * again, `${svh}svh from the title: ${first.toFixed(2)} units, later ${again.toFixed(2)}`);
  }
});
