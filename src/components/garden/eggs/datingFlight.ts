// August 2024, they start dating: as the boats come together and the first
// crossbeams go across, butterflies fly out of the trees and circle the boats,
// a teal and a yellow one (Amelia's and Patrick's colours) dancing round each
// other, with two companions further out. The companions leave first, then
// the pair drifts off up the river. Drawn by DatingButterflies.tsx. Pure, so
// it can be tested.
import { DATES, scrolledSince } from '../journey.ts';
import type { ButterflyColor } from '../butterflyColors.ts';

// In milestone shares since the date first shows: they arrive over `arrive`,
// circle, and leave over `leave`, all before August 2025's snow trip (about
// 1.14 shares on).
type Window = { arrive: readonly [number, number]; leave: readonly [number, number] };
// A circle round the boats, in the boats' frame (x to Patrick's side, y up,
// −z towards the bows): `radius` across, stretched along the hulls by
// `stretch`, at `height` above the water, `speed` radians a second (negative
// is clockwise seen from above), starting at `phase`.
type Orbit = { radius: number; stretch: number; height: number; speed: number; phase: number };
export type Flyer = Window & { colour: ButterflyColor; orbit: Orbit;
  // The pair's partners dance round each other on either side of their shared circle.
  partner?: -1 | 1;
  // Where it comes from in the trees and where it leaves to, in the boats' frame.
  from: Point; to: Point };
export type Point = [number, number, number];

const PAIR_ORBIT: Orbit = { radius: 1.45, stretch: 1.25, height: 1.25, speed: .55, phase: 2.4 };
export const FLYERS: readonly Flyer[] = [
  { colour: 'turquoise', partner: -1, orbit: PAIR_ORBIT, arrive: [-.1, .4], leave: [.8, 1.12], from: [-6.5, 3.2, -7], to: [3.5, 4.2, -11] },
  { colour: 'butter', partner: 1, orbit: PAIR_ORBIT, arrive: [-.1, .4], leave: [.8, 1.12], from: [-6.5, 3.2, -7], to: [3.5, 4.2, -11] },
  { colour: 'pink', orbit: { radius: 2, stretch: 1.1, height: .95, speed: -.42, phase: 1 }, arrive: [.05, .5], leave: [.5, .85], from: [6.5, 2.8, -5], to: [6.5, 3.8, -8] },
  { colour: 'purple', orbit: { radius: 1.15, stretch: 1.4, height: 1.75, speed: .7, phase: 4.2 }, arrive: [.1, .5], leave: [.5, .88], from: [5.5, 3.5, -9], to: [-6, 3.6, -7] },
];
// How far apart the pair's partners circle each other, and how fast.
export const DANCE = { radius: .17, speed: 2.5 } as const;

const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};
const mix = (a: Point, b: Point, k: number): Point => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

// The butterflies' clock: shares scrolled since they start dating.
export const courtshipTime = (p: number) => scrolledSince(DATES.dating, p);
export const flying = (flyer: Flyer, t: number) => t > flyer.arrive[0] && t < flyer.leave[1];

// Where a butterfly is in the boats' frame, `s` seconds into its flight (idle
// time, held while paused) and `t` shares since the date: out of the trees
// onto its circle, round the boats, then away.
export function flightPoint(flyer: Flyer, s: number, t: number): Point {
  const { radius, stretch, height, speed, phase } = flyer.orbit;
  const a = phase + speed * s, r = radius * (1 + .12 * Math.sin(s * .8 + phase));
  let circle: Point = [Math.cos(a) * r, height + .28 * Math.sin(s * 1.1 + phase), Math.sin(a) * r * stretch];
  if (flyer.partner) {
    const b = DANCE.speed * s + (flyer.partner > 0 ? Math.PI : 0);
    circle = [circle[0] + Math.cos(b) * DANCE.radius, circle[1] + Math.sin(b * 1.3) * .07, circle[2] + Math.sin(b) * DANCE.radius];
  }
  const arrive = smooth((t - flyer.arrive[0]) / (flyer.arrive[1] - flyer.arrive[0]));
  const leave = smooth((t - flyer.leave[0]) / (flyer.leave[1] - flyer.leave[0]));
  // A gentle wander on the way in and out, so they don't fly in straight lines.
  const wander = Math.sin(Math.PI * Math.max(1 - arrive, leave)) * .5;
  const from: Point = [flyer.from[0], flyer.from[1] + Math.sin(s * 1.7) * wander, flyer.from[2]];
  const to: Point = [flyer.to[0] + Math.sin(s * 1.3) * wander, flyer.to[1], flyer.to[2]];
  return mix(mix(from, circle, arrive), to, leave);
}

// Under reduced motion, at dating's still, the pair rest side by side on the
// bows, each on the other's boat, wings half raised; the companions aren't
// there. In the boats' frame, from the hulls' half-gap (world units).
export function perch(flyer: Flyer, gap: number): Point | null {
  if (!flyer.partner) return null;
  return [-flyer.partner * (gap - .2), .2, -.55];
}
