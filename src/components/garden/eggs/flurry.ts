// A flurry of snow that sweeps over a stretch of bank as a milestone's date
// shows and, as it clears, leaves something behind (see SnowReveal.tsx).
// Pure, so it can be tested.
import { cameraPose } from '../cameraRig.ts';
import { bankEdge, groundHeight, riverCenter } from '../gardenGeometry.ts';
import { ROOM, progressAt, routeAtMonth } from '../journey.ts';

// Where on the bank: `ahead`, how far past where the boats are as the date
// shows, the `side` bank (+1 is +x) and how far `inland` from the water's
// edge at desktop's width (portrait's is 60%, or `mobileInland` where given).
export type SnowSpot = { ahead: number; side: 1 | -1; inland?: number; mobileInland?: number };
// Where each snow trip's flurry falls. July 2019's is Amelia's, so on her
// bank, the left, a little ahead of the boats as its date shows, in view on
// both compositions and clear of the boats in portrait. It falls short of
// the ash with 2020 carved into it, set back from the water on desktop, below
// and to the right of the statistics carved into a tree on her bank
// (uniOrnaments.ts) in the picture once the flurry clears, and near the water
// on a phone; either way 2020's carving shows above its head as 2020 turns.
// August 2025's is on the left, a little ahead of the boats, between 2025's
// oar and the lyra's ashes, near the water on desktop. On a phone, where the
// river's bend to the left turns the camera along that bank and the boats
// sit right of the middle, it stands a little back from the water, left of
// the boats.
export const SNOW_SPOTS = { 2019: { ahead: 7.5, side: -1, inland: 1.5, mobileInland: .35 }, 2025: { ahead: 3.7, side: -1, inland: .4, mobileInland: .8 } } as const satisfies Record<number, SnowSpot>;

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
export function snowSpot({ ahead, side, inland = 1, mobileInland }: SnowSpot, month: string, width: number) {
  const z = routeAtMonth(month) - ahead;
  const x = riverCenter(z, width) + side * (bankEdge(z, width) + (width < 1 ? mobileInland ?? inland * .6 : inland));
  const [cx, , cz] = cameraPose(progressAt(month) + .2 * ROOM, width).position;
  return { x, y: groundHeight(x, z, width), z, yaw: Math.atan2(cx - x, cz - z) };
}
