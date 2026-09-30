import assert from 'node:assert/strict';
import test from 'node:test';
import {
  contactProblem, describeGuest, joinNames, readParty, readSaved, storageKey, toParams,
} from '../src/components/details/rsvp.ts';

test('a Party is only trusted when localStorage holds a complete one', () => {
  const party = { code: 'curry', greeting: 'Dean & Kelly', guests: ['Dean', 'Kelly'] };
  assert.deepEqual(readParty(JSON.stringify(party)), party);
  assert.equal(readParty(null), null);
  assert.equal(readParty('not json'), null);
  assert.equal(readParty(JSON.stringify({ ...party, guests: [] })), null);
  assert.equal(readParty(JSON.stringify({ ...party, code: '' })), null);
});

test('each Party remembers its own RSVP, and Open RSVPs share one slot', () => {
  assert.equal(storageKey('curry'), 'pa_rsvp_curry');
  assert.equal(storageKey(''), 'pa_rsvp_open');
});

test('a saved RSVP must have answered Guests and a contact', () => {
  const rsvp = { contact: 'a@b.co', guests: [{ name: 'Dean', attending: 'yes', dietary: '', bus: '' }] };
  assert.deepEqual(readSaved(JSON.stringify(rsvp)), rsvp);
  assert.equal(readSaved(JSON.stringify({ ...rsvp, guests: [{ name: 'Dean', attending: 'maybe' }] })), null);
  assert.equal(readSaved(JSON.stringify({ guests: rsvp.guests })), null);
});

test('the body carries every field, with guests as a JSON string', () => {
  const guests = [{ name: 'Dean', attending: 'yes', dietary: 'vegetarian', bus: 'yes' }];
  const params = toParams({
    submitted_at: '2026-09-30T00:00:00.000Z', code: 'curry', party: 'Dean & Kelly',
    contact: '0400 000 000', song: 'September', message: 'Yay', guests,
  });
  assert.deepEqual([...params.keys()], ['submitted_at', 'code', 'party', 'contact', 'song', 'message', 'guests']);
  assert.deepEqual(JSON.parse(params.get('guests')), guests);
});

test('contact accepts an email or a phone number and nothing else', () => {
  assert.equal(contactProblem('dean@example.com'), null);
  assert.equal(contactProblem('0435 597 406'), null);
  assert.equal(contactProblem('+61 (435) 597-406'), null);
  assert.match(contactProblem('  '), /need an email or mobile/);
  assert.match(contactProblem('dean'), /doesn’t look like/);
  assert.match(contactProblem('1234'), /doesn’t look like/);
});

test('answers read back as one sentence per Guest', () => {
  assert.equal(describeGuest({ name: 'Dean', attending: 'yes', dietary: 'Vegetarian. ', bus: 'yes' }),
    'Dean: coming, Vegetarian, taking the bus.');
  assert.equal(describeGuest({ name: 'Sam', attending: 'yes', dietary: '', bus: 'no' }), 'Sam: coming, not taking the bus.');
  assert.equal(describeGuest({ name: 'Lou', attending: 'yes', dietary: '', bus: '' }), 'Lou: coming.');
  assert.equal(describeGuest({ name: 'Kelly', attending: 'no', dietary: 'vegan', bus: 'yes' }), 'Kelly: can’t make it.');
});

test('names join the way the Garden greets a Party', () => {
  assert.equal(joinNames(['Paula']), 'Paula');
  assert.equal(joinNames(['Dean', 'Kelly']), 'Dean & Kelly');
  assert.equal(joinNames(['A', 'B', 'C']), 'A, B & C');
});
