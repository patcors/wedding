// Where the July 2026 balloon is through its window, and the miniature Hagia
// Sophia it rises over: pure, so it can be tested.
import { cameraPose } from '../cameraRig.ts';
import { groundHeight, lawnSpot } from '../gardenGeometry.ts';
import { STOPS, progressAt } from '../journey.ts';
import { heightAt, inView } from './egg.ts';
import { HAGIA_SOPHIA } from './hagiaSophiaGeometry.ts';

const smooth = (t: number) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };
// The banks' canopies close over the river, all but one patch of sky at the
// top of the picture, over the river's next bend, just left of the date
// label. The balloon keeps to that patch: over the water, nearer than it
// looks and scaled down, fixed in the picture so it never drifts into the
// leaves. It fades in at the patch's foot and climbs out of the top, drifting
// a little left as it goes, towards the patch's far side and over the Hagia
// Sophia on the bank below. Bearings are degrees right of the middle of the
// picture, elevations degrees above the eye line; portrait's patch is higher
// and further left, just under the header's monogram, so there it starts a
// little lower and at the trip's stop hangs clear below the monogram.
export const BALLOON_VIEW = {
  desktop: { distance: 30, scale: .5, bearing: [-11, -12.5], elevation: [15.5, 25] },
  mobile: { distance: 27, scale: .55, bearing: [-8.2, -10.2], elevation: [21, 35] },
} as const;
// Its course in milestone shares since the date: it fades in over ARRIVE,
// climbs until CLIMB, by when it is out of the top of the picture, and is
// gone by GONE. Under reduced motion it rests just risen, at SETTLED.
export const BALLOON_TIMES = { arrive: .35, climb: 1.6, gone: 1.8, settled: .3 };
// Where the balloon is at progress p, `t` shares after its date: the spot it
// hangs from (the envelope's mouth) and its scale.
export function balloonSpot(p: number, t: number, mobile: boolean, width: number) {
  const view = mobile ? BALLOON_VIEW.mobile : BALLOON_VIEW.desktop;
  const [from, to] = view.bearing, [low, high] = view.elevation;
  const rise = smooth(t / BALLOON_TIMES.climb);
  const [x, , z] = inView(p, width, { distance: view.distance, bearing: from + (to - from) * rise });
  return { position: [x, heightAt(view.distance, low + (high - low) * rise), z] as [number, number, number], scale: view.scale };
}


// The Hagia Sophia, a garden miniature, stands on the level lawn cut into the
// left bank at the start of the S-bend (`VOYAGE.lawn` in gardenGeometry.ts),
// a little back from the water, below the balloon's patch of sky at the
// trip's stop, so the balloon rises over it, and on the other bank from the
// headland that hides the old tree. Larger than life; smaller in portrait,
// whose narrow picture has room for it only close by the water. Turned to
// face the camera at the stop, and then `turn` further, so its domes and
// minarets show in the round.
export const HAGIA = { scale: { desktop: 2.5, mobile: 1.6 }, turn: { desktop: .3, mobile: .1 } } as const;
// The trip's stop, where the scroll cue lands on it.
export const tripStop = (month: string) => STOPS.find(stop => stop > progressAt(month))!;
// The corners of its terrace on the ground, from its spot.
export function hagiaCorners({ x, z, yaw, scale }: { x: number; z: number; yaw: number; scale: number }) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([i, k]) => {
    const lx = i * HAGIA_SOPHIA.width / 2 * scale, lz = k * HAGIA_SOPHIA.depth / 2 * scale;
    return [x + c * lx + s * lz, z - s * lx + c * lz] as [number, number];
  });
}
export function hagiaSophiaSpot(month: string, width: number) {
  const mobile = width < 1, { x, z } = lawnSpot(width);
  const scale = mobile ? HAGIA.scale.mobile : HAGIA.scale.desktop, turn = mobile ? HAGIA.turn.mobile : HAGIA.turn.desktop;
  const [cx, , cz] = cameraPose(tripStop(month), width).position;
  const spot = { x, y: 0, z, yaw: Math.atan2(cx - x, cz - z) + turn, scale };
  // Seated on the highest ground under its terrace, which is level there, so
  // none of it sinks into the lawn.
  const [a, b, , d] = hagiaCorners(spot), heights: number[] = [];
  for (let i = 0; i <= 4; i++) for (let k = 0; k <= 4; k++) {
    heights.push(groundHeight(a[0] + (d[0] - a[0]) * i / 4 + (b[0] - a[0]) * k / 4, a[1] + (d[1] - a[1]) * i / 4 + (b[1] - a[1]) * k / 4, width));
  }
  return { ...spot, y: Math.max(...heights) };
}
// It comes out of the haze over the half share before the trip's date.
export const hagiaShown = (t: number) => smooth((t + .5) / .4);
