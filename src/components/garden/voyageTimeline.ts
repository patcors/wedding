// The voyage's timeline, for the dev-only /dev/timeline page and
// scripts/voyage-timeline.mjs: when each scenery piece (sceneryCatalog.ts) is
// really in the picture, on desktop and on a phone, and where more than two
// compete for the guest's eye. Pure, so it can be tested.
//
// "In the picture" means what the guest sees, not when a piece is drawn: p is
// sampled finely, the camera is put where cameraRig.ts puts it for that p and
// layout, and each piece's bounding spheres are projected into its frustum.
// A piece counts as visible where at least half its sphere is inside the
// picture, it is nearer than the camera's far plane, it is at least a couple
// of pixels across, and its own show/hide logic has it at least half faded in.
// The day's haze counts too: a piece more than half lost in the fog isn't
// seen (the balloons and the Hagia Sophia take their own haze, not the fog's).
// Nothing here knows about trees or the headland in front of a piece, so a
// piece hidden behind leaves still counts as in the picture.
import { cameraPose, type CameraPose } from './cameraRig.ts';
import { GARDEN_CAMERA, MOBILE_RIVER_WIDTH } from './gardenGeometry.ts';
import { ARRIVAL_END, CHAPTERS, MILESTONES, STOPS, VOYAGE_END, dateLabel, progressAt, type Chapter } from './journey.ts';
import { AFTERNOON, DAWN, DUSK, GOLDEN, LATE, MIDDAY, MORNING, SKY_KEYS, hex, skyAt, type SkyKey } from './skyCycle.ts';

export type Point = readonly [number, number, number];
export type Sphere = { centre: Point; radius: number };
// Which bank a piece stands on, for its colour: Amelia's (left, teal),
// Patrick's (right, yellow), or the river and both of them (neutral).
export type Bank = 'left' | 'right' | 'river';

// A scenery piece as the timeline sees it, for one layout (river width).
// `shown` is its own show/hide logic at p, 0 to 1, given the camera's z (the
// scene's pieces read `camera.position.z`); `spheres` is where it is at p
// (several for a long or many-part piece; none while it has nothing to show).
// `counts` says whether it competes for attention at p: scenery and things
// that happen on the boats do; the flags simply flying, the deck and the
// river's landforms are drawn but not counted.
export type Piece = {
  id: string; name: string; group: string; file: string; bank: Bank;
  shown: (p: number, cameraZ: number) => number;
  spheres: (p: number) => readonly Sphere[];
  counts: boolean | ((p: number) => boolean);
  // A note for the tooltip, e.g. how a real-time event is drawn.
  note?: string;
  // False for a piece that takes its own haze rather than the scene's fog.
  fog?: false;
};

// The two compositions, as the tests check them: desktop at 1440 × 900 and a
// portrait phone at 390 × 844, each with its own river width, lens and far plane.
export type LayoutName = 'desktop' | 'phone';
// The fog as GardenSky.tsx sets it (its FOG, checked against it by the
// test): it starts between a clear day's distance and the old mist's, by the
// sky's haze at p, and hides everything by `far`.
export const FOG = { clear: { desktop: 38, mobile: 22 }, mist: { desktop: 16, mobile: 8 }, far: { desktop: 110, mobile: 85 } } as const;
export type Lens = { width: number; aspect: number; fov: number; far: number; near: number; pixels: number; fog: { clear: number; mist: number; far: number } };
const fogFor = (device: 'desktop' | 'mobile') => ({ clear: FOG.clear[device], mist: FOG.mist[device], far: FOG.far[device] });
export const LAYOUTS: Record<LayoutName, Lens> = {
  desktop: { width: 1, aspect: 1440 / 900, fov: GARDEN_CAMERA.fov, far: GARDEN_CAMERA.far, near: .1, pixels: 900, fog: fogFor('desktop') },
  phone: { width: MOBILE_RIVER_WIDTH, aspect: 390 / 844, fov: GARDEN_CAMERA.mobileFov, far: GARDEN_CAMERA.mobileFar, near: .1, pixels: 844, fog: fogFor('mobile') },
};
// How much of something at `depth` from the camera shows through the fog at
// p, 0 to 1, as three.js's Fog blends it (a smoothstep from its near to far).
export function clarity(depth: number, p: number, lens: Lens) {
  const { clear, mist, far } = lens.fog, near = clear + (mist - clear) * skyAt(p).haze;
  const x = Math.min(1, Math.max(0, (depth - near) / (far - near)));
  return 1 - x * x * (3 - 2 * x);
}
// How a piece is judged in the picture: the share of its sphere's radius that
// may lie outside the frame (.5: about half of it in), the least it may be
// across on screen in pixels, and how far faded in it must be.
export const IN_PICTURE = { outside: .5, pixels: 2, shown: .5 } as const;
// More than this many counted pieces in view at once is crowded.
export const CROWDED = 2;

const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Point, b: Point): Point => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: Point): Point => { const l = Math.hypot(...a); return [a[0] / l, a[1] / l, a[2] / l]; };

