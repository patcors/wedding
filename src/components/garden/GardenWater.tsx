// The river's water and the guest-launched boats on it.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { riverCenter, bankEdge, RIVER_REACH } from './gardenGeometry';
import { plantSites } from './gardenPlantGeometry';
import { BoatWakes, PaperBoat } from './PaperBoat';
import { BOAT_MARGIN, BoatSimulation, type BoatBody, type BoatLaunch, type Stem } from './boatPhysics';
import { useGardenTextures } from './gardenTextures';

const BASE = import.meta.env.BASE_URL;
export const WATER_NORMALS = [`${BASE}textures/garden/water-normal.jpg`];
const boatRiver = { center: riverCenter, halfWidth: bankEdge };

// The water's colour and sun glint. GardenSky owns them and may change them
// every frame; the water copies them in each frame.
export type WaterTint = { water: THREE.Color; glint: THREE.Color };
export const createWaterTint = (): WaterTint => ({ water: new THREE.Color('#b5bca6'), glint: new THREE.Color('#fff9e9') });

// Where the planted reeds and cattails stand in open water.
function reedStems(width: number, mobile: boolean): Stem[] {
  return (['reed', 'cattail'] as const).flatMap(kind => plantSites(kind, width, mobile)
    .filter(site => Math.abs(site.x - riverCenter(site.z, width)) < bankEdge(site.z, width))
    .map(site => ({ x: site.x, z: site.z, radius: (kind === 'reed' ? .07 : .05) * site.scale })));
}

export default function GardenWater({ paused, width, mobile, reeds, launchRequest, tint }: { paused: boolean; width: number; mobile: boolean; reeds: boolean; launchRequest: number; tint: WaterTint }) {
  const camera = useThree(s => s.camera);
  const [simulation] = useState(() => new BoatSimulation(boatRiver, width));
  useLayoutEffect(() => simulation.setStems(reeds ? reedStems(width, mobile) : [], width), [simulation, reeds, width, mobile]);
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
    const kind = roll < .3 ? 'sailboat' : roll < .6 ? 'tugboat' : roll < .9 ? 'paper' : 'duck';
    const boat: BoatLaunch = { id: ++nextId.current, z, lateral: THREE.MathUtils.clamp((x - riverCenter(z, width)) / halfWidth, -1, 1), kind,
      // Boats set off bow first; a duck can be dropped in facing any way.
      ...kind === 'duck' && { yaw: Math.random() * Math.PI * 2 } };
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
    // A thumb wanders further than a mouse during a tap, so touch gets more slack.
    const slack = (event.nativeEvent as PointerEvent).pointerType === 'mouse' ? 6 : 16;
    if (event.delta > slack || event.button !== 0 || Math.abs(x - riverCenter(z, width)) >= bankEdge(z, width) - .08
      || z < camera.position.z - 65 || z > camera.position.z - 1) return;
    event.stopPropagation();
    launch(x, z);
  };
  const [normals] = useGardenTextures(WATER_NORMALS);
  const water = useMemo(() => {
    normals.wrapS = normals.wrapT = THREE.RepeatWrapping;
    // Beyond both ends of the planted river, and wide enough for the bend.
    const length = RIVER_REACH.from - RIVER_REACH.to + 160;
    const object = new Water(new THREE.PlaneGeometry(300, length), {
      textureWidth: 512, textureHeight: 512,
      waterNormals: normals, waterColor: tint.water, sunColor: tint.glint,
      sunDirection: new THREE.Vector3(-.5, .8, -.2).normalize(),
      distortionScale: .65, fog: true,
    });
    object.rotation.x = -Math.PI / 2;
    object.position.set(0, 0, (RIVER_REACH.from + RIVER_REACH.to) / 2);
    object.material.uniforms.size.value = 5;
    object.material.uniforms.time.value = 24;
    return object;
  }, [normals, tint]);
  useFrame((_, dt) => {
    const uniforms = water.material.uniforms;
    uniforms.waterColor.value.copy(tint.water);
    uniforms.sunColor.value.copy(tint.glint);
    if (!paused) uniforms.time.value += Math.min(dt, .05) * .22;
  });
  return <>
    <primitive object={water} onClick={tapWater} />
    {boats.map(boat => <PaperBoat key={boat.id} boat={boat} />)}
    <BoatWakes boats={boats} />
  </>;
}
