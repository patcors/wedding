// The RSVP's rules, kept apart from the form's DOM so they can be tested:
// what the Details page remembers about a Party, what gets sent, and how a
// sent RSVP is read back to the guest.

export type Answer = 'yes' | 'no';

export interface GuestReply {
  name: string;
  attending: Answer;
  dietary: string;   // only for Guests who are coming
  bus: Answer | '';  // '' when not coming, or not answered
}

export interface Rsvp {
  submitted_at: string;
  code: string;      // Invite code, or '' for an Open RSVP
  party: string;     // the Party's greeting, or OPEN_PARTY
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

export const OPEN_PARTY = 'Open RSVP';
export const MAX_OPEN_GUESTS = 6;

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

export function readSaved(raw: string | null): Rsvp | null {
  const value = parse(raw) as Partial<Rsvp> | null;
  if (!value || !Array.isArray(value.guests) || !value.guests.length) return null;
  const guests = value.guests.every(g => g && isString(g.name) && isAnswer(g.attending));
  if (!guests || !isString(value.contact)) return null;
  return value as Rsvp;
}

export const storageKey = (code: string) => (code ? `pa_rsvp_${code}` : 'pa_rsvp_open');

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

/** "Dean", "Dean & Kelly", "Dean, Kelly & Sam". */
export function joinNames(names: string[]): string {
  if (names.length < 2) return names.join('');
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

/** One Guest's answer as a sentence: "Dean: coming, vegetarian, taking the bus." */
export function describeGuest(guest: GuestReply): string {
  if (guest.attending === 'no') return `${guest.name}: can’t make it.`;
  const parts = ['coming'];
  const dietary = guest.dietary.trim().replace(/[.\s]+$/, '');
  if (dietary) parts.push(dietary);
  if (guest.bus === 'yes') parts.push('taking the bus');
  if (guest.bus === 'no') parts.push('not taking the bus');
  return `${guest.name}: ${parts.join(', ')}.`;
}
