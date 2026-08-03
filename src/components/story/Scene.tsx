import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  buildCameraCurve,
  cameraTargetAt,
} from './curves';
import { currentProgress, scrollState } from './scrollState';
import { Rope, Silk } from './Strands';
import { softDot } from './placeholder';
import { Billboard } from './Billboard';
import { billboardsFor } from './billboards';

const FOG_COLOR = '#0d1117';

/**
 * Drifting motes. Cheap, and they do most of the work of making the void read
 * as a space with air in it rather than a flat background.
 */
function Dust({ count = 900 }: { count?: number }) {
  const geometry = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Spawned in an annulus around the spine. Motes closer in would drift
      // right past the lens and, with size attenuation, balloon into blobs.
      const angle = Math.random() * Math.PI * 2;
      const radius = 20 + Math.random() * 70;
      pos[i * 3] = Math.cos(angle) * radius;
      pos[i * 3 + 1] = Math.sin(angle) * radius * 0.6;
      pos[i * 3 + 2] = -Math.random() * 460;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, [count]);

  const dot = useMemo(() => softDot(), []);

  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        size={0.5}
        color="#cbd5e1"
        transparent
        opacity={0.45}
        alphaMap={dot}
        alphaTest={0.01}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

/**
 * Drives the camera from the scroll value and maintains the smoothed velocity
 * the strands read for their billow.
 *
 * The camera rides its own smoothed curve and always looks a little further
 * down the spine than it sits. It is never placed on a strand.
 */
function CameraRig({ velocityRef }: { velocityRef: React.RefObject<number> }) {
  const camera = useThree((s) => s.camera);
  const curve = useMemo(() => buildCameraCurve(), []);
  const lastProgress = useRef(currentProgress());
  const smoothed = useRef(0);

  const pos = useMemo(() => new THREE.Vector3(), []);
  const target = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, dt) => {
    const p = THREE.MathUtils.clamp(currentProgress(), 0, 1);

    // Velocity in progress-units per second, normalised to roughly 0..1 and
    // smoothed asymmetrically: quick to rise, slow to settle.
    const raw = Math.abs(p - lastProgress.current) / Math.max(dt, 1e-4);
    lastProgress.current = p;
    const normalised = Math.min(1, raw * 14);
    const k = normalised > smoothed.current ? 0.25 : 0.035;
    smoothed.current += (normalised - smoothed.current) * k;
    velocityRef.current = smoothed.current;
    scrollState.velocity = smoothed.current;

    curve.getPointAt(p, pos);
    camera.position.lerp(pos, 1 - Math.pow(0.0015, dt)); // frame-rate independent
    cameraTargetAt(p, target);
    camera.lookAt(target);
  });

  return null;
}

export function Scene({ slug }: { slug?: string }) {
  const velocityRef = useRef(0);
  const specs = useMemo(() => billboardsFor(slug), [slug]);

  return (
    <>
      <color attach="background" args={[FOG_COLOR]} />
      {/* Fog is not optional. Without depth cueing the billboards read as
          sprites pasted on a flat background rather than objects in space. */}
      <fogExp2 attach="fog" args={[FOG_COLOR, 0.0075]} />

      <CameraRig velocityRef={velocityRef} />

      <hemisphereLight args={['#93b8d8', '#4a3c30', 1.15]} />
      <directionalLight position={[18, 26, 12]} intensity={2.3} color="#fff3e0" />
      <directionalLight position={[-22, -6, -18]} intensity={0.9} color="#7fa6d0" />

      <Rope velocityRef={velocityRef} />
      <Silk velocityRef={velocityRef} />

      {specs.map((spec, i) => (
        <Billboard key={spec.id} spec={spec} index={i} />
      ))}

      <Dust />
    </>
  );
}
