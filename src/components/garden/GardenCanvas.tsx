// Everything three.js, loaded lazily so the opening text and butterflies
// hydrate while this chunk and the scene's assets download behind the cover.
import { Suspense, useEffect, type ComponentProps } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import GardenScene, { preloadGardenAssets } from './GardenScene';
import { GARDEN_CAMERA } from './gardenGeometry';
import { reportItems } from './loadingBar';

// The loading bar counts the scene's downloads: every loader here uses three's
// default manager (loadingBar.ts).
THREE.DefaultLoadingManager.onStart = (_url, loaded, total) => reportItems(loaded, total);
THREE.DefaultLoadingManager.onProgress = (_url, loaded, total) => reportItems(loaded, total);

type Frameloop = 'always' | 'demand' | 'never';

// Leaving "never" does not restart fiber's render loop by itself.
function ResumeLoop({ frameloop }: { frameloop: Frameloop }) {
  const invalidate = useThree(state => state.invalidate);
  useEffect(() => { invalidate(); }, [frameloop, invalidate]);
  return null;
}

// Shadows are "percentage" (PCF) because three swaps soft PCF for it on the first
// frame. Precompiled shaders built for soft PCF would all be rebuilt right then.
export default function GardenCanvas({ frameloop, ...scene }: ComponentProps<typeof GardenScene> & { frameloop: Frameloop }) {
  // Before the WebGL context and scene are set up, which take a moment on phones.
  preloadGardenAssets(scene);
  return <Canvas shadows="percentage" style={{ touchAction: 'pan-y pinch-zoom' }} frameloop={frameloop} dpr={[1, 1.25]} camera={{ position: [0, GARDEN_CAMERA.height, GARDEN_CAMERA.startZ], fov: GARDEN_CAMERA.fov, near: .2, far: 220, manual: true }}
    gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}>
    <ResumeLoop frameloop={frameloop} />
    <Suspense fallback={null}>
      <GardenScene {...scene} />
    </Suspense>
  </Canvas>;
}
