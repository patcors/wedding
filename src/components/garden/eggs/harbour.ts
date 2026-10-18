// February 2021, Amelia moves to Sydney: where the boats first part for it, a
// low sandstone rock stands in the middle of the river (VOYAGE.rock in
// gardenGeometry.ts, built in voyageRock.ts), and they go either side of it.
// On its back stands a miniature Sydney Opera House, and from its end the
// Harbour Bridge spans Amelia's channel to her bank, so her boat sails under
// it as Sydney's date shows while Patrick's goes the other way round the rock.
// Where each stands and when it shows; drawn by Sydney.tsx with the models in
// sydneyGeometry.ts. Pure, so it can be tested.
import { VOYAGE, bankEdge, groundHeight, riverCenter, rockHalfWidth } from '../gardenGeometry.ts';
import { ROOM, progressAt } from '../journey.ts';
import { rockHeight } from '../voyageRock.ts';
import { markerShown } from './yearMarkerSpots.ts';

// The Opera House stands on the rock's back, `z` along the river, its long
// axis turned `turn` (radians about +y) from the river's, so from the camera
// behind the boats its shells show in three-quarter, rising one behind
// another. Its model is a unit long and `width` wide (its podium); `scale`
// sizes it on each composition, smaller on a phone's narrower rock.
export const OPERA = { z: -57.3, turn: -1.5, width: .66, scale: { desktop: 1.8, mobile: 1.2 } } as const;

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

// Posts round each pylon's foot for the guests' boats to bump off where it
// stands in the water (see boatPhysics' stems); the rock's shore holds them
// off the rest.
export function bridgeStems(width: number) {
  const { pylons, size } = harbourBridge(width);
  return pylons.flatMap(({ x, z }) => [-1, 0, 1].flatMap(a => [-1, 0, 1].filter(b => a || b).map(b =>
    ({ x: x + a * size.pylon.across / 2, z: z + b * size.pylon.along / 2, radius: .06, grip: 0 }))));
}

// Where the Opera House stands: on the rock's back, and how far down its
// podium runs (`foot`, in its model's units) to be seated on the rock at
// every corner, where the rock falls away towards the water.
export function operaHouseSpot(width: number) {
  const scale = width < 1 ? OPERA.scale.mobile : OPERA.scale.desktop;
  const x = riverCenter(OPERA.z, width), y = rockHeight(x, OPERA.z, width);
  const c = Math.cos(OPERA.turn), s = Math.sin(OPERA.turn);
  const under = [-1, 1].flatMap(a => [-.5, -.1, .3, .5].map(b => {
    const lx = a * OPERA.width / 2 * scale, lz = b * scale;
    return rockHeight(x + c * lx + s * lz, OPERA.z - s * lx + c * lz, width);
  }));
  return { x, y, z: OPERA.z, yaw: OPERA.turn, scale, foot: (Math.min(...under) - .05 - y) / scale };
}

// How much of each shows, 0 to 1, at p with the camera at cameraZ: they
// dissolve in together out of the haze as the year markers do, as the Opera
// House comes in reach, but no earlier than `from` shows, fully in as it does
// (over `arrive` shares before it), so they don't sit down the river through
// the snow trip. The Opera House goes once the camera has passed it. The
// bridge's rock end stands right in the camera's path, so once Amelia has
// sailed under it, and before its pylons come between the camera and her
// boat, it dissolves away as the camera comes `leave` units from it (from the
// first to the second), in the spring of 2021.
export const HARBOUR_SHOWN = { from: '2019-10', arrive: .35, leave: [10.5, 8.5] } as const;
export function harbourShown(p: number, cameraZ: number, mobile: boolean) {
  const arrived = Math.min(1, Math.max(0, (p - progressAt(HARBOUR_SHOWN.from)) / (HARBOUR_SHOWN.arrive * ROOM) + 1));
  const [from, to] = HARBOUR_SHOWN.leave, left = Math.min(1, Math.max(0, (cameraZ - VOYAGE.rock.bridge - to) / (from - to)));
  const opera = Math.min(arrived, markerShown(OPERA.z, cameraZ, mobile));
  return { opera, bridge: Math.min(left, Math.max(opera, Math.min(arrived, markerShown(VOYAGE.rock.bridge, cameraZ, mobile)))) };
}
