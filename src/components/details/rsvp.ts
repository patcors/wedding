// The RSVP's rules, kept apart from the form's DOM so they can be tested:
// what the Details page remembers about a Party, what gets sent, and how a
// sent RSVP is read back to the guest.

export type Answer = 'yes' | 'no';

/** Where the bus stops, in the order the form offers them. Change stops here. */
export const BUS_STOPS = ['Berry', 'Gerringong', 'Wollongong'];

/** A bus answer: '' when not coming or not answered, 'none', or a stop from BUS_STOPS. */
export type BusChoice = string;

export interface GuestReply {
  name: string;
  attending: Answer;
  dietary: string;     // only for Guests who are coming
  busTo: BusChoice;    // where they get on to come to the venue
  busFrom: BusChoice;  // where they get off on the way home
}

export interface Rsvp {
  submitted_at: string;
  code: string;      // the Party's Invite code
  party: string;     // the Party's greeting
  contact: string;
  song: string;
  message: string;
  guests: GuestReply[];
}

/** What a Personal link leaves in localStorage.pa_party. */
export interface RememberedParty {
  code: string;
  greeting: string;
  guests: string[];
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
  if (!v || typeof v !== 'object' || !Array.isArray(v.guests) || !v.guests.length || !isString(v.contact)) return null;
  const guests = v.guests as Partial<Record<keyof GuestReply, unknown>>[];
  if (!guests.every(g => g && isString(g.name) && isAnswer(g.attending))) return null;
  return {
    submitted_at: text(v.submitted_at),
    code: text(v.code),
    party: text(v.party),
    contact: v.contact,
    song: text(v.song),
    message: text(v.message),
    guests: guests.map(g => ({
      name: g.name as string,
      attending: g.attending as Answer,
      dietary: text(g.dietary),
      busTo: text(g.busTo),
      busFrom: text(g.busFrom),
    })),
  };
}

export const readSaved = (raw: string | null): Rsvp | null => toRsvp(parse(raw));

export const storageKey = (code: string) => `pa_rsvp_${code}`;

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

/** Why a contact isn't usable, or null when it looks like an email or phone number. */
export function contactProblem(contact: string): string | null {
  const value = contact.trim();
  if (!value) return 'We need an email or mobile so we can reach you.';
  const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const digits = value.replace(/\D/g, '').length;
  const looksLikePhone = /^[\d\s()+.-]+$/.test(value) && digits >= 8 && digits <= 15;
  return looksLikeEmail || looksLikePhone ? null : 'That doesn’t look like an email or mobile number.';
}

const isStop = (choice: BusChoice) => choice !== '' && choice !== 'none';

/** One Guest's answer as a sentence: "Dean: coming, vegetarian, bus from Wollongong, bus home to Berry." */
export function describeGuest(guest: GuestReply): string {
  if (guest.attending === 'no') return `${guest.name}: can’t make it.`;
  const parts = ['coming'];
  const dietary = guest.dietary.trim().replace(/[.\s]+$/, '');
  if (dietary) parts.push(dietary);
  if (isStop(guest.busTo)) parts.push(`bus from ${guest.busTo}`);
  if (isStop(guest.busFrom)) parts.push(`bus home to ${guest.busFrom}`);
  if (!isStop(guest.busTo) && !isStop(guest.busFrom) && (guest.busTo === 'none' || guest.busFrom === 'none')) parts.push('no bus');
  return `${guest.name}: ${parts.join(', ')}.`;
}
