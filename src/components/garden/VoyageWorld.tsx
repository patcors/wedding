// The Voyage's scenery along the river (owner: world agent): the island and
// reeds that split the river before they meet, the jetty and the old tree past
// the S-bend, and the bend's dressing. Positions come from VOYAGE,
// islandHalfWidth and voyageLandmarks in gardenGeometry.ts.
// PLACEHOLDER: flat stand-ins that show where each piece goes.
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { VOYAGE, groundHeight, islandHalfWidth, riverCenter, voyageLandmarks } from './gardenGeometry';
import type { SlotProps } from './JourneyProvider';

function islandOutline(width: number) {
  const { from, to } = VOYAGE.island, steps = 48, positions: number[] = [], indices: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const z = from + (to - from) * i / steps, half = islandHalfWidth(z, width), x = riverCenter(z, width);
    positions.push(x - half, .12, z, x + half, .12, z);
    if (i < steps) indices.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export default function VoyageWorld({ width }: SlotProps) {
  const island = useMemo(() => islandOutline(width), [width]);
  useEffect(() => () => island.dispose(), [island]);
  const { jetty, tree } = voyageLandmarks(width);
  const treeY = groundHeight(tree.x, tree.z, width);
  return <group name="voyage-world-placeholder">
    <mesh geometry={island} receiveShadow>
      <meshStandardMaterial color="#7d8a5a" roughness={1} side={THREE.DoubleSide} />
    </mesh>
    <mesh position={[jetty.x - jetty.side * (jetty.reach - .6) / 2, .28, jetty.z]} castShadow receiveShadow>
      <boxGeometry args={[jetty.reach + .6, .1, .9]} />
      <meshStandardMaterial color="#9b8160" roughness={1} />
    </mesh>
    <group position={[tree.x, treeY, tree.z]}>
      <mesh position={[0, 3, 0]} castShadow>
        <cylinderGeometry args={[.45, .8, 6, 10]} />
        <meshStandardMaterial color="#6f6252" roughness={1} />
      </mesh>
      <mesh position={[0, 8, 0]} scale={[1.4, .9, 1.4]} castShadow>
        <sphereGeometry args={[4, 16, 12]} />
        <meshStandardMaterial color="#7f8d62" roughness={1} />
      </mesh>
    </group>
  </group>;
}
