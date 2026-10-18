// The university years: a Möbius strip in weathered bronze on a stone plinth,
// a companion to July 2017's π, standing on Amelia's bank across the river
// from it (placed in uniOrnaments.ts, built in mobiusGeometry.ts).
// Still scenery, dissolving in out of the haze like the year markers and gone
// once the camera has passed. One draw call; it casts a shadow, as the π does.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { SlotProps } from '../JourneyProvider';
import { markerShown } from './yearMarkerSpots';
import { ORNAMENTS, ornamentSpot } from './uniOrnaments';
import { MOBIUS_PLINTH, mobiusGeometry } from './mobiusGeometry';

export default function MobiusSculpture({ mobile, width }: SlotProps) {
  const geometry = useMemo(mobiusGeometry, []);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .5, metalness: .2, alphaHash: true }), []);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  const spot = useMemo(() => ornamentSpot(ORNAMENTS.mobius, width, MOBIUS_PLINTH.width / 2), [width]);
  const group = useRef<THREE.Group>(null);

  useFrame(({ camera }) => {
    if (!group.current) return;
    const shown = markerShown(spot.z, camera.position.z, mobile);
    group.current.visible = shown > 0;
    material.opacity = shown;
  });

  return <group ref={group} name="mobius-sculpture" visible={false} position={[spot.x, spot.y, spot.z]} rotation={[0, spot.yaw, 0]} scale={spot.scale}>
    <mesh geometry={geometry} material={material} castShadow receiveShadow />
  </group>;
}
