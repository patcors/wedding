import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { currentProgress, scrollState } from './scrollState';
import { cameraReadout, freeCamera, useDebugValue } from './debugStore';
import { Rope, Silk } from './Strands';
import { buildStoryStrandCurve } from './storyStrandCurve';
import { softDot } from './placeholder';
import { Billboard } from './Billboard';
import { billboardsFor, type BillboardSpec } from './billboards';
import { buildCameraJourney } from './cameraJourney';

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
        size={0.18}
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
 * Image-based lighting, built from geometry instead of an HDRI file.
 *
 * A broad ambient is the one lighting setup that makes any normal map look
 * painted on: bump only reads when light arrives from somewhere specific. The
 * hemisphere light this replaces was lighting every fibre from every direction
 * at once, which is why the rope looked like a printed tube.
 *
 * <Environment> renders its children to an off-screen cubemap, so the light
 * sources here are real geometry and no .hdr asset is needed — which suits a
 * project deliberately built without art dependencies, and costs nothing at
 * runtime because `frames={1}` bakes it exactly once.
 *
 * Resolution is tiny on purpose. This is only ever integrated over a surface,
 * never seen directly (`background` is left off, so the fog colour still owns
 * the void), and 128px is more than enough to light a scene.
 */
function StudioEnvironment() {
  return (
    <Environment frames={1} resolution={128}>
      {/* Deep blue-grey fill, matching the fog so nothing looks lit by a
          different room than the one it's in. */}
      <mesh scale={100}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshBasicMaterial color="#141d29" side={THREE.BackSide} />
      </mesh>

      {/* Key: warm, and deliberately LOW rather than overhead.
          A normal map's contrast is proportional to how grazing the light is —
          shading is N·L, so when L already points along N, tilting the normal a
          few degrees barely changes anything and the bump disappears. An
          overhead key on a roughly horizontal rope hits the top square-on and
          flattens exactly the surface the reader looks at most. Keep this at
          roughly camera height so it rakes along the tube instead. */}
      <Lightformer
        form="rect"
        intensity={3.4}
        color="#fff1dc"
        position={[20, 6, 11]}
        scale={[14, 20, 1]}
        target={[0, 0, 0]}
      />

      {/* Cool rim from behind and left. This is what separates the strands from
          the void along their edges, and gives the silk's sheen something to
          catch at grazing angles. */}
      <Lightformer
        form="rect"
        intensity={2.4}
        color="#8fb4dd"
        position={[-18, -4, -14]}
        scale={[30, 20, 1]}
        target={[0, 0, 0]}
      />

      {/* Overhead, kept deliberately dim. Enough to lift the top edge off the
          void, not enough to flatten it — this used to be at 1.4 and was the
          second half of the flat-top problem. */}
      <Lightformer
        form="rect"
        intensity={0.45}
        color="#cfe0f2"
        position={[0, 22, -4]}
        scale={[10, 40, 1]}
        target={[0, 0, 0]}
      />

      {/* Low fill from below-left, opposite the key. Without it the underside
          of the tube is the only part with rake and the contrast between top
          and bottom reads as two different materials. */}
      <Lightformer
        form="rect"
        intensity={1.1}
        color="#b8c6d8"
        position={[-14, -10, 6]}
        scale={[18, 14, 1]}
        target={[0, 0, 0]}
      />
    </Environment>
  );
}

/**
 * Drives the camera from the scroll value and maintains the smoothed velocity
 * the strands read for their billow.
 *
 * Smooth progress before sampling both position and aim, so the lens never
 * lags behind a target that has already jumped to the next photograph.
 */
