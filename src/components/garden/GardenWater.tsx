// The river's water and the guest-launched boats on it.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { riverCenter, bankEdge, channelOffset, islandHalfWidth, rockHalfWidth, RIVER_REACH, VOYAGE } from './gardenGeometry';
import { plantSites } from './gardenPlantGeometry';
import { BoatWakes, PaperBoat } from './PaperBoat';
import { BOAT_MARGIN, BoatSimulation, type BoatBody, type BoatLaunch, type Stem } from './boatPhysics';
import { useGardenTextures } from './gardenTextures';
import { jettyStems, launchJettyStems, underJetty, underLaunchJetty } from './voyageDock';
import { mooredStems } from './storyBoats';
import { guestBoatStems } from './guestBoat';
import { rememberedParty } from './GuestBoat';
import { bridgeStems, onPoint, pointStems } from './eggs/harbour';
import { DOCKED } from './journey';
import { useJourney } from './JourneyProvider';

const BASE = import.meta.env.BASE_URL;
export const WATER_NORMALS = [`${BASE}textures/garden/water-normal.jpg`];
// Sydney's rock parts the river as the island does, so guests' boats keep to
// a channel either side of it too, but it is bare stone with no reeds round
// it, so they are held only just off its waterline.
const midRiver = (z: number, width: number) => islandHalfWidth(z, width) || rockHalfWidth(z, width);
const boatRiver = { center: riverCenter, halfWidth: bankEdge, island: midRiver, islandMargin: (z: number) => rockHalfWidth(z) > 0 ? .08 : undefined };

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
  const clock = useJourney();
  // The reeds, the jetties and the Harbour Bridge's pylons always; the
  // catamaran once it is tied up there, and the guest's own boat beside it.
  const stems = useMemo(() => {
    const fixed = [...reeds ? reedStems(width, mobile) : [], ...launchJettyStems(width), ...jettyStems(width), ...bridgeStems(width), ...pointStems(width)];
    return { fixed, moored: [...fixed, ...mooredStems(width), ...rememberedParty() ? guestBoatStems(width) : []] };
  }, [reeds, width, mobile]);
  const moored = useRef(false);
  useLayoutEffect(() => {
    moored.current = clock.progress >= DOCKED;
    simulation.setStems(moored.current ? stems.moored : stems.fixed, width);
  }, [simulation, stems, width, clock]);
  const [boats, setBoats] = useState<BoatBody[]>([]);
  // Solve all contacts before individual meshes read their positions.
  useFrame((_, dt) => {
    if (clock.progress >= DOCKED !== moored.current) {
      moored.current = !moored.current;
      simulation.setStems(moored.current ? stems.moored : stems.fixed, width);
    }
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
    let z = camera.position.z - 10;
    // Beside the island, down the middle of one channel or the other, past its
    // head, where portrait's channels are narrower than a turning paper boat;
    // beside Sydney's rock, down one channel or the other.
    if (z < VOYAGE.island.from + 1 && z > VOYAGE.island.to) z = Math.min(z, VOYAGE.island.from - 5);
    const side = launchRequest % 2 ? 1 : -1, rock = rockHalfWidth(z, width);
    launch(riverCenter(z, width) + (islandHalfWidth(z, width) ? side * channelOffset(z, width) : rock ? side * (rock + bankEdge(z, width)) / 2 : 0), z);
  }, [launchRequest, launch, camera, width]);
  const tapWater = (event: ThreeEvent<MouseEvent>) => {
    const { x, z } = event.point;
    // The reflecting plane extends underneath the terrain. Only exposed
    // stream water is interactive; drags and native touch scrolling are not taps.
    // A thumb wanders further than a mouse during a tap, so touch gets more slack.
    const slack = (event.nativeEvent as PointerEvent).pointerType === 'mouse' ? 6 : 16;
    const out = Math.abs(x - riverCenter(z, width));
    // A tap on the island, the rock, Bennelong Point or a jetty reaches the water plane beneath it, which isn't open water.
    if (event.delta > slack || event.button !== 0 || out >= bankEdge(z, width) - .08 || out < midRiver(z, width) || underJetty(x, z, width) || underLaunchJetty(x, z, width) || onPoint(x, z, width)
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
