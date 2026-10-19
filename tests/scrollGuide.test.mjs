import assert from 'node:assert/strict';
import test from 'node:test';
import { GUIDE, guideStep, shownSoFar } from '../src/components/garden/scrollGuide.ts';

const fresh = { shown: 0, showing: false, at: 0 };
const scene = (over = {}) => ({ open: true, atDock: false, moving: false, active: 0, now: 0, ...over });

// Steps the helper through a visit: `events` are [time, change] pairs, and
// between them it moves on as the page's timer would, when it says to.
function visit(events, until = 30000) {
  let guide = fresh, state = scene(), now = 0;
  const log = [];
  const step = () => {
    const { guide: next, wait } = guideStep(guide, { ...state, now });
    if (next.showing !== guide.showing) log.push([now, next.showing]);
    guide = next;
    return wait;
  };
  const queue = [...events];
  while (now <= until) {
    const wait = step();
    const nextEvent = queue[0]?.[0] ?? Infinity, nextTimer = wait === null ? Infinity : now + wait;
    if (nextEvent === Infinity && nextTimer === Infinity) break;
    if (nextEvent <= nextTimer) {
      const [at, change] = queue.shift();
      now = at;
      state = { ...state, ...change };
      // The page notes the time whenever the guest acts or the story starts or stops.
      if (change.poke || 'moving' in change || 'open' in change) state.active = now;
    } else now = nextTimer;
  }
  return { guide, log };
}

test('it first shows a moment after the opening settles, and stays until the guest moves', () => {
  const { log, guide } = visit([[0, { open: true }]]);
  assert.deepEqual(log, [[GUIDE.first, true]]);
  assert.deepEqual(guide, { shown: 1, showing: true, at: GUIDE.first });
});

test('it goes as soon as they scroll, glide or press a key, and comes back after a second or so still', () => {
  const { log } = visit([
    [0, { open: true }],
    [2000, { moving: true }], [2600, { moving: false }],
    // A key that moves nothing (say Tab) still sends it away.
    [6000, { poke: true }],
  ]);
  assert.deepEqual(log, [[GUIDE.first, true], [2000, false], [2600 + GUIDE.idle, true], [6000, false], [6000 + GUIDE.idle, true]]);
  assert.ok(GUIDE.idle >= 800 && GUIDE.idle <= 1600, 'about a second');
});

test('it shows three times in all, the first counting, then stays off for the visit', () => {
  assert.equal(GUIDE.shows, 3);
  const events = [[0, { open: true }]];
  for (let k = 0; k < 6; k++) events.push([3000 + k * 4000, { moving: true }], [3500 + k * 4000, { moving: false }]);
  const { log, guide } = visit(events);
  assert.equal(log.filter(([, showing]) => showing).length, 3);
  assert.equal(guide.shown, 3);
  assert.equal(guide.showing, false);
});

test('it never shows while the story moves or glides, at the dock, or when it is closed off', () => {
  // Gliding all the way to the dock: nothing, then nothing at the dock either.
  let { log } = visit([[0, { open: true, moving: true }], [40000, { moving: false, atDock: true }]], 60000);
  assert.deepEqual(log, []);
  // Closed (the scene failed, scene-only, the Review panel, a hidden page): nothing, and it goes if it was up.
  ({ log } = visit([[0, { open: false }]]));
  assert.deepEqual(log, []);
  ({ log } = visit([[0, { open: true }], [3000, { open: false }]], 10000));
  assert.deepEqual(log, [[GUIDE.first, true], [3000, false]]);
  // Reaching the dock takes it away.
  const showing = { shown: 1, showing: true, at: 0 };
  assert.equal(guideStep(showing, scene({ atDock: true, now: 100 })).guide.showing, false);
  assert.equal(guideStep(showing, scene({ moving: true, now: 100 })).guide.showing, false);
  assert.equal(guideStep(showing, scene({ now: 5000 })).guide.showing, true);
});

test('a reload carries on the count from sessionStorage', () => {
  assert.equal(shownSoFar(null), 0);
  assert.equal(shownSoFar('2'), 2);
  assert.equal(shownSoFar('9'), GUIDE.shows);
  assert.equal(shownSoFar('nonsense'), 0);
  assert.equal(shownSoFar('-1'), 0);
  // Two shown before the reload: one more, and only after the guest has been still.
  const after = { shown: 2, showing: false, at: 0 };
  assert.deepEqual(guideStep(after, scene({ now: 100 })), { guide: after, wait: GUIDE.idle - 100 });
  const spent = { shown: GUIDE.shows, showing: false, at: 0 };
  assert.deepEqual(guideStep(spent, scene({ now: 99999 })), { guide: spent, wait: null });
});
