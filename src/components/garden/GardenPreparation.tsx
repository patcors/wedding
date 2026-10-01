import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { WebGLRenderTarget, type Camera, type Object3D } from 'three';
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
    const compileAsync = async (scene: Object3D, camera: Camera) => {
      await gl.compileAsync(scene, camera);
      // The water's reflection draws the garden into a texture, and shaders
      // drawn off screen skip tone mapping, so they are different programs.
      // Left alone, the first frame links them all at once.
      const offscreen = new WebGLRenderTarget(1, 1);
      gl.setRenderTarget(offscreen);
      const reflections = gl.compileAsync(scene, camera);
      gl.setRenderTarget(null);
      await reflections;
      offscreen.dispose();
    };
    const renderer = { compileAsync, render: () => advance(frames++ / 60) };
    void prepareGardenScene(renderer, scene, camera, () => cancelled)
      .then(prepared => { if (prepared) onReady(); })
      .catch(() => { if (!cancelled) onError(); });
    return () => { cancelled = true; };
  }, [start, gl, scene, camera, advance, onReady, onError]);
  return null;
}
