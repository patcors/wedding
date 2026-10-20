// Stones, grass and flowers along the banks: the original Review variants and
// the flowers every variant keeps.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { riverCenter, bankEdge, groundHeight, leafGeometry, random, voyageClearing, RIVER_REACH } from './gardenGeometry';
import { ROCK_COUNT } from './GardenRocks';
import { pieBedFootprint } from './eggs/careerSpots';
import { truckFootprint } from './eggs/engagementTruck';
import type { RockStyle } from './GardenGround';
import type { PlantStyle } from './gardenPlantGeometry';
import { seasonalFlowers } from './GardenSeasons';

// The original counts covered about 126 units of river; these keep that density.
const LENGTH = RIVER_REACH.from - RIVER_REACH.to;
const GRASSES = Math.round(7000 * LENGTH / 126 / 20) * 20, FLOWERS = Math.round(1500 * LENGTH / 98 / 5) * 5;

export default function GardenBankDetails({ width, rockStyle, plantStyle }: { width: number; rockStyle: RockStyle; plantStyle: PlantStyle }) {
  const stones = useRef<THREE.InstancedMesh>(null);
  const grasses = useRef<THREE.InstancedMesh>(null);
  const flowers = useRef<THREE.InstancedMesh>(null);
  const stone = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(1, 2), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const k = 1 + Math.sin(x * 8 + y * 4 + z * 7) * .13;
      p.setXYZ(i, x * k, y * k, z * k);
    }
    g.deleteAttribute('normal'); g.deleteAttribute('uv');
    const smooth = mergeVertices(g); smooth.computeVertexNormals(); g.dispose(); return smooth;
  }, []);
  const blade = useMemo(() => {
    const g = new THREE.PlaneGeometry(.05, 1, 1, 4), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) + .5;
      p.setXYZ(i, p.getX(i) * (1 - y * .85), y, y * y * .28);
    }
    g.computeVertexNormals(); return g;
  }, []);
  const petal = useMemo(() => leafGeometry(true), []);
  // In spring the flowers grow and take their clump's colour (GardenSeasons.tsx).
  const flowerMaterial = useMemo(() => {
    const material = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: .8 });
    material.onBeforeCompile = seasonalFlowers;
    material.customProgramCacheKey = () => 'garden-bank-flowers-seasons-v1';
    return material;
  }, []);
  useEffect(() => () => flowerMaterial.dispose(), [flowerMaterial]);
  useLayoutEffect(() => {
    const rand = random(319), dummy = new THREE.Object3D(), color = new THREE.Color(), underBed = pieBedFootprint(width), underTruck = truckFootprint(width);
    // The same sites as the moss rocks in GardenRocks, compared in Review,
    // and kept out of the pie chart's flower bed and from under the
    // engagement's truck as they are; no grass or flowers grow through the truck.
    for (let i = 0; i < ROCK_COUNT; i++) {
      const z = RIVER_REACH.from - rand() * (RIVER_REACH.from - RIVER_REACH.to), x = riverCenter(z, width) + (bankEdge(z, width) + rand() * 3.4) * (i % 2 ? 1 : -1);
      dummy.position.set(x, groundHeight(x, z, width) - .04, z);
      dummy.rotation.set(rand(), rand() * 6, rand());
      let s = voyageClearing(x, z, width, .4) ? 0 : .1 + Math.pow(rand(), 3) * .55;
      if (underBed(x, z, s * 1.4) || underTruck(x, z, s * 1.4)) s = 0;
      dummy.scale.set(s * 1.4, s * .5, s);
      dummy.updateMatrix(); stones.current?.setMatrixAt(i, dummy.matrix);
      color.setHSL(.12, .08, .48 + rand() * .2); stones.current?.setColorAt(i, color);
    }
    for (let i = 0; i < GRASSES; i++) {
      const cluster = Math.floor(i / 20), r = random(cluster * 91 + 31);
      const z = RIVER_REACH.from - r() * (RIVER_REACH.from - RIVER_REACH.to), x = riverCenter(z, width) + (bankEdge(z, width) + .5 + r() * 4) * (cluster % 2 ? 1 : -1);
      const px = x + (rand() - .5) * .9, pz = z + (rand() - .5) * .9;
      dummy.position.set(px, groundHeight(px, pz, width) - .02, pz);
      dummy.rotation.set((rand() - .5) * .3, rand() * 6.28, (rand() - .5) * .5);
      const size = .25 + rand() * .48;
      dummy.scale.setScalar(underTruck(px, pz, .2) ? 0 : size);
      dummy.updateMatrix(); grasses.current?.setMatrixAt(i, dummy.matrix);
      color.setHSL(.18 + rand() * .08, .16, .30 + rand() * .20); grasses.current?.setColorAt(i, color);
    }
    for (let i = 0; i < FLOWERS; i++) {
      const cluster = Math.floor(i / 5), r = random(cluster * 79 + 16);
      const z = RIVER_REACH.from - 2 - r() * (RIVER_REACH.from - RIVER_REACH.to - 4), x = riverCenter(z, width) + (bankEdge(z, width) + .8 + r() * 2.6) * (cluster % 2 ? 1 : -1);
      const angle = i % 5 / 5 * Math.PI * 2;
      dummy.position.set(x, groundHeight(x, z, width) + .18 + r() * .2, z);
      dummy.rotation.set(-Math.PI / 2 + .4, angle, angle);
      // Flowers that would grow through the jetty or the old tree's trunk are left out.
      dummy.scale.setScalar(voyageClearing(x, z, width, .2) || underTruck(x, z, .2) ? 0 : .11); dummy.updateMatrix(); flowers.current!.setMatrixAt(i, dummy.matrix);
      color.set(cluster % 3 ? '#ece6cc' : '#d6a6a0'); flowers.current!.setColorAt(i, color);
    }
    [stones, grasses, flowers].forEach(ref => {
      if (!ref.current) return;
      ref.current.instanceMatrix.needsUpdate = true;
      if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
      ref.current.computeBoundingSphere();
    });
  }, [width, rockStyle, plantStyle]);
  return <>
    {/* Review-only variants are left out entirely rather than hidden, so
        guests' phones never build or shadow them. */}
    {rockStyle === 'original' && <instancedMesh name="garden-original-rocks" ref={stones} args={[stone, undefined, ROCK_COUNT]} castShadow receiveShadow>
      <meshStandardMaterial color="#b4b29b" roughness={.95} />
    </instancedMesh>}
    {plantStyle === 'original' && <instancedMesh name="garden-original-grass" ref={grasses} args={[blade, undefined, GRASSES]}>
      <meshStandardMaterial color="#6d7954" side={THREE.DoubleSide} roughness={1} />
    </instancedMesh>}
    <instancedMesh name="garden-bank-flowers" ref={flowers} args={[petal, flowerMaterial, FLOWERS]} />
  </>;
}

