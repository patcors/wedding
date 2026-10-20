// Drives the loading bar under the opening title (loadingBar.ts) from the
// page's own state and the scene's downloads. Everything is set on the
// element directly, not through React, so the bar the server painted is the
// one that fills, and the downloads don't re-render the page. The fill moves
// by Web Animations of its transform, which run off the main thread, so it
// keeps creeping while the scene compiles and the page is otherwise frozen.
import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { announced, barStep, laterStage, onItems, type Items, type LoadStage } from './loadingBar';

const FILL_MS = 400, FADE_MS = 700;

// What the fill shows right now, mid-animation or not.
function shownScale(fill: Element) {
  const transform = getComputedStyle(fill).transform;
  return !transform || transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).a;
}

export function useLoadingBar(bar: RefObject<HTMLElement | null>, { prepared, ready, failed }: { prepared: boolean; ready: boolean; failed: boolean }) {
  const memory = useRef<{ stage: LoadStage; items?: Items; said: number; done: boolean }>({ stage: 'page', said: -1, done: false });
  const advance = useCallback((stage: LoadStage, items?: Items) => {
    const element = bar.current, fill = element?.firstElementChild;
    const state = memory.current;
    if (!element || !(fill instanceof HTMLElement) || state.done) return;
    // Read here rather than from the page's state, which learns it a render late.
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const next = laterStage(state.stage, stage);
    if (items) state.items = items;
    // A new download only moves the bar while downloads are the stage.
    if (next === state.stage && !(items && next === 'assets')) return;
    state.stage = next;
    const { from, to, creep, seconds } = barStep(shownScale(fill), next, state.items, reduced);
    const scale = (value: number) => ({ transform: `scaleX(${value})` });
    const previous = fill.getAnimations();
    if (!seconds) fill.animate([scale(from), scale(to)], { duration: reduced ? 0 : FILL_MS, easing: 'ease-out', fill: 'forwards' });
    else {
      const duration = FILL_MS + seconds * 1000;
      fill.animate([{ ...scale(from), easing: 'ease-out' }, { ...scale(to), offset: FILL_MS / duration, easing: 'cubic-bezier(.2, .6, .35, 1)' }, scale(creep)], { duration, fill: 'forwards' });
    }
    // Including the CSS creep from before the script: the new animation starts where it was.
    previous.forEach(animation => animation.cancel());
    const said = announced(to);
    if (said !== state.said) { state.said = said; element.setAttribute('aria-valuenow', String(said)); }
    if (next === 'ready') {
      state.done = true;
      element.setAttribute('aria-hidden', 'true');
      element.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_MS, delay: reduced ? 0 : FILL_MS, easing: 'ease-in-out', fill: 'forwards' });
    }
  }, [bar]);
  useEffect(() => {
    advance('script');
    return onItems(items => advance(items.loaded >= items.total ? 'building' : 'assets', items));
  }, [advance]);
  useEffect(() => { if (prepared) advance('prepared'); }, [prepared, advance]);
  useEffect(() => { if (ready) advance('ready'); }, [ready, advance]);
  // The cover then offers the details instead: the bar goes without filling.
  useEffect(() => {
    const element = bar.current;
    if (!failed || !element || memory.current.done) return;
    memory.current.done = true;
    element.setAttribute('aria-hidden', 'true');
    element.animate([{ opacity: getComputedStyle(element).opacity }, { opacity: 0 }], { duration: FADE_MS, fill: 'forwards' });
  }, [failed, bar]);
}
