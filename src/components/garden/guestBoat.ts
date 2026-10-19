// The guests' own boats (see docs/VOYAGE.md): on a Personal link, a little
// paper boat for each guest in the Party, their first name on a card sail,
// comes up the river from beyond the dock as the catamaran rounds the bend to
// Jasper's, and pulls up at the jetty as the catamaran moors. Pure, so it can
// be tested; drawn by GuestBoat.tsx with the model in guestBoatGeometry.ts.
import { DOCKED } from './journey.ts';
import { VOYAGE, bankEdge, riverCenter, voyageLandmarks } from './gardenGeometry.ts';
import { dockView } from './cameraRig.ts';
import { JETTY } from './voyageDock.ts';

// The paper boat's size: the guests' "Float a boat" paper boat (1.64 long,
// .86 across). Each card is threaded on a toothpick mast, `card.height` tall
// and as wide as its name needs (guestCard), its foot `foot` above the water,
// or a card's height and `gap` higher on a boat with a tall mast; the mast
// runs from inside the hull to `above` over the card's top.
// The cards are drawn at `guestCardScale`: full size on a phone, where the
// names need it to read, and smaller on desktop's nearer, larger view. A short
// landscape screen (a phone on its side, 844 × 390) keeps desktop's framing in
// less height, so everything in it is drawn smaller: there they grow with how
// short the visible height is, from `short` px down, so the names keep about
// 12px to the em, up to `most` times full size.
// The hulls are drawn at the layout's size (`guestScale`), not growing on a
// short screen, where they would crowd the catamaran, and a Party of three or
// four takes smaller hulls (`fleet`, by the number of boats) so they all lie
// abreast beside the jetty; their cards stay full size, so every name reads
// as well whatever the Party's size. Every size is here, in one place.
export const GUEST_BOAT = { halfLength: .82, halfBeam: .43, card: { height: .35, gap: .22 }, foot: .62, above: .1 } as const;
export const GUEST_SCALE = { desktop: .8, mobile: 1, short: 600, most: 1.4, fleet: { desktop: [1, 1, 1, .9], mobile: [1, .8, .7, .66] } } as const;
export const GUEST_FLEET = { most: 4 } as const;
const fleetSize = (n: number) => Math.min(GUEST_FLEET.most, Math.max(1, Math.round(n)));
const layout = (width: number) => width < 1 ? 'mobile' : 'desktop';
export const guestCardScale = (width: number, height = Infinity) => width < 1 ? GUEST_SCALE.mobile
  : Math.min(GUEST_SCALE.most, Math.max(GUEST_SCALE.desktop, GUEST_SCALE.desktop * GUEST_SCALE.short / height));
export const guestScale = (width: number, _height = Infinity, count = 1) =>
  GUEST_SCALE[layout(width)] * GUEST_SCALE.fleet[layout(width)][fleetSize(count) - 1];

// The boats a Party gets: one for each guest, by first name, at most four.
export const guestNames = (guests: readonly string[]) => guests.map(name => name.trim()).filter(Boolean).slice(0, GUEST_FLEET.most);

// Where they lie, for a Party of n: each boat's middle `out` from the jetty's
// bank and `up` the river from the jetty's middle, in units at the layout's
// own size (desktop's .8, a phone's 1), a little turn of its own off lying
// along the bank, bow upstream as it came in, and whether it has a tall mast.
// They lie abreast just upstream of the jetty's T-head, between the bank and
// the moored catamaran's stern, a little staggered, every other card raised
// on a tall mast, so in the dock's picture, where they lie nearly in line
// with the camera, each name stands clear of its neighbours'. On a phone a
// Party of three or four lies closer, every other boat a little further up
// beside the next, and one nosed in below the T-head's end, bow downstream,
// as it came round the head. Listed from the
// bank out; the Party's guests take them the other way, so their names read
// left to right in the picture in the Party's order.
type Slot = readonly [out: number, up: number, turn: number, tall: 0 | 1];
export const GUEST_BERTHS: Record<'desktop' | 'mobile', readonly (readonly Slot[])[]> = {
  desktop: [
    [[.64, 2.15, 0, 0]],
    [[.6, 2.15, .06, 0], [1.38, 2.3, -.08, 1]],
    [[.5, 2.15, .06, 0], [1.3, 2.3, -.05, 1], [2.08, 2.45, -.1, 0]],
    [[.48, 2.15, .06, 0], [1.08, 2.65, -.04, 1], [1.68, 2.15, -.08, 0], [2.28, 2.65, -.12, 1]],
  ],
  mobile: [
    [[.8, 2.4, 0, 0]],
    [[.62, 1.4, Math.PI, 1], [1.2, 2.1, -.06, 0]],
    [[.6, 2.8, .08, 0], [.66, 1.45, Math.PI, 1], [1.21, 2.15, -.06, 0]],
    [[.64, 2.8, .08, 0], [.66, 1.45, Math.PI, 1], [1.21, 2.15, -.06, 0], [1.36, 3.4, -.1, 1]],
  ],
};

