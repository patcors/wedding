// The guest's own boat (see docs/VOYAGE.md): on a Personal link, a little
// paper boat carrying the Party's names on a card sail drifts down along the
// jetty's bank as the wedding's date shows and noses in just
// upstream of the jetty, so it is waiting there when the catamaran moors.
// Pure, so it can be tested; drawn by GuestBoat.tsx with the model in
// guestBoatGeometry.ts.
import { DATES, VOYAGE_END, progressAt } from './journey.ts';
import { VOYAGE, bankEdge, riverCenter, voyageLandmarks } from './gardenGeometry.ts';
import { dockView } from './cameraRig.ts';
import { JETTY } from './voyageDock.ts';

// The paper boat's size: the guests' "Float a boat" paper boat (1.64 long,
// .86 across). The card is threaded on a toothpick mast, `card` wide and
// tall, its foot `foot` above the water; the mast runs from inside the hull
// to `top`. All of it is drawn at `guestScale`: full size on a phone, where
// the names need it to read, and smaller on desktop's nearer, larger view.
// A short landscape screen (a phone on its side, 844 × 390) keeps desktop's
// framing in less height, so everything in it is drawn smaller: there the boat
// grows with how short the visible height is, from `short` px down, so the
// names keep about 12px to the em, up to `most` times full size.
export const GUEST_BOAT = { halfLength: .82, halfBeam: .43, card: { width: .92, height: .66 }, foot: .62, top: 1.42 } as const;
export const GUEST_SCALE = { desktop: .8, mobile: 1, short: 650, most: 1.4 } as const;
export const guestScale = (width: number, height = Infinity) => width < 1 ? GUEST_SCALE.mobile
  : Math.min(GUEST_SCALE.most, Math.max(GUEST_SCALE.desktop, GUEST_SCALE.desktop * GUEST_SCALE.short / height));

// Where it lies: alongside the jetty's bank, `off` the bank's edge, its bow
// `gap` upstream of the jetty's upstream face, pointing downstream, so it
// sits between the catamaran's stern and the bank, clear of both and of the
// jetty, low in the dock's picture where the copy isn't. On a phone the jetty is short and its head close to the bank, so the boat
// lies further upstream, where its card stands below the jetty in the picture.
export const GUEST_BERTH = { off: .8, gap: { desktop: 1, mobile: 1.1 } } as const;

// When it drifts in, in progress: from just before the wedding's date shows
// it comes `drift` units down the bank, a stretch the headland's trees hide
// until the camera comes round onto the dock, and it has settled at its
// berth before the voyage ends and the celebration's copy starts to show
// (at VOYAGE_END, fading in over 1.2s), so it never appears out of nothing.
export const GUEST_ARRIVAL = { from: progressAt(DATES.wedding) - .022, to: VOYAGE_END - .012, drift: 7 } as const;

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

export type GuestPose = { x: number; z: number; yaw: number; card: number; shown: boolean; settled: number };

// Where the boat's middle lies when moored, its yaw (0 is bow downstream,
// −z, as the story boats), and the card's turn about the mast so its names
// face the dock's camera.
export function guestBerth(width: number, height = Infinity) {
  const { jetty } = voyageLandmarks(width);
  const scale = guestScale(width, height);
  const z = jetty.z + JETTY.breadth / 2 + GUEST_BERTH.gap[width < 1 ? 'mobile' : 'desktop'] + GUEST_BOAT.halfLength * scale;
  const bank = bankAt(z, width);
  const x = bank.x - bank.side * GUEST_BERTH.off * scale;
  // Lies along the bank: its heading follows the bank a little either side.
  const ahead = bankAt(z - .5, width), behind = bankAt(z + .5, width);
  const yaw = Math.atan2(-(ahead.x - behind.x), 1);
  const camera = dockView(width).position;
  // Turned to face the camera: the card's front faces +z in the boat's frame.
  const card = Math.atan2(camera[0] - x, camera[2] - z) - yaw;
  return { x, z, yaw, card };
}

