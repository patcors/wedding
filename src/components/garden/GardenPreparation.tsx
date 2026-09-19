import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { GARDEN_CAMERA } from './gardenGeometry';
import { failGardenLoading, gardenStage } from './gardenLoading';

const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

export function GardenPreparation({ onPrepared }: { onPrepared: () => void }) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      gardenStage('Bringing the garden to life');
      // Wait for texture/material effects and instance matrices to settle.
      await nextFrame();
      if (cancelled) return;
      await gl.compileAsync(scene, camera);
      performance.mark('garden-shaders-ready');
      if (cancelled) return;
      const position = camera.position.clone(), rotation = camera.quaternion.clone();
      try {
        // Render actual reflection, shadow and geometry passes along the route.
        // All boat prototypes and their wakes are visible during these renders.
        for (const progress of [0, .5, 1]) {
          await nextFrame();
          if (cancelled) return;
          const travel = progress * GARDEN_CAMERA.travel;
          camera.position.set(Math.sin(progress * Math.PI) * .75, GARDEN_CAMERA.height, GARDEN_CAMERA.startZ - travel);
          camera.lookAt(Math.sin(progress * Math.PI) * .3, GARDEN_CAMERA.targetY, GARDEN_CAMERA.targetZ - travel);
          gl.shadowMap.needsUpdate = true;
          gl.render(scene, camera);
        }
      } finally {
        camera.position.copy(position); camera.quaternion.copy(rotation);
      }
      if (!cancelled) { performance.mark('garden-gpu-prepared'); onPrepared(); }
    })().catch(() => { if (!cancelled) failGardenLoading(); });
    return () => { cancelled = true; };
  }, [gl, scene, camera, onPrepared]);
  return null;
}

export function GardenRenderer({ warming, mobileDevice, economy, active, onReady, onSlow }: {
  warming: boolean; mobileDevice: boolean; economy: boolean; active: boolean; onReady: () => void; onSlow: () => void;
}) {
  const frames = useRef(0), shadowTime = useRef(-Infinity);
  const sample = useRef({ frames: 0, seconds: 0, slowWindows: 0 });
  const invalidate = useThree(s => s.invalidate);
  useEffect(() => {
    // Demand mode also needs the clean frames after warm-up boats are hidden.
    if (warming) return;
    const id = requestAnimationFrame(() => invalidate());
    return () => cancelAnimationFrame(id);
  }, [warming, invalidate]);
  useFrame(({ gl, scene, camera, clock }, dt) => {
    if (warming) return;
    const now = clock.elapsedTime;
    if (frames.current < 2 || now - shadowTime.current >= (mobileDevice || economy ? .1 : 1 / 30)) {
      gl.shadowMap.needsUpdate = true;
      shadowTime.current = now;
    }
    gl.render(scene, camera);
    if (frames.current < 2) {
      frames.current++;
      if (frames.current === 2) onReady();
      else requestAnimationFrame(() => invalidate());
      return;
    }
    // Two sustained slow windows trigger one downgrade, avoiding quality oscillation.
    // Ignore resume/demand-mode gaps and startup shader work.
    if (economy || document.hidden || !active) {
      sample.current = { frames: 0, seconds: 0, slowWindows: 0 };
      return;
    }
    const window = sample.current;
    window.frames++; window.seconds += Math.min(dt, .25);
    if (window.seconds >= 2) {
      window.slowWindows = window.seconds / window.frames > 1 / 35 ? window.slowWindows + 1 : 0;
      window.frames = 0; window.seconds = 0;
      if (window.slowWindows >= 2) onSlow();
    }
  }, 1);
  return null;
}
