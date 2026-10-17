// How to add an Easter egg (see also docs/VOYAGE.md, "Easter eggs").
//
// 1. Register it. Add its id to `EggId` in journey.ts and set `egg` on its
//    milestone, then map the id to its component in eggs/index.tsx. Nothing
//    else mounts it; GardenScene renders every registered egg.
// 2. Time it. Each frame, read `useJourney().progress` and turn it into the
//    egg's own clock with `eggTime`: scroll since the milestone's date first
//    showed, in milestone shares (about a screen each). It is negative before
//    the date and keeps running through the date's hold, so the egg arrives on
//    its date and moves with the scroll. It may linger long after its date, as
//    long as it arrives on time.
// 3. Place it where it can be seen. The camera turns with the river, and
//    portrait sees only about 17° either side of the middle of the picture, so
//    an egg in the air is best placed relative to the camera with `inView`,
//    within about 12° of the middle for portrait and off the top-left and
//    top-centre where the date label sits. The banks' trees close over the
//    river, so the only open sky is up the river's corridor: keep an egg in
//    the air over the water with `overRiver`, nearer than it looks and scaled
//    down, rather than truly far, where the canopies would hide it. An egg on
//    a bank can use a fixed world spot instead (riverCenter/bankEdge at
//    routeAtMonth(month)), in front of the trees.
// 4. Motion. Hold idle animation (sway, flicker) while `paused`, which is also
//    set under reduced motion. Under `reduced` the camera cuts to a still at
//    each milestone's start, where eggTime is 0; pass a `settled` time so the
//    egg is shown at rest there, not at the first frame of its arrival.
// 5. Budget. Eggs are small and far: aim for one or two draw calls and well
//    under 1,500 triangles, in a geometry built once (useMemo) and disposed on
//    unmount. Hide the egg (`visible = false`) outside its window so it costs
//    nothing for the rest of the voyage, and don't cast shadows.
import { cameraPose } from '../cameraRig.ts';
import { GARDEN_CAMERA, bankEdge, riverCenter } from '../gardenGeometry.ts';
import { scrolledSince, type Milestone } from '../journey.ts';
import type { SlotProps } from '../JourneyProvider';

export type EggProps = SlotProps & { milestone: Milestone };

// The egg's clock at progress p: milestone shares scrolled since its date
// first showed. Under reduced motion, at its milestone's still it reads
// `settled`, the time of the egg's resting pose.
export function eggTime(milestone: Milestone, p: number, reduced: boolean, settled: number) {
  const t = scrolledSince(milestone.month, p);
  return reduced && Math.abs(t) < 1e-6 ? settled : t;
}

// A spot relative to the camera: `distance` ahead along the ground, `bearing`
// degrees right of the middle of the picture (negative is left) and `height`
// above the water. `follow` is how much of the camera's turning since `from`
// (a progress) the spot turns with: 1 keeps it fixed in the picture, 0 fixed
// in the world's directions, as something far away would be.
export type ViewSpot = { distance: number; bearing?: number; height?: number; from?: number; follow?: number };
type Point = [number, number, number];

// The camera's heading at p, in radians: 0 looks straight downstream (−z), positive turns right (+x).
export function cameraHeading(p: number, width: number) {
  const { position: [x, , z], target: [tx, , tz] } = cameraPose(p, width);
  return Math.atan2(tx - x, z - tz);
}

// Where to put something so it is seen at that spot in the picture at progress p.
export function inView(p: number, width: number, { distance, bearing = 0, height = 0, from = p, follow = 1 }: ViewSpot): Point {
  const { position: [x, , z] } = cameraPose(p, width);
  const now = cameraHeading(p, width), then = from === p ? now : cameraHeading(from, width);
  const heading = then + (now - then) * follow + bearing * Math.PI / 180;
  return [x + Math.sin(heading) * distance, height, z - Math.cos(heading) * distance];
}

// The height above the water that appears `elevation` degrees above the
// camera's eye line at that distance through the voyage.
export const heightAt = (distance: number, elevation: number) =>
  GARDEN_CAMERA.height + Math.tan(elevation * Math.PI / 180) * distance;

// Moves a point sideways, if need be, to keep it over the water: within
// `share` of the way from the river's middle to its banks. Trees line the
// banks, so this keeps something in the air clear of them.
export function overRiver([x, y, z]: Point, width: number, share = .5): Point {
  const middle = riverCenter(z, width), reach = bankEdge(z, width) * share;
  return [Math.min(middle + reach, Math.max(middle - reach, x)), y, z];
}
