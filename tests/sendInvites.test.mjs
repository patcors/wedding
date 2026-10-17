import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  displayPhone, logLine, normalisePhone, parseCsv, planSends, readContacts, readSentLog, renderMessage,
  unknownPlaceholders,
} from '../scripts/invites.mjs';

const parties = [
  { code: 'curry', greeting: 'Dean & Kelly', guests: ['Dean', 'Kelly'] },
  { code: 'bridge', greeting: 'Paula', guests: ['Paula'] },
  { code: 'rat', greeting: 'Katie', guests: ['Katie'] },
];

test('CSV reads quotes, doubled quotes, CRLF and a spreadsheet BOM', () => {
  assert.deepEqual(parseCsv('﻿code,phone\r\ncurry, 0400 000 000 \r\n"bridge","04""00"\n'), [
    ['code', 'phone'], ['curry', '0400 000 000'], ['bridge', '04"00'],
  ]);
  assert.deepEqual(parseCsv('a,"b, c"\nd,e'), [['a', 'b, c'], ['d', 'e']]);
});

test('every way of writing an Australian mobile becomes +614…', () => {
  for (const raw of ['0400 000 000', '0400-000-000', '(04) 0000 0000', '400000000', '61400000000',
    '+61 400 000 000', '+61 (0) 400 000 000', '+610400000000', '0061 400 000 000', ' 0400.000.000 ']) {
    assert.equal(normalisePhone(raw), '+61400000000', raw);
  }
});

test('overseas numbers pass through, and landlines and junk are refused', () => {
  assert.equal(normalisePhone('+44 7700 900123'), '+447700900123');
  assert.equal(normalisePhone('+1 (415) 555-0100'), '+14155550100');
  for (const raw of ['02 9999 9999', '0400 000 00', '04000000000', '', 'Dean', '+12', undefined]) {
    assert.equal(normalisePhone(raw), null, String(raw));
  }
  assert.equal(displayPhone('+61400000000'), '+61 400 000 000');
  assert.equal(displayPhone('+447700900123'), '+447700900123');
});

test('contacts check each code against the Parties and list who has no number', () => {
  const csv = [
    'name,Phone,code', '# comment row', 'Dean,0400 000 000,curry', 'Kelly,0400 000 001,curry',
    '', 'Dean again,+61400000000,curry', 'Paula,0400000002,bridge',
  ].join('\n');
  const { recipients, errors, warnings, unreached } = readContacts(csv, parties);
  assert.deepEqual(errors, []);
  assert.deepEqual(recipients.map((r) => [r.code, r.phone]), [
    ['curry', '+61400000000'], ['curry', '+61400000001'], ['bridge', '+61400000002'],
  ]);
  assert.equal(recipients[0].party.greeting, 'Dean & Kelly');
  assert.match(warnings[0], /curry \+61 400 000 000 is listed twice/);
  assert.deepEqual(unreached, ['rat']);
});

