// Texts each Party their invitation from this Mac's Messages app: the
// message from invites/message.txt, then their image from invites/out.
// Prints what it would send unless given --send. See README "Invitations".
import { appendFile, copyFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { homedir } from 'node:os';
import { relative, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs, promisify } from 'node:util';
import { parties } from '../src/data/parties.ts';
import {
  DRAFT_MARKER, LOG_HEADER, displayPhone, logLine, normalisePhone, planSends, readContacts, readSentLog,
  renderMessage, unknownPlaceholders,
} from './invites.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const applescript = fileURLToPath(new URL('send-invite.applescript', import.meta.url));
const services = { imessage: 'iMessage', sms: 'SMS', rcs: 'RCS' };

const usage = `Usage: node scripts/send-invites.mjs [options]

Prints every message it would send. Nothing is sent without --send.

  --send             really send, after you type "send" to confirm
  --only a,b         just these Invite codes
  --to <phone>       send the --only Parties' messages to this number instead
                     (a test to yourself); never marks a Party as sent
  --limit N          at most N messages this run
  --resend           include numbers the sent log says already got theirs
  --no-image         send the text without the image
  --service S        imessage (default), sms or rcs
  --no-fallback      don't retry by SMS when iMessage refuses a number
  --delay S          seconds between recipients (default 5)
  --contacts PATH    default invites/contacts.csv
  --message PATH     default invites/message.txt
  --images DIR       default invites/out (expects <code>.png)
  --log PATH         default invites/sent.log
  --stage-dir DIR    where images are copied for Messages (default ~/Pictures/Wedding invites)`;

let args;
try {
  ({ values: args } = parseArgs({
    options: {
      send: { type: 'boolean', default: false },
      only: { type: 'string', default: '' },
      to: { type: 'string' },
      limit: { type: 'string' },
      resend: { type: 'boolean', default: false },
      'no-image': { type: 'boolean', default: false },
      service: { type: 'string', default: 'imessage' },
      'no-fallback': { type: 'boolean', default: false },
      delay: { type: 'string', default: '5' },
      contacts: { type: 'string', default: resolve(root, 'invites/contacts.csv') },
      message: { type: 'string', default: resolve(root, 'invites/message.txt') },
      images: { type: 'string', default: resolve(root, 'invites/out') },
      log: { type: 'string', default: resolve(root, 'invites/sent.log') },
      'stage-dir': { type: 'string', default: resolve(homedir(), 'Pictures/Wedding invites') },
      help: { type: 'boolean', short: 'h', default: false },
    },
  }));
} catch (error) {
  fail(`${error.message}\n\n${usage}`);
}
if (args.help) { console.log(usage); process.exit(0); }

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}
const show = (path) => {
  const near = relative(process.cwd(), path);
  return near && !near.startsWith('..') ? near : path;
};

const only = args.only.split(',').map((code) => code.trim()).filter(Boolean);
const unknownOnly = only.filter((code) => !parties.some((p) => p.code === code));
if (unknownOnly.length) fail(`--only: no Party has the code ${unknownOnly.join(', ')}`);
const limit = args.limit === undefined ? Infinity : Number(args.limit);
if (limit !== Infinity && (!Number.isInteger(limit) || limit < 1)) fail('--limit needs a whole number above 0');
const delay = Number(args.delay);
if (!(delay >= 0)) fail('--delay needs a number of seconds');
if (!services[args.service]) fail(`--service must be imessage, sms or rcs, not ${args.service}`);
const testPhone = args.to === undefined ? null : normalisePhone(args.to);
if (args.to !== undefined && !testPhone) fail(`--to: "${args.to}" isn't a mobile number`);
if (testPhone && !only.length) fail('--to needs --only, so a test can\'t send every Party\'s message to one number');

