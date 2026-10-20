// July 2017: the university's duck pond is famous for its rubber duck races,
// so as the date holds, rubber ducks are tossed one by one from behind the
// bank (course in campus.ts). Each arcs out, plops in with a ring on the
// water, and bobs off downstream, and the boats sail past them.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { simplifiedRubberDuck } from '../rubberDuckGeometry';
import { useJourney } from '../JourneyProvider';
import { DUCKS, duckLaunchSpot, duckOnWater, duckScale } from './campus';
import { eggTime, type EggProps } from './egg';

const RING = { seconds: 1.2, size: .7 };

export default function Ducks({ milestone, paused, reduced, mobile, width }: EggProps) {
  const clock = useJourney();
  const group = useRef<THREE.Group>(null);
  const ducks = useRef<THREE.InstancedMesh>(null);
  const rings = useRef<THREE.InstancedMesh>(null);
  const count = DUCKS.launches.length;
  const parts = useMemo(() => ({
    // Small and a little way off, so a tenth of its faces is plenty.
    duck: simplifiedRubberDuck(.1),
    ring: new THREE.RingGeometry(.8, 1, 24).rotateX(-Math.PI / 2),
    plastic: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .45 }),
    // Rings add a little light to the water, so each fades on its own by
    // dimming its instance colour.
    ripple: new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
  }), []);
  useEffect(() => () => Object.values(parts).forEach(part => part.dispose()), [parts]);
  const launches = useMemo(() => DUCKS.launches.map((_, i) => duckLaunchSpot(i, width)), [width]);
  // Seconds each duck has been in the air or water since it was tossed, or
  // null while it waits behind the bank.
  const thrown = useRef<(number | null)[]>(Array(count).fill(null));
  const idle = useRef(0);
  const scale = duckScale(mobile);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colour = useMemo(() => new THREE.Color(), []);
  // The rings' colours exist from the first frame, so the material is built with them.
  useLayoutEffect(() => {
    for (let i = 0; i < count; i++) rings.current?.setColorAt(i, colour.setScalar(0));
  }, [count, colour]);

  useFrame((_, dt) => {
    if (!group.current || !ducks.current || !rings.current) return;
    const t = eggTime(milestone, clock.progress, reduced, DUCKS.settled);
    group.current.visible = t > 0 && t < DUCKS.gone;
    if (!group.current.visible) return;
    const step = paused ? 0 : Math.min(dt, .1);
    idle.current += step;
    DUCKS.launches.forEach((launch, i) => {
      let air = thrown.current[i];
      if (t < launch.at) air = null;
      // Already well past its launch (a jump, or reduced motion): it's in.
      else if (air === null) air = reduced || t > launch.at + .25 ? 10 : 0;
      else air += step;
      thrown.current[i] = air;
      const water = duckOnWater(i, Math.max(t, launch.at), width), from = launches[i];
      const k = air === null ? 0 : Math.min(1, air / DUCKS.flight);
      const s = idle.current + i * 1.7;
      if (air === null) dummy.scale.setScalar(0);
      else {
        dummy.scale.setScalar(scale);
        // Out over the water on an arc, tumbling a little, then a bob that
        // settles after the plop.
        const landed = Math.max(0, air - DUCKS.flight);
        const dip = k < 1 ? 0 : -.09 * Math.exp(-landed * 3) * Math.cos(landed * 9);
        dummy.position.set(from.x + (water.x - from.x) * k,
          from.y + (-.02 - from.y) * k + DUCKS.arc * 4 * k * (1 - k) + dip + Math.sin(s * 1.6) * .012 * k, from.z + (water.z - from.z) * k);
        dummy.rotation.set((1 - k) * 1.2 + Math.sin(s * 1.3) * .04, i * 1.9 + t * .9 + (1 - k) * 2, Math.sin(s * 1.1) * .05);
      }
      dummy.updateMatrix();
      ducks.current!.setMatrixAt(i, dummy.matrix);
      // Its ring spreads from where it landed.
      const ring = air === null || reduced ? 1 : (air - DUCKS.flight) / RING.seconds;
      const live = ring >= 0 && ring < 1;
      dummy.position.set(water.x, .015, water.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(live ? scale * RING.size * (.25 + ring) : 0);
      dummy.updateMatrix();
      rings.current!.setMatrixAt(i, dummy.matrix);
      rings.current!.setColorAt(i, colour.setScalar(live ? .35 * (1 - ring) ** 2 : 0));
    });
    ducks.current.instanceMatrix.needsUpdate = true;
    rings.current.instanceMatrix.needsUpdate = true;
    if (rings.current.instanceColor) rings.current.instanceColor.needsUpdate = true;
  });

  return <group ref={group} name="duck-launch" visible={false}>
    <instancedMesh ref={ducks} args={[parts.duck, parts.plastic, count]} frustumCulled={false} />
    <instancedMesh ref={rings} args={[parts.ring, parts.ripple, count]} frustumCulled={false} />
  </group>;
}