function CameraRig({
  velocityRef,
  free,
  specs,
}: {
  velocityRef: React.RefObject<number>;
  free: boolean;
  specs: BillboardSpec[];
}) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const journey = useMemo(() => buildCameraJourney(specs, size.width / size.height, 48), [specs, size.width, size.height]);
  const progress = useRef(currentProgress());
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
    const k = 1 - Math.exp(-dt * (normalised > smoothed.current ? 17 : 2.2));
    smoothed.current += (normalised - smoothed.current) * k;
    velocityRef.current = smoothed.current;
    scrollState.velocity = smoothed.current;

    // Velocity above is deliberately still tracked while the debug camera has
    // the lens: the strands read it for their billow, and freezing it would
    // change the very thing you detached the camera to look at.
    if (free) return;

    progress.current = THREE.MathUtils.damp(progress.current, p, 9, dt);
    journey(progress.current, pos, target);
    camera.position.copy(pos);
    camera.lookAt(target);
  });

  return null;
}

/**
 * Mouse control of the camera. Debug only — see freeCamera in debugStore.
 *
 * Mounted solely while the toggle is on, so its listeners and its `makeDefault`
 * registration vanish completely when it is off; there is no dormant controls
 * object left attached to the canvas in the shipped path.
 *
 * It opens aimed at whatever the rig was last looking at, which makes turning
 * it on feel like taking hold of the current shot rather than being teleported
 * somewhere else. Note that three's OrbitControls calls preventDefault on the
 * wheel, so pointing at the canvas and scrolling dollies instead of advancing
 * the story — which is what you want while framing, and is also why the panel
 * labels this as taking the camera.
 */
function FreeCamera() {
  const camera = useThree((s) => s.camera);
  const controls = useRef<React.ComponentRef<typeof OrbitControls>>(null);

  // Read once, on mount: the initial aim point, not a live tie to the scroll.
  const initialTarget = useMemo(
    () => camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(15).add(camera.position),
    [],
  );

  useFrame(() => {
    const target = controls.current?.target;
    if (!target) return;
    cameraReadout.x = camera.position.x;
    cameraReadout.y = camera.position.y;
    cameraReadout.z = camera.position.z;
    cameraReadout.tx = target.x;
    cameraReadout.ty = target.y;
    cameraReadout.tz = target.z;
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      target={initialTarget}
      enableDamping
      dampingFactor={0.12}
      // The scene is hundreds of units long, so the default 1-unit dolly step
      // and 1x pan speed are unusably slow at story scale.
      zoomSpeed={1.6}
      panSpeed={1.4}
    />
  );
}

export function Scene({ slug }: { slug?: string }) {
  const velocityRef = useRef(0);
  const specs = useMemo(() => billboardsFor(slug), [slug]);
  const free = useDebugValue(freeCamera);
  const ropeCurve = useMemo(() => buildStoryStrandCurve('rope', specs), [specs]);
  const silkCurve = useMemo(() => buildStoryStrandCurve('silk', specs), [specs]);

  return (
    <>
      <color attach="background" args={[FOG_COLOR]} />
      {/* Fog is not optional. Without depth cueing the billboards read as
          sprites pasted on a flat background rather than objects in space. */}
      <fogExp2 attach="fog" args={[FOG_COLOR, 0.014]} />

      <CameraRig velocityRef={velocityRef} free={free} specs={specs} />
      {free && <FreeCamera />}

      {/* The hemisphere light that used to sit here is gone: it was flooding
          every fibre from every direction and flattening the normal maps.
          Ambient now comes from StudioEnvironment, which has direction. */}
      <StudioEnvironment />

      {/* One key light retained on top of the IBL. An environment integrates to
          soft light everywhere; the crisp highlight that reads as *fibre* still
          wants a point source, and it's aimed to agree with the softbox.
          Low, for the raking reason described in StudioEnvironment — at the old
          [18, 26, 12] this was the main cause of the flat, washed-out tops. */}
      <directionalLight position={[24, 7, 14]} intensity={1.8} color="#fff3e0" />

      <Rope velocityRef={velocityRef} curve={ropeCurve} />
      <Silk velocityRef={velocityRef} curve={silkCurve} />

      {specs.map((spec, i) => (
        <Billboard key={spec.id} spec={spec} index={i} />
      ))}

      <Dust />
    </>
  );
}
