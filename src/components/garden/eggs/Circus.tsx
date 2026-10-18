// Amelia's aerial circus on her bank (see circusRigs.ts for where and when): an
// aerial silk at the end of 2020, a lyra from October 2025 and beside it a
// bird hanging upside down from a branch for her handstands, each hung from a
// real tree. Each dissolves in as its month comes and goes once the camera
// has passed it, one draw call each: the silk alone, or the lyra and the
// bird. Each sways gently in the breeze, held while paused, and hangs at rest
// under reduced motion.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useJourney } from '../JourneyProvider';
import type { SlotProps } from '../JourneyProvider';
import { RIGS, hangSpot, rigShown, type RigId } from './circusRigs';
import { LYRA_SHAPE, hangingBirdGeometry, lyraGeometry, silkGeometry, writeHangingBird, writeSilk } from './circusGeometry';

const IDS = Object.keys(RIGS) as RigId[];
// The silk's tails stop just short of the ground; the lyra's hoop hangs at
// about the height of a performer's reach.
const SILK_CLEAR = .15, LYRA_CLEAR = 1.1;
// How far the bird tips its head down from hanging level, in radians, so
// its head hangs down and its tail points up, as in a handstand, and how far
// it holds its wings open.
const BIRD_TIP = 1.15, BIRD_OPEN = .3;

export default function Circus({ mobile, width, paused }: SlotProps) {
  const clock = useJourney();
  const spots = useMemo(() => Object.fromEntries(IDS.map(id => [id, hangSpot(RIGS[id], width)])) as Record<RigId, ReturnType<typeof hangSpot>>, [width]);
  const silkLength = (spots.silk.y - spots.silk.ground - SILK_CLEAR) / spots.silk.scale;
  // Each built at rest, as reduced motion and a pause show it.
  const parts = useMemo(() => {
    const { lyra } = spots;
    const drop = Math.max(.4, (lyra.y - lyra.ground - LYRA_CLEAR) / lyra.scale - LYRA_SHAPE.radius * 2);
    const silk = silkGeometry(), bird = hangingBirdGeometry();
    writeSilk(silk, silkLength, 0, 1);
    writeHangingBird(bird, BIRD_TIP, BIRD_OPEN);
    return { silk, lyra: lyraGeometry(drop), bird };
  }, [spots, silkLength]);
  // Hashed alpha dissolves each without sorting, as the year markers do.
  const materials = useMemo(() => ({
    silk: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .55, side: THREE.DoubleSide, alphaHash: true }),
    lyra: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .5, metalness: .1, alphaHash: true }),
    bird: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8, side: THREE.DoubleSide, flatShading: true, alphaHash: true }),
  }), []);
  useEffect(() => () => {
    Object.values(parts).forEach(part => part.dispose());
    Object.values(materials).forEach(material => material.dispose());
  }, [parts, materials]);
  const groups = useRef<Partial<Record<RigId, THREE.Group | null>>>({});
  const hoop = useRef<THREE.Group>(null), bird = useRef<THREE.Group>(null);
  const time = useRef(0);

  useFrame(({ camera }, dt) => {
    const p = clock.progress;
    if (!paused) time.current += Math.min(dt, .1);
    const t = time.current;
    for (const id of IDS) {
      const group = groups.current[id];
      if (!group) continue;
      const shown = rigShown(RIGS[id], spots[id], p, camera.position.z, mobile);
      group.visible = shown > 0;
      materials[id].opacity = shown;
      if (!group.visible || paused) continue;
      if (id === 'silk') writeSilk(parts.silk, silkLength, t, 1);
      // The hoop turns slowly on its swivel and swings a little.
      if (id === 'lyra' && hoop.current) hoop.current.rotation.set(Math.sin(t * .6) * .03, Math.sin(t * .23) * .55, Math.sin(t * .8 + 1) * .025);
      // The bird swings a little from its feet and now and then opens its wings to steady itself.
      if (id === 'bird' && bird.current) {
        bird.current.rotation.z = Math.sin(t * 1.1) * .12;
        writeHangingBird(parts.bird, BIRD_TIP + Math.sin(t * .7) * .08, BIRD_OPEN + .4 * Math.max(0, Math.sin(t * .45)) ** 12);
      }
    }
  });

  const place = (id: RigId) => ({ ref: (el: THREE.Group | null) => { groups.current[id] = el; }, visible: false,
    position: [spots[id].x, spots[id].y, spots[id].z] as const, rotation: [0, spots[id].yaw, 0] as const, scale: spots[id].scale });
  return <group name="circus">
    <group name="aerial-silk" {...place('silk')}>
      <mesh geometry={parts.silk} material={materials.silk} receiveShadow />
    </group>
    <group name="lyra" {...place('lyra')}>
      <group ref={hoop}><mesh geometry={parts.lyra} material={materials.lyra} receiveShadow /></group>
    </group>
    {/* Three-quarters on to the camera, so it reads head down with its wings. */}
    <group name="hanging-bird" {...place('bird')}>
      <group ref={bird}><mesh geometry={parts.bird} material={materials.bird} rotation={[0, Math.PI / 2 - .6, 0]} /></group>
    </group>
  </group>;
}