// The message, checked against every Party before anything is sent.
if (!existsSync(args.message)) fail(`no message template at ${show(args.message)}`);
const template = await readFile(args.message, 'utf8');
const unknown = unknownPlaceholders(template);
if (unknown.length) fail(`${show(args.message)} has ${unknown.map((name) => `{${name}}`).join(', ')}; only {greeting}, {link} and {code} are filled in`);
if (!template.trim()) fail(`${show(args.message)} is empty`);

// Who gets it. A --to test doesn't need contacts.csv at all.
let recipients, problems = [];
if (testPhone) {
  recipients = only.map((code) => ({ code, phone: testPhone, party: parties.find((p) => p.code === code) }));
} else {
  if (!existsSync(args.contacts)) fail(`no contacts at ${show(args.contacts)}. Copy invites/contacts.example.csv to invites/contacts.csv and fill it in.`);
  const contacts = readContacts(await readFile(args.contacts, 'utf8'), parties);
  for (const warning of contacts.warnings) console.log(`! ${warning}`);
  if (contacts.unreached.length) {
    console.log(`! ${contacts.unreached.length} Parties have no number in ${show(args.contacts)}: ${contacts.unreached.join(', ')}`);
  }
  problems = contacts.errors;
  recipients = contacts.recipients;
  const missingOnly = only.filter((code) => !recipients.some((r) => r.code === code));
  if (missingOnly.length) problems.push(`--only: no number for ${missingOnly.join(', ')} in ${show(args.contacts)}`);
}
if (problems.length) fail(`fix ${show(args.contacts)} first:\n  ${problems.join('\n  ')}`);

const image = (code) => resolve(args.images, `${code}.png`);
const isPng = (path) => existsSync(path) && readFileSync(path).subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
const log = !testPhone && existsSync(args.log) ? readSentLog(await readFile(args.log, 'utf8')) : [];
const { queue, skipped } = planSends(recipients, log, {
  only, limit, resend: args.resend || Boolean(testPhone), hasImage: (code) => args['no-image'] || isPng(image(code)),
});

const pastLimit = skipped.filter(({ reason }) => reason.startsWith('past --limit')).length;
for (const { recipient, reason } of skipped) {
  if (!reason.startsWith('past --limit')) console.log(`- skip ${recipient.code} ${displayPhone(recipient.phone)}: ${reason}`);
}
if (pastLimit) console.log(`- ${pastLimit} more left for a later run (--limit ${limit})`);

const service = services[args.service];
const indent = (text) => text.split('\n').map((line) => `    │ ${line}`).join('\n');
console.log('');
queue.forEach((r, i) => {
  console.log(`[${i + 1}/${queue.length}] ${r.code} (${r.party.greeting}) → ${displayPhone(r.phone)} by ${service}${testPhone ? ' [test]' : ''}`);
  console.log(indent(renderMessage(template, r.party)));
  console.log(args['no-image'] ? '    no image' : `    then the image ${show(image(r.code))}`);
  console.log('');
});
const partiesInQueue = new Set(queue.map((r) => r.code)).size;
const summary = `${queue.length} message${queue.length === 1 ? '' : 's'} to ${partiesInQueue} Part${partiesInQueue === 1 ? 'y' : 'ies'}`;

if (!args.send) {
  if (queue.length && !args['no-image']) console.log(`Images are copied to ${args['stage-dir']} before sending, where Messages can read them.`);
  console.log(`Dry run: nothing sent. ${queue.length ? `Add --send to send ${summary}.` : 'Nothing to send.'}`);
  process.exit(0);
}
if (!queue.length) { console.log('Nothing to send.'); process.exit(0); }
if (template.includes(DRAFT_MARKER)) fail(`${show(args.message)} still has its ${DRAFT_MARKER}…] line. Rewrite the message and delete that line first.`);
if (!process.stdin.isTTY) fail('--send has to be confirmed by typing, so run it in a terminal');

