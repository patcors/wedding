// Places along the way (places.ts): far-off ridgelines low on the horizon
// beyond the avenue's trees, that fade in and out with the story. Each
// place is one mesh with flat-coloured facets, lit by the scene's sun and sky
// and softened into the fog's colour by a haze of its own (each vertex's
// `haze`, more as the day's haze gathers and as it fades), so it sits in the
// same light as everything else at any hour. It rides on a ring round the
// camera that never turns, so it stays far off however far the boats go.
// It skips the fog's distance (at the ring's radius the fog would hide it
// entirely), the shadows and the river's reflection: it is drawn on a layer
// of its own that only the scene's camera sees, not the water's mirror.
// One draw call while a place shows, two only where one place could meet
// the next (they don't overlap now), none in between.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useJourney } from './JourneyProvider';
import { skyAt } from './skyCycle';
import { PLACE_IDS, placeHaze, placeShown } from './places';
import { placeGeometry } from './placesGeometry';

// The layer the places draw on: the camera sees it, the water's mirror
// camera (layer 0 only) doesn't.
export const PLACES_LAYER = 1;

// The fog's colour mixed in by each vertex's haze and the place's `lift`,
// in place of three's fog by distance. A plain function, the same for every
// place, so all three share one shader program.
function hazed(this: THREE.Material, shader: THREE.WebGLProgramParametersWithUniforms) {
  shader.uniforms.placeLift = this.userData.lift;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nattribute float haze;\nvarying float vPlaceHaze;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPlaceHaze = haze;');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform float placeLift;\nvarying float vPlaceHaze;')
    .replace('#include <fog_fragment>', '#ifdef USE_FOG\ngl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, 1.0 - (1.0 - vPlaceHaze) * (1.0 - placeLift));\n#endif');
}
function placeMaterial() {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, transparent: true, fog: true });
  material.userData.lift = { value: 1 };
  material.onBeforeCompile = hazed;
  return material;
}

export default function GardenPlaces({ on, mobile }: { on: boolean; mobile: boolean }) {
  const clock = useJourney();
  const camera = useThree(state => state.camera);
  const group = useRef<THREE.Group>(null);
  const meshes = useMemo(() => PLACE_IDS.map(id => {
    const mesh = new THREE.Mesh(placeGeometry(id, mobile), placeMaterial());
    mesh.name = `place-${id}`;
    mesh.layers.set(PLACES_LAYER);
    mesh.visible = false;
    return { id, mesh, material: mesh.material as THREE.MeshStandardMaterial };
  }), [mobile]);
  useEffect(() => () => meshes.forEach(({ mesh, material }) => { mesh.geometry.dispose(); material.dispose(); }), [meshes]);
  useLayoutEffect(() => {
    camera.layers.enable(PLACES_LAYER);
    return () => camera.layers.disable(PLACES_LAYER);
  }, [camera]);

  useFrame(({ camera }) => {
    group.current?.position.copy(camera.position);
    const haze = skyAt(clock.progress).haze;
    for (const { id, mesh, material } of meshes) {
      const shown = on ? placeShown(id, clock.progress) : 0;
      mesh.visible = shown > .002;
      if (!mesh.visible) continue;
      material.opacity = shown;
      material.userData.lift.value = placeHaze(haze, shown);
    }
  });

  return <group ref={group} name="places">
    {meshes.map(({ id, mesh }) => <primitive key={id} object={mesh} />)}
  </group>;
}
