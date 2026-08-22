import * as THREE from 'three';
import { addStrandAttributes } from './strandGeometry';
import { fbm3 } from './ropeNoise';

/**
 * A laid rope, generated.
 *
 * The alternative to this file is a sculpted rope imported from Blender. That
 * was rejected: a laid rope is *n* circles whose centres orbit the centreline
 * while travelling along it, which is a shape with no artistry in it and six
 * numbers behind it. Generating it means every one of those six is a live knob
 * rather than a re-export, the UVs are exact rather than unwrapped by hand, and
 * there is no tile to make seamless because the geometry follows the real curve
 * from the start.
 *
 * Blender still wins for the knot and for frayed ends — one-off shapes with
 * irregularity a formula cannot express. It loses here.
 *
 * What this buys over buildRopeGeometry's tube-plus-cosine-bulge: the strands
 * are separate solids, so they tuck *under* each other. The bulge could only
 * ever scallop a single surface — it has no way to make one strand pass behind
 * the next, and that overlap is most of what reads as rope.
 */

/**
 * The rope's own frame, sampled once per slice.
 *
 * Shared with the fibre scatter in ropeFuzz.ts, and shared across all strands
 * within a single build: the old tube geometry called getPointAt once per
 * *vertex*, 70k times, which is why this builds faster despite having more of
 * them.
 */
export interface RopeFrames {
  /** Slice count is `along + 1`. */
  along: number;
  /** Centreline. */
  cs: THREE.Vector3[];
  /** Curve direction. */
  ts: THREE.Vector3[];
  /** Across. */
  bs: THREE.Vector3[];
  /** The third axis, completing the frame. */
  ns: THREE.Vector3[];
}

export function buildRopeFrames(curve: THREE.Curve<THREE.Vector3>, along: number): RopeFrames {
  const slices = along + 1;
  const cs: THREE.Vector3[] = new Array(slices);
  const ts: THREE.Vector3[] = new Array(slices);
  const bs: THREE.Vector3[] = new Array(slices);
  const ns: THREE.Vector3[] = new Array(slices);
  const up = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i < slices; i++) {
    const u = i / along;
    const c = curve.getPointAt(u, new THREE.Vector3());
    const t = curve.getTangentAt(u, new THREE.Vector3()).normalize();
    // Fixed world-up reference rather than a Frenet frame, matching the silk:
    // Frenet frames roll unpredictably through inflection points, and here that
    // would make the whole lay corkscrew at random.
    const b = new THREE.Vector3().crossVectors(t, up);
    if (b.lengthSq() < 1e-8) b.set(1, 0, 0);
    b.normalize();

    cs[i] = c;
    ts[i] = t;
    bs[i] = b;
    ns[i] = new THREE.Vector3().crossVectors(b, t).normalize();
  }

  return { along, cs, ts, bs, ns };
}

/**
 * n circles of radius r, centres orbiting at L, each touching both neighbours
 * and all inscribed in `radius`:
 *
 *   chord between adjacent centres = 2 L sin(pi/n) = 2r    (touching)
 *   L + r = radius                                         (inscribed)
 */
export function ropeLayDimensions(radius: number, strands: number, strandFill = 1) {
  const layRadius = radius / (1 + Math.sin(Math.PI / strands));
  return { layRadius, strandRadius: layRadius * Math.sin(Math.PI / strands) * strandFill };
}

export interface LaidRopeOptions {
  /** Strands laid around the axis. Real rope is 3. Minimum 2. */
  strands?: number;
  /** Outer radius of the finished rope. Strand size is derived from it. */
  radius?: number;
  /**
   * Turns of the lay over the full length.
   *
   * The most visible parameter here, and the easy one to misjudge, because there
   * are two different angles and only one of them is what you see:
   *
   * - the **strand centre** angle, at the orbit radius (~0.33)
   * - the **crown** angle, at the outer radius (0.62) — the ridge running along
   *   the top of each strand, which is the line your eye actually traces
   *
   * The crown angle is roughly *twice* the centre angle, so a rope that
   * measures a modest 29 degrees at the strand centres shows 46-degree stripes.
   * Both are reported in LaidRopeStats; tune against `crownAngle`.
   *
   * 84 turns puts the crown at ~36 degrees and the lay length at ~4.3 rope
   * diameters, which is inside the 3.5-4.5 range real three-strand rope is
   * specified at. Fewer turns runs the strands more along the rope.
   */
  turns?: number;
  /**
   * Slices per turn of the lay.
   *
   * The constraint the old tube geometry expressed as a bare 2800: tessellation
   * is set by the lay, not by the wave. Expressing it per-turn means changing
   * `turns` cannot silently under-tessellate. Each strand's path bends through
   * ~3.7 radians per turn, so 24 slices is ~9 degrees of facet — smooth enough
   * on the silhouette, which is where faceting shows.
   */
  segmentsPerTurn?: number;
  /** Absolute override for the above, if you want a specific number. */
  lengthSegments?: number;
  /** Dots around each strand. 12 is round enough at this strand radius. */
  radialSegments?: number;
  /**
   * Scales each strand's radius. 1 makes neighbours exactly touch.
   *
   * Below 1 opens visible gaps between strands and shows the core through them;
   * above 1 they interpenetrate, which reads as a softer, fatter rope and hides
   * the core. Slightly above 1 is usually the flattering direction.
   */
  strandFill?: number;
  /**
   * Fray: noise displacement of the strand surface, as a fraction of the strand
   * radius.
   *
   * This is what stops the rope reading as extruded plastic. It is deliberately
   * *lumpiness*, not fibre — at 24 slices per turn the finest wavelength the
   * mesh can hold is about a sixth of the rope diameter, so no amount of
   * amplitude here will produce hair. Stray fibres are separate geometry; see
   * ropeFuzz.ts.
   *
   * 0 keeps the analytic normals. Anything above 0 switches to averaged ones,
   * because once the surface is noisy the smooth surface's exact normals are
   * the wrong answer, precisely computed.
   */
  fray?: number;
  /**
   * Lay the yarn texture against the strand lay, as real rope does — strands
   * one way, yarns the other, which is what stops rope unravelling.
   *
   * Also the reason the fibres read as running *along* the rope: the strand's
   * surface frame is already tilted by the crown angle, so a 45-degree yarn
   * laid against it lands close to the rope's axis. Turning this off puts the
   * yarn at nearly a right angle to the rope, which looks like bandaging.
   */
  counterLay?: boolean;
}

