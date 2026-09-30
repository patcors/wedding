import { useCallback, useEffect, useRef, useState } from 'react';
import { availablePerch, spacedPerches, type PerchPoint } from './butterflyPerches';
import { BUTTERFLY_COLOR_ORDER, type ButterflyColor } from './butterflyColors';

const MAX_BUTTERFLIES = 15;
// Never hold the garden back for long, even if the flock can't land.
const SETTLE_LIMIT = 5000;

export type ButterflyPerch = PerchPoint & { key: string; node: Text; offset: number };
export type ButterflyVisit = { id: number; perch: ButterflyPerch; landingAngle: number; color: ButterflyColor; opening: boolean };
type MeasuredPerch = ButterflyPerch & PerchPoint;

function measurePerch(perch: { node: Text; offset: number }, height: number, context: CanvasRenderingContext2D | null): PerchPoint {
  const range = document.createRange();
  range.setStart(perch.node, perch.offset); range.setEnd(perch.node, perch.offset + 1);
  const rect = range.getBoundingClientRect();
  const style = getComputedStyle(perch.node.parentElement!);
  if (!context) return { x: rect.x + rect.width * .45, y: rect.y + rect.height * (.2 + height * .6) };
  context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const ink = context.measureText(perch.node.data[perch.offset]);
  const ascent = ink.fontBoundingBoxAscent ?? parseFloat(style.fontSize) * .8;
  const descent = ink.fontBoundingBoxDescent ?? parseFloat(style.fontSize) * .2;
  return { x: rect.x + rect.width * .45,
    y: rect.y + (rect.height - ascent - descent) / 2 + ascent - ink.actualBoundingBoxAscent
      + height * (ink.actualBoundingBoxAscent + ink.actualBoundingBoxDescent) };
}

