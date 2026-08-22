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
  debug = true,
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
          /**
           * near is 1, not the three.js default of 0.1, and that is a depth
           * precision decision rather than a clipping one.
           *
           * Depth buffer resolution is dominated by the near plane — halving
           * near halves the resolvable step at every distance in the scene. At
           * 0.1 against far=700 the buffer spends most of its range on the first
           * couple of units, which is empty: cameraPositionAt keeps the lens at
           * least 30 units back from the spine it looks at, and no billboard is
           * permitted within MIN_LATERAL_CLEARANCE (13) of the camera path. So
           * nothing is ever within 1 unit to clip, and pulling near up to 1 buys
           * a 10x precision improvement over the depths that are actually
           * occupied — which is what keeps close-but-not-coplanar surfaces
           * (see the Z layout in frameGeometry.ts) stable on 16-bit mobile buffers.
           */
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
