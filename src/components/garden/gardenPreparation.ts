import type { Camera, Scene, WebGLRenderer } from 'three';

const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

// Suspense covers downloads, but not GPU compilation, texture uploads, shadow
// maps or water reflections. Render those while the opaque loader is still up.
export async function prepareGardenScene(
  renderer: Pick<WebGLRenderer, 'compileAsync' | 'render'>, scene: Scene, camera: Camera,
  cancelled: () => boolean, frame: () => Promise<void> = nextFrame,
) {
  await frame();
  if (cancelled()) return false;
  await renderer.compileAsync(scene, camera);
  for (let i = 0; i < 2; i++) {
    await frame();
    if (cancelled()) return false;
    renderer.render(scene, camera);
  }
  await frame();
  return !cancelled();
}