// A boat's mast and card, in its hull's units (the boat is drawn at
// guestScale): the card's scale against the hull, the card's foot, and the
// mast's top.
export function guestRig(tall: 0 | 1, width: number, height = Infinity, count = 1) {
  const card = guestCardScale(width, height) / guestScale(width, height, count), { foot, above } = GUEST_BOAT;
  const lift = tall * (GUEST_BOAT.card.height + GUEST_BOAT.card.gap) * card;
  return { card, foot: foot + lift, top: foot + lift + GUEST_BOAT.card.height * card + above };
}

// When they come in, in progress: they come out of the haze far down the
// river (`run` units beyond the jetty) as the catamaran rounds the bend's last
// curve, before the wedding's date shows, each `lag` behind the one before,
// steadily up the river and round the T-head's end, each inside it by
// `inside` (`lag` apart again), before the catamaran comes alongside the
// head; then they ease the last little way up into their berths as the
// catamaran glides in, all settled at `to`, just before it is tied up
// (DOCKED), the first to arrive `settle` before the next.
export const GUEST_ARRIVAL = { from: .88, inside: .926, to: DOCKED - .004, lag: .005, settle: .003, run: 12 } as const;

const clamp = (x: number) => Math.min(1, Math.max(0, x));
const smootherstep = (t: number) => {
  const x = clamp(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
};

// The jetty's bank at z: its water's edge, and which way is inland (+1, +x).
const bankAt = (z: number, width: number) => {
  const side = VOYAGE.dock.side;
  return { x: riverCenter(z, width) + side * bankEdge(z, width), side };
};
// A point `out` from the jetty's bank at z.
const offBank = (out: number, z: number, width: number) => {
  const bank = bankAt(z, width);
  return { x: bank.x - bank.side * out, z };
};
// Yaw for a heading (0 is bow downstream, −z, as the story boats).
const heading = (dx: number, dz: number) => Math.atan2(-dx, -dz);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

// `order`: when it comes in, 0 first; `below`, tucked in below the T-head's end.
export type GuestBerth = { x: number; z: number; yaw: number; card: number; tall: 0 | 1; order: number; below: boolean };
export type GuestPose = { x: number; z: number; yaw: number; card: number; shown: boolean; settled: number };

// Where each of a Party of `count`'s boats lies when moored: its middle, its
// yaw, and the card's turn about the mast so its name faces the dock's camera.
export function guestBerths(count: number, width: number, height = Infinity): GuestBerth[] {
  const n = fleetSize(count), scale = guestScale(width, height, n), full = GUEST_SCALE[layout(width)], { jetty } = voyageLandmarks(width);
  const camera = dockView(width).position;
  const placed = GUEST_BERTHS[layout(width)][n - 1].map(([out, up, turn, tall]) => {
    // Bigger or smaller hulls spread or close up across the river, and lie
    // further up or down it by their extra length, so they still clear the T-head.
    const { x, z } = offBank(out * scale / full, jetty.z + up + GUEST_BOAT.halfLength * (scale - full), width);
    // Lies along the bank, bow upstream: its heading follows the bank.
    const ahead = bankAt(z + .5, width), behind = bankAt(z - .5, width);
    const yaw = heading(ahead.x - behind.x, 1) + turn;
    // Turned to face the camera: the card's front faces +z in the boat's frame.
    const card = wrap(Math.atan2(camera[0] - x, camera[2] - z) - yaw);
    return { x, z, yaw, card, tall, out, below: z < jetty.z + JETTY.head / 2 + .2 };
  });
  // They come in deepest first: any tucked in below the T-head's end, then from the bank out.
  const arrivals = [...placed].sort((a, b) => Number(b.below) - Number(a.below) || a.out - b.out);
  return placed.map((_, i) => placed[n - 1 - i]).map(berth => ({ x: berth.x, z: berth.z, yaw: berth.yaw, card: berth.card, tall: berth.tall, below: berth.below, order: arrivals.indexOf(berth) }));
}

// Centripetal Catmull-Rom through the way-points, sampled by arc length: a
// smooth course with no loops however unevenly the points are spaced.
type Point = { x: number; z: number };
function course(points: Point[]) {
  const ends = [{ x: 2 * points[0].x - points[1].x, z: 2 * points[0].z - points[1].z }, ...points,
    { x: 2 * points.at(-1)!.x - points.at(-2)!.x, z: 2 * points.at(-1)!.z - points.at(-2)!.z }];
  const samples: Point[] = [], marks: number[] = [0];
  for (let i = 1; i < ends.length - 2; i++) {
    const [p0, p1, p2, p3] = ends.slice(i - 1, i + 3);
    const d = (a: Point, b: Point) => Math.max(1e-4, Math.hypot(b.x - a.x, b.z - a.z) ** .5);
    const t0 = 0, t1 = t0 + d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3);
    const lerp = (a: Point, b: Point, ta: number, tb: number, t: number) => ({ x: a.x + (b.x - a.x) * (t - ta) / (tb - ta), z: a.z + (b.z - a.z) * (t - ta) / (tb - ta) });
    for (let k = i === 1 ? 0 : 1; k <= 24; k++) {
      const t = t1 + (t2 - t1) * k / 24;
      const a1 = lerp(p0, p1, t0, t1, t), a2 = lerp(p1, p2, t1, t2, t), a3 = lerp(p2, p3, t2, t3, t);
      const b1 = lerp(a1, a2, t0, t2, t), b2 = lerp(a2, a3, t1, t3, t);
      samples.push(lerp(b1, b2, t1, t2, t));
    }
    marks.push(samples.length - 1);
  }
  const lengths = [0];
  for (let i = 1; i < samples.length; i++) lengths.push(lengths[i - 1] + Math.hypot(samples[i].x - samples[i - 1].x, samples[i].z - samples[i - 1].z));
  const total = lengths.at(-1)!;
  // The point `s` of the way along, and the heading there; `marks`, how far
  // along each way-point is.
  return Object.assign((s: number) => {
    const target = clamp(s) * total;
    let i = 1;
    while (i < lengths.length - 1 && lengths[i] < target) i++;
    const a = samples[i - 1], b = samples[i], k = (target - lengths[i - 1]) / Math.max(1e-9, lengths[i] - lengths[i - 1]);
    return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, yaw: heading(b.x - a.x, b.z - a.z) };
  }, { marks: marks.map(i => lengths[i] / total) });
}

