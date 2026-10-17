// Patrick's and Amelia's boats (owner: boats agent). They are kinematic: where
// they are follows from useJourney().progress through storyBoats.ts, never
// from boatPhysics. Two wooden sailboats, in separate channels before they
// meet, side by side after, apart while Amelia is in Sydney, then joined into a
// catamaran plank by plank from when they start dating, under one tall mast
// flying their monogram from their engagement, moored at the jetty for the
// celebration. Amelia's is on the left, Patrick's on the right. Each small
// masthead flies the mark of the company its sailor works for.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { routeAt } from './journey';
import { BOAT_SCALE, CATAMARAN, DECK, boatPose, companyFlags, rigging, type Company } from './storyBoats';
import { BIG_RIG, FLAG, HULL, LOGO_FLAG, SAIL_EASED, STORY_PALETTES, bigRig, companyFlagTexture, flagGeometry, flutter, logoFlagGeometry, logoFlagTexture, storyHull, storyRig, wakeTexture } from './storyBoatGeometry';
import { useJourney, type SlotProps } from './JourneyProvider';

const ease = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};
const BOATS = [
  { name: 'amelia-boat', side: -1, palette: STORY_PALETTES.amelia },
  { name: 'patrick-boat', side: 1, palette: STORY_PALETTES.patrick },
] as const;
// Where the deck's crossbeams and planks lie across the hulls, in model units.
const BEAM_Z = [-.56, .56], PLANK_Z = (i: number) => -.66 + i * .12;
const DECK_COLOURS = ['#c99f65', '#d3ad76', '#bd9058', '#cfa66c'];
// How far aft each small mast is lowered, to lie along its hull.
const LOWERED = 1.48;
const COMPANIES: Company[] = ['finocomp', 'interim', 'heirwealth'];
// Each flag's mark in public/textures/garden/ (a small PNG on transparency).
// The interim flag, for Amelia's months tutoring and selling haircare, is
// plain paper until she sends their logos: name one here, or for two, add a
// company to Company and a change to Amelia's FLAG_CHANGES in storyBoats.ts.
const MARKS: Record<Company, string | null> = { finocomp: 'finocomp-mark.png', interim: null, heirwealth: 'heirwealth-crown.png' };
// Where the flags' halyards start, above the booms, on the small masts and the big one.
const FLAG_FOOT = .4, LOGO_FOOT = BIG_RIG.boom + .55;

