// April 2026, they get engaged: they got engaged on an old Chevy truck whose
// tray had been made into a whale-watching platform, on a clifftop by the
// sea. A miniature of it is parked on Patrick's bank, the right, a little
// back from the water past the start of the S-bend, its weathered timber
// deck looking out over the river as the platform looked out to sea. Where
// and when it stands; drawn by EngagementTruck.tsx with the model in
// truckGeometry.ts. Pure, so it can be tested.
import { groundHeight } from '../gardenGeometry.ts';
import { scrolledSince } from '../journey.ts';
import { ornamentSpot, type BankOrnament, type OrnamentSpot } from './careerSpots.ts';

// It stands as the working lives' ornaments do (careerSpots.ts): `ahead` past
// where the boats are as April 2026 shows, `inland` of the right bank's
// water (`mobileInland` on a phone), on the level ground at the top of the
// bank's rise, so it is parked on the flat, not on the slope. It keeps its
// own time (TRUCK_TIMES) rather than the markers', as it is further off than
// a phone's come in (28 units).
// At the engagement's stop it is right of the catamaran in the picture,
// beyond its starboard hull and further off, so it sets the scene beside the
// proposal on the deck rather than competing with it. The left bank there
// holds 2026's arch, and beyond it the river bends away left, so the arch
// would stand in front of it; the right bank's meadow past the start of the
// bend is open. It stands just past the reed bed there, far enough back that
// the reeds and cattails by the water don't rise in front of its wheels. A
// phone sees only about 17° either side of the middle, so there it stands
// nearer the water, and smaller, between the catamaran and the edge of the
// picture.
// It is parked along the bank, as the truck stood along the clifftop, so its
// deck's railed side looks out over the water. `turn` swings it from facing
// the camera so its nose points up the river: three-quarters on, so the
// rounded cab, the grille and the platform all show.
export const TRUCK: BankOrnament & { turn: number; mobileAhead: number } = {
  facing: '2026-04', from: '2026-04', ahead: 15.25, mobileAhead: 14.75, side: 1, inland: 4.6, mobileInland: 2.7,
  scale: { desktop: 1.7, mobile: 1 }, turn: .75,
};

// The wheels in the model's own frame (it faces +z, the cab at the front,
// with the ground at y 0): x either side, z along it, and their radius.
export const TRUCK_WHEELS = { track: .37, front: .66, rear: -.68, radius: .2, width: .13 } as const;
const WHEELS = [[-1, TRUCK_WHEELS.front], [1, TRUCK_WHEELS.front], [-1, TRUCK_WHEELS.rear], [1, TRUCK_WHEELS.rear]] as const;

export type TruckSpot = OrnamentSpot & { pitch: number; roll: number };
// A point in the truck's own frame, in the world, tilted by `pitch` (about its
// own x) and `roll` (about its own z) before it is turned by `yaw`, as the
// group's 'YXZ' rotation does.
export function truckPoint(spot: TruckSpot, [lx, ly, lz]: readonly [number, number, number]) {
  const k = spot.scale;
  let x = lx * k, y = ly * k, z = lz * k;
  [x, y] = [x * Math.cos(spot.roll) - y * Math.sin(spot.roll), x * Math.sin(spot.roll) + y * Math.cos(spot.roll)];
  [y, z] = [y * Math.cos(spot.pitch) - z * Math.sin(spot.pitch), y * Math.sin(spot.pitch) + z * Math.cos(spot.pitch)];
  return { x: spot.x + x * Math.cos(spot.yaw) + z * Math.sin(spot.yaw), y: spot.y + y, z: spot.z - x * Math.sin(spot.yaw) + z * Math.cos(spot.yaw) };
}

// Where it stands, and how it sits: tilted to the plane through the ground
// under its four wheels, so each tyre rests on the grass however the
// ground wobbles beneath it.
export function truckSpot(width: number): TruckSpot {
  const base = ornamentSpot(width < 1 ? { ...TRUCK, ahead: TRUCK.mobileAhead } : TRUCK, width);
  const flat: TruckSpot = { ...base, yaw: base.yaw + TRUCK.turn, pitch: 0, roll: 0 };
  const ground = WHEELS.map(([side, z]) => {
    const { x, z: wz } = truckPoint(flat, [side * TRUCK_WHEELS.track, 0, z]);
    return groundHeight(x, wz, width);
  });
  const [frontLeft, frontRight, rearLeft, rearRight] = ground;
  const k = base.scale;
  const rise = (frontLeft + frontRight - rearLeft - rearRight) / 2, lean = (frontRight + rearRight - frontLeft - rearLeft) / 2;
  return { ...flat, y: ground.reduce((sum, h) => sum + h, 0) / 4,
    pitch: -Math.atan2(rise, (TRUCK_WHEELS.front - TRUCK_WHEELS.rear) * k), roll: Math.atan2(lean, 2 * TRUCK_WHEELS.track * k) };
}

// Where each tyre meets the ground, in the world.
export const truckWheelContacts = (spot: TruckSpot) => WHEELS.map(([side, z]) => truckPoint(spot, [side * TRUCK_WHEELS.track, 0, z]));

// When it comes and goes, in shares since the engagement's date: it
// dissolves in out of the haze from `arrive`, so it is there as the old masts
// come down, stands while the proposal plays, and sinks back into the haze
// from `leave` to `gone`, as July 2026's date holds and the camera passes it,
// so the trip's stop is left to the Hagia Sophia and the balloons (on a phone
// it would otherwise linger at the edge of the picture there).
export const TRUCK_TIMES = { arrive: -.35, leave: .9, gone: 1.2 } as const;
const ramp = (value: number) => Math.min(1, Math.max(0, value));
// How much of it shows at p, 0 to 1.
export function truckShown(p: number) {
  const t = scrolledSince(TRUCK.from, p), { arrive, leave, gone } = TRUCK_TIMES;
  return Math.min(ramp((t - arrive) / -arrive), ramp((gone - t) / (gone - leave)));
}

// Its footprint on the ground, about 2.4 long and 1 across in its own units:
// whether a point is under it, or within `margin` world units of it, so the
// bank's rocks keep out from under it.
export const TRUCK_SIZE = { length: 2.4, width: 1 } as const;
export function truckFootprint(width: number) {
  const spot = truckSpot(width), cos = Math.cos(spot.yaw), sin = Math.sin(spot.yaw);
  return (x: number, z: number, margin = 0) => {
    const dx = x - spot.x, dz = z - spot.z;
    const across = dx * cos - dz * sin, along = dx * sin + dz * cos;
    return Math.abs(across) < TRUCK_SIZE.width / 2 * spot.scale + margin && Math.abs(along) < TRUCK_SIZE.length / 2 * spot.scale + margin;
  };
}
