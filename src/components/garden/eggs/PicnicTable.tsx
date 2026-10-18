// The university years: a park picnic table on Amelia's bank, across the
// river from the π, with Euler's identity carved into its top (placed in
// uniOrnaments.ts, built in picnicTableGeometry.ts).
// Still scenery, dissolving in out of the haze like the year markers and gone
// once the camera has passed. One draw call; it casts a shadow, so it stands
// on the grass rather than floating over it.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { SlotProps } from '../JourneyProvider';
import { markerShown } from './yearMarkerSpots';
import { ORNAMENTS, ornamentSpot } from './uniOrnaments';
import { TABLE, picnicTableGeometry, picnicTableTextures } from './picnicTableGeometry';

export default function PicnicTable({ mobile, width }: SlotProps) {
  const geometry = useMemo(picnicTableGeometry, []);
  const material = useMemo(() => {
    const { map, bumpMap } = picnicTableTextures();
    return new THREE.MeshStandardMaterial({ map, bumpMap, bumpScale: 2, vertexColors: true, roughness: .92, alphaHash: true });
  }, []);
  useEffect(() => () => { geometry.dispose(); material.map?.dispose(); material.bumpMap?.dispose(); material.dispose(); }, [geometry, material]);
  // Its long side faces the camera, so it reaches inland from the water by half its length.
  const spot = useMemo(() => ornamentSpot(ORNAMENTS.table, width, TABLE.length / 2), [width]);
  const group = useRef<THREE.Group>(null);

  useFrame(({ camera }) => {
    if (!group.current) return;
    const shown = markerShown(spot.z, camera.position.z, mobile);
    group.current.visible = shown > 0;
    material.opacity = shown;
  });

  return <group ref={group} name="picnic-table" visible={false} position={[spot.x, spot.y, spot.z]} rotation={[0, spot.yaw, 0]} scale={spot.scale}>
    <mesh geometry={geometry} material={material} castShadow receiveShadow />
  </group>;
}
