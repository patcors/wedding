import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DATE_LABEL_MODES, FLIP_EVERY, MET_ON, MILESTONE_DAY, WEDDING_ON, dateLabelMode, digitDate, flipTowards, settledOn, shownDate, startFlips,
} from '../src/components/garden/dateLabelMode.ts';
import { ARRIVAL_END, MILESTONES, STOPS, VOYAGE_END, progressAt, storyMonth } from '../src/components/garden/journey.ts';

test('the date label reads month and year unless the Review panel chose otherwise', () => {
  assert.equal(dateLabelMode(null), 'full');
  for (const mode of Object.keys(DATE_LABEL_MODES)) assert.equal(dateLabelMode(mode), mode);
  for (const stored of ['', 'month', 'toString', 'constructor']) assert.equal(dateLabelMode(stored), 'full');
});

test('each mode shows the month and year, the year alone, or nothing', () => {
  assert.deepEqual(shownDate('July 2017', 'full'), { month: 'July', year: '2017' });
  assert.deepEqual(shownDate('July 2017', 'year'), { month: '', year: '2017' });
  assert.deepEqual(shownDate('July 2017', 'off'), { month: '', year: '' });
  assert.deepEqual(shownDate('July 2017', 'digits'), { month: '', year: '' });
  assert.deepEqual(shownDate('', 'full'), { month: '', year: '' });
});

const dmy = iso => iso.split('-').reverse().join('-');
const day = digits => {
  const [d, m, y] = digits.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 864e5;
};

test('digits count up to the day they met and hold on a fixed day at each milestone, through to the wedding', () => {
  assert.deepEqual([MET_ON, WEDDING_ON, MILESTONE_DAY], ['2017-07-25', '2027-04-16', 1]);
  assert.equal(digitDate(storyMonth(0)), '01-01-2017');
  assert.equal(digitDate(storyMonth(ARRIVAL_END)), '01-01-2017');
  assert.equal(settledOn('2017-07'), MET_ON);
  assert.equal(settledOn('2018-11'), '2018-11-01');
  MILESTONES.forEach(({ month }, i) => {
    // From the moment its date shows, through its stop, to the end of its hold.
    for (const p of [progressAt(month), STOPS[i + 1], progressAt(month) + 2 * (STOPS[i + 1] - progressAt(month)) - 1e-6])
      assert.equal(digitDate(storyMonth(p)), dmy(settledOn(month)), `${month} at ${p.toFixed(4)}`);
  });
  assert.equal(digitDate(storyMonth(STOPS[1])), '25-07-2017');
  assert.equal(digitDate(storyMonth(VOYAGE_END)), '16-04-2027');
  assert.equal(digitDate(storyMonth(1)), '16-04-2027');
});

test('the digits\' days never run backwards and tick over a few at a time as the guest scrolls', () => {
  let previous = day(digitDate(storyMonth(ARRIVAL_END)));
  const n = 200000;
  for (let i = 1; i <= n; i++) {
    const shown = digitDate(storyMonth(ARRIVAL_END + (VOYAGE_END - ARRIVAL_END) * i / n));
    assert.match(shown, /^\d{2}-\d{2}-\d{4}$/);
    const today = day(shown);
    assert.ok(today >= previous && today - previous <= 3, `${shown} after ${previous}`);
    previous = today;
  }
});

test('each digit flips on its own, no faster than its pace, never reads as a day or month that can\'t be, and settles once the scroll stops', () => {
  assert.ok(FLIP_EVERY[1] < FLIP_EVERY[4] && FLIP_EVERY[4] < FLIP_EVERY[9]);
  // A very fast scroll: ten years in ten seconds at 60 frames a second.
  let flips = startFlips(digitDate(0)), now = 0;
  const flipped = FLIP_EVERY.map(() => -Infinity);
  for (let frame = 0; frame <= 600; frame++, now += 1000 / 60) {
    const next = flipTowards(flips, digitDate(frame * 123 / 600), now);
    [...next.shown].forEach((c, i) => {
      if (c === flips.shown[i]) return;
      assert.ok(now - flipped[i] >= FLIP_EVERY[i], `digit ${i} flipped again after ${now - flipped[i]}ms`);
      flipped[i] = now;
    });
    const [d, m] = next.shown.split('-').map(Number);
    assert.ok(d >= 1 && d <= 31 && m >= 1 && m <= 12, next.shown);
    flips = next;
  }
  const settled = now;
  for (; flips.shown !== '16-04-2027' && now < settled + 1000; now += 1000 / 60) flips = flipTowards(flips, '16-04-2027', now);
  assert.equal(flips.shown, '16-04-2027');
  assert.ok(now - settled <= Math.max(...FLIP_EVERY) + 17);
  assert.equal(flipTowards(flips, '16-04-2027', now + 1000), flips);
});
