// August 2020, they graduate: each tosses a mortarboard straight up off their
// boat as the date holds, and it drifts out to land on their own bank, where
// it lies until the camera has passed. Where each is tossed from and lands;
// drawn by Graduation.tsx. Pure, so it can be tested.
import { cameraPose } from '../cameraRig.ts';
import { bankEdge, groundHeight, riverCenter } from '../gardenGeometry.ts';
import { ROOM, progressAt } from '../journey.ts';
import { boatPose } from '../storyBoats.ts';
import { eggSize } from './egg.ts';

// One cap a boat: Amelia's (the −x boat) and then Patrick's, each tossed `at`
// shares after the date, while it holds, just after their UOW flags come
// down (UNIVERSITY_FLAG in storyBoats.ts). Each lands on its own boat's bank,
// `ahead` units downstream of where it was tossed, Amelia's at the foot of
// the ash with 2020 carved into it, in front of it, and `inland` of the water's edge at desktop's width (portrait's is
// `mobileInland`, Amelia's nearer the water so it stays in a phone's picture
// as the camera comes up on it, Patrick's on the higher ground). Seconds in
// the air, how high it goes above the deck, and its size: larger than life,
// and larger again in portrait's wider lens, so it reads lying in the grass.
// It comes to rest tipped `tilt` towards the camera on a tussock, so its
// board shows.
export const CAPS = {
  tosses: [{ side: -1, at: .1, ahead: 3.5, mobileInland: .3 }, { side: 1, at: .13, ahead: 3.5, mobileInland: .5 }],
  inland: .55,
  flight: 1.9, rise: 2.6,
  scale: { desktop: 1.5, mobile: 1.9 }, tilt: .5,
  // Under reduced motion both lie on the banks at graduation's still.
  settled: .4,
} as const;
export type Toss = (typeof CAPS.tosses)[number];
// Its size on this layout, grown as the bank's eggs are (eggSize in egg.ts).
export const capScale = (mobile: boolean) => eggSize(CAPS.scale, mobile);

// Where the cap is tossed from: the boat's cockpit, aft of its mast, as the
// toss's time comes. x, y, z in the world.
export function capLaunch(month: string, toss: Toss, width: number) {
  const p = progressAt(month) + toss.at * ROOM, pose = boatPose(p, width);
  // The boat's middle, across from the pair's and a little aft, turned with them.
  const across = toss.side * pose.gap * pose.scale, aft = .35 * pose.scale;
  const c = Math.cos(pose.yaw), s = Math.sin(pose.yaw);
  return { x: pose.x + c * across + s * aft, y: .55, z: pose.z - s * across + c * aft };
}

// Where it lands: on the boat's own bank, a little way downstream, lying on
// the ground. `yaw` turns it to face the camera as the date holds.
export function capLanding(month: string, toss: Toss, width: number) {
  const z = capLaunch(month, toss, width).z - toss.ahead;
  const x = riverCenter(z, width) + toss.side * (bankEdge(z, width) + (width < 1 ? toss.mobileInland : CAPS.inland));
  const [cx, , cz] = cameraPose(progressAt(month) + .2 * ROOM, width).position;
  return { x, y: groundHeight(x, z, width) + .02, z, yaw: Math.atan2(cx - x, cz - z) };
}

const smooth = (t: number) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };
// Where the cap is `air` seconds after it was tossed: straight up off the
// boat at first, then carried out over the water to fall on the bank, so it
// rises clear of the sails and comes down on land. `turn` is how far it has
// tumbled, 0 to 1: it flips over once in the air and lands the right way up.
export function capInAir(from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }, air: number) {
  const k = Math.min(1, Math.max(0, air / CAPS.flight));
  // Across slowly at first, so the toss reads as straight up.
  const out = k * k * (1.6 - .6 * k);
  const top = Math.max(from.y, to.y) + CAPS.rise;
  // Up and over: a parabola from the deck to the ground through the top.
  const y = from.y + (to.y - from.y) * k + 4 * (top - (from.y + to.y) / 2) * k * (1 - k);
  return { x: from.x + (to.x - from.x) * out, y, z: from.z + (to.z - from.z) * out, turn: smooth(k * 1.1), landed: k >= 1 };
}
