import * as THREE from 'three';
import { BRAID_T } from './curves';

/**
 * GPU displacement for the strands.
 *
 * The geometry is built once and never touched again. Rebuilding TubeGeometry
 * on the CPU each frame would mean a buffer re-upload per frame and would
 * dominate the frame budget.
 */

export interface StrandUniforms {
  uTime: { value: number };
  uLength: { value: number };
  uAmp: { value: number };
  uFreq: { value: number };
  uSpeed: { value: number };
  /** Smoothed scroll velocity. Drives billow-on-move / settle-on-stop. */
  uVel: { value: number };
  /** How much velocity adds to amplitude. Rope should be much lower than silk. */
  uVelGain: { value: number };
  /** Cross-ribbon flutter — the detail that makes fabric read as fabric. */
  uCrossAmp: { value: number };
  uCrossFreq: { value: number };
  uBraidT: { value: number };
  /** Rope only: radial bulge of the strand lay, as a fraction of the radius. */
  uLayAmp: { value: number };
  /** How many large strands the rope is laid from. Real rope is 3. */
  uLayStrands: { value: number };
  /** Turns of the lay over the full length. Sets the strand pitch angle. */
  uLayTurns: { value: number };
}

export function makeStrandUniforms(overrides: Partial<Record<keyof StrandUniforms, number>> = {}) {
  const u: StrandUniforms = {
    uTime: { value: 0 },
    uLength: { value: 420 },
    uAmp: { value: 1 },
    uFreq: { value: 60 },
    uSpeed: { value: 1 },
    uVel: { value: 0 },
    uVelGain: { value: 0 },
    uCrossAmp: { value: 0 },
    uCrossFreq: { value: 2 },
    uBraidT: { value: BRAID_T },
    uLayAmp: { value: 0 },
    uLayStrands: { value: 3 },
    uLayTurns: { value: 0 },
  };
  for (const [k, v] of Object.entries(overrides)) {
    (u as any)[k].value = v;
  }
  return u;
}

const COMMON = /* glsl */ `
  attribute vec3 aCenter;
  attribute vec3 aOffset;
  attribute vec3 aTangent;
  attribute vec3 aBinormal;
  attribute float aU;
  attribute float aV;

  uniform float uTime;
  uniform float uLength;
  uniform float uAmp;
  uniform float uFreq;
  uniform float uSpeed;
  uniform float uVel;
  uniform float uVelGain;
  uniform float uCrossAmp;
  uniform float uCrossFreq;
  uniform float uBraidT;
  uniform float uLayAmp;
  uniform float uLayStrands;
  uniform float uLayTurns;

  /** Rotate a vector about a unit axis. Rodrigues' formula. */
  vec3 rotAbout(vec3 v, vec3 axis, float a) {
    float c = cos(a);
    float s = sin(a);
    return v * c + cross(axis, v) * s + axis * dot(axis, v) * (1.0 - c);
  }

  /**
   * The rope's lay: uLayStrands large strands spiralling uLayTurns times over
   * the full length. This is real geometry, unlike the normal map — it changes
   * the silhouette, which is the whole reason for its existence. A normal map
   * cannot make an outline lumpy no matter how strong you set it.
   *
   * The two scales are not in competition: a cable-laid rope genuinely is a
   * few large strands, each spun from many fine yarns. The strands are geometry
   * here; the ~26 yarns are the normal map.
   *
   * Returns -1..1, applied as a fraction of the tube radius.
   */
  float ropeLay(float u, float v) {
    return cos(6.2831853 * uLayStrands * (v - uLayTurns * u));
  }

  // Amplitude taper. The braid and the knot are the two most important reads
  // in the whole piece, so both are held still.
  float strandTaper(float u) {
    float start = smoothstep(0.0, 0.10, u);
    float braid = 1.0 - 0.8 * exp(-pow((u - uBraidT) / 0.055, 2.0));
    float knot  = (1.0 - smoothstep(0.86, 1.0, u));
    return start * braid * knot;
  }

  // Displaced centreline. Two octaves: a slow travelling wave plus a finer
  // ripple. Amplitude responds to scroll velocity.
  vec3 strandWave(vec3 c, float u) {
    float amp = uAmp * strandTaper(u) * (1.0 + uVel * uVelGain);
    float ph = u * uFreq - uTime * uSpeed;

    vec3 d = vec3(
      sin(ph)                * amp,
      cos(ph * 0.73 + 1.3)   * amp * 0.7,
      0.0
    );
    d += vec3(
      sin(ph * 2.7)  * amp * 0.18,
      cos(ph * 3.1)  * amp * 0.14,
      0.0
    );
    return c + d;
  }

  // Tangent of the displaced centreline, by finite difference one step along.
  vec3 strandTangent() {
    float du = 0.0015;
    vec3 c0 = strandWave(aCenter, aU);
    vec3 c1 = strandWave(aCenter + aTangent * (du * uLength), aU + du);
    return normalize(c1 - c0);
  }
`;

