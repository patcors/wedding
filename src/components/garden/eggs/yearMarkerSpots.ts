// Each year from 2017 to 2027 is marked once in the scenery as the boats enter
// it, each in its own hand-made medium, so finding them is a little hunt of its
// own. Where and when each stands; drawn by YearMarkers.tsx with the models in
// yearMarkerGeometry.ts. Pure, so it can be tested.
import { cameraPose } from '../cameraRig.ts';
import { bankEdge, groundHeight, riverCenter } from '../gardenGeometry.ts';
import { ROOM, progressAt, routeAt } from '../journey.ts';
import { carvedTree, type BarkCarving, type CarvedTree } from './uniOrnaments.ts';

export type YearMedium = 'signpost' | 'rock' | 'buoy' | 'carving' | 'stake' | 'pile' | 'slate' | 'lantern' | 'oar' | 'arch' | 'heart';
// `side` is the bank (−1 is −x, Amelia's; 1 is +x, Patrick's). `lead` is how
// far downstream of the boats it stands as its year turns, so it is in clear
// view just past them then and they pass it early in the year. On a bank,
// `inland` is how far from the water's edge, in world units on desktop
// (negative stands out over the water); in the river, `share` is how far from
// the middle to that bank; `carved` into a tree's bark, it is cut into the
// riverside tree on that bank standing nearest that spot along the river,
// `arc` round its trunk either side of the face turned to the camera and
// `from` and `to` up it, in the tree's own units (see uniOrnaments.ts).
// `from`, if set, holds it back until that month shows, however near it is.
export type YearCarving = { arc: number; from: number; to: number };
export type YearMarker = { year: number; medium: YearMedium; side: -1 | 1; lead: number; from?: string } & ({ inland: number } | { share: number } | { carved: YearCarving });

// Mostly alternating banks, with the buoy and the pile out in the river, where
// a phone always sees them. 2018's stands on the left bank, across from July
// 2017's π, which is still being passed as 2018 turns, and the buoy on the
// right of the river, clear of the rock behind it. 2020 is carved into the
// trunk of an ash by the water a way past the 2019 snowman on the same bank,
// above its head in the picture as 2020 turns, before the Harbour Bridge
// comes in, and August's mortarboard lands at its foot, in front of it.
// Sydney's wide river puts its left
// bank out of a phone's picture, so 2021 and 2023 stand on the right, and
// 2022's pile stands mid-river between the boats while they are apart.
// From 2025 the river bends left and the S-bend draws the camera round
// after it, so through late 2025 and 2026 the right bank is at the edge of a
// phone's picture: 2025's oar and 2026's arch both stand on the left, the
// arch further on, past the snowmen and the lyra's ashes.
// January 2027 turns round the S-bend, so the wedding's heart stands on the
// outside of its second curve, the left bank, where the river runs straight
// at it: in the open across from the headland that hides the old tree, and
// passed before the dock comes into view. It would be in reach at the trip's
// stop, just left of the far-off Hagia Sophia in the picture, so it waits
// until the Hagia Sophia has sunk back into the haze. Bullet's rocket goes up
// across the river as October 2026 shows, and "The next chapter" waits for
// it, so the heart waits too, until it has flown and its trail has thinned,
// and dissolves in as November 2026 shows, well before December's frame of
// the two hearts.
export const YEAR_MARKERS: readonly YearMarker[] = [
  { year: 2017, medium: 'signpost', side: -1, lead: 8, inland: .45 },
  { year: 2018, medium: 'rock', side: -1, lead: 6, inland: -.1 },
  { year: 2019, medium: 'buoy', side: 1, lead: 3.5, share: .8 },
  { year: 2020, medium: 'carving', side: -1, lead: 8.6, carved: { arc: .95, from: 1.12, to: 2.12 } },
  { year: 2021, medium: 'stake', side: 1, lead: 3.5, inland: .55 },
  { year: 2022, medium: 'pile', side: 1, lead: 3, share: .85 },
  { year: 2023, medium: 'slate', side: 1, lead: 9.8, inland: .9 },
  { year: 2024, medium: 'lantern', side: 1, lead: 9.5, inland: .2 },
  { year: 2025, medium: 'oar', side: -1, lead: 4.8, inland: .3 },
  { year: 2026, medium: 'arch', side: -1, lead: 8.6, inland: .6 },
  { year: 2027, medium: 'heart', side: -1, lead: 1.5, inland: .9, from: '2026-11' },
];

