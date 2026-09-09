import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { riverCenter, bankEdge } from './gardenGeometry';
import { foldedPaper } from './paperBoatGeometry';
import { woodenSailboat } from './woodenSailboatGeometry';
import { toyTugboat } from './tugboatGeometry';

export type BoatLaunch = { id: number; z: number; lateral: number; kind: 'paper' | 'sailboat' | 'tugboat' };
// Leave room for the bow and stern when a boat turns broadside to the current.
export const BOAT_MARGIN = .88;
const LIFETIME = 48;
const RIPPLE_COUNT = 6;
const RIPPLE_INTERVAL = .55;
const RIPPLE_LIFETIME = RIPPLE_COUNT * RIPPLE_INTERVAL;

export function PaperBoat({ boat, width, paused, onRetire }: {
  boat: BoatLaunch; width: number; paused: boolean; onRetire: (id: number) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const paper = useRef<THREE.MeshStandardMaterial>(null);
  const ink = useRef<THREE.LineBasicMaterial>(null);
  const ripples = useRef<(THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial> | null)[]>([]);
  const age = useRef(0), retired = useRef(false);
  const { geometry, creases } = useMemo(
    () => boat.kind === 'tugboat' ? toyTugboat() : boat.kind === 'sailboat' ? woodenSailboat() : foldedPaper(), [boat.kind]);
  const startX = riverCenter(boat.z, width) + boat.lateral * Math.max(.1, bankEdge(boat.z, width) - BOAT_MARGIN);
  const phase = boat.id * 2.399963;
  const startYaw = Math.sin(phase) * .12;
  const spin = (boat.id % 2 ? 1 : -1) * (.10 + (.5 + Math.sin(phase) * .5) * .06);
  const positionX = (t: number, z: number) => {
    const channel = Math.max(.1, bankEdge(z, width) - BOAT_MARGIN);
    return riverCenter(z, width) + THREE.MathUtils.clamp(boat.lateral * channel * Math.exp(-t * .035)
      + (Math.sin(t * .48 + boat.id) - Math.sin(boat.id)) * .07, -channel, channel);
  };

  useFrame((_, dt) => {
    if (!group.current || retired.current) return;
    if (!paused) age.current += Math.min(dt, .05);
    const t = age.current;
    if (t >= LIFETIME) {
      retired.current = true; onRetire(boat.id); return;
    }
    const z = boat.z - t * .82;
    // The current gradually carries a boat towards the centre. Normalised
    // placement also keeps it inside the banks when the viewport changes.
    const x = positionX(t, z);
    // Keep the keel submerged throughout the bob so the hull and its planar
    // reflection meet at the waterline (the water surface is y = 0).
    group.current.position.set(x, -.02 + Math.sin(t * 1.7 + phase) * .009, z);
    // Launch roughly downstream, then let each boat catch its own eddy.
    // Subtract the initial sway so the animation starts at the launch heading.
    group.current.rotation.set(
      Math.sin(t * 1.4 + phase) * .025,
      startYaw + t * spin + (Math.sin(t * .48 + phase) - Math.sin(phase)) * .10,
      Math.sin(t * 1.1 + phase * 1.3) * .035,
    );
    const opacity = Math.min(1, (LIFETIME - t) / 5);
    if (paper.current) paper.current.opacity = opacity;
    if (ink.current) ink.current.opacity = .32 * opacity;
    // Reuse six rings, leaving each at the point the hull passed through.
    // Boat age drives the whole trail, so pause/reduced motion freeze it too.
    ripples.current.forEach((ripple, i) => {
      if (!ripple) return;
      const offset = i * RIPPLE_INTERVAL;
      const born = Math.floor((t - offset) / RIPPLE_LIFETIME) * RIPPLE_LIFETIME + offset;
      ripple.visible = born >= 0;
      if (!ripple.visible) return;
      const progress = (t - born) / RIPPLE_LIFETIME;
      const rippleZ = boat.z - born * .82;
      ripple.position.set(positionX(born, rippleZ), .004, rippleZ);
      const radius = .16 + progress * .62;
      ripple.scale.set(radius, radius * 1.12, 1);
      ripple.material.opacity = .22 * Math.min(1, progress / .12) * (1 - progress) ** 2 * opacity;
    });
  });

  return <>
    <group ref={group} name={`${boat.kind === 'tugboat' ? 'tugboat' : boat.kind === 'sailboat' ? 'wooden-sailboat' : 'paper-boat'}-${boat.id}`}
      position={[startX, -.02, boat.z]} rotation={[0, startYaw, 0]}>
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
