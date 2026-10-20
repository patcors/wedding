// The university years, July 2017 to August 2020, a double major in
// statistics and mathematics at UOW: still garden ornaments on the banks, seen
// in passing as the boats go by. A Möbius strip in bronze across the river
// from July 2017's π; a plain wooden park bench back among the trees on the
// π's bank; and two of the riverside trees, one on each bank, with
// distribution curves and the quadratic formula carved into their bark. Where
// each is; drawn by MobiusSculpture.tsx, ParkBench.tsx and BarkCarvings.tsx.
// Pure, so it can be tested.
import { cameraPose } from '../cameraRig.ts';
import { bankEdge, groundHeight, riverCenter } from '../gardenGeometry.ts';
import { TREE_SINK, treePlacements } from '../gardenTreeSpots.ts';
import { progressAt, routeAtMonth } from '../journey.ts';
import { heldBack, markerShown } from './yearMarkerSpots.ts';
import { eggSize, growth } from './egg.ts';

// Each stands `ahead` units past where the boats are as its month shows, on
// its `side`'s bank (−1 is Amelia's, −x; 1 Patrick's), `inland` of the
// water's edge (a phone's narrower river brings it nearer). It turns to face
// the camera as `facing` shows, when it is best seen, and `turn` radians
// further round towards the river. Larger than life.
// A phone sees only about 17° either side of the middle, so everything on a
// bank lines up along it, and July 2017's ducks (on Amelia's bank on desktop,
// Patrick's in portrait), the π and 2018's rock leave little room: each keeps
// out of their way in the picture as well as on the ground.
// - The Möbius stands on Amelia's bank across the river from the π, a little
//   upstream of it and short of 2018's rock, so the two bronzes face each
//   other over the water from the meeting until the first coast trip.
// - The bench stands back among the trees on the π's bank, upstream of it and
//   further from the water, turned to look out over the river.
export type Ornament = {
  side: -1 | 1; month: string; ahead: number; facing: string; turn?: number;
  inland: { desktop: number; mobile: number }; scale: { desktop: number; mobile: number }; grow?: { desktop?: number; mobile?: number };
};
export const ORNAMENTS = {
  mobius: { side: -1, month: '2017-07', ahead: 15.2, facing: '2017-09', inland: { desktop: .9, mobile: .2 }, scale: { desktop: 1.2, mobile: 1.15 } },
  bench: { side: 1, month: '2017-07', ahead: 13.6, facing: '2017-09', turn: .5, inland: { desktop: 4.3, mobile: 1 }, scale: { desktop: 1.3, mobile: 1.4 }, grow: { desktop: 1.12, mobile: 1.15 } },
} as const satisfies Record<string, Ornament>;
export type OrnamentId = keyof typeof ORNAMENTS;

export type OrnamentSpot = { x: number; y: number; z: number; yaw: number; scale: number };
// Where an ornament stands, sunk to the lowest ground under its `footprint`
// (half its width, in its own units) so no edge floats on the bank's slope,
// and its yaw (about +y) turning its face (+z in its own frame) to the camera.
export function ornamentSpot(ornament: Ornament, width: number, footprint = .5): OrnamentSpot {
  const mobile = width < 1, scale = eggSize(ornament.scale, mobile, ornament.grow);
  const z = routeAtMonth(ornament.month) - ornament.ahead;
  const reach = footprint * scale;
  const x = riverCenter(z, width) + ornament.side * (bankEdge(z, width) + (mobile ? ornament.inland.mobile : ornament.inland.desktop) + reach);
  const y = Math.min(...[-1, 1].flatMap(dx => [-1, 1].map(dz => groundHeight(x + dx * reach, z + dz * reach, width))));
  const [cx, , cz] = cameraPose(progressAt(ornament.facing), width).position;
  return { x, y, z, yaw: Math.atan2(cx - x, cz - z) - ornament.side * (ornament.turn ?? 0), scale };
}