// The camera's frame at a pose, as three.js's lookAt makes it (up is +y).
export type View = { position: Point; forward: Point; right: Point; up: Point };
export function viewOf({ position, target }: CameraPose): View {
  const forward = unit(sub(target, position)), right = unit(cross(forward, [0, 1, 0]));
  return { position, forward, right, up: cross(right, forward) };
}

// Where a sphere is in the picture: its centre in normalised screen
// coordinates (−1 to 1 across and up; null behind the camera), its depth, its
// radius on screen in pixels, and whether it is in the picture as IN_PICTURE says.
export function project(sphere: Sphere, view: View, lens: Lens) {
  const v = sub(sphere.centre, view.position), depth = dot(v, view.forward), x = dot(v, view.right), y = dot(v, view.up);
  const tanV = Math.tan(lens.fov / 2 * Math.PI / 180), tanH = tanV * lens.aspect;
  const pixels = depth > 0 ? sphere.radius / (depth * tanV) * lens.pixels / 2 : Infinity;
  // Signed distance of the centre inside each side plane of the frustum.
  const sideH = (depth * tanH - Math.abs(x)) / Math.hypot(1, tanH), sideV = (depth * tanV - Math.abs(y)) / Math.hypot(1, tanV);
  const slack = -sphere.radius * IN_PICTURE.outside;
  const inside = depth > lens.near && depth < lens.far && sideH >= slack && sideV >= slack && pixels >= IN_PICTURE.pixels;
  return { screen: depth > 0 ? [x / (depth * tanH), y / (depth * tanV)] as const : null, depth, pixels, inside };
}

// The progress samples: every `step` from 0 to 1.
export const STEP = .0005;
export const samples = (step = STEP) => Array.from({ length: Math.round(1 / step) + 1 }, (_, i) => Math.min(1, i * step));

// How much of a piece the guest sees at each sample, 0 to 1: its own `shown`
// where it is in the picture, through the fog, otherwise 0; and how much is
// drawn at all.
export type Track = { seen: number[]; drawn: number[] };
export function trackOf(piece: Piece, lens: Lens, ps: readonly number[], poses: readonly CameraPose[] = ps.map(p => cameraPose(p, lens.width))): Track {
  const seen: number[] = [], drawn: number[] = [];
  ps.forEach((p, i) => {
    const pose = poses[i], shown = piece.shown(p, pose.position[2]);
    drawn.push(shown);
    if (shown <= 0) { seen.push(0); return; }
    const view = viewOf(pose);
    let best = 0;
    for (const sphere of piece.spheres(p)) {
      const at = project(sphere, view, lens);
      if (at.inside) best = Math.max(best, piece.fog === false ? 1 : clarity(at.depth, p, lens));
    }
    seen.push(shown * best);
  });
  return { seen, drawn };
}

// The stretches of progress where values are at least `at`, as [from, to].
export function spans(values: readonly number[], ps: readonly number[], at: number = IN_PICTURE.shown): [number, number][] {
  const out: [number, number][] = [];
  let start: number | null = null;
  values.forEach((v, i) => {
    if (v >= at && start === null) start = ps[i];
    if (v < at && start !== null) { out.push([start, ps[i - 1]]); start = null; }
  });
  if (start !== null) out.push([start, ps[ps.length - 1]]);
  return out;
}

const countsAt = (piece: Piece, p: number) => typeof piece.counts === 'function' ? piece.counts(p) : piece.counts;
// How many counted pieces are in view at each sample.
export function crowding(pieces: readonly Piece[], tracks: readonly Track[], ps: readonly number[]) {
  return ps.map((p, i) => pieces.reduce((n, piece, k) => n + (tracks[k].seen[i] >= IN_PICTURE.shown && countsAt(piece, p) ? 1 : 0), 0));
}

// Which counted pieces are in view at each sample, by index.
function inView(pieces: readonly Piece[], tracks: readonly Track[], ps: readonly number[]) {
  return ps.map((p, i) => pieces.flatMap((piece, k) => tracks[k].seen[i] >= IN_PICTURE.shown && countsAt(piece, p) ? [k] : []));
}

// The stretches where the same counted pieces are in view, more than
// CROWDED of them, each at least `least` long (shorter ones are a piece
// blinking at the frame's edge): when, how many and which, most first, then
// longest first.
export type Moment = { from: number; to: number; count: number; pieces: { id: string; name: string }[] };
export function busiest(pieces: readonly Piece[], tracks: readonly Track[], ps: readonly number[], least = .0015): Moment[] {
  const sets = inView(pieces, tracks, ps), out: Moment[] = [];
  let start = 0;
  for (let i = 1; i <= ps.length; i++) {
    if (i < ps.length && sets[i].join() === sets[start].join()) continue;
    const set = sets[start];
    if (set.length > CROWDED && ps[i - 1] - ps[start] >= least) {
      out.push({ from: ps[start], to: ps[i - 1], count: set.length, pieces: set.map(k => ({ id: pieces[k].id, name: pieces[k].name })) });
    }
    start = i;
  }
  return out.sort((a, b) => b.count - a.count || (b.to - b.from) - (a.to - a.from));
}

