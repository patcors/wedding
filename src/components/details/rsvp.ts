// The RSVP's rules, kept apart from the form's DOM so they can be tested:
// what the Details page remembers about a Party, what gets sent, and how a
// sent RSVP is read back to the guest.

export type Answer = 'yes' | 'no';

/** Where the bus stops, in the order the form offers them. Change stops here. */
export const BUS_STOPS = ['Berry', 'Gerringong', 'Kiama'];

/** A bus answer: '' when not coming or not answered, 'none', or a stop from BUS_STOPS. */
export type BusChoice = string;

export interface GuestReply {
  name: string;
  attending: Answer;
  dietary: string;     // only for Guests who are coming
  busTo: BusChoice;    // where they get on to come to the venue
  busFrom: BusChoice;  // where they get off on the way home
  dinner: Answer | ''; // dinner at the Berry Hotel the night before; '' when not coming or not answered
}

// No contact any more (Amelia, October 2026): older replies' `contact` is
// read past and dropped.
export interface Rsvp {
  submitted_at: string;
  code: string;      // the Party's Invite code
  party: string;     // the Party's greeting
  song: string;
  message: string;   // a note for us
  guests: GuestReply[];
}

/** What a Personal link leaves in localStorage.pa_party. */
export interface RememberedParty {
  code: string;
  greeting: string;
  guests: string[];
}

/** The dietary buttons, in order. Anything else goes in "Other". */
export const DIETARY_OPTIONS = ['Vegetarian', 'Vegan', 'Dairy free', 'No peanuts', 'Gluten free'] as const;
/** What older replies called a button: "Vego" is now "Vegetarian". */
const DIETARY_ALIASES: Record<string, (typeof DIETARY_OPTIONS)[number]> = { vego: 'Vegetarian' };

/** The sheet keeps dietary needs as one line: "Vegetarian, No peanuts, shellfish". */
export function formatDietary(choices: string[], other: string): string {
  return [...choices, other.trim()].filter(Boolean).join(', ');
}

/** Splits a saved dietary line back into buttons and "Other" text (older replies were free text). */
export function parseDietary(dietary: string): { choices: string[]; other: string } {
  const choices: string[] = [];
  const rest: string[] = [];
  for (const part of dietary.split(',').map(p => p.trim()).filter(Boolean)) {
    const option = DIETARY_OPTIONS.find(o => o.toLowerCase() === part.toLowerCase()) ?? DIETARY_ALIASES[part.toLowerCase()];
    if (option && !choices.includes(option)) choices.push(option);
    else if (!option) rest.push(part);
  }
  return { choices, other: rest.join(', ') };
}

const isString = (value: unknown): value is string => typeof value === 'string';
const isAnswer = (value: unknown): value is Answer => value === 'yes' || value === 'no';

function parse(raw: string | null): unknown {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function readParty(raw: string | null): RememberedParty | null {
  const value = parse(raw) as Partial<RememberedParty> | null;
  if (!value || !isString(value.code) || !value.code || !isString(value.greeting)) return null;
  if (!Array.isArray(value.guests) || !value.guests.length || !value.guests.every(isString)) return null;
  return { code: value.code, greeting: value.greeting, guests: value.guests };
}

const text = (value: unknown) => (isString(value) ? value : '');

/** A complete RSVP from untrusted data, or null. Fields it doesn't know (like
    the old yes/no `bus`) are dropped, and missing bus answers read as unanswered. */
export function toRsvp(value: unknown): Rsvp | null {
  const v = value as Partial<Record<keyof Rsvp, unknown>> | null;
  if (!v || typeof v !== 'object' || !Array.isArray(v.guests) || !v.guests.length) return null;
  const guests = v.guests as Partial<Record<keyof GuestReply, unknown>>[];
  if (!guests.every(g => g && isString(g.name) && isAnswer(g.attending))) return null;
  return {
    submitted_at: text(v.submitted_at),
    code: text(v.code),
    party: text(v.party),
    song: text(v.song),
    message: text(v.message),
    guests: guests.map(g => ({
      name: g.name as string,
      attending: g.attending as Answer,
      dietary: text(g.dietary),
      busTo: text(g.busTo),
      busFrom: text(g.busFrom),
      dinner: isAnswer(g.dinner) ? g.dinner : '',
    })),
  };
}

export const readSaved = (raw: string | null): Rsvp | null => toRsvp(parse(raw));

export const storageKey = (code: string) => `pa_rsvp_${code}`;

/** Where to ask the Sheet for a Party's reply (the Apps Script's doGet). */
export const lookupUrl = (endpoint: string, code: string) =>
  `${endpoint}${endpoint.includes('?') ? '&' : '?'}code=${encodeURIComponent(code)}`;

/** The reply in a doGet response, `{ ok: true, rsvp: {...} | null }`, if it's this Party's. */
export function readLookup(body: unknown, code: string): Rsvp | null {
  const value = body as { ok?: unknown; rsvp?: unknown } | null;
  if (!value || value.ok !== true) return null;
  const rsvp = toRsvp(value.rsvp);
  return rsvp && rsvp.code === code ? rsvp : null;
}

/** Whichever reply was sent last. Ties, and times that can't be read, keep this device's copy. */
export function latestReply(local: Rsvp | null, remote: Rsvp | null): Rsvp | null {
  if (!remote) return local;
  if (!local) return remote;
  const remoteTime = Date.parse(remote.submitted_at);
  const localTime = Date.parse(local.submitted_at);
  return remoteTime > localTime ? remote : local;
}

/** The urlencoded body Apps Script reads as e.parameter. */
export function toParams(rsvp: Rsvp): URLSearchParams {
  return new URLSearchParams({
    submitted_at: rsvp.submitted_at,
    code: rsvp.code,
    party: rsvp.party,
    song: rsvp.song,
    message: rsvp.message,
    guests: JSON.stringify(rsvp.guests),
  });
}

const isStop = (choice: BusChoice) => choice !== '' && choice !== 'none';

/** When the Party's reply was sent, as "24 October", or '' if the time can't be read. */
export function sentOn(submittedAt: string): string {
  const time = Date.parse(submittedAt);
  return Number.isNaN(time) ? '' : new Date(time).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', timeZone: 'Australia/Sydney' });
}

/** One Guest's answer as a sentence: "Dean: coming, Vegetarian, bus from Kiama, bus home to Berry, dinner the night before." */
export function describeGuest(guest: GuestReply): string {
  if (guest.attending === 'no') return `${guest.name}: can’t make it.`;
  const parts = ['coming'];
  const dietary = guest.dietary.trim().replace(/[.\s]+$/, '');
  if (dietary) parts.push(dietary);
  if (isStop(guest.busTo)) parts.push(`bus from ${guest.busTo}`);
  if (isStop(guest.busFrom)) parts.push(`bus home to ${guest.busFrom}`);
  if (!isStop(guest.busTo) && !isStop(guest.busFrom) && (guest.busTo === 'none' || guest.busFrom === 'none')) parts.push('no bus');
  if (guest.dinner === 'yes') parts.push('dinner the night before');
  return `${guest.name}: ${parts.join(', ')}.`;
}
