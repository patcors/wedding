// Turkey and Greece, July 2026: a hot-air balloon rises in the distance
// (owner: egg agent).
// PLACEHOLDER: a plain envelope and basket that rise with the scroll.
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { routeAtMonth, scrolledSince } from '../journey';
import { riverCenter } from '../gardenGeometry';
import { useJourney } from '../JourneyProvider';
import type { EggProps } from './egg';

export default function Balloon({ milestone, reduced, mobile, width }: EggProps) {
  const clock = useJourney();
  const balloon = useRef<THREE.Group>(null);
  // Far ahead of the boats and off over the left bank when the trip begins.
  const z = routeAtMonth(milestone.month) - 45, x = riverCenter(z, width) - (mobile ? 9 : 18);
  useFrame(() => {
    if (!balloon.current) return;
    // Rises over two milestones' worth of scroll from just before the date.
    const t = reduced ? 1 : scrolledSince(milestone.month, clock.progress);
    balloon.current.visible = t > -.3 && t < 3.5;
    balloon.current.position.set(x, 3 + THREE.MathUtils.clamp(t + .3, 0, 2.3) * 5, z);
  });
  return <group ref={balloon} name="balloon-placeholder">
    <mesh scale={[1, 1.15, 1]}>
      <sphereGeometry args={[1.6, 16, 12]} />
      <meshStandardMaterial color="#d9826a" roughness={.9} />
    </mesh>
    <mesh position={[0, -2.4, 0]}>
      <boxGeometry args={[.6, .5, .6]} />
      <meshStandardMaterial color="#8a6a48" roughness={1} />
    </mesh>
  </group>;
}
