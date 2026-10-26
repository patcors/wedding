// The parts of sending invitations that don't touch Messages or the disk:
// reading contacts, phone numbers, the message template, and the sent log.
// scripts/send-invites.mjs does the rest.

export const SITE = 'https://patrickandamelia.com';
export const PLACEHOLDERS = ['greeting', 'link', 'code'];
// The committed message.txt starts with this until Amelia rewrites it.
export const DRAFT_MARKER = '[DRAFT';

export const personalLink = (code) => `${SITE}/${code}`;

// RFC 4180-ish: quoted fields, "" inside quotes, CRLF, and the BOM Numbers
// and Excel put at the start of exports. Returns rows of trimmed fields.
export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field.trim()); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field.trim()); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field || row.length) { row.push(field.trim()); rows.push(row); }
  return rows;
}

// Any way an Australian mobile gets written, as +614XXXXXXXX. Numbers that
// already start with another country's + code pass through unchanged.
// Landlines and anything else return null: they can't get a text.
export function normalisePhone(raw) {
  let s = String(raw ?? '').trim().replace(/\(0\)/g, '').replace(/[\s().-]/g, '');
  if (s.startsWith('00')) s = '+' + s.slice(2);
  if (s.startsWith('+61')) s = s.slice(3);
  else if (/^61\d{9}$/.test(s)) s = s.slice(2);
  else if (s.startsWith('+')) return /^\+[1-9]\d{7,14}$/.test(s) ? s : null;
  s = s.replace(/^0/, '');
  return /^4\d{8}$/.test(s) ? '+61' + s : null;
}

// +61400000000 → +61 400 000 000, for reading back on screen.
export const displayPhone = (phone) =>
  /^\+614\d{8}$/.test(phone) ? phone.replace(/^(\+61)(\d{3})(\d{3})(\d{3})$/, '$1 $2 $3 $4') : phone;

// contacts.csv: a header with `code` and `phone` (any order, other columns
// ignored), then one row per number. A Party can have several rows.
// Rows whose first field starts with # are comments.
export function readContacts(text, parties) {
  const known = new Map(parties.map((p) => [p.code, p]));
  const recipients = [], errors = [], warnings = [];
  const rows = parseCsv(text).map((fields, i) => ({ fields, line: i + 1 }))
    .filter(({ fields }) => fields.some(Boolean) && !fields[0].startsWith('#'));
  const header = rows.shift()?.fields.map((h) => h.toLowerCase()) ?? [];
  const codeAt = header.indexOf('code'), phoneAt = header.indexOf('phone');
  if (codeAt < 0 || phoneAt < 0) {
    return { recipients, errors: ['the first row must be a header with "code" and "phone" columns'], warnings, unreached: [] };
  }
  const seen = new Map();
  for (const { fields, line } of rows) {
    const code = fields[codeAt] ?? '', raw = fields[phoneAt] ?? '';
    const phone = normalisePhone(raw);
    if (!known.has(code)) errors.push(`line ${line}: no Party has the code "${code}"`);
    else if (!phone) errors.push(`line ${line}: "${raw}" for ${code} isn't a mobile number`);
    else if (seen.get(phone)?.code === code) warnings.push(`line ${line}: ${code} ${displayPhone(phone)} is listed twice, sending once`);
    else {
      if (seen.has(phone)) warnings.push(`line ${line}: ${displayPhone(phone)} is listed for both ${seen.get(phone).code} and ${code}, so it gets both messages`);
      const recipient = { code, phone, party: known.get(code), line };
      seen.set(phone, recipient);
      recipients.push(recipient);
    }
  }
  const reached = new Set(recipients.map((r) => r.code));
  return { recipients, errors, warnings, unreached: parties.filter((p) => !reached.has(p.code)).map((p) => p.code) };
}

// Placeholders in the template that aren't {greeting}, {link} or {code},
// so a typo like {gretting} stops the run instead of going out to guests.
export const unknownPlaceholders = (template) =>
  [...new Set([...template.matchAll(/\{([^{}\s]*)\}/g)].map((m) => m[1]))].filter((name) => !PLACEHOLDERS.includes(name));

export function renderMessage(template, party) {
  const values = { greeting: party.greeting, link: personalLink(party.code), code: party.code };
  return template.replace(/\r\n?/g, '\n').trim().replace(/\{(greeting|link|code)\}/g, (_, name) => values[name]);
}

// The Sheet's Invites tab, one row per Party with columns to fill in by hand
// as each invitation goes, and its Guests tab, one row per Guest. See README
// "Tracking invitations".
export const INVITE_COLUMNS = ['code', 'party', 'link', 'sent_via', 'sent_on', 'notes'];
export const GUEST_COLUMNS = ['code', 'party', 'guest'];

export function sheetRows(parties) {
  return {
    invites: [INVITE_COLUMNS, ...parties.map((p) => [p.code, p.greeting, personalLink(p.code), '', '', ''])],
    guests: [GUEST_COLUMNS, ...parties.flatMap((p) => p.guests.map((guest) => [p.code, p.greeting, guest]))],
  };
}

// The quoting parseCsv reads: fields with commas, quotes or line breaks are
// quoted, with quotes doubled.
export const toCsv = (rows) =>
  rows.map((row) => row.map((v) => /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v).join(',')).join('\r\n') + '\r\n';

// sent.log: append-only, one tab-separated line per attempt:
// timestamp, code, phone, status, service, detail.
// status is sent, partial (the text went but the image didn't), unsure
// (Messages never answered, so the text may have gone) or failed (nothing
// went). --to test sends aren't logged.
export const LOG_HEADER = 'timestamp\tcode\tphone\tstatus\tservice\tdetail';

export function logLine({ at, code, phone, status, service, detail = '' }) {
  return [at, code, phone, status, service, detail.replace(/\s+/g, ' ').trim()].join('\t') + '\n';
}

export function readSentLog(text) {
  return text.split(/\r?\n/).filter((line) => line && !line.startsWith('#') && line !== LOG_HEADER).map((line) => {
    const [at, code, phone, status, service, detail = ''] = line.split('\t');
    return { at, code, phone, status, service, detail };
  });
}

// Who to message this run, and why everyone else is left out. A number that
// was ever sent, half sent or maybe sent is skipped unless resend is set, so
// a re-run after a failure only retries what failed and never doubles up.
export function planSends(recipients, log, { only = [], limit = Infinity, resend = false, hasImage = () => true } = {}) {
  const done = new Map();
  for (const entry of log) {
    const key = `${entry.code} ${entry.phone}`;
    if (entry.status === 'sent' || (['partial', 'unsure'].includes(entry.status) && done.get(key)?.status !== 'sent')) {
      done.set(key, entry);
    }
  }
  const queue = [], skipped = [];
  for (const recipient of recipients) {
    if (only.length && !only.includes(recipient.code)) continue;
    const previous = done.get(`${recipient.code} ${recipient.phone}`);
    if (previous && !resend) {
      skipped.push({ recipient, reason: {
        sent: `already sent ${previous.at}`,
        partial: `only the text went on ${previous.at} (${previous.detail}); send the image by hand, or use --resend`,
        unsure: `Messages didn't answer on ${previous.at}; check whether it went, and use --resend if not`,
      }[previous.status] });
    } else if (!hasImage(recipient.code)) skipped.push({ recipient, reason: 'no image (use --no-image to send the text alone)' });
    else if (queue.length >= limit) skipped.push({ recipient, reason: `past --limit ${limit}` });
    else queue.push(recipient);
  }
  return { queue, skipped };
}
