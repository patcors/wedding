// May 2024 to mid 2025: two birds and their birdhouses tell how they bought
// apartments, how Patrick stayed at Amelia's while he renovated his, and how
// Amelia moved into his (the story and its timing in nesting.ts). Each step
// plays in real time once the scroll reaches it, so no bird hangs in the air
// when the guest stops. Three draw calls at most: a pair of houses (or two,
// as the second comes up out of the haze), the scaffolding or the other pair,
// and the birds.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { cameraPose } from '../cameraRig';
import { ROOM } from '../journey';
import { useJourney } from '../JourneyProvider';
import { NESTS, NEST_EVENTS, birdPoses, fired, nestSpots, nestTriggers } from './nesting';
import { birdhousePairGeometry, birdsGeometry, scaffoldGeometry, writeBird } from './birdhouseGeometry';
import type { EggProps } from './egg';

const OWNERS = ['amelia', 'patrick'] as const;
// The birds are a little larger than life beside their houses, so they read.
const BIRD_SCALE = 1.45;
const smooth = (t: number) => THREE.MathUtils.smoothstep(t, 0, 1);
// Up out of the ground with a little spring at the top.
const springUp = (t: number) => {
  const x = Math.min(1, Math.max(0, t)), c = 1.6;
  return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2;
};

export default function Birdhouses({ paused, reduced, width }: EggProps) {
  const clock = useJourney();
  const spots = useMemo(() => nestSpots(width), [width]);
  const triggers = useMemo(() => nestTriggers(width), [width]);
  // Each pair is drawn from the foot of its lower post, so it rises from there.
  const origins = useMemo(() => spots.map(({ amelia, patrick }) =>
    ({ x: (amelia.x + patrick.x) / 2, y: Math.min(amelia.y, patrick.y), z: (amelia.z + patrick.z) / 2 })), [spots]);
  const parts = useMemo(() => ({
    pairs: spots.map((pair, k) => birdhousePairGeometry(pair, origins[k])),
    scaffold: scaffoldGeometry(),
    birds: birdsGeometry([...OWNERS, ...OWNERS]),
    wood: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85 }),
    feathers: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8, side: THREE.DoubleSide, flatShading: true }),
  }), [spots, origins]);
  useEffect(() => () => {
    const { pairs, ...rest } = parts;
    pairs.forEach(pair => pair.dispose());
    Object.values(rest).forEach(part => part.dispose());
  }, [parts]);
  const pairs = useRef<(THREE.Mesh | null)[]>([]);
  const scaffold = useRef<THREE.Mesh>(null), birds = useRef<THREE.Mesh>(null);
  // Seconds since each event fired, or null before it has.
  const since = useRef<(number | null)[]>(NEST_EVENTS.map(() => null));
  const idle = useRef(0);
  const builds = useMemo(() => [0, 1].map(pair => NEST_EVENTS.findIndex(e => e.pair === pair && e.build)), []);
  const scaffolds = useMemo(() => NEST_EVENTS.flatMap((e, i) => e.scaffold === undefined ? [] : [i]), []);

  useFrame((_, dt) => {
    if (!scaffold.current || !birds.current) return;
    const p = clock.progress, step = paused ? 0 : Math.min(dt, .1);
    idle.current += step;
    NEST_EVENTS.forEach((_, i) => {
      const s = since.current[i];
      if (!fired(i, triggers, p, reduced)) since.current[i] = null;
      // Already well past it (a jump, or reduced motion): it's done.
      else if (s === null) since.current[i] = reduced || p > triggers[i] + .25 * ROOM ? 99 : 0;
      else since.current[i] = s + step;
    });
    const cameraZ = cameraPose(p, width).position[2];
    // Each pair from when it goes up until the camera has passed it.
    const shown = spots.map(({ amelia, patrick }, k) => {
      const built = since.current[builds[k]], mesh = pairs.current[k];
      const on = built !== null && cameraZ > Math.min(amelia.z, patrick.z) - 2;
      if (mesh) {
        mesh.visible = on;
        mesh.scale.set(1, springUp(built! / NESTS.rise), 1);
      }
      return on;
    });
    // The scaffolding springs up with Patrick's house, and comes down as his
    // bird flies home.
    const last = scaffolds.findLast(i => since.current[i] !== null), s = last === undefined ? 0 : since.current[last]!;
    const up = last === undefined ? 0 : NEST_EVENTS[last].build ? springUp(s / NESTS.rise)
      : NEST_EVENTS[last].scaffold ? smooth(s / NESTS.scaffold) : 1 - smooth(s / NESTS.scaffold);
    scaffold.current.visible = shown[0] && up > 0;
    scaffold.current.scale.set(spots[0].patrick.scale, spots[0].patrick.scale * up, spots[0].patrick.scale);
    birds.current.visible = shown.some(Boolean);
    if (!birds.current.visible) return;
    const positions = parts.birds.attributes.position.array as Float32Array, t = idle.current;
    birdPoses(since.current, spots).forEach((pair, k) => OWNERS.forEach((owner, j) => {
      const b = k * 2 + j, pose = pair[owner], scale = spots[k][owner].scale * BIRD_SCALE;
      // Perched, it looks about now and then; flying, it beats its wings.
      const look = (1 - pose.flying) * Math.sin(t * .7 + b * 2.3) ** 3 * .5;
      writeBird(positions, b, pose, pose.heading + look, scale, pose.flying, Math.sin(t * 26 + b), shown[k] && pose.shown);
    }));
    parts.birds.attributes.position.needsUpdate = true;
    parts.birds.computeVertexNormals();
  });

  return <group name="birdhouses">
    {spots.map((_, k) => <mesh key={k} ref={el => { pairs.current[k] = el; }} geometry={parts.pairs[k]} material={parts.wood} visible={false}
      position={[origins[k].x, origins[k].y, origins[k].z]} />)}
    <mesh ref={scaffold} geometry={parts.scaffold} material={parts.wood} visible={false}
      position={[spots[0].patrick.x, spots[0].patrick.y, spots[0].patrick.z]} rotation={[0, spots[0].patrick.yaw, 0]} />
    <mesh ref={birds} geometry={parts.birds} material={parts.feathers} visible={false} frustumCulled={false} />
  </group>;
}
