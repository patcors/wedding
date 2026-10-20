// Patrick's and Amelia's boats (owner: boats agent). They are kinematic: where
// they are follows from useJourney().progress through storyBoats.ts, never
// from boatPhysics. Two small sailboats, in separate channels before they
// meet, side by side after, apart while Amelia is in Sydney, then joined into a
// catamaran plank by plank from when they start dating, under one tall mast
// flying their monogram from their engagement, moored at the jetty for the
// celebration. Amelia's is on the left, Patrick's on the right. Each flies
// the mark of the company its sailor works for from an ensign staff at its
// stern, and while they're at university, the university's from the other.
// As they start salsa classes the catamaran turns once on the spot,
// everything aboard with it, and as they get engaged a little man proposes
// to a little woman on its deck (eggs/Proposal.tsx).
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { routeAt } from './journey';
import { CATAMARAN, DECK, boatPose, boatScale, companyFlags, ensignStaffs, rigging, salsaClock, salsaTurn, universityFlag, type Company } from './storyBoats';
import { BIG_RIG, ENSIGN, FLAGS, HULL, LOGO_FLAG, SAIL_EASED, bigRig, blendHullPaint, companyFlagTexture, ensignStaff, ensignStaffGeometry, flagGeometry, flutter, logoFlagGeometry, logoFlagTexture, sharpenFlag, storyHull, storyRig, wakeTexture, type FlagShape } from './storyBoatGeometry';
import { useJourney, type SlotProps } from './JourneyProvider';
import { BOAT_LOOK, catamaranPaint, deckColours, dinghyPaint, type BoatLook } from './boatLooks';
import Proposal from './eggs/Proposal';

const ease = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};
const BOATS = [
  { name: 'amelia-boat', side: -1, owner: 'amelia' },
  { name: 'patrick-boat', side: 1, owner: 'patrick' },
] as const;
// Where the deck's crossbeams and planks lie across the hulls, in model units.
const BEAM_Z = [-.56, .56], PLANK_Z = (i: number) => -.66 + i * .12;
// How far aft each small mast is lowered, to lie along its hull.
const LOWERED = 1.48;
const COMPANIES: Company[] = ['finocomp', 'interim', 'heirwealth'];
// Each flag's mark in public/textures/flags/ (a 512px lossless WebP on
// transparency, from the PNG of the same name in textures/garden/ by
// scripts/compress-flag-marks.mjs) and the shape its cloth is cut to (FLAGS).
// The interim flag, for Amelia's months tutoring and selling haircare, is
// Wavves', a disc like FinoComp's (Amelia, October 2026).
const MARKS: Record<Company, { mark: string; shape: FlagShape }> = {
  finocomp: { mark: 'finocomp-mark.webp', shape: 'circle' },
  interim: { mark: 'wavves-mark.webp', shape: 'circle' },
  heirwealth: { mark: 'heirwealth-crown.webp', shape: 'square' },
};
// The university's flag is its shield.
const UNIVERSITY = { mark: 'uow-shield.webp', shape: 'shield' } as const;
const texture = (mark: string) => `${import.meta.env.BASE_URL}textures/flags/${mark}`;
// Fetched once the boats are built, as before: fetching them with the models
// put their bytes in the way of the scene's and made it ready later (about
// a second on throttled 3G), as nothing waits on them.
// How far a flag runs up its ensign staff, from just clear of the rim to
// the top; and where the monogram's halyard starts, above the big boom.
const staffRun = (shape: FlagShape) => ENSIGN.height - FLAGS[shape].height - .06, LOGO_FOOT = BIG_RIG.boom + .55;

// Disposes every geometry and texture in a set of models.
const dispose = (part: unknown): void => {
  if (!part || typeof part !== 'object') return;
  if ('dispose' in part && typeof part.dispose === 'function') part.dispose();
  else Object.values(part).forEach(dispose);
};

