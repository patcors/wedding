// Where the July 2026 balloons are through their window, and the Hagia
// Sophia far off below them: pure, so it can be tested.
import { cameraPose } from '../cameraRig.ts';
import { groundHeight, lawnSpot } from '../gardenGeometry.ts';
import { STOPS, progressAt } from '../journey.ts';
import { heightAt, inView } from './egg.ts';
import { HAGIA_SOPHIA } from './hagiaSophiaGeometry.ts';

const smooth = (t: number) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };
// The banks' canopies close over the river, all but one patch of sky at the
// top of the picture, over the river's next bend, just left of the date
// label. The balloons keep to that patch: over the water, nearer than they
// look and scaled down, fixed in the picture so they never drift into the
// leaves. They fade in at the patch's foot and climb, drifting a little left
// as they go. The first, the nearest, climbs out of the top, over the Hagia
// Sophia far off down the river below; the others, further off and smaller,
// a little festival over the land round it, start to rise one after another
// (`lag`, in shares after the date) and climb less far, so they are still
// rising as they go.
// Bearings are degrees right of the middle of the picture, elevations degrees
// above the eye line. Portrait's patch is higher and narrower, between the
// header's monogram (top left, its foot 3.5° below the top of the picture),
// the canopy on the left and the date label, so there the first starts a
// little lower and at the trip's stop hangs clear below the monogram, and
// there is room for only two of the others (`mobile` null: not flown).
type BalloonView = { distance: number; scale: number; bearing: [number, number]; elevation: [number, number] };
export const BALLOONS: readonly { lag: number; desktop: BalloonView; mobile: BalloonView | null }[] = [
  { lag: 0, desktop: { distance: 30, scale: .5, bearing: [-11, -12.5], elevation: [15.5, 25] }, mobile: { distance: 27, scale: .6, bearing: [-8.4, -9.8], elevation: [21, 35] } },
  { lag: .1, desktop: { distance: 38, scale: .45, bearing: [-14.6, -15], elevation: [13.5, 17] }, mobile: { distance: 36, scale: .4, bearing: [-12.4, -12.8], elevation: [24, 27] } },
  { lag: .2, desktop: { distance: 44, scale: .42, bearing: [-9.4, -9.6], elevation: [18.5, 21.5] }, mobile: { distance: 42, scale: .4, bearing: [-5.4, -5.6], elevation: [26, 28.5] } },
  { lag: .3, desktop: { distance: 50, scale: .38, bearing: [-13, -13.3], elevation: [19, 21] }, mobile: null },
];
// Their course in milestone shares since the date: they fade in over ARRIVE,
// climb until CLIMB, by when the first is out of the top of the picture, and
// are gone by GONE. Under reduced motion they rest just risen, at SETTLED.
export const BALLOON_TIMES = { arrive: .35, climb: 1.6, gone: 1.8, settled: .3 };
// Where balloon `index` is at progress p, `t` shares after its date: the spot
// it hangs from (the envelope's mouth) and its scale; null where it isn't flown.
export function balloonSpot(p: number, t: number, mobile: boolean, width: number, index = 0) {
  const { lag, ...views } = BALLOONS[index], view = mobile ? views.mobile : views.desktop;
  if (!view) return null;
  const [from, to] = view.bearing, [low, high] = view.elevation;
  const rise = smooth((t - lag) / (BALLOON_TIMES.climb - lag));
  const [x, , z] = inView(p, width, { distance: view.distance, bearing: from + (to - from) * rise });
  return { position: [x, heightAt(view.distance, low + (high - low) * rise), z] as [number, number, number], scale: view.scale };
}

// The Hagia Sophia stands far off down the river, a landmark beyond the
// S-bend, on a level lawn in a field back from the left bank where the river
// runs straight again (`VOYAGE.lawn` in gardenGeometry.ts), so at the trip's
// stop it is seen down the river past the bend, below the balloons' patch of
// sky, and the balloons rise over the land round it. Trees keep off the
// field (`lawnSpot(width).field`), so none stands in front of it. Many times
// life, to read at about 80 units, and softened by its own `haze`; smaller in
// portrait, whose narrow picture has room for it only at its left, beside
// the headland that hides the old tree. Turned to face the camera at the
// stop, and then `turn` further, so its domes and minarets show in the round.
export const HAGIA = { scale: { desktop: 10, mobile: 7 }, turn: .3, haze: .25 } as const;
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
  const scale = mobile ? HAGIA.scale.mobile : HAGIA.scale.desktop;
  const [cx, , cz] = cameraPose(tripStop(month), width).position;
  const spot = { x, y: 0, z, yaw: Math.atan2(cx - x, cz - z) + HAGIA.turn, scale };
  // Seated on the highest ground under its terrace, which is level there, so
  // none of it sinks into the lawn.
  const [a, b, , d] = hagiaCorners(spot), heights: number[] = [];
  for (let i = 0; i <= 4; i++) for (let k = 0; k <= 4; k++) {
    heights.push(groundHeight(a[0] + (d[0] - a[0]) * i / 4 + (b[0] - a[0]) * k / 4, a[1] + (d[1] - a[1]) * i / 4 + (b[1] - a[1]) * k / 4, width));
  }
  return { ...spot, y: Math.max(...heights) };
}
// It comes out of the haze over the half share before the trip's date and
// sinks back into it as the balloons climb away round the bend, gone before
// 2027's heart comes in (see yearMarkerSpots.ts) and long before the dock,
// where it would stand at the edge of the picture.
export const HAGIA_TIMES = { arrive: -.5, shown: -.1, leave: 1.2, gone: 1.6 };
export const hagiaShown = (t: number) =>
  smooth((t - HAGIA_TIMES.arrive) / (HAGIA_TIMES.shown - HAGIA_TIMES.arrive)) * (1 - smooth((t - HAGIA_TIMES.leave) / (HAGIA_TIMES.gone - HAGIA_TIMES.leave)));
