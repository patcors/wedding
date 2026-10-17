// Patrick's and Amelia's boats (owner: boats agent). They are kinematic: where
// they are follows from useJourney().progress through storyBoats.ts, never
// from boatPhysics. Two wooden sailboats, in separate channels before they
// meet, side by side after, apart while Amelia is in Sydney, then joined into a
// catamaran plank by plank from when they start dating, moored at the jetty
// for the celebration. Amelia's is on the left, Patrick's on the right.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { routeAt } from './journey';
import { BOAT_SCALE, CATAMARAN, DECK, boatPose } from './storyBoats';
import { FLAG, HULL, SAIL_EASED, STORY_PALETTES, flagGeometry, flagTexture, storyHull, storyRig, wakeTexture } from './storyBoatGeometry';
import { useJourney, type SlotProps } from './JourneyProvider';

const ease = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};
const BOATS = [
  { name: 'amelia-boat', side: -1, palette: STORY_PALETTES.amelia, letter: 'A' },
  { name: 'patrick-boat', side: 1, palette: STORY_PALETTES.patrick, letter: 'P' },
] as const;
// Where the deck's crossbeams and planks lie across the hulls, in model units.
const BEAM_Z = [-.56, .56], PLANK_Z = (i: number) => -.66 + i * .12;
const DECK_COLOURS = ['#c99f65', '#d3ad76', '#bd9058', '#cfa66c'];

function useStoryBoatModels() {
  const models = useMemo(() => {
    const deck = new THREE.BoxGeometry(1, 1, 1);
    return {
      boats: BOATS.map(({ side, palette, letter }) => ({
        hull: storyHull(palette), rig: storyRig(side),
        flag: flagGeometry(side < 0), cloth: flagTexture(letter, palette),
      })),
      deck,
      wake: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, .5),
      ripples: wakeTexture(),
    };
  }, []);
  useEffect(() => () => {
    models.boats.forEach(({ hull, rig, flag, cloth }) => { hull.dispose(); rig.mast.dispose(); rig.sheet.dispose(); flag.dispose(); cloth.dispose(); });
    models.deck.dispose(); models.wake.dispose(); models.ripples.dispose();
  }, [models]);
  return models;
}