const osascript = promisify(execFile);
async function messages(argv, timeout = 60_000) {
  try {
    const { stdout } = await osascript('osascript', [applescript, ...argv], { timeout });
    return stdout.trim();
  } catch (error) {
    const reason = error.killed ? `no answer from Messages in ${timeout / 1000}s` : (error.stderr || error.message).trim();
    throw Object.assign(new Error(/-1743|not authori[sz]ed/i.test(reason)
      ? `${reason}. Allow your terminal to control Messages in System Settings → Privacy & Security → Automation.`
      : reason), { timedOut: Boolean(error.killed) });
  }
}

// Asking Messages for its accounts brings up the Automation permission
// prompt (if it's coming) before the batch, and checks the service exists.
let accounts;
try {
  accounts = await messages(['accounts'], 180_000);
} catch (error) {
  fail(`couldn't reach Messages: ${error.message}`);
}
if (!accounts.split(', ').includes(service)) {
  fail(`Messages has no enabled ${service} account (it has: ${accounts || 'none'}). Sign in, or pick another --service.`);
}
const fallback = service === 'iMessage' && !args['no-fallback'] && accounts.split(', ').includes('SMS');

const prompt = createInterface({ input: process.stdin, output: process.stdout });
const answer = await prompt.question(`Send ${summary} from Messages (${accounts})? Type "send" to go: `);
prompt.close();
if (answer.trim() !== 'send') fail('not sent');

if (!args['no-image']) await mkdir(args['stage-dir'], { recursive: true });
if (!testPhone && !existsSync(args.log)) await appendFile(args.log, LOG_HEADER + '\n');

// The text, then the image. Retries by SMS only when iMessage refuses the
// text outright (not when it just goes quiet), so nothing arrives twice.
async function deliver(r) {
  const text = renderMessage(template, r.party);
  const tries = fallback ? ['imessage', 'sms'] : [args.service];
  const errors = [];
  let used = null;
  for (const name of tries) {
    try { await messages([name, r.phone, 'text', text]); used = name; break; }
    catch (error) {
      errors.push(`${services[name]}: ${error.message}`);
      if (error.timedOut) { errors.timedOut = true; break; } // it may still have gone: don't retry
    }
  }
  if (!used) return { status: errors.timedOut ? 'unsure' : 'failed', service: tries.slice(0, errors.length).join('+'), detail: errors.join('; ') };
  if (args['no-image']) return { status: 'sent', service: used, detail: errors.join('; ') };
  try {
    const staged = resolve(args['stage-dir'], `${r.code}.png`);
    await copyFile(image(r.code), staged);
    await sleep(1500);
    await messages([used, r.phone, 'file', staged]);
    return { status: 'sent', service: used, detail: errors.join('; ') };
  } catch (error) {
    return { status: 'partial', service: used, detail: `image failed: ${error.message}` };
  }
}

console.log(`Sending. Ctrl-C stops between messages; ${testPhone ? 'test sends aren\'t logged' : `each is logged to ${show(args.log)}`}.`);
const counts = { sent: 0, partial: 0, unsure: 0, failed: 0 };
for (const [i, r] of queue.entries()) {
  if (i > 0) await sleep(delay * 1000);
  const result = await deliver(r);
  counts[result.status]++;
  const mark = { sent: '✓', partial: '!', unsure: '?', failed: '✖' }[result.status];
  console.log(`${mark} [${i + 1}/${queue.length}] ${r.code} ${displayPhone(r.phone)}: ${result.status} by ${result.service}${result.detail ? ` (${result.detail})` : ''}`);
  if (!testPhone) {
    await appendFile(args.log, logLine({ at: new Date().toISOString(), code: r.code, phone: r.phone, ...result }));
  }
}
console.log(`\nDone: ${counts.sent} sent, ${counts.partial} text only, ${counts.unsure} unsure (check Messages), ${counts.failed} failed.`);
console.log('"Sent" means Messages accepted it. Check Messages for any red "Not Delivered" and resend those with --only <code> --resend --service sms.');
if (counts.partial || counts.unsure || counts.failed) process.exitCode = 1;
