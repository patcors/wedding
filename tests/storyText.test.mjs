import assert from 'node:assert/strict';
import test from 'node:test';
import { STORY, WEDDING_WORDS, storyDay, writtenDate } from '../src/components/garden/storyText.ts';
import { MILESTONE_DAYS, WEDDING_ON } from '../src/components/garden/dateLabelMode.ts';
import { DATES, MILESTONES, STOPS, milestoneAt, monthIndex } from '../src/components/garden/journey.ts';

test('dates are written out in full, or as a month where the day isn\'t known', () => {
  assert.equal(writtenDate('2021-02-27'), '27 February 2021');
  assert.equal(writtenDate('2017-07-25'), '25 July 2017');
  assert.equal(writtenDate('2023-01-01'), '1 January 2023');
  assert.equal(writtenDate('2027-04-16'), '16 April 2027');
  assert.equal(writtenDate('2017-11'), 'November 2017');
  assert.equal(writtenDate('2020-08'), 'August 2020');
  assert.equal(writtenDate('2018-12-09'), '9 December 2018');
});

test('a milestone gives its day where Amelia has given one, and only its month otherwise', () => {
  assert.equal(storyDay('2017-07'), '2017-07-25');
  assert.equal(storyDay('2021-02'), '2021-02-27');
  // The running digits hold these on the 1st, but that isn't their day.
  assert.equal(storyDay('2017-11'), '2017-11');
  assert.equal(storyDay('2020-08'), '2020-08');
  for (const day of MILESTONE_DAYS) assert.equal(storyDay(day.slice(0, 7)), day);
});

test('every milestone has an entry, in order, with its own words, then the wedding', () => {
  assert.equal(STORY.length, MILESTONES.length + 1);
  MILESTONES.forEach((milestone, i) => {
    const entry = STORY[i];
    assert.equal(entry.id, milestone.id);
    assert.equal(entry.words, milestone.description);
    assert.ok(entry.datetime.startsWith(milestone.month), `${entry.id} is dated in its month`);
    assert.equal(entry.date, writtenDate(storyDay(milestone.month)));
  });
  const wedding = STORY.at(-1);
  assert.deepEqual([wedding.id, wedding.datetime, wedding.date, wedding.words], ['wedding', WEDDING_ON, '16 April 2027', WEDDING_WORDS]);
  assert.ok(WEDDING_ON.startsWith(DATES.wedding));
  assert.equal(new Set(STORY.map(entry => entry.id)).size, STORY.length);
});

test('the dates run in order and each is a valid <time> date', () => {
  const months = STORY.map(entry => monthIndex(entry.datetime.slice(0, 7)));
  for (let i = 1; i < STORY.length; i++) {
    assert.ok(months[i] > months[i - 1], `${STORY[i].id} after ${STORY[i - 1].id}`);
    assert.ok(STORY[i].datetime > STORY[i - 1].datetime);
  }
  for (const { datetime } of STORY) {
    assert.match(datetime, /^\d{4}-\d{2}(-\d{2})?$/);
    const full = datetime.length === 7 ? `${datetime}-01` : datetime;
    assert.equal(new Date(`${full}T00:00Z`).toISOString().slice(0, 10), full);
  }
});

test('the words read as visible text: whole sentences, nothing left blank', () => {
  for (const { id, words, date } of STORY) {
    assert.match(words, /^[A-Z].*\.$/, `${id} is a sentence`);
    assert.ok(date.length > 0);
  }
});

test('"See it" takes the scene to each milestone\'s stop, and the wedding to the celebration', () => {
  MILESTONES.forEach((milestone, i) => {
    assert.equal(STORY[i].stop, STOPS[i + 1]);
    assert.equal(milestoneAt(STORY[i].stop), milestone);
  });
  assert.equal(STORY.at(-1).stop, 1);
});
