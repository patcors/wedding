// Flies the opening title's names to their boats (openingNames.ts): each
// frame it finds each boat's masthead on screen, through the camera as the
// scene's frame has just placed it, and moves the names there with CSS
// variables on the title's panel, never React state. Patrick's is
// --garden-patrick-flight and --garden-patrick-shown, Amelia's likewise, and
// the "&" and subtitle's fade --garden-arrival-rest (see garden.css). After
// the camera and boats in the scene, so it sees this frame's.
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useJourney } from './JourneyProvider';
import { mastheadAt } from './storyBoats';
import { NAME_FLIGHT, NAMES_GONE, flightPoint, landingScale, nameBows, nameFlight, nameLandings, type Name } from './openingNames';

const NAMES: readonly { name: Name; side: -1 | 1 }[] = [{ name: 'amelia', side: -1 }, { name: 'patrick', side: 1 }];
// How far each name bows off its straight path, as a share of its type size.
const BOW = .5;
type Home = { x: number; y: number; width: number };
type Layout = { home: Record<Name, Home>; font: number; viewport: number };

export default function NameFlight({ panel, width }: { panel: RefObject<HTMLElement | null>; width: number }) {
  const clock = useJourney();
  const { camera, gl, size } = useThree();
  const point = useMemo(() => new THREE.Vector3(), []);
  // Where each name sits in the title, measured only when the layout changes.
  const layout = useRef<Layout | null>(null);
  const written = useRef(new Map<string, string>());
  useEffect(() => {
    const element = panel.current;
    if (!element) return;
    const stale = () => { layout.current = null; };
    const observer = new ResizeObserver(stale);
    observer.observe(element);
    addEventListener('resize', stale);
    void document.fonts.ready.then(stale);
    const values = written.current;
    return () => {
      observer.disconnect(); removeEventListener('resize', stale);
      // Home again if the scene goes, as the title then fades as it always did.
      for (const key of values.keys()) element.style.removeProperty(key);
      values.clear();
    };
  }, [panel]);
  useEffect(() => { layout.current = null; }, [size.width, size.height]);

  useFrame(() => {
    const element = panel.current;
    if (!element) return;
    const set = (key: string, value: string) => {
      if (written.current.get(key) === value) return;
      written.current.set(key, value);
      element.style.setProperty(key, value);
    };
    const p = clock.progress, flight = nameFlight(p);
    set('--garden-arrival-rest', flight.rest.toFixed(3));
    // Long gone: nothing to place.
    if (p > NAMES_GONE + .01) {
      for (const { name } of NAMES) set(`--garden-${name}-shown`, '0');
      return;
    }
    if (!layout.current) {
      // offsetLeft and offsetTop ignore the names' own transforms.
      const box = element.getBoundingClientRect(), home = {} as Record<Name, Home>;
      let font = 0;
      for (const { name } of NAMES) {
        const span = element.querySelector<HTMLElement>(`[data-name=${name}]`);
        if (!span) return;
        let x = span.offsetLeft, y = span.offsetTop;
        for (let parent = span.offsetParent as HTMLElement | null; parent && parent !== element; parent = parent.offsetParent as HTMLElement | null) {
          x += parent.offsetLeft; y += parent.offsetTop;
        }
        home[name] = { x: box.left + x + span.offsetWidth / 2, y: box.top + y + span.offsetHeight, width: span.offsetWidth };
        font = parseFloat(getComputedStyle(span).fontSize);
      }
      layout.current = { home, font, viewport: innerWidth };
    }
    const { home, font, viewport } = layout.current;
    const scale = landingScale(font, viewport);
    // Each masthead on screen, through this frame's camera.
    camera.updateMatrixWorld();
    const canvas = gl.domElement.getBoundingClientRect();
    const mast = {} as Record<Name, { x: number; y: number }>;
    for (const { name, side } of NAMES) {
      const top = mastheadAt(p, width, side, NAME_FLIGHT.above);
      point.set(top.x, top.y, top.z).project(camera);
      mast[name] = { x: canvas.left + (point.x + 1) / 2 * canvas.width, y: canvas.top + (1 - point.y) / 2 * canvas.height };
    }
    const landings = nameLandings(mast, { amelia: home.amelia.width * scale, patrick: home.patrick.width * scale }, viewport);
    const bows = nameBows(home, BOW * font);
    for (const { name } of NAMES) {
      const { k, shown } = flight[name], at = flightPoint(home[name], landings[name], k, bows[name]);
      set(`--garden-${name}-flight`, `translate(${(at.x - home[name].x).toFixed(1)}px, ${(at.y - home[name].y).toFixed(1)}px) scale(${(1 + (scale - 1) * k).toFixed(4)})`);
      set(`--garden-${name}-shown`, shown.toFixed(3));
    }
  });
  return null;
}
