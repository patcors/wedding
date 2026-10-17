import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { bankEdge, riverCenter, groundHeight, random, riverChunks, voyageClearing, RIVER_REACH } from './gardenGeometry';
import { useRiverReach } from './useRiverReach';
import { useGardenTextures } from './gardenTextures';

const ASSETS = `${import.meta.env.BASE_URL}models/garden/ground/`;
export const ROCK_MODEL = `${ASSETS}moss-rocks.glb`;
// glTF UVs: the maps load unflipped.
export const ROCK_TEXTURES = ['color', 'normal', 'arm'].map(map => `${ASSETS}rock_moss_set_01-${map}.webp`);

type Rock = { x: number; z: number; rotation: number; scale: number; tint: number };
// The same rock sites as the original rocks in GardenBankDetails, compared in Review.
export const ROCK_COUNT = Math.round(260 * (RIVER_REACH.from - RIVER_REACH.to) / 126);

function RockChunk({ geometry, material, rocks, width, name }: {
  geometry: THREE.BufferGeometry; material: THREE.Material; rocks: Rock[]; width: number; name: string;
}) {
  const group = useRef<THREE.Group>(null);
  const mesh = useRef<THREE.InstancedMesh>(null);
  useRiverReach(group, rocks);
  useLayoutEffect(() => {
    if (!mesh.current) return;
    const dummy = new THREE.Object3D(), color = new THREE.Color();
    rocks.forEach((p, i) => {
      dummy.position.set(p.x, groundHeight(p.x, p.z, width) - p.scale * .16, p.z);
      dummy.rotation.set(0, p.rotation, 0);
      dummy.scale.set(p.scale * 1.4, p.scale * .8, p.scale);
      dummy.updateMatrix(); mesh.current!.setMatrixAt(i, dummy.matrix);
      color.setRGB(p.tint, p.tint, p.tint); mesh.current!.setColorAt(i, color);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [rocks, width]);
  useEffect(() => {
    const instance = mesh.current;
    return () => { instance?.dispose(); };
  }, []);
  return <group ref={group}>
    <instancedMesh ref={mesh} name={name} args={[geometry, material, rocks.length]} castShadow receiveShadow />
  </group>;
}

export default function GardenRocks({ width, visible }: { width: number; visible: boolean }) {
  const { nodes } = useGLTF(ROCK_MODEL);
  const maps = useGardenTextures(ROCK_TEXTURES, { flipY: false });
  const material = useMemo(() => {
    maps.forEach(map => { map.anisotropy = 4; map.needsUpdate = true; });
    maps[0].colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ name: 'garden-moss-rock', map: maps[0], normalMap: maps[1],
      roughnessMap: maps[2], aoMap: maps[2], aoMapIntensity: .5, roughness: 1, metalness: 0,
      normalScale: new THREE.Vector2(.8, .8), color: '#eee9dc' });
  }, [maps]);
  const placements = useMemo(() => {
    const rand = random(319);
    const groups: Rock[][] = [[], [], []];
    for (let i = 0; i < ROCK_COUNT; i++) {
      const z = RIVER_REACH.from - rand() * (RIVER_REACH.from - RIVER_REACH.to);
      const x = riverCenter(z, width) + (bankEdge(z, width) + rand() * 3.4) * (i % 2 ? 1 : -1);
      // Consume the original placement sequence to compare the same rock sites.
      rand(); const rotation = rand() * 6; rand();
      const scale = .1 + Math.pow(rand(), 3) * .55;
      const tint = .88 + rand() * .12;
      if (!voyageClearing(x, z, width, .4)) groups[i % 3].push({ x, z, rotation, scale, tint });
    }
    return groups.map(riverChunks);
  }, [width]);
  useEffect(() => () => material.dispose(), [material]);
  return <group name="garden-moss-rocks" visible={visible} dispose={null}>
    {placements.map((chunks, variant) => chunks.map((rocks, i) => <RockChunk key={`${variant}-${i}-${rocks.length}`}
      name={`garden-moss-rock-${variant + 1}`} geometry={(nodes[`rock-${variant + 1}`] as THREE.Mesh).geometry}
      material={material} rocks={rocks} width={width} />))}
  </group>;
}
