// Bullet, the product Patrick worked on, as a large bullet garden ornament on
// his bank across the river from the 2025 snowmen (placed and timed in
// bulletOrnament.ts, built in bulletGeometry.ts). Still scenery: it dissolves
// in as the snow trip comes and goes once the camera has passed it, and
// simply stands there, under reduced motion too. Two draw calls, the brass
// and the stone; it casts no shadow.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useJourney, type SlotProps } from '../JourneyProvider';
import { bulletShown, bulletSpot } from './bulletOrnament';
import { bulletGeometry, bulletPlinthGeometry } from './bulletGeometry';

export default function BulletOrnament({ mobile, width }: SlotProps) {
  const clock = useJourney();
  const parts = useMemo(() => ({
    bullet: bulletGeometry(), plinth: bulletPlinthGeometry(),
    // Hashed alpha dissolves it without sorting, as the year markers do.
    brass: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .3, metalness: .3, alphaHash: true }),
    stone: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, alphaHash: true }),
  }), []);
  useEffect(() => () => Object.values(parts).forEach(part => part.dispose()), [parts]);
  const spot = useMemo(() => bulletSpot(width), [width]);
  const group = useRef<THREE.Group>(null);

  useFrame(({ camera }) => {
    if (!group.current) return;
    const shown = bulletShown(spot, clock.progress, camera.position.z, mobile);
    group.current.visible = shown > 0;
    parts.brass.opacity = parts.stone.opacity = shown;
  });

  return <group ref={group} name="bullet-ornament" visible={false} position={[spot.x, spot.y, spot.z]} rotation={[0, spot.yaw, 0]} scale={spot.scale}>
    <mesh geometry={parts.bullet} material={parts.brass} receiveShadow />
    <mesh geometry={parts.plinth} material={parts.stone} receiveShadow />
  </group>;
}
