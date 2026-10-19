// The scroll helper (see docs/VOYAGE.md): a large hint over the scene that
// says to scroll, or on a phone to swipe up, to sail on. It first shows a
// moment after the opening has settled, goes as soon as the guest scrolls,
// glides or presses a key, and comes back each time they have been still for
// `idle` milliseconds, at most `shows` times a visit in all (the first
// counts), then stays off. Pure, so it can be tested; Garden.tsx feeds it.
export const GUIDE = { shows: 3, first: 900, idle: 1200 } as const;

// How many times it has shown this visit, kept in sessionStorage so a reload
// carries on the count rather than starting again.
export const GUIDE_KEY = 'pa_scroll_guide_shown';
export const shownSoFar = (stored: string | null) => {
  const n = Math.floor(Number(stored));
  return Number.isFinite(n) ? Math.min(GUIDE.shows, Math.max(0, n)) : 0;
};

// `at`: when it last came up, in milliseconds on the page's clock.
export type Guide = { shown: number; showing: boolean; at: number };

// `open`: the scene is revealed and the opening has settled, the page is
// visible, and nothing excludes it (the scene failed, scene-only, the Review
// panel or a dialog in dev). `atDock`: the story has reached the dock, where
// there is nowhere further to go. `moving`: the guest is scrolling, or the
// story is still travelling, gliding or coasting. `active`: when the guest
// last scrolled, pressed a key or touched the page, or the story last moved,
// or it opened, whichever was latest; `now`, the time now.
export type GuideScene = { open: boolean; atDock: boolean; moving: boolean; active: number; now: number };

// The helper's next state, and how many milliseconds until it would show if
// nothing changes (null if it won't).
export function guideStep(guide: Guide, scene: GuideScene): { guide: Guide; wait: number | null } {
  const hidden = guide.showing ? { ...guide, showing: false } : guide;
  if (!scene.open || scene.atDock || scene.moving) return { guide: hidden, wait: null };
  // Up, and nothing has happened since it came up: it stays.
  if (guide.showing && scene.active <= guide.at) return { guide, wait: null };
  if (hidden.shown >= GUIDE.shows) return { guide: hidden, wait: null };
  const wait = (hidden.shown === 0 ? GUIDE.first : GUIDE.idle) - (scene.now - scene.active);
  if (wait > 0) return { guide: hidden, wait };
  return { guide: { shown: hidden.shown + 1, showing: true, at: scene.now }, wait: null };
}
