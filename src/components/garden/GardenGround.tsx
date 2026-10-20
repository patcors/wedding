import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { bankGeometry, RIVER_CHUNK, RIVER_REACH } from './gardenGeometry';
import { useRiverReach } from './useRiverReach';
import { useGardenTextures } from './gardenTextures';
import { seasonalWash } from './GardenSeasons';

export type GroundStyle = 'natural' | 'original' | 'leafy' | 'meadow';
export type RockStyle = 'original' | 'moss';
const BASE = import.meta.env.BASE_URL;
const ASSETS = `${BASE}models/garden/ground/`;

const GROUND_MAPS: Record<GroundStyle, string[]> = {
  // Turf with patches of leaf litter: Grass 007 in full, plus Leafy Grass's colour.
  natural: [...['color', 'normal', 'arm'].map(map => `${ASSETS}grass007-${map}.webp`), `${ASSETS}leafy_grass-color.webp`],
  original: ['color', 'normal', 'roughness'].map(map => `${BASE}textures/garden/ground-${map}.jpg`),
  leafy: ['color', 'normal', 'arm'].map(map => `${ASSETS}leafy_grass-${map}.webp`),
  meadow: ['color', 'normal', 'arm'].map(map => `${ASSETS}grass007-${map}.webp`),
};
export const groundTextures = (style: GroundStyle) => GROUND_MAPS[style];
// Bank UVs are world position / 16; turf tiles every 2.2 units.
const UV_TO_WORLD = 16, TURF_TILE = 2.2;

// Real ground is never one colour: the turf is sampled at two scales and
// rotations and blended by noise so no tile repeats, leaf litter gathers in
// patches, broad areas run lusher or drier, and the shore turns dark, brown and
// wet where it meets the water.
function naturalGround(material: THREE.MeshStandardMaterial, litter: THREE.Texture) {
  material.onBeforeCompile = shader => {
    shader.uniforms.groundLitter = { value: litter };
    shader.vertexShader = `attribute float inland;\nvarying float vInland;\n${shader.vertexShader}`
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvInland = inland;');
    shader.fragmentShader = `uniform sampler2D groundLitter;
      varying float vInland;
      float groundHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float groundNoise(vec2 p) {
        vec2 i = floor(p), f = fract(p), u = f * f * (3. - 2. * f);
        return mix(mix(groundHash(i), groundHash(i + vec2(1, 0)), u.x),
          mix(groundHash(i + vec2(0, 1)), groundHash(i + vec2(1, 1)), u.x), u.y);
      }
      float groundFbm(vec2 p) { return groundNoise(p) * .55 + groundNoise(p * 2.03 + 17.) * .3 + groundNoise(p * 4.1 + 41.) * .15; }
      ${shader.fragmentShader}`
      .replace('#include <map_fragment>', `
        vec2 groundWorld = vMapUv * ${UV_TO_WORLD.toFixed(1)};
        vec2 turfA = groundWorld / ${TURF_TILE.toFixed(1)};
        vec2 turfB = mat2(.8, -.6, .6, .8) * groundWorld / 5.3 + .37;
        vec3 turf = mix(texture2D(map, turfA).rgb, texture2D(map, turfB).rgb,
          smoothstep(.3, .7, groundNoise(groundWorld * .12)));
        float leaves = smoothstep(.5, .7, groundFbm(groundWorld * .07 + 3.));
        vec3 ground = mix(turf, texture2D(groundLitter, groundWorld / 2.6).rgb, leaves * .8);
        // Field grass is muted and a little olive, not lawn green.
        float groundLuma = dot(ground, vec3(.2126, .7152, .0722));
        ground = mix(vec3(groundLuma), ground, .55) * vec3(.9, .88, .74);
        // Broad patches of lusher and drier grass.
        float dry = groundFbm(groundWorld * .03 + 9.);
        ground *= mix(vec3(.84, .96, .80), vec3(1.12, 1.04, .76), dry);
        // The season's wash (GardenSeasons.tsx), on the grass but not the mud.
        ground = seasonGround(ground);
        // Damp brown mud along an uneven waterline, keeping the turf's grain.
        float shore = 1. - smoothstep(.2, .95 + groundNoise(groundWorld * .5) * .5, vInland);
        vec3 mud = vec3(.14, .11, .075) * (.6 + groundLuma * 1.2);
        ground = mix(ground, mud, shore * .85);
        diffuseColor.rgb *= ground;
      `)
      .replace('#include <roughnessmap_fragment>', `
        #include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, .38, shore * .75);
      `);
    seasonalWash(shader);
  };
  material.customProgramCacheKey = () => 'garden-ground-natural-seasons-v3';
}

