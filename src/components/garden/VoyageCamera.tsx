import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GARDEN_CAMERA } from './gardenGeometry';
import { FINALE, finaleLift, finalePose } from './cameraRig';
import { DOCKED, VOYAGE_END } from './journey';
import { useJourney } from './JourneyProvider';

// Places the camera along the voyage (see cameraRig.ts) from the eased
// progress, and flies the finale once the boats are moored: `t` seconds into
// it (−1 before), `played` until the guest goes back into the voyage, and
// `fall` while it comes down early because they scrolled back off the mooring.
export default function VoyageCamera({ mobile, width, visibleHeight, reduced }: { mobile: boolean; width: number; visibleHeight: number; reduced: boolean }) {
  const { camera, size } = useThree();
  const clock = useJourney();
  const target = useMemo(() => new THREE.Vector3(), []);
  const flight = useRef({ t: -1, played: false, fall: null as null | { from: number; t: number } });
  useLayoutEffect(() => {
    const lens = camera as THREE.PerspectiveCamera;
    // The camera is manual: the lens frames the visible area and the view
    // offset extends the picture down over the rest of the canvas.
    lens.fov = mobile ? GARDEN_CAMERA.mobileFov : GARDEN_CAMERA.fov;
    lens.far = mobile ? GARDEN_CAMERA.mobileFar : GARDEN_CAMERA.far;
    lens.aspect = size.width / visibleHeight;
    lens.setViewOffset(size.width, visibleHeight, 0, 0, size.width, size.height);
    lens.updateProjectionMatrix();
  }, [camera, mobile, size.width, size.height, visibleHeight]);
  useFrame((_, delta) => {
    const p = clock.progress, f = flight.current, dt = Math.min(delta, .05);
    // Back in the voyage (a jump to the start, say) the flight is simply over.
    if (p < VOYAGE_END) Object.assign(f, { played: false, t: -1, fall: null });
    if (reduced) f.t = -1;
    else if (f.t < 0 && !f.played && p >= DOCKED) Object.assign(f, { t: 0, played: true, fall: null });
    let lift = 0;
    if (f.t >= 0) {
      f.t += dt;
      if (p < DOCKED && !f.fall) f.fall = { from: finaleLift(f.t), t: 0 };
      if (f.fall) {
        f.fall.t += dt;
        const k = Math.min(1, f.fall.t / FINALE.abort);
        lift = f.fall.from * (1 - k * k * (3 - 2 * k));
        if (k >= 1) f.t = -1;
      } else {
        lift = finaleLift(f.t);
        if (f.t > FINALE.delay && lift === 0) f.t = -1;
      }
    }
    clock.lift = lift;
    const { position, target: look } = finalePose(p, width, lift);
    camera.position.set(...position);
    camera.lookAt(target.set(...look));
  });
  return null;
}
