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
// settles on the jetty and the old tree, below the celebration text.
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

// Upstream of the jetty, on the far side of the river, looking across at the
// tree with the jetty and the moored catamaran in front of it.
export function dockView(width: number): CameraPose {
  const { jetty, tree } = voyageLandmarks(width);
  const z = jetty.z + 13;
  return {
    position: [riverCenter(z, width) - jetty.side * 1.2 * width, 3.4, z],
    target: [(jetty.x + tree.x) / 2, 3.3, (jetty.z + tree.z) / 2],
  };
}
