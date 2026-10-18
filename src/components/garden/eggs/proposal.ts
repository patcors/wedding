// April 2026, they get engaged: on the catamaran's deck a little man in
// Patrick's soft yellow goes down on one knee to a little woman in Amelia's
// teal and holds up a ring. Just before the date shows they come out on deck
// between the mast and the sterns, facing each other across it, Amelia to
// port and Patrick to starboard as their boats were; as it shows he kneels,
// and she lifts her hands to her face. He stays down while the date holds
// and the big sail unrolls, then stands, and they turn to face down the
// river side by side, hand in hand, and ride on so round the bend to the
// dock. Each step fires once the scroll reaches it and plays in real time,
// as the salsa turn does, so nobody is caught half way down when the guest
// stops. Drawn aboard the catamaran (Proposal.tsx, inside VoyageBoats'
// group, so they bob and heel with it), the figures in proposalGeometry.ts.
// Pure, so it can be tested.
import { DATES, scrolledSince } from '../journey.ts';

// The deck's top, where the planks lie (VoyageBoats lays them at .215, .028
// thick), in the catamaran's model units: x to starboard, y up, z aft.
export const DECK_TOP = .215 + .028 / 2;

// Each step's cue, in shares of scroll since the engagement's date first
// shows, and how long it takes once the scroll reaches it, in seconds: they
// come out on deck (fading in) as the old masts come down, he kneels as the
// date shows, and stands once the big sail has unrolled (RIG_CHANGE), as
// the monogram goes up. A guest who arrives more than `late` past a step that
// hasn't started (a jump) finds it done; going back before it plays it back.
// `z` is where they stand along the deck, aft of the big mast and its boom,
// forward of the sterns where the petals blow off. Larger on a phone.
export const PROPOSAL = {
  appear: { cue: -.15, seconds: 1.2 },
  kneel: { cue: 0, seconds: 1.6 },
  rise: { cue: .62, seconds: 2.4 },
  late: .25,
  z: .22,
  scale: { desktop: 1, mobile: 1.2 },
} as const;
export type Step = 'appear' | 'kneel' | 'rise';
export type Stages = Record<Step, number>;
export const STEPS: readonly Step[] = ['appear', 'kneel', 'rise'];
export const proposalTime = (p: number) => scrolledSince(DATES.engaged, p);

// How far through a step (0 to 1) after a frame of `step` seconds (0 while
// paused), from `u` the frame before, `t` shares since the date. Under
// reduced motion each still shows every step settled from its cue.
export function proposalStage(u: number, t: number, name: Step, step: number, reduced = false) {
  const { cue, seconds } = PROPOSAL[name];
  if (reduced) return t >= cue - 1e-6 ? 1 : 0;
  if (t >= cue) return u === 0 && t > cue + PROPOSAL.late ? 1 : Math.min(1, u + step / seconds);
  return u === 1 && t < cue - PROPOSAL.late ? 0 : Math.max(0, u - step / seconds);
}
export const proposalStages = (stages: Stages, t: number, step: number, reduced = false): Stages =>
  Object.fromEntries(STEPS.map(name => [name, proposalStage(stages[name], t, name, step, reduced)])) as Stages;

// Each figure's proportions, in model units: a stylised toy with a large
// head, the woman a little smaller. `shoe` is half a shoe's height.
export type Who = 'amelia' | 'patrick';
export const FIGURE = {
  patrick: { shoe: .008, shin: .074, thigh: .074, hip: .02, torso: .1, neck: .012, head: .031, shoulder: .04, upperArm: .062, forearm: .06, limb: .012, toe: .028 },
  amelia: { shoe: .007, shin: .066, thigh: .066, hip: .018, torso: .09, neck: .011, head: .029, shoulder: .035, upperArm: .055, forearm: .053, limb: .011, toe: .024 },
} as const;
export type Proportions = (typeof FIGURE)[Who];

