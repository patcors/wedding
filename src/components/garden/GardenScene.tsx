// PROTOTYPE: a short, self-contained garden composition, not the production story.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { GARDEN_CAMERA, MOBILE_RIVER_WIDTH, riverCenter, bankEdge, groundHeight, leafGeometry, random } from './gardenGeometry';
import GardenTrees from './GardenTrees';
import GardenGround, { type GroundStyle, type RockStyle } from './GardenGround';
import GardenRocks from './GardenRocks';
import GardenPlants from './GardenPlants';
import type { PlantStyle } from './gardenPlantGeometry';
import { PaperBoat } from './PaperBoat';
import { BOAT_MARGIN, BoatSimulation, type BoatBody, type BoatLaunch } from './boatPhysics';

const BASE = import.meta.env.BASE_URL;
const boatRiver = { center: riverCenter, halfWidth: bankEdge };
export const SKY = '#eeeee5';
type SceneProps = { progress: number; paused: boolean; reduced: boolean; onReady: () => void; boatLaunchRequest: number; lightTrees: boolean; groundStyle: GroundStyle; rockStyle: RockStyle; plantStyle: PlantStyle };

function Pool({ paused, width, launchRequest }: { paused: boolean; width: number; launchRequest: number }) {
  const camera = useThree(s => s.camera);
  const [simulation] = useState(() => new BoatSimulation(boatRiver, width));
  const [boats, setBoats] = useState<BoatBody[]>([]);
  // Solve all contacts before individual meshes read their positions.
  useFrame((_, dt) => {
    if (simulation.advance(dt, width, paused)) setBoats([...simulation.bodies]);
  }, -1);
  const nextId = useRef(0), lastRequest = useRef(launchRequest);
  const launch = useCallback((x: number, z: number) => {
    const halfWidth = Math.max(.1, bankEdge(z, width) - BOAT_MARGIN);
    // Decide once per launch, so rerenders and animation never change the model.
    const roll = Math.random();
    const boat: BoatLaunch = { id: ++nextId.current, z, lateral: THREE.MathUtils.clamp((x - riverCenter(z, width)) / halfWidth, -1, 1),
      kind: roll < .45 ? 'sailboat' : roll < .50 ? 'tugboat' : 'paper' };
    // Keep this a small passing detail even if someone taps repeatedly.
    simulation.launch(boat, width);
    setBoats([...simulation.bodies]);
  }, [width, simulation]);
  useEffect(() => {
    if (launchRequest === lastRequest.current) return;
    lastRequest.current = launchRequest;
    const z = camera.position.z - 10;
    launch(riverCenter(z, width), z);
  }, [launchRequest, launch, camera, width]);
  const tapWater = (event: ThreeEvent<MouseEvent>) => {
    const { x, z } = event.point;
    // The reflecting plane extends underneath the terrain. Only exposed
    // stream water is interactive; drags and native touch scrolling are not taps.
    if (event.delta > 6 || event.button !== 0 || Math.abs(x - riverCenter(z, width)) >= bankEdge(z, width) - .08
      || z < camera.position.z - 65 || z > camera.position.z - 1) return;
    event.stopPropagation();
    launch(x, z);
  };
  const normals = useTexture(`${BASE}textures/garden/water-normal.jpg`);
  const water = useMemo(() => {
    normals.wrapS = normals.wrapT = THREE.RepeatWrapping;
    const object = new Water(new THREE.PlaneGeometry(240, 260), {
      textureWidth: 512, textureHeight: 512,
      waterNormals: normals, waterColor: '#b5bca6', sunColor: '#fff9e9',
      sunDirection: new THREE.Vector3(-.5, .8, -.2).normalize(),
      distortionScale: .65, fog: true,
    });
    object.rotation.x = -Math.PI / 2;
    object.position.set(0, 0, -50);
    object.material.uniforms.size.value = 5;
    object.material.uniforms.time.value = 24;
    return object;
  }, [normals]);
  useFrame((_, dt) => { if (!paused) water.material.uniforms.time.value += Math.min(dt, .05) * .22; });
  return <>
    <primitive object={water} onClick={tapWater} />
    {boats.map(boat => <PaperBoat key={boat.id} boat={boat} />)}
  </>;
}

