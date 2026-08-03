import { guests } from '../../data/guests';
import { BRAID_T } from './curves';

/**
 * 'rope'  - hangs from Patrick's strand. Anything before the braid that is his.
 * 'silk'  - hangs from Amelia's strand.
 * 'shared'- hangs from the spine. Only meaningful after the braid.
 */
export type BillboardSide = 'rope' | 'silk' | 'shared';

export interface BillboardSpec {
  id: string;
  /** Position along the story, 0..1. See BRAID_T for where the lives meet. */
  t: number;
  side: BillboardSide;
  caption: string;
  /** Path under /public. Falls back to a numbered grey box when absent. */
  photo?: string;
  /** When set, this billboard only appears on that guest's page. */
  guestSlug?: string;
  /**
   * Which side of the spine a 'shared' billboard hangs on: -1 left, 1 right.
   * Defaults to alternating. Ignored for rope/silk, which follow their strand.
   */
  lateral?: -1 | 1;
}

/**
 * The shared spine of the story — seen by everyone.
 *
 * Authoring the site is mostly editing this array. Keep it to roughly this
 * length: at ~15 shared plus 2-3 personal, the scroll is already long, and
 * every extra billboard is one more thing nobody reaches.
 *
 * Avoid t within ~0.05 of BRAID_T (0.55) and above ~0.93 — the strands are
 * deliberately held still there so the braid and the knot read clean.
 */
export const sharedBillboards: BillboardSpec[] = [
  { id: 'r-childhood', t: 0.06, side: 'rope', caption: 'Before any of this' },
  { id: 's-childhood', t: 0.08, side: 'silk', caption: 'Meanwhile, elsewhere' },
  { id: 'r-first-boat', t: 0.16, side: 'rope', caption: 'The first boat' },
  { id: 's-first-silk', t: 0.19, side: 'silk', caption: 'Learning to fly' },
  { id: 'r-teens', t: 0.27, side: 'rope', caption: 'Salt, sunburn, bad haircuts' },
  { id: 's-teens', t: 0.30, side: 'silk', caption: 'Rehearsals and bruises' },
  { id: 'r-away', t: 0.38, side: 'rope', caption: 'Somewhere offshore' },
  { id: 's-away', t: 0.41, side: 'silk', caption: 'Somewhere mid-air' },
  { id: 'r-almost', t: 0.48, side: 'rope', caption: 'Closer than either of us knew' },
  { id: 's-almost', t: 0.50, side: 'silk', caption: 'Closer than either of us knew' },

  // --- the braid: this is where the two lives meet -------------------------
  { id: 'the-night', t: 0.63, side: 'shared', caption: 'And then, this' },
  { id: 'first-trip', t: 0.70, side: 'shared', caption: 'The first trip away' },
  { id: 'the-flat', t: 0.77, side: 'shared', caption: 'The flat with the bad kitchen' },
  { id: 'the-dog', t: 0.83, side: 'shared', caption: 'A questionable decision, beloved' },
  { id: 'proposal', t: 0.90, side: 'shared', caption: 'Yes' },
];

/**
 * Hand-authored personal billboards. Add real ones here as you write them.
 * `t` decides *when in the story* someone appears, which is the whole point —
 * put people where they actually entered your lives.
 */
export const personalBillboards: BillboardSpec[] = [
  {
    id: 'p-curry',
    guestSlug: 'curry',
    t: 0.34,
    side: 'rope',
    caption: 'Dean & Kelly — this is roughly where you two turn up',
  },
  {
    id: 'p-weird-barbie',
    guestSlug: 'weird-barbie',
    t: 0.44,
    side: 'silk',
    caption: 'Caitlin, you were there for this bit',
  },
];

/**
 * Placeholder so every guest page demonstrates the mechanic while the real
 * content is being written. Delete this once personalBillboards is populated —
 * a generic line is worse than no line at all.
 */
function fallbackFor(slug: string): BillboardSpec | null {
  const guest = guests.find((g) => g.slug === slug);
  if (!guest) return null;
  // Deterministic placement from the slug so it doesn't jump between builds.
  const hash = [...slug].reduce((a, c) => a + c.charCodeAt(0), 0);
  const t = 0.20 + ((hash % 100) / 100) * 0.28; // somewhere in the pre-braid years
  return {
    id: `fallback-${slug}`,
    guestSlug: slug,
    t,
    side: hash % 2 === 0 ? 'rope' : 'silk',
    caption: `${guest.greeting} — your moment goes here`,
  };
}

/** Everything visible on one guest's page, in scroll order. */
export function billboardsFor(slug?: string): BillboardSpec[] {
  const personal = slug
    ? personalBillboards.filter((b) => b.guestSlug === slug)
    : [];

  const withFallback =
    slug && personal.length === 0
      ? [fallbackFor(slug)].filter((b): b is BillboardSpec => b !== null)
      : personal;

  return [...sharedBillboards, ...withFallback].sort((a, b) => a.t - b.t);
}

export { BRAID_T };
