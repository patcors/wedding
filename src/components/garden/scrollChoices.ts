// Guests scroll down, or swipe up, to sail on. Dev only: the Review panel's
// "Scroll" can invert it, so scrolling up, or swiping down, sails on and the
// scroll helper says so, remembered across reloads. The page then opens
// scrolled to the bottom and the story runs up it. No imports, so the page
// can read these without pulling in three (see docs/VOYAGE.md, "The first script").
export const REVIEW_SCROLL = 'pa_dev_scroll';
export const scrollInverted = (stored: string | null) => stored === 'inverted';

// The scroll measured the way the story runs: from the top normally, from the
// bottom when inverted. `span` is how far the page can scroll, in pixels. Its
// own inverse, so the same call turns a story scroll back into the page's.
export const storyScroll = (top: number, span: number, inverted: boolean) => inverted ? Math.max(0, span) - top : top;