function BankDetails({ width, rockStyle, plantStyle }: { width: number; rockStyle: RockStyle; plantStyle: PlantStyle }) {
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
  useLayoutEffect(() => {
    const rand = random(319), dummy = new THREE.Object3D(), color = new THREE.Color();
    for (let i = 0; i < 260; i++) {
      const z = 26 - rand() * 126, x = riverCenter(z, width) + (bankEdge(z, width) + rand() * 3.4) * (i % 2 ? 1 : -1);
      dummy.position.set(x, groundHeight(x, z, width) - .04, z);
      dummy.rotation.set(rand(), rand() * 6, rand());
      const s = .1 + Math.pow(rand(), 3) * .55;
      dummy.scale.set(s * 1.4, s * .5, s);
      dummy.updateMatrix(); stones.current!.setMatrixAt(i, dummy.matrix);
      color.setHSL(.12, .08, .48 + rand() * .2); stones.current!.setColorAt(i, color);
    }
    for (let i = 0; i < 7000; i++) {
      const cluster = Math.floor(i / 20), r = random(cluster * 91 + 31);
      const z = 26 - r() * 126, x = riverCenter(z, width) + (bankEdge(z, width) + .5 + r() * 4) * (cluster % 2 ? 1 : -1);
      const px = x + (rand() - .5) * .9, pz = z + (rand() - .5) * .9;
      dummy.position.set(px, groundHeight(px, pz, width) - .02, pz);
      dummy.rotation.set((rand() - .5) * .3, rand() * 6.28, (rand() - .5) * .5);
      dummy.scale.setScalar(.25 + rand() * .48);
      dummy.updateMatrix(); grasses.current!.setMatrixAt(i, dummy.matrix);
      color.setHSL(.18 + rand() * .08, .16, .30 + rand() * .20); grasses.current!.setColorAt(i, color);
    }
    for (let i = 0; i < 1500; i++) {
      const cluster = Math.floor(i / 5), r = random(cluster * 79 + 16);
      const z = 24 - r() * 98, x = riverCenter(z, width) + (bankEdge(z, width) + .8 + r() * 2.6) * (cluster % 2 ? 1 : -1);
      const angle = i % 5 / 5 * Math.PI * 2;
      dummy.position.set(x, groundHeight(x, z, width) + .18 + r() * .2, z);
      dummy.rotation.set(-Math.PI / 2 + .4, angle, angle);
      dummy.scale.setScalar(.11); dummy.updateMatrix(); flowers.current!.setMatrixAt(i, dummy.matrix);
      color.set(cluster % 3 ? '#ece6cc' : '#d6a6a0'); flowers.current!.setColorAt(i, color);
    }
    [stones, grasses, flowers].forEach(ref => {
      ref.current!.instanceMatrix.needsUpdate = true;
      if (ref.current!.instanceColor) ref.current!.instanceColor!.needsUpdate = true;
      ref.current!.computeBoundingSphere();
    });
  }, [width]);
  return <>
    <instancedMesh name="garden-original-rocks" visible={rockStyle === 'original'} ref={stones} args={[stone, undefined, 260]} castShadow receiveShadow>
      <meshStandardMaterial color="#b4b29b" roughness={.95} />
    </instancedMesh>
    <instancedMesh name="garden-original-grass" visible={plantStyle === 'original'} ref={grasses} args={[blade, undefined, 7000]}>
      <meshStandardMaterial color="#6d7954" side={THREE.DoubleSide} roughness={1} />
    </instancedMesh>
    <instancedMesh name="garden-bank-flowers" ref={flowers} args={[petal, undefined, 1500]}>
      <meshStandardMaterial side={THREE.DoubleSide} roughness={.8} />
    </instancedMesh>
  </>;
}

