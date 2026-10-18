// Their working lives, as still ornaments on the banks: candlestick posts, a
// finance chart's, for 2018 and the internship at FinoComp; a rubber duck on a
// plinth for Amelia's first year in Sydney, 2021; and a round flower bed
// planted in slices, a pie chart's, once they work together at HeirWealth,
// from March 2023. Where and when each stands; drawn by Careers.tsx. Pure, so it can be
// tested.
import { cameraPose } from '../cameraRig.ts';
import { bankEdge, groundHeight, riverCenter } from '../gardenGeometry.ts';
import { ROOM, progressAt, routeAtMonth } from '../journey.ts';
import { markerShown } from './yearMarkerSpots.ts';

// `facing` is the month it stands for: it stands `ahead` past where the boats
// are then, on the `side` bank (−1 is −x, Amelia's), `inland` from the
// water's edge in world units on desktop (portrait's is 60%, or
// `mobileInland` where given), turned so its
// face (+z in its own frame) looks at the camera. It dissolves in out of the
// haze as the year markers do, and no earlier than `from` (it is fully in as
// that month shows), and goes once the camera has passed it.
export type BankOrnament = { facing: string; from: string; ahead: number; side: -1 | 1; inland: number; mobileInland?: number; scale: { desktop: number; mobile: number } };

// Each stands clear of the eggs and year markers near it. The candlesticks
// are on the left bank behind 2018's rock, in view through 2018 and beside the
// boats as the FinoComp flags go up; smaller on a phone and set further back
// from the water, so the whole chart is in its picture at the internship's
// stop. The statistics carved into a tree further down the same bank
// (uniOrnaments.ts) show above the row in the picture. The duck is
// Amelia's move, so it sits on her bank, the left, by the water across from
// 2022's pile. Sydney widens the river and takes that bank out of a phone's
// picture, but this far on it is still just in, left of Amelia's boat: it
// arrives as Sydney shows and comes closer through the first half of 2021.
// The flower bed is on the left bank, across the river from 2023's slate, a
// little past the boats as they come back alongside in March 2023, so it is
// passing out of the picture by the time the first birdhouses go up behind it.
// It lies a little back from the water, on the slope up from it, which tips
// it towards the camera, and far enough on that a phone's narrow picture
// takes in the whole bed.
export const CANDLESTICKS: BankOrnament = { facing: '2018-07', from: '2018-01', ahead: 7.3, side: -1, inland: .9, mobileInland: 1.25, scale: { desktop: 1.3, mobile: .9 } };
export const DUCK_STATUE: BankOrnament = { facing: '2021-07', from: '2021-02', ahead: 4.5, side: -1, inland: .45, mobileInland: .35, scale: { desktop: 1.6, mobile: 2 } };
export const PIE_BED: BankOrnament = { facing: '2023-03', from: '2023-03', ahead: 6, side: -1, inland: 2.1, mobileInland: 1.6, scale: { desktop: 1.5, mobile: 1 } };
export const ORNAMENTS = [CANDLESTICKS, DUCK_STATUE, PIE_BED] as const;

const MOBILE_INLAND = .6;
// The fade in as `from` shows, in milestone shares.
const ARRIVE = .35;

export type OrnamentSpot = { x: number; y: number; z: number; yaw: number; scale: number };
export function ornamentSpot(ornament: BankOrnament, width: number): OrnamentSpot {
  const mobile = width < 1;
  const z = routeAtMonth(ornament.facing) - ornament.ahead;
  const x = riverCenter(z, width) + ornament.side * (bankEdge(z, width) + (mobile ? ornament.mobileInland ?? ornament.inland * MOBILE_INLAND : ornament.inland));
  const [cx, , cz] = cameraPose(progressAt(ornament.facing), width).position;
  return { x, y: groundHeight(x, z, width), z, yaw: Math.atan2(cx - x, cz - z), scale: mobile ? ornament.scale.mobile : ornament.scale.desktop };
}

// How much of it shows at p, 0 to 1, with the camera at cameraZ.
export function ornamentShown(ornament: BankOrnament, spot: OrnamentSpot, p: number, cameraZ: number, mobile: boolean) {
  const arrived = Math.min(1, Math.max(0, (p - progressAt(ornament.from)) / (ARRIVE * ROOM) + 1));
  return Math.min(arrived, markerShown(spot.z, cameraZ, mobile));
}

