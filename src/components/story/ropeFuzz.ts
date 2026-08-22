import * as THREE from 'three';
import { addStrandAttributes } from './strandGeometry';
import { buildRopeFrames, ropeLayDimensions } from './ropeGeometry';
import { makeRandom } from './ropeNoise';

/**
 * Stray fibres.
 *
 * The rope surface can be roughened (see `fray` in ropeGeometry.ts) but it can
 * never be made hairy: at 24 slices per turn the mesh's finest wavelength is
 * about a sixth of the rope diameter, and a fibre is two orders of magnitude
 * finer than that. Raising the tessellation until fibres fit would cost millions
 * of vertices to model something that is almost entirely empty space.
 *
 * So the fibres are their own geometry — one tapered spike each, scattered over
 * the surface. This is the thing that actually reads as sisal rather than as a
 * smooth tube with a rope photo on it, because it breaks the silhouette, and the
 * silhouette is the one thing a texture can never touch.
 *
 * Each spike is a single triangle. Flat, so it vanishes edge-on — which is why
 * they get a random roll: some disappearing at any given angle reads as natural
 * variation in fibre density rather than as a defect. Two crossed triangles per
 * fibre would fix it at double the cost and is not worth it at this scale.
 *
 * Shares the rope's uniforms and the `laid` shader mode, so it waves with the
 * rope instead of hanging in space beside it.
 */

export interface RopeFuzzOptions {
  strands?: number;
  radius?: number;
  turns?: number;
  strandFill?: number;
  /** Total fibres over the whole rope. */
  count?: number;
  /** Fibre length, world units. Sampled between these. */
  minLength?: number;
  maxLength?: number;
  /** Fibre width at the root. */
  width?: number;
  /**
   * How much fibres lie along the strand versus stand off it. 0 lays them flat
   * along the yarn, 1 stands them straight out.
   *
   * Low values are what you want: real fibres have been twisted into the rope
   * and mostly escape at a shallow angle. High values look like a bottle brush.
   */
  standoff?: number;
  seed?: number;
}

/**
 * Slices used for the root-position lookup. Independent of the rope's own
 * tessellation: fibre roots only need to land *near* the surface, and 2000
 * slices over ~450 units puts them within a quarter unit, well under a fibre
 * length.
 */
const ROOT_SLICES = 2000;

