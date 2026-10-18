// July 2026, Turkey and Greece: a garden miniature of the Hagia Sophia on the
// left bank at the start of the S-bend (placed in balloonCourse.ts), with the
// trip's balloon rising over it. Still scenery: it comes out of the haze as
// the trip's date nears and stays until the camera has passed it.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { cameraPose } from '../cameraRig';
import { useJourney } from '../JourneyProvider';
import { hagiaShown, hagiaSophiaSpot } from './balloonCourse';
import { hagiaSophiaGeometry } from './hagiaSophiaGeometry';
import { eggTime, type EggProps } from './egg';

export default function HagiaSophia({ milestone, reduced, width }: EggProps) {
  const clock = useJourney();
  const group = useRef<THREE.Group>(null);
  const geometry = useMemo(hagiaSophiaGeometry, []);
  // Dissolves in with the year markers' hashed fade.
  const material = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85, alphaHash: true }), []);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  const spot = useMemo(() => hagiaSophiaSpot(milestone.month, width), [milestone.month, width]);

  useFrame(() => {
    if (!group.current) return;
    const shown = hagiaShown(eggTime(milestone, clock.progress, reduced, 0));
    group.current.visible = shown > 0 && cameraPose(clock.progress, width).position[2] > spot.z - 2;
    material.opacity = shown;
  });

  return <group ref={group} name="hagia-sophia" visible={false} position={[spot.x, spot.y, spot.z]} rotation={[0, spot.yaw, 0]} scale={spot.scale}>
    <mesh geometry={geometry} material={material} receiveShadow />
  </group>;
}