// The bones, each with its parent and where it sits on it at rest (standing,
// arms down). A limb hangs down its bone's −y, a foot points along −z, the
// way the figure faces.
export const BONES = ['root', 'hips', 'spine', 'head', 'upperArmL', 'foreArmL', 'upperArmR', 'foreArmR', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR', 'ring'] as const;
export type Bone = (typeof BONES)[number];
type Vec = [number, number, number];
export const boneParent: Record<Bone, Bone | null> = {
  root: null, hips: 'root', spine: 'hips', head: 'spine',
  upperArmL: 'spine', foreArmL: 'upperArmL', upperArmR: 'spine', foreArmR: 'upperArmR',
  thighL: 'hips', shinL: 'thighL', footL: 'shinL', thighR: 'hips', shinR: 'thighR', footR: 'shinR', ring: 'foreArmR',
};
export function boneOffset(f: Proportions, bone: Bone, hips = standingHips(f)): Vec {
  const side = bone.endsWith('L') ? -1 : 1;
  switch (bone) {
    case 'hips': return [0, hips, 0];
    case 'head': return [0, f.torso + f.neck, 0];
    case 'upperArmL': case 'upperArmR': return [side * f.shoulder, f.torso - .012, 0];
    case 'foreArmL': case 'foreArmR': return [0, -f.upperArm, 0];
    case 'thighL': case 'thighR': return [side * f.hip, 0, 0];
    case 'shinL': case 'shinR': return [0, -f.thigh, 0];
    case 'footL': case 'footR': return [0, -f.shin, 0];
    case 'ring': return [0, -f.forearm, 0];
    default: return [0, 0, 0];
  }
}
export const standingHips = (f: Proportions) => f.shoe + f.shin + f.thigh;

// A pose: where the figure stands on the deck, which way it faces (yaw about
// +y; 0 faces the bows, + turns it to port), and each bone's turn (Euler
// x, y, z in that order, as three.js applies them). The hips' height follows
// from the legs, so the lowest knee or shoe always rests on the deck.
export type Euler = [number, number, number];
export type Pose = { x: number; z: number; yaw: number; bones: Partial<Record<Bone, Euler>> };

type Matrix = number[]; // 3 × 3, row major
const multiply = (a: Matrix, b: Matrix): Matrix => Array.from({ length: 9 }, (_, i) => {
  const r = Math.floor(i / 3), c = i % 3;
  return a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
});
const apply = (m: Matrix, [x, y, z]: Vec): Vec => [m[0] * x + m[1] * y + m[2] * z, m[3] * x + m[4] * y + m[5] * z, m[6] * x + m[7] * y + m[8] * z];
const rotation = ([x, y, z]: Euler): Matrix => {
  const [cx, sx, cy, sy, cz, sz] = [Math.cos(x), Math.sin(x), Math.cos(y), Math.sin(y), Math.cos(z), Math.sin(z)];
  const rx = [1, 0, 0, 0, cx, -sx, 0, sx, cx], ry = [cy, 0, sy, 0, 1, 0, -sy, 0, cy], rz = [cz, -sz, 0, sz, cz, 0, 0, 0, 1];
  return multiply(multiply(rx, ry), rz);
};
const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

// Every bone's place and turn in the catamaran's frame (model units), and the
// points that matter: the joints' ends, the toes and the top of the head.
export function figurePoints(who: Who, pose: Pose, hips?: number, scale = 1) {
  const f = FIGURE[who], h = hips ?? groundedHips(who, pose);
  const frames = {} as Record<Bone, { at: Vec; turn: Matrix }>;
  for (const bone of BONES) {
    const parent = boneParent[bone];
    const local = rotation(bone === 'root' ? [0, pose.yaw, 0] : pose.bones[bone] ?? [0, 0, 0]);
    if (!parent) frames[bone] = { at: [pose.x, DECK_TOP, pose.z], turn: local };
    else {
      const up = frames[parent], offset = boneOffset(f, bone, h).map(v => v * scale) as Vec;
      frames[bone] = { at: add(up.at, apply(up.turn, offset)), turn: multiply(up.turn, local) };
    }
  }
  const end = (bone: Bone, v: Vec) => add(frames[bone].at, apply(frames[bone].turn, v.map(k => k * scale) as Vec));
  return {
    frames,
    knee: { L: frames.shinL.at, R: frames.shinR.at },
    ankle: { L: frames.footL.at, R: frames.footR.at },
    toe: { L: end('footL', [0, 0, -f.toe]), R: end('footR', [0, 0, -f.toe]) },
    hand: { L: end('foreArmL', [0, -f.forearm, 0]), R: frames.ring.at },
    shoulder: { L: frames.upperArmL.at, R: frames.upperArmR.at },
    head: end('head', [0, f.head, 0]), top: end('head', [0, f.head * 2.2, 0]),
  };
}
// The hips' height that sets the lowest knee, ankle or toe on the deck.
export function groundedHips(who: Who, pose: Pose) {
  const f = FIGURE[who], points = figurePoints(who, pose, 0);
  const low = Math.min(...(['L', 'R'] as const).flatMap(s => [
    points.knee[s][1] - f.limb, points.ankle[s][1] - Math.max(f.shoe, f.limb), points.toe[s][1] - f.shoe,
  ]));
  return DECK_TOP - low;
}

// The poses, each figure facing the other across the deck while he kneels,
// then turned down the river side by side, her right hand in his left, a
// step to starboard so the mast, seen from behind, rises beside them rather
// than out of their hands.
const Q = Math.PI / 2, TOGETHER = .08;
const RELAXED: Partial<Record<Bone, Euler>> = { upperArmL: [.05, 0, -.08], foreArmL: [.15, 0, 0], upperArmR: [.05, 0, .08], foreArmR: [.15, 0, 0] };
export const POSES: Record<Who, Record<'facing' | 'proposing' | 'together', Pose>> = {
  patrick: {
    facing: { x: .125, z: PROPOSAL.z, yaw: Q, bones: { ...RELAXED } },
    // Down on his left knee, his right foot forward and the ring held up to her in his right hand.
    proposing: { x: .13, z: PROPOSAL.z, yaw: Q, bones: {
      spine: [-.1, 0, 0], head: [.25, 0, 0],
      upperArmR: [1.45, 0, -.15], foreArmR: [.55, 0, 0], upperArmL: [.2, 0, -.05], foreArmL: [.3, 0, 0],
      thighR: [Q, 0, .05], shinR: [-Q, 0, 0], thighL: [-.05, 0, -.04], shinL: [-Q + .05, 0, 0], footL: [-Q, 0, 0],
    } },
    together: { x: .068 + TOGETHER, z: PROPOSAL.z, yaw: .25, bones: { head: [0, 0, .12], upperArmL: [.15, 0, -.27], foreArmL: [.1, 0, 0], upperArmR: [.05, 0, .08], foreArmR: [.15, 0, 0] } },
  },
  amelia: {
    facing: { x: -.1, z: PROPOSAL.z, yaw: -Q, bones: { ...RELAXED } },
    // Her hands to her face.
    proposing: { x: -.1, z: PROPOSAL.z, yaw: -Q, bones: { head: [-.15, 0, 0], upperArmL: [.8, 0, .4], foreArmL: [2.3, 0, 0], upperArmR: [.8, 0, -.4], foreArmR: [2.3, 0, 0] } },
    together: { x: -.068 + TOGETHER, z: PROPOSAL.z, yaw: -.25, bones: { head: [0, 0, -.15], upperArmR: [.15, 0, .33], foreArmR: [.1, 0, 0], upperArmL: [.05, 0, -.08], foreArmL: [.15, 0, 0] } },
  },
};

const ease = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
function blend(a: Pose, b: Pose, k: number): Pose {
  const bones: Partial<Record<Bone, Euler>> = {};
  for (const bone of BONES) {
    const from = a.bones[bone] ?? [0, 0, 0], to = b.bones[bone] ?? [0, 0, 0];
    bones[bone] = [lerp(from[0], to[0], k), lerp(from[1], to[1], k), lerp(from[2], to[2], k)];
  }
  return { x: lerp(a.x, b.x, k), z: lerp(a.z, b.z, k), yaw: lerp(a.yaw, b.yaw, k), bones };
}

// Both figures' poses for how far through each step they are, how solid
// they are (they fade in as they come out), and how large the ring shows:
// held up as he kneels, gone once it is on her finger. He gets up over the
// first half of `rise`, then they turn and take hands.
export function proposalPose({ appear, kneel, rise }: Stages) {
  const up = ease(rise / .55), turn = ease((rise - .4) / .6);
  const pose = (who: Who, k: number) => {
    const { facing, proposing, together } = POSES[who];
    return blend(blend(blend(facing, proposing, k), facing, up), together, turn);
  };
  return {
    patrick: pose('patrick', ease(kneel)),
    // She catches up a moment after he goes down.
    amelia: pose('amelia', ease((kneel - .3) / .7)),
    opacity: ease(appear), ring: ease(kneel) * (1 - turn),
  };
}
