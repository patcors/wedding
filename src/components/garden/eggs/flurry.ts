// A flurry of snow that sweeps over a stretch of bank as a milestone's date
// shows and, as it clears, leaves something behind (see SnowReveal.tsx).
// Pure, so it can be tested.
import { cameraPose } from '../cameraRig.ts';
import { bankEdge, groundHeight, riverCenter } from '../gardenGeometry.ts';
import { ROOM, progressAt, routeAtMonth } from '../journey.ts';

// Where on the bank: `ahead`, how far past where the boats are as the date
// shows, the `side` bank (+1 is +x) and how far `inland` from the water's
// edge at desktop's width (portrait's is 60%).
export type SnowSpot = { ahead: number; side: 1 | -1; inland?: number };
// Where each snow trip's flurry falls. July 2019's is on the right bank, a
// little ahead of the boats as its date shows, in view on both compositions
// and clear of the boats in portrait. August 2025's is on the left, across
// the river from the second pair of birdhouses, and a little nearer, so in a
// phone's narrow river it stands well short of 2026's arch.
export const SNOW_SPOTS = { 2019: { ahead: 9, side: 1 }, 2025: { ahead: 6.5, side: -1 } } as const satisfies Record<number, SnowSpot>;

// Its course in milestone shares since the date (see eggTime): the flurry
// thickens from 0 to `full`, hides the bank while what it leaves behind
// appears from `reveal`, thins from `clear` and is gone by `gone`, all while
// the date holds or just after. The settled snow on the bank comes with it.
export const FLURRY = { full: .16, reveal: .2, clear: .34, gone: .7 };
const smooth = (t: number) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };
// How thick the flurry is, 0 to 1.
export const flurryAt = (t: number) => smooth(t / FLURRY.full) * (1 - smooth((t - FLURRY.clear) / (FLURRY.gone - FLURRY.clear)));
export const revealed = (t: number) => t >= FLURRY.reveal;
// How far the gust has carried the flurry along the bank, −1 to 1: it blows
// in from upstream and out downstream.
export const gustAt = (t: number) => -1 + 2 * smooth(t / FLURRY.gone);

// The spot in the world: on the ground, turned to face the boats' approach
// as the date holds.
export function snowSpot({ ahead, side, inland = 1 }: SnowSpot, month: string, width: number) {
  const z = routeAtMonth(month) - ahead;
  const x = riverCenter(z, width) + side * (bankEdge(z, width) + inland * (width < 1 ? .6 : 1));
  const [cx, , cz] = cameraPose(progressAt(month) + .2 * ROOM, width).position;
  return { x, y: groundHeight(x, z, width), z, yaw: Math.atan2(cx - x, cz - z) };
}
