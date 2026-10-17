// A flurry of snow sweeps over a stretch of bank as a milestone's date shows,
// and when it clears it has left something behind on a patch of settled
// snow: whatever is passed as children, standing at the spot and facing the
// boats. Timed by flurry.ts. The children aren't drawn until the flurry
// is at its thickest, and fade in under it, so the guest never sees them
// coming; they stay until the camera has passed. An egg is then a line:
//
//   <SnowReveal {...props} spot={{ z: -48, side: 1 }}><Snowman sling /></SnowReveal>
//
// `scale` sizes it all, the flurry, the patch and the children; portrait's is
// a little smaller. Costs two draw calls (the flakes and the settled
// snow) plus the children's, and nothing outside its window.
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { cameraPose } from '../cameraRig';
import { groundHeight, random } from '../gardenGeometry';
import { useJourney } from '../JourneyProvider';
import { FLURRY, flurryAt, gustAt, revealed, snowSpot, type SnowSpot } from './flurry';
import { eggTime, type EggProps } from './egg';

// The flurry's box around the spot, half extents: across the river, up, and
// along it. Flakes, and soft puffs that thicken it into a white-out over the spot.
const BOX = { across: 3.4, up: 3.4, along: 3.4 };
const FLAKES = { desktop: 900, mobile: 600 }, PUFFS = 40;
// The patch of settled snow, and how far it reaches at desktop's scale.
const PATCH = { radius: 1.5, rings: 5, segments: 36 };

