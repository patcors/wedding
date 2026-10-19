import assert from 'node:assert/strict';
import test from 'node:test';
import { ARRIVAL_END, MILESTONES, STOPS } from '../src/components/garden/journey.ts';
import { MOBILE_RIVER_WIDTH } from '../src/components/garden/gardenGeometry.ts';
import { boatScale, boatPose, mastheadAt } from '../src/components/garden/storyBoats.ts';
import { HULL } from '../src/components/garden/storyBoatGeometry.ts';
import { NAME_FLIGHT, NAMES_GONE, flightPoint, landingScale, nameBows, nameFlight, nameLandings, namesAway } from '../src/components/garden/openingNames.ts';

const steps = (to, n = 400) => Array.from({ length: n + 1 }, (_, i) => to * i / n);

test('the names sit in the title until the guest scrolls, then fly and fade, all before the voyage and its date', () => {
  assert.deepEqual(nameFlight(0), { rest: 1, patrick: { k: 0, shown: 1 }, amelia: { k: 0, shown: 1 } });
  assert.equal(namesAway(0), false);
  assert.equal(namesAway((NAME_FLIGHT.travel[0] + NAME_FLIGHT.travel[1]) / 2), true);
  // Gone before the voyage's date shows, and well before the meeting's stop.
  assert.ok(NAMES_GONE < ARRIVAL_END);
  assert.ok(NAMES_GONE < STOPS[MILESTONES.findIndex(m => m.id === 'meet') + 1] / 2);
  const done = nameFlight(NAMES_GONE);
  for (const name of ['patrick', 'amelia']) assert.deepEqual(done[name], { k: 1, shown: 0 });
  assert.equal(done.rest, 0);
});

test('each name arrives above its boat before it starts to fade, and the "&" and subtitle have gone as they cross', () => {
  const { travel, stagger, fade, rest } = NAME_FLIGHT;
  assert.ok(travel[1] + stagger < fade[0], 'arrived before fading');
  assert.ok(rest[1] < (travel[0] + travel[1]) / 2, 'the "&" gone by the middle of the flight');
  for (const name of ['patrick', 'amelia']) assert.deepEqual(nameFlight(fade[0])[name], { k: 1, shown: 1 });
});

test('the flight follows the progress alone, never going back on itself, so scrolling back brings the names home exactly', () => {
  let last = nameFlight(0);
  for (const p of steps(ARRIVAL_END)) {
    const now = nameFlight(p);
    assert.deepEqual(nameFlight(p), now);
    for (const name of ['patrick', 'amelia']) {
      assert.ok(now[name].k >= last[name].k && now[name].shown <= last[name].shown, `${name} at ${p}`);
    }
    assert.ok(now.rest <= last.rest);
    last = now;
  }
});

test('each name lands a little smaller than the title, at a legible size', () => {
  assert.equal(landingScale(127, 1440), Math.min(46, 1440 * .03) / 127);
  assert.equal(landingScale(62.4, 390), 27 / 62.4);
  assert.equal(landingScale(20, 390), 1, 'never larger than in the title');
  for (const [font, width] of [[127, 1440], [62.4, 390], [169, 1920], [54, 844]]) {
    const size = font * landingScale(font, width);
    assert.ok(size >= NAME_FLIGHT.size.min && size <= NAME_FLIGHT.size.max, `${size}px at ${width}`);
  }
});

test('the names land centred over their boats, or moved out from between them where they would meet', () => {
  const width = { amelia: 80, patrick: 84 };
  const apart = nameLandings({ amelia: { x: 400, y: 500 }, patrick: { x: 1200, y: 510 } }, width, 1440);
  assert.deepEqual(apart, { amelia: { x: 400, y: 500 }, patrick: { x: 1200, y: 510 } });
  const close = nameLandings({ amelia: { x: 150, y: 500 }, patrick: { x: 220, y: 500 } }, width, 390);
  assert.ok(close.amelia.x + width.amelia / 2 + 10 <= close.patrick.x - width.patrick / 2 + 1e-9, 'clear of each other');
  assert.ok(close.amelia.x < 150 && close.patrick.x > 220, 'each moved out');
  const edge = nameLandings({ amelia: { x: 10, y: 500 }, patrick: { x: 385, y: 500 } }, width, 390);
  assert.ok(edge.amelia.x - width.amelia / 2 >= 0 && edge.patrick.x + width.patrick / 2 <= 390, 'on the screen');
});

test('the names pass over and under each other, from the title to above the boats', () => {
  const home = { x: 900, y: 300 }, to = { x: 400, y: 550 };
  assert.deepEqual(flightPoint(home, to, 0, -50), home);
  const end = flightPoint(home, to, 1, -50);
  assert.ok(Math.abs(end.x - to.x) < 1e-9 && Math.abs(end.y - to.y) < 1e-9);
  // On one line (desktop) Amelia's goes over and Patrick's under.
  assert.deepEqual(nameBows({ amelia: { x: 900, y: 300 }, patrick: { x: 500, y: 300 } }, 50), { amelia: -50, patrick: 50 });
  // Stacked (a phone), Patrick's above: his goes over, out of her way.
  assert.deepEqual(nameBows({ amelia: { x: 195, y: 345 }, patrick: { x: 195, y: 240 } }, 20), { amelia: 20, patrick: -20 });
  // As on a 1440px screen: side by side on one line, 127px type, Patrick's
  // 300px wide and Amelia's 310px, landing at a third of the size. They lift
  // apart before they meet, so their letters (about .7 of the type high above
  // the line) never touch.
  const font = 127, scale = landingScale(font, 1440), bows = nameBows({ amelia: { x: 935, y: 300 }, patrick: { x: 510, y: 300 } }, .5 * font);
  for (const k of steps(1, 200)) {
    const a = flightPoint({ x: 935, y: 300 }, { x: 412, y: 555 }, k, bows.amelia), p = flightPoint({ x: 510, y: 300 }, { x: 1200, y: 550 }, k, bows.patrick);
    const s = 1 + (scale - 1) * k;
    if (Math.abs(a.x - p.x) < (300 + 310) / 2 * s) assert.ok(p.y - a.y > .7 * font * s, `apart at ${k}`);
  }
});

test('the names fly to each boat\'s masthead: Amelia\'s on the left, Patrick\'s on the right', () => {
  for (const width of [1, MOBILE_RIVER_WIDTH]) for (const p of steps(NAMES_GONE, 40)) {
    const pose = boatPose(p, width), [amelia, patrick] = [-1, 1].map(side => mastheadAt(p, width, side, .5));
    // Downstream is −z, so the left bank is −x.
    assert.ok(amelia.x < pose.x && patrick.x > pose.x, `either side at ${p} (width ${width})`);
    for (const [side, top] of [[-1, amelia], [1, patrick]]) {
      assert.equal(top.y, -.02 + HULL.mastTop * boatScale(width) + .5);
      // Over its own hull, its mast's length forward of the hull's middle.
      const c = Math.cos(pose.yaw), s = Math.sin(pose.yaw), hull = { x: pose.x + c * side * pose.gap * boatScale(width), z: pose.z - s * side * pose.gap * boatScale(width) };
      assert.ok(Math.abs(Math.hypot(top.x - hull.x, top.z - hull.z) - Math.abs(HULL.mast.dinghy) * boatScale(width)) < 1e-9, `${side} at ${p} (width ${width})`);
      assert.ok(top.z < hull.z, 'forward of its middle');
    }
  }
});
