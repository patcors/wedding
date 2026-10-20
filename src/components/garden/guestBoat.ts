// The guests' own boats (see docs/VOYAGE.md): on a Personal link, a little
// paper boat for each guest in the Party, their first name on a card sail,
// comes up the river from beyond the dock as the catamaran rounds the bend to
// Jasper's, and pulls up at the jetty as the catamaran moors. Pure, so it can
// be tested; drawn by GuestBoat.tsx with the model in guestBoatGeometry.ts.
import { DATES, DOCKED, progressAt } from './journey.ts';
import { CATAMARAN, HULL_HALF_BEAM, boatPose } from './storyBoats.ts';
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
// along the bank, bow downstream as the catamaran lies (they come down to
// their berths from above it), and whether it has a tall mast.
// They lie abreast just upstream of the jetty's T-head, between the bank and
// the moored catamaran's stern, a little staggered, every other card raised
// on a tall mast, so in the dock's picture, where they lie nearly in line
// with the camera, each name stands clear of its neighbours'. On a phone a
// Party of two or more lies closer, every other boat a little further up
// beside the next, and one tucked in below the T-head's end. Listed from the
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
    [[.62, 1.4, 0, 1], [1.2, 2.1, -.06, 0]],
    [[.6, 2.8, .08, 0], [.66, 1.45, 0, 1], [1.21, 2.15, -.06, 0]],
    [[.64, 2.8, .08, 0], [.66, 1.45, 0, 1], [1.21, 2.15, -.06, 0], [1.36, 3.4, -.1, 1]],
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

// When they come in: a little scene in real time. As the wedding's date is
// about to show (`cue`), with the catamaran coming round the bend's last
// curve, they come out of the haze far down the river (`run` units beyond the
// jetty), in file, `lag` seconds apart, and sail up the river towards the
// catamaran for `up` seconds; then each passes it on its far side, comes
// back across above its stern and drifts down into its berth beside it, over
// `across` seconds. They go at their own pace (guestArrivalCap), never faster
// than real time, so a guest who scrolls fast, or sails on, still sees the
// whole scene and finds them still coming in as the catamaran moors; one who
// scrolls slowly keeps them in step with the catamaran, and they wait below
// the jetty, in sight, until it is tied up. Scrolling back takes them back,
// and back before the cue they are gone.
export const GUEST_ARRIVAL = { cue: progressAt(DATES.wedding) - .004, up: 2.8, across: 3.8, lag: .45, run: 9 } as const;

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
    // Lies along the bank, bow downstream as the catamaran lies: its heading follows the bank.
    const ahead = bankAt(z - .5, width), behind = bankAt(z + .5, width);
    const yaw = heading(ahead.x - behind.x, -1) + turn;
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

// Their way in round the moored catamaran: the line `above` its stern they
// come back across the river on, and how far `wide` of its hulls they pass.
// They wait (if they must) `before` units below the jetty, in sight: on
// desktop out in the river wide of the catamaran, and on a phone, whose
// narrow picture looks straight down the river past the catamaran's sail,
// on the jetty's side below it, `near` the bank, under the old tree, until the catamaran is tied up (`gate`, in
// progress: its stern below the line, with a margin).
const ROUND = { above: .35, margin: .2, wide: .75, before: { desktop: 4.5, mobile: 4.6 }, near: .95 };
const rounds = new Map<string, { line: number; gate: number }>();
export function guestRound(count: number, width: number, height = Infinity) {
  const key = `${fleetSize(count)} ${width} ${height}`;
  if (!rounds.has(key)) {
    const length = GUEST_BOAT.halfLength * guestScale(width, height, count), moored = boatPose(DOCKED, width);
    // The catamaran's stern is 1.15 hull units above its middle.
    const line = Math.max(moored.z + 1.15 * moored.scale, ...guestBerths(count, width, height).map(b => b.z)) + length + ROUND.above;
    let gate = GUEST_ARRIVAL.cue;
    while (gate < DOCKED) {
      const pose = boatPose(gate, width);
      if (pose.z + 1.15 * pose.scale < line - length - ROUND.margin && Math.abs(pose.x - moored.x) < .05) break;
      gate += .0005;
    }
    rounds.set(key, { line, gate: Math.min(gate, DOCKED) });
  }
  return rounds.get(key)!;
}

// How far into the scene (in seconds, the first boat's clock) the boats may
// be at progress p: none before the cue; up the river to wait below the
// jetty by the time the catamaran is tied up (`gate`), in step with the
// scroll; and round it into their berths by the end. GuestBoat's clock runs
// in real time up to this, so they never get ahead of the catamaran nor rush.
export const guestArrivalLength = (count: number) => GUEST_ARRIVAL.up + GUEST_ARRIVAL.across + (fleetSize(count) - 1) * GUEST_ARRIVAL.lag;
export function guestArrivalCap(p: number, count: number, width: number, height = Infinity) {
  const { cue, up } = GUEST_ARRIVAL, { gate } = guestRound(count, width, height);
  if (p < cue) return 0;
  if (p < gate) return up * (p - cue) / (gate - cue);
  return up + (guestArrivalLength(count) - up) * clamp((p - gate) / Math.max(1e-6, 1 - gate));
}

