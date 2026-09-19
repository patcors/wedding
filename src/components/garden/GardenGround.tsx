import { useEffect, useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { bankGeometry } from './gardenGeometry';

export type GroundStyle = 'original' | 'leafy' | 'meadow';
export type RockStyle = 'original' | 'moss';
const BASE = import.meta.env.BASE_URL;
const ASSETS = `${BASE}models/garden/ground/`;

export default function GardenGround({ width, style }: { width: number; style: GroundStyle }) {
  const maps = useTexture([
    ...['color', 'normal', 'roughness'].map(map => `${BASE}textures/garden/ground-${map}.jpg`),
    ...['leafy_grass', 'grass007'].flatMap(name => ['color', 'normal', 'arm'].map(map => `${ASSETS}${name}-${map}.webp`)),
  ]);
  const materials = useMemo(() => {
    return ['original', 'leafy', 'meadow'].map((name, i) => {
      const [color, normal, roughness] = maps.slice(i * 3, i * 3 + 3);
      for (const texture of [color, normal, roughness]) {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.setScalar(i === 0 ? 1 : 8);
        texture.anisotropy = 4;
      }
      color.colorSpace = THREE.SRGBColorSpace;
      const material = new THREE.MeshStandardMaterial({ name: `garden-ground-${name}`, map: color, normalMap: normal,
        roughnessMap: roughness, aoMap: i === 0 ? null : roughness, aoMapIntensity: .35,
        normalScale: new THREE.Vector2(i === 0 ? .8 : .55, i === 0 ? .8 : .55), roughness: 1, vertexColors: true });
      material.onBeforeCompile = shader => {
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', i === 0 ? `
          #include <map_fragment>
          float groundLuma = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(groundLuma), 0.65);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.30, 0.32, 0.22), 0.30);
        ` : `
          #include <map_fragment>
          float groundLuma = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(groundLuma), 0.16);
          // Broad patches soften repetition without enlarging the fine blades.
          float groundPatch = sin(vMapUv.x * .51 + sin(vMapUv.y * .37)) * sin(vMapUv.y * .43);
          diffuseColor.rgb *= 1.0 + groundPatch * .10;
        `);
      };
      material.customProgramCacheKey = () => `garden-ground-${i === 0 ? 'original' : 'lush'}-v1`;
      return material;
    });
  }, [maps]);
  const geometries = useMemo(() => [bankGeometry(-1, width), bankGeometry(1, width)], [width]);
  useEffect(() => () => geometries.forEach(g => g.dispose()), [geometries]);
  useEffect(() => () => materials.forEach(m => m.dispose()), [materials]);
  const material = materials[style === 'original' ? 0 : style === 'leafy' ? 1 : 2];
  return <>{geometries.map((geometry, i) => <mesh key={i} name={`garden-bank-${i}`} geometry={geometry} material={material} receiveShadow />)}</>;
}
