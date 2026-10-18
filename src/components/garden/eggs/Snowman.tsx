// A snowman for SnowReveal to leave behind (see snowmanGeometry.ts). Place it
// with `position` and `rotation`, in the reveal's spot's frame, facing +z.
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { snowmanGeometry, type SnowmanOptions } from './snowmanGeometry';

export default function Snowman({ sling, scarf, ...place }: SnowmanOptions & { position?: [number, number, number]; rotation?: [number, number, number] }) {
  const geometry = useMemo(() => snowmanGeometry({ sling, scarf }), [sling, scarf]);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85 }), []);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  // Sunk a little, as packed snow settles.
  return <group {...place}>
    <mesh geometry={geometry} material={material} position={[0, -.04, 0]} castShadow receiveShadow />
  </group>;
}
