import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Scene } from './Scene';
import { Scrubber } from './Scrubber';
import { attachScrollListener } from './scrollState';

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
          zIndex: 0,
          opacity: ready ? 1 : 0,
          transition: 'opacity 900ms ease',
        }}
      >
        <Canvas
          camera={{ fov: 48, near: 0.1, far: 700 }}
          dpr={[1, 1.75]}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
        >
          <Scene slug={slug} />
        </Canvas>
      </div>
      {debug && <Scrubber />}
    </>
  );
}
