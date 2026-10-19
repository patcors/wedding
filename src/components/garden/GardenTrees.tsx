import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { groundHeight, riverChunks } from './gardenGeometry';
import { TREE_SINK, oldTreePlacement, treePlacements, type Placement } from './gardenTreeSpots';
import { useGardenTextures } from './gardenTextures';
import { useRiverReach } from './useRiverReach';
import { SEASON_UNIFORMS, seasonalLeaves } from './GardenSeasons';

const BASE = `${import.meta.env.BASE_URL}models/garden/`;
// The four ash models, the old tree at Jasper's Berry where the boats dock, a
// shrub, and the far branches of the two distant ashes.
export const TREE_MODELS = ['ash-1.glb', 'ash-2.glb', 'ash-1-distant.glb', 'ash-2-distant.glb', 'old-tree.glb', 'bush.glb',
  'ash-1-far.glb', 'ash-2-far.glb'].map(file => BASE + file);
// Stretches of river at least this far ahead of the camera, deep in the mist,
// draw the distant ashes' far branches: the same silhouette with a third of
// the faces. The leaves don't change.
const FAR_BRANCHES = { desktop: 46, mobile: 34 };
// Where they stand is gardenTreeSpots.ts.
export { OLD_TREE_SCALE } from './gardenTreeSpots';
const LIGHT_TEXTURES = ['bark-color.webp', 'bark-normal.webp', 'bark-roughness.webp', 'ash-leaves.webp'].map(file => BASE + file);
const DARK_TEXTURES = ['bark-color-dark.webp', 'bark-normal.webp', 'bark-roughness.webp', 'ash-leaves-dark.webp'].map(file => BASE + file);
export const treeTextures = (light: boolean) => light ? LIGHT_TEXTURES : DARK_TEXTURES;

function TreeBatch({ geometry, material, depthMaterial, placements, leaves, mobile, width }: {
  geometry: THREE.BufferGeometry; material: THREE.Material; depthMaterial?: THREE.Material;
  width: number; placements: Placement[]; leaves: boolean; mobile: boolean;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!mesh.current) return;
    const dummy = new THREE.Object3D();
    placements.forEach((p, i) => {
      dummy.position.set(p.x, (p.y ?? groundHeight(p.x, p.z, width)) - TREE_SINK, p.z);
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

type TreeModel = { nodes: Record<string, THREE.Object3D> };
const meshGeometry = (model: TreeModel, part: string) => (model.nodes[part] as THREE.Mesh).geometry;

// One stretch of river's trees of one model, hidden when out of reach. With
// `far` branches, it switches to them while the stretch is far ahead.
function TreeChunk({ model, far, materials, placements, mobile, width }: {
  model: TreeModel; far?: TreeModel; materials: { bark: THREE.Material; leaves: THREE.Material; depth: THREE.Material };
  placements: Placement[]; mobile: boolean; width: number;
}) {
  const group = useRef<THREE.Group>(null);
  const near = useRef<THREE.Group>(null), distant = useRef<THREE.Group>(null);
  useRiverReach(group, placements);
  const front = useMemo(() => Math.max(...placements.map(p => p.z)), [placements]);
  useFrame(({ camera }) => {
    if (!far || !near.current || !distant.current) return;
    const away = camera.position.z - front > (mobile ? FAR_BRANCHES.mobile : FAR_BRANCHES.desktop);
    near.current.visible = !away;
    distant.current.visible = away;
  });
  return <group ref={group}>
    <group ref={near}>
      <TreeBatch geometry={meshGeometry(model, 'branches')} material={materials.bark}
        placements={placements} leaves={false} mobile={mobile} width={width} />
    </group>
    {far && <group ref={distant} visible={false}>
      <TreeBatch geometry={meshGeometry(far, 'branches')} material={materials.bark}
        placements={placements} leaves={false} mobile={mobile} width={width} />
    </group>}
    <TreeBatch geometry={meshGeometry(model, 'leaves')} material={materials.leaves}
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
    // The year turns in the leaves too (GardenSeasons.tsx), by uniforms alone.
    leaves.onBeforeCompile = depth.onBeforeCompile = (shader, renderer) => {
      animate(shader, renderer);
      seasonalLeaves(shader);
    };
    leaves.customProgramCacheKey = depth.customProgramCacheKey = () => 'garden-leaf-wind-seasons-v1';
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
    const all = treePlacements(width, mobile);
    return [0, 1, 2, 3, 5].map(type => riverChunks(all.filter(p => p.type === type)));
  }, [width, mobile]);
  const oldTree = useMemo(() => [oldTreePlacement(width, mobile)], [width, mobile]);
  useLayoutEffect(() => { SEASON_UNIFORMS.seasonEvergreen.value.set(oldTree[0].x, oldTree[0].z); }, [oldTree]);
  const [ash1, ash2, ash1Distant, ash2Distant, old, bush, ash1Far, ash2Far] = models;
  const far = [undefined, undefined, ash1Far, ash2Far, undefined];

  return <group name="ez-tree-grove" dispose={null}>
    {[ash1, ash2, ash1Distant, ash2Distant, bush].map((model, i) => placements[i].map((chunk, j) => <TreeChunk key={`${i}-${j}-${chunk.length}`}
      model={model} far={far[i]} materials={materials} placements={chunk} mobile={mobile} width={width} />))}
    <TreeChunk model={old} materials={materials} placements={oldTree} mobile={mobile} width={width} />
  </group>;
}
