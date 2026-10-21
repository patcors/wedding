// May 2024 to mid 2025: two birds and their birdhouses, one on each bank,
// tell how they bought apartments on the same street, how Patrick stayed at
// Amelia's while he renovated his, and how Amelia moved into his (the story
// and its timing in nesting.ts). Each step plays in real time once the scroll
// reaches it, so no bird hangs in the air when the guest stops. Three draw
// calls at most: both houses with their numbers and the scaffolding, the
// birds, and the street sign on the tree beside hers.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { cameraPose } from '../cameraRig';
import { ROOM } from '../journey';
import { useJourney } from '../JourneyProvider';
import { useTreeModels } from '../GardenTrees';
import { treeBase } from '../gardenTreeSpots';
import { NESTS, NEST_EVENTS, SIGN, birdPoses, fired, nestSpots, nestTriggers, signFaces, signTree } from './nesting';
import { birdhousesGeometry, birdsGeometry, writeBird } from './birdhouseGeometry';
import { BLADE, signGeometry, signMount, streetAtlas } from './streetSign';
import { treeMatrix, type TreeMesh } from './barkCarvingGeometry';
import { carvingShown } from './uniOrnaments';
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

// The model's branches as plain arrays (its normals are stored packed).
function treeMesh(geometry: THREE.BufferGeometry): TreeMesh {
  const position = geometry.attributes.position, normal = geometry.attributes.normal;
  const positions = new Float32Array(position.count * 3), normals = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    positions.set([position.getX(i), position.getY(i), position.getZ(i)], i * 3);
    normals.set([normal.getX(i), normal.getY(i), normal.getZ(i)], i * 3);
  }
  return { position: positions, normal: normals, index: geometry.index!.array };
}

export default function Birdhouses({ paused, reduced, width }: EggProps) {
  const clock = useJourney();
  const models = useTreeModels();
  const spots = useMemo(() => nestSpots(width), [width]);
  const triggers = useMemo(() => nestTriggers(), []);
  const tree = useMemo(() => {
    const t = signTree(width);
    return { ...t, y: treeBase(t, width) };
  }, [width]);
  const parts = useMemo(() => {
    const atlas = streetAtlas(), houses = birdhousesGeometry(spots);
    const branches = (models[tree.type].nodes.branches as THREE.Mesh).geometry;
    const length = BLADE.length * (width < 1 ? BLADE.mobile : 1);
    const mount = signMount(treeMesh(branches), treeMatrix(tree), signFaces(width), width < 1 ? SIGN.height.mobile : SIGN.height.desktop, length);
    // The houses' resting shape, which each frame's rise scales from.
    const rest = Float32Array.from(houses.geometry.attributes.position.array as Float32Array);
    (houses.geometry.attributes.position as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage);
    houses.geometry.computeBoundingSphere();
    houses.geometry.boundingSphere!.radius *= 1.2;
    return {
      houses, rest, atlas,
      sign: signGeometry(mount, length),
      birds: birdsGeometry([...OWNERS]),
      wood: new THREE.MeshStandardMaterial({ vertexColors: true, map: atlas, roughness: .85 }),
      feathers: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8, side: THREE.DoubleSide, flatShading: true }),
    };
  }, [spots, models, tree, width]);
  useEffect(() => () => {
    [parts.houses.geometry, parts.sign, parts.birds, parts.atlas, parts.wood, parts.feathers].forEach(part => part.dispose());
  }, [parts]);
  const houses = useRef<THREE.Mesh>(null), sign = useRef<THREE.Mesh>(null), birds = useRef<THREE.Mesh>(null);
  // Seconds since each event fired, or null before it has.
  const since = useRef<(number | null)[]>(NEST_EVENTS.map(() => null));
  const idle = useRef(0);
  // How far the houses and the scaffolding stand up as last written.
  const written = useRef({ rise: -1, up: -1 });
  const build = useMemo(() => NEST_EVENTS.findIndex(e => e.build), []);
  const scaffolds = useMemo(() => NEST_EVENTS.flatMap((e, i) => e.scaffold === undefined ? [] : [i]), []);

  useFrame((_, dt) => {
    if (!houses.current || !sign.current || !birds.current) return;
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
    // The sign is always on its tree, drawn while the tree is near, as the
    // carvings are.
    sign.current.visible = carvingShown(tree, cameraZ) > 0;
    // The houses from when they go up until the camera has passed them.
    const built = since.current[build];
    const shown = built !== null && cameraZ > Math.min(spots.amelia.z, spots.patrick.z) - 2;
    houses.current.visible = shown;
    birds.current.visible = shown;
    if (!shown) return;
    // The scaffolding springs up with Patrick's house, and comes down as his
    // bird flies home.
    const last = scaffolds.findLast(i => since.current[i] !== null), s = last === undefined ? 0 : since.current[last]!;
    const up = last === undefined ? 0 : NEST_EVENTS[last].build ? 1
      : NEST_EVENTS[last].scaffold ? smooth(s / NESTS.scaffold) : 1 - smooth(s / NESTS.scaffold);
    const rise = springUp(built / NESTS.rise);
    if (rise !== written.current.rise || up !== written.current.up) {
      written.current = { rise, up };
      const positions = parts.houses.geometry.attributes.position.array as Float32Array;
      for (const [name, k] of [['amelia', rise], ['patrick', rise], ['scaffold', rise * up]] as const) {
        const { start, count, foot } = parts.houses.parts[name];
        for (let i = start * 3; i < (start + count) * 3; i += 3) {
          positions[i] = parts.rest[i];
          positions[i + 1] = foot + (parts.rest[i + 1] - foot) * k;
          positions[i + 2] = parts.rest[i + 2];
        }
      }
      parts.houses.geometry.attributes.position.needsUpdate = true;
    }
    const positions = parts.birds.attributes.position.array as Float32Array, t = idle.current;
    const poses = birdPoses(since.current, spots);
    OWNERS.forEach((owner, b) => {
      const pose = poses[owner], scale = spots[owner].scale * BIRD_SCALE;
      // Perched, it looks about now and then; flying, it beats its wings.
      const look = (1 - pose.flying) * Math.sin(t * .7 + b * 2.3) ** 3 * .5;
      writeBird(positions, b, pose, pose.heading + look, scale, pose.flying, Math.sin(t * 26 + b), pose.shown);
    });
    parts.birds.attributes.position.needsUpdate = true;
    parts.birds.computeVertexNormals();
  });

  return <group name="birdhouses">
    <mesh ref={houses} geometry={parts.houses.geometry} material={parts.wood} visible={false} />
    <mesh ref={sign} name="church-st" geometry={parts.sign} material={parts.wood} visible={false} />
    <mesh ref={birds} geometry={parts.birds} material={parts.feathers} visible={false} frustumCulled={false} />
  </group>;
}