// The candlesticks: a stock's months, each open, close, high and low, in units
// above the ground. It climbs a little, dips through a run of red months and
// recovers, ending on its highest close.
export const CANDLES: readonly (readonly [open: number, close: number, high: number, low: number])[] = [
  [1, 1.2, 1.28, .92],
  [1.2, 1.34, 1.44, 1.12],
  [1.34, 1.1, 1.4, 1.02],
  [1.1, .82, 1.16, .74],
  [.82, .58, .88, .5],
  [.58, .7, .8, .52],
  [.7, .98, 1.06, .64],
  [.98, 1.32, 1.38, .92],
  [1.32, 1.72, 1.82, 1.26],
];
// Posts' width, wicks' width and the spacing along the row.
export const CANDLE = { body: .17, wick: .035, spacing: .33 } as const;
export type CandleBox = { x: number; y: number; height: number; width: number; rising: boolean; wick: boolean };
// Each candle as boxes in the row's frame (x along it, y up from the ground):
// its painted body and the thin wick through it, from the ground up to its
// high, so it stands like a garden post. Rising months are green, falling red.
export function candleBoxes(): CandleBox[] {
  return CANDLES.flatMap(([open, close, high], i) => {
    const x = (i - (CANDLES.length - 1) / 2) * CANDLE.spacing, rising = close > open;
    const bottom = Math.min(open, close), top = Math.max(open, close);
    return [
      { x, y: (bottom + top) / 2, height: top - bottom, width: CANDLE.body, rising, wick: false },
      { x, y: high / 2, height: high, width: CANDLE.wick, rising, wick: true },
    ];
  });
}

// The pie chart's wedges, as shares of the bed, going round anticlockwise
// seen from above, each planted with flowers of one colour: marigolds, pinks,
// white alyssum, coral and lavender in HeirWealth's purple.
export type Wedge = { share: number; flowers: string; heirWealth?: true };
export const WEDGES: readonly Wedge[] = [
  { share: .31, flowers: '#f2c457' },
  { share: .23, flowers: '#e994a4' },
  { share: .18, flowers: '#f4efe0' },
  { share: .15, flowers: '#e07a55' },
  { share: .13, flowers: '#9c78b8', heirWealth: true },
];
// The bed's radius, the bare soil left between wedges (radians), how much
// longer it runs towards the camera than across (seen from the river it
// looks round), and how far each flower head is turned up to the camera.
export const PIE = { radius: .85, gap: .14, stretch: 1.6, face: .5 } as const;
// Each wedge's start and end angle about +y in the bed's frame, measured from
// +x towards −z (anticlockwise from above), turned so HeirWealth's wedge is
// at the front right, towards the camera.
export function wedgeAngles() {
  const purple = WEDGES.findIndex(wedge => wedge.heirWealth);
  const before = WEDGES.slice(0, purple).reduce((sum, wedge) => sum + wedge.share, 0);
  const start = -Math.PI / 4 - (before + WEDGES[purple].share / 2) * Math.PI * 2;
  let at = start;
  return WEDGES.map(wedge => {
    const from = at;
    at += wedge.share * Math.PI * 2;
    return { from, to: at, middle: (from + at) / 2 };
  });
}
// Whether a point on the ground is under the flower bed, or within `margin`
// world units of it, so the bank's rocks keep out of it.
export function pieBedFootprint(width: number) {
  const spot = ornamentSpot(PIE_BED, width), cos = Math.cos(spot.yaw), sin = Math.sin(spot.yaw);
  return (x: number, z: number, margin = 0) => {
    const dx = (x - spot.x) / spot.scale, dz = (z - spot.z) / spot.scale;
    return Math.hypot(dx * cos - dz * sin, (dx * sin + dz * cos) / PIE.stretch) < PIE.radius + margin / spot.scale;
  };
}
// The ground's height under a point in an ornament's own frame (x across, z
// towards the camera, both in its units), in its units above its spot, so
// the bed can lie on the bank's slope rather than on a level.
export function groundUnder(spot: OrnamentSpot, width: number) {
  const cos = Math.cos(spot.yaw), sin = Math.sin(spot.yaw);
  return (x: number, z: number) => (groundHeight(spot.x + spot.scale * (x * cos + z * sin), spot.z + spot.scale * (z * cos - x * sin), width) - spot.y) / spot.scale;
}
