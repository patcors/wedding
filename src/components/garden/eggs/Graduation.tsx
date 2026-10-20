// August 2020, they graduate: as the date holds, and their UOW flags come
// down, each tosses a black mortarboard straight up off their boat, tassel in
// their boat's colour (course in capToss.ts). Each toss plays out in real
// time once the scroll reaches it, so a cap never hangs in the air when the
// guest stops; it lands on its own bank and lies there until the camera has
// passed.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { cameraPose } from '../cameraRig';
import { useJourney } from '../JourneyProvider';
import { CAPS, capInAir, capLanding, capLaunch, capScale } from './capToss';
import { mortarboardGeometry } from './mortarboardGeometry';
import { eggTime, type EggProps } from './egg';

// Each tassel in its boat's colour: Amelia's teal, Patrick's soft yellow.
const TASSELS = { [-1]: '#5f9a92', [1]: '#e3c46a' } as const;

export default function Graduation({ milestone, paused, reduced, mobile, width }: EggProps) {
  const clock = useJourney();
  const caps = useRef<THREE.InstancedMesh>(null);
  const count = CAPS.tosses.length;
  const parts = useMemo(() => ({
    cap: mortarboardGeometry(),
    cloth: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .7 }),
  }), []);
  useEffect(() => () => Object.values(parts).forEach(part => part.dispose()), [parts]);
  const course = useMemo(() => CAPS.tosses.map(toss =>
    ({ from: capLaunch(milestone.month, toss, width), to: capLanding(milestone.month, toss, width) })), [milestone.month, width]);
  // Seconds each cap has been in the air since it was tossed, or null while
  // it is still in hand.
  const tossed = useRef<(number | null)[]>(Array(count).fill(null));
  const scale = capScale(mobile);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useLayoutEffect(() => {
    const colour = new THREE.Color();
    CAPS.tosses.forEach(({ side }, i) => caps.current?.setColorAt(i, colour.set(TASSELS[side])));
  }, []);

  useFrame((_, dt) => {
    const mesh = caps.current;
    if (!mesh) return;
    const t = eggTime(milestone, clock.progress, reduced, CAPS.settled);
    // From the first toss until the camera has passed both.
    const cameraZ = cameraPose(clock.progress, width).position[2];
    mesh.visible = t > CAPS.tosses[0].at && course.some(({ to }) => cameraZ > to.z - 2);
    // Back in hand before the first toss, to be tossed again.
    if (t <= CAPS.tosses[0].at) tossed.current.fill(null);
    if (!mesh.visible) return;
    // Held while paused, as the ducks are.
    const step = paused ? 0 : Math.min(dt, .1);
    CAPS.tosses.forEach((toss, i) => {
      let air = tossed.current[i];
      if (t < toss.at) air = null;
      // Already well past its toss (a jump, or reduced motion): it's down.
      else if (air === null) air = reduced || t > toss.at + .25 ? 10 : 0;
      else air += step;
      tossed.current[i] = air;
      if (air === null) dummy.scale.setScalar(0);
      else {
        const { from, to } = course[i], { x, y, z, turn } = capInAir(from, to, air);
        dummy.position.set(x, y, z);
        // A flip end over end and a spin, as a tossed cap does, landing the
        // right way up facing the camera, tipped towards it on a tussock.
        dummy.rotation.set(turn * (Math.PI * 2 + CAPS.tilt), to.yaw + (1 - turn) * 5 * toss.side, turn * .1 * toss.side, 'YXZ');
        dummy.scale.setScalar(scale);
      }
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={caps} name="mortarboards" args={[parts.cap, parts.cloth, count]} frustumCulled={false} visible={false} />;
}