function useStoryBoatModels(look: BoatLook) {
  const models = useMemo(() => {
    const deck = new THREE.BoxGeometry(1, 1, 1);
    return {
      boats: BOATS.map(({ side, owner }) => ({
        hull: storyHull(dinghyPaint(look.dinghy, owner), catamaranPaint(look.catamaran, owner, dinghyPaint(look.dinghy, owner))),
        rig: storyRig(side, look.dinghy, owner),
        // The company's flag flies outboard and the university's inboard,
        // each from its own staff, mirrored where it flies to the left so its mark reads.
        flags: Object.fromEntries(COMPANIES.map(company => [company, flagGeometry(side < 0, MARKS[company].shape)])) as Record<Company, THREE.PlaneGeometry>,
        university: flagGeometry(side > 0, UNIVERSITY.shape),
      })),
      companies: Object.fromEntries(COMPANIES.map(company => [company, companyFlagTexture(texture(MARKS[company].mark), MARKS[company].shape)])) as Record<Company, ReturnType<typeof companyFlagTexture>>,
      university: companyFlagTexture(texture(UNIVERSITY.mark), UNIVERSITY.shape),
      deck, deckColours: deckColours(look.catamaran), staff: ensignStaffGeometry(),
      big: { ...bigRig(look.catamaran), flag: logoFlagGeometry(), banner: logoFlagTexture(`${import.meta.env.BASE_URL}logo.png`) },
      wake: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, .5),
      ripples: wakeTexture(),
    };
  }, [look.dinghy, look.catamaran]);
  useEffect(() => () => dispose(models), [models]);
  return models;
}

