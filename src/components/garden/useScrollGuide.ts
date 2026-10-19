// When the scroll helper shows (scrollGuide.ts has the rules): this keeps
// the time of the guest's last scroll, key or touch, and of the story's last
// movement, and steps the helper on as they change.
import { useEffect, useRef, useState, type RefObject } from 'react';
import { GUIDE_KEY, guideStep, shownSoFar, type Guide } from './scrollGuide';

function storedShown() {
  try { return typeof sessionStorage === 'undefined' ? 0 : shownSoFar(sessionStorage.getItem(GUIDE_KEY)); } catch { return 0; }
}

export function useScrollGuide(scroller: RefObject<HTMLElement | null>, { open, atDock, moving }: { open: boolean; atDock: boolean; moving: boolean }) {
  // Only whether it shows is rendered, so reading the count here hydrates the same as the server's.
  const [guide, setGuide] = useState<Guide>(() => ({ shown: storedShown(), showing: false, at: 0 }));
  const [visible, setVisible] = useState(true);
  const [check, setCheck] = useState(0);
  const active = useRef(0), showing = useRef(false);
  useEffect(() => {
    const element = scroller.current!;
    const poke = () => {
      active.current = performance.now();
      if (showing.current) setCheck(n => n + 1);
    };
    const onVisibility = () => { active.current = performance.now(); setVisible(document.visibilityState === 'visible'); };
    onVisibility();
    const events = ['scroll', 'wheel', 'touchstart', 'touchmove', 'pointerdown'] as const;
    for (const event of events) element.addEventListener(event, poke, { passive: true });
    addEventListener('keydown', poke);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      for (const event of events) element.removeEventListener(event, poke);
      removeEventListener('keydown', poke);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [scroller]);
  // The story coming to rest or setting off, or the helper's chance opening or closing, starts the quiet afresh.
  useEffect(() => { active.current = performance.now(); }, [moving, open, atDock]);
  useEffect(() => {
    // Dev only, for now: nothing on the page opens a dialog, but one would cover it.
    const dialog = document.querySelector('dialog[open]') !== null;
    const { guide: next, wait } = guideStep(guide, { open: open && visible && !dialog, atDock, moving, active: active.current, now: performance.now() });
    showing.current = next.showing;
    if (next !== guide) {
      setGuide(next);
      if (next.shown !== guide.shown) try { sessionStorage.setItem(GUIDE_KEY, String(next.shown)); } catch { /* private mode: just this page */ }
    }
    if (wait === null) return;
    const timer = setTimeout(() => setCheck(n => n + 1), wait + 20);
    return () => clearTimeout(timer);
  }, [guide, open, visible, atDock, moving, check]);
  return guide.showing;
}
