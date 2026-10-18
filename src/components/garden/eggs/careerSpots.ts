// Their working lives, as still ornaments on the banks: candlestick posts, a
// finance chart's, for 2018 and the internship at FinoComp; a rubber duck on a
// plinth for Amelia's first year in Sydney, 2021; and a flower bed planted as
// an exploded pie chart once they work together at HeirWealth, from March
// 2023. Where and when each stands; drawn by Careers.tsx. Pure, so it can be
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
// stop and Amelia's carved trunk (uniOrnaments.ts), further down the same
// bank, shows clear of the row's river end rather than behind it. The duck sits by the water on the
// right bank in Sydney, between 2021's stake and 2022's pile, where a phone
// still sees that bank: it arrives as Sydney shows, right of Patrick's flag at
// its stop, and is closest through 2021. The flower bed is on the left bank,
// across the river from 2023's slate, a little past the boats as they come
// back alongside in March 2023, so it is passing out of the picture by the
// time the first birdhouses go up behind it.
export const CANDLESTICKS: BankOrnament = { facing: '2018-07', from: '2018-01', ahead: 7.3, side: -1, inland: .9, mobileInland: 1.25, scale: { desktop: 1.3, mobile: .9 } };
export const DUCK_STATUE: BankOrnament = { facing: '2021-07', from: '2021-02', ahead: 2.4, side: 1, inland: .45, scale: { desktop: 1.6, mobile: 2 } };
export const PIE_BED: BankOrnament = { facing: '2023-03', from: '2023-03', ahead: 3, side: -1, inland: 1.1, scale: { desktop: 1.15, mobile: 1.3 } };
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
// seen from above, each planted in its own colour from the garden's palette.
// HeirWealth's purple is pulled out, as an exploded pie's slice is.
export type Wedge = { share: number; flowers: string; pulled?: boolean };
export const WEDGES: readonly Wedge[] = [
  { share: .31, flowers: '#5fa9a0' },
  { share: .23, flowers: '#ecd07a' },
  { share: .18, flowers: '#df8a74' },
  { share: .15, flowers: '#efe7cf' },
  { share: .13, flowers: '#9c78b8', pulled: true },
];
// The bed's radius, the height of its edging at the rim and of the planting's
// mound at the middle, how far the pulled wedge is drawn out, the gap between
// wedges (radians), and the tilt of the whole bed towards the camera, so the
// low view along the river sees its face, raised by `lift` so its front edge
// stays out of the ground.
export const PIE = { radius: .8, rim: .2, mound: .1, pull: .2, gap: .05, tilt: .5, lift: .15 } as const;
// Each wedge's start and end angle about +y in the bed's frame, measured from
// +x towards −z (anticlockwise from above), turned so the pulled wedge points
// out to the front right, towards the camera.
export function wedgeAngles() {
  const pulled = WEDGES.findIndex(wedge => wedge.pulled);
  const before = WEDGES.slice(0, pulled).reduce((sum, wedge) => sum + wedge.share, 0);
  const start = -Math.PI / 4 - (before + WEDGES[pulled].share / 2) * Math.PI * 2;
  let at = start;
  return WEDGES.map(wedge => {
    const from = at;
    at += wedge.share * Math.PI * 2;
    return { from, to: at, middle: (from + at) / 2 };
  });
}
