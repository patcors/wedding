// The sky and light: background, fog, sky dome, sun and the water's tint. The
// Voyage runs dawn to dusk through one day (skyCycle.ts), following
// useJourney().progress, and the page's copy glows in the sky's colours.
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { riverCenter } from './gardenGeometry';
import { routeAt } from './journey';
import { useJourney, type SlotProps } from './JourneyProvider';
import type { WaterTint } from './GardenWater';
import { DAY, hex, skyAt, type Rgb, type Sky } from './skyCycle';

export const SKY = DAY.horizon;
// Review options. 'blue' is a clear day: a soft grey-blue sky, slightly deeper
// overhead, over deep blue water. The fog takes the horizon colour so distant
// trees still melt into the sky, and the page colours in CSS and GardenPage use
// the zenith so Safari's bars join it. It stays a clear day all the way. 'combo'
// keeps the misty sky, dawn to dusk, and takes only blue water.
export type SkyStyle = 'mist' | 'blue' | 'combo';
export const BLUE_SKY = { zenith: '#9dacc7', horizon: '#abbed8', water: '#1d4f8c', glint: '#eef5ff' };
const COMBO_WATER = { water: '#4d86c4', glint: '#eef5ff' };

const set = (color: THREE.Color, [r, g, b]: Rgb) => color.setRGB(r, g, b, THREE.SRGBColorSpace);

// A dome that follows the camera, shaded by height above the horizon. The
// water's reflection picks it up too. It sits inside the camera's far plane.
function SkyDome({ colors }: { colors: { zenith: THREE.Color; horizon: THREE.Color } }) {
  const dome = useRef<THREE.Mesh>(null);
  const material = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { zenith: { value: colors.zenith }, horizon: { value: colors.horizon } },
    vertexShader: `varying vec3 vDirection;
      void main() { vDirection = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform vec3 zenith; uniform vec3 horizon; varying vec3 vDirection;
      void main() { float h = normalize(vDirection).y;
        gl_FragColor = vec4(mix(horizon, zenith, smoothstep(-.02, .5, h)), 1.);
        #include <colorspace_fragment>
      }`,
  }), [colors]);
  useEffect(() => () => material.dispose(), [material]);
  useFrame(({ camera }) => dome.current?.position.copy(camera.position));
  return <mesh ref={dome} material={material} renderOrder={-1} frustumCulled={false}>
    <sphereGeometry args={[80, 32, 16]} />
  </mesh>;
}

// The sun's direction changes through the day; its shadows follow the voyage,
// centred a little ahead of the boats. The shadow camera moves in whole
// shadow-map texels so shadow edges don't crawl as it goes.
const SHADOW = { left: -30, right: 30, top: 35, bottom: -35, map: 1024 };
function useSunFollowsVoyage(sun: RefObject<THREE.DirectionalLight | null>, offset: THREE.Vector3, width: number) {
  const clock = useJourney();
  const frame = useMemo(() => ({ forward: new THREE.Vector3(), right: new THREE.Vector3(), up: new THREE.Vector3(), focus: new THREE.Vector3() }), []);
  useFrame(() => {
    const light = sun.current;
    if (!light) return;
    const z = routeAt(clock.progress) - 10;
    const { forward, right, up, focus } = frame;
    forward.copy(offset).negate().normalize();
    right.crossVectors(forward, THREE.Object3D.DEFAULT_UP).normalize();
    up.crossVectors(right, forward);
    focus.set(riverCenter(z, width), 0, z);
    const snap = (axis: THREE.Vector3, texel: number) => {
      const along = focus.dot(axis);
      focus.addScaledVector(axis, Math.round(along / texel) * texel - along);
    };
    snap(right, (SHADOW.right - SHADOW.left) / SHADOW.map);
    snap(up, (SHADOW.top - SHADOW.bottom) / SHADOW.map);
    light.target.position.copy(focus);
    light.target.updateMatrixWorld();
    light.position.copy(focus).add(offset);
  });
}

