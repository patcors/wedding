// February 2021, Amelia moves to Sydney: where the boats first part for it, a
// low sandstone rock stands in the middle of the river (VOYAGE.rock in
// gardenGeometry.ts, built in voyageRock.ts), and they go either side of it.
// From its end the Harbour Bridge spans Amelia's channel to her bank, so her
// boat sails under it as Sydney's date shows while Patrick's goes the other
// way round the rock. Sydney carries on down the river: across from 2022's
// pile, a miniature Sydney Opera House stands on a little sandstone point on
// her bank (VOYAGE.point), as the real one does on Bennelong Point. Where
// each stands and when it shows; drawn by Sydney.tsx with the models in
// sydneyGeometry.ts. Pure, so it can be tested.
import { VOYAGE, bankEdge, groundHeight, pointInland, pointSpot, riverCenter, rockHalfWidth } from '../gardenGeometry.ts';
import { ROOM, progressAt } from '../journey.ts';
import { pointTop, rockHeight } from '../voyageRock.ts';
import { SILK } from './circusRigs.ts';
import { MARKER_REACH, markerShown } from './yearMarkerSpots.ts';

// The Opera House stands on the point's flat top, its long axis turned
// `turn` (radians about +y) from the river's, so its harbour front, the
// shells' open mouths, faces out over the river and from the camera behind
// the boats its shells show side on, rising one behind another. Its model is
// a unit long and `width` wide (its podium); `scale` sizes it on each
// composition, smaller on a phone's narrower river, where the point is
// smaller too, and fits it on the point.
export const OPERA = { turn: -1.55, width: .66, scale: { desktop: 2.9, mobile: 3.35 } } as const;

// The bridge crosses the river at VOYAGE.rock.bridge, from a pair of granite
// pylons on the rock, `inset` in from its waterline, to a pair on Amelia's
// bank, `inland` of the water, the deck running between each pair. The steel
// arch springs from the foot of each pair (`bearing` above the water), its
// top chord leaving the pylons at `ends` and its crown at `crown`, with the
// truss `chord` deep there, and the deck hangs from it. The deck's underside
// is `deck` above the water, well clear of Amelia's masthead. A phone's span
// is shorter, as its river is narrower, so its arch rises less.
export const BRIDGE = {
  deck: 2.15, thick: .1,
  desktop: { inset: .42, inland: .75, half: .26, pylon: { across: .7, along: .5, above: .62 }, bearing: .4, ends: 2.62, crown: 3.5, chord: .34, member: .05, panels: 14 },
  mobile: { inset: .26, inland: .5, half: .2, pylon: { across: .42, along: .3, above: .5 }, bearing: .4, ends: 2.5, crown: 3.02, chord: .26, member: .035, panels: 9 },
} as const;
export type BridgeSize = (typeof BRIDGE)['desktop' | 'mobile'];

export type Pylon = { x: number; z: number; foot: number };
export type HarbourBridge = {
  z: number; size: BridgeSize;
  // The middle of each pair of pylons across the river: on the rock, and on
  // the bank. Each pylon's own centre, and how low its foot goes.
  near: number; far: number; pylons: Pylon[];
  // Where the arch springs from, at each pair's inner faces, and the deck's
  // underside and top.
  from: number; to: number; deck: number; top: number;
};
// The bridge on each composition, in the world.
export function harbourBridge(width: number): HarbourBridge {
  const size = width < 1 ? BRIDGE.mobile : BRIDGE.desktop, z = VOYAGE.rock.bridge;
  const offsets = [-1, 1].map(s => s * (size.half + size.pylon.along / 2 + .02));
  const middle = riverCenter(z, width);
  // On the rock, in from its waterline at both pylons; on the bank, inland.
  const rock = Math.min(...offsets.map(dz => rockHalfWidth(z + dz, width)));
  const near = middle - (rock - size.inset), far = middle - (bankEdge(z, width) + size.inland);
  const pylons = [near, far].flatMap(x => offsets.map(dz => {
    const corners = [-1, 1].flatMap(a => [-1, 1].map(b => [x + a * size.pylon.across / 2, z + dz + b * size.pylon.along / 2]));
    // Down to below the lowest ground under it, so it stands seated.
    const foot = Math.min(...corners.map(([cx, cz]) => x === near ? rockHeight(cx, cz, width) : groundHeight(cx, cz, width))) - .1;
    return { x, z: z + dz, foot };
  }));
  return { z, size, near, far, pylons, from: near - size.pylon.across / 2, to: far + size.pylon.across / 2, deck: BRIDGE.deck, top: BRIDGE.deck + BRIDGE.thick };
}

