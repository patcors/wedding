import { useEffect, useId, useRef } from 'react';
import type { ButterflyPerch } from './useGardenButterflies';
import './gardenButterfly.css';

type Point = { x: number; y: number };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const curve = (a: Point, b: Point, c: Point, d: Point, t: number): Point => {
  const u = 1 - t;
  return { x: u ** 3 * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t ** 3 * d.x,
    y: u ** 3 * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t ** 3 * d.y };
};

export default function GardenButterfly({ paused, perch, landingAngle, available, onComplete }: {
  paused: boolean; perch: ButterflyPerch; landingAngle: number; available: boolean; onComplete: () => void;
}) {
  const sprite = useRef<HTMLDivElement>(null);
  const settings = useRef({ paused, available });
  const blue = useId();
  useEffect(() => { settings.current = { paused, available }; }, [paused, available]);
  useEffect(() => {
    const element = sprite.current;
    if (!element) return;
    let frame = 0, previous = 0, elapsed = 0, wingTime = 0;
    let phase: 'waiting' | 'arriving' | 'perched' | 'leaving' = 'waiting';
    const rest = 3.5 + Math.random() * 2.5;
    let position: Point = { x: -80, y: 100 }, start = position, destination = position;
    let side = 1, bank = 0;
    const depart = () => {
      phase = 'leaving'; elapsed = 0; start = position;
      destination = { x: side > 0 ? innerWidth + 90 : -90, y: innerHeight * (.1 + Math.random() * .18) };
    };
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const dt = previous ? Math.min((now - previous) / 1000, .05) : 0;
      previous = now;
      if (settings.current.paused || document.hidden) return;
      elapsed += dt;
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
        const t = Math.min(1, elapsed / 6.5), eased = 1 - (1 - t) ** 2;
        position = curve(start, { x: mix(start.x, destination.x, .45), y: start.y - 110 },
          { x: destination.x - side * 85, y: destination.y - 100 }, destination, eased);
        position.y += Math.sin(elapsed * 5) * 15 * Math.sin(Math.PI * t);
        if (t === 1) {
          phase = 'perched'; elapsed = 0;
        }
      } else if (phase === 'perched') {
        position = destination;
        if (elapsed >= rest) depart();
      } else if (phase === 'leaving') {
        const t = Math.min(1, elapsed / 5);
        position = curve(start, { x: start.x + side * 100, y: start.y - 150 },
          { x: destination.x - side * 180, y: destination.y + 90 }, destination, t);
        position.y += Math.sin(elapsed * 6) * 12 * Math.sin(Math.PI * t);
        if (t === 1) {
          element.style.opacity = '0';
          cancelAnimationFrame(frame);
          onComplete();
          return;
        }
      }
      const resting = phase === 'perched';
      wingTime += dt * (resting ? 2.2 : 32);
      const fold = resting ? 48 + Math.sin(wingTime) * 22 : 12 + (Math.sin(wingTime) + 1) * 34;
      const flightBank = Math.max(-32, Math.min(32, (position.x - old.x) * 7));
      const landing = resting ? 1 : phase === 'arriving' ? Math.max(0, (elapsed - 5) / 1.5) : 0;
      const targetBank = mix(flightBank, Math.max(-90, Math.min(90, landingAngle)), Math.min(1, landing));
      bank = mix(bank, targetBank, Math.min(1, dt * 5));
      element.dataset.phase = phase;
      element.style.transform = `translate3d(${position.x}px, ${position.y}px, 0)`;
      element.style.setProperty('--butterfly-bank', `${bank}deg`);
      element.style.setProperty('--butterfly-fold', `${fold}deg`);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); element.style.opacity = '0'; };
  }, [perch, landingAngle, onComplete]);

  return <div className="garden-butterfly-layer" aria-hidden="true">
    <div ref={sprite} className="garden-butterfly" data-perch={perch.key}>
      <svg className="garden-butterfly-shape" viewBox="0 0 100 100" fill="none">
        <defs>
          <linearGradient id={blue} x1="49" y1="58" x2="15" y2="20" gradientUnits="userSpaceOnUse">
            <stop stopColor="#07477f" /><stop offset=".45" stopColor="#009fe9" /><stop offset=".78" stopColor="#40ccff" /><stop offset="1" stopColor="#087bd0" />
          </linearGradient>
        </defs>
        {[false, true].map(right => <g key={String(right)} transform={right ? 'translate(100 0) scale(-1 1)' : undefined}>
          <g className="garden-butterfly-wing">
            <path d="M49 49C39 27 18 6 5 10C0 21 7 43 16 51C8 58 12 73 21 77L24 91L30 78C39 82 47 68 49 57Z" fill="#101923" />
            <path d="M47 48C35 27 17 15 10 16C10 29 16 41 23 47L45 54Z" fill={`url(#${blue})`} />
            <path d="M45 56L24 52C17 59 19 69 26 72L29 80L33 72C39 73 44 65 45 56Z" fill={`url(#${blue})`} />
            <path d="M46 51L17 26M44 49L25 22M44 57L25 65M43 60L32 72" stroke="#092b46" strokeOpacity=".45" strokeWidth=".7" />
            <path d="M16 57L18 60M18 66L20 68M35 74L37 72" stroke="#b4dcde" strokeOpacity=".7" strokeWidth="1.4" />
          </g>
        </g>)}
        <path d="M48 58L43 64L40 65M52 58L57 64L60 65M48 51L43 54M52 51L57 54" stroke="#172331" strokeWidth="1" strokeLinecap="round" />
        <ellipse cx="50" cy="55" rx="2" ry="14" fill="#111e2a" />
        <ellipse cx="50" cy="45" rx="3" ry="5" fill="#233743" />
        <circle cx="50" cy="39" r="2.7" fill="#111e2a" />
        <path d="M49 38Q45 29 42 30M51 38Q55 29 58 30" stroke="#182734" strokeWidth="1" strokeLinecap="round" />
      </svg>
    </div>
  </div>;
}
