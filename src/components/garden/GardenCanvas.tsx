import { Suspense, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import GardenScene, { type SceneProps } from './GardenScene';
import { GARDEN_CAMERA } from './gardenGeometry';
import { failGardenLoading } from './gardenLoading';

export default function GardenCanvas(props: Omit<SceneProps, 'mobileDevice' | 'economy' | 'onSlow'>) {
  const [mobileDevice] = useState(() => matchMedia('(pointer: coarse), (max-width: 700px)').matches);
  const [economy, setEconomy] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const update = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  useEffect(() => {
    const lost = (event: Event) => { event.preventDefault(); failGardenLoading(); };
    canvas?.addEventListener('webglcontextlost', lost);
    return () => canvas?.removeEventListener('webglcontextlost', lost);
  }, [canvas]);
  return <Canvas shadows style={{ touchAction: 'pan-y pinch-zoom' }}
    frameloop={props.paused || props.reduced || hidden ? 'demand' : 'always'}
    dpr={economy ? .85 : mobileDevice ? 1 : 1.25}
    camera={{ position: [0, GARDEN_CAMERA.height, GARDEN_CAMERA.startZ], fov: GARDEN_CAMERA.fov, near: .2, far: 220 }}
    gl={{ antialias: true, powerPreference: 'default', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
    onCreated={({ gl }) => { gl.shadowMap.autoUpdate = false; setCanvas(gl.domElement); }}>
    <Suspense fallback={null}>
      <GardenScene {...props} paused={props.paused || hidden} mobileDevice={mobileDevice}
        economy={economy} onSlow={() => setEconomy(true)} />
    </Suspense>
  </Canvas>;
}
