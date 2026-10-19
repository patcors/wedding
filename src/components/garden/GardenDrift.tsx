// Petals drifting in the air and leaves falling beside the banks, all the way
// down the river to the dock.
import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { riverCenter, bankEdge, leafGeometry, random } from './gardenGeometry';
import { ROUTE } from './journey';
import { useJourney } from './JourneyProvider';
import { currentSeason } from './GardenSeasons';
import { leafColour, petalColour, petalShown } from './seasons';

// The season (seasons.ts) turns a few of the leaves gold and amber in autumn
// and the petals to blossom in spring, and thins the petals a little through
// autumn and winter. No more of either, so nothing drifts across an egg.
type Seasonal = { seasons?: boolean };

// From the opening to a little past the dock. The originals covered 90 and 64 units.
const DRIFT_LENGTH = 13 - ROUTE.dock + 20;

export function Petals({ paused, width, seasons = false }: { paused: boolean; width: number } & Seasonal) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const material = useRef<THREE.MeshStandardMaterial>(null);
  const clock = useJourney();
  const geometry = useMemo(() => leafGeometry(true), []);
  const time = useRef(0);
  const data = useMemo(() => {
    const rand = random(72);
    return Array.from({ length: Math.round(45 * DRIFT_LENGTH / 90) }, () => {
      const x = (rand() - .5) * 26, y = 1 + rand() * 13, z = 13 - rand() * DRIFT_LENGTH;
      return { x: x + riverCenter(z, width), y, z, phase: rand() * 6.28, size: .1 + rand() * .18, speed: .2 + rand() * .4 };
    });
  }, [width]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame((_, dt) => {
    if (!ref.current) return;
    if (!paused) time.current += Math.min(dt, .05);
    const season = currentSeason(clock.progress, seasons);
    material.current?.color.setRGB(...petalColour(season), THREE.SRGBColorSpace);
    data.forEach((p, i) => {
      const t = time.current * p.speed;
      dummy.position.set(p.x + Math.sin(t * .4 + p.phase) * 1.8, p.y + Math.sin(t * .7 + p.phase) * .65, p.z + Math.cos(t * .3 + p.phase));
      dummy.rotation.set(t * .7 + p.phase, t * .4, Math.sin(t + p.phase) * .8);
      dummy.scale.setScalar(p.size * petalShown(i, data.length, season)); dummy.updateMatrix(); ref.current!.setMatrixAt(i, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[geometry, undefined, data.length]} frustumCulled={false}>
    <meshStandardMaterial ref={material} color="#c88889" side={THREE.DoubleSide} roughness={.65} />
  </instancedMesh>;
}

export function FallingLeaves({ paused, width, seasons = false }: { paused: boolean; width: number } & Seasonal) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const clock = useJourney();
  const painted = useRef<ReturnType<typeof currentSeason> | null>(null);
  const geometry = useMemo(() => leafGeometry(), []);
  const time = useRef(0);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const leaves = useMemo(() => {
    const rand = random(3198);
    return Array.from({ length: Math.round(18 * DRIFT_LENGTH / 64) }, (_, i) => {
      const z = 19 - rand() * DRIFT_LENGTH;
      return { x: riverCenter(z, width) + (bankEdge(z, width) + .3 + rand() * 1.8) * (i % 2 ? 1 : -1), z,
        phase: rand() * 11, speed: .20 + rand() * .22, size: .16 + rand() * .13 };
    });
  }, [width]);
  const colour = useMemo(() => new THREE.Color(), []);
  // Repainted only when the season has moved enough to see.
  const paint = (season: ReturnType<typeof currentSeason>) => {
    leaves.forEach((_, i) => ref.current!.setColorAt(i, colour.setRGB(...leafColour(i, season), THREE.SRGBColorSpace)));
    if (ref.current?.instanceColor) ref.current.instanceColor.needsUpdate = true;
    painted.current = season;
  };
  // Painted before the first frame, so the shader is built with instance colours.
  useLayoutEffect(() => paint(currentSeason(clock.progress, seasons)), [leaves]);
  useFrame((_, dt) => {
    if (!ref.current) return;
    if (!paused) time.current += Math.min(dt, .05);
    const season = currentSeason(clock.progress, seasons), last = painted.current;
    const moved = last ? Math.abs(season.turn - last.turn) + Math.abs(season.fresh - last.fresh) : 1;
    // Settles exactly on the seasons' plain colours when they come back.
    if (moved > .01 || (moved > 0 && season.turn + season.fresh === 0)) paint(season);
    leaves.forEach((leaf, i) => {
      const t = time.current, height = 11 - (t * leaf.speed + leaf.phase) % 11;
      dummy.position.set(leaf.x + Math.sin(t * .35 + leaf.phase) * .5, .3 + height,
        leaf.z + Math.cos(t * .21 + leaf.phase) * .6);
      dummy.rotation.set(.6 + Math.sin(t * .7 + leaf.phase), t * .3 + leaf.phase, Math.sin(t * .4 + leaf.phase) * .65);
      // Fade at both ends of the fall so respawning never pops into view.
      dummy.scale.setScalar(leaf.size * Math.min(1, height * 2, (11 - height) * 2));
      dummy.updateMatrix(); ref.current!.setMatrixAt(i, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh name="falling-leaves" ref={ref} args={[geometry, undefined, leaves.length]} frustumCulled={false}>
    <meshStandardMaterial side={THREE.DoubleSide} roughness={.9} />
  </instancedMesh>;
}
