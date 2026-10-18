// Turkey and Greece, July 2026: hot-air balloons, Cappadocia style, fade up
// out of the haze over the river as the trip's date arrives, then rise as the
// guest scrolls on, the nearest straight up and out of the picture, a few
// more further off rising after it (courses in balloonCourse.ts). Three draw
// calls for them all: the envelopes and baskets, one skinned mesh with a bone
// for each balloon; their ropes; and their burners, instanced.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useJourney } from '../JourneyProvider';
import { BALLOON, balloonGeometry } from './balloonGeometry';
import { BALLOONS, BALLOON_TIMES, balloonSpot } from './balloonCourse';
import { eggTime, type EggProps } from './egg';

const smooth = (t: number) => THREE.MathUtils.smoothstep(t, 0, 1);
// They take their own haze rather than the fog, tinted the fog's colour so it
// follows the time of day: enough to set them in the distance, thicker as
// they fade in.
const HAZE = { float: .15, edge: .5 };

export default function Balloon({ milestone, paused, reduced, mobile, width }: EggProps) {
  const clock = useJourney();
  const group = useRef<THREE.Group>(null), burners = useRef<THREE.InstancedMesh>(null);
  const parts = useMemo(() => {
    const { geometry, ropes, rope } = balloonGeometry();
    // The envelope is open at the mouth, so its inside shows from below.
    const cloth = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: .85, fog: false, transparent: true });
    const bones = BALLOONS.map(() => new THREE.Bone());
    const envelopes = new THREE.SkinnedMesh(geometry, cloth);
    envelopes.add(...bones);
    envelopes.bind(new THREE.Skeleton(bones));
    envelopes.frustumCulled = false;
    const lines = new THREE.BufferGeometry();
    lines.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(ropes.length * BALLOONS.length * 3), 3));
    return {
      geometry, envelopes, bones, ropes, lines, cloth, ropeColor: new THREE.Color(rope),
      rope: new THREE.LineBasicMaterial({ fog: false, transparent: true }),
      burner: new THREE.OctahedronGeometry(.12),
      glow: new THREE.MeshBasicMaterial({ color: '#ffb45e', transparent: true, depthWrite: false, toneMapped: false, fog: false }),
    };
  }, []);
  useEffect(() => () => {
    parts.geometry.dispose(); parts.lines.dispose(); parts.burner.dispose(); parts.envelopes.skeleton.dispose();
    [parts.cloth, parts.rope, parts.glow].forEach(material => material.dispose());
  }, [parts]);
  const idle = useRef(0);
  const scratch = useMemo(() => ({ point: new THREE.Vector3(), dummy: new THREE.Object3D() }), []);

  useFrame(({ scene }, dt) => {
    if (!group.current || !burners.current) return;
    const { arrive, climb, gone, settled } = BALLOON_TIMES;
    const t = eggTime(milestone, clock.progress, reduced, settled);
    group.current.visible = t > -.05 && t < gone;
    if (!group.current.visible) return;
    if (!paused) idle.current += Math.min(dt, .1);
    const s = idle.current, { cloth, rope, glow, ropeColor, bones, ropes, lines } = parts;
    const fadeIn = smooth(t / arrive), fadeOut = smooth((t - climb) / (gone - climb));
    const haze = THREE.MathUtils.lerp(HAZE.float, HAZE.edge, 1 - fadeIn);
    cloth.opacity = fadeIn * (1 - fadeOut);
    const fog = scene.fog instanceof THREE.Fog ? scene.fog : null;
    if (fog) {
      cloth.color.setScalar(1 - haze);
      cloth.emissive.copy(fog.color).multiplyScalar(haze);
      rope.color.copy(ropeColor).lerp(fog.color, haze);
    }
    rope.opacity = cloth.opacity;
    glow.opacity = .8 * cloth.opacity;
    const { point, dummy } = scratch, ends = lines.attributes.position as THREE.BufferAttribute;
    bones.forEach((bone, i) => {
      const spot = balloonSpot(clock.progress, t, mobile, width, i);
      if (!spot) {
        // Not flown on this composition: folded away to nothing.
        bone.scale.setScalar(0);
      } else {
        const { position: [x, y, z], scale } = spot;
        bone.position.set(x, y + Math.sin(s * .35 + i * 1.9) * .03, z);
        // A slow turn, as balloons do, and a breath of sway, each in its own time.
        bone.rotation.set(Math.sin(s * .5 + i) * .025, s * .05 + 1 + i * 1.7, Math.sin(s * .41 + 1 + i * 2.3) * .03);
        bone.scale.setScalar(scale);
      }
      bone.updateMatrix();
      ropes.forEach((end, k) => {
        point.copy(end).applyMatrix4(bone.matrix);
        ends.setXYZ(i * ropes.length + k, point.x, point.y, point.z);
      });
      // Each burner fires now and then: a warm flicker at the mouth.
      const burn = paused ? .35 : Math.pow(Math.max(0, Math.sin(s * .7 + i * 2.3)), 8) * (.75 + .25 * Math.sin(s * 23 + i));
      dummy.position.set(0, BALLOON.burner, 0).applyMatrix4(bone.matrix);
      dummy.scale.setScalar(bone.scale.x * (.45 + .75 * burn));
      dummy.updateMatrix();
      burners.current!.setMatrixAt(i, dummy.matrix);
    });
    ends.needsUpdate = true;
    burners.current.instanceMatrix.needsUpdate = true;
  });

  return <group ref={group} name="balloon" visible={false}>
    <primitive object={parts.envelopes} />
    <lineSegments geometry={parts.lines} material={parts.rope} frustumCulled={false} />
    <instancedMesh ref={burners} args={[parts.burner, parts.glow, BALLOONS.length]} frustumCulled={false} />
  </group>;
}
