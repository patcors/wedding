// July 2017: a π in weathered bronze on a stone plinth, on the bank a little
// past where the boats meet (placed in campus.ts). It is still scenery,
// there to be noticed rather than shown: in view down the river from the
// meeting, closest through the first year, and left behind in the second.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { cameraPose } from '../cameraRig';
import { useJourney } from '../JourneyProvider';
import { piSculptureGeometry } from './piSculptureGeometry';
import { piSpot } from './campus';
import { eggTime, type EggProps } from './egg';

export default function PiSculpture({ milestone, mobile, width, reduced }: EggProps) {
  const clock = useJourney();
  const group = useRef<THREE.Group>(null);
  const geometry = useMemo(piSculptureGeometry, []);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .5, metalness: .2 }), []);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  const spot = useMemo(() => piSpot(mobile, width), [mobile, width]);

  useFrame(() => {
    if (!group.current) return;
    // Drawn from a little before the meeting, while it could be in the mist
    // down the river, until the camera has gone by.
    const t = eggTime(milestone, clock.progress, reduced, 0);
    group.current.visible = t > -1.2 && cameraPose(clock.progress, width).position[2] > spot.z - 2;
  });

  return <group ref={group} name="pi-sculpture" visible={false} position={[spot.x, spot.y, spot.z]} rotation={[0, spot.yaw, 0]} scale={spot.scale}>
    <mesh geometry={geometry} material={material} castShadow receiveShadow />
  </group>;
}