export interface LaidRopeStats {
  layRadius: number;
  strandRadius: number;
  /** Degrees off the axis at the strand centres. The specification number. */
  layAngle: number;
  /** Degrees off the axis at the outer radius. **The angle you can see.** */
  crownAngle: number;
  /** One turn of the lay, in rope diameters. Real rope is ~3.5-4.5. */
  layLength: number;
  /** Arc length of one strand — longer than the rope by 1/cos(layAngle). */
  strandLength: number;
  /** Texture tiles along one strand at repeat (1,1). */
  tiles: number;
  vertices: number;
  triangles: number;
}

/**
 * @returns geometry carrying the same attribute set as the tube.
 *          `userData.rope` holds a LaidRopeStats.
 */
export function buildLaidRopeGeometry(
  curve: THREE.Curve<THREE.Vector3>,
  {
    strands = 3,
    radius = 0.62,
    turns = 84,
    segmentsPerTurn = 24,
    lengthSegments,
    radialSegments = 12,
    strandFill = 1,
    fray = 0.12,
    counterLay = true,
  }: LaidRopeOptions = {},
) {
  const n = Math.max(2, Math.round(strands));
  const along = lengthSegments ?? Math.ceil(turns * segmentsPerTurn);
  const slices = along + 1;
  const ring = radialSegments + 1;

  const { layRadius, strandRadius } = ropeLayDimensions(radius, n, strandFill);
  const circumference = 2 * Math.PI * strandRadius;
  const frayAmp = strandRadius * fray;

  const { cs, ts, bs, ns } = buildRopeFrames(curve, along);

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const centers: number[] = [];
  const offsets: number[] = [];
  const tangents: number[] = [];
  const binormals: number[] = [];
  const us: number[] = [];
  const vs: number[] = [];
  const indices: number[] = [];

  // The strand's own centreline, plus arc length along it for the U coordinate.
  const path: THREE.Vector3[] = new Array(slices);
  const arc = new Float64Array(slices);

  const strandTangent = new THREE.Vector3();
  const outward = new THREE.Vector3();
  const across = new THREE.Vector3();
  const nrm = new THREE.Vector3();

  let maxArc = 0;

  for (let k = 0; k < n; k++) {
    const phase = (2 * Math.PI * k) / n;
    // Offset the noise per strand so neighbours do not share a bump pattern.
    const fraySeed = k * 37.1;

    for (let i = 0; i < slices; i++) {
      const angle = phase + 2 * Math.PI * turns * (i / along);
      path[i] = new THREE.Vector3()
        .copy(cs[i]!)
        .addScaledVector(bs[i]!, Math.cos(angle) * layRadius)
        .addScaledVector(ns[i]!, Math.sin(angle) * layRadius);
    }

    arc[0] = 0;
    for (let i = 1; i < slices; i++) arc[i] = arc[i - 1]! + path[i]!.distanceTo(path[i - 1]!);
    maxArc = Math.max(maxArc, arc[slices - 1]!);

    for (let i = 0; i < slices; i++) {
      const centre = path[i]!;
      const ropeCentre = cs[i]!;

      // Tangent of the *strand's* helical path, by central difference. Doing
      // this rather than reusing the rope tangent is the difference between
      // round strands and strands squashed by 1/cos(layAngle) — at 21 degrees,
      // 7% thinner in one direction, which reads as wound tape.
      strandTangent
        .subVectors(path[Math.min(slices - 1, i + 1)]!, path[Math.max(0, i - 1)]!)
        .normalize();

      // Cross-section basis. Referenced to "outward from the rope axis" so each
      // strand's seam and texture stay oriented to the rope's surface instead of
      // barrel-rolling along the helix.
      outward.subVectors(centre, ropeCentre);
      outward.addScaledVector(strandTangent, -outward.dot(strandTangent)).normalize();
      across.crossVectors(strandTangent, outward).normalize();

      const s = arc[i]!;

      for (let j = 0; j < ring; j++) {
        const phi = (j / radialSegments) * Math.PI * 2;
        // Outward from the strand's own axis — which *is* the surface normal of
        // a tube, exactly, so at fray 0 these need no averaging.
        nrm.copy(outward).multiplyScalar(Math.cos(phi)).addScaledVector(across, Math.sin(phi));

        // Sampled on a circle in the "around" axes so it wraps seamlessly; see
        // fbm3. Fed the strand's own arc length so the bumps travel with the
        // lay rather than sitting in a stationary field the rope slides through.
        const r =
          strandRadius +
          (frayAmp > 0
            ? fbm3(s * 2.2 + fraySeed, Math.cos(phi), Math.sin(phi)) * frayAmp
            : 0);

        const px = centre.x + nrm.x * r;
        const py = centre.y + nrm.y * r;
        const pz = centre.z + nrm.z * r;

        positions.push(px, py, pz);
        normals.push(nrm.x, nrm.y, nrm.z);

        /**
         * U in circumferences of arc, V in turns around the strand.
         *
         * This is the whole reason not to unwrap by hand: it makes repeat (1,1)
         * aspect-correct by construction, so the texture's 45-degree yarns
         * arrive at 45 degrees with no proportion to maintain. The old tube
         * needed (120, 1) and sheared the twist if you touched either number.
         */
        uvs.push(s / circumference, counterLay ? 1 - j / radialSegments : j / radialSegments);

        centers.push(ropeCentre.x, ropeCentre.y, ropeCentre.z);
        offsets.push(px - ropeCentre.x, py - ropeCentre.y, pz - ropeCentre.z);
        // The *rope's* tangent and binormal, not the strand's: the shader uses
        // these to step the centreline wave, which belongs to the rope.
        tangents.push(ts[i]!.x, ts[i]!.y, ts[i]!.z);
        binormals.push(bs[i]!.x, bs[i]!.y, bs[i]!.z);
        // aU must stay the rope parameter — it drives the wave phase and the
        // taper that holds the braid and the knot still.
        us.push(i / along);
        vs.push(j / radialSegments);
      }
    }

    // Wound opposite to buildSilkGeometry. Advancing j turns from `outward`
    // toward cross(strandTangent, outward), which puts the silk's winding
    // face-inward here — a front-face-culled rope that renders as a hole.
    const base = k * slices * ring;
    for (let i = 0; i < along; i++) {
      for (let j = 0; j < radialSegments; j++) {
        const a = base + i * ring + j;
        const b = a + ring;
        indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  addStrandAttributes(geo, centers, offsets, tangents, binormals, us, vs);

  if (frayAmp > 0) {
    geo.computeVertexNormals();
    weldRingSeamNormals(geo, n, slices, ring, radialSegments);
  }

  const ropeLength = curve.getLength();
  const pitch = ropeLength / turns;
  const stats: LaidRopeStats = {
    layRadius,
    strandRadius,
    layAngle: (Math.atan((2 * Math.PI * layRadius) / pitch) * 180) / Math.PI,
    crownAngle: (Math.atan((2 * Math.PI * radius) / pitch) * 180) / Math.PI,
    layLength: pitch / (2 * radius),
    strandLength: maxArc,
    tiles: maxArc / circumference,
    vertices: positions.length / 3,
    triangles: indices.length / 3,
  };
  geo.userData.rope = stats;

  return geo;
}

/**
 * The first and last vertex of every ring sit at the same point but are separate
 * vertices, because they need UV 0 and UV 1. computeVertexNormals gives each of
 * them only the faces on its own side, which lights that shared edge as a crease
 * — one hairline running the full length of every strand. Averaging the pair
 * closes it.
 */
function weldRingSeamNormals(
  geo: THREE.BufferGeometry,
  strands: number,
  slices: number,
  ring: number,
  radialSegments: number,
) {
  const nrm = geo.getAttribute('normal') as THREE.BufferAttribute;
  const v = new THREE.Vector3();

  for (let k = 0; k < strands; k++) {
    for (let i = 0; i < slices; i++) {
      const a = k * slices * ring + i * ring;
      const b = a + radialSegments;
      v.set(
        nrm.getX(a) + nrm.getX(b),
        nrm.getY(a) + nrm.getY(b),
        nrm.getZ(a) + nrm.getZ(b),
      ).normalize();
      nrm.setXYZ(a, v.x, v.y, v.z);
      nrm.setXYZ(b, v.x, v.y, v.z);
    }
  }
  nrm.needsUpdate = true;
}
