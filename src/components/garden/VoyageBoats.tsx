// Patrick's and Amelia's boats (owner: boats agent). They are kinematic: where
// they are follows from useJourney().progress through journey.ts and the
// river's shape, never from boatPhysics.
// PLACEHOLDER: two plain wooden sailboats, in separate channels before they
// meet, side by side after, apart while Amelia is in Sydney, together from
// dating, and moored at the jetty for the celebration.
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { DATES, DOCKED, VOYAGE_END, routeAt, since } from './journey';
import { VOYAGE, bankEdge, channelOffset, riverCenter, voyageLandmarks } from './gardenGeometry';
import { woodenSailboat } from './woodenSailboatGeometry';
import { useJourney, type SlotProps } from './JourneyProvider';

const ease = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

// Half the distance between the boats, across the river, at progress p.
function halfGap(p: number, z: number, width: number) {
  const pair = .55 * Math.max(width, .7);
  // The channels either side of the island close in once it ends.
  const met = ease((VOYAGE.island.to - z) / (VOYAGE.island.to - VOYAGE.meet));
  let gap = channelOffset(z, width) + (pair - channelOffset(z, width)) * met;
  const away = ease(since(DATES.sydney, p) / 4) - ease((since(DATES.back, p) + 3) / 3);
  gap += (bankEdge(z, width) * .55 - gap) * Math.max(0, away);
  return gap + (.34 * Math.max(width, .7) - gap) * ease(since(DATES.dating, p) / 8);
}

export default function VoyageBoats({ paused, width }: SlotProps) {
  const clock = useJourney();
  const { geometry } = useMemo(woodenSailboat, []);
  const boats = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)];
  const time = useRef(0);
  useFrame((_, dt) => {
    if (!paused) time.current += Math.min(dt, .05);
    const p = clock.progress, z = routeAt(p);
    const docking = ease((p - VOYAGE_END) / (DOCKED - VOYAGE_END));
    const center = riverCenter(z, width) + (voyageLandmarks(width).mooring.x - riverCenter(z, width)) * docking;
    const gap = halfGap(p, z, width);
    // Bow first down the river: yaw follows its slope.
    const yaw = Math.atan(riverCenter(z + .5, width) - riverCenter(z - .5, width)) * (1 - docking);
    boats.forEach((boat, i) => {
      if (!boat.current) return;
      const t = time.current + i * 1.7;
      boat.current.position.set(center + (i ? gap : -gap), -.02 + Math.sin(t * 1.7) * .009, z);
      boat.current.rotation.set(Math.sin(t * 1.4) * .025, yaw, Math.sin(t * 1.1) * .035);
    });
  });
  // Amelia's is the wooden one on the left, Patrick's soft yellow on the right.
  return <group name="voyage-boats-placeholder">
    {['#ffffff', '#f6df8e'].map((color, i) => <group key={i} ref={boats[i]} name={i ? 'patrick-boat' : 'amelia-boat'}>
      <mesh geometry={geometry} castShadow>
        <meshStandardMaterial vertexColors color={color} side={THREE.DoubleSide} roughness={1} />
      </mesh>
    </group>)}
  </group>;
}
