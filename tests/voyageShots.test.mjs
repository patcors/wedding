import assert from 'node:assert/strict';
import test from 'node:test';
import { MILESTONES, STOPS, dateLabel, progressAt, stillProgress } from '../src/components/garden/journey.ts';
import { paceToward } from '../src/components/garden/journeyPace.ts';
import {
  RESERVED_PORTS, THRESHOLDS, UsageError, chooseColumns, contactSheetLayout, diffStats, dilate, frameLabel, indexHtml,
  outDirName, parseShotArgs, parseViewport, pickPort, rankChanges, serverUrlFrom, stopList, summaryLines, travelTime,
} from '../scripts/voyage-shots-lib.mjs';

const journey = { stops: STOPS, milestones: MILESTONES, dateLabel, stillProgress };

test('by default the tool serves this checkout and shoots reduced-motion stills on a desktop and a phone', () => {
  const options = parseShotArgs([]);
  assert.equal(options.serve, true);
  assert.equal(options.url, null);
  assert.equal(options.live, false);
  assert.deepEqual(options.viewports.map(v => [v.name, v.width, v.height, v.mobile]), [['desktop', 1440, 900, false], ['phone', 390, 844, true]]);
  assert.equal(options.threshold, THRESHOLDS.still.threshold);
  assert.equal(options.minChanged, THRESHOLDS.still.minChanged);
});

test('options parse into what the run needs, and live runs get a looser diff', () => {
  const options = parseShotArgs(['--url', 'http://127.0.0.1:4351/', '--only', 'meet, dock', '--at', '.3,0.55', '--viewports', 'phone-landscape,1280x720,400x800-touch', '--live', '--compare-url', 'http://127.0.0.1:4342']);
  assert.equal(options.url, 'http://127.0.0.1:4351');
  assert.equal(options.serve, false);
  assert.deepEqual(options.only, ['meet', 'dock']);
  assert.deepEqual(options.at, [.3, .55]);
  assert.deepEqual(options.viewports.map(v => [v.name, v.width, v.height, v.mobile]), [['phone-landscape', 844, 390, true], ['1280x720', 1280, 720, false], ['400x800-touch', 400, 800, true]]);
  assert.equal(options.compareUrl, 'http://127.0.0.1:4342');
  assert.equal(options.threshold, THRESHOLDS.live.threshold);
  assert.ok(THRESHOLDS.live.minChanged > THRESHOLDS.still.minChanged);
  assert.equal(parseShotArgs(['--threshold', '0', '--min-changed', '0']).threshold, 0);
  assert.equal(parseShotArgs(['--help']).help, true);
});

test('bad options are refused with a reason, and never a review server\'s port', () => {
  const refused = (args, pattern) => assert.throws(() => parseShotArgs(args), error => error instanceof UsageError && pattern.test(error.message));
  refused(['--url', 'http://a', '--serve'], /either --url or --serve/);
  refused(['--url', 'localhost:4351'], /base URL/);
  refused(['--at', '1.5'], /--at wants a number from 0 to 1/);
  refused(['--viewports', 'tablet'], /Unknown viewport "tablet"/);
  refused(['--viewports', 'phone,phone'], /twice/);
  refused(['--compare', 'x', '--compare-url', 'http://a'], /either --compare or --compare-url/);
  refused(['--frobnicate'], /frobnicate/);
  for (const port of RESERVED_PORTS) refused(['--port', String(port)], /review server/);
  refused(['--url', 'http://a', '--port', '4351'], /--port is for --serve/);
  assert.throws(() => parseViewport('99x99'), UsageError);
});

test('every milestone stop is shot, with the opening and the dock, where the arrow keys land', () => {
  const stops = stopList(journey);
  assert.equal(stops.length, MILESTONES.length + 2);
  assert.deepEqual(stops.map(s => s.id), ['opening', ...MILESTONES.map(m => m.id), 'dock']);
  assert.deepEqual(stops.map(s => s.p), [...STOPS]);
  assert.equal(stops[0].file, '00-opening');
  assert.equal(stops.at(-1).file, `${String(MILESTONES.length + 1).padStart(2, '0')}-dock`);
  // Each milestone's caption is the date that shows there.
  MILESTONES.forEach((milestone, i) => assert.equal(stops[i + 1].date, dateLabel(progressAt(milestone.month))));
  assert.equal(stops[0].date, null);
  assert.equal(frameLabel(stops[1]), `${dateLabel(progressAt(MILESTONES[0].month))} · ${MILESTONES[0].id}`);
  assert.equal(frameLabel(stops[0]), '(no date) · opening');
});

