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
// sideways it turns only as far as keeps them within about 10° of the middle
// of the picture, inside portrait's narrow lens. Both compositions share the
// viewpoint; only the lens differs. Over the start of the dock chapter it
// settles on the moored catamaran, the jetty and the old tree.
export function cameraPose(p: number, width: number): CameraPose {
  const { behind, ahead, height, targetY } = GARDEN_CAMERA;
  const z = routeAt(p), near = z + behind, far = z - ahead, x = riverCenter(near, width);
  // Headings are sideways slopes: x travelled per unit downstream.
  const boats = (riverCenter(z, width) - x) / behind, river = (riverCenter(far, width) - x) / (behind + ahead);
  const heading = Math.min(boats + .18, Math.max(boats - .18, river));
  const follow: CameraPose = { position: [x, height, near], target: [x + heading * (behind + ahead), targetY, far] };
  const k = ease((p - VOYAGE_END) / (DOCKED - VOYAGE_END));
  if (k === 0) return follow;
  const dock = dockView(width);
  return { position: mix(follow.position, dock.position, k), target: mix(follow.target, dock.target, k) };
}

// The celebration's view: from upstream and a little towards the far bank,
// over the catamaran's stern quarter, so both flags read beside the jetty and
// the old tree stands to the right with its lights strung above the copy. The
// camera is placed from the mooring (`across` towards the far bank, `back`
// upstream) and looks `look` of the way from the mooring to the tree. Portrait
// sits higher and nearer behind, so the boats lie below the copy's button and
// the trunk frames the right edge.
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