test('unknown codes, bad numbers and a missing header are errors', () => {
  const { errors, warnings } = readContacts('code,phone\ncury,0400000000\nrat,02 9999 9999\nrat,0400000000', parties);
  assert.match(errors[0], /line 2: no Party has the code "cury"/);
  assert.match(errors[1], /line 3: "02 9999 9999" for rat isn't a mobile/);
  assert.equal(warnings.length, 0);
  assert.match(readContacts('curry,0400000000', parties).errors[0], /header with "code" and "phone"/);
  assert.match(readContacts('code,phone\ncurry,0400000000\nrat,0400000000', parties).warnings[0], /both curry and rat/);
});

test('the template fills in each Party, keeping apostrophes and emoji as typed', () => {
  const template = 'Hi {greeting}! It’s Jasper\'s 🎉\r\n\r\n{link}\n\n';
  assert.equal(renderMessage(template, parties[0]), 'Hi Dean & Kelly! It’s Jasper\'s 🎉\n\nhttps://patrickandamelia.com/curry');
  assert.equal(renderMessage('{code} {code}', parties[1]), 'bridge bridge');
  assert.deepEqual(unknownPlaceholders('Hi {greeting}, {gretting} {link} {Link} {}'), ['gretting', 'Link', '']);
  assert.deepEqual(unknownPlaceholders('no placeholders { here }'), []);
});

test('the sent log round-trips and flattens multi-line errors', () => {
  const line = logLine({ at: '2026-10-18T01:00:00.000Z', code: 'curry', phone: '+61400000000', status: 'failed',
    service: 'imessage', detail: 'execution error:\n\tno such buddy' });
  assert.equal(line, '2026-10-18T01:00:00.000Z\tcurry\t+61400000000\tfailed\timessage\texecution error: no such buddy\n');
  assert.deepEqual(readSentLog(`timestamp\tcode\tphone\tstatus\tservice\tdetail\n${line}`), [{
    at: '2026-10-18T01:00:00.000Z', code: 'curry', phone: '+61400000000', status: 'failed',
    service: 'imessage', detail: 'execution error: no such buddy',
  }]);
});

test('re-runs skip numbers sent, half sent or maybe sent, and retry failures', () => {
  const recipients = readContacts('code,phone\ncurry,0400000000\ncurry,0400000001\nbridge,0400000002\nrat,0400000003', parties).recipients;
  const log = readSentLog([
    '1\tcurry\t+61400000000\tfailed\timessage\tx',
    '2\tcurry\t+61400000000\tsent\timessage\t',
    '3\tcurry\t+61400000000\tpartial\timessage\ta later --resend lost its image',
    '4\tbridge\t+61400000002\tpartial\timessage\timage failed: y',
    '5\trat\t+61400000003\tfailed\timessage\tz',
    '6\tcurry\t+61400000001\tunsure\timessage\tno answer from Messages in 60s',
  ].join('\n'));
  const { queue, skipped } = planSends(recipients, log);
  assert.deepEqual(queue.map((r) => r.phone), ['+61400000003']);
  assert.deepEqual(skipped.map(({ recipient, reason }) => [recipient.code, reason.split(/ \(|;/)[0]]), [
    ['curry', 'already sent 2'], ['curry', 'Messages didn\'t answer on 6'], ['bridge', 'only the text went on 4'],
  ]);
  assert.equal(planSends(recipients, log, { resend: true }).queue.length, 4);
});

test('--only, --limit and missing images narrow the queue', () => {
  const recipients = readContacts('code,phone\ncurry,0400000000\ncurry,0400000001\nbridge,0400000002\nrat,0400000003', parties).recipients;
  assert.deepEqual(planSends(recipients, [], { only: ['curry'] }).queue.map((r) => r.phone), ['+61400000000', '+61400000001']);
  const limited = planSends(recipients, [], { limit: 1 });
  assert.equal(limited.queue.length, 1);
  assert.equal(limited.skipped.filter(({ reason }) => reason === 'past --limit 1').length, 3);
  const noImage = planSends(recipients, [], { hasImage: (code) => code !== 'bridge' });
  assert.deepEqual(noImage.queue.map((r) => r.code), ['curry', 'curry', 'rat']);
  assert.match(noImage.skipped[0].reason, /no image/);
});

test('the dry run prints each message and sends nothing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'invites-'));
  writeFileSync(join(dir, 'contacts.csv'), 'code,phone\ncurry,0400 000 000\nbridge,0400 000 001\n');
  writeFileSync(join(dir, 'message.txt'), 'Hi {greeting}, it\'s on! {link}\n');
  const output = execFileSync(process.execPath, ['scripts/send-invites.mjs', '--no-image',
    '--contacts', join(dir, 'contacts.csv'), '--message', join(dir, 'message.txt'), '--log', join(dir, 'sent.log')],
  { cwd: new URL('../', import.meta.url), encoding: 'utf8' });
  assert.match(output, /curry \(Dean & Kelly\) → \+61 400 000 000 by iMessage/);
  assert.match(output, /│ Hi Dean & Kelly, it's on! https:\/\/patrickandamelia\.com\/curry/);
  assert.match(output, /Dry run: nothing sent\. Add --send to send 2 messages to 2 Parties\./);
});