test('--only picks stops, --at adds progresses in scroll order, and an unknown stop names the real ones', () => {
  const picked = stopList({ ...journey, only: ['dock', 'meet'] });
  assert.deepEqual(picked.map(s => s.id), ['meet', 'dock']);
  assert.equal(picked[0].file, '01-meet');
  const at = stopList({ ...journey, at: [.5, .2] });
  assert.deepEqual(at.map(s => s.id), ['at-0.2000', 'at-0.5000']);
  // A still shows the latest milestone's date; live, the scroll's own.
  assert.equal(at[0].date, dateLabel(stillProgress(.2)));
  assert.equal(stopList({ ...journey, at: [.2], live: true })[0].date, dateLabel(.2));
  const both = stopList({ ...journey, only: ['opening'], at: [.4] });
  assert.deepEqual(both.map(s => s.id), ['opening', 'at-0.4000']);
  assert.throws(() => stopList({ ...journey, only: ['wedding'] }), error => error instanceof UsageError && /opening, meet/.test(error.message));
});

test('the diff counts pixels past the threshold, ignoring alpha, and boxes them', () => {
  const width = 4, height = 3, channels = 4;
  const a = new Uint8Array(width * height * channels).fill(100);
  const b = a.slice();
  b[(1 * width + 2) * channels] = 140; // one pixel, red +40
  b[(2 * width + 3) * channels + 1] = 105; // a shimmer, green +5
  b[(0 * width + 0) * channels + 3] = 0; // alpha only
  const stats = diffStats(a, b, { width, height, channels, threshold: 8 });
  assert.equal(stats.changed, 1);
  assert.equal(stats.fraction, 1 / 12);
  assert.equal(stats.maxDelta, 40);
  assert.deepEqual(stats.box, { left: 2, top: 1, width: 1, height: 1 });
  assert.equal(stats.mask[1 * width + 2], 1);
  assert.equal(diffStats(a, b, { width, height, channels, threshold: 0 }).changed, 2);
  assert.equal(diffStats(a, a, { width, height, channels, threshold: 0 }).box, null);
  assert.throws(() => diffStats(a, b.subarray(4), { width, height, channels, threshold: 8 }));
});

test('a changed pixel grows into a square so it shows on the difference image', () => {
  const mask = new Uint8Array(25);
  mask[12] = 1; // the middle of 5×5
  const grown = dilate(mask, 5, 5, 1);
  assert.equal(grown.reduce((n, v) => n + v, 0), 9);
  for (const i of [6, 7, 8, 11, 12, 13, 16, 17, 18]) assert.equal(grown[i], 1);
  const corner = new Uint8Array(25); corner[0] = 1;
  assert.equal(dilate(corner, 5, 5, 2).reduce((n, v) => n + v, 0), 9);
  assert.deepEqual([...dilate(mask, 5, 5, 0)], [...mask]);
});

test('changes rank most first, and identical runs report none', () => {
  const ranked = rankChanges([
    { viewport: 'desktop', id: 'meet', fraction: .00002 },
    { viewport: 'desktop', id: 'engaged', fraction: .03 },
    { viewport: 'phone', id: 'engaged', fraction: .2 },
    { viewport: 'phone', id: 'dock', sizeDiffers: true },
    { viewport: 'phone', id: 'new-stop', missing: 'after' },
  ], .0001);
  assert.deepEqual(ranked.map(r => `${r.viewport} ${r.id} ${r.changed}`), ['phone dock true', 'phone engaged true', 'desktop engaged true', 'desktop meet false', 'phone new-stop false']);
  const lines = summaryLines(ranked);
  assert.match(lines[0], /^3 of 4 frames changed/);
  assert.match(lines[1], /phone\s+dock\s+size differs/);
  assert.match(lines[2], /phone\s+engaged\s+20% of pixels/);
  assert.match(lines.at(-1), /Not in the earlier run: phone new-stop/);
  assert.match(summaryLines(rankChanges([{ viewport: 'desktop', id: 'meet', fraction: 0 }], .0001))[0], /^No changes: 1 frames compared/);
  assert.match(summaryLines([])[0], /Nothing to compare/);
});