const vertexShader = /* glsl */ `
  uniform float uTime, uFlurry, uGust, uScale, uSize, uWind;
  uniform vec3 uBox;
  attribute vec3 aSeed;
  attribute float aSize, aPuff;
  varying float vAlpha, vPuff;
  #include <fog_pars_vertex>
  void main() {
    vec3 s = aSeed;
    // Flakes fall and blow across the bank towards the river (uWind is the
    // direction across, ±1), and eddy; puffs drift slowly about the spot.
    float speed = mix(1.0, .12, aPuff);
    float fall = fract(s.y - uTime * (.22 + .18 * s.x) * speed);
    float blow = fract(s.x - uTime * (.3 + .25 * s.z) * speed) - .5;
    vec3 p = vec3(blow * 2.0 * uBox.x * uWind, fall * uBox.y, (s.z - .5) * 2.0 * uBox.z);
    p.x += sin(uTime * 1.3 + s.z * 23.0) * .3 * speed;
    p.z += uGust * uBox.z * .5 + cos(uTime * 1.1 + s.x * 17.0) * .3 * speed;
    if (aPuff > .5) p.y = mix(.2, 1.9, s.y) + sin(uTime * .4 + s.x * 9.0) * .1;
    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = aSize * uSize * uScale / -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
    // Thickest round the gust, thinning to the box's edges and the ground;
    // each flake comes in at its own density, so the flurry builds.
    float edge = smoothstep(1.0, .55, abs(p.x / uBox.x)) * smoothstep(1.0, .5, abs(p.z / uBox.z))
      * smoothstep(.0, .12, p.y / uBox.y) * mix(smoothstep(1.0, .8, fall), 1.0, aPuff);
    vAlpha = edge * smoothstep(s.y * .7, s.y * .7 + .3, uFlurry);
    vPuff = aPuff;
    #include <fog_vertex>
  }
`;
const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha, vPuff;
  #include <fog_pars_fragment>
  void main() {
    float d = length(gl_PointCoord - .5) * 2.0;
    float a = vPuff > .5 ? exp(-d * d * 4.0) * .4 : smoothstep(1.0, .35, d);
    if (a * vAlpha < .01) discard;
    gl_FragColor = vec4(uColor, a * vAlpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

function flurryGeometry(flakes: number) {
  const rand = random(2019), n = flakes + PUFFS;
  const seeds = new Float32Array(n * 3), sizes = new Float32Array(n), puffs = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const puff = i >= flakes;
    // Most puffs crowd the spot itself, so it is hidden while the children appear.
    const spread = i - flakes < PUFFS * .6 ? .3 : .6;
    seeds.set(puff ? [.5 + (rand() - .5) * spread, rand(), .5 + (rand() - .5) * spread] : [rand(), rand(), rand()], i * 3);
    sizes[i] = puff ? 1.1 + rand() * 1.1 : .09 + rand() * .1;
    puffs[i] = puff ? 1 : 0;
  }
  const geometry = new THREE.BufferGeometry();
  // Positions are worked out in the shader; this only sets the count.
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aPuff', new THREE.BufferAttribute(puffs, 1));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, BOX.up / 2, 0), Math.hypot(BOX.across, BOX.up, BOX.along) * 1.5);
  return geometry;
}

// Settled snow on the bank, following the ground, thick in the middle and
// thinning out to a ragged edge.
function patchGeometry(spot: { x: number; z: number; y: number }, width: number, scale: number) {
  const { radius, rings, segments } = PATCH;
  const positions: number[] = [], colours: number[] = [], index: number[] = [];
  const at = (ring: number, k: number) => ring === 0 ? 0 : 1 + (ring - 1) * segments + k % segments;
  for (let ring = 0; ring <= rings; ring++) {
    for (let k = 0; k < (ring === 0 ? 1 : segments); k++) {
      const angle = k / segments * Math.PI * 2;
      const ragged = 1 + .2 * Math.sin(angle * 3 + 1) + .1 * Math.sin(angle * 7 + 2) + .06 * Math.sin(angle * 13);
      const r = ring / rings * radius * scale * ragged;
      const x = Math.cos(angle) * r, z = Math.sin(angle) * r;
      positions.push(x, groundHeight(spot.x + x, spot.z + z, width) - spot.y + .025, z);
      const fade = 1 - THREE.MathUtils.smoothstep(ring / rings, .35, 1);
      colours.push(.96, .97, 1, fade * .92);
    }
  }
  for (let ring = 1; ring <= rings; ring++) {
    for (let k = 0; k < segments; k++) {
      if (ring === 1) index.push(0, at(1, k + 1), at(1, k));
      else index.push(at(ring - 1, k), at(ring - 1, k + 1), at(ring, k + 1), at(ring - 1, k), at(ring, k + 1), at(ring, k));
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 4));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

export default function SnowReveal({ milestone, paused, reduced, mobile, width, spot: where, scale: size = 1, children }: EggProps & { spot: SnowSpot; scale?: number; children: ReactNode }) {
  const clock = useJourney();
  const group = useRef<THREE.Group>(null), left = useRef<THREE.Group>(null), points = useRef<THREE.Points>(null);
  const spot = useMemo(() => snowSpot(where, milestone.month, width), [where, milestone.month, width]);
  const scale = size * (mobile ? .9 : 1);
  const parts = useMemo(() => {
    const flakes = new THREE.ShaderMaterial({
      uniforms: { ...THREE.UniformsLib.fog, uTime: { value: 0 }, uFlurry: { value: 0 }, uGust: { value: 0 }, uScale: { value: 1 }, uSize: { value: scale }, uWind: { value: -where.side },
        uBox: { value: new THREE.Vector3(BOX.across, BOX.up, BOX.along).multiplyScalar(scale) }, uColor: { value: new THREE.Color() } },
      vertexShader, fragmentShader, transparent: true, depthWrite: false, fog: true,
    });
    const settled = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, depthWrite: false, roughness: .9,
      polygonOffset: true, polygonOffsetFactor: -2 });
    return { flurry: flurryGeometry(mobile ? FLAKES.mobile : FLAKES.desktop), patch: patchGeometry(spot, width, scale), flakes, settled };
  }, [spot, width, scale, mobile]);
  useEffect(() => () => Object.values(parts).forEach(part => part.dispose()), [parts]);
  const white = useMemo(() => new THREE.Color('#f4f7fb'), []);
  const shown = useRef(-1);

  useFrame(({ scene, gl, camera }, dt) => {
    if (!group.current || !left.current || !points.current) return;
    const t = eggTime(milestone, clock.progress, reduced, 1);
    // From the date until the camera has gone by.
    group.current.visible = t > 0 && cameraPose(clock.progress, width).position[2] > spot.z - 2;
    if (!group.current.visible) return;
    const thick = flurryAt(t), u = parts.flakes.uniforms;
    points.current.visible = thick > 0 && t < FLURRY.gone;
    if (!paused) u.uTime.value += Math.min(dt, .1);
    u.uFlurry.value = thick;
    u.uGust.value = gustAt(t);
    // Point sizes are in world units: pixels per unit at unit distance.
    u.uScale.value = camera.projectionMatrix.elements[5] * gl.domElement.height / 2;
    // Snow takes on a little of the sky's colour, as it does in the air.
    const fog = scene.fog instanceof THREE.Fog ? scene.fog : null;
    u.uColor.value.copy(white);
    if (fog) u.uColor.value.lerp(fog.color, .2);
    // Fade the children in under the thickest of the flurry, then draw them
    // solid again so they sort with the scene.
    const appear = revealed(t) ? THREE.MathUtils.smoothstep(t, FLURRY.reveal, FLURRY.clear) : 0;
    left.current.visible = appear > 0;
    if (appear !== shown.current) {
      shown.current = appear;
      left.current.traverse(child => {
        if (!(child instanceof THREE.Mesh)) return;
        for (const material of [child.material].flat() as THREE.Material[]) {
          if (material.transparent !== appear < 1) { material.transparent = appear < 1; material.needsUpdate = true; }
          material.opacity = appear;
        }
      });
    }
    parts.settled.opacity = THREE.MathUtils.smoothstep(t, FLURRY.full, FLURRY.clear);
  });

  return <group ref={group} name="snow-reveal" visible={false} position={[spot.x, spot.y, spot.z]}>
    <points ref={points} geometry={parts.flurry} material={parts.flakes} />
    <mesh geometry={parts.patch} material={parts.settled} receiveShadow />
    <group ref={left} rotation={[0, spot.yaw, 0]} scale={scale} visible={false}>{children}</group>
  </group>;
}
