import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { riverCenter, bankEdge, bendShift, groundHeight, random, riverChunks, sydneyWiden, RIVER_REACH } from './gardenGeometry';
import { useGardenTextures } from './gardenTextures';
import { useRiverReach } from './useRiverReach';

const BASE = `${import.meta.env.BASE_URL}models/garden/`;
export const TREE_MODELS = ['ash-1.glb', 'ash-2.glb', 'ash-1-distant.glb', 'ash-2-distant.glb'].map(file => BASE + file);
const LIGHT_TEXTURES = ['bark-color.webp', 'bark-normal.webp', 'bark-roughness.webp', 'ash-leaves.webp'].map(file => BASE + file);
const DARK_TEXTURES = ['bark-color-dark.webp', 'bark-normal.webp', 'bark-roughness.webp', 'ash-leaves-dark.webp'].map(file => BASE + file);
export const treeTextures = (light: boolean) => light ? LIGHT_TEXTURES : DARK_TEXTURES;
type Placement = { x: number; z: number; scale: number; rotation: number; type: number; distant: boolean };

function TreeBatch({ geometry, material, depthMaterial, placements, leaves, mobile, width }: {
  geometry: THREE.BufferGeometry; material: THREE.Material; depthMaterial?: THREE.Material;
  width: number; placements: Placement[]; leaves: boolean; mobile: boolean;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!mesh.current) return;
    const dummy = new THREE.Object3D();
    placements.forEach((p, i) => {
      dummy.position.set(p.x, groundHeight(p.x, p.z, width) - .08, p.z);
      dummy.rotation.set(0, p.rotation, 0);
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.computeBoundingSphere();
    // Account for the small shader displacement when frustum culling.
    if (mesh.current.boundingSphere) mesh.current.boundingSphere.radius += .3;
  }, [placements, width]);
  useEffect(() => {
    const instance = mesh.current;
    return () => { instance?.dispose(); };
  }, []);
  return <instancedMesh ref={mesh} name={`ez-tree-${leaves ? 'leaves' : 'branches'}`}
    args={[geometry, material, placements.length]} customDepthMaterial={depthMaterial}
    castShadow={!placements[0]?.distant && (!leaves || !mobile)} receiveShadow />;
}

// One stretch of river's trees of one model, hidden when out of reach.
function TreeChunk({ model, materials, placements, mobile, width }: {
  model: { nodes: Record<string, THREE.Object3D> }; materials: { bark: THREE.Material; leaves: THREE.Material; depth: THREE.Material };
  placements: Placement[]; mobile: boolean; width: number;
}) {
  const group = useRef<THREE.Group>(null);
  useRiverReach(group, placements);
  return <group ref={group}>
    <TreeBatch geometry={(model.nodes.branches as THREE.Mesh).geometry} material={materials.bark}
      placements={placements} leaves={false} mobile={mobile} width={width} />
    <TreeBatch geometry={(model.nodes.leaves as THREE.Mesh).geometry} material={materials.leaves}
      depthMaterial={materials.depth} placements={placements} leaves mobile={mobile} width={width} />
  </group>;
}

