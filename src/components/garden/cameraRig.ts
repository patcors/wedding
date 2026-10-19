import { DOCKED, VOYAGE_END, routeAt } from './journey.ts';
import { GARDEN_CAMERA, riverCenter, voyageLandmarks } from './gardenGeometry.ts';

type Point = [number, number, number];
export type CameraPose = { position: Point; target: Point };

const ease = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};
const mix = (a: Point, b: Point, k: number): Point => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

// Where the camera is and looks at progress p. Through the voyage it rides
// above the river behind the boats and looks down the river past them, so it
// turns with the river through the S-bend. Where the bend swings the boats
// sideways it turns only as far as keeps them near the middle of the
// picture, inside portrait's narrow lens. Both compositions share the
// viewpoint; only the lens differs. Over the start of the dock chapter it
// settles on the moored catamaran, the jetty and the old tree.
export function cameraPose(p: number, width: number): CameraPose {
  const { behind, ahead, height, targetY } = GARDEN_CAMERA;
  const z = routeAt(p), near = z + behind, far = z - ahead, x = riverCenter(near, width);
  // Headings are sideways slopes: x travelled per unit downstream.
  const boats = (riverCenter(z, width) - x) / behind, river = (riverCenter(far, width) - x) / (behind + ahead);
  // How far the river may turn the camera off the boats: about 10°, or 6° in
  // portrait, where 10° would put the catamaran at the edge of the bend.
  const slack = width < 1 ? .1 : .18;
  const heading = Math.min(boats + slack, Math.max(boats - slack, river));
  const follow: CameraPose = { position: [x, height, near], target: [x + heading * (behind + ahead), targetY, far] };
  const k = ease((p - VOYAGE_END) / (DOCKED - VOYAGE_END));
  if (k === 0) return follow;
  const dock = dockView(width);
  return { position: mix(follow.position, dock.position, k), target: mix(follow.target, dock.target, k) };
}

// The celebration's view: from upstream and a little towards the far bank,
// over the catamaran's stern quarter, so the sail and its monogram's flag
// read beside the jetty and the old tree stands to the right with its lights
// strung above the copy. The camera is placed from the mooring (`across`
// towards the far bank, `back` upstream) and looks `look` of the way from the
// mooring to the tree. Portrait sits higher and nearer behind, so the boats
// lie below the copy's button and the trunk frames the right edge.
const DOCK_VIEW = {
  desktop: { across: 2.5, back: 7.5, height: 2.7, look: .3, lookY: 2.6 },
  mobile: { across: .4, back: 9.5, height: 4.3, look: .12, lookY: 4.3 },
};
export function dockView(width: number): CameraPose {
  const { jetty, mooring, tree } = voyageLandmarks(width);
  const view = width < 1 ? DOCK_VIEW.mobile : DOCK_VIEW.desktop;
  return {
    position: [mooring.x - jetty.side * view.across, view.height, mooring.z + view.back],
    target: [mooring.x + (tree.x - mooring.x) * view.look, view.lookY, mooring.z + (tree.z - mooring.z) * view.look],
  };
}

// The finale (see docs/VOYAGE.md): once the catamaran is moored, the camera
// rises slowly and pulls back upstream over the end of the bend to a
// three-quarter view down on the dock: the river coming round, the jetty
// with the catamaran moored at it and the guest's boat by the bank, the old
// tree with its lights, and the river running on into the dusk. Then it
// settles back on `dockView` for the copy. Placed like `dockView`: `across`
// towards the far bank from the mooring and `back` upstream, at `height`,
// looking `ahead` downstream of the mooring and `over` towards the jetty's
// bank, at `lookY`. A truly high view of the whole river showed the end of
// the land and bare ground beyond the planted banks, and looking back
// upstream saw only the canopy, so it stops here, low enough that the
// trees and the haze still close the picture. Portrait stays lower and
// nearer, under the branches of the trees over the bend.
const AERIAL_VIEW = {
  desktop: { across: 4.7, back: 15, height: 13, ahead: 16, over: 3.3, lookY: 0 },
  mobile: { across: 1.2, back: 12, height: 7.6, ahead: 13, over: 1, lookY: .8 },
};
export function aerialView(width: number): CameraPose {
  const { jetty, mooring } = voyageLandmarks(width);
  const view = width < 1 ? AERIAL_VIEW.mobile : AERIAL_VIEW.desktop;
  return {
    position: [mooring.x - jetty.side * view.across, view.height, mooring.z + view.back],
    target: [mooring.x + jetty.side * view.over, view.lookY, mooring.z - view.ahead],
  };
}

// The flight's timing, in seconds from when the boats are moored (DOCKED):
// a beat to settle, the rise, a hold at the top and the slow return. It
// plays once each time they moor, after the copy has shown (from
// VOYAGE_END), and never moves the scroll, so the copy and its timing are
// untouched and p 1 is the dock's view as it was. A guest who scrolls back
// off the mooring brings it down over `abort`. Reduced motion has no flight.
// At the top the haze starts `haze` further off, so the river reads.
export const FINALE = { delay: .8, rise: 4.5, hold: 2.2, settle: 4.5, abort: 1.2, haze: 14 } as const;
export const FINALE_LENGTH = FINALE.delay + FINALE.rise + FINALE.hold + FINALE.settle;
const smootherstep = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * x * (x * (x * 6 - 15) + 10);
};
// How far up the flight is, 0 at the dock's view to 1 at the top, `t` seconds in.
export function finaleLift(t: number) {
  const { delay, rise, hold, settle } = FINALE;
  if (t <= delay || t >= FINALE_LENGTH) return 0;
  if (t < delay + rise) return smootherstep((t - delay) / rise);
  if (t <= delay + rise + hold) return 1;
  return 1 - smootherstep((t - delay - rise - hold) / settle);
}
// The camera at progress p with the flight `lift` of the way up.
export function finalePose(p: number, width: number, lift: number): CameraPose {
  const pose = cameraPose(p, width);
  if (lift <= 0) return pose;
  const aerial = aerialView(width);
  return { position: mix(pose.position, aerial.position, lift), target: mix(pose.target, aerial.target, lift) };
}