// Each boat's course in, from far down the river to its berth: up the dock's
// side of the river, outside the T-head (where the catamaran has yet to come),
// swinging in round its end towards the bank, and the last little way up to
// its berth.
export function guestCourses(count: number, width: number, height = Infinity) {
  const n = fleetSize(count), scale = guestScale(width, height, n), { jetty } = voyageLandmarks(width);
  const length = GUEST_BOAT.halfLength * scale, beam = GUEST_BOAT.halfBeam * scale;
  // Wide of the T-head, and far enough above its end to turn in clear of it.
  const clearHead = jetty.reach + .25 + beam + .3, clear = jetty.z + JETTY.head / 2 + length + .25;
  const out = (point: Point) => (bankAt(point.z, width).x - point.x) * VOYAGE.dock.side;
  return guestBerths(n, width, height).map(berth => {
    // Out of the haze in file, a little either side of the line.
    const i = berth.order, startZ = jetty.z - GUEST_ARRIVAL.run - i * 3 * length;
    const wide = Math.max(clearHead, out(berth) + .2);
    const points: Point[] = [
      offBank(bankEdge(startZ, width) * (.75 + (i % 2 ? .12 : 0)), startZ, width),
      offBank(wide, jetty.z - JETTY.head / 2 - length - .4, width),
      offBank(wide, clear, width),
      // Inside the T-head's end, just off its berth (and below it, where
      // there is room), before the catamaran comes alongside the head.
      // A berth tucked in below the T-head's end is come at from above it, nosing down into it.
      berth.below ? offBank(out(berth) + .1, clear + .2, width)
        : offBank(Math.min(out(berth) + .6, Math.max(out(berth) + .15, jetty.reach - .3)), Math.min(berth.z, Math.max(clear, berth.z - 1.1 * length)), width),
      berth,
    ];
    return { berth, at: course(points) };
  });
}

