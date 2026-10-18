// April 2026, they get engaged: the old Chevy truck they got engaged on,
// its tray made into a whale-watching platform, parked on Patrick's bank
// beside the bend (placed and timed in engagementTruck.ts, the model in
// truckGeometry.ts). Still scenery: it dissolves in out of the haze just
// before the date, as the old masts come down, stands while the proposal
// plays on the deck, and sinks back into the haze as the trip's date holds
// and the camera passes it. One draw call,
// drawn again in the water's reflection, no shadows cast.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useJourney, type SlotProps } from '../JourneyProvider';
import { truckShown, truckSpot } from './engagementTruck';
import { patinaTexture, truckGeometry } from './truckGeometry';

export default function EngagementTruck({ width }: SlotProps) {
  const clock = useJourney();
  const group = useRef<THREE.Group>(null);
  const spot = useMemo(() => truckSpot(width), [width]);
  const parts = useMemo(() => {
    const patina = patinaTexture();
    // Hashed alpha dissolves it without sorting, as the year markers do.
    return { geometry: truckGeometry(), patina, material: new THREE.MeshStandardMaterial({ vertexColors: true, map: patina, roughness: .85, alphaHash: true }) };
  }, []);
  useEffect(() => () => Object.values(parts).forEach(part => part.dispose()), [parts]);

  useFrame(() => {
    if (!group.current) return;
    const shown = truckShown(clock.progress);
    group.current.visible = shown > 0;
    parts.material.opacity = shown;
  });

  return <group ref={group} name="engagement-truck" visible={false} position={[spot.x, spot.y, spot.z]}
    rotation={[spot.pitch, spot.yaw, spot.roll, 'YXZ']} scale={spot.scale}>
    <mesh geometry={parts.geometry} material={parts.material} receiveShadow />
  </group>;
}
