// October 2026: Bullet, the product Patrick worked on, as a small brass
// bullet of a rocket on a launch stand on the right bank down the river
// (course in rocketLaunch.ts). As the scroll passes its moment it fires and
// climbs away in a gentle arc with a thin trail, playing out in real time, as
// the mortarboards do, so it never hangs in the air when the guest stops; a
// jump past it finds the stand empty, and scrolling back before it stands it
// on its stand again. Under reduced motion it stays on its stand.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useJourney, type SlotProps } from '../JourneyProvider';
import { EXHAUST_COUNT, FLOWN, ROCKET, exhaust, rocketCourse, rocketInFlight, rocketShown, rocketSpot, rocketTime } from './rocketLaunch';
import { launchStandGeometry, puffGeometry, rocketGeometry } from './rocketGeometry';

const SMOKE = '#efece6', FLAME = '#ffb45e';
const UP = new THREE.Vector3(0, 1, 0);

export default function Rocket({ paused, reduced, width }: SlotProps) {
  const clock = useJourney();
  const parts = useMemo(() => ({
    rocket: rocketGeometry(), stand: launchStandGeometry(), puff: puffGeometry(),
    // Dissolves in with the year markers' hashed fade.
    brass: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .38, metalness: .45, alphaHash: true }),
    wood: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9, alphaHash: true }),
    smoke: new THREE.MeshStandardMaterial({ roughness: 1, emissive: SMOKE, emissiveIntensity: .3 }),
  }), []);
  useEffect(() => () => Object.values(parts).forEach(part => part.dispose()), [parts]);
  const spot = useMemo(() => rocketSpot(width), [width]);
  const course = useMemo(() => rocketCourse(width), [width]);
  const group = useRef<THREE.Group>(null), rocket = useRef<THREE.Mesh>(null), puffs = useRef<THREE.InstancedMesh>(null);
  // Seconds since it fired, or null while it waits on its stand.
  const fired = useRef<number | null>(null);
  const idle = useRef(0);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const turn = useMemo(() => ({ yaw: new THREE.Quaternion().setFromAxisAngle(UP, spot.yaw), heading: new THREE.Vector3(), streak: new THREE.Vector3() }), [spot]);
  useEffect(() => {
    const colour = new THREE.Color();
    for (let i = 0; i <= EXHAUST_COUNT; i++) puffs.current?.setColorAt(i, colour.set(i < EXHAUST_COUNT ? SMOKE : FLAME));
  }, []);

  useFrame((_, dt) => {
    if (!group.current || !rocket.current || !puffs.current) return;
    const t = rocketTime(clock.progress);
    const shown = rocketShown(t);
    const step = paused ? 0 : Math.min(dt, .1);
    let air = fired.current;
    // Back on its stand before its moment, to fire again.
    if (reduced || t < 0) air = null;
    // Already well past it (a jump): it has gone.
    else if (air === null) air = t > .25 ? 99 : 0;
    else air += step;
    fired.current = air;
    // Once fired it flies on and its trail thins away, even if a guest
    // scrolling on has taken its stand back into the haze.
    group.current.visible = shown > 0 || (air !== null && air < FLOWN);
    if (!group.current.visible) return;
    parts.wood.opacity = shown;
    parts.brass.opacity = air === null ? shown : 1;
    idle.current += step;
    const { position, heading, burn, gone } = rocketInFlight(course, air);
    rocket.current.visible = !gone;
    rocket.current.position.set(...position);
    // Nose along its course, fins turned to the camera as it stood.
    turn.heading.set(...heading);
    rocket.current.quaternion.setFromUnitVectors(UP, turn.heading).multiply(turn.yaw);
    // A shiver on the stand as it ignites.
    if (air !== null && air < ROCKET.ignite) rocket.current.position.x += Math.sin(idle.current * 60) * .006 * spot.scale;
    const smoke = exhaust(course, air);
    puffs.current.visible = air !== null && air < 99;
    if (!puffs.current.visible) return;
    smoke.forEach(({ x, y, z, size, length, dir }, i) => {
      dummy.position.set(x, y, z);
      // A puff tumbled, a streak laid along the trail.
      if (length > size) dummy.quaternion.setFromUnitVectors(UP, turn.streak.set(...dir));
      else dummy.rotation.set(i * 1.3, i * 2.1, 0);
      dummy.scale.set(size, length, size);
      dummy.updateMatrix();
      puffs.current!.setMatrixAt(i, dummy.matrix);
    });
    // The flame, stretched out behind the nozzle, flickering.
    const flame = burn * (.85 + .15 * Math.sin(idle.current * 41)) * .14 * spot.scale;
    dummy.position.set(...position).addScaledVector(turn.heading, -flame * .8);
    dummy.quaternion.copy(rocket.current.quaternion);
    dummy.scale.set(flame * .3, flame, flame * .3);
    dummy.updateMatrix();
    puffs.current.setMatrixAt(EXHAUST_COUNT, dummy.matrix);
    puffs.current.instanceMatrix.needsUpdate = true;
  });

  return <group ref={group} name="rocket" visible={false}>
    <mesh geometry={parts.stand} material={parts.wood} position={[spot.x, spot.y, spot.z]} rotation={[0, spot.yaw, 0]} scale={spot.scale} receiveShadow />
    <mesh ref={rocket} geometry={parts.rocket} material={parts.brass} scale={spot.scale} />
    <instancedMesh ref={puffs} args={[parts.puff, parts.smoke, EXHAUST_COUNT + 1]} frustumCulled={false} visible={false} />
  </group>;
}
