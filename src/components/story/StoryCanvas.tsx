import { Suspense, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Scene } from './Scene';
import { Scrubber } from './Scrubber';
import { attachScrollListener } from './scrollState';
import { freeCamera, useDebugValue } from './debugStore';

/**
 * Island root. One persistent canvas for the entire experience — the scenes are
 * positions along a curve, not separate mounts, so nothing here should ever
 * unmount and remount as the reader scrolls.
 */
export default function StoryCanvas({
  slug,
  debug = false,
}: {
  slug?: string;
  debug?: boolean;
}) {
  const [ready, setReady] = useState(false);
  const free = useDebugValue(freeCamera);

  useEffect(() => {
    const detach = attachScrollListener();
    setReady(true);
    return detach;
  }, []);

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          // Normally beneath the text layer (z-index 1). The free camera needs
          // the drag to actually reach the canvas, and .intro is a full-height
          // block sitting on top of it with pointer events on — so while the
          // debug camera is live the canvas comes to the front. Everything
          // below .intro is already pointer-events: none, so this only matters
          // at the top of the page, which is exactly where it would otherwise
          // silently fail to orbit.
          zIndex: free ? 2 : 0,
          opacity: ready ? 1 : 0,
          transition: 'opacity 900ms ease',
        }}
      >
        <Canvas
          // A 1-unit near plane preserves depth precision during close-ups.
          camera={{ fov: 48, near: 1, far: 700 }}
          dpr={[1, 1.75]}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
        >
          {/* useTexture suspends while the rope maps load. Without a boundary
              inside the Canvas, the island throws on first render. The wrapper
              div's 900ms fade already covers the gap, so fallback={null}. */}
          <Suspense fallback={null}>
            <Scene slug={slug} />
          </Suspense>
        </Canvas>
      </div>
      {debug && <Scrubber />}
    </>
  );
}
