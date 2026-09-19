import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { foldedPaper } from './paperBoatGeometry';
import { woodenSailboat } from './woodenSailboatGeometry';
import { toyTugboat } from './tugboatGeometry';
import { rubberDuck } from './rubberDuckGeometry';

import { BOAT_KINDS, BOAT_LIFETIME, RIPPLE_COUNT, RIPPLE_INTERVAL, type BoatBody } from './boatPhysics';
const RIPPLE_LIFETIME = RIPPLE_COUNT * RIPPLE_INTERVAL;

export function createBoatResources() {
  return { paper: foldedPaper(), sailboat: woodenSailboat(), tugboat: toyTugboat(), duck: rubberDuck(), ripple: new THREE.RingGeometry(.96, 1, 32) };
}
export function disposeBoatResources(resources: ReturnType<typeof createBoatResources>) {
  for (const kind of BOAT_KINDS) {
    resources[kind].geometry.dispose(); resources[kind].creases.dispose();
  }
  resources.ripple.dispose();
}

export function PaperBoat({ boat, resources, preview = false }: {
  resources: ReturnType<typeof createBoatResources>; preview?: boolean; boat: BoatBody;
}) {
  const initialized = useRef(false);
  const group = useRef<THREE.Group>(null);
  const paper = useRef<THREE.MeshStandardMaterial>(null);
  const ink = useRef<THREE.LineBasicMaterial>(null);
  const ripples = useRef<(THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial> | null)[]>([]);
  const { geometry, creases } = resources[boat.kind];
  const phase = boat.id * 2.399963;

  useFrame(() => {
    if (!group.current || (preview && initialized.current)) return;
    initialized.current = true;
    const t = boat.age;
    // Physics owns horizontal motion; tiny waves keep the keel in the water.
    group.current.position.set(boat.x, -.02 + Math.sin(t * 1.7 + phase) * .009, boat.z);
    group.current.rotation.set(
      Math.sin(t * 1.4 + phase) * .025,
      boat.yaw,
      Math.sin(t * 1.1 + phase * 1.3) * .035,
    );
    const opacity = Math.min(1, (BOAT_LIFETIME - t) / 5);
    if (paper.current) paper.current.opacity = opacity;
    if (ink.current) ink.current.opacity = .32 * opacity;
    // Each ring remembers its actual emission point, including collision detours.
    ripples.current.forEach((ripple, i) => {
      if (!ripple) return;
      const wake = boat.wake[i];
      const progress = preview ? .3 : (t - wake.born) / RIPPLE_LIFETIME;
      // Warm the ripple material along with the hull before revealing the scene.
      ripple.visible = preview || (wake.born >= 0 && progress < 1);
      if (!ripple.visible) return;
      ripple.position.set(preview ? boat.x : wake.x, .004, preview ? boat.z : wake.z);
      const radius = .16 + progress * .62;
      ripple.scale.set(radius, radius * 1.12, 1);
      ripple.material.opacity = .22 * Math.min(1, progress / .12) * (1 - progress) ** 2 * opacity;
    });
  });

  return <>
    <group ref={group} name={`${boat.kind === 'duck' ? 'rubber-duck' : boat.kind === 'tugboat' ? 'tugboat' : boat.kind === 'sailboat' ? 'wooden-sailboat' : 'paper-boat'}-${boat.id}`}
      position={[boat.x, -.02, boat.z]} rotation={[0, boat.yaw, 0]}>
      <mesh castShadow>
        <primitive object={geometry} attach="geometry" />
        <meshStandardMaterial ref={paper} vertexColors side={THREE.DoubleSide} roughness={1} transparent />
      </mesh>
      <lineSegments>
        <primitive object={creases} attach="geometry" />
        <lineBasicMaterial ref={ink} color="#8b795a" transparent opacity={.32} />
      </lineSegments>
    </group>
    <group name={`boat-wake-${boat.id}`}>
      {Array.from({ length: RIPPLE_COUNT }, (_, i) => <mesh key={i}
        ref={(mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial> | null) => {
          ripples.current[i] = mesh;
        }} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
        <primitive object={resources.ripple} attach="geometry" />
        <meshBasicMaterial color="#f7f0d8" transparent opacity={0} depthWrite={false} />
      </mesh>)}
    </group>
  </>;
}
