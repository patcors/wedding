import { useEffect, useLayoutEffect, useRef } from 'react';
import type { ButterflyPerch } from './useGardenButterflies';
import { butterflyMotion } from './butterflyMotion';
import type { ButterflyColor } from './butterflyColors';
import ButterflyArtwork from './ButterflyArtwork';
import './gardenButterfly.css';

type Point = { x: number; y: number };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const curve = (a: Point, b: Point, c: Point, d: Point, t: number): Point => {
  const u = 1 - t;
  return { x: u ** 3 * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t ** 3 * d.x,
    y: u ** 3 * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t ** 3 * d.y };
};

export default function GardenButterfly({ paused, perch, landingAngle, color, startPerched, openingReleased, available, onComplete }: {
  paused: boolean; perch: ButterflyPerch; landingAngle: number; color: ButterflyColor; startPerched: boolean; openingReleased: boolean; available: boolean; onComplete: () => void;
}) {
  const sprite = useRef<HTMLDivElement>(null);
  const settings = useRef({ paused, available, openingReleased });
  useEffect(() => { settings.current = { paused, available, openingReleased }; }, [paused, available, openingReleased]);
  useLayoutEffect(() => {
    const element = sprite.current;
    if (!element) return;
    const seed = (landingAngle + 90) * .071;
    let frame = 0, previous = 0, elapsed = 0, time = 0, wingTime = seed;
    let phase: 'waiting' | 'arriving' | 'perched' | 'leaving' = startPerched ? 'perched' : 'waiting';
    // The opening flock waits for the shared loading-screen release signal.
    const rest = 3.5 + Math.random() * 2.5;
    const arrivalDuration = 4.2;
    let position: Point = startPerched ? { x: perch.x, y: perch.y } : { x: -80, y: 100 }, start = position, destination = position;
    let side = Math.random() > .5 ? 1 : -1, bank = startPerched ? landingAngle : 0;
    if (startPerched) {
      // Paint on the letters immediately, even while the garden is loading.
      element.dataset.phase = 'perched';
      element.style.opacity = '1';
      element.style.transform = `translate3d(${perch.x}px, ${perch.y}px, 0)`;
      element.style.setProperty('--butterfly-bank', `${bank}deg`);
      element.style.setProperty('--butterfly-left-fold', '53deg');
      element.style.setProperty('--butterfly-right-fold', '53deg');
    }
    const depart = () => {
      phase = 'leaving'; elapsed = 0; start = position;
      destination = { x: side > 0 ? innerWidth + 90 : -90, y: innerHeight * (.1 + Math.random() * .18) };
    };
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const dt = previous ? Math.min((now - previous) / 1000, .05) : 0;
      previous = now;
      if (settings.current.paused || document.hidden) {
        if (phase === 'perched') {
          position = { x: perch.x, y: perch.y };
          element.style.transform = `translate3d(${position.x}px, ${position.y}px, 0)`;
        }
        return;
      }
      elapsed += dt;
      time += dt;
      const motion = butterflyMotion(time, seed, wingTime);
      if (phase === 'waiting') {
        side = Math.random() > .5 ? 1 : -1;
        start = { x: side > 0 ? -90 : innerWidth + 90, y: innerHeight * (.12 + Math.random() * .2) };
        destination = { x: perch.x, y: perch.y };
        position = start; phase = 'arriving'; elapsed = 0;
        element.style.opacity = '1';
      }
      // Take off when the billboard disappears during a chapter change.
      if (phase !== 'leaving' && (!settings.current.available || !perch.node.parentElement?.closest('.is-active'))) depart();
      if (phase !== 'leaving') destination = { x: perch.x, y: perch.y };
      const old = position;
      if (phase === 'arriving') {
        const t = Math.min(1, elapsed / arrivalDuration);
        // Keep travelling until the short touchdown, rather than hovering near
        // the letter for the last half of a long ease-out.
        const touchdown = Math.max(0, (t - .82) / .18);
        const eased = t < .82 ? t : .82 + .18 * (touchdown + touchdown ** 2 - touchdown ** 3);
        position = curve(start, { x: mix(start.x, destination.x, .45), y: start.y - 110 },
          { x: destination.x - side * 50, y: destination.y - 65 }, destination, eased);
        position.x += motion.x * Math.sin(Math.PI * t);
        position.y += motion.y * Math.sin(Math.PI * t);
        if (t === 1) {
          phase = 'perched'; elapsed = 0;
        }
      } else if (phase === 'perched') {
        position = destination;
        if (startPerched ? settings.current.openingReleased : elapsed >= rest) depart();
      } else if (phase === 'leaving') {
        const t = Math.min(1, elapsed / 5);
        position = curve(start, { x: start.x + side * 100, y: start.y - 150 },
          { x: destination.x - side * 180, y: destination.y + 90 }, destination, t);
        position.x += motion.x * Math.sin(Math.PI * t);
        position.y += motion.y * Math.sin(Math.PI * t);
        if (t === 1) {
          element.style.opacity = '0';
          cancelAnimationFrame(frame);
          onComplete();
          return;
        }
      }
      const resting = phase === 'perched';
      const landing = resting ? 1 : phase === 'arriving' ? Math.max(0, (elapsed - arrivalDuration + 1) / 1) : 0;
      const flight = phase === 'leaving' ? Math.min(1, elapsed / .55) : 1 - Math.min(1, landing);
      // Wingbeats settle sooner than the body, without extending the approach.
      wingTime += dt * mix(1.6, motion.rate * Math.PI * 2, flight ** 2);
      const restingFold = 53 + Math.sin(wingTime) * 17;
      const flightBank = Math.max(-55, Math.min(55, (position.x - old.x) / Math.max(dt, .001) * .22 + motion.bank));
      const targetBank = mix(flightBank, Math.max(-90, Math.min(90, landingAngle)), Math.min(1, landing));
      bank = mix(bank, targetBank, Math.min(1, dt * 5));
      element.dataset.phase = phase;
      element.style.transform = `translate3d(${position.x}px, ${position.y}px, 0)`;
      element.style.setProperty('--butterfly-bank', `${bank}deg`);
      element.style.setProperty('--butterfly-left-fold', `${mix(restingFold, motion.left, flight)}deg`);
      element.style.setProperty('--butterfly-right-fold', `${mix(restingFold + Math.sin(time + seed) * 3, motion.right, flight)}deg`);
      element.style.setProperty('--butterfly-pitch', `${motion.pitch * flight}deg`);
      element.style.setProperty('--butterfly-yaw', `${motion.yaw * flight}deg`);
      element.style.setProperty('--butterfly-flex', `${motion.flex * flight}deg`);
      element.style.setProperty('--butterfly-abdomen', `${motion.abdomen * flight}deg`);
      element.style.setProperty('--butterfly-scale', String(mix(1, motion.scale, flight)));
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); element.style.opacity = '0'; };
  }, [perch, landingAngle, startPerched, onComplete]);

  return <div className="garden-butterfly-layer" aria-hidden="true">
    <div ref={sprite} className="garden-butterfly" data-perch={perch.key} data-color={color}>
      <ButterflyArtwork color={color} />
    </div>
  </div>;
}
