// Where the guest is in the story, kept when the screen changes shape and
// when they step out to the Details page (see docs/VOYAGE.md). Pure, so it
// can be tested; Garden.tsx's useVoyage applies it.
import { ARRIVAL_END, VOYAGE_END } from './journey.ts';

// The scroll space is a share of the screen's height (svh), so when a phone
// turns, the same scroll in pixels is a different place in the story: turning
// at May 2021 once landed in August 2022. The page keeps the story's progress
// instead and sets the scroll from it, in the new height. `span` is how far
// the page can scroll, in pixels.
export const scrollFor = (progress: number, span: number) => Math.round(Math.min(1, Math.max(0, progress)) * Math.max(0, span));

// Safari keeps no copy of a page with WebGL to go back to, and the Garden opens
// at its title by design, so a guest who popped over to the details came back
// to the start. Leaving by the details or RSVP links, the page remembers where
// it was in sessionStorage (this tab, this visit), and on coming back it opens
// there once, at the dock if they left from the dock. A fresh visit, a new tab
// or a reload after that opens at the title as always.
export const PLACE_KEY = 'pa_voyage_place';

// What to keep on leaving from eased progress `p`, or null to keep nothing:
// from the opening there is nothing to come back to. Any Garden reopens
// there, the Personal link or the generic page the Details page's monogram
// leads back to.
export function placeToKeep(p: number): string | null {
  if (!(p >= ARRIVAL_END)) return null;
  return JSON.stringify({ p: p >= VOYAGE_END ? 1 : Math.min(1, p) });
}

// The progress to open at, from what was kept, or null to open at the title.
export function placeToReopen(stored: string | null): number | null {
  if (!stored) return null;
  try {
    const { p } = JSON.parse(stored);
    if (typeof p !== 'number' || !(p >= ARRIVAL_END && p <= 1)) return null;
    return p >= VOYAGE_END ? 1 : p;
  } catch {
    return null;
  }
}
