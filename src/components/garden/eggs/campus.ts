// July 2017, the University of Wollongong, both starting maths degrees: where
// the π sculpture stands and how the duck pond's rubber ducks are launched
// into the river. Pure, so it can be tested.
import { bankEdge, groundHeight, riverCenter } from '../gardenGeometry.ts';

// The π stands on the right bank a little way past where the boats meet,
// turned upstream towards the river, so it is in view down the river as July
// 2017 shows, closest through the first year and passed by the end of the
// second. Portrait's river is narrower, so it stands nearer the water and smaller.
export const PI = { z: -27, side: 1, inland: { desktop: 1.4, mobile: .8 }, scale: { desktop: 1.3, mobile: 1 }, yaw: -.28 } as const;
export function piSpot(mobile: boolean, width: number) {
  const { z, side, yaw } = PI, inland = mobile ? PI.inland.mobile : PI.inland.desktop, scale = mobile ? PI.scale.mobile : PI.scale.desktop;
  const x = riverCenter(z, width) + side * (bankEdge(z, width) + inland);
  // Sunk to the lowest ground under its plinth, so no edge floats on the slope.
  const reach = .55 * scale;
  const y = Math.min(...[-1, 1].flatMap(dx => [-1, 1].map(dz => groundHeight(x + dx * reach, z + dz * reach * .4, width))));
  return { x, y, z, yaw, scale };
}

// The ducks are tossed one after another from behind the bank's grass a
// little ahead of the boats, while July 2017 holds: the left bank, or in
// portrait the right, where Amelia's boat would hide them. Times are in milestone
// shares since the date (see eggTime). Each arcs out over the water and
// plops in, then drifts slowly downstream and out towards its lane, so the
// boats overtake them; they are gone once the camera has passed.
export const DUCKS = {
  z: -15.5, side: { desktop: -1, mobile: 1 },
  // When each is launched, how far along the bank (dz), and its lane: how far
  // out from the bank it settles, at desktop's width (portrait's is a third).
  launches: [{ at: .06, dz: .9, lane: 1.6 }, { at: .17, dz: -.5, lane: 2.7 }, { at: .28, dz: -2, lane: 1.1 }, { at: .39, dz: 2.1, lane: 2.2 }],
  // Seconds in the air, and the arc's height above the bank.
  flight: .75, arc: .9,
  // Drift downstream in units per share, and how long it takes to reach its lane.
  drift: 1.1, settle: 1.2,
  scale: { desktop: .85, mobile: .65 },
  // Under reduced motion they float just off the bank, all four in, at this time.
  settled: .45, gone: 2.8,
} as const;
const smooth = (t: number) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };

const duckSide = (width: number) => width < 1 ? DUCKS.side.mobile : DUCKS.side.desktop;
// Where duck `i` sits on the water `t` shares after the date, once in: x, z.
export function duckOnWater(i: number, t: number, width: number) {
  const { launches, z: from, drift, settle } = DUCKS, launch = launches[i];
  const since = Math.max(0, t - launch.at);
  const z = from + launch.dz - drift * since;
  const edge = bankEdge(z, width), middle = riverCenter(z, width), side = duckSide(width);
  // It lands just off the bank and works out to its lane.
  const out = (.35 + (launch.lane - .35) * smooth(since / settle)) * (width < 1 ? .35 : 1);
  return { x: middle + side * (edge - out), z };
}
// Where it is thrown from: behind the bank's grass, beside where it lands.
export function duckLaunchSpot(i: number, width: number) {
  const { launches, z: from } = DUCKS, z = from + launches[i].dz;
  const x = riverCenter(z, width) + duckSide(width) * (bankEdge(z, width) + .7 * Math.max(width, .6));
  return { x, y: groundHeight(x, z, width) - .25, z };
}
