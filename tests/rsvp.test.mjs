import assert from 'node:assert/strict';
import test from 'node:test';
import {
  describeGuest, formatDietary, latestReply, lookupUrl, parseDietary, readLookup, readParty, readSaved, sentOn, storageKey, toParams,
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

const dean = { name: 'Dean', attending: 'yes', dietary: '', busTo: 'Wollongong', busFrom: 'none', dinner: 'yes' };
const saved = {
  submitted_at: '2026-10-17T00:00:00.000Z', code: 'curry', party: 'Dean & Kelly',
  song: '', message: '', guests: [dean],
};

test('a saved RSVP must have answered Guests', () => {
  assert.deepEqual(readSaved(JSON.stringify(saved)), saved);
  assert.equal(readSaved(JSON.stringify({ ...saved, guests: [{ name: 'Dean', attending: 'maybe' }] })), null);
  assert.equal(readSaved(JSON.stringify({ ...saved, guests: [] })), null);
});

test('an RSVP saved before the bus had stops still loads, with the bus unanswered', () => {
  const old = { ...saved, guests: [{ name: 'Dean', attending: 'yes', dietary: 'vegan', bus: 'yes' }] };
  assert.deepEqual(readSaved(JSON.stringify(old)).guests, [{ name: 'Dean', attending: 'yes', dietary: 'vegan', busTo: '', busFrom: '', dinner: '' }]);
});

test('an RSVP saved with a contact, before the night-before dinner, still loads without the contact', () => {
  const old = { submitted_at: saved.submitted_at, code: 'curry', party: 'Dean & Kelly', contact: 'a@b.co', song: 'September', message: 'Yay',
    guests: [{ name: 'Dean', attending: 'yes', dietary: 'Vego', busTo: 'Berry', busFrom: 'none' }] };
  assert.deepEqual(readSaved(JSON.stringify(old)), { submitted_at: saved.submitted_at, code: 'curry', party: 'Dean & Kelly', song: 'September', message: 'Yay',
    guests: [{ name: 'Dean', attending: 'yes', dietary: 'Vego', busTo: 'Berry', busFrom: 'none', dinner: '' }] });
  assert.equal(readSaved(JSON.stringify({ ...saved, guests: [{ ...dean, dinner: 'maybe' }] })).guests[0].dinner, '');
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
  assert.equal(readLookup({ ok: true, rsvp: { ...saved, guests: undefined } }, 'curry'), null);
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
  const guests = [{ name: 'Dean', attending: 'yes', dietary: 'Vegetarian', busTo: 'Wollongong', busFrom: 'Berry', dinner: 'no' }];
  const params = toParams({
    submitted_at: '2026-09-30T00:00:00.000Z', code: 'curry', party: 'Dean & Kelly',
    song: 'September', message: 'Yay', guests,
  });
  assert.deepEqual([...params.keys()], ['submitted_at', 'code', 'party', 'song', 'message', 'guests']);
  assert.deepEqual(JSON.parse(params.get('guests')), guests);
});

test('the confirmation says when the reply was sent, in Sydney', () => {
  assert.equal(sentOn('2026-10-23T22:00:00.000Z'), '24 October');
  assert.equal(sentOn(''), '');
  assert.equal(sentOn('soon'), '');
});

test('answers read back as one sentence per Guest', () => {
  const guest = (fields) => ({ name: 'Dean', attending: 'yes', dietary: '', busTo: '', busFrom: '', dinner: '', ...fields });
  assert.equal(describeGuest(guest({ dietary: 'Vegetarian. ', busTo: 'Wollongong', busFrom: 'Berry' })),
    'Dean: coming, Vegetarian, bus from Wollongong, bus home to Berry.');
  assert.equal(describeGuest(guest({ busTo: 'none', busFrom: 'Gerringong' })), 'Dean: coming, bus home to Gerringong.');
  assert.equal(describeGuest(guest({ busTo: 'none', busFrom: 'none' })), 'Dean: coming, no bus.');
  assert.equal(describeGuest(guest({})), 'Dean: coming.');
  assert.equal(describeGuest(guest({ busTo: 'none', busFrom: 'none', dinner: 'yes' })), 'Dean: coming, no bus, dinner the night before.');
  assert.equal(describeGuest(guest({ dinner: 'no' })), 'Dean: coming.');
  assert.equal(describeGuest(guest({ attending: 'no', dietary: 'vegan', busTo: 'Berry' })), 'Dean: can’t make it.');
});

test('dietary buttons and Other text become one line for the sheet', () => {
  assert.equal(formatDietary(['Vegetarian', 'No peanuts'], ' shellfish '), 'Vegetarian, No peanuts, shellfish');
  assert.equal(formatDietary(['Gluten free'], ''), 'Gluten free');
  assert.equal(formatDietary([], ''), '');
});

test('a saved dietary line splits back into buttons and Other text', () => {
  assert.deepEqual(parseDietary('Vegetarian, No peanuts, shellfish, halal'), { choices: ['Vegetarian', 'No peanuts'], other: 'shellfish, halal' });
  assert.deepEqual(parseDietary('Vego, dairy free'), { choices: ['Vegetarian', 'Dairy free'], other: '' });
  assert.deepEqual(parseDietary('vegan'), { choices: ['Vegan'], other: '' });
  assert.deepEqual(parseDietary('no dairy please'), { choices: [], other: 'no dairy please' });
  assert.deepEqual(parseDietary(''), { choices: [], other: '' });
});
