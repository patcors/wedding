import assert from 'node:assert/strict';
import test from 'node:test';
import { atValue, bankAt, createNote, describe, formatNote, formatNotes, formatP, moment, namedEntry, parseAt, readNotes, refine, shownDate } from '../src/components/garden/inspect/inspect.ts';
import { MILESTONES, STOPS, progressAt } from '../src/components/garden/journey.ts';
import { bankEdge, riverCenter, voyageLandmarks } from '../src/components/garden/gardenGeometry.ts';

const link = (name, type = 'Mesh', tag) => ({ name, type, ...tag && { tag } });

test('?at= takes a progress from 0 to 1 or a milestone, and nothing else', () => {
  assert.equal(parseAt('0.3712'), .3712);
  assert.equal(parseAt('.5'), .5);
  assert.equal(parseAt('0'), 0);
  assert.equal(parseAt('1'), 1);
  assert.equal(parseAt(' 0.25 '), .25);
  MILESTONES.forEach((milestone, i) => assert.equal(parseAt(milestone.id), STOPS[i + 1], milestone.id));
  assert.equal(parseAt('sydney'), STOPS[1 + MILESTONES.findIndex(m => m.id === 'sydney')]);
  assert.equal(parseAt('opening'), 0);
  assert.equal(parseAt('dock'), 1);
  for (const bad of [null, '', '1.5', '37', '-0.2', 'abc', 'toString', '0x1', '1e-1', 'NaN']) assert.equal(parseAt(bad), null, String(bad));
});

test('a link to the moment comes back to it: a milestone by its id, anywhere else by its progress', () => {
  MILESTONES.forEach((milestone, i) => assert.equal(atValue(STOPS[i + 1]), milestone.id));
  assert.equal(atValue(.3712), '0.3712');
  // Within a pixel or so of a stop rounds to it.
  for (const p of [0, .123456, .5, .999]) assert.ok(Math.abs(parseAt(atValue(p)) - p) < 5e-4);
});

test('objects are named by the names the scene gives them, or their nearest named or tagged parent', () => {
  const bridge = describe([link('harbour-bridge'), link('sydney-harbour', 'Group'), link('', 'Group', { id: 'sydney', milestone: 'sydney' }), link('', 'Scene')]);
  assert.deepEqual({ ...bridge }, { name: 'Harbour Bridge', file: 'src/components/garden/eggs/Sydney.tsx', milestone: 'sydney', when: undefined, background: false, sided: false, path: 'harbour-bridge < sydney-harbour < sydney' });
  assert.equal(describe([link('', 'Mesh'), link('amelia-boat', 'Group'), link('voyage-boats', 'Group')]).name, 'Amelia’s boat');
  assert.equal(describe([link('', 'Mesh'), link('patrick-boat', 'Group'), link('voyage-boats', 'Group')]).name, 'Patrick’s boat');
  assert.equal(describe([link('pie-bed', 'Group')]).name, 'pie-chart flower bed');
  assert.equal(describe([link('year-2021', 'Group'), link('year-markers', 'Group')]).name, '2021 year marker');
  assert.equal(describe([link('year-2021', 'Group')]).when, 'January 2021');
  assert.equal(describe([link('ez-tree-leaves', 'InstancedMesh'), link('', 'Group'), link('ez-tree-grove', 'Group')]).name, 'tree (leaves)');
  // An egg's tag gives its milestone to what is inside it.
  const snowman = describe([link('', 'Mesh'), link('', 'Group'), link('snow-reveal', 'Group'), link('', 'Group', { id: 'snow-2025', milestone: 'snow-2025' })]);
  assert.equal(snowman.milestone, 'snow-2025');
  assert.equal(snowman.file, 'src/components/garden/eggs/SnowReveal.tsx');
  // Nothing known: the nearest name, or the type.
  assert.deepEqual([describe([link('', 'Mesh'), link('mystery', 'Group')]).name, describe([link('', 'Points')]).name], ['mystery', 'Points']);
  assert.equal(describe([link('', 'Mesh'), link('mystery', 'Group')]).file, undefined);
  assert.equal(describe([link('', 'Mesh', { id: 'sky' })]).background, true);
  assert.equal(namedEntry('toString'), undefined);
});

test('every egg and its milestone is known', () => {
  for (const milestone of MILESTONES.filter(m => m.egg)) {
    const found = describe([link('', 'Mesh'), link('', 'Group', { id: milestone.egg, milestone: milestone.id })]);
    assert.ok(found.file?.startsWith('src/components/garden/eggs/'), milestone.egg);
    assert.equal(found.milestone, milestone.id);
  }
});