function useStoryBoatModels() {
  const models = useMemo(() => {
    const deck = new THREE.BoxGeometry(1, 1, 1);
    return {
      boats: BOATS.map(({ side, palette }) => ({
        hull: storyHull(palette), rig: storyRig(side),
        flag: flagGeometry(side < 0),
      })),
      companies: Object.fromEntries(COMPANIES.map(company => [company, companyFlagTexture(MARKS[company] && `${import.meta.env.BASE_URL}textures/garden/${MARKS[company]}`)])) as Record<Company, THREE.CanvasTexture>,
      deck,
      big: { ...bigRig(), flag: logoFlagGeometry(), banner: logoFlagTexture(`${import.meta.env.BASE_URL}logo.png`) },
      wake: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, .5),
      ripples: wakeTexture(),
    };
  }, []);
  useEffect(() => () => {
    models.boats.forEach(({ hull, rig, flag }) => { hull.dispose(); rig.mast.dispose(); rig.sheet.dispose(); flag.dispose(); });
    Object.values(models.companies).forEach(cloth => cloth.dispose());
    Object.values(models.big).forEach(part => part.dispose());
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
  const sails = useRef<(THREE.Mesh | null)[]>([]);
  const wakes = useRef<(THREE.Mesh | null)[]>([]);
  const deck = useRef<THREE.InstancedMesh>(null);
  const big = useRef<THREE.Group>(null), bigSail = useRef<THREE.Group>(null), bigCloth = useRef<THREE.Mesh>(null);
  const logoFlag = useRef<THREE.Mesh>(null);
  // Each boat's flags, one per company, on the one halyard.
  const flags = useRef<Partial<Record<Company, THREE.Mesh | null>>[]>(BOATS.map(() => ({})));
  const time = useRef(0), last = useRef<number | null>(null), speed = useRef(0);
  const rest = useMemo(() => ({
    flags: models.boats.map(({ flag }) => Float32Array.from(flag.attributes.position.array)),
    logo: Float32Array.from(models.big.flag.attributes.position.array),
  }), [models]);
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
    const pose = boatPose(p, width), { join } = pose, rig = rigging(p, reduced), flying = companyFlags(p, reduced);
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
      const boat = boats.current[i], mast = rigs.current[i], wake = wakes.current[i];
      if (!boat || !mast || !wake) return;
      const phase = t + i * 1.7, yaw = side * pose.turn;
      boat.position.set(side * pose.gap, Math.sin(phase * 1.7) * .008 * own, 0);
      boat.rotation.set(Math.sin(phase * 1.4) * .025 * own, yaw, Math.sin(phase * 1.1) * .035 * own);
      const hull = hulls.current[i];
      if (hull?.morphTargetInfluences) hull.morphTargetInfluences[0] = join.morph;
      mast.position.z = HULL.mast.dinghy + (HULL.mast.catamaran - HULL.mast.dinghy) * join.morph;
      // Lowered aft about its foot once the sail is furled, to lie along the hull.
      mast.rotation.x = rig.lower * LOWERED;
      // Sheeted in while tied up, at the start and at the dock, clear of the
      // jetties, and rolled into the mast
      // as the big mast's time comes.
      sails.current[i]?.rotation.set(0, side * SAIL_EASED * (1 - .85 * Math.max(pose.docking, pose.berthed)), 0);
      sails.current[i]?.scale.set(1, 1, 1 - .97 * rig.furl);
      // The company's flag runs up its halyard to the masthead, and down
      // again as the sail furls for the change of masts. The flags fly
      // outwards whichever way the boats turn, so both marks face the camera:
      // Amelia's to the left, Patrick's to the right.
      const { company, hoist } = flying[i];
      for (const name of COMPANIES) {
        const flag = flags.current[i][name];
        if (!flag) continue;
        flag.visible = company === name;
        flag.position.y = -(1 - hoist) * (HULL.mastTop - FLAG_FOOT);
        flag.rotation.y = (side < 0 ? Math.PI : 0) - pose.yaw - yaw;
      }
      if (company) flutter(models.boats[i].flag, rest.flags[i], FLAG.length, t, i * 2);
      wake.position.z = HULL.stern.dinghy + (HULL.stern.catamaran - HULL.stern.dinghy) * join.morph - .05;
      (wake.material as THREE.MeshBasicMaterial).opacity = .55 * speed.current;
      wake.visible = speed.current > .01;
    });

    // The big mast grows up out of the deck, its boom with it, then its sail
    // unrolls from the mast along the boom.
    if (big.current && bigSail.current && bigCloth.current) {
      big.current.visible = rig.raise > 0;
      big.current.scale.set(1, Math.max(rig.raise, 1e-3), 1);
      bigSail.current.rotation.y = -BIG_RIG.eased * (1 - .25 * pose.docking);
      bigCloth.current.scale.z = Math.max(rig.unfurl, .03);
    }
    // Then their monogram is run up from above the boom to the masthead,
    // flying to starboard, clear of the sail, gently as it's larger.
    if (logoFlag.current) {
      logoFlag.current.visible = rig.hoist > 0;
      logoFlag.current.position.y = BIG_RIG.top - .01 - (1 - rig.hoist) * (BIG_RIG.top - LOGO_FOOT);
      logoFlag.current.rotation.y = -pose.yaw;
      if (rig.hoist > 0) flutter(models.big.flag, rest.logo, LOGO_FLAG.length, t * .8, 1, 1.3);
    }

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
        {COMPANIES.map(company => <mesh key={company} ref={el => { flags.current[i][company] = el; }} geometry={models.boats[i].flag} visible={false}>
          <meshStandardMaterial map={models.companies[company]} side={THREE.DoubleSide} roughness={1} />
        </mesh>)}
      </group>
      <mesh ref={el => { wakes.current[i] = el; }} geometry={models.wake} position-y={.025} scale={[1.3, 1, 2]} visible={false}>
        <meshBasicMaterial map={models.ripples} color="#f7f0d8" transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>)}
    <group ref={big} name="big-mast" position={[0, BIG_RIG.deck, BIG_RIG.z]} visible={false}>
      <mesh geometry={models.big.mast} castShadow>
        <meshStandardMaterial vertexColors roughness={1} />
      </mesh>
      <group ref={bigSail}>
        <mesh geometry={models.big.boom} castShadow>
          <meshStandardMaterial vertexColors roughness={1} />
        </mesh>
        <mesh ref={bigCloth} geometry={models.big.cloth} castShadow>
          <meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={1} />
        </mesh>
      </group>
      <mesh ref={logoFlag} geometry={models.big.flag} visible={false}>
        <meshStandardMaterial map={models.big.banner} side={THREE.DoubleSide} roughness={1} />
      </mesh>
    </group>
    <instancedMesh ref={deck} args={[models.deck, undefined, DECK.beams + DECK.planks]} castShadow frustumCulled={false}>
      <meshStandardMaterial roughness={1} />
    </instancedMesh>
  </group>;
}
