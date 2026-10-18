// Amelia's Sydney: the Harbour Bridge across her channel from the rock where
// the boats first part to her bank, which her boat sails under as February
// 2021's date shows, and further down, with 2022, a miniature Sydney Opera
// House on a little sandstone point on her bank (placed in harbour.ts).
// Still scenery: the bridge comes in towards the end of 2020 and fades away
// once she is through, before its pylons come between the camera and her
// boat; the Opera House comes in with 2022 and stays until the camera has
// passed it. Two draw calls.
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
  // Each fades evenly in and out rather than with the year markers' hashed
  // dissolve, which left the bridge's pylon speckled in the middle of the
  // picture; it is drawn as solid as ever while fully shown. The bridge's
  // truss is flat strips, seen from both sides.
  const materials = useMemo(() => ({
    opera: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8, side: THREE.DoubleSide, transparent: true }),
    bridge: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8, side: THREE.DoubleSide, transparent: true }),
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
