import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { prepareGardenScene } from './gardenPreparation';

// Compiling and uploading freeze every frame on the page, butterflies included,
// so this waits until the opening flock is perched on the names.
export default function GardenPreparation({ start, onReady, onError }: { start: boolean; onReady: () => void; onError: () => void }) {
  const { gl, scene, camera, advance } = useThree();
  useEffect(() => {
    if (!start) return;
    let cancelled = false, frames = 0;
    // The canvas idles on frameloop "never" until ready; advancing runs the
    // scene's frame callbacks first, so the camera is in place for the uploads.
    const renderer = { compileAsync: gl.compileAsync.bind(gl), render: () => advance(frames++ / 60) };
    void prepareGardenScene(renderer, scene, camera, () => cancelled)
      .then(prepared => { if (prepared) onReady(); })
      .catch(() => { if (!cancelled) onError(); });
    return () => { cancelled = true; };
  }, [start, gl, scene, camera, advance, onReady, onError]);
  return null;
}