test('a contact sheet keeps each frame\'s shape, fits every frame and stays roughly landscape', () => {
  const desktop = contactSheetLayout({ count: 18, frameWidth: 1440, frameHeight: 900, thumbWidth: 480 });
  assert.deepEqual(desktop.thumb, { width: 480, height: 300 });
  assert.equal(desktop.cells.length, 18);
  assert.ok(desktop.columns * desktop.rows >= 18);
  const last = desktop.cells.at(-1);
  assert.ok(last.x + desktop.thumb.width <= desktop.width && last.captionY <= desktop.height);
  assert.ok(desktop.width / desktop.height > 1 && desktop.width / desktop.height < 2.4);
  // No two frames overlap.
  for (const [i, a] of desktop.cells.entries()) for (const b of desktop.cells.slice(i + 1)) {
    assert.ok(Math.abs(a.x - b.x) >= desktop.thumb.width || Math.abs(a.y - b.y) >= desktop.thumb.height);
  }
  // Tall phone frames go many to a row.
  assert.ok(chooseColumns(18, 195, 448) > chooseColumns(18, 480, 326));
  // A short sheet still has room for its header.
  assert.ok(contactSheetLayout({ count: 1, frameWidth: 390, frameHeight: 844, thumbWidth: 195 }).width >= 560);
});

test('--serve skips the review servers\' ports, and finds the URL astro prints', () => {
  assert.equal(pickPort(new Set(), 4321), 4322);
  assert.equal(pickPort(new Set([4340]), 4340), 4343);
  assert.equal(pickPort(new Set(), 4800), 4800);
  assert.equal(serverUrlFrom(' astro  v7.1.6 ready in 896 ms\n\x1b[2m┃\x1b[0m Local    \x1b[36mhttp://127.0.0.1:4802/\x1b[0m\n'), 'http://127.0.0.1:4802');
  assert.equal(serverUrlFrom('starting…'), null);
});

test('runs are filed by branch and local time', () => {
  assert.equal(outDirName('voyage-c-shots', new Date(2026, 9, 19, 21, 5, 9)), 'voyage-c-shots-20261019-210509');
  assert.equal(outDirName('feature/odd name', new Date(2026, 0, 2, 3, 4, 5)), 'feature-odd-name-20260102-030405');
});

test('live, the wait for a stop is the story\'s own travel time', () => {
  assert.equal(travelTime(.3, .3, paceToward), 0);
  const across = travelTime(0, 1, paceToward);
  assert.ok(across > 15 && across < 60, `${across}s from the opening to the dock`);
  assert.ok(travelTime(STOPS[1], STOPS[2], paceToward) < across);
});

test('the index page carries every frame and the comparison, safely escaped', () => {
  const html = indexHtml({
    title: 'Voyage shots · <test>', subtitle: 'still',
    viewports: [{ name: 'desktop', size: '1440×900', sheet: 'contact-desktop.png', frames: [{ id: 'meet', p: .06, label: 'July 2017 · meet', file: 'desktop/01-meet.png', compare: 'compare/desktop/01-meet.png', fraction: .2, changed: true }] }],
    summary: { against: 'http://127.0.0.1:4342/', lines: ['1 of 1 frames changed'], ranked: [{ viewport: 'desktop', id: 'meet', fraction: .2, changed: true }] },
  });
  assert.match(html, /Voyage shots · &lt;test&gt;/);
  assert.match(html, /desktop\/01-meet\.png/);
  assert.match(html, /Compared with http:\/\/127\.0\.0\.1:4342\//);
  assert.match(html, /<tr class="changed"><td>desktop<\/td><td>meet<\/td><td>20%/);
  assert.doesNotMatch(html.slice(html.indexOf('<script>')), /<test>/);
});