// The carvings are cut into the bark of real trees from gardenTreeSpots.ts,
// small, like initials cut into a trunk: statistics on Amelia's bank and
// algebra on Patrick's, seen from the internship into 2019. Each is on the
// riverside tree on its `side` nearest `z` (trees stand where they stand,
// whatever the story's timing), on the face of the trunk turned to the
// camera as `facing` shows. `arc` is how far round the trunk it reaches
// either side of that, in radians, and it runs `from` and `to` heights up
// the trunk, in the tree's own units.
// - Amelia's tree stands a little past her candlestick posts, and its
//   carving is high on the trunk, so it shows above the row's river end at
//   the internship and clear of it through 2019, upstream of the 2019
//   snowman and clear of it once its flurry has gone.
// - Patrick's stands a little past 2019's buoy, well above it in the picture.
// A phone's narrower river moves the trees, and its narrow lens sees a
// riverside trunk only from well up the river, so there each is on the
// avenue's nearest tree on its bank, seen small through 2018.
// Four more are found further down the river, each in a quiet stretch of its
// own, cut a little larger as they are seen from further off:
// - A little sloop on Amelia's bank before they meet, while each boat has
//   its own channel.
// - A golden spiral, over the squares it grows from, on Patrick's bank
//   through 2021, while Amelia is in Sydney. Not on a phone (`mobile` null),
//   whose narrow lens would see it only far off, past 2021's stake.
// - Two little sloops side by side on Patrick's bank, as the boats come back
//   alongside in March 2023. Not on a phone (`mobile` null), where its tree
//   was seen only far off, a few pixels across, at the picture's edge, and
//   2023's slate now stands on the bank right in front of it (see
//   yearMarkerSpots.ts).
// - A heart with P + A cut inside it on the headland in the S-bend, nearest
//   as the wedding comes, across the river from 2027's heart. Its tree is
//   near the middle of the picture from the trip on, so it is held back
//   (`after`) and dissolves in with 2027's heart, as November 2026 shows, so
//   the two hearts arrive as a pair.
// `after`, if set, holds a carving back until that month shows, however near
// its tree is, as a year marker's `from` does (heldBack in yearMarkerSpots.ts).
export type BarkCarving = { side: -1 | 1; z: { desktop: number; mobile: number | null }; facing: string; arc: number; from: number; to: number; after?: string };
export const CARVINGS = {
  stats: { side: -1, z: { desktop: -45, mobile: -37 }, facing: '2019-05', arc: .7, from: .98, to: 1.54 },
  algebra: { side: 1, z: { desktop: -45.6, mobile: -43 }, facing: '2019-03', arc: 1, from: .4, to: .92 },
  sloop: { side: -1, z: { desktop: -17, mobile: -17 }, facing: '2017-05', arc: .95, from: .9, to: 1.72 },
  spiral: { side: 1, z: { desktop: -82.5, mobile: null }, facing: '2022-01', arc: 1, from: .9, to: 1.4 },
  sloops: { side: 1, z: { desktop: -95, mobile: null }, facing: '2023-01', arc: 1, from: .9, to: 1.42 },
  heart: { side: 1, z: { desktop: -157.2, mobile: -157.2 }, facing: '2027-01', arc: .85, from: 1.3, to: 1.9, after: '2026-11' },
} as const satisfies Record<string, BarkCarving>;
export type CarvingId = keyof typeof CARVINGS;
// A carving as it is cut on this layout: grown as the bank's eggs are
// (EGG_GROWTH in egg.ts), up the trunk from where its foot was (so it stays
// above whatever stands in front of the tree), but only so far
// round its trunk: past about `CARVED_ARC` radians either side of the face it
// wraps out of sight, so it grows round the trunk to there at most and up it
// as much as it then looks wider (the sine of its reach), keeping its shape.
// A trunk's girth is the limit, so carvings grow less than the other eggs.
export const CARVED_ARC = 1.2;
export type Cut = { arc: number; from: number; to: number };
export function grownCut<T extends Cut>(cut: T, width: number): T {
  const arc = Math.min(cut.arc * growth(width < 1), Math.max(cut.arc, CARVED_ARC));
  return { ...cut, arc, to: cut.from + (cut.to - cut.from) * Math.sin(arc) / Math.sin(cut.arc) };
}
// Trees within this of the water: the avenue and the groves' inner row.
const RIVERSIDE = 7;

export type CarvedTree = { x: number; y: number; z: number; rotation: number; scale: number; type: number };
// Whether a carving is cut on this layout.
export const carvedOn = (carving: BarkCarving, width: number) => width >= 1 || carving.z.mobile !== null;
// The tree a carving is cut into, as GardenTrees places it (its foot TREE_SINK under the ground).
export function carvedTree(carving: BarkCarving, width: number): CarvedTree {
  const mobile = width < 1, z = (mobile ? carving.z.mobile : null) ?? carving.z.desktop;
  const riverside = treePlacements(width, mobile).filter(tree => tree.y === undefined && tree.type < 4
    && Math.sign(tree.x - riverCenter(tree.z, width)) === carving.side
    && Math.abs(tree.x - riverCenter(tree.z, width)) - bankEdge(tree.z, width) < RIVERSIDE);
  const tree = riverside.reduce((best, tree) => Math.abs(tree.z - z) < Math.abs(best.z - z) ? tree : best);
  return { x: tree.x, y: groundHeight(tree.x, tree.z, width) - TREE_SINK, z: tree.z, rotation: tree.rotation, scale: tree.scale, type: tree.type };
}
// Where the camera is as the carving's month shows: its face turns to it.
export const carvingFaces = (carving: BarkCarving, width: number) => {
  const [x, , z] = cameraPose(progressAt(carving.facing), width).position;
  return { x, z };
};
// How much of a carving shows with the camera at cameraZ: as the year
// markers, but from desktop's reach on a phone too, as a phone sees its tree
// only from that far. The tree is always there, so nothing appears from
// nowhere. A carving held back until a month (`after`) shows none before it
// at progress p.
export const carvingShown = (tree: CarvedTree, cameraZ: number, p = 0, after?: string) => Math.min(heldBack(after, p), markerShown(tree.z, cameraZ, false));