test('the old tree is told from the grove by where it stands; points are on a bank or in the river', () => {
  const { tree } = voyageLandmarks(1);
  const grove = describe([link('ez-tree-branches', 'InstancedMesh'), link('ez-tree-grove', 'Group')]);
  assert.equal(refine(grove, tree, 1).name, 'the old tree (trunk and branches)');
  assert.equal(refine(grove, { x: tree.x + 5, z: tree.z }, 1).name, 'tree (trunk and branches)');
  const staff = describe([link('flag-staffs', 'InstancedMesh'), link('voyage-boats', 'Group')]);
  assert.equal(refine(staff, null, 1, -1).name, 'flag staff, Amelia’s side');
  assert.equal(refine(staff, null, 1, 1).name, 'flag staff, Patrick’s side');
  assert.equal(refine(describe([link('harbour-bridge')]), null, 1, -1).name, 'Harbour Bridge');
  const z = -60;
  assert.equal(bankAt(riverCenter(z), z, 1), 'in the river');
  assert.equal(bankAt(riverCenter(z) - bankEdge(z) - 1, z, 1), 'Amelia’s bank (left)');
  assert.equal(bankAt(riverCenter(z) + bankEdge(z) + 1, z, 1), 'Patrick’s bank (right)');
});

test('the moment and the date on screen', () => {
  assert.equal(moment({ milestone: 'sydney' }), 'sydney, 27-02-2021');
  assert.equal(moment({ when: 'October 2026' }), 'October 2026');
  assert.equal(moment({}), null);
  assert.equal(shownDate(0), 'the opening');
  assert.equal(shownDate(1), 'the dock');
  assert.equal(shownDate(progressAt('2021-02')), '27-02-2021');
  assert.deepEqual([formatP(.3712), formatP(0), formatP(1), formatP(.05)], ['.3712', '.0000', '1', '.0500']);
});

const hit = (name, p, extra = {}) => ({ described: describe([link(name)]), p, screen: { x: 212.4, y: 418, width: 390, height: 844 }, world: [-3.1, 1.2, -60.1], bank: 'Amelia’s bank (left)', ...extra });

test('notes copy as Markdown that can be pasted straight to Claude', () => {
  const p = progressAt('2021-02');
  const note = createNote(hit('harbour-bridge', p), '  make it fade in sooner \n', 'phone', 1_760_000_000_000);
  assert.equal(note.text, 'make it fade in sooner');
  assert.equal(note.date, '27-02-2021');
  assert.equal(note.object.milestone, 'sydney');
  const [first, second] = formatNote(note).split('\n');
  assert.equal(first, `- 27-02-2021 (p ${formatP(p)}, phone): **Harbour Bridge** (src/components/garden/eggs/Sydney.tsx): make it fade in sooner`);
  assert.equal(second, `  - screen 212, 418 of 390×844; world -3.10, 1.20, -60.10; Amelia’s bank (left); object harbour-bridge; ?at=${atValue(p)}`);
  const later = createNote(hit('pie-bed', .7), 'more\nflowers', 'desktop', 1);
  const earlier = createNote(hit('', .1, { described: describe([link('', 'Mesh')]) }), 'what is this', 'desktop', 2);
  const all = formatNotes([later, note, earlier]);
  assert.ok(all.startsWith('Notes on the Garden'));
  const lines = all.split('\n').filter(line => line.startsWith('- '));
  assert.deepEqual(lines.map(line => line.match(/\*\*(.+?)\*\*/)[1]), ['Mesh', 'Harbour Bridge', 'pie-chart flower bed']);
  assert.ok(lines[1].endsWith(': make it fade in sooner'));
  assert.ok(lines[2].endsWith(': more flowers'));
  assert.ok(lines[0].includes('**Mesh**: what is this'), 'no file to give');
  assert.equal(formatNotes([]), '');
});

test('stored notes come back as they were; anything malformed is dropped', () => {
  const note = createNote(hit('snow-reveal', .7), 'make it sparkle more', 'desktop', 5);
  assert.deepEqual(readNotes(JSON.stringify([note])), [note]);
  assert.deepEqual(readNotes(null), []);
  assert.deepEqual(readNotes('not json'), []);
  assert.deepEqual(readNotes('{"a":1}'), []);
  assert.deepEqual(readNotes(JSON.stringify([note, { ...note, p: 2 }, { ...note, text: 3 }, null, { ...note, viewport: 'tablet' }])), [note]);
});