export function useGardenButterflies({ chapter, paused, disabled, sceneOnly, ready }: {
  chapter: number; paused: boolean; disabled: boolean; sceneOnly: boolean; ready: boolean;
}) {
  const [visits, setVisits] = useState<ButterflyVisit[]>([]);
  const [spots, setSpots] = useState<MeasuredPerch[]>([]);
  const [fontsReady, setFontsReady] = useState(false);
  const [landed, setLanded] = useState(0);
  const [settled, setSettled] = useState(false);
  const openingCount = useRef(0);
  const initialReleased = useRef(false);
  const reservations = useRef(new Map<number, ButterflyVisit>());
  const nextId = useRef(0);
  const currentSpots = useRef<MeasuredPerch[]>([]);
  const enabled = !disabled && !sceneOnly;

  useEffect(() => {
    const context = document.createElement('canvas').getContext('2d');
    const panel = document.querySelector('.garden-arrival.is-active');
    const textElements = Array.from(panel?.querySelectorAll('h1') ?? []);
    let disposed = false;
    const update = () => {
      if (disposed) return;
      const candidates: MeasuredPerch[] = [];
      let textIndex = 0;
      for (const element of enabled ? textElements : []) {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        let node: Node | null;
        while ((node = walker.nextNode())) {
          const text = node as Text;
          for (let offset = 0; offset < text.length; offset++) {
            if (!/[\p{L}&]/u.test(text.data[offset])) continue;
            // Stagger candidates through the glyph's ink height, including the
            // ampersand, instead of treating every letter as a roof edge.
            const heights = offset % 2 ? [.9, .1, .5] : [.1, .9, .5];
            for (const height of heights) {
              const perch = { key: `${chapter}:${textIndex}:${offset}:${height}`, node: text, offset };
              const point = measurePerch(perch, height, context);
              if (point.x >= 35 && point.x <= innerWidth - 35 && point.y >= 50 && point.y < innerHeight - 50) {
                candidates.push({ ...perch, ...point });
              }
            }
          }
          textIndex++;
        }
      }
      // A denser flock uses distinct footholds throughout the letter faces.
      // Reservations still spread new arrivals across the largest free gaps.
      const next = spacedPerches(candidates, innerWidth <= 700 ? 25 : 32);
      // Flight frames read cached positions; only layout changes measure text.
      for (const visit of reservations.current.values()) {
        const updated = next.find(spot => spot.key === visit.perch.key);
        if (updated) { visit.perch.x = updated.x; visit.perch.y = updated.y; }
      }
      currentSpots.current = next;
      setSpots(next);
    };
    update();
    const observer = new ResizeObserver(update);
    for (const element of textElements) observer.observe(element);
    window.addEventListener('resize', update);
    // Recheck after the chapter's entrance transform and webfonts settle.
    panel?.addEventListener('transitionend', update);
    void document.fonts.ready.then(() => {
      if (disposed) return;
      update(); setFontsReady(true);
    });
    return () => {
      disposed = true; observer.disconnect(); window.removeEventListener('resize', update);
      panel?.removeEventListener('transitionend', update);
    };
  }, [chapter, enabled]);

  const release = useCallback((opening = false) => {
    if (!enabled || (!opening && (paused || !ready))) return;
    const live = reservations.current;
    // Departing butterflies count too, preventing a stream of excess spawns.
    if (live.size >= Math.min(MAX_BUTTERFLIES, currentSpots.current.length)) return;
    const perch = availablePerch(currentSpots.current, new Set([...live.values()].map(visit => visit.perch.key)));
    if (!perch) return;
    const id = ++nextId.current;
    const color = BUTTERFLY_COLOR_ORDER[(id - 1) % BUTTERFLY_COLOR_ORDER.length];
    // A golden-ratio sequence spreads successive headings across the upper
    // semicircle. Keep a 10-degree margin above either side of the horizon.
    const visit = { id, perch, color, opening, landingAngle: ((id * .61803398875) % 1) * 160 - 80 };
    // Claim synchronously, before React renders or another click/timer can run.
    live.set(visit.id, visit);
    setVisits([...live.values()]);
  }, [enabled, paused, ready]);

  useEffect(() => {
    if (!enabled || !fontsReady || !spots.length || initialReleased.current) return;
    initialReleased.current = true;
    // The opening flock lands on the names over the cover and stays while the
    // garden loads, using the same reservations as manual releases.
    for (let i = 0; i < Math.min(MAX_BUTTERFLIES, spots.length); i++) release(true);
    openingCount.current = reservations.current.size;
  }, [enabled, fontsReady, spots.length, release]);

  const land = useCallback(() => setLanded(count => count + 1), []);
  // Settled once the opening flock is perched, or there is none to wait for.
  useEffect(() => {
    if (!enabled || (fontsReady && (openingCount.current ? landed >= openingCount.current : !spots.length))) setSettled(true);
  }, [enabled, fontsReady, landed, spots.length]);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(true), SETTLE_LIMIT);
    return () => clearTimeout(timer);
  }, []);

  const retire = useCallback((id: number) => {
    reservations.current.delete(id);
    setVisits([...reservations.current.values()]);
  }, []);

  useEffect(() => {
    if (!enabled || paused || !ready) return;
    let timer: ReturnType<typeof setTimeout>;
    const visit = () => {
      if (!document.hidden && reservations.current.size === 0) release();
      timer = setTimeout(visit, (22 + Math.random() * 24) * 1000);
    };
    timer = setTimeout(visit, (5 + Math.random() * 4) * 1000);
    return () => clearTimeout(timer);
  }, [enabled, paused, ready, release]);

  useEffect(() => {
    if (!disabled) return;
    reservations.current.clear(); setVisits([]);
  }, [disabled]);

  return { visits, release, retire, land, settled,
    validPerches: new Set(spots.map(spot => spot.key)),
    canRelease: enabled && ready && !paused && visits.length < Math.min(MAX_BUTTERFLIES, spots.length)
      && !!availablePerch(spots, new Set(visits.map(visit => visit.perch.key))) };
}
