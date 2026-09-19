import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useGLTF, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { bankEdge, riverCenter, groundHeight, random } from './gardenGeometry';

const ASSETS = `${import.meta.env.BASE_URL}models/garden/ground/`;

const rockModel = `${ASSETS}moss-rocks.glb`;
const rockTextures = ['color', 'normal', 'arm'].map(map => `${ASSETS}rock_moss_set_01-${map}.webp`);
useGLTF.preload(rockModel);
useTexture.preload(rockTextures);

export default function GardenRocks({ width, visible }: { width: number; visible: boolean }) {
  const { nodes } = useGLTF(rockModel);
  const maps = useTexture(rockTextures);
  const meshes = useRef<(THREE.InstancedMesh | null)[]>([]);
  const material = useMemo(() => {
    maps.forEach(map => { map.flipY = false; map.anisotropy = 4; map.needsUpdate = true; });
    maps[0].colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ name: 'garden-moss-rock', map: maps[0], normalMap: maps[1],
      roughnessMap: maps[2], aoMap: maps[2], aoMapIntensity: .5, roughness: 1, metalness: 0,
      normalScale: new THREE.Vector2(.8, .8), color: '#eee9dc' });
  }, [maps]);
  const placements = useMemo(() => {
    const rand = random(319);
    const groups: { x: number; z: number; rotation: number; scale: number; tint: number }[][] = [[], [], []];
    for (let i = 0; i < 260; i++) {
      const z = 26 - rand() * 126;
      const x = riverCenter(z, width) + (bankEdge(z, width) + rand() * 3.4) * (i % 2 ? 1 : -1);
      // Consume the original placement sequence to compare the same rock sites.
      rand(); const rotation = rand() * 6; rand();
      const scale = .1 + Math.pow(rand(), 3) * .55;
      groups[i % 3].push({ x, z, rotation, scale, tint: .88 + rand() * .12 });
    }
    return groups;
  }, [width]);
  useLayoutEffect(() => {
    const dummy = new THREE.Object3D(), color = new THREE.Color();
    placements.forEach((group, variant) => {
      const mesh = meshes.current[variant];
      if (!mesh) return;
      group.forEach((p, i) => {
        dummy.position.set(p.x, groundHeight(p.x, p.z, width) - p.scale * .16, p.z);
        dummy.rotation.set(0, p.rotation, 0);
        dummy.scale.set(p.scale * 1.4, p.scale * .8, p.scale);
        dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
        color.setRGB(p.tint, p.tint, p.tint); mesh.setColorAt(i, color);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    });
  }, [placements, width]);
  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => {
    const instances = meshes.current;
    return () => instances.forEach(mesh => mesh?.dispose());
  }, []);
  return <group name="garden-moss-rocks" visible={visible} dispose={null}>
    {placements.map((group, i) => <instancedMesh key={i} ref={mesh => { meshes.current[i] = mesh; }}
      name={`garden-moss-rock-${i + 1}`} args={[(nodes[`rock-${i + 1}`] as THREE.Mesh).geometry, material, group.length]}
      castShadow receiveShadow />)}
  </group>;
}
