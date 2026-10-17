// Turkey and Greece, July 2026: a hot-air balloon, Cappadocia style, fades up
// out of the haze over the river as the trip's date arrives, then rises
// straight up and out of the picture as the guest scrolls on.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useJourney } from '../JourneyProvider';
import { BALLOON, balloonGeometry } from './balloonGeometry';
import { BALLOON_TIMES, balloonSpot } from './balloonCourse';
import { eggTime, type EggProps } from './egg';

const smooth = (t: number) => THREE.MathUtils.smoothstep(t, 0, 1);
// It takes its own haze rather than the fog, tinted the fog's colour so it
// follows the time of day: enough to set it in the distance, thicker as it
// fades in.
const HAZE = { float: .15, edge: .5 };

export default function Balloon({ milestone, paused, reduced, mobile, width }: EggProps) {
  const clock = useJourney();
  const balloon = useRef<THREE.Group>(null);
  const { geometry, lines, rope } = useMemo(balloonGeometry, []);
  const materials = useMemo(() => ({
    cloth: new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: .85, fog: false, transparent: true }),
    rope: new THREE.LineBasicMaterial({ fog: false, transparent: true }),
    glow: new THREE.MeshBasicMaterial({ color: '#ffb45e', transparent: true, depthWrite: false, toneMapped: false, fog: false }),
  }), []);
  const ropeColor = useMemo(() => new THREE.Color(rope), [rope]);
  useEffect(() => () => {
    geometry.dispose(); lines.dispose();
    Object.values(materials).forEach(material => material.dispose());
  }, [geometry, lines, materials]);
  const idle = useRef(0);

  useFrame(({ scene }, dt) => {
    const group = balloon.current;
    if (!group) return;
    const { arrive, climb, gone, settled } = BALLOON_TIMES;
    const t = eggTime(milestone, clock.progress, reduced, settled);
    group.visible = t > -.05 && t < gone;
    if (!group.visible) return;
    if (!paused) idle.current += Math.min(dt, .1);
    const s = idle.current;
    const fadeIn = smooth(t / arrive), fadeOut = smooth((t - climb) / (gone - climb));
    const haze = THREE.MathUtils.lerp(HAZE.float, HAZE.edge, 1 - fadeIn);
    materials.cloth.opacity = fadeIn * (1 - fadeOut);
    const fog = scene.fog instanceof THREE.Fog ? scene.fog : null;
    if (fog) {
      materials.cloth.color.setScalar(1 - haze);
      materials.cloth.emissive.copy(fog.color).multiplyScalar(haze);
      materials.rope.color.copy(ropeColor).lerp(fog.color, haze);
    }
    materials.rope.opacity = materials.cloth.opacity;
    const { position: [x, y, z], scale } = balloonSpot(clock.progress, t, mobile, width);
    group.position.set(x, y + Math.sin(s * .35) * .03, z);
    // A slow turn, as balloons do, and a breath of sway.
    group.rotation.set(Math.sin(s * .5) * .025, s * .05 + 1, Math.sin(s * .41 + 1) * .03);
    group.scale.setScalar(scale);
    // The burner fires now and then: a warm flicker at the mouth.
    const burn = paused ? .35 : Math.pow(Math.max(0, Math.sin(s * .7)), 8) * (.75 + .25 * Math.sin(s * 23));
    materials.glow.opacity = (.25 + .75 * burn) * materials.cloth.opacity;
  });

  return <group ref={balloon} name="balloon" visible={false}>
    {/* The envelope is open at the mouth, so its inside shows from below. */}
    <mesh geometry={geometry} material={materials.cloth} />
    <lineSegments geometry={lines} material={materials.rope} />
    <mesh position={[0, BALLOON.burner, 0]} material={materials.glow}>
      <sphereGeometry args={[.12, 8, 6]} />
    </mesh>
  </group>;
}