// The boat at progress p: hidden before it sets off; drifting down along the
// bank, slowing as it comes, and nudging the last little way into its berth.
export function guestBoatPose(p: number, width: number, height = Infinity): GuestPose {
  const berth = guestBerth(width, height);
  const { from, to, drift } = GUEST_ARRIVAL;
  const t = clamp((p - from) / (to - from));
  if (t >= 1) return { ...berth, shown: true, settled: 1 };
  // Fast at first, easing to rest: the current carries it, then it slows in the shallows.
  const along = 1 - (1 - t) ** 2.4;
  const z = berth.z + drift * (1 - along);
  const bank = bankAt(z, width);
  const x = bank.x - bank.side * GUEST_BERTH.off * guestScale(width, height);
  // Heading down the bank, swinging a little out and back as it comes in.
  const swing = Math.sin(t * Math.PI) * .22 * VOYAGE.dock.side;
  const yaw = berth.yaw + swing;
  // The card turns to the camera as it settles.
  const settled = smootherstep((t - .55) / .45);
  return { x, z, yaw, card: berth.card * settled + -swing * (1 - settled), shown: p >= from, settled };
}

// The moored guest boat's footprint, as posts round its hull for the "Float a
// boat" boats to bump off once it is in (see boatPhysics' stems), as the
// moored catamaran has (mooredStems).
export function guestBoatStems(width: number, height = Infinity) {
  const { x, z, yaw } = guestBerth(width, height), c = Math.cos(yaw), s = Math.sin(yaw);
  const scale = guestScale(width, height), halfLength = GUEST_BOAT.halfLength * scale, halfBeam = GUEST_BOAT.halfBeam * scale;
  const outline = [[0, -halfLength], [halfBeam, 0], [0, halfLength], [-halfBeam, 0], [0, -halfLength]];
  const stems: { x: number; z: number; radius: number; grip: number }[] = [];
  for (let i = 1; i < outline.length; i++) {
    const [au, av] = outline[i - 1], [bu, bv] = outline[i], steps = Math.ceil(Math.hypot(bu - au, bv - av) / .1);
    for (let k = 0; k < steps; k++) {
      const u = au + (bu - au) * k / steps, v = av + (bv - av) * k / steps;
      stems.push({ x: x + c * u + s * v, z: z - s * u + c * v, radius: .08, grip: 0 });
    }
  }
  return stems;
}

// The ways a greeting can be set on the card, one to three lines: it breaks
// after a comma or before an "&" ("Kirsten," / "Michael" / "& Kai"), never
// inside a name.
export function greetingLines(greeting: string): string[][] {
  const groups = greeting.trim().split(/(?<=,)\s+|\s+(?=&)/);
  const ways: string[][] = [];
  const split = (from: number, lines: string[]) => {
    if (from === groups.length) return void ways.push(lines);
    if (lines.length === 3) return;
    for (let to = from + 1; to <= groups.length; to++) split(to, [...lines, groups.slice(from, to).join(' ')]);
  };
  split(0, []);
  return ways;
}

// The card's type: the setting of the greeting that can be largest inside
// the card's `box` (in the card's pixels), given `measure(text)` (its width at
// 1px), at `lineHeight` ems a line, up to `max` px; fewer lines on a tie.
export const CARD_TYPE = { lineHeight: 1.04, max: 200, margin: .07 } as const;
export function fitGreeting(greeting: string, measure: (text: string) => number, box: { width: number; height: number }) {
  const width = box.width * (1 - 2 * CARD_TYPE.margin), height = box.height * (1 - 2 * CARD_TYPE.margin);
  let best = { lines: [greeting], size: 0 };
  for (const lines of greetingLines(greeting)) {
    const widest = Math.max(...lines.map(measure));
    const size = Math.min(CARD_TYPE.max, width / widest, height / (lines.length * CARD_TYPE.lineHeight));
    if (size > best.size + 1e-6) best = { lines, size };
  }
  return best;
}
