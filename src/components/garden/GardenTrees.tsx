import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { bankEdge, groundHeight, random } from './gardenGeometry';

const BASE = `${import.meta.env.BASE_URL}models/garden/`;
type Placement = { x: number; z: number; scale: number; rotation: number; type: number; distant: boolean };

function TreeBatch({ geometry, material, depthMaterial, placements, leaves, mobile }: {
  geometry: THREE.BufferGeometry; material: THREE.Material; depthMaterial?: THREE.Material;
  placements: Placement[]; leaves: boolean; mobile: boolean;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!mesh.current) return;
    const dummy = new THREE.Object3D();
    placements.forEach((p, i) => {
      dummy.position.set(p.x, groundHeight(p.x, p.z, mobile ? .30 : 1) - .08, p.z);
      dummy.rotation.set(0, p.rotation, 0);
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.computeBoundingSphere();
    // Account for the small shader displacement when frustum culling.
    if (mesh.current.boundingSphere) mesh.current.boundingSphere.radius += .3;
  }, [placements, mobile]);
  useEffect(() => {
    const instance = mesh.current;
    return () => { instance?.dispose(); };
  }, []);
  return <instancedMesh ref={mesh} name={`ez-tree-${leaves ? 'leaves' : 'branches'}`}
    args={[geometry, material, placements.length]} customDepthMaterial={depthMaterial}
    castShadow={!placements[0]?.distant && (!leaves || !mobile)} receiveShadow />;
}

export default function GardenTrees({ width, mobile, paused }: { width: number; mobile: boolean; paused: boolean }) {
  const models = useGLTF(['ash-1.glb', 'ash-2.glb', 'ash-1-distant.glb', 'ash-2-distant.glb'].map(file => BASE + file));
  const [barkColor, barkNormal, barkRoughness, leafMap] = useTexture(
    ['bark-color.webp', 'bark-normal.webp', 'bark-roughness.webp', 'ash-leaves.webp'].map(file => BASE + file));
  const windTime = useMemo(() => ({ value: 0 }), []);
  const materials = useMemo(() => {
    for (const texture of [barkColor, barkNormal, barkRoughness]) {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(.5, .20);
      texture.anisotropy = 4;
      texture.needsUpdate = true;
    }
    barkColor.colorSpace = leafMap.colorSpace = THREE.SRGBColorSpace;
    leafMap.anisotropy = 4;
    // These geometry-only GLBs preserve EZ-Tree's original UVs. No exporter
    // texture flip was baked in, so keep the source TextureLoader convention.
    for (const texture of [barkColor, barkNormal, barkRoughness, leafMap]) {
      texture.flipY = true;
      texture.needsUpdate = true;
    }
    const bark = new THREE.MeshStandardMaterial({ map: barkColor, normalMap: barkNormal,
      roughnessMap: barkRoughness, normalScale: new THREE.Vector2(.65, .65), color: '#eee4d2', roughness: .95 });
    const leaves = new THREE.MeshStandardMaterial({ map: leafMap, color: '#edf0d7',
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
  }, [barkColor, barkNormal, barkRoughness, leafMap, windTime]);
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
      x: mobile ? Math.sign(x) * (bankEdge(z, width) + 3.8 + (i % 3) * .2) : x,
      z, scale: scale * (mobile ? .88 : 1), rotation, type: i % 2 + (i >= 4 ? 2 : 0), distant: i >= 4,
    }));
    const rand = random(415);
    const groves = Array.from({ length: mobile ? 12 : 24 }, (_, i) => ({
      x: (i % 2 ? 1 : -1) * ((mobile ? 6.5 : 17) + Math.floor(i % 8 / 2) * (mobile ? 3 : 8) + rand() * 2),
      z: -14 - Math.floor(i / 8) * 23 - rand() * 11,
      scale: 1.05 + rand() * .5, rotation: rand() * Math.PI * 2, type: 2 + i % 2, distant: true,
    }));
    return [0, 1, 2, 3].map(type => [...avenue, ...groves].filter(p => p.type === type));
  }, [width, mobile]);

  return <group name="ez-tree-grove" dispose={null}>
    {models.map((model, i) => <group key={i}>
      <TreeBatch geometry={(model.nodes.branches as THREE.Mesh).geometry} material={materials.bark}
        placements={placements[i]} leaves={false} mobile={mobile} />
      <TreeBatch geometry={(model.nodes.leaves as THREE.Mesh).geometry} material={materials.leaves}
        depthMaterial={materials.depth} placements={placements[i]} leaves mobile={mobile} />
    </group>)}
  </group>;
}
