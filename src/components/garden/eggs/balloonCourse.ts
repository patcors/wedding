// Where the July 2026 balloon is through its window, and the miniature Hagia
// Sophia it rises over: pure, so it can be tested.
import { cameraPose } from '../cameraRig.ts';
import { bankEdge, groundHeight, riverCenter } from '../gardenGeometry.ts';
import { STOPS, progressAt } from '../journey.ts';
import { heightAt, inView } from './egg.ts';

const smooth = (t: number) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };
// The banks' canopies close over the river, all but one patch of sky at the
// top of the picture, over the river's next bend, just left of the date
// label. The balloon keeps to that patch: over the water, nearer than it
// looks and scaled down, fixed in the picture so it never drifts into the
// leaves. It fades in at the patch's foot and climbs out of the top, drifting
// a little left as it goes, towards the patch's far side and over the Hagia
// Sophia on the bank below. Bearings are degrees right of the middle of the
// picture, elevations degrees above the eye line; portrait's patch is higher
// and further left.
export const BALLOON_VIEW = {
  desktop: { distance: 30, scale: .5, bearing: [-11, -12.5], elevation: [15.5, 25] },
  mobile: { distance: 27, scale: .55, bearing: [-8.5, -10.5], elevation: [22.5, 35] },
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


// The Hagia Sophia, a garden miniature, stands on the left bank at the start
// of the S-bend (`z`), its middle `inland` of the water's edge and the front
// of its stone terrace a little quay at the water, below the balloon's patch
// of sky at the trip's stop, so the balloon rises over it, and on the other
// bank from the headland that hides the old tree. Larger than life, and
// larger again in portrait's wider lens. Turned to face the camera at the
// stop, and then `turn` further, so its domes and minarets show in the round.
export const HAGIA = { z: -141, inland: { desktop: 1.5, mobile: 1 }, scale: { desktop: 2.5, mobile: 2.1 }, turn: .3 } as const;
// The trip's stop, where the scroll cue lands on it.
export const tripStop = (month: string) => STOPS.find(stop => stop > progressAt(month))!;
export function hagiaSophiaSpot(month: string, width: number) {
  const mobile = width < 1, { z } = HAGIA, scale = mobile ? HAGIA.scale.mobile : HAGIA.scale.desktop;
  const x = riverCenter(z, width) - bankEdge(z, width) - (mobile ? HAGIA.inland.mobile : HAGIA.inland.desktop);
  const [cx, , cz] = cameraPose(tripStop(month), width).position;
  // Sunk to the lowest ground under its plinth, so no corner floats on the slope.
  const reach = .55 * scale;
  const y = Math.min(...[-1, 1].flatMap(dx => [-1, 1].map(dz => groundHeight(x + dx * reach, z + dz * reach * .7, width))));
  return { x, y, z, yaw: Math.atan2(cx - x, cz - z) + HAGIA.turn, scale };
}
// It comes out of the haze over the half share before the trip's date.
export const hagiaShown = (t: number) => smooth((t + .5) / .4);
