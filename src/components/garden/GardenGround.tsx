import { useEffect, useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { bankGeometry } from './gardenGeometry';

export type GroundStyle = 'original' | 'leafy' | 'meadow';
export type RockStyle = 'original' | 'moss';
const BASE = import.meta.env.BASE_URL;
const ASSETS = `${BASE}models/garden/ground/`;

const GROUND_MAPS: Record<GroundStyle, string[]> = {
  original: ['color', 'normal', 'roughness'].map(map => `${BASE}textures/garden/ground-${map}.jpg`),
  leafy: ['color', 'normal', 'arm'].map(map => `${ASSETS}leafy_grass-${map}.webp`),
  meadow: ['color', 'normal', 'arm'].map(map => `${ASSETS}grass007-${map}.webp`),
};

export default function GardenGround({ width, style }: { width: number; style: GroundStyle }) {
  // Only the chosen style downloads; the others are review variants.
  const [color, normal, roughness] = useTexture(GROUND_MAPS[style]);
  const material = useMemo(() => {
    const original = style === 'original';
    for (const texture of [color, normal, roughness]) {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.setScalar(original ? 1 : 8);
      texture.anisotropy = 4;
    }
    color.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshStandardMaterial({ name: `garden-ground-${style}`, map: color, normalMap: normal,
      roughnessMap: roughness, aoMap: original ? null : roughness, aoMapIntensity: .35,
      normalScale: new THREE.Vector2(original ? .8 : .55, original ? .8 : .55), roughness: 1, vertexColors: true });
    material.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', original ? `
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
    material.customProgramCacheKey = () => `garden-ground-${original ? 'original' : 'lush'}-v1`;
    return material;
  }, [style, color, normal, roughness]);
  const geometries = useMemo(() => [bankGeometry(-1, width), bankGeometry(1, width)], [width]);
  useEffect(() => () => geometries.forEach(g => g.dispose()), [geometries]);
  useEffect(() => () => material.dispose(), [material]);
  return <>{geometries.map((geometry, i) => <mesh key={i} name={`garden-bank-${i}`} geometry={geometry} material={material} receiveShadow />)}</>;
}