// The arch's chords `u` of the way across its span (0 at the rock, 1 at the
// bank): parabolas, the bottom chord from the bearings up through the deck
// to the crown, the top chord from the pylons to the crown, as on the real
// bridge's "coathanger".
export function archAt(bridge: HarbourBridge, u: number) {
  const { bearing, ends, crown, chord } = bridge.size, k = 4 * u * (1 - u);
  return { x: bridge.from + (bridge.to - bridge.from) * u, top: ends + (crown - ends) * k, bottom: bearing + (crown - chord - bearing) * k };
}

// Where the Opera House stands: in the middle of the point, on its top, its
// podium run down a hair into it (`foot`, in its model's units).
export function operaHouseSpot(width: number) {
  const scale = width < 1 ? OPERA.scale.mobile : OPERA.scale.desktop, point = pointSpot(width);
  return { x: point.x + point.side * (point.back - point.out) / 2, y: pointTop(width), z: point.z, yaw: OPERA.turn, scale, foot: -.03 / scale };
}

// Posts round each pylon's foot for the guests' boats to bump off where it
// stands in the water, and round the point's waterline (see boatPhysics'
// stems); the rock's shore holds them off the rest.
export function bridgeStems(width: number) {
  const { pylons, size } = harbourBridge(width);
  return pylons.flatMap(({ x, z }) => [-1, 0, 1].flatMap(a => [-1, 0, 1].filter(b => a || b).map(b =>
    ({ x: x + a * size.pylon.across / 2, z: z + b * size.pylon.along / 2, radius: .06, grip: 0 }))));
}
export function pointStems(width: number) {
  const point = pointSpot(width), stems: { x: number; z: number; radius: number; grip: number }[] = [];
  for (let u = -point.out; u < .2; u += .15) for (let v = -point.wide / 2; v <= point.wide / 2 + 1e-9; v += .15) {
    const x = point.x + point.side * u, z = point.z + v, inland = pointInland(x, z, width);
    if (inland < .12 && inland > -.04) stems.push({ x, z, radius: .08, grip: 0 });
  }
  return stems;
}
// Whether a spot in the river is on the point, where a tap shouldn't launch a boat.
export const onPoint = (x: number, z: number, width: number) => pointInland(x, z, width) > -.1;

// How much of each shows, 0 to 1, at p with the camera at cameraZ. The
// bridge comes in soon after graduation, well down the river, so it is
// plainly there for months before Amelia's move: it dissolves in over the
// `arrive` shares before `from` shows, starting just after graduation's
// date has held, while September shows, and is fully in from October.
// Its rock end stands right in the camera's path, so once she has sailed
// under it, and well before its pylons come between the camera and her boat,
// it fades away quickly as the camera comes `leave` units from it (from the
// first to the second), just after Sydney's stop. The Opera House comes in
// with 2022, fully in as its `from` shows, and goes once the camera has
// passed it. On a phone it stands further down the river than the year
// markers' reach (`MARKER_REACH`) as 2022 comes in, so it has a reach of
// its own there (`reach`, the markers' on desktop), held back by its month
// rather than its distance. There it is beyond the circus's silk, which
// comes in on the same bank late in 2022 and would hang in front of it, so
// on a phone it goes once August's stop is past, fading over the `leave`
// of a share before the silk starts to come in. Both fade evenly
// (Sydney.tsx), so neither is grainy part way.
export const HARBOUR_SHOWN = {
  bridge: { from: '2020-10', arrive: .3, leave: [10.9, 9.7] },
  opera: { from: '2022-01', arrive: .35, reach: { desktop: MARKER_REACH.desktop, mobile: 38 }, leave: .2 },
} as const;
const arrived = (p: number, { from, arrive }: { from: string; arrive: number }) => Math.min(1, Math.max(0, (p - progressAt(from)) / (arrive * ROOM) + 1));
// As markerShown, with a reach of its own: in over the last `fade` of it, gone once passed.
const withinReach = (z: number, cameraZ: number, reach: number) => {
  const ahead = cameraZ - z;
  return ahead < -MARKER_REACH.behind || ahead > reach ? 0 : Math.min(1, (reach - ahead) / MARKER_REACH.fade);
};
const smooth = (t: number) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };
export function harbourShown(p: number, cameraZ: number, mobile: boolean) {
  const { bridge, opera } = HARBOUR_SHOWN, [from, to] = bridge.leave;
  const left = smooth((cameraZ - VOYAGE.rock.bridge - to) / (from - to));
  return {
    opera: Math.min(smooth(arrived(p, opera)), withinReach(mobile ? VOYAGE.point.mobile.z : VOYAGE.point.z, cameraZ, opera.reach[mobile ? 'mobile' : 'desktop']),
      mobile ? smooth((progressAt(SILK.from) - SILK.arrive * ROOM - p) / (opera.leave * ROOM)) : 1),
    bridge: Math.min(left, smooth(arrived(p, bridge)), markerShown(VOYAGE.rock.bridge, cameraZ, mobile)),
  };
}
