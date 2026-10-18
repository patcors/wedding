// February 2021, Amelia moves to Sydney: a miniature Sydney Opera House on the
// rock where the boats first part, and the Harbour Bridge across Amelia's
// channel from the rock to her bank, which her boat sails under as the date
// shows (placed in harbour.ts). Still scenery: both come out of the haze
// together; the Opera House stays until the camera has passed it, and the
// bridge dissolves away once she is through, before its pylons come between
// the camera and her boat. Two draw calls.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useJourney } from '../JourneyProvider';
import { harbourShown } from './harbour';
import { harbourGeometry } from './sydneyGeometry';
import type { EggProps } from './egg';

export default function Sydney({ mobile, width }: EggProps) {
  const clock = useJourney();
  const opera = useRef<THREE.Mesh>(null), bridge = useRef<THREE.Mesh>(null);
  const geometry = useMemo(() => harbourGeometry(width), [width]);
  // Each dissolves with the year markers' hashed fade; the bridge's truss is
  // flat strips, seen from both sides.
  const materials = useMemo(() => ({
    opera: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8, side: THREE.DoubleSide, alphaHash: true }),
    bridge: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8, side: THREE.DoubleSide, alphaHash: true }),
  }), []);
  useEffect(() => () => {
    geometry.opera.dispose(); geometry.bridge.dispose();
    materials.opera.dispose(); materials.bridge.dispose();
  }, [geometry, materials]);
  useFrame(({ camera }) => {
    const shown = harbourShown(clock.progress, camera.position.z, mobile);
    for (const [mesh, key] of [[opera.current, 'opera'], [bridge.current, 'bridge']] as const) {
      if (!mesh) continue;
      mesh.visible = shown[key] > 0;
      materials[key].opacity = shown[key];
    }
  });
  return <group name="sydney-harbour">
    <mesh ref={opera} name="opera-house" geometry={geometry.opera} material={materials.opera} visible={false} receiveShadow />
    <mesh ref={bridge} name="harbour-bridge" geometry={geometry.bridge} material={materials.bridge} visible={false} receiveShadow />
  </group>;
}
