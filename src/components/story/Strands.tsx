import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { buildStrandCurve } from './curves';
import { buildRopeGeometry, buildSilkGeometry } from './strandGeometry';
import { injectStrandDisplacement, makeStrandUniforms } from './strandMaterial';
import { proceduralRopeNormal } from './placeholder';

/**
 * Rope and silk share one shader but not one parameter set, and that contrast
 * is the entire point of having chosen these two objects.
 *
 * Rope is stiff: low amplitude, low frequency, slow, barely responsive to
 * scroll velocity. Rope sways under its own weight — it does not ripple. If it
 * ripples it reads as a garden hose and the material contrast dies.
 *
 * Silk billows: larger amplitude, a travelling wave, cross-wise flutter, and a
 * strong velocity response so it settles when the reader stops scrolling.
 */

export function Rope({ velocityRef }: { velocityRef: React.RefObject<number> }) {
  const geometry = useMemo(() => buildRopeGeometry(buildStrandCurve('rope')), []);
  const uniforms = useMemo(
    () => makeStrandUniforms({ uAmp: 0.5, uFreq: 34, uSpeed: 0.55, uVelGain: 0.5 }),
    [],
  );

  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      color: '#b9a37e',
      roughness: 0.92,
      metalness: 0.0,
      normalMap: proceduralRopeNormal(),
      normalScale: new THREE.Vector2(0.85, 0.85),
    });
    injectStrandDisplacement(m, uniforms, false);
    return m;
  }, [uniforms]);

  useFrame((_, dt) => {
    uniforms.uTime.value += dt;
    uniforms.uVel.value = velocityRef.current;
  });

  return <mesh geometry={geometry} material={material} frustumCulled={false} />;
}

export function Silk({ velocityRef }: { velocityRef: React.RefObject<number> }) {
  const geometry = useMemo(() => buildSilkGeometry(buildStrandCurve('silk')), []);
  const uniforms = useMemo(
    () =>
      makeStrandUniforms({
        uAmp: 2.1,
        uFreq: 17,
        uSpeed: 1.5,
        uVelGain: 2.4,
        uCrossAmp: 0.42,
        uCrossFreq: 1.6,
      }),
    [],
  );

  const material = useMemo(() => {
    // Sheen is three.js's fabric term — a soft retroreflective rim that is
    // what makes cloth look like cloth rather than painted plastic.
    const m = new THREE.MeshPhysicalMaterial({
      color: '#c94f6d',
      roughness: 0.62,
      metalness: 0.0,
      sheen: 1.0,
      sheenRoughness: 0.5,
      sheenColor: new THREE.Color('#ffd9e2'),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.94,
    });
    injectStrandDisplacement(m, uniforms, true);
    return m;
  }, [uniforms]);

  useFrame((_, dt) => {
    uniforms.uTime.value += dt;
    uniforms.uVel.value = velocityRef.current;
  });

  return <mesh geometry={geometry} material={material} frustumCulled={false} />;
}
