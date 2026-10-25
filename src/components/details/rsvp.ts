// The RSVP's rules, kept apart from the form's DOM so they can be tested:
// what the Details page remembers about a Party, what gets sent, and how a
// sent RSVP is read back to the guest.

export type Answer = 'yes' | 'no';

/** The towns the bus stops in, in the order the form offers them. Change
    them here. The exact stops aren't named until the couple know where
    everyone's staying (Amelia, October 2026); each Guest taking the bus
    leaves a mobile so the stops and times can be sorted out with them. */
export const BUS_STOPS = ['Berry', 'Gerringong', 'Kiama'];

/** A bus answer: a town from BUS_STOPS, or '' when not coming or not taking
    the bus that way. The question is optional, so there's no "No thanks"
    (Amelia, October 2026). Anything else (that button's old 'none', a town
    since dropped, or the plain 'yes' of the week the towns weren't named)
    reads as not taking it. */
export type BusChoice = string;
const busChoice = (value: string): BusChoice => BUS_STOPS.includes(value) ? value : '';
/** Whether a bus answer is a town, so the Guest is taking the bus that way. */
export const isStop = (choice: BusChoice) => BUS_STOPS.includes(choice);

export interface GuestReply {
  name: string;
  attending: Answer;
  dietary: string;     // only for Guests who are coming
  busTo: BusChoice;    // where they get on to come to the venue
  busFrom: BusChoice;  // where they get off on the way home
  mobile: string;      // to sort out the bus with them; only when they take it
  dinner: Answer | ''; // dinner at the Berry Hotel the night before; '' when not coming
}

export interface Rsvp {
  submitted_at: string;
  code: string;      // the Party's Invite code
  party: string;     // the Party's greeting
  contact: string;   // the Guests' bus mobiles, each once: "0400 000 000, 0411 111 111"
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
    the old yes/no `bus`) are dropped, and missing bus answers read as not
    taking it. A reply from before each Guest had their own mobile gives the
    Party's one to everyone taking the bus. */
export function toRsvp(value: unknown): Rsvp | null {
  const v = value as Partial<Record<keyof Rsvp, unknown>> | null;
  if (!v || typeof v !== 'object' || !Array.isArray(v.guests) || !v.guests.length) return null;
  const guests = v.guests as Partial<Record<keyof GuestReply, unknown>>[];
  if (!guests.every(g => g && isString(g.name) && isAnswer(g.attending))) return null;
  const contact = text(v.contact);
  return {
    submitted_at: text(v.submitted_at),
    code: text(v.code),
    party: text(v.party),
    contact,
    song: text(v.song),
    message: text(v.message),
    guests: guests.map(g => {
      const busTo = busChoice(text(g.busTo));
      const busFrom = busChoice(text(g.busFrom));
      return {
        name: g.name as string,
        attending: g.attending as Answer,
        dietary: text(g.dietary),
        busTo,
        busFrom,
        mobile: busTo || busFrom ? text(g.mobile) || contact : '',
        dinner: isAnswer(g.dinner) ? g.dinner : '',
      };
    }),
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

/** Whether the Apps Script's answer to a post says it wrote the reply: `{ ok: true }`. */
export const sentOk = (body: unknown) => (body as { ok?: unknown } | null)?.ok === true;

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
    contact: rsvp.contact,
    song: rsvp.song,
    message: rsvp.message,
    guests: JSON.stringify(rsvp.guests),
  });
}

/** Whether a Guest is taking the bus, either way. */
export const takesBus = (guest: Pick<GuestReply, 'busTo' | 'busFrom'>) => isStop(guest.busTo) || isStop(guest.busFrom);

/** The mobiles the bus will be sorted out on, each once, in the Guests' order. */
export const busMobiles = (guests: GuestReply[]) =>
  [...new Set(guests.filter(takesBus).map(g => g.mobile.trim()).filter(Boolean))];

/** Why a mobile for the bus isn't usable, or null when it looks like a phone number. */
export function phoneProblem(phone: string): string | null {
  const value = phone.trim();
  if (!value) return 'We need a mobile to sort out the bus with you.';
  const digits = value.replace(/\D/g, '').length;
  return /^[\d\s()+.-]+$/.test(value) && digits >= 8 && digits <= 15 ? null : 'That doesn’t look like a mobile number.';
}

/** When the Party's reply was sent, as "24 October", or '' if the time can't be read. */
export function sentOn(submittedAt: string): string {
  const time = Date.parse(submittedAt);
  return Number.isNaN(time) ? '' : new Date(time).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', timeZone: 'Australia/Sydney' });
}

/** One Guest's answer as a sentence: "Dean: coming, vegetarian, bus from Kiama, bus home to Berry, dinner the night before."
    Only what they're having: no bus or no dinner goes unsaid. The dietary
    buttons are lower case mid-sentence; "Other" stays as typed. */
export function describeGuest(guest: GuestReply): string {
  if (guest.attending === 'no') return `${guest.name}: can’t make it.`;
  const parts = ['coming'];
  const { choices, other } = parseDietary(guest.dietary);
  parts.push(...choices.map(choice => choice.toLowerCase()));
  const otherDietary = other.replace(/[.\s]+$/, '');
  if (otherDietary) parts.push(otherDietary);
  if (isStop(guest.busTo)) parts.push(`bus from ${guest.busTo}`);
  if (isStop(guest.busFrom)) parts.push(`bus home to ${guest.busFrom}`);
  if (guest.dinner === 'yes') parts.push('dinner the night before');
  return `${guest.name}: ${parts.join(', ')}.`;
}
