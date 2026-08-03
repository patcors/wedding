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
}

export function makeStrandUniforms(overrides: Partial<Record<keyof StrandUniforms, number>> = {}) {
  const u: StrandUniforms = {
    uTime: { value: 0 },
    uAmp: { value: 1 },
    uFreq: { value: 60 },
    uSpeed: { value: 1 },
    uVel: { value: 0 },
    uVelGain: { value: 0 },
    uCrossAmp: { value: 0 },
    uCrossFreq: { value: 2 },
    uBraidT: { value: BRAID_T },
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
  uniform float uAmp;
  uniform float uFreq;
  uniform float uSpeed;
  uniform float uVel;
  uniform float uVelGain;
  uniform float uCrossAmp;
  uniform float uCrossFreq;
  uniform float uBraidT;

  // Amplitude taper. The braid and the knot are the two most important reads
  // in the whole piece, so both are held still.
  float strandTaper(float u) {
    float start = smoothstep(0.0, 0.10, u);
    float braid = 1.0 - 0.8 * exp(-pow((u - uBraidT) / 0.055, 2.0));
    float knot  = smoothstep(1.0, 0.86, u);
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
    vec3 c1 = strandWave(aCenter + aTangent * (du * 420.0), aU + du);
    return normalize(c1 - c0);
  }
`;

/**
 * @param ribbon  true for the silk (normals from the sweep frame, plus
 *                cross-wise flutter), false for the rope (radial normals).
 */
export function injectStrandDisplacement(
  material: THREE.Material,
  uniforms: StrandUniforms,
  ribbon: boolean,
) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${COMMON}`)
      // begin_vertex expands to `vec3 transformed = vec3( position );`
      .replace(
        '#include <begin_vertex>',
        ribbon
          ? /* glsl */ `
            vec3 dTangent = strandTangent();
            vec3 dNormal = normalize(cross(dTangent, aBinormal));
            vec3 transformed = strandWave(aCenter, aU) + aOffset;
            // Ripple across the ribbon width, not just along its length.
            float flutterPh = aU * uFreq - uTime * uSpeed;
            transformed += dNormal
              * sin(aV * 6.2831853 * uCrossFreq + flutterPh)
              * uCrossAmp * strandTaper(aU);
          `
          : /* glsl */ `
            vec3 transformed = strandWave(aCenter, aU) + aOffset;
          `,
      )
      // beginnormal_vertex expands to `vec3 objectNormal = vec3( normal );`
      .replace(
        '#include <beginnormal_vertex>',
        ribbon
          ? /* glsl */ `
            vec3 objectNormal = normalize(cross(strandTangent(), aBinormal));
          `
          : /* glsl */ `
            // Tube normals are radial. Re-orthogonalise the baked offset
            // direction against the displaced tangent.
            vec3 nTangent = strandTangent();
            vec3 nRadial = normalize(aOffset);
            vec3 objectNormal = normalize(nRadial - nTangent * dot(nRadial, nTangent));
          `,
      );
  };
  // Force a recompile if the material was already used.
  material.needsUpdate = true;
}
