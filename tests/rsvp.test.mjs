import assert from 'node:assert/strict';
import test from 'node:test';
import {
  busMobiles, describeGuest, formatDietary, latestReply, lookupUrl, ownDetailsPath, parseDietary, phoneProblem, readLookup, readParty, readSaved, sentOk, sentOn, storageKey,
  takesBus, toParams,
} from '../src/components/details/rsvp.ts';

test('a Party is only trusted when localStorage holds a complete one', () => {
  const party = { code: 'curry', greeting: 'Dean & Kelly', guests: ['Dean', 'Kelly'] };
  assert.deepEqual(readParty(JSON.stringify(party)), party);
  assert.equal(readParty(null), null);
  assert.equal(readParty('not json'), null);
  assert.equal(readParty(JSON.stringify({ ...party, guests: [] })), null);
  assert.equal(readParty(JSON.stringify({ ...party, code: '' })), null);
});

test('the plain Details page sends a guest from their Personal link on to their own', () => {
  const site = 'https://patrickandamelia.com';
  assert.equal(ownDetailsPath(`${site}/serb/`, site), '/serb/details/');
  assert.equal(ownDetailsPath(`${site}/serb`, site), '/serb/details/');
  assert.equal(ownDetailsPath(`${site}/hungry-jacks/?at=.5`, site), '/hungry-jacks/details/');
  // Not from a Personal link: nowhere, the generic Garden, this page, dev pages, other sites.
  for (const referrer of ['', 'not a url', `${site}/`, `${site}/details/`, `${site}/dev/`, `${site}/dev/links`, `${site}/serb/details/`, `${site}/Serb/`, 'https://example.com/serb/'])
    assert.equal(ownDetailsPath(referrer, site), null, referrer);
  // Under a base path.
  assert.equal(ownDetailsPath(`${site}/wedding/serb/`, site, '/wedding/'), '/wedding/serb/details/');
  assert.equal(ownDetailsPath(`${site}/serb/`, site, '/wedding/'), null);
});

test('each Party remembers its own RSVP', () => {
  assert.equal(storageKey('curry'), 'pa_rsvp_curry');
  assert.notEqual(storageKey('curry'), storageKey('bridge'));
});

const dean = { name: 'Dean', attending: 'yes', dietary: '', busTo: 'Kiama', busFrom: '', mobile: '0400 000 000', dinner: 'yes' };
const saved = {
  submitted_at: '2026-10-17T00:00:00.000Z', code: 'curry', party: 'Dean & Kelly',
  contact: '0400 000 000', song: '', message: '', guests: [dean],
};

test('a saved RSVP must have answered Guests', () => {
  assert.deepEqual(readSaved(JSON.stringify(saved)), saved);
  assert.equal(readSaved(JSON.stringify({ ...saved, guests: [{ name: 'Dean', attending: 'maybe' }] })), null);
  assert.equal(readSaved(JSON.stringify({ ...saved, guests: [] })), null);
});

test('an RSVP saved before the bus had stops still loads, without the bus', () => {
  const old = { ...saved, guests: [{ name: 'Dean', attending: 'yes', dietary: 'vegan', bus: 'yes' }] };
  assert.deepEqual(readSaved(JSON.stringify(old)).guests, [{ name: 'Dean', attending: 'yes', dietary: 'vegan', busTo: '', busFrom: '', mobile: '', dinner: '' }]);
});

test('an RSVP saved before the night-before dinner still loads, with a dropped town, a plain yes or "No thanks" as no bus', () => {
  const old = { submitted_at: saved.submitted_at, code: 'curry', party: 'Dean & Kelly', contact: '0400 000 000', song: 'September', message: 'Yay',
    guests: [{ name: 'Dean', attending: 'yes', dietary: 'Vego', busTo: 'Berry', busFrom: 'none' }] };
  const dropped = { ...old, guests: [{ ...old.guests[0], busTo: 'Wollongong', busFrom: 'yes' }] };
  assert.deepEqual(readSaved(JSON.stringify(dropped)).guests[0], { name: 'Dean', attending: 'yes', dietary: 'Vego', busTo: '', busFrom: '', mobile: '', dinner: '' });
  assert.deepEqual(readSaved(JSON.stringify(old)), { submitted_at: saved.submitted_at, code: 'curry', party: 'Dean & Kelly', contact: '0400 000 000', song: 'September', message: 'Yay',
    guests: [{ name: 'Dean', attending: 'yes', dietary: 'Vego', busTo: 'Berry', busFrom: '', mobile: '0400 000 000', dinner: '' }] });
  assert.equal(readSaved(JSON.stringify({ ...saved, guests: [{ ...dean, dinner: 'maybe' }] })).guests[0].dinner, '');
});

