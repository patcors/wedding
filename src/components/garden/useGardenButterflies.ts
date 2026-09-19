import { useCallback, useEffect, useRef, useState } from 'react';
import { availablePerch, spacedPerches, type PerchPoint } from './butterflyPerches';

export type ButterflyPerch = PerchPoint & { key: string; node: Text; offset: number };
export type ButterflyVisit = { id: number; perch: ButterflyPerch; landingAngle: number };
type MeasuredPerch = ButterflyPerch & PerchPoint;

function measurePerch(perch: { node: Text; offset: number }, context: CanvasRenderingContext2D | null): PerchPoint {
  const range = document.createRange();
  range.setStart(perch.node, perch.offset); range.setEnd(perch.node, perch.offset + 1);
  const rect = range.getBoundingClientRect();
  const style = getComputedStyle(perch.node.parentElement!);
  if (!context) return { x: rect.x + rect.width * .45, y: rect.y + rect.height * .2 };
  context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const ink = context.measureText(perch.node.data[perch.offset]);
  const ascent = ink.fontBoundingBoxAscent ?? parseFloat(style.fontSize) * .8;
  const descent = ink.fontBoundingBoxDescent ?? parseFloat(style.fontSize) * .2;
  return { x: rect.x + rect.width * .45,
    y: rect.y + (rect.height - ascent - descent) / 2 + ascent - ink.actualBoundingBoxAscent };
}

export function useGardenButterflies({ chapter, paused, disabled, sceneOnly }: {
  chapter: number; paused: boolean; disabled: boolean; sceneOnly: boolean;
}) {
  const [visits, setVisits] = useState<ButterflyVisit[]>([]);
  const [spots, setSpots] = useState<MeasuredPerch[]>([]);
  const reservations = useRef(new Map<number, ButterflyVisit>());
  const nextId = useRef(0);
  const currentSpots = useRef<MeasuredPerch[]>([]);
  const enabled = !disabled && !sceneOnly;

  useEffect(() => {
    const context = document.createElement('canvas').getContext('2d');
    const heading = document.querySelector('.garden-panel.is-active h1, .garden-panel.is-active h2');
    let disposed = false;
    const update = () => {
      if (disposed) return;
      const candidates: MeasuredPerch[] = [];
      if (enabled && heading) {
        const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
        let node: Node | null, textIndex = 0;
        while ((node = walker.nextNode())) {
          const text = node as Text;
          for (let offset = 0; offset < text.length; offset++) {
            if (!/\p{L}/u.test(text.data[offset])) continue;
            const perch = { key: `${chapter}:${textIndex}:${offset}`, node: text, offset };
            const point = measurePerch(perch, context);
            if (point.x >= 35 && point.x <= innerWidth - 35 && point.y >= 50 && point.y < innerHeight - 50) {
              candidates.push({ ...perch, ...point });
            }
          }
          textIndex++;
        }
      }
      // Allow the full wingspan to turn around the feet without touching a neighbour.
      const next = spacedPerches(candidates, innerWidth <= 700 ? 76 : 96);
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
    if (heading) observer.observe(heading);
    window.addEventListener('resize', update);
    // Recheck after the chapter's entrance transform and webfonts settle.
    heading?.closest('.garden-panel')?.addEventListener('transitionend', update);
    void document.fonts.ready.then(update);
    return () => {
      disposed = true; observer.disconnect(); window.removeEventListener('resize', update);
      heading?.closest('.garden-panel')?.removeEventListener('transitionend', update);
    };
  }, [chapter, enabled]);

  const release = useCallback(() => {
    if (!enabled || paused) return;
    const live = reservations.current;
    // Departing butterflies count too, preventing a stream of excess spawns.
    if (live.size >= currentSpots.current.length) return;
    const perch = availablePerch(currentSpots.current, new Set([...live.values()].map(visit => visit.perch.key)));
    if (!perch) return;
    const id = ++nextId.current;
    // A golden-ratio sequence spreads successive headings across the upper
    // semicircle. Keep a 10-degree margin above either side of the horizon.
    const visit = { id, perch, landingAngle: ((id * .61803398875) % 1) * 160 - 80 };
    // Claim synchronously, before React renders or another click/timer can run.
    live.set(visit.id, visit);
    setVisits([...live.values()]);
  }, [enabled, paused]);

  const retire = useCallback((id: number) => {
    reservations.current.delete(id);
    setVisits([...reservations.current.values()]);
  }, []);

  useEffect(() => {
    if (!enabled || paused) return;
    let timer: ReturnType<typeof setTimeout>;
    const visit = () => {
      if (!document.hidden) release();
      timer = setTimeout(visit, (22 + Math.random() * 24) * 1000);
    };
    timer = setTimeout(visit, (5 + Math.random() * 4) * 1000);
    return () => clearTimeout(timer);
  }, [enabled, paused, release]);

  useEffect(() => {
    if (!disabled) return;
    reservations.current.clear(); setVisits([]);
  }, [disabled]);

  return { visits, release, retire,
    validPerches: new Set(spots.map(spot => spot.key)),
    canRelease: enabled && !paused && visits.length < spots.length
      && !!availablePerch(spots, new Set(visits.map(visit => visit.perch.key))) };
}
