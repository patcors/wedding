// Bullet, the product Patrick worked on, as a pun: a large bullet standing
// upright in the garden on his bank, the right, like a sculpture, polished
// brass with a copper tip on a low stone plinth (bulletGeometry.ts), across
// the river from the 2025 snowmen. Where it stands and when it shows; drawn
// by BulletOrnament.tsx. Pure, so it can be tested.
import { cameraPose } from '../cameraRig.ts';
import { bankEdge, groundHeight, riverCenter } from '../gardenGeometry.ts';
import { ROOM, progressAt, routeAtMonth } from '../journey.ts';
import { markerShown } from './yearMarkerSpots.ts';
import { BULLET_MODEL } from './bulletGeometry.ts';

// It stands `ahead` past where the boats are as `from` shows, on the `side`
// bank, `inland` of the water's edge: on Patrick's bank across the river from
// the snowmen (SNOW_SPOTS[2025], 3.7 ahead on the left), a little further on,
// set back from the water on desktop and near it on a phone, whose narrow
// lens loses his bank soon after the trip's date as the river starts to bend
// left (any nearer the water and its plinth would stand in it). Bullet was
// released in October 2025 and in production by October 2026; it isn't a
// milestone, so it stands there from about the snow trip's stretch:
// dissolving in over the `arrive` shares before August 2025 shows, fully in
// at the trip's date and its still, and gone once the camera has passed it,
// as the ornaments are. `size` is its height in world units, plinth to tip,
// its only size: about 1.2 times the snowmen's (2.1 tall on desktop and 2
// on a phone, grown by SNOW_GROW in flurry.ts), so it reads as a garden
// sculpture beside them. If the snowmen change size, change this with them.
export const BULLET = {
  from: '2025-08', arrive: .3,
  ahead: 5.5, side: 1, inland: { desktop: 1.2, mobile: .75 },
  size: { desktop: 2.55, mobile: 2.4 },
} as const;

export type BulletSpot = { x: number; y: number; z: number; yaw: number; scale: number };
// Where it stands: on the lowest ground under its plinth, so no corner floats
// on the bank's slope, turned to face the camera as the trip's date shows.
export function bulletSpot(width: number): BulletSpot {
  const mobile = width < 1, scale = mobile ? BULLET.size.mobile : BULLET.size.desktop;
  const z = routeAtMonth(BULLET.from) - BULLET.ahead;
  const x = riverCenter(z, width) + BULLET.side * (bankEdge(z, width) + (mobile ? BULLET.inland.mobile : BULLET.inland.desktop));
  // Its plinth's corners, whichever way it turns.
  const corner = BULLET_MODEL.plinth * Math.SQRT2 * scale;
  let y = groundHeight(x, z, width);
  for (let k = 0; k < 8; k++) y = Math.min(y, groundHeight(x + Math.cos(k * Math.PI / 4) * corner, z + Math.sin(k * Math.PI / 4) * corner, width));
  const [cx, , cz] = cameraPose(progressAt(BULLET.from), width).position;
  return { x, y, z, yaw: Math.atan2(cx - x, cz - z), scale };
}

const smooth = (t: number) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };
// How much of it shows at p, 0 to 1, with the camera at cameraZ.
export function bulletShown(spot: BulletSpot, p: number, cameraZ: number, mobile: boolean) {
  const arrived = smooth((p - progressAt(BULLET.from)) / (BULLET.arrive * ROOM) + 1);
  return Math.min(arrived, markerShown(spot.z, cameraZ, mobile));
}

// Whether a point is under its plinth, with `margin` round it, so nothing
// grows up through the stone (gardenPlantGeometry.ts).
export function bulletFootprint(width: number) {
  const spot = bulletSpot(width), cos = Math.cos(spot.yaw), sin = Math.sin(spot.yaw), half = BULLET_MODEL.plinth * spot.scale;
  return (x: number, z: number, margin = 0) => {
    const dx = x - spot.x, dz = z - spot.z;
    return Math.abs(dx * cos - dz * sin) < half + margin && Math.abs(dx * sin + dz * cos) < half + margin;
  };
}
