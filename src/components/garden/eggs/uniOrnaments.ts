// The university years, July 2017 to August 2020, a double major in
// statistics and mathematics at UOW: still garden ornaments on the banks, seen in passing as the
// boats go by. A Möbius strip in bronze beside July 2017's π; a park picnic
// table across the river from them with Euler's identity carved into its
// top; and two old trunks across the river from each other, one carved with
// distribution curves and the other with the quadratic formula. Where each
// stands; drawn by MobiusSculpture.tsx, PicnicTable.tsx and CarvedTrunks.tsx.
// Pure, so it can be tested.
import { cameraPose } from '../cameraRig.ts';
import { bankEdge, groundHeight, riverCenter } from '../gardenGeometry.ts';
import { progressAt, routeAtMonth } from '../journey.ts';

// Each stands `ahead` units past where the boats are as its month shows, on
// its `side`'s bank (−1 is Amelia's, −x; 1 Patrick's), `inland` of the
// water's edge (a phone's narrower river brings it nearer). It turns to face
// the camera as `facing` shows, when it is best seen, so its carving reads
// then, and `turn` radians further round towards the river. Larger than life.
// A phone sees only about 17° either side of the middle, so everything on a
// bank lines up along it, and July 2017's ducks, the π and 2019's buoy leave
// little room on Patrick's: each keeps out of their way in the picture as
// well as on the ground.
// - The Möbius stands on the π's lawn, upstream of it and further from the
//   water, so it is the nearer of the two and always just outside it in the
//   picture: a pair of bronzes from the meeting until the first coast trip.
// - The table stands across the river from them at the water's edge, in view
//   from the meeting, and passed before 2018's rock is reached.
// - The trunks stand past 2019's buoy on Patrick's bank, and across from it
//   a little upstream on Amelia's, turned a touch towards each other, seen
//   from the internship until the snow trip. Amelia's stands far enough past
//   2018's candlestick posts on her bank (careerSpots.ts), and on a phone
//   close enough to the water, to show clear of their row, and short of the
//   2019 snowman (flurry.ts) and 2020's boathouse further down it.
export type Ornament = {
  side: -1 | 1; month: string; ahead: number; facing: string; turn?: number;
  inland: { desktop: number; mobile: number }; scale: { desktop: number; mobile: number };
};
export const ORNAMENTS = {
  mobius: { side: 1, month: '2017-07', ahead: 13.4, facing: '2017-09', inland: { desktop: 2.8, mobile: 1.7 }, scale: { desktop: 1.2, mobile: 1.15 } },
  table: { side: -1, month: '2017-07', ahead: 14, facing: '2017-08', inland: { desktop: 1, mobile: 0 }, scale: { desktop: 1.55, mobile: 1.75 } },
  statsTrunk: { side: -1, month: '2019-03', ahead: 5.5, facing: '2018-12', turn: .15, inland: { desktop: .6, mobile: .1 }, scale: { desktop: 1.35, mobile: 1.6 } },
  algebraTrunk: { side: 1, month: '2019-03', ahead: 7, facing: '2018-12', turn: .15, inland: { desktop: 3, mobile: 1.2 }, scale: { desktop: 1.35, mobile: 1.6 } },
} as const satisfies Record<string, Ornament>;
export type OrnamentId = keyof typeof ORNAMENTS;

export type OrnamentSpot = { x: number; y: number; z: number; yaw: number; scale: number };
// Where an ornament stands, sunk to the lowest ground under its `footprint`
// (half its width, in its own units) so no edge floats on the bank's slope,
// and its yaw (about +y) turning its face (+z in its own frame) to the camera.
export function ornamentSpot(ornament: Ornament, width: number, footprint = .5): OrnamentSpot {
  const mobile = width < 1, scale = mobile ? ornament.scale.mobile : ornament.scale.desktop;
  const z = routeAtMonth(ornament.month) - ornament.ahead;
  const reach = footprint * scale;
  const x = riverCenter(z, width) + ornament.side * (bankEdge(z, width) + (mobile ? ornament.inland.mobile : ornament.inland.desktop) + reach);
  const y = Math.min(...[-1, 1].flatMap(dx => [-1, 1].map(dz => groundHeight(x + dx * reach, z + dz * reach, width))));
  const [cx, , cz] = cameraPose(progressAt(ornament.facing), width).position;
  return { x, y, z, yaw: Math.atan2(cx - x, cz - z) - ornament.side * (ornament.turn ?? 0), scale };
}