export function buildFuzzGeometry(
  curve: THREE.Curve<THREE.Vector3>,
  {
    strands = 3,
    radius = 0.62,
    turns = 84,
    strandFill = 1,
    count = 24000,
    minLength = 0.06,
    maxLength = 0.24,
    width = 0.012,
    standoff = 0.35,
    seed = 20260822,
  }: RopeFuzzOptions = {},
) {
  const n = Math.max(2, Math.round(strands));
  const { layRadius, strandRadius } = ropeLayDimensions(radius, n, strandFill);
  const { along, cs, ts, bs, ns } = buildRopeFrames(curve, ROOT_SLICES);
  const rand = makeRandom(seed);

  const positions: number[] = [];
  const normals: number[] = [];
  const centers: number[] = [];
  const offsets: number[] = [];
  const tangents: number[] = [];
  const binormals: number[] = [];
  const us: number[] = [];
  const vs: number[] = [];

  const centre = new THREE.Vector3();
  const nextCentre = new THREE.Vector3();
  const strandTangent = new THREE.Vector3();
  const outward = new THREE.Vector3();
  const across = new THREE.Vector3();
  const surfaceN = new THREE.Vector3();
  const root = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const side = new THREE.Vector3();
  const tip = new THREE.Vector3();

  /** Strand centre at slice i, strand k. */
  const strandCentreAt = (i: number, k: number, out: THREE.Vector3) => {
    const angle = (2 * Math.PI * k) / n + 2 * Math.PI * turns * (i / along);
    return out
      .copy(cs[i]!)
      .addScaledVector(bs[i]!, Math.cos(angle) * layRadius)
      .addScaledVector(ns[i]!, Math.sin(angle) * layRadius);
  };

  for (let f = 0; f < count; f++) {
    const i = Math.min(along - 1, Math.floor(rand() * along));
    const k = Math.floor(rand() * n);

    // Mirrors the sweep in ropeGeometry.ts. Kept separate rather than shared
    // because that one walks slices in order and can difference its neighbours
    // for free, while this one lands on random slices.
    strandCentreAt(i, k, centre);
    strandCentreAt(i + 1, k, nextCentre);
    strandTangent.subVectors(nextCentre, centre).normalize();

    outward.subVectors(centre, cs[i]!);
    outward.addScaledVector(strandTangent, -outward.dot(strandTangent)).normalize();
    across.crossVectors(strandTangent, outward).normalize();

    /**
     * Only the outward-facing arc gets fibres.
     *
     * Beyond +/-150 degrees from outward, the strand is in contact with its
     * neighbours and the remaining 60 degrees is a sealed void at the rope's
     * core. Fibres there are invisible at best and poke through a neighbour at
     * worst — pure cost.
     */
    const phi = (rand() * 2 - 1) * (150 * (Math.PI / 180));
    const cp = Math.cos(phi);
    const sp = Math.sin(phi);
    surfaceN.copy(outward).multiplyScalar(cp).addScaledVector(across, sp);
    root.copy(centre).addScaledVector(surfaceN, strandRadius * 0.96);

    // Mostly along the yarn, tilted out by `standoff`, with the along-component
    // free to point either way down the strand.
    const backwards = rand() < 0.5 ? -1 : 1;
    dir
      .copy(strandTangent)
      .multiplyScalar(backwards * (1 - standoff))
      .addScaledVector(surfaceN, standoff * (0.5 + rand() * 0.9))
      .addScaledVector(across, (rand() * 2 - 1) * 0.25)
      .normalize();

    // Random roll of the flat triangle about its own axis.
    side.crossVectors(dir, surfaceN);
    if (side.lengthSq() < 1e-8) side.copy(across);
    side.normalize();
    const roll = rand() * Math.PI;
    side.applyAxisAngle(dir, roll);

    const len = minLength + rand() * (maxLength - minLength);
    const halfWidth = width * (0.6 + rand() * 0.8) * 0.5;

    // A little droop, so fibres curve away instead of radiating like needles.
    tip
      .copy(root)
      .addScaledVector(dir, len)
      .addScaledVector(surfaceN, -len * 0.18 * rand());

    const c = cs[i]!;
    const u = i / along;

    /**
     * All three vertices take the *surface* normal, not the triangle's own.
     *
     * A spike lit by its own geometry reads as a black splinter — it faces
     * sideways, so it catches none of the light the rope beside it is catching.
     * Borrowing the surface normal makes each fibre shade as though it were part
     * of the rope, which is what stops the fuzz looking like dirt.
     */
    for (const p of [
      root.clone().addScaledVector(side, -halfWidth),
      root.clone().addScaledVector(side, halfWidth),
      tip,
    ]) {
      positions.push(p.x, p.y, p.z);
      normals.push(surfaceN.x, surfaceN.y, surfaceN.z);
      centers.push(c.x, c.y, c.z);
      offsets.push(p.x - c.x, p.y - c.y, p.z - c.z);
      tangents.push(ts[i]!.x, ts[i]!.y, ts[i]!.z);
      binormals.push(bs[i]!.x, bs[i]!.y, bs[i]!.z);
      us.push(u);
      vs.push(0);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  addStrandAttributes(geo, centers, offsets, tangents, binormals, us, vs);
  // Unindexed: every triangle has its own three vertices anyway, so an index
  // buffer would be three extra integers per fibre buying nothing.
  geo.userData.fuzz = { fibres: count, vertices: positions.length / 3 };
  return geo;
}
