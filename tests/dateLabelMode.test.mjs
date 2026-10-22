import assert from 'node:assert/strict';
import test from 'node:test';
import {
  COUNT_PACE, DATE_LABEL_MODES, FLIP_EVERY, MET_ON, countTowards, digitLook, goesBack, startCount, MILESTONE_DAY, MILESTONE_DAYS, WEDDING_ON, dateLabelMode, digitDate, flipTowards, settledOn, shownDate, startFlips,
} from '../src/components/garden/dateLabelMode.ts';
import { ARRIVAL_END, MILESTONES, STOPS, VOYAGE_END, progressAt, storyMonth } from '../src/components/garden/journey.ts';

test('the date label rolls day by day unless the Review panel chose otherwise', () => {
  assert.equal(dateLabelMode(null), 'count');
  for (const mode of Object.keys(DATE_LABEL_MODES)) assert.equal(dateLabelMode(mode), mode);
  for (const stored of ['', 'month', 'toString', 'constructor']) assert.equal(dateLabelMode(stored), 'count');
});

test('the four digit looks are flipping (as guests see it), no animation, rolling and rolling every day; the others are words', () => {
  assert.deepEqual(['digits', 'blink', 'roll', 'count', 'full', 'year', 'off'].map(digitLook), ['flip', 'blink', 'roll', 'count', null, null, null]);
  for (const mode of ['blink', 'roll', 'count']) assert.deepEqual(shownDate('July 2017', mode), { month: '', year: '' });
});

test('a rolling date rolls back only when the date goes back, however its digits change', () => {
  assert.equal(goesBack('25-07-2017', '26-07-2017'), false);
  assert.equal(goesBack('31-12-2019', '01-01-2020'), false);
  assert.equal(goesBack('01-01-2020', '31-12-2019'), true);
  assert.equal(goesBack('09-08-2024', '30-07-2024'), true);
  assert.equal(goesBack('16-04-2027', '16-04-2027'), false);
});

// Every frame at 60 fps from `from` towards `to`, until it gets there: the dates shown and when.
const countRun = (from, to, frames = 60 * 60) => {
  let count = startCount(from), now = 0;
  const shown = [{ date: from, now }];
  for (let f = 0; f < frames && count.shown !== to; f++) {
    now += 1000 / 60;
    const next = countTowards(count, to, now);
    if (next !== count) shown.push({ date: next.shown, now });
    count = next;
  }
  return shown;
};

test('rolling every day steps a real day at a time, skipping none within its two weeks, across months and years, either way', () => {
  for (const [from, to] of [['25-07-2017', '08-08-2017'], ['28-12-2019', '03-01-2020'], ['16-04-2027', '02-04-2027'], ['02-01-2020', '30-12-2019'], ['27-02-2020', '02-03-2020']]) {
    const run = countRun(from, to);
    assert.equal(run.at(-1).date, to, `${from} to ${to}`);
    for (let i = 1; i < run.length; i++) {
      assert.equal(Math.abs(day(run[i].date) - day(run[i - 1].date)), 1, `${run[i - 1].date} to ${run[i].date}`);
      // Every one a real date, as it reads.
      assert.equal(new Date(day(run[i].date) * 864e5).toISOString().slice(0, 10), run[i].date.split('-').reverse().join('-'));
    }
  }
});

test('rolling every day goes faster the further it has to go, a frame a day at most, and eases as it arrives', () => {
  const far = countRun('25-07-2017', '08-08-2017'), near = countRun('25-07-2017', '27-07-2017');
  const gaps = run => run.slice(1).map((s, i) => s.now - run[i].now);
  assert.ok(Math.min(...gaps(far)) >= 1000 / 60 - 1e-6, 'never two days in a frame');
  assert.ok(gaps(far)[0] < 17, 'a frame a day while furthest behind');
  assert.ok(gaps(near).at(-1) >= COUNT_PACE.within / 2 - 20, 'slower over the last days');
});

test('rolling every day is never more than two weeks behind: further, it skips to that far short and counts the rest, settling within a second', () => {
  assert.equal(COUNT_PACE.behind, 14);
  for (const [from, to] of [['01-01-2017', '16-04-2027'], ['16-04-2027', '01-01-2017'], ['25-07-2017', '18-11-2017']]) {
    const run = countRun(from, to);
    assert.equal(Math.abs(day(run[1].date) - day(to)), COUNT_PACE.behind - 1, `${from} to ${to}: first step`);
    for (let i = 2; i < run.length; i++) assert.equal(Math.abs(day(run[i].date) - day(run[i - 1].date)), 1);
    assert.equal(run.at(-1).date, to);
    assert.ok(run.at(-1).now < 1000, `there in ${(run.at(-1).now / 1000).toFixed(1)}s`);
  }
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

test('digits count up to the day they met and hold on each milestone\'s own day, through to the wedding', () => {
  assert.deepEqual([MET_ON, WEDDING_ON, MILESTONE_DAY], ['2017-07-25', '2027-04-16', 1]);
  assert.equal(digitDate(storyMonth(0)), '01-01-2017');
  assert.equal(digitDate(storyMonth(ARRIVAL_END)), '01-01-2017');
  assert.equal(settledOn('2017-07'), MET_ON);
  assert.equal(settledOn('2018-11'), '2018-11-18');
  assert.equal(settledOn('2021-02'), '2021-02-27');
  assert.equal(settledOn('2026-07'), '2026-07-07');
  assert.equal(settledOn('2026-04'), '2026-04-16');
  // A milestone whose day isn't known holds on the 1st.
  assert.equal(settledOn('2020-08'), '2020-08-01');
  // Each known day is a real day in a milestone's month (or the wedding's), in order.
  const months = [...MILESTONES.map(m => m.month), WEDDING_ON.slice(0, 7)];
  for (const iso of MILESTONE_DAYS) {
    assert.ok(months.includes(iso.slice(0, 7)), `${iso} is a milestone's month`);
    assert.equal(new Date(`${iso}T00:00Z`).toISOString().slice(0, 10), iso);
  }
  assert.deepEqual([...MILESTONE_DAYS].sort(), MILESTONE_DAYS);
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
