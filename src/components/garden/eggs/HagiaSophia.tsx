// July 2026, Turkey and Greece: the Hagia Sophia far off down the river,
// beyond the S-bend on the left bank (placed in balloonCourse.ts), with the
// trip's balloons rising over the land round it. Still scenery: it comes up
// out of the haze as the trip's date nears and sinks back into it as the
// balloons climb away round the bend.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useJourney } from '../JourneyProvider';
import { HAGIA, hagiaShown, hagiaSophiaSpot } from './balloonCourse';
import { hagiaSophiaGeometry } from './hagiaSophiaGeometry';
import { eggTime, type EggProps } from './egg';

export default function HagiaSophia({ milestone, reduced, width }: EggProps) {
  const clock = useJourney();
  const group = useRef<THREE.Group>(null);
  const geometry = useMemo(hagiaSophiaGeometry, []);
  // Dissolves with the year markers' hashed fade. It takes its own haze
  // rather than the fog, as the balloons do: at its distance the fog would
  // all but hide it, most of all on a phone.
  const material = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85, alphaHash: true, fog: false }), []);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  const spot = useMemo(() => hagiaSophiaSpot(milestone.month, width), [milestone.month, width]);

  useFrame(({ scene }) => {
    if (!group.current) return;
    const shown = hagiaShown(eggTime(milestone, clock.progress, reduced, 0));
    group.current.visible = shown > 0;
    if (!shown) return;
    material.opacity = shown;
    // Tinted the fog's colour, so it follows the time of day, and thicker as
    // it comes and goes.
    const haze = HAGIA.haze + (1 - HAGIA.haze) * (1 - shown);
    if (scene.fog instanceof THREE.Fog) {
      material.color.setScalar(1 - haze);
      material.emissive.copy(scene.fog.color).multiplyScalar(haze);
    }
  });

  return <group ref={group} name="hagia-sophia" visible={false} position={[spot.x, spot.y, spot.z]} rotation={[0, spot.yaw, 0]} scale={spot.scale}>
    <mesh geometry={geometry} material={material} receiveShadow />
  </group>;
}
