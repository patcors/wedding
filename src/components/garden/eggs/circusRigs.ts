// Amelia's aerial circus, on her bank (the left): an aerial silk hung from a
// riverside ash at the end of 2020, a lyra hung from a tree as her circus
// show comes round in October 2025, and beside it a little teal bird hanging
// upside down from a branch, for all her handstands. Where and when each
// hangs; drawn by Circus.tsx with the models in circusGeometry.ts. Pure, so
// it can be tested.
import { cameraPose } from '../cameraRig.ts';
import { bankEdge, groundHeight, riverCenter } from '../gardenGeometry.ts';
import { ROOM, progressAt } from '../journey.ts';
import { treeBase, treePlacements, type Placement } from '../gardenTreeSpots.ts';
import { markerShown } from './yearMarkerSpots.ts';

type Point = readonly [number, number, number];
// Each hangs from a real tree (gardenTreeSpots.ts): the one on the left bank
// standing nearest `tree` along the river, from the underside of one of its
// limbs, `limb`, a point on the bark in the tree model's own frame, so it
// turns and scales with the tree. It is fully in as `from` shows, dissolving
// in over the `arrive` shares before, turns its face to the camera then, and
// goes once the camera has passed it. Larger than life (`scale`), the bird
// most of all, so each reads; a phone's narrower lens draws them smaller, so
// larger again there. A phone sees only about 17° either side of the middle,
// so anything on a bank lines up along it with whatever else stands on that
// bank nearby: each keeps to a stretch of Amelia's bank of its own.
// - The silk hangs from an ash by the water a little past 2020's milestone,
//   planted for it where Sydney starts to widen the river, its tails
//   reaching nearly to the ground. It comes in through the autumn, after
//   graduation's mortarboards have landed, and is in the picture from
//   November 2020 into January 2021 (to Sydney's stop on desktop), a little
//   way past the Harbour Bridge's end on the same bank, so it is seen
//   beyond the bridge's arch.
// - The lyra and the bird hang from two ashes standing together past 2025's
//   snowmen, the lyra from the one further back and the bird from the tip
//   of a low limb of the one by the water, where the leaves thin out,
//   upside down, its head down and its tail up. Amelia asked for the lyra
//   about 2024, but that year her bank already holds the flower bed, both
//   birdhouses and 2025's steps, and on a phone it would hang in front of
//   the birdhouses. They come in as October 2025 shows, her circus show
//   that year, hang past the snowmen in the picture at salsa's stop and on
//   their own after, and are passed at the engagement.
export type Rig = {
  tree: { desktop: number; mobile: number }; limb: { desktop: Point; mobile: Point };
  from: string; arrive: number; scale: { desktop: number; mobile: number };
};
export const SILK: Rig = { tree: { desktop: -63.5, mobile: -63.5 }, limb: { desktop: [-2.621, 5.045, .832], mobile: [-2.621, 5.045, .832] }, from: '2020-11', arrive: .4, scale: { desktop: 1.25, mobile: 1.4 } };
export const LYRA: Rig = { tree: { desktop: -126.1, mobile: -126.62 }, limb: { desktop: [-.726, 4.42, 2.655], mobile: [2.674, 4.772, 2.162] }, from: '2025-10', arrive: .25, scale: { desktop: 1.25, mobile: 1.35 } };
export const BIRD: Rig = { tree: { desktop: -127, mobile: -127 }, limb: { desktop: [-3.332, 4.056, -.182], mobile: [-3.332, 4.056, -.182] }, from: '2025-10', arrive: .25, scale: { desktop: 3.6, mobile: 4.6 } };
export const RIGS = { silk: SILK, lyra: LYRA, bird: BIRD } as const;
export type RigId = keyof typeof RIGS;

// The tree it hangs from: the tree on the left bank standing nearest `tree`
// along the river.
export function rigTree(rig: Rig, width: number): Placement {
  const z = width < 1 ? rig.tree.mobile : rig.tree.desktop;
  const left = treePlacements(width, width < 1).filter(t => t.type < 4 && t.x < riverCenter(t.z, width) - bankEdge(t.z, width));
  return left.reduce((best, t) => Math.abs(t.z - z) < Math.abs(best.z - z) ? t : best);
}

// A point in a tree's own frame, in the world.
export function onTree(tree: Placement, [lx, ly, lz]: Point, width: number) {
  const c = Math.cos(tree.rotation), s = Math.sin(tree.rotation), k = tree.scale;
  return { x: tree.x + (lx * c + lz * s) * k, y: treeBase(tree, width) + ly * k, z: tree.z + (-lx * s + lz * c) * k };
}

export type HangSpot = { x: number; y: number; z: number; ground: number; yaw: number; scale: number };
// Where it hangs from in the world, the ground (or water) beneath it, and its
// yaw (about +y) turning its face (+z in its own frame) to the camera.
export function hangSpot(rig: Rig, width: number): HangSpot {
  const mobile = width < 1;
  const { x, y, z } = onTree(rigTree(rig, width), mobile ? rig.limb.mobile : rig.limb.desktop, width);
  const [cx, , cz] = cameraPose(progressAt(rig.from), width).position;
  return { x, y, z, ground: Math.max(0, groundHeight(x, z, width)), yaw: Math.atan2(cx - x, cz - z), scale: mobile ? rig.scale.mobile : rig.scale.desktop };
}

// How much of it shows at p, 0 to 1, with the camera at cameraZ.
export function rigShown(rig: Rig, spot: HangSpot, p: number, cameraZ: number, mobile: boolean) {
  const arrived = Math.min(1, Math.max(0, (p - progressAt(rig.from)) / (rig.arrive * ROOM) + 1));
  return Math.min(arrived, markerShown(spot.z, cameraZ, mobile));
}