export default function GardenTrees({ width, mobile, paused, lightTrees }: {
  width: number; mobile: boolean; paused: boolean; lightTrees: boolean;
}) {
  const models = useGLTF(TREE_MODELS);
  // Only the palette in use downloads; the other is a Review variant. These
  // geometry-only GLBs preserve EZ-Tree's original UVs. No exporter texture flip
  // was baked in, so the maps load flipped, the source TextureLoader convention.
  const [barkColor, barkNormal, barkRoughness, leafMap] = useGardenTextures(treeTextures(lightTrees));
  const windTime = useMemo(() => ({ value: 0 }), []);
  // Set up each palette's maps as it arrives.
  useMemo(() => {
    for (const texture of [barkColor, barkNormal, barkRoughness]) {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(.5, .20);
      texture.anisotropy = 4;
    }
    for (const texture of [barkColor, leafMap]) texture.colorSpace = THREE.SRGBColorSpace;
    leafMap.anisotropy = 4;
    for (const texture of [barkColor, barkNormal, barkRoughness, leafMap]) texture.needsUpdate = true;
  }, [barkColor, barkNormal, barkRoughness, leafMap]);
  const materials = useMemo(() => {
    const bark = new THREE.MeshStandardMaterial({ map: barkColor, normalMap: barkNormal,
      roughnessMap: barkRoughness, normalScale: new THREE.Vector2(.65, .65), roughness: .95 });
    const leaves = new THREE.MeshStandardMaterial({ map: leafMap,
      side: THREE.DoubleSide, alphaTest: .45, roughness: .95 });
    const depth = new THREE.MeshDepthMaterial({ map: leafMap, alphaTest: .45,
      side: THREE.DoubleSide, depthPacking: THREE.RGBADepthPacking });
    // The same displacement in colour, reflection and shadow passes keeps the
    // canopy attached to its shadows. Move whole leaf cards around their centres.
    const animate: THREE.Material['onBeforeCompile'] = shader => {
      shader.uniforms.gardenWindTime = windTime;
      shader.vertexShader = `uniform float gardenWindTime; attribute vec3 _leafcentre;\n` + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
        #include <begin_vertex>
        float phase = dot(_leafcentre.xz, vec2(.47, .31));
        #ifdef USE_INSTANCING
          phase += dot(instanceMatrix[3].xz, vec2(.17, .23));
        #endif
        float sway = sin(gardenWindTime * .65 + phase) * .07;
        float flutter = sin(gardenWindTime * 1.5 + phase * 4.0) * .06;
        transformed.x += sway * smoothstep(1.0, 8.0, _leafcentre.y);
        transformed.z += flutter * (position.y - _leafcentre.y);
      `);
    };
    leaves.onBeforeCompile = depth.onBeforeCompile = animate;
    leaves.customProgramCacheKey = depth.customProgramCacheKey = () => 'garden-leaf-wind-v1';
    return { bark, leaves, depth };
    // Built once, so the meshes keep them; the palette's maps are set below.
  }, [windTime]);
  useLayoutEffect(() => {
    // Reuse the same meshes, materials and wind clock; only the palette changes.
    Object.assign(materials.bark, { map: barkColor, normalMap: barkNormal, roughnessMap: barkRoughness });
    materials.bark.color.set(lightTrees ? '#eee4d2' : '#c8bea7');
    materials.leaves.map = materials.depth.map = leafMap;
    materials.leaves.color.set(lightTrees ? '#edf0d7' : '#becba4');
  }, [lightTrees, materials, barkColor, barkNormal, barkRoughness, leafMap]);
  useEffect(() => () => { materials.bark.dispose(); materials.leaves.dispose(); materials.depth.dispose(); }, [materials]);
  useFrame((_, dt) => { if (!paused) windTime.value += Math.min(dt, .05); });

  const placements = useMemo(() => {
    const avenue = [
      [-8.6, 4, 1.22, .3], [8.8, 0, 1.30, 2.1],
      [-11.5, -17, 1.08, 1.3], [11.7, -21, 1.2, .7],
      [-10.2, -37, 1.17, 2.9], [10.7, -43, 1.03, .1],
      [-8.7, -59, 1.12, 1.8], [9, -67, 1.23, 3.5],
      [-8, -85, 1.05, .2], [8, -95, 1.15, 2.2],
    ].map(([x, z, scale, rotation], i) => ({
      // In portrait the first right-hand tree stands nearer the water, to
      // balance the reed bed opposite. Desktop's are placed by hand, moved
      // only where the Voyage widens or bends the river.
      x: mobile ? riverCenter(z, width) + Math.sign(x) * (bankEdge(z, width) + (i === 1 ? 2.2 : 3.8 + (i % 3) * .2))
        : x + bendShift(z) + Math.sign(x) * sydneyWiden(z, width),
      z, scale: scale * (mobile ? .88 : 1), rotation, type: i % 2 + (i >= 4 ? 2 : 0), distant: i >= 4,
    }));
    // The avenue carries on down the rest of the river, alternating banks.
    for (let z = -105, i = 0; z > RIVER_REACH.to + 10; z -= 10 + (i * 7 % 5), i++) {
      const side = i % 2 ? 1 : -1;
      avenue.push({ x: riverCenter(z, width) + side * (bankEdge(z, width) + (mobile ? 3.8 : 3.2) + (i % 3) * .4), z,
        scale: (1.05 + (i * 3 % 4) * .06) * (mobile ? .88 : 1), rotation: i * 1.7, type: 2 + i % 2, distant: true });
    }
    // Portrait also fills the open stretch of left bank between the first two trees.
    if (mobile) avenue.push({ x: riverCenter(-7, width) - bankEdge(-7, width) - 3.6, z: -7, scale: .95, rotation: 4.4, type: 1, distant: false });
    const rand = random(415);
    // Stagger groves along both banks all the way into the mist. The inner
    // trees overlap the avenue while outer trees fill gaps between canopies.
    const perRow = mobile ? 6 : 10, rows = Math.ceil((-16 - RIVER_REACH.to) / 12);
    const groves = Array.from({ length: rows * perRow }, (_, i) => {
      const row = Math.floor(i / perRow);
      const lane = Math.floor(i % perRow / 2);
      const z = -16 - row * 12 - rand() * 8;
      const inland = 4.8 + lane * (mobile ? 3.8 : 6) + rand() * 2.5;
      return {
        x: riverCenter(z, width) + (i % 2 ? 1 : -1) * (bankEdge(z, width) + inland),
        z, scale: .95 + rand() * .6, rotation: rand() * Math.PI * 2,
        type: 2 + (i + row + lane) % 2, distant: true,
      };
    });
    return [0, 1, 2, 3].map(type => riverChunks([...avenue, ...groves].filter(p => p.type === type)));
  }, [width, mobile]);

  return <group name="ez-tree-grove" dispose={null}>
    {models.map((model, i) => placements[i].map((chunk, j) => <TreeChunk key={`${i}-${j}-${chunk.length}`}
      model={model} materials={materials} placements={chunk} mobile={mobile} width={width} />))}
  </group>;
}