// Each boat's course in, in two legs. Up: from far down the river, up its
// far side and in towards the middle, to wait (if it must) below the jetty,
// the later boats in file below it. Round: up past the moored catamaran wide
// of its far hull, back across the river above its stern, and down beside
// it into its berth.
export function guestCourses(count: number, width: number, height = Infinity) {
  const n = fleetSize(count), scale = guestScale(width, height, n), { jetty } = voyageLandmarks(width);
  const length = GUEST_BOAT.halfLength * scale, beam = GUEST_BOAT.halfBeam * scale, { line } = guestRound(n, width, height);
  const out = (point: Point) => (bankAt(point.z, width).x - point.x) * VOYAGE.dock.side;
  const moored = boatPose(DOCKED, width), half = (CATAMARAN + HULL_HALF_BEAM.catamaran) * moored.scale;
  // Wide of the catamaran's far hull.
  const wide = out(moored) + half + beam + ROUND.wide;
  const far = (z: number, share: number) => offBank(bankEdge(z, width) * 2 * share, z, width);
  return guestBerths(n, width, height).map(berth => {
    const i = berth.order, spacing = 2.6 * length, before = ROUND.before[layout(width)];
    // On a phone they come up the far side, in sight beside the catamaran, and
    // cross below where it will moor to wait on the jetty's side.
    const phone = width < 1;
    const start = far(jetty.z - before - GUEST_ARRIVAL.run - i * spacing, .66);
    const wait = offBank(phone ? ROUND.near : wide, jetty.z - before - i * spacing, width);
    const up = course([start, far(jetty.z - before - GUEST_ARRIVAL.run / 2 - i * spacing, phone ? .6 : .62), wait]);
    // Round the catamaran's bow first, from the jetty's side.
    const bow = phone ? [offBank(wide, moored.z - 1.5 * moored.scale - .5 - length, width)] : [];
    const round = course([wait, ...bow, offBank(wide, moored.z - (phone ? 0 : 1.5 * moored.scale), width), offBank(wide, line - .3, width),
      offBank((wide + out(berth)) / 2, line + .1, width), offBank(out(berth), line, width), berth]);
    return { berth, up, across: round };
  });
}

// The boats `time` seconds into the scene (the first boat's clock; each later
// one `lag` behind): hidden before the cue, waiting far off at the start of
// their courses, sailing up easing to the far side, then across and down,
// turning to lie as moored and the card to the dock's camera as they settle.
const courses = new Map<string, ReturnType<typeof guestCourses>>();
export function guestFleetPosesAt(time: number, count: number, width: number, height = Infinity): GuestPose[] {
  const n = fleetSize(count), key = `${n} ${width} ${height}`, { up, across, lag } = GUEST_ARRIVAL;
  // The courses are laid out once per layout, not every frame.
  if (!courses.has(key)) courses.set(key, guestCourses(n, width, height));
  return courses.get(key)!.map(({ berth, up: leg1, across: leg2 }) => {
    const t = time - berth.order * lag;
    if (t >= up + across) return { x: berth.x, z: berth.z, yaw: berth.yaw, card: berth.card, shown: true, settled: 1 };
    // Up the river, easing to rest at the far side; across, gathering way and easing to rest again.
    const last = clamp((t - up) / across);
    const point = t < up ? leg1(1 - (1 - clamp(t / up)) ** 1.6) : leg2(last * last * (3 - 2 * last));
    // Bow first along its course, then round to lie as it is moored, over the last of the way in.
    const yaw = point.yaw + wrap(berth.yaw - point.yaw) * smootherstep((last - .55) / .45);
    const settled = smootherstep((last - .5) / .5);
    // Under way the name faces ahead, so it reads as they come up the river
    // towards the camera, and turns to the dock's camera as it settles.
    const ahead = Math.PI, facing = wrap(berth.yaw + berth.card - yaw);
    const card = ahead + wrap(facing - ahead) * settled;
    return { x: point.x, z: point.z, yaw, card, shown: true, settled };
  });
}

// The boats as they are at progress p when nothing has held them back: as
// far in as the scroll allows (a still under reduced motion, or a jump).
export const guestFleetPoses = (p: number, count: number, width: number, height = Infinity): GuestPose[] =>
  p < GUEST_ARRIVAL.cue ? guestFleetPosesAt(0, count, width, height).map(pose => ({ ...pose, shown: false }))
    : guestFleetPosesAt(guestArrivalCap(p, count, width, height), count, width, height);

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
