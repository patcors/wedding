// Each year from 2017 to 2026 is marked once in the scenery as the boats enter
// it, each in its own hand-made medium, so finding them is a little hunt of its
// own. Where and when each stands; drawn by YearMarkers.tsx with the models in
// yearMarkerGeometry.ts. Pure, so it can be tested.
import { cameraPose } from '../cameraRig.ts';
import { bankEdge, groundHeight, riverCenter } from '../gardenGeometry.ts';
import { progressAt, routeAt } from '../journey.ts';

export type YearMedium = 'signpost' | 'rock' | 'buoy' | 'shed' | 'stake' | 'pile' | 'slate' | 'lantern' | 'steps' | 'arch';
// `side` is the bank (−1 is −x, Amelia's; 1 is +x, Patrick's). `lead` is how
// far downstream of the boats it stands as its year turns, so it is in clear
// view just past them then and they pass it early in the year. On a bank,
// `inland` is how far from the water's edge, in world units on desktop
// (negative stands out over the water); in the river, `share` is how far from
// the middle to that bank.
export type YearMarker = { year: number; medium: YearMedium; side: -1 | 1; lead: number } & ({ inland: number } | { share: number });

// Mostly alternating banks, with the buoy and the pile out in the river, where
// a phone always sees them. 2018's stands on the left bank, across from July
// 2017's π, which is still being passed as 2018 turns, and the buoy on the
// right of the river, clear of the rock behind it. 2020's boathouse stands a
// way past the 2019 snowman across the river, so August's mortarboards land
// in front of it rather than behind it. Sydney's wide river puts its left
// bank out of a phone's picture, so 2021 and 2023 stand on the right, and
// 2022's pile stands mid-river between the boats while they are apart.
export const YEAR_MARKERS: readonly YearMarker[] = [
  { year: 2017, medium: 'signpost', side: -1, lead: 8, inland: .45 },
  { year: 2018, medium: 'rock', side: -1, lead: 6, inland: -.1 },
  { year: 2019, medium: 'buoy', side: 1, lead: 3.5, share: .8 },
  { year: 2020, medium: 'shed', side: -1, lead: 9, inland: .55 },
  { year: 2021, medium: 'stake', side: 1, lead: 3.5, inland: .55 },
  { year: 2022, medium: 'pile', side: 1, lead: 3, share: .85 },
  { year: 2023, medium: 'slate', side: 1, lead: 9.8, inland: .9 },
  { year: 2024, medium: 'lantern', side: 1, lead: 9.5, inland: .2 },
  { year: 2025, medium: 'steps', side: -1, lead: 3.5, inland: .15 },
  { year: 2026, medium: 'arch', side: 1, lead: 4, inland: .6 },
];

// Bigger on a phone, whose wider lens draws everything smaller; a phone's
// narrower river also brings inland spots in nearer the water.
export const MARKER_SCALE = { desktop: 1, mobile: 1.3 } as const;
const MOBILE_INLAND = .6;

export const yearTurns = (year: number) => progressAt(`${year}-01`);

export type MarkerSpot = { x: number; y: number; z: number; yaw: number; scale: number };
// Where a year's marker stands in the world, and its yaw (about +y) so its
// face (+z in its own frame) turns to the camera as its year turns.
export function yearMarkerSpot(marker: YearMarker, width: number): MarkerSpot {
  const mobile = width < 1;
  const turn = yearTurns(marker.year);
  const z = routeAt(turn) - marker.lead;
  const middle = riverCenter(z, width), edge = bankEdge(z, width);
  const x = 'share' in marker
    ? middle + marker.side * edge * marker.share
    : middle + marker.side * (edge + marker.inland * (mobile ? MOBILE_INLAND : 1));
  const [cx, , cz] = cameraPose(turn, width).position;
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
