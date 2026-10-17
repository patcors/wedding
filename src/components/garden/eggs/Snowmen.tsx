// Two snowmen holding hands, for SnowReveal to leave behind (see
// holdingHandsGeometry in snowmanGeometry.ts), in one mesh. Place them with
// `position` and `rotation`, in the reveal's spot's frame, facing +z.
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { holdingHandsGeometry } from './snowmanGeometry';

export default function Snowmen({ scarves: [left, right], ...place }: { scarves: [string, string]; position?: [number, number, number]; rotation?: [number, number, number] }) {
  const geometry = useMemo(() => holdingHandsGeometry({ scarf: left }, { scarf: right }), [left, right]);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85 }), []);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  // Sunk a little, as packed snow settles.
  return <group {...place}>
    <mesh geometry={geometry} material={material} position={[0, -.04, 0]} castShadow receiveShadow />
  </group>;
}
