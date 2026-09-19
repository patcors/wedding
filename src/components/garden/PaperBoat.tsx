import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BOAT_LIFETIME, RIPPLE_COUNT, RIPPLE_INTERVAL, type BoatBody } from './boatPhysics';
import { foldedPaper } from './paperBoatGeometry';
import { woodenSailboat } from './woodenSailboatGeometry';
import { toyTugboat } from './tugboatGeometry';

const RIPPLE_LIFETIME = RIPPLE_COUNT * RIPPLE_INTERVAL;

export function PaperBoat({ boat }: { boat: BoatBody }) {
  const group = useRef<THREE.Group>(null);
  const paper = useRef<THREE.MeshStandardMaterial>(null);
  const ink = useRef<THREE.LineBasicMaterial>(null);
  const ripples = useRef<(THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial> | null)[]>([]);
  const { geometry, creases } = useMemo(
    () => boat.kind === 'tugboat' ? toyTugboat() : boat.kind === 'sailboat' ? woodenSailboat() : foldedPaper(), [boat.kind]);
  const phase = boat.id * 2.399963;

  useFrame(() => {
    if (!group.current) return;
    const t = boat.age;
    // Keep the keel submerged throughout the bob so the hull and its planar
    // reflection meet at the waterline (the water surface is y = 0).
    group.current.position.set(boat.x, -.02 + Math.sin(t * 1.7 + phase) * .009, boat.z);
    // The shared simulation owns horizontal motion and collision-induced turns.
    group.current.rotation.set(
      Math.sin(t * 1.4 + phase) * .025,
      boat.yaw,
      Math.sin(t * 1.1 + phase * 1.3) * .035,
    );
    const opacity = Math.min(1, (BOAT_LIFETIME - t) / 5);
    if (paper.current) paper.current.opacity = opacity;
    if (ink.current) ink.current.opacity = .32 * opacity;
    // Wake positions follow the actual path, including collision deflections.
    ripples.current.forEach((ripple, i) => {
      if (!ripple) return;
      const wake = boat.wake[i];
      const progress = (t - wake.born) / RIPPLE_LIFETIME;
      ripple.visible = wake.born >= 0 && progress < 1;
      if (!ripple.visible) return;
      ripple.position.set(wake.x, .004, wake.z);
      const radius = .16 + progress * .62;
      ripple.scale.set(radius, radius * 1.12, 1);
      ripple.material.opacity = .22 * Math.min(1, progress / .12) * (1 - progress) ** 2 * opacity;
    });
  });

  return <>
    <group ref={group} name={`${boat.kind === 'tugboat' ? 'tugboat' : boat.kind === 'sailboat' ? 'wooden-sailboat' : 'paper-boat'}-${boat.id}`}
      position={[boat.x, -.02, boat.z]} rotation={[0, boat.yaw, 0]}>
      <mesh geometry={geometry} castShadow>
        <meshStandardMaterial ref={paper} vertexColors side={THREE.DoubleSide} roughness={1} transparent />
      </mesh>
      <lineSegments geometry={creases}>
        <lineBasicMaterial ref={ink} color="#8b795a" transparent opacity={.32} />
      </lineSegments>
    </group>
    <group name={`boat-wake-${boat.id}`}>
      {Array.from({ length: RIPPLE_COUNT }, (_, i) => <mesh key={i}
        ref={(mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial> | null) => {
          ripples.current[i] = mesh;
        }} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[.96, 1, 48]} />
        <meshBasicMaterial color="#f7f0d8" transparent opacity={0} depthWrite={false} />
      </mesh>)}
    </group>
  </>;
}
