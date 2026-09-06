/**
 * Single source of truth for where the reader is: one normalised value, 0..1.
 *
 * Deliberately a plain mutable module singleton rather than React state.
 * useFrame reads it every frame; putting it in state would re-render the tree
 * 60 times a second for no benefit.
 */

export const scrollState = {
  /** 0 at the top of the page, 1 at the bottom. */
  progress: 0,
  /** Smoothed |d(progress)/dt|, roughly 0..1. Drives the strand billow. */
  velocity: 0,
  /** When set, the debug scrubber is driving instead of the scrollbar. */
  override: null as number | null,
};

/** What the scene should actually use. */
export function currentProgress() {
  return scrollState.override ?? scrollState.progress;
}

/** How many viewport heights of scroll the story occupies. */
export const SCROLL_VH = 700;

export function attachScrollListener() {
  const read = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    scrollState.progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
  };
  read();
  window.addEventListener('scroll', read, { passive: true });
  window.addEventListener('resize', read);
  return () => {
    window.removeEventListener('scroll', read);
    window.removeEventListener('resize', read);
  };
}
