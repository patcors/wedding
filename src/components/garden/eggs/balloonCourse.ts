// Where the July 2026 balloon is through its window: pure, so it can be tested.
import { heightAt, inView } from './egg.ts';

const smooth = (t: number) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };
// The banks' canopies close over the river, all but one patch of sky at the
// top of the picture, over the river's next bend, just left of the date
// label. The balloon keeps to that patch: over the water, nearer than it
// looks and scaled down, fixed in the picture so it never drifts into the
// leaves. It fades in at the patch's foot and climbs straight up out of the
// top. Bearings are degrees right of the middle of the picture, elevations
// degrees above the eye line; portrait's patch is higher and further left.
export const BALLOON_VIEW = {
  desktop: { distance: 30, scale: .5, bearing: [-10.5, -10.5], elevation: [15.5, 25] },
  mobile: { distance: 27, scale: .55, bearing: [-8, -10], elevation: [22.5, 35] },
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