// The ground's material in the chosen style. Anything else built as ground,
// such as the Voyage's island, gives its geometry the same attributes as the
// banks (uv at world position / 16, colour, inland) and shares the look.
export function useGroundMaterial(style: GroundStyle) {
  // Only the chosen style downloads; the others are review variants.
  const [color, normal, roughness, litter] = useGardenTextures(GROUND_MAPS[style]);
  const material = useMemo(() => {
    const original = style === 'original', natural = style === 'natural';
    for (const texture of [color, normal, roughness, litter].filter(Boolean)) {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.setScalar(original ? 1 : 8);
      // Natural ground is seen at a low angle far into the distance.
      texture.anisotropy = natural ? 8 : 4;
    }
    color.colorSpace = THREE.SRGBColorSpace;
    if (natural) {
      // The shader works out its own turf coordinates from the map's; the
      // normals and roughness follow the main turf tiling.
      color.repeat.setScalar(1);
      normal.repeat.setScalar(UV_TO_WORLD / TURF_TILE);
      roughness.repeat.setScalar(UV_TO_WORLD / TURF_TILE);
      litter.colorSpace = THREE.SRGBColorSpace;
    }
    const material = new THREE.MeshStandardMaterial({ name: `garden-ground-${style}`, map: color, normalMap: normal,
      roughnessMap: roughness, aoMap: original ? null : roughness, aoMapIntensity: .35,
      normalScale: new THREE.Vector2(original ? .8 : .55, original ? .8 : .55), roughness: 1, vertexColors: !natural });
    if (natural) {
      naturalGround(material, litter);
      return material;
    }
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
      `).replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = seasonGround(diffuseColor.rgb);');
      seasonalWash(shader);
    };
    material.customProgramCacheKey = () => `garden-ground-${original ? 'original' : 'lush'}-seasons-v3`;
    return material;
  }, [style, color, normal, roughness, litter]);
  useEffect(() => () => material.dispose(), [material]);
  return material;
}

// Each bank is one long strip of ground the length of the river. It is drawn
// a stretch at a time, sharing the strip's vertices, so only the stretches in
// the camera's reach are drawn (and reflected in the water).
function bankStretches(bank: THREE.BufferGeometry) {
  const position = bank.attributes.position, index = bank.index!;
  // PlaneGeometry's rows run along the river, two triangles per cell.
  const rowLength = (90 + 1), cellsPerRow = 90, rows = position.count / rowLength - 1;
  const rowsPerStretch = Math.ceil(rows * RIVER_CHUNK / (RIVER_REACH.from - RIVER_REACH.to));
  const stretches = [];
  for (let row = 0; row < rows; row += rowsPerStretch) {
    const last = Math.min(rows, row + rowsPerStretch);
    const geometry = new THREE.BufferGeometry();
    for (const [name, attribute] of Object.entries(bank.attributes)) geometry.setAttribute(name, attribute);
    geometry.setIndex(index);
    geometry.setDrawRange(row * cellsPerRow * 6, (last - row) * cellsPerRow * 6);
    // Bounds of just this stretch, for frustum culling.
    const points = [];
    for (let i = row * rowLength; i < (last + 1) * rowLength; i++) points.push(new THREE.Vector3().fromBufferAttribute(position, i));
    geometry.boundingSphere = new THREE.Sphere().setFromPoints(points);
    geometry.boundingBox = new THREE.Box3().setFromPoints(points);
    stretches.push({ geometry, span: [{ z: points[0].z }, { z: points[points.length - 1].z }] });
  }
  return stretches;
}

function BankStretch({ geometry, span, material, name }: { geometry: THREE.BufferGeometry; span: { z: number }[]; material: THREE.Material; name: string }) {
  const mesh = useRef<THREE.Mesh>(null);
  useRiverReach(mesh, span);
  return <mesh ref={mesh} name={name} geometry={geometry} material={material} receiveShadow />;
}

export default function GardenGround({ width, style }: { width: number; style: GroundStyle }) {
  const material = useGroundMaterial(style);
  const banks = useMemo(() => [bankGeometry(-1, width), bankGeometry(1, width)], [width]);
  const stretches = useMemo(() => banks.map(bankStretches), [banks]);
  useEffect(() => () => banks.forEach(g => g.dispose()), [banks]);
  return <>{stretches.map((bank, i) => bank.map((stretch, j) => <BankStretch key={`${i}-${j}`} name={`garden-bank-${i}`}
    geometry={stretch.geometry} span={stretch.span} material={material} />))}</>;
}
