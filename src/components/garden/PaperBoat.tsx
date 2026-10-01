import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BOAT_LIFETIME, RIPPLE_COUNT, RIPPLE_INTERVAL, type BoatBody, type BoatKind } from './boatPhysics';
import { foldedPaper } from './paperBoatGeometry';
import { woodenSailboat } from './woodenSailboatGeometry';
import { toyTugboat } from './tugboatGeometry';
import { rubberDuck } from './rubberDuckGeometry';

const RIPPLE_LIFETIME = RIPPLE_COUNT * RIPPLE_INTERVAL;
// Every boat of a kind shares one model, so launching more never builds or leaks geometry.
const MODELS = { paper: foldedPaper, sailboat: woodenSailboat, tugboat: toyTugboat, duck: rubberDuck };
const NAMES = { paper: 'paper-boat', sailboat: 'wooden-sailboat', tugboat: 'tugboat', duck: 'rubber-duck' };
const models = new Map<BoatKind, ReturnType<typeof foldedPaper>>();
const model = (kind: BoatKind) => models.get(kind) ?? models.set(kind, MODELS[kind]()).get(kind)!;
// Boats fade out over their last five seconds.
const fade = (boat: BoatBody) => Math.min(1, (BOAT_LIFETIME - boat.age) / 5);

export function PaperBoat({ boat }: { boat: BoatBody }) {
  const group = useRef<THREE.Group>(null);
  const paper = useRef<THREE.MeshStandardMaterial>(null);
  const ink = useRef<THREE.LineBasicMaterial>(null);
  const { geometry, creases } = model(boat.kind);
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
    const opacity = fade(boat);
    if (paper.current) paper.current.opacity = opacity;
    if (ink.current) ink.current.opacity = .32 * opacity;
  });

  return <group ref={group} name={`${NAMES[boat.kind]}-${boat.id}`}
    position={[boat.x, -.02, boat.z]} rotation={[0, boat.yaw, 0]}>
    <mesh geometry={geometry} castShadow>
      <meshStandardMaterial ref={paper} vertexColors side={THREE.DoubleSide} roughness={1} transparent />
    </mesh>
    <lineSegments geometry={creases}>
      <lineBasicMaterial ref={ink} color="#8b795a" transparent opacity={.32} />
    </lineSegments>
  </group>;
}

// Every boat's wake rings in one draw call, so wakes cost the same however
// many boats are out. Each ring carries its own opacity.
export function BoatWakes({ boats }: { boats: BoatBody[] }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  // Room for the next power of two of boats, so a new boat rarely rebuilds it.
  const capacity = RIPPLE_COUNT * 2 ** Math.max(3, Math.ceil(Math.log2(boats.length || 1)));
  const geometry = useMemo(() => {
    const result = new THREE.RingGeometry(.96, 1, 48).rotateX(-Math.PI / 2);
    result.setAttribute('wakeOpacity', new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1));
    return result;
  }, [capacity]);
  const material = useMemo(() => {
    const result = new THREE.MeshBasicMaterial({ color: '#f7f0d8', transparent: true, depthWrite: false });
    result.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float wakeOpacity;\nvarying float vWakeOpacity;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWakeOpacity = wakeOpacity;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vWakeOpacity;')
        .replace('#include <opaque_fragment>', 'diffuseColor.a *= vWakeOpacity;\n#include <opaque_fragment>');
    };
    result.customProgramCacheKey = () => 'garden-boat-wake-1';
    return result;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  const ring = useMemo(() => new THREE.Matrix4(), []);

  useFrame(() => {
    if (!mesh.current) return;
    const opacities = geometry.getAttribute('wakeOpacity') as THREE.InstancedBufferAttribute;
    let count = 0;
    for (const boat of boats) {
      for (const wake of boat.wake) {
        // Wake positions follow the actual path, including collision deflections.
        const progress = (boat.age - wake.born) / RIPPLE_LIFETIME;
        if (wake.born < 0 || progress >= 1 || count >= capacity) continue;
        const radius = .16 + progress * .62;
        ring.makeScale(radius, 1, radius * 1.12).setPosition(wake.x, .004, wake.z);
        mesh.current.setMatrixAt(count, ring);
        opacities.setX(count, .22 * Math.min(1, progress / .12) * (1 - progress) ** 2 * fade(boat));
        count++;
      }
    }
    mesh.current.count = count;
    mesh.current.instanceMatrix.needsUpdate = true;
    opacities.needsUpdate = true;
  });

  return <instancedMesh key={capacity} ref={mesh} name="boat-wakes" args={[geometry, material, capacity]}
    frustumCulled={false} />;
}
