// Turkey and Greece, July 2026: a hot-air balloon, Cappadocia style, rises
// out of the mist down the river as the trip's date arrives. It drifts up and a
// little sideways as the guest scrolls, floats on small and far over the
// river through the bend, then drifts off into the haze before the dock.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { progressAt } from '../journey';
import { useJourney } from '../JourneyProvider';
import { BALLOON, balloonGeometry } from './balloonGeometry';
import { cameraHeading, eggTime, heightAt, inView, overRiver, type EggProps } from './egg';
import { cameraPose } from '../cameraRig';

const smooth = (t: number) => THREE.MathUtils.smoothstep(t, 0, 1);
// Its course in milestone shares since the date: it rises out of the mist
// over the first share and a half, keeps climbing slowly, and leaves from
// LEAVE to GONE, still inside the voyage. Under reduced motion it rests at SETTLED.
const RISE = 1.6, LEAVE = 2.4, GONE = 3.4, SETTLED = 1.4;
// The trees along the banks close over the river, so the only sky the guest
// sees is up the river's corridor. The balloon keeps over the water there,
// nearer than it looks and scaled down to match: the far trees stand behind
// it, never in front. Desktop holds it right of centre, clear of the date
// label; portrait's narrow lens keeps it nearer the middle. Elevations are
// degrees above the eye line.
const VIEW = {
  desktop: { distance: 18, scale: .36, bearing: [10, 12], elevation: [1, 9.5, 11], share: .75 },
  mobile: { distance: 18, scale: .34, bearing: [4, 6], elevation: [1, 11, 13.5], share: .6 },
};
// Lagging the camera's turn would carry it left, under the date label, so it
// never comes nearer the middle of the picture than its first bearing.
// It takes its own haze rather than the fog, tinted the fog's colour so it
// follows the time of day: enough to set it in the distance, thicker as it
// fades in out of the mist and as it fades away.
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
  const from = progressAt(milestone.month), view = mobile ? VIEW.mobile : VIEW.desktop;

  useFrame(({ scene }, dt) => {
    const group = balloon.current;
    if (!group) return;
    const t = eggTime(milestone, clock.progress, reduced, SETTLED);
    group.visible = t > -.05 && t < GONE;
    if (!group.visible) return;
    if (!paused) idle.current += Math.min(dt, .1);
    const s = idle.current;
    const climb = smooth(t / RISE), drift = smooth((t - RISE) / (LEAVE - RISE)), leave = smooth((t - LEAVE) / (GONE - LEAVE));
    const [low, high, top] = view.elevation;
    const elevation = low + (high - low) * climb + (top - high) * drift;
    const distance = view.distance * (1 + .3 * leave);
    const arrive = smooth(t / (RISE * .5));
    const haze = THREE.MathUtils.lerp(HAZE.float, HAZE.edge, Math.max(1 - arrive, leave));
    materials.cloth.opacity = arrive * (1 - leave);
    const fog = scene.fog instanceof THREE.Fog ? scene.fog : null;
    if (fog) {
      materials.cloth.color.setScalar(1 - haze);
      materials.cloth.emissive.copy(fog.color).multiplyScalar(haze);
      materials.rope.color.copy(ropeColor).lerp(fog.color, haze);
    }
    materials.rope.opacity = materials.cloth.opacity;
    const bearing = view.bearing[0] + (view.bearing[1] - view.bearing[0]) * (climb * .4 + drift * .4 + leave * .2);
    // It turns with the camera only partly, so through the bend it lags a
    // little behind the trees, as something far away does.
    let [x, , z] = overRiver(inView(clock.progress, width, { distance, bearing, from, follow: .6 }), width, view.share);
    const { position: [cx, , cz] } = cameraPose(clock.progress, width);
    if (Math.atan2(x - cx, cz - z) - cameraHeading(clock.progress, width) < view.bearing[0] * Math.PI / 180) {
      [x, , z] = overRiver(inView(clock.progress, width, { distance, bearing: view.bearing[0] }), width, view.share);
    }
    group.position.set(x, heightAt(distance, elevation) + Math.sin(s * .35) * .03, z);
    // A slow turn, as balloons do, and a breath of sway.
    group.rotation.set(Math.sin(s * .5) * .025, s * .05 + 1, Math.sin(s * .41 + 1) * .03);
    group.scale.setScalar(view.scale);
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