// The page's copy sits on pale glows that take the sky's colour, in ink that
// suits it. While scrolling, a colour is written only once it has moved enough
// to see, so the page isn't restyled every frame; once it slows, the exact
// colour catches up. Blue leaves the CSS fallbacks.
const CSS_PROPS = { glow: '--garden-sky-glow', ink: '--garden-ink-on-sky', zenith: '--garden-sky-top' } as const;
function usePageColors(enabled: boolean) {
  const canvas = useThree(state => state.gl.domElement);
  const page = useMemo(() => canvas.closest<HTMLElement>('.garden-prototype'), [canvas]);
  const written = useMemo(() => new Map<string, { color: Rgb; hex: string; at: number }>(), []);
  useEffect(() => () => {
    for (const prop of Object.values(CSS_PROPS)) page?.style.removeProperty(prop);
    written.clear();
  }, [page, enabled, written]);
  return (sky: Sky, now: number) => {
    if (!enabled || !page) return;
    for (const [name, prop] of Object.entries(CSS_PROPS) as [keyof typeof CSS_PROPS, string][]) {
      const color = sky[name], value = hex(color), last = written.get(prop);
      if (last && (last.hex === value || Math.max(...color.map((v, i) => Math.abs(v - last.color[i]))) < 3 / 255 && now - last.at < .25)) continue;
      written.set(prop, { color, hex: value, at: now });
      page.style.setProperty(prop, value);
    }
  };
}

export default function GardenSky({ mobile, width, skyStyle, waterTint }: SlotProps & { skyStyle: SkyStyle; waterTint: WaterTint }) {
  const clear = skyStyle === 'blue';
  const clock = useJourney();
  const sun = useRef<THREE.DirectionalLight>(null);
  const hemisphere = useRef<THREE.HemisphereLight>(null);
  const background = useRef<THREE.Color>(null);
  const fog = useRef<THREE.Fog>(null);
  const dome = useMemo(() => ({ zenith: new THREE.Color(BLUE_SKY.zenith), horizon: new THREE.Color(BLUE_SKY.horizon) }), []);
  const sunOffset = useMemo(() => new THREE.Vector3(...DAY.sun), []);
  useSunFollowsVoyage(sun, sunOffset, width);
  const writePage = usePageColors(!clear);
  useFrame(({ clock: time }) => {
    if (clear) {
      waterTint.water.set(BLUE_SKY.water);
      waterTint.glint.set(BLUE_SKY.glint);
      return;
    }
    const sky = skyAt(clock.progress);
    set(dome.horizon, sky.horizon);
    set(dome.zenith, sky.zenith);
    if (background.current) background.current.copy(dome.horizon);
    fog.current?.color.copy(dome.horizon);
    const light = hemisphere.current;
    if (light) {
      set(light.color, sky.hemiSky);
      set(light.groundColor, sky.hemiGround);
      light.intensity = sky.hemi;
    }
    if (sun.current) {
      set(sun.current.color, sky.sunColor);
      sun.current.intensity = sky.sunIntensity;
    }
    sunOffset.set(...sky.sun);
    if (skyStyle === 'combo') {
      waterTint.water.set(COMBO_WATER.water);
      waterTint.glint.set(COMBO_WATER.glint);
    } else {
      set(waterTint.water, sky.water);
      set(waterTint.glint, sky.glint);
    }
    writePage(sky, time.elapsedTime);
  });
  return <>
    <color ref={background} attach="background" args={[clear ? BLUE_SKY.horizon : SKY]} />
    <SkyDome colors={dome} />
    {/* A clear day keeps the middle distance crisp; the far end still fades. */}
    <fog ref={fog} attach="fog" args={[clear ? BLUE_SKY.horizon : SKY, clear ? (mobile ? 22 : 38) : (mobile ? 8 : 16), mobile ? 85 : 110]} />
    {/* Under a blue sky the sun is warmer and stronger, and shade turns cool. */}
    <hemisphereLight ref={hemisphere} key={skyStyle} args={clear ? ['#d3e3fb', '#8d9a68', 1.45] : [DAY.hemiSky, DAY.hemiGround, DAY.hemi]} />
    <directionalLight ref={sun} position={DAY.sun} intensity={clear ? 2.9 : DAY.sunIntensity} color={clear ? '#ffeac7' : DAY.sunColor} castShadow
      shadow-mapSize={[SHADOW.map, SHADOW.map]} shadow-camera-left={SHADOW.left} shadow-camera-right={SHADOW.right}
      shadow-camera-top={SHADOW.top} shadow-camera-bottom={SHADOW.bottom} shadow-camera-far={110}
      shadow-bias={-.0003} shadow-normalBias={.07} />
  </>;
}