export default function VoyageBoats({ paused, reduced, width }: SlotProps) {
  const clock = useJourney();
  const models = useStoryBoatModels();
  const pair = useRef<THREE.Group>(null);
  const boats = useRef<(THREE.Group | null)[]>([]);
  const hulls = useRef<(THREE.Mesh | null)[]>([]);
  const rigs = useRef<(THREE.Group | null)[]>([]);
  const flags = useRef<(THREE.Mesh | null)[]>([]);
  const sails = useRef<(THREE.Mesh | null)[]>([]);
  const wakes = useRef<(THREE.Mesh | null)[]>([]);
  const deck = useRef<THREE.InstancedMesh>(null);
  const time = useRef(0), last = useRef<number | null>(null), speed = useRef(0);
  const flagRest = useMemo(() => models.boats.map(({ flag }) => Float32Array.from(flag.attributes.position.array)), [models]);
  const plank = useMemo(() => ({ matrix: new THREE.Matrix4(), position: new THREE.Vector3(), rotation: new THREE.Quaternion(), euler: new THREE.Euler(), scale: new THREE.Vector3() }), []);

  // r3f sets the geometry after making the mesh, so the morph influences need setting up.
  useLayoutEffect(() => hulls.current.forEach(hull => hull?.updateMorphTargets()), [models]);
  useLayoutEffect(() => {
    if (!deck.current) return;
    const colour = new THREE.Color();
    for (let i = 0; i < DECK.beams + DECK.planks; i++) deck.current.setColorAt(i, colour.set(DECK_COLOURS[i < DECK.beams ? 2 : i % DECK_COLOURS.length]));
    deck.current.instanceColor!.needsUpdate = true;
  }, [models]);

  useFrame((_, dt) => {
    if (!pair.current) return;
    const step = Math.min(dt, .05);
    if (!paused) time.current += step;
    const p = clock.progress, t = time.current;
    const pose = boatPose(p, width), { join } = pose;
    // How fast they're travelling, for the wakes: none while held or cut between stills.
    const z = routeAt(p);
    const moving = last.current === null || reduced || !step ? 0 : Math.min(1, Math.abs(z - last.current) / step / 3);
    last.current = z;
    speed.current = THREE.MathUtils.damp(speed.current, moving, 3, step);

    // Bobbing together once the crossbeams hold the hulls; each on its own before.
    const own = 1 - join.rigid;
    pair.current.position.set(pose.x, -.02 + Math.sin(t * 1.5) * .011 * join.rigid, pose.z);
    pair.current.rotation.set(Math.sin(t * 1.2) * .018 * join.rigid, pose.yaw, Math.sin(t * .9) * .022 * join.rigid);
    BOATS.forEach(({ side }, i) => {
      const boat = boats.current[i], rig = rigs.current[i], flag = flags.current[i], wake = wakes.current[i];
      if (!boat || !rig || !flag || !wake) return;
      const phase = t + i * 1.7, yaw = side * pose.turn;
      boat.position.set(side * pose.gap, Math.sin(phase * 1.7) * .008 * own, 0);
      boat.rotation.set(Math.sin(phase * 1.4) * .025 * own, yaw, Math.sin(phase * 1.1) * .035 * own);
      const hull = hulls.current[i];
      if (hull?.morphTargetInfluences) hull.morphTargetInfluences[0] = join.morph;
      rig.position.z = HULL.mast.dinghy + (HULL.mast.catamaran - HULL.mast.dinghy) * join.morph;
      // Sheeted in at the mooring, clear of the jetty.
      sails.current[i]?.rotation.set(0, side * SAIL_EASED * (1 - .85 * pose.docking), 0);
      // The flags fly outwards whichever way the boats turn, so both initials
      // face the camera: Amelia's to the left, Patrick's to the right.
      flag.rotation.y = (side < 0 ? Math.PI : 0) - pose.yaw - yaw;
      const cloth = flag.geometry.attributes.position as THREE.BufferAttribute, rest = flagRest[i];
      for (let v = 0; v < cloth.count; v++) {
        const u = rest[v * 3] / FLAG.length;
        cloth.setZ(v, Math.sin(u * 5 - t * 5.5 + i * 2) * .028 * u + Math.sin(u * 3 - t * 3.1) * .01 * u);
        cloth.setY(v, rest[v * 3 + 1] - u * u * .015);
      }
      cloth.needsUpdate = true;
      flag.geometry.computeVertexNormals();
      wake.position.z = HULL.stern.dinghy + (HULL.stern.catamaran - HULL.stern.dinghy) * join.morph - .05;
      (wake.material as THREE.MeshBasicMaterial).opacity = .55 * speed.current;
      wake.visible = speed.current > .01;
    });

    // Crossbeams first, then the planks one by one, each lowered into place.
    if (!deck.current) return;
    const laid = [...join.beams, ...join.planks];
    laid.forEach((laying, i) => {
      // A still never catches a plank in mid-air.
      const k = reduced ? Math.round(laying) : laying;
      const beam = i < DECK.beams, settle = ease(k);
      plank.position.set(0, (beam ? .17 : .215) + (1 - settle) * .4, beam ? BEAM_Z[i] : PLANK_Z(i - DECK.beams));
      plank.rotation.setFromEuler(plank.euler.set((1 - settle) * .25, 0, (1 - settle) * (i % 2 ? .3 : -.3)));
      const size = k > 0 ? .75 + settle * .25 : 0;
      plank.scale.set((CATAMARAN * 2 + (beam ? .2 : .14)) * size, (beam ? .05 : .028) * size, (beam ? .07 : .1) * size);
      deck.current!.setMatrixAt(i, plank.matrix.compose(plank.position, plank.rotation, plank.scale));
    });
    deck.current.instanceMatrix.needsUpdate = true;
  });

  return <group ref={pair} name="voyage-boats" scale={BOAT_SCALE}>
    {BOATS.map(({ name }, i) => <group key={name} name={name} ref={el => { boats.current[i] = el; }}>
      <mesh ref={el => { hulls.current[i] = el; }} geometry={models.boats[i].hull} castShadow>
        <meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={1} />
      </mesh>
      <group ref={el => { rigs.current[i] = el; }}>
        <mesh geometry={models.boats[i].rig.mast} castShadow>
          <meshStandardMaterial vertexColors roughness={1} />
        </mesh>
        <mesh ref={el => { sails.current[i] = el; }} geometry={models.boats[i].rig.sheet} castShadow>
          <meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={1} />
        </mesh>
        <mesh ref={el => { flags.current[i] = el; }} geometry={models.boats[i].flag}>
          <meshStandardMaterial map={models.boats[i].cloth} side={THREE.DoubleSide} roughness={1} />
        </mesh>
      </group>
      <mesh ref={el => { wakes.current[i] = el; }} geometry={models.wake} position-y={.025} scale={[1.3, 1, 2]} visible={false}>
        <meshBasicMaterial map={models.ripples} color="#f7f0d8" transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>)}
    <instancedMesh ref={deck} args={[models.deck, undefined, DECK.beams + DECK.planks]} castShadow frustumCulled={false}>
      <meshStandardMaterial roughness={1} />
    </instancedMesh>
  </group>;
}
