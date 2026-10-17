// The sky and light: background, fog, sky dome, sun and the water's tint. The
// Voyage runs dawn to dusk through one day, driven by useJourney().progress;
// for now the palette is the Garden's misty daylight throughout.
import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { riverCenter } from './gardenGeometry';
import { routeAt } from './journey';
import { useJourney, type SlotProps } from './JourneyProvider';
import type { WaterTint } from './GardenWater';

export const SKY = '#eeeee5';
// Review options. 'blue' is a clear day: a soft grey-blue sky, slightly deeper
// overhead, over deep blue water. The fog takes the horizon colour so distant
// trees still melt into the sky, and the page colours in CSS and GardenPage use
// the zenith so Safari's bars join it. 'combo' keeps the misty sky and takes
// only blue water.
export type SkyStyle = 'mist' | 'blue' | 'combo';
export const BLUE_SKY = { zenith: '#9dacc7', horizon: '#abbed8', water: '#1d4f8c', glint: '#eef5ff' };
const WATER = { water: '#b5bca6', glint: '#fff9e9' };
const COMBO_WATER = { water: '#4d86c4', glint: '#eef5ff' };

// A dome that follows the camera, shaded by height above the horizon. The
// water's reflection picks it up too. It sits inside the camera's far plane.
function SkyDome() {
  const dome = useRef<THREE.Mesh>(null);
  const material = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { zenith: { value: new THREE.Color(BLUE_SKY.zenith) }, horizon: { value: new THREE.Color(BLUE_SKY.horizon) } },
    vertexShader: `varying vec3 vDirection;
      void main() { vDirection = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform vec3 zenith; uniform vec3 horizon; varying vec3 vDirection;
      void main() { float h = normalize(vDirection).y;
        gl_FragColor = vec4(mix(horizon, zenith, smoothstep(-.02, .5, h)), 1.);
        #include <colorspace_fragment>
      }`,
  }), []);
  useEffect(() => () => material.dispose(), [material]);
  useFrame(({ camera }) => dome.current?.position.copy(camera.position));
  return <mesh ref={dome} material={material} renderOrder={-1} frustumCulled={false}>
    <sphereGeometry args={[80, 32, 16]} />
  </mesh>;
}

// The sun keeps its direction; its shadows follow the voyage, centred a little
// ahead of the boats. The shadow camera moves in whole shadow-map texels so
// shadow edges don't crawl as it goes.
const SUN = new THREE.Vector3(-18, 24, 9);
const SHADOW = { left: -30, right: 30, top: 35, bottom: -35, map: 1024 };
function useSunFollowsVoyage(sun: RefObject<THREE.DirectionalLight | null>, width: number) {
  const clock = useJourney();
  const frame = useMemo(() => {
    const forward = SUN.clone().negate().normalize();
    const right = new THREE.Vector3().crossVectors(forward, THREE.Object3D.DEFAULT_UP).normalize();
    return { right, up: new THREE.Vector3().crossVectors(right, forward), focus: new THREE.Vector3() };
  }, []);
  useFrame(() => {
    const light = sun.current;
    if (!light) return;
    const z = routeAt(clock.progress) - 10;
    const { right, up, focus } = frame;
    focus.set(riverCenter(z, width), 0, z);
    const snap = (axis: THREE.Vector3, texel: number) => {
      const along = focus.dot(axis);
      focus.addScaledVector(axis, Math.round(along / texel) * texel - along);
    };
    snap(right, (SHADOW.right - SHADOW.left) / SHADOW.map);
    snap(up, (SHADOW.top - SHADOW.bottom) / SHADOW.map);
    light.target.position.copy(focus);
    light.target.updateMatrixWorld();
    light.position.copy(focus).add(SUN);
  });
}

export default function GardenSky({ mobile, width, skyStyle, waterTint }: SlotProps & { skyStyle: SkyStyle; waterTint: WaterTint }) {
  const clear = skyStyle === 'blue';
  const sun = useRef<THREE.DirectionalLight>(null);
  useSunFollowsVoyage(sun, width);
  const tint = clear ? BLUE_SKY : skyStyle === 'combo' ? COMBO_WATER : WATER;
  useLayoutEffect(() => {
    waterTint.water.set(tint.water);
    waterTint.glint.set(tint.glint);
  }, [waterTint, tint]);
  return <>
    <color attach="background" args={[clear ? BLUE_SKY.horizon : SKY]} />
    {clear && <SkyDome />}
    {/* A clear day keeps the middle distance crisp; the far end still fades. */}
    <fog attach="fog" args={[clear ? BLUE_SKY.horizon : SKY, clear ? (mobile ? 22 : 38) : (mobile ? 8 : 16), mobile ? 85 : 110]} />
    {/* Under a blue sky the sun is warmer and stronger, and shade turns cool. */}
    <hemisphereLight key={skyStyle} args={clear ? ['#d3e3fb', '#8d9a68', 1.45] : ['#fffbee', '#b0b5a0', 1.7]} />
    <directionalLight ref={sun} position={SUN.toArray()} intensity={clear ? 2.9 : 2.3} color={clear ? '#ffeac7' : '#fff2d6'} castShadow
      shadow-mapSize={[SHADOW.map, SHADOW.map]} shadow-camera-left={SHADOW.left} shadow-camera-right={SHADOW.right}
      shadow-camera-top={SHADOW.top} shadow-camera-bottom={SHADOW.bottom} shadow-camera-far={110}
      shadow-bias={-.0003} shadow-normalBias={.07} />
  </>;
}
