import * as THREE from 'three';

/**
 * The spine is the single path the story travels along. Both strands are
 * expressed as offsets from it, which is what guarantees they actually
 * converge at the braid instead of merely getting close.
 *
 * Forward is -Z. t runs 0 (start of the story) to 1 (the knot).
 */

export const STORY_LENGTH = 420; // world units from start to knot

/** Where the two lives meet. Everything before this is two separate stories. */
export const BRAID_T = 0.55;

/** How far apart the strands are at t=0. */
export const MAX_SEPARATION = 26;

/** Radius of the double helix after the braid. */
export const BRAID_RADIUS = 4.2;

/** How many times they wind around each other between braid and knot. */
export const BRAID_TURNS = 5.5;

export type Side = 'rope' | 'silk';

/** rope = -1, silk = +1. Used to mirror the pre-braid separation. */
export const sideSign = (side: Side) => (side === 'rope' ? -1 : 1);

function easeInOutCubic(x: number) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/**
 * The shared centreline. Drifts laterally and descends slightly so the
 * camera ride isn't a straight tunnel.
 */
export function spineAt(t: number, out = new THREE.Vector3()) {
  return out.set(
    Math.sin(t * Math.PI * 1.6) * 14,
    Math.sin(t * Math.PI * 2.4) * 9 - t * 6,
    -t * STORY_LENGTH,
  );
}

/** Current gap between the strands, in world units. 0 once braided. */
export function separationAt(t: number) {
  if (t >= BRAID_T) return 0;
  const k = t / BRAID_T;
  return (1 - easeInOutCubic(k)) * MAX_SEPARATION;
}

/**
 * Offset of one strand from the spine.
 *
 * Before the braid: mirrored lateral separation plus independent wander, so
 * each life has its own shape.
 * After the braid: a double helix that ramps in quickly and tapers to zero
 * at the knot, so the knot itself reads clean.
 */
export function strandOffsetAt(t: number, side: Side, out = new THREE.Vector3()) {
  const s = sideSign(side);

  if (t < BRAID_T) {
    const k = t / BRAID_T;
    const sep = separationAt(t);
    // Phase-shifted so the two strands wander independently.
    const phase = side === 'rope' ? 0 : 1.7;
    const wanderY = Math.sin(k * Math.PI * 3 + phase) * 6;
    const wanderZ = Math.cos(k * Math.PI * 2.2 + phase) * 4;
    return out.set(s * sep, wanderY, wanderZ);
  }

  const k = (t - BRAID_T) / (1 - BRAID_T);
  // Ramp in over the first ~15% of the braid, taper to nothing at the knot.
  const amp = BRAID_RADIUS * Math.min(1, k * 6.5) * (1 - easeInOutCubic(k));
  const phase = k * Math.PI * 2 * BRAID_TURNS + (side === 'silk' ? Math.PI : 0);
  return out.set(Math.cos(phase) * amp, Math.sin(phase) * amp, 0);
}

/** World position of a point on a strand, ignoring shader displacement. */
export function strandPointAt(t: number, side: Side, out = new THREE.Vector3()) {
  const spine = spineAt(t, out);
  const offset = strandOffsetAt(t, side, _tmp);
  return spine.add(offset);
}
const _tmp = new THREE.Vector3();

function sampleCurve(fn: (t: number) => THREE.Vector3, segments: number) {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) pts.push(fn(i / segments));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
  curve.arcLengthDivisions = segments * 2;
  return curve;
}

export function buildStrandCurve(side: Side, segments = 240) {
  return sampleCurve((t) => strandPointAt(t, side, new THREE.Vector3()), segments);
}

/**
 * The camera rides its own path — never a strand, which would be nauseating.
 * It pulls back when the strands are far apart and closes in as they braid,
 * so the framing tightens automatically at the emotional centre.
 */
export function cameraPositionAt(t: number, out = new THREE.Vector3()) {
  const sep = separationAt(t);
  const s = spineAt(t, out);
  const back = 30 + sep * 1.15;

  /**
   * Once the strands braid they lie on the spine — and the camera path runs
   * down the spine too, so head-on the strands whip past the lens and read as
   * giant tubes. Drifting to one side turns that into a three-quarter view of
   * the braid, which is both legible and a nice move in its own right: the
   * camera swings around as the two lives come together.
   */
  const drift = THREE.MathUtils.clamp((t - BRAID_T * 0.62) / 0.28, 0, 1);
  const lateral = 16 * drift * drift * (3 - 2 * drift); // smoothstep
  const right = spineRightAt(t, _camRight);

  return out.set(
    s.x + right.x * lateral,
    s.y + 5 + sep * 0.12 + drift * 3,
    s.z + back + right.z * lateral,
  );
}
const _camRight = new THREE.Vector3();

export function buildCameraCurve(segments = 240) {
  return sampleCurve((t) => cameraPositionAt(t, new THREE.Vector3()), segments);
}

/** What the camera looks at: a little further down the spine than it sits. */
export function cameraTargetAt(t: number, out = new THREE.Vector3()) {
  return spineAt(Math.min(1, t + 0.035), out);
}

/**
 * Local "right" of the spine, used to push shared billboards off the centre
 * line. Without this the camera flies straight through them: after the braid
 * the strands collapse onto the spine, and the camera path runs down that same
 * line, so anything hanging there is directly in its way.
 */
export function spineRightAt(t: number, out = new THREE.Vector3()) {
  const a = spineAt(Math.min(t, 0.996), out);
  const b = spineAt(Math.min(1, t + 0.004), _tmp2);
  const tangent = b.sub(a).normalize();
  return out.crossVectors(tangent, UP).normalize();
}
const _tmp2 = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/** Minimum lateral distance any billboard must keep from the camera path. */
export const MIN_LATERAL_CLEARANCE = 13;