function Petals({ paused }: { paused: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => leafGeometry(true), []);
  const time = useRef(0);
  const data = useMemo(() => {
    const rand = random(72);
    return Array.from({ length: 45 }, () => ({
      x: (rand() - .5) * 26, y: 1 + rand() * 13, z: 13 - rand() * 90,
      phase: rand() * 6.28, size: .1 + rand() * .18, speed: .2 + rand() * .4,
    }));
  }, []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame((_, dt) => {
    if (!ref.current) return;
    if (!paused) time.current += Math.min(dt, .05);
    data.forEach((p, i) => {
      const t = time.current * p.speed;
      dummy.position.set(p.x + Math.sin(t * .4 + p.phase) * 1.8, p.y + Math.sin(t * .7 + p.phase) * .65, p.z + Math.cos(t * .3 + p.phase));
      dummy.rotation.set(t * .7 + p.phase, t * .4, Math.sin(t + p.phase) * .8);
      dummy.scale.setScalar(p.size); dummy.updateMatrix(); ref.current!.setMatrixAt(i, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[geometry, undefined, data.length]} frustumCulled={false}>
    <meshStandardMaterial color="#c88889" side={THREE.DoubleSide} roughness={.65} />
  </instancedMesh>;
}

function FallingLeaves({ paused, width }: { paused: boolean; width: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => leafGeometry(), []);
  const time = useRef(0);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const leaves = useMemo(() => {
    const rand = random(3198);
    return Array.from({ length: 18 }, (_, i) => {
      const z = 19 - rand() * 64;
      return { x: riverCenter(z, width) + (bankEdge(z, width) + .3 + rand() * 1.8) * (i % 2 ? 1 : -1), z,
        phase: rand() * 11, speed: .20 + rand() * .22, size: .16 + rand() * .13 };
    });
  }, [width]);
  useLayoutEffect(() => {
    leaves.forEach((_, i) => ref.current!.setColorAt(i, new THREE.Color(i % 3 ? '#92996d' : '#ba9565')));
    if (ref.current?.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [leaves]);
  useFrame((_, dt) => {
    if (!ref.current) return;
    if (!paused) time.current += Math.min(dt, .05);
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

export default function GardenScene({ progress, paused, reduced, onReady, boatLaunchRequest, lightTrees, groundStyle, rockStyle, plantStyle }: SceneProps) {
  const { camera, size } = useThree();
  const mobile = size.width / size.height < .85;
  const bankWidth = mobile ? MOBILE_RIVER_WIDTH : 1;
  const current = useRef(0);
  const target = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => { onReady(); }, [onReady]);
  useLayoutEffect(() => {
    const lens = camera as THREE.PerspectiveCamera;
    lens.fov = mobile ? GARDEN_CAMERA.mobileFov : GARDEN_CAMERA.fov;
    lens.updateProjectionMatrix();
  }, [camera, mobile]);
  useFrame((_, dt) => {
    const p = reduced ? 0 : progress;
    if (reduced) current.current = 0;
    else if (!paused) current.current = THREE.MathUtils.damp(current.current, p, 2, Math.min(dt, .05));
    const t = current.current;
    // Both compositions look along the same route from the same height. Only
    // the lens widens on portrait, preserving the desktop viewpoint.
    const travel = t * GARDEN_CAMERA.travel;
    camera.position.set(Math.sin(t * Math.PI) * .75, GARDEN_CAMERA.height, GARDEN_CAMERA.startZ - travel);
    target.set(Math.sin(t * Math.PI) * .3, GARDEN_CAMERA.targetY, GARDEN_CAMERA.targetZ - travel);
    camera.lookAt(target);
  });
  return <>
    <color attach="background" args={[SKY]} />
    <fog attach="fog" args={[SKY, mobile ? 8 : 16, mobile ? 85 : 110]} />
    <hemisphereLight args={['#fffbee', '#b0b5a0', 1.7]} />
    <directionalLight position={[-18, 24, 9]} intensity={2.3} color="#fff2d6" castShadow
      shadow-mapSize={[1024, 1024]} shadow-camera-left={-30} shadow-camera-right={30}
      shadow-camera-top={35} shadow-camera-bottom={-35} shadow-camera-far={110}
      shadow-bias={-.0003} shadow-normalBias={.07} />
    <GardenGround width={bankWidth} style={groundStyle} />
    <GardenTrees width={bankWidth} mobile={mobile} paused={paused || reduced} lightTrees={lightTrees} />
    <BankDetails width={bankWidth} rockStyle={rockStyle} plantStyle={plantStyle} />
    <GardenPlants width={bankWidth} mobile={mobile} paused={paused || reduced} visible={plantStyle === 'varied'} />
    <GardenRocks width={bankWidth} visible={rockStyle === 'moss'} />
    <Pool paused={paused || reduced} width={bankWidth} launchRequest={boatLaunchRequest} />
    <Petals paused={paused || reduced} />
    <FallingLeaves paused={paused || reduced} width={bankWidth} />
  </>;
}
