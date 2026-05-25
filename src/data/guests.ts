export interface Guest {
  slug: string;       // word-word pair — the URL key and invitation code
  greeting: string;   // shown as "Dear [greeting]," — e.g. "Sarah & Tom" or "The Clarke Family"
  maxGuests: number;  // caps the party-size field on the RSVP form
}

// Replace these placeholder entries with your real guest list.
// Use generateSlug() from src/data/words.ts to mint new codes, or pick any
// word-word pair from those lists manually.
export const guests: Guest[] = [
  { slug: "cedar-vale",   greeting: "Sarah & Tom",         maxGuests: 2 },
  { slug: "amber-grove",  greeting: "James",               maxGuests: 1 },
  { slug: "moss-haven",   greeting: "The Clarke Family",   maxGuests: 4 },
];
