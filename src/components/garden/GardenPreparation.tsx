import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { prepareGardenScene } from './gardenPreparation';

export default function GardenPreparation({ onReady, onError }: { onReady: () => void; onError: () => void }) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    let cancelled = false;
    void prepareGardenScene(gl, scene, camera, () => cancelled)
      .then(prepared => { if (prepared) onReady(); })
      .catch(() => { if (!cancelled) onError(); });
    return () => { cancelled = true; };
  }, [gl, scene, camera, onReady, onError]);
  return null;
}