export default function VoyageBoats({ paused, reduced, mobile, width, look = BOAT_LOOK }: SlotProps & { look?: BoatLook }) {
  const clock = useJourney();
  const models = useStoryBoatModels(look);
  const pair = useRef<THREE.Group>(null);
  const boats = useRef<(THREE.Group | null)[]>([]);
  const hulls = useRef<(THREE.Mesh | null)[]>([]);
  const rigs = useRef<(THREE.Group | null)[]>([]);
  const sails = useRef<(THREE.Group | null)[]>([]);
  const jibs = useRef<(THREE.Mesh | null)[]>([]);
  const cabins = useRef<(THREE.Mesh | null)[]>([]);
  const bigJib = useRef<THREE.Mesh>(null);
  const wakes = useRef<(THREE.Mesh | null)[]>([]);
  const deck = useRef<THREE.InstancedMesh>(null);
  // Each boat's two ensign staffs, outboard then inboard, in one draw.
  const staffs = useRef<THREE.InstancedMesh>(null);
  const big = useRef<THREE.Group>(null), bigSail = useRef<THREE.Group>(null), bigCloth = useRef<THREE.Mesh>(null);
  const logoFlag = useRef<THREE.Mesh>(null);
  // Each boat's flags, one per company, on the one staff.
  const flags = useRef<Partial<Record<Company, THREE.Mesh | null>>[]>(BOATS.map(() => ({})));
  const universityFlags = useRef<(THREE.Mesh | null)[]>([]);
  const time = useRef(0), last = useRef<number | null>(null), speed = useRef(0);
  // Seconds into the salsa turn (see SALSA), or null before it.
  const salsa = useRef<number | null>(null);
  const rest = useMemo(() => ({
    flags: models.boats.map(({ flags }) => Object.fromEntries(COMPANIES.map(company => [company, Float32Array.from(flags[company].attributes.position.array)])) as Record<Company, Float32Array>),
    university: models.boats.map(({ university }) => Float32Array.from(university.attributes.position.array)),
    logo: Float32Array.from(models.big.flag.attributes.position.array),
  }), [models]);
  const part = useMemo(() => ({ matrix: new THREE.Matrix4(), position: new THREE.Vector3(), rotation: new THREE.Quaternion(), euler: new THREE.Euler(), scale: new THREE.Vector3() }), []);

  // r3f sets the geometry after making the mesh, so the morph influences need setting up.
  useLayoutEffect(() => hulls.current.forEach((hull, i) => {
    hull?.updateMorphTargets();
    if (hull) blendHullPaint(models.boats[i].hull, hull.morphTargetInfluences?.[0] ?? 0);
  }), [models]);
  useLayoutEffect(() => {
    if (!deck.current) return;
    const colour = new THREE.Color(), { beam, planks } = models.deckColours;
    for (let i = 0; i < DECK.beams + DECK.planks; i++) deck.current.setColorAt(i, colour.set(i < DECK.beams ? beam : planks[i % planks.length]));
    deck.current.instanceColor!.needsUpdate = true;
  }, [models]);

  useFrame((_, dt) => {
    if (!pair.current) return;
    const step = Math.min(dt, .05);
    if (!paused) time.current += step;
    const p = clock.progress, t = time.current;
    const pose = boatPose(p, width), { join } = pose, rig = rigging(p, reduced), flying = companyFlags(p, reduced);
    const university = universityFlag(p, reduced), stands = ensignStaffs(p, reduced);
    // How fast they're travelling, for the wakes: none while held or cut between stills.
    const z = routeAt(p);
    const moving = last.current === null || reduced || !step ? 0 : Math.min(1, Math.abs(z - last.current) / step / 3);
    last.current = z;
    speed.current = THREE.MathUtils.damp(speed.current, moving, 3, step);

    // Bobbing together once the crossbeams hold the hulls; each on its own
    // before. The salsa turn spins the whole pair about the hulls' middle, so the
    // rig, flags and deck go round with it; the flags' own turn below keeps
    // to the heading, not the spin.
    const own = 1 - join.rigid;
    salsa.current = salsaClock(salsa.current, p, paused ? 0 : step, reduced);
    const dance = salsaTurn(salsa.current, pose.yaw, width);
    pair.current.scale.setScalar(pose.scale);
    pair.current.position.set(pose.x + dance.shift[0], -.02 + Math.sin(t * 1.5) * .011 * join.rigid + dance.rise * pose.scale, pose.z + dance.shift[1]);
    pair.current.rotation.set(Math.sin(t * 1.2) * .018 * join.rigid, pose.yaw + dance.spin, Math.sin(t * .9) * .022 * join.rigid + dance.heel, 'YXZ');
    BOATS.forEach(({ side }, i) => {
      const boat = boats.current[i], mast = rigs.current[i], wake = wakes.current[i];
      if (!boat || !mast || !wake) return;
      const phase = t + i * 1.7, yaw = side * pose.turn;
      boat.position.set(side * pose.gap, Math.sin(phase * 1.7) * .008 * own, 0);
      boat.rotation.set(Math.sin(phase * 1.4) * .025 * own, yaw, Math.sin(phase * 1.1) * .035 * own);
      boat.updateMatrix();
      const hull = hulls.current[i];
      if (hull?.morphTargetInfluences && hull.morphTargetInfluences[0] !== join.morph) {
        hull.morphTargetInfluences[0] = join.morph;
        blendHullPaint(models.boats[i].hull, join.morph);
      }
      mast.position.z = HULL.mast.dinghy + (HULL.mast.catamaran - HULL.mast.dinghy) * join.morph;
      // Lowered aft about its foot once the sail is furled, to lie along the hull.
      mast.rotation.x = rig.lower * LOWERED;
      // Sheeted in while tied up, at the start and at the dock, clear of the
      // jetties, and rolled into the mast
      // as the big mast's time comes.
      sails.current[i]?.rotation.set(0, side * SAIL_EASED * (1 - .85 * Math.max(pose.docking, pose.berthed)), 0);
      sails.current[i]?.scale.set(1, 1, 1 - .97 * rig.furl);
      // The toy sloop's jib rolls up round its forestay with the main, and
      // its cabin is taken in as the hull grows long and slim.
      jibs.current[i]?.scale.set(1 - .97 * rig.furl, 1, 1 - .97 * rig.furl);
      const cabin = cabins.current[i];
      if (cabin) {
        const keep = Math.max(0, 1 - join.morph * 1.6);
        cabin.visible = keep > 0;
        cabin.scale.setScalar(Math.max(keep, 1e-3));
      }
      // The staffs stand at the stern quarters, aft with the stern as the
      // hull grows long, each stepped up from its foot while it has a flag
      // to carry.
      const [x, top, z] = ensignStaff(side, join.morph), [ix, , iz] = ensignStaff(-side, join.morph);
      if (staffs.current) [[x, z, stands.company], [ix, iz, stands.university]].forEach(([sx, sz, stand], k) => {
        part.position.set(sx, ENSIGN.foot, sz);
        part.scale.set(stand > 0 ? 1 : 0, Math.max(stand, 1e-3), stand > 0 ? 1 : 0);
        part.matrix.compose(part.position, part.rotation.identity(), part.scale).premultiply(boat.matrix);
        staffs.current!.setMatrixAt(i * 2 + k, part.matrix);
      });
      // The company's flag runs up the outboard staff, and down again as the
      // sail furls for the change of masts. The flags fly outwards whichever
      // way the boats turn, so both marks face the camera: Amelia's to the
      // left, Patrick's to the right.
      const { company, hoist } = flying[i];
      for (const name of COMPANIES) {
        const flag = flags.current[i][name];
        if (!flag) continue;
        flag.visible = company === name;
        flag.position.set(x, top - (1 - hoist) * staffRun(MARKS[name].shape), z);
        flag.rotation.y = (side < 0 ? Math.PI : 0) - pose.yaw - yaw;
      }
      if (company) flutter(models.boats[i].flags[company], rest.flags[i][company], FLAGS[MARKS[company].shape].length, t, i * 2);
      // The university's runs up the same way on the inboard staff.
      const cloth = universityFlags.current[i];
      if (cloth) {
        cloth.visible = university > 0;
        cloth.position.set(ix, top - (1 - university) * staffRun(UNIVERSITY.shape), iz);
        cloth.rotation.y = (side > 0 ? Math.PI : 0) - pose.yaw - yaw;
        if (cloth.visible) flutter(models.boats[i].university, rest.university[i], FLAGS[UNIVERSITY.shape].length, t, i * 2 + 1);
      }
      wake.position.z = HULL.stern.dinghy + (HULL.stern.catamaran - HULL.stern.dinghy) * join.morph - .05;
      (wake.material as THREE.MeshBasicMaterial).opacity = .55 * speed.current;
      wake.visible = speed.current > .01;
    });
    if (staffs.current) {
      staffs.current.visible = stands.company > 0 || stands.university > 0;
      staffs.current.instanceMatrix.needsUpdate = true;
    }

    // The big mast grows up out of the deck, its boom with it, then its sail
    // unrolls from the mast along the boom.
    if (big.current && bigSail.current && bigCloth.current) {
      big.current.visible = rig.raise > 0;
      big.current.scale.set(1, Math.max(rig.raise, 1e-3), 1);
      bigSail.current.rotation.y = -BIG_RIG.eased * (1 - .25 * pose.docking);
      bigCloth.current.scale.z = Math.max(rig.unfurl, .03);
      const jib = Math.max(rig.unfurl, .03);
      bigJib.current?.scale.set(jib, 1, jib);
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
      part.position.set(0, (beam ? .17 : .215) + (1 - settle) * .4, beam ? BEAM_Z[i] : PLANK_Z(i - DECK.beams));
      part.rotation.setFromEuler(part.euler.set((1 - settle) * .25, 0, (1 - settle) * (i % 2 ? .3 : -.3)));
      const size = k > 0 ? .75 + settle * .25 : 0;
      part.scale.set((CATAMARAN * 2 + (beam ? .2 : .14)) * size, (beam ? .05 : .028) * size, (beam ? .07 : .1) * size);
      deck.current!.setMatrixAt(i, part.matrix.compose(part.position, part.rotation, part.scale));
    });
    deck.current.instanceMatrix.needsUpdate = true;
  });

  // Keyed by look, so a new look's materials are built afresh for its maps.
  return <group key={`${look.dinghy}-${look.catamaran}`} ref={pair} name="voyage-boats" scale={boatScale(width)}>
    {BOATS.map(({ name }, i) => <group key={name} name={name} ref={el => { boats.current[i] = el; }}>
      <mesh ref={el => { hulls.current[i] = el; }} geometry={models.boats[i].hull} castShadow>
        <meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={1} />
      </mesh>
      <group ref={el => { rigs.current[i] = el; }}>
        <mesh geometry={models.boats[i].rig.mast} castShadow>
          <meshStandardMaterial vertexColors roughness={1} />
        </mesh>
        <group ref={el => { sails.current[i] = el; }}>
          <mesh geometry={models.boats[i].rig.spars} castShadow>
            <meshStandardMaterial vertexColors roughness={1} />
          </mesh>
          <mesh geometry={models.boats[i].rig.cloth} castShadow>
            <meshStandardMaterial vertexColors map={models.boats[i].rig.map} side={THREE.DoubleSide} roughness={1} />
          </mesh>
        </group>
        {models.boats[i].rig.jib && <group position={models.boats[i].rig.jib!.position} quaternion={models.boats[i].rig.jib!.quaternion}>
          <mesh ref={el => { jibs.current[i] = el; }} geometry={models.boats[i].rig.jib!.geometry} castShadow>
            <meshStandardMaterial vertexColors map={models.boats[i].rig.jib!.map} side={THREE.DoubleSide} roughness={1} />
          </mesh>
        </group>}
      </group>
      {COMPANIES.map(company => <mesh key={company} ref={el => { flags.current[i][company] = el; }} geometry={models.boats[i].flags[company]} visible={false}>
        <meshStandardMaterial {...models.companies[company]} alphaTest={.5} alphaToCoverage onBeforeCompile={sharpenFlag} side={THREE.DoubleSide} roughness={1} />
      </mesh>)}
      <mesh ref={el => { universityFlags.current[i] = el; }} geometry={models.boats[i].university} visible={false}>
        <meshStandardMaterial {...models.university} alphaTest={.5} alphaToCoverage onBeforeCompile={sharpenFlag} side={THREE.DoubleSide} roughness={1} />
      </mesh>
      {models.boats[i].rig.cabin && <mesh ref={el => { cabins.current[i] = el; }} geometry={models.boats[i].rig.cabin!.geometry} position-z={models.boats[i].rig.cabin!.z} castShadow>
        <meshStandardMaterial vertexColors roughness={.8} />
      </mesh>}
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
          <meshStandardMaterial vertexColors map={models.big.map} side={THREE.DoubleSide} roughness={1} />
        </mesh>
      </group>
      {models.big.jib && <group position={models.big.jib.position} quaternion={models.big.jib.quaternion}>
        <mesh ref={bigJib} geometry={models.big.jib.geometry} castShadow>
          <meshStandardMaterial vertexColors map={models.big.jib.map} side={THREE.DoubleSide} roughness={1} />
        </mesh>
      </group>}
      {models.big.bow && <mesh geometry={models.big.bow} castShadow>
        <meshStandardMaterial vertexColors roughness={.6} />
      </mesh>}
      {models.big.cabin && <mesh geometry={models.big.cabin} castShadow>
        <meshStandardMaterial vertexColors roughness={.7} />
      </mesh>}
      <mesh ref={logoFlag} geometry={models.big.flag} visible={false}>
        <meshStandardMaterial map={models.big.banner} side={THREE.DoubleSide} roughness={1} />
      </mesh>
    </group>
    <instancedMesh ref={staffs} name="flag-staffs" args={[models.staff, undefined, BOATS.length * 2]} frustumCulled={false} visible={false}>
      <meshStandardMaterial vertexColors roughness={1} />
    </instancedMesh>
    <instancedMesh ref={deck} name="deck" args={[models.deck, undefined, DECK.beams + DECK.planks]} castShadow frustumCulled={false}>
      <meshStandardMaterial roughness={1} />
    </instancedMesh>
    <Proposal paused={paused} reduced={reduced} mobile={mobile} />
  </group>;
}
