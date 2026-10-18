import assert from 'node:assert/strict';
import test from 'node:test';
import {
  contactProblem, describeGuest, formatDietary, latestReply, lookupUrl, parseDietary, readLookup, readParty, readSaved, storageKey, toParams,
} from '../src/components/details/rsvp.ts';

test('a Party is only trusted when localStorage holds a complete one', () => {
  const party = { code: 'curry', greeting: 'Dean & Kelly', guests: ['Dean', 'Kelly'] };
  assert.deepEqual(readParty(JSON.stringify(party)), party);
  assert.equal(readParty(null), null);
  assert.equal(readParty('not json'), null);
  assert.equal(readParty(JSON.stringify({ ...party, guests: [] })), null);
  assert.equal(readParty(JSON.stringify({ ...party, code: '' })), null);
});

test('each Party remembers its own RSVP', () => {
  assert.equal(storageKey('curry'), 'pa_rsvp_curry');
  assert.notEqual(storageKey('curry'), storageKey('bridge'));
});

const dean = { name: 'Dean', attending: 'yes', dietary: '', busTo: 'Wollongong', busFrom: 'none' };
const saved = {
  submitted_at: '2026-10-17T00:00:00.000Z', code: 'curry', party: 'Dean & Kelly',
  contact: 'a@b.co', song: '', message: '', guests: [dean],
};

test('a saved RSVP must have answered Guests and a contact', () => {
  assert.deepEqual(readSaved(JSON.stringify(saved)), saved);
  assert.equal(readSaved(JSON.stringify({ ...saved, guests: [{ name: 'Dean', attending: 'maybe' }] })), null);
  assert.equal(readSaved(JSON.stringify({ guests: saved.guests })), null);
});

test('an RSVP saved before the bus had stops still loads, with the bus unanswered', () => {
  const old = { ...saved, guests: [{ name: 'Dean', attending: 'yes', dietary: 'vegan', bus: 'yes' }] };
  assert.deepEqual(readSaved(JSON.stringify(old)).guests, [{ name: 'Dean', attending: 'yes', dietary: 'vegan', busTo: '', busFrom: '' }]);
});


test('the Sheet is asked for one Party by code', () => {
  assert.equal(lookupUrl('https://script.google.com/macros/s/X/exec', 'curry'), 'https://script.google.com/macros/s/X/exec?code=curry');
  assert.equal(lookupUrl('https://example.com/exec?v=2', 'two words'), 'https://example.com/exec?v=2&code=two%20words');
});

test('a lookup only counts when it holds this Party’s complete reply', () => {
  assert.deepEqual(readLookup({ ok: true, rsvp: saved }, 'curry'), saved);
  assert.equal(readLookup({ ok: true, rsvp: null }, 'curry'), null);
  assert.equal(readLookup({ ok: true, rsvp: saved }, 'bridge'), null);
  assert.equal(readLookup({ ok: false, rsvp: saved }, 'curry'), null);
  assert.equal(readLookup({ ok: true, rsvp: { ...saved, contact: undefined } }, 'curry'), null);
  assert.equal(readLookup(null, 'curry'), null);
});

test('the reply sent last wins, and this device keeps ties and unreadable times', () => {
  const at = (submitted_at) => ({ ...saved, submitted_at });
  const local = at('2026-10-17T01:00:00.000Z');
  const later = at('2026-10-17T02:00:00.000Z');
  assert.equal(latestReply(local, later), later);
  assert.equal(latestReply(later, local), later);
  assert.equal(latestReply(local, at(local.submitted_at)), local);
  assert.equal(latestReply(local, at('')), local);
  const unreadable = at('');
  assert.equal(latestReply(unreadable, later), unreadable);
  assert.equal(latestReply(null, later), later);
  assert.equal(latestReply(local, null), local);
  assert.equal(latestReply(null, null), null);
});

test('the body carries every field, with guests as a JSON string', () => {
  const guests = [{ name: 'Dean', attending: 'yes', dietary: 'vegetarian', busTo: 'Wollongong', busFrom: 'Berry' }];
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
  const guest = (fields) => ({ name: 'Dean', attending: 'yes', dietary: '', busTo: '', busFrom: '', ...fields });
  assert.equal(describeGuest(guest({ dietary: 'Vegetarian. ', busTo: 'Wollongong', busFrom: 'Berry' })),
    'Dean: coming, Vegetarian, bus from Wollongong, bus home to Berry.');
  assert.equal(describeGuest(guest({ busTo: 'none', busFrom: 'Gerringong' })), 'Dean: coming, bus home to Gerringong.');
  assert.equal(describeGuest(guest({ busTo: 'none', busFrom: 'none' })), 'Dean: coming, no bus.');
  assert.equal(describeGuest(guest({})), 'Dean: coming.');
  assert.equal(describeGuest(guest({ attending: 'no', dietary: 'vegan', busTo: 'Berry' })), 'Dean: can’t make it.');
});

test('dietary buttons and Other text become one line for the sheet', () => {
  assert.equal(formatDietary(['Vego', 'No peanuts'], ' shellfish '), 'Vego, No peanuts, shellfish');
  assert.equal(formatDietary(['Gluten free'], ''), 'Gluten free');
  assert.equal(formatDietary([], ''), '');
});

test('a saved dietary line splits back into buttons and Other text', () => {
  assert.deepEqual(parseDietary('Vego, No peanuts, shellfish, halal'), { choices: ['Vego', 'No peanuts'], other: 'shellfish, halal' });
  assert.deepEqual(parseDietary('vegan'), { choices: ['Vegan'], other: '' });
  assert.deepEqual(parseDietary('no dairy please'), { choices: [], other: 'no dairy please' });
  assert.deepEqual(parseDietary(''), { choices: [], other: '' });
});
