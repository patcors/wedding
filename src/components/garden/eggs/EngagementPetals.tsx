// April 2026, they get engaged: rose petals trail behind the catamaran on the
// water, and a few flutter down from the big sail as it unrolls (course and
// timing in petalTrail.ts). Each is let go as the scroll reaches it and falls
// in real time, as the rubber ducks are tossed, so none hangs in the air when
// the guest stops; on the water they spread with the scroll and turn idly.
// One instanced draw call of about a thousand triangles, no shadows, hidden
// outside the trail's window. Under reduced motion a few rest on the water at
// the engagement's still.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useJourney, type SlotProps } from '../JourneyProvider';
import { PETALS, PETAL_LIST, afloat, floatPoint, petalCourse, petalScale, petalTime, petalsShown, restingPetals } from './petalTrail';

// A rose petal lying on the water, its base towards −z: broad and rounded,
// with a shallow notch at the tip, cupped so its edges catch the light. Its
// length is 1 and it sits just above the water.
function roseGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(-.5, .12, -.52, .82, -.16, .98);
  shape.quadraticCurveTo(0, .9, .16, .98);
  shape.bezierCurveTo(.52, .82, .5, .12, 0, 0);
  const geometry = new THREE.ShapeGeometry(shape, 3).translate(0, -.5, 0).rotateX(-Math.PI / 2);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), z = position.getZ(i);
    position.setY(i, x * x * .55 + (z + .5) * .08);
  }
  geometry.computeVertexNormals();
  return geometry;
}
// Seconds for a petal to grow from a speck as it leaves the deck or sail.
const BUD = .3;

export default function EngagementPetals({ paused, reduced, mobile, width }: SlotProps) {
  const clock = useJourney();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const parts = useMemo(() => ({
    petal: roseGeometry(),
    material: new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: .7 }),
  }), []);
  useEffect(() => () => Object.values(parts).forEach(part => part.dispose()), [parts]);
  const courses = useMemo(() => PETAL_LIST.map(petal => petalCourse(petal, width)), [width]);
  const resting = useMemo(() => restingPetals(width), [width]);
  // Seconds since each was let go, or null while it waits aboard.
  const fallen = useRef<(number | null)[]>(PETAL_LIST.map(() => null));
  const idle = useRef(0);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useLayoutEffect(() => {
    if (!mesh.current) return;
    const colour = new THREE.Color();
    PETAL_LIST.forEach((petal, i) => mesh.current!.setColorAt(i, colour.set(PETALS.colours[petal.colour])));
    mesh.current.instanceColor!.needsUpdate = true;
  }, []);

  useFrame((_, dt) => {
    if (!mesh.current) return;
    const t = petalTime(clock.progress), still = reduced && Math.abs(t) < 1e-6;
    mesh.current.visible = still || (!reduced && petalsShown(t));
    if (!mesh.current.visible) return;
    const step = paused ? 0 : Math.min(dt, .1);
    idle.current += step;
    const s = idle.current, size = mobile ? PETALS.size.mobile : PETALS.size.desktop;
    PETAL_LIST.forEach((petal, i) => {
      dummy.scale.setScalar(0);
      const rest = still ? resting[i] : null;
      if (rest) {
        dummy.position.set(rest.position[0], .03, rest.position[2]);
        dummy.rotation.set(0, petal.turn, 0);
        dummy.scale.setScalar(size * petal.size);
      } else if (!still) {
        let air = fallen.current[i];
        if (t < petal.at) air = null;
        // Already well past its release (a jump): it's on the water.
        else if (air === null) air = t > petal.at + .12 ? 60 : 0;
        else air += step;
        fallen.current[i] = air;
        if (air !== null && afloat(petal, t)) {
          const course = courses[i], age = t - petal.at, k = Math.min(1, air / petal.fall);
          const [x, , z] = floatPoint(petal, course, age, width);
          // Falling, it drifts out to where it lands first, then flutters down
          // swaying and tumbling; afloat, it bobs and turns slowly.
          const out = 1 - (1 - k) ** 2, sway = (1 - k) * Math.min(1, petal.fall / 2) * .18, phase = s * 2.6 + petal.turn;
          dummy.position.set(
            course.from[0] + (x - course.from[0]) * out + Math.sin(phase) * sway,
            course.from[1] + (.03 - course.from[1]) * k * k + Math.sin(s * 1.3 + petal.turn) * .006 * k,
            course.from[2] + (z - course.from[2]) * out + Math.cos(phase * .8) * sway,
          );
          dummy.rotation.set((1 - k) * Math.sin(phase * 1.3) * 1.1, petal.turn + s * .12 * k + (1 - k) * s * 2, (1 - k) * Math.cos(phase) * .9);
          dummy.scale.setScalar(size * petal.size * Math.min(1, .3 + air / BUD) * petalScale(age));
        }
      }
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={mesh} name="engagement-petals" args={[parts.petal, parts.material, PETAL_LIST.length]} frustumCulled={false} visible={false} />;
}