// Bigger on a phone, whose wider lens draws everything smaller; a phone's
// narrower river also brings inland spots in nearer the water.
export const MARKER_SCALE = { desktop: 1, mobile: 1.3 } as const;
const MOBILE_INLAND = .6;

export const yearTurns = (year: number) => progressAt(`${year}-01`);

export type MarkerSpot = { x: number; y: number; z: number; yaw: number; scale: number };
// The tree a year is carved into, and the carving as the university years'
// are placed (uniOrnaments.ts), its face turned to the camera as the year
// turns.
export function yearCarving(marker: YearMarker & { carved: YearCarving }, width: number): { tree: CarvedTree; carving: BarkCarving } {
  const z = routeAt(yearTurns(marker.year)) - marker.lead;
  const carving = { side: marker.side, z: { desktop: z, mobile: z }, facing: `${marker.year}-01`, ...marker.carved };
  return { tree: carvedTree(carving, width), carving };
}
// The trunk's radius, near enough, in the tree's own units, where the years are carved.
const TRUNK_RADIUS = .38;
// Where a year's marker stands in the world, and its yaw (about +y) so its
// face (+z in its own frame) turns to the camera as its year turns. A
// carving's spot is the middle of the year on its trunk's face.
export function yearMarkerSpot(marker: YearMarker, width: number): MarkerSpot {
  const mobile = width < 1;
  const turn = yearTurns(marker.year);
  const [cx, , cz] = cameraPose(turn, width).position;
  if ('carved' in marker) {
    const { tree } = yearCarving(marker, width), toward = Math.atan2(cx - tree.x, cz - tree.z), r = TRUNK_RADIUS * tree.scale;
    return { x: tree.x + Math.sin(toward) * r, y: tree.y + (marker.carved.from + marker.carved.to) / 2 * tree.scale, z: tree.z + Math.cos(toward) * r, yaw: toward, scale: tree.scale };
  }
  const z = routeAt(turn) - marker.lead;
  const middle = riverCenter(z, width), edge = bankEdge(z, width);
  const x = 'share' in marker
    ? middle + marker.side * edge * marker.share
    : middle + marker.side * (edge + marker.inland * (mobile ? MOBILE_INLAND : 1));
  // On the bank it stands on the ground, never below the water.
  return { x, y: 'share' in marker ? 0 : Math.max(0, groundHeight(x, z, width)), z, yaw: Math.atan2(cx - x, cz - z),
    scale: mobile ? MARKER_SCALE.mobile : MARKER_SCALE.desktop };
}

// How much of a marker shows, 0 to 1, with the camera at cameraZ. It comes
// into view a year or so ahead of its own, rather than being seen from the far
// end of the river, dissolving in over the last `fade` of its reach (briefly,
// as a hashed fade is grainy part way), and goes once the camera has passed it.
export const MARKER_REACH = { desktop: 34, mobile: 28, fade: 3, behind: 3 } as const;
export function markerShown(z: number, cameraZ: number, mobile: boolean) {
  const ahead = cameraZ - z, reach = mobile ? MARKER_REACH.mobile : MARKER_REACH.desktop;
  if (ahead < -MARKER_REACH.behind || ahead > reach) return 0;
  return Math.min(1, (reach - ahead) / MARKER_REACH.fade);
}

// How much of something held back until a `from` month shows, at p: none
// before it, dissolving in over the ARRIVE of a share after it (briefly, as
// the hashed fade is grainy part way), so it is never part way in at
// whatever plays out before it. Without a `from`, it isn't held back.
export const ARRIVE = .15;
export const heldBack = (from: string | undefined, p: number) =>
  from ? Math.min(1, Math.max(0, (p - progressAt(from)) / (ARRIVE * ROOM))) : 1;
// How much of a year's marker shows at p: as markerShown, but held back until
// its `from` month shows.
export function yearMarkerShown(marker: YearMarker, z: number, p: number, cameraZ: number, mobile: boolean) {
  return Math.min(heldBack(marker.from, p), markerShown(z, cameraZ, mobile));
}