test('each Guest on the bus keeps their own mobile, and one from before that gets the Party’s', () => {
  const kelly = { ...dean, name: 'Kelly', busTo: '', busFrom: 'Berry', mobile: '0411 111 111' };
  const kai = { ...dean, name: 'Kai', busTo: '', busFrom: '', mobile: '' };
  assert.deepEqual(readSaved(JSON.stringify({ ...saved, guests: [dean, kelly, kai] })).guests.map(g => g.mobile), ['0400 000 000', '0411 111 111', '']);
  const before = { ...saved, contact: '0422 222 222', guests: [{ ...dean, mobile: undefined }, { ...kai, mobile: undefined }] };
  assert.deepEqual(readSaved(JSON.stringify(before)).guests.map(g => g.mobile), ['0422 222 222', '']);
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
  const guests = [{ name: 'Dean', attending: 'yes', dietary: 'Vegetarian', busTo: 'Gerringong', busFrom: '', mobile: '0400 000 000', dinner: 'no' }];
  const params = toParams({
    submitted_at: '2026-09-30T00:00:00.000Z', code: 'curry', party: 'Dean & Kelly',
    contact: '0400 000 000', song: 'September', message: 'Yay', guests,
  });
  assert.deepEqual([...params.keys()], ['submitted_at', 'code', 'party', 'contact', 'song', 'message', 'guests']);
  assert.deepEqual(JSON.parse(params.get('guests')), guests);
});

test('the confirmation says when the reply was sent, in Sydney', () => {
  assert.equal(sentOn('2026-10-23T22:00:00.000Z'), '24 October');
  assert.equal(sentOn(''), '');
  assert.equal(sentOn('soon'), '');
});

test('answers read back as one sentence per Guest, saying only what they’re having', () => {
  const guest = (fields) => ({ name: 'Dean', attending: 'yes', dietary: '', busTo: '', busFrom: '', mobile: '', dinner: '', ...fields });
  assert.equal(describeGuest(guest({ dietary: 'Vegetarian, No peanuts', busTo: 'Kiama', busFrom: 'Berry' })), 'Dean: coming, vegetarian, no peanuts, bus from Kiama, bus home to Berry.');
  assert.equal(describeGuest(guest({ dietary: 'Gluten free, Coeliac, no shellfish. ' })), 'Dean: coming, gluten free, Coeliac, no shellfish.');
  assert.equal(describeGuest(guest({ busFrom: 'Gerringong' })), 'Dean: coming, bus home to Gerringong.');
  assert.equal(describeGuest(guest({ busTo: 'Berry' })), 'Dean: coming, bus from Berry.');
  assert.equal(describeGuest(guest({})), 'Dean: coming.');
  assert.equal(describeGuest(guest({ dinner: 'yes' })), 'Dean: coming, dinner the night before.');
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

test('a Guest taking the bus either way gives a mobile, which has to look like a phone number', () => {
  const guest = (busTo, busFrom, mobile = '') => ({ name: 'Dean', attending: 'yes', dietary: '', busTo, busFrom, mobile, dinner: '' });
  assert.equal(takesBus(guest('', '')), false);
  assert.equal(takesBus(guest('', 'Kiama')), true);
  assert.equal(takesBus(guest('Berry', '')), true);
  assert.deepEqual(busMobiles([guest('Berry', '', '0400 000 000'), guest('', '', '0499 999 999'), guest('', 'Kiama', ' 0400 000 000 '), guest('Kiama', 'Kiama', '0411 111 111')]),
    ['0400 000 000', '0411 111 111']);
  assert.equal(phoneProblem('0435 597 406'), null);
  assert.equal(phoneProblem('+61 (435) 597-406'), null);
  assert.match(phoneProblem('  '), /need a mobile/);
  assert.match(phoneProblem('dean@example.com'), /doesn’t look like/);
  assert.match(phoneProblem('1234'), /doesn’t look like/);
});

test('a post only counts as written when the Apps Script says so', () => {
  assert.equal(sentOk({ ok: true }), true);
  assert.equal(sentOk({ ok: false, error: 'missing code' }), false);
  assert.equal(sentOk(null), false);
  assert.equal(sentOk('ok'), false);
});
