// Everything three.js, loaded lazily so the opening text and butterflies
// hydrate while this chunk and the scene's assets download behind the cover.
import { Suspense, useEffect, type ComponentProps } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import GardenScene from './GardenScene';
import { GARDEN_CAMERA } from './gardenGeometry';

type Frameloop = 'always' | 'demand' | 'never';

// Leaving "never" does not restart fiber's render loop by itself.
function ResumeLoop({ frameloop }: { frameloop: Frameloop }) {
  const invalidate = useThree(state => state.invalidate);
  useEffect(() => { invalidate(); }, [frameloop, invalidate]);
  return null;
}

export default function GardenCanvas({ frameloop, ...scene }: ComponentProps<typeof GardenScene> & { frameloop: Frameloop }) {
  return <Canvas shadows style={{ touchAction: 'pan-y pinch-zoom' }} frameloop={frameloop} dpr={[1, 1.25]} camera={{ position: [0, GARDEN_CAMERA.height, GARDEN_CAMERA.startZ], fov: GARDEN_CAMERA.fov, near: .2, far: 220 }}
    gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}>
    <ResumeLoop frameloop={frameloop} />
    <Suspense fallback={null}>
      <GardenScene {...scene} />
    </Suspense>
  </Canvas>;
}