// The boats at progress p: hidden before each sets off; coming up the river,
// fast at first and easing to rest in its berth, turning the last little way
// to lie along the bank, the card turning to the camera as it settles.
const courses = new Map<string, ReturnType<typeof guestCourses>>();
export function guestFleetPoses(p: number, count: number, width: number, height = Infinity): GuestPose[] {
  const n = fleetSize(count), { from, inside, to, lag, settle } = GUEST_ARRIVAL, key = `${n} ${width} ${height}`;
  // The courses are laid out once per layout, not every frame.
  if (!courses.has(key)) courses.set(key, guestCourses(n, width, height));
  return courses.get(key)!.map(({ berth, at }) => {
    const i = berth.order, start = from + i * lag, inner = inside + i * lag, end = to - (n - 1 - i) * settle;
    if (p >= end) return { x: berth.x, z: berth.z, yaw: berth.yaw, card: berth.card, shown: true, settled: 1 };
    // Steadily to inside the T-head, then easing to rest at the speed it came in at.
    const mark = at.marks[3], speed = mark / (inner - start);
    const k = Math.min(4, Math.max(1, speed * (end - inner) / (1 - mark)));
    const last = clamp((p - inner) / (end - inner));
    const point = at(p < inner ? mark * clamp((p - start) / (inner - start)) : mark + (1 - mark) * (1 - (1 - last) ** k));
    // Bow first along its course, then round to lie as it is moored, over the last little way in.
    const yaw = point.yaw + wrap(berth.yaw - point.yaw) * smootherstep(last / .6);
    const settled = smootherstep((last - .3) / .7);
    // Under way the name faces ahead, so it reads as the boats come up the
    // river towards the camera, and turns to the dock's camera as it settles.
    const ahead = Math.PI, facing = wrap(berth.yaw + berth.card - yaw);
    const card = ahead + wrap(facing - ahead) * settled;
    return { x: point.x, z: point.z, yaw, card, shown: p >= start, settled };
  });
}

// The moored boats' footprints, as posts round each hull for the "Float a
// boat" boats to bump off once they are in (see boatPhysics' stems), as the
// moored catamaran has (mooredStems).
export function guestBoatStems(count: number, width: number, height = Infinity) {
  const scale = guestScale(width, height, count), halfLength = GUEST_BOAT.halfLength * scale, halfBeam = GUEST_BOAT.halfBeam * scale;
  const outline = [[0, -halfLength], [halfBeam, 0], [0, halfLength], [-halfBeam, 0], [0, -halfLength]];
  const stems: { x: number; z: number; radius: number; grip: number }[] = [];
  for (const { x, z, yaw } of guestBerths(count, width, height)) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    for (let i = 1; i < outline.length; i++) {
      const [au, av] = outline[i - 1], [bu, bv] = outline[i], steps = Math.ceil(Math.hypot(bu - au, bv - av) / .1);
      for (let k = 0; k < steps; k++) {
        const u = au + (bu - au) * k / steps, v = av + (bv - av) * k / steps;
        stems.push({ x: x + c * u + s * v, z: z - s * u + c * v, radius: .08, grip: 0 });
      }
    }
  }
  return stems;
}

// The card: the name on one line, `em` units to the em at full size (a dozen
// pixels to the em at the dock on a 390 × 844 phone), with `margin` ems either
// side, at least `least` ems wide so a short name still has a card, and at
// most `most` wide, where a very long name is set smaller to fit. `measure`
// gives the name's width at 1px. Its width and the type's size, in units at
// full size.
export const GUEST_CARD = { em: .18, margin: .32, least: 2.4, most: 5 } as const;
// Cormorant Garamond 500's advance widths, in ems, as measured in the browser,
// for a name's width at 1px before (or without) the font: other characters
// count as a wide .8.
const WIDTHS: Record<string, number> = { a: .42, b: .512, c: .415, d: .512, e: .411, f: .305, g: .447, h: .502, i: .27, j: .259, k: .491, l: .261, m: .768, n: .52, o: .482, p: .511, q: .492, r: .369, s: .338, t: .338, u: .497, v: .436, w: .675, x: .439, y: .432, z: .405,
  A: .706, B: .57, C: .684, D: .696, E: .542, F: .513, G: .719, H: .761, I: .335, J: .327, K: .652, L: .537, M: .842, N: .73, O: .766, P: .546, Q: .766, R: .681, S: .499, T: .637, U: .7, V: .664, W: .925, X: .65, Y: .612, Z: .598, ' ': .234, ',': .222, '&': .703, '-': .33, "'": .2 };
export const cormorantWidth = (text: string) => [...text].reduce((sum, ch) => sum + (WIDTHS[ch] ?? .8), 0);
export function guestCard(name: string, measure: (text: string) => number) {
  const { em, margin, least, most } = GUEST_CARD, text = measure(name);
  const size = Math.min(em, em * (most - 2 * margin) / Math.max(text, 1e-6));
  return { width: Math.max(least * em, text * size + 2 * margin * em), size };
}
