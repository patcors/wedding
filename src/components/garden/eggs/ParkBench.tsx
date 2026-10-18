// The university years: a plain wooden park bench back among the trees on the
// π's bank, looking out over the river, for all the time they spent sitting
// out on campus (placed in uniOrnaments.ts, built in parkBenchGeometry.ts).
// Still scenery, dissolving in out of the haze like the year markers and gone
// once the camera has passed. One draw call; it casts a shadow, so it stands
// on the grass rather than floating over it.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { SlotProps } from '../JourneyProvider';
import { markerShown } from './yearMarkerSpots';
import { ORNAMENTS, ornamentSpot } from './uniOrnaments';
import { BENCH, parkBenchGeometry, parkBenchTexture } from './parkBenchGeometry';

export default function ParkBench({ mobile, width }: SlotProps) {
  const geometry = useMemo(parkBenchGeometry, []);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ map: parkBenchTexture(), vertexColors: true, roughness: .92, alphaHash: true }), []);
  useEffect(() => () => { geometry.dispose(); material.map?.dispose(); material.dispose(); }, [geometry, material]);
  // It stands on the lowest ground under its ends.
  const spot = useMemo(() => ornamentSpot(ORNAMENTS.bench, width, BENCH.length / 2), [width]);
  const group = useRef<THREE.Group>(null);

  useFrame(({ camera }) => {
    if (!group.current) return;
    const shown = markerShown(spot.z, camera.position.z, mobile);
    group.current.visible = shown > 0;
    material.opacity = shown;
  });

  return <group ref={group} name="park-bench" visible={false} position={[spot.x, spot.y, spot.z]} rotation={[0, spot.yaw, 0]} scale={spot.scale}>
    <mesh geometry={geometry} material={material} castShadow receiveShadow />
  </group>;
}