/**
 * - `ribbon` — the silk. Normals from the sweep frame, plus cross-wise flutter.
 * - `tube`   — the old rope: one surface, strands faked as a radial bulge.
 * - `laid`   — the generated rope, strands swept as separate solids.
 */
export type StrandMode = 'ribbon' | 'tube' | 'laid';

export function injectStrandDisplacement(
  material: THREE.Material,
  uniforms: StrandUniforms,
  mode: StrandMode,
) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    // begin_vertex expands to `vec3 transformed = vec3( position );`
    // beginnormal_vertex expands to `vec3 objectNormal = vec3( normal );`
    let vert = shader.vertexShader.replace('#include <common>', `#include <common>\n${COMMON}`);

    if (mode === 'ribbon') {
      vert = vert
        .replace(
          '#include <begin_vertex>',
          /* glsl */ `
            vec3 dTangent = strandTangent();
            vec3 dNormal = normalize(cross(dTangent, aBinormal));
            vec3 transformed = strandWave(aCenter, aU) + aOffset;
            // Ripple across the ribbon width, not just along its length.
            float flutterPh = aU * uFreq - uTime * uSpeed;
            transformed += dNormal
              * sin(aV * 6.2831853 * uCrossFreq + flutterPh)
              * uCrossAmp * strandTaper(aU);
          `,
        )
        .replace(
          '#include <beginnormal_vertex>',
          /* glsl */ `
            vec3 objectNormal = normalize(cross(strandTangent(), aBinormal));
          `,
        );
    } else if (mode === 'tube') {
      vert = vert
        .replace(
          '#include <begin_vertex>',
          /* glsl */ `
            // Bulge the rigid radial offset in and out with the lay, so the
            // strands exist on the silhouette rather than only in the shading.
            vec3 transformed = strandWave(aCenter, aU)
              + aOffset * (1.0 + uLayAmp * ropeLay(aU, aV));
          `,
        )
        .replace(
          '#include <beginnormal_vertex>',
          /* glsl */ `
            vec3 nTangent = strandTangent();
            vec3 nRadial = normalize(aOffset);

            /**
             * Normal of the lay-displaced surface, by finite difference one step
             * around the circumference. Deriving it analytically is possible,
             * but the handedness conventions are easy to get backwards and the
             * failure mode — strands lit as grooves — is subtle enough to ship
             * by accident. The outward correction below makes this self-checking
             * instead, and it degrades to the exact radial normal at uLayAmp 0.
             */
            float dv = 0.004;
            vec3 rHere = aOffset * (1.0 + uLayAmp * ropeLay(aU, aV));
            vec3 rNext = rotAbout(aOffset, nTangent, 6.2831853 * dv)
                       * (1.0 + uLayAmp * ropeLay(aU, aV + dv));

            vec3 objectNormal = normalize(cross(rNext - rHere, nTangent));
            if (dot(objectNormal, nRadial) < 0.0) objectNormal = -objectNormal;
            // Re-orthogonalise against the displaced tangent, as the plain tube did.
            objectNormal = normalize(objectNormal - nTangent * dot(objectNormal, nTangent));
          `,
        );
    } else {
      /**
       * The laid rope carries its offset rigidly and leaves beginnormal_vertex
       * alone, because the baked normal is already correct.
       *
       * That is not a shortcut, it is the arithmetic: the wave is 0.5 units over
       * an ~87-unit wavelength, so the steepest the centreline ever tilts is
       * about 2 degrees, and the second octave adds another 1. Rotating the
       * frame to chase 3 degrees would cost a Rodrigues rotation per vertex and
       * change nothing you can see. Revisit only if uAmp or uVelGain grow by an
       * order of magnitude.
       *
       * The tube branch above cannot do this — its normals depend on uLayAmp,
       * which the geometry does not know about. Here the geometry knows
       * everything, and the normals are analytic rather than averaged.
       */
      vert = vert.replace(
        '#include <begin_vertex>',
        /* glsl */ `
          vec3 transformed = strandWave(aCenter, aU) + aOffset;
        `,
      );
    }

    shader.vertexShader = vert;
  };
  // Force a recompile if the material was already used.
  material.needsUpdate = true;
}