// Each run of samples where more than CROWDED counted pieces are in view:
// where it starts and ends, its most at once and where, and everything
// counted in view during it, by name, with when each was. Runs less than
// `least` apart are joined, so one piece blinking at the frame's edge
// doesn't split a moment.
export type Crowded = { from: number; to: number; peak: number; at: number; pieces: { id: string; name: string; from: number; to: number }[] };
export function crowdedMoments(pieces: readonly Piece[], tracks: readonly Track[], ps: readonly number[], counts = crowding(pieces, tracks, ps), least = .002): Crowded[] {
  const runs: [number, number][] = [];
  counts.forEach((n, i) => {
    if (n <= CROWDED) return;
    const last = runs.at(-1);
    if (last && ps[i] - ps[last[1]] <= least) last[1] = i;
    else runs.push([i, i]);
  });
  const sets = inView(pieces, tracks, ps);
  return runs.map(([a, b]) => {
    let peak = 0, at = a;
    for (let i = a; i <= b; i++) if (counts[i] > peak) { peak = counts[i]; at = i; }
    const present = pieces.flatMap((piece, k) => {
      const inside = [];
      for (let i = a; i <= b; i++) if (sets[i].includes(k)) inside.push(i);
      return inside.length ? [{ id: piece.id, name: piece.name, from: ps[inside[0]], to: ps[inside.at(-1)!] }] : [];
    });
    return { from: ps[a], to: ps[b], peak, at: ps[at], pieces: present };
  });
}

// Dates for labels: "Jul 2017" during the voyage, "the opening" before it
// and "the dock" after it.
export function dateAt(p: number) {
  if (p < ARRIVAL_END) return 'the opening';
  if (p >= VOYAGE_END) return 'the dock';
  const [month, year] = dateLabel(p)!.split(' ');
  return `${month.slice(0, 3)} ${year}`;
}
// A stretch of progress as dates and p, e.g. "Jul 2017 – Mar 2018 (p .107–.196)".
const short = (p: number) => p.toFixed(3).replace(/^0/, '');
export function windowLabel(from: number, to: number) {
  const a = dateAt(from), b = dateAt(to);
  return `${a === b ? a : `${a} – ${b}`} (p ${short(from)}–${short(to)})`;
}

// What the axis shows: the chapters, each January, each milestone (its date
// first showing, and its stop, where the scroll cue lands) and the sky's
// keyframes with the colours between them.
export function axis(skyStep = .005) {
  const chapters = (Object.entries(CHAPTERS) as [Chapter, readonly [number, number]][]).map(([name, [from, to]]) => ({ name, from, to }));
  const years = Array.from({ length: 11 }, (_, i) => 2017 + i).map(year => ({ year, p: progressAt(`${year}-01`) }));
  const milestones = MILESTONES.map((m, i) => ({ id: m.id, month: m.month, date: dateAt(progressAt(m.month) + 1e-6), p: progressAt(m.month), stop: STOPS[i + 1], description: m.description }));
  const names = new Map<SkyKey, string>([[DAWN, 'dawn'], [MORNING, 'morning'], [MIDDAY, 'midday'], [AFTERNOON, 'afternoon'], [LATE, 'late'], [GOLDEN, 'golden'], [DUSK, 'dusk']]);
  const keys = SKY_KEYS.map(([p, key]) => ({ p, name: names.get(key) ?? '', zenith: key.zenith, horizon: key.horizon }));
  const sky = samples(skyStep).map(p => { const s = skyAt(p); return { p, zenith: hex(s.zenith), horizon: hex(s.horizon) }; });
  return { chapters, years, milestones, keys, sky };
}

// Everything the page and the script need for one layout: each piece's
// stretches in the picture (at least half faded in), faint ones (fading),
// drawn ones (its own logic has it on, in the picture or not) and counting
// ones (in the picture and competing for attention); the crowding
// count, sampled every `step`; the crowded stretches; and the busiest moments.
export function timeline(pieces: readonly Piece[], lens: Lens, step = STEP) {
  const ps = samples(step), poses = ps.map(p => cameraPose(p, lens.width));
  const tracks = pieces.map(piece => trackOf(piece, lens, ps, poses));
  const counts = crowding(pieces, tracks, ps);
  return {
    step,
    pieces: pieces.map((piece, k) => ({
      id: piece.id, name: piece.name, group: piece.group, file: piece.file, bank: piece.bank, note: piece.note ?? null,
      counted: piece.counts !== false,
      seen: spans(tracks[k].seen, ps), faint: spans(tracks[k].seen, ps, 1e-6), drawn: spans(tracks[k].drawn, ps, 1e-6),
      counting: spans(ps.map((p, i) => tracks[k].seen[i] >= IN_PICTURE.shown && countsAt(piece, p) ? 1 : 0), ps),
    })),
    counts,
    crowded: crowdedMoments(pieces, tracks, ps, counts),
    busiest: busiest(pieces, tracks, ps),
  };
}
export type Timeline = ReturnType<typeof timeline>;
