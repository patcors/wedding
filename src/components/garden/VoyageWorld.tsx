// The Voyage's scenery along the river (owner: world agent): the little
// jetties the boats set out from, the island and reeds that split the river
// before they meet, the sandstone rock that parts it again in Sydney, and the
// jetty and the festoon
// lights in the old tree past the S-bend. The old tree itself and the stand of
// trees that hides it until the bend are planted with the rest in
// GardenTrees, which shares their bark, leaves and wind.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ROUTE } from './journey';
import { VOYAGE, riverCenter, voyageLandmarks } from './gardenGeometry';
import { BOAT_SCALE, berth, castingOff } from './storyBoats';
import { lampsAt } from './skyCycle';
import { useGroundMaterial } from './GardenGround';
import { plantMaterial } from './GardenPlants';
import { OLD_TREE_SCALE } from './GardenTrees';
import { plantGeometry } from './gardenPlantGeometry';
import { islandGeometry, islandPlantSites, type IslandPlant } from './voyageIsland';
import { rockGeometry } from './voyageRock';
import { FESTOON, festoonStrands, jettyGeometry, jettyLantern, launchJettyGeometry, launchLanterns, mooringLines, sagPoints } from './voyageDock';
import { useJourney, type SlotProps } from './JourneyProvider';
import { useRiverReach } from './useRiverReach';

function IslandPlants({ kind, width, mobile, wind }: { kind: IslandPlant; width: number; mobile: boolean; wind: { value: number } }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => plantGeometry(kind), [kind]);
  const material = useMemo(() => plantMaterial(kind, wind, mobile), [kind, wind, mobile]);
  const sites = useMemo(() => islandPlantSites(kind, width, mobile), [kind, width, mobile]);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  useLayoutEffect(() => {
    const dummy = new THREE.Object3D(), color = new THREE.Color();
    sites.forEach((site, i) => {
      dummy.position.set(site.x, site.y, site.z);
      dummy.rotation.set(0, site.angle, 0);
      dummy.scale.setScalar(site.scale);
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(i, dummy.matrix);
      mesh.current!.setColorAt(i, color.setRGB(site.tint, site.tint, site.tint * .96));
    });
    mesh.current!.instanceMatrix.needsUpdate = true;
    if (mesh.current!.instanceColor) mesh.current!.instanceColor.needsUpdate = true;
    mesh.current!.computeBoundingSphere();
    // Include the reeds' wind displacement at frustum boundaries.
    mesh.current!.boundingSphere!.radius += .4;
  }, [sites]);
  // Reeds shade the channels; the low cover doesn't need to.
  return <instancedMesh key={sites.length} ref={mesh} name={`voyage-island-${kind}`} args={[geometry, material, sites.length]}
    castShadow={kind === 'reed' && !mobile} receiveShadow />;
}

// A raised grassy island ringed by tall reeds, dividing the river in two.
function Island({ width, mobile, paused }: SlotProps) {
  const group = useRef<THREE.Group>(null);
  const geometry = useMemo(() => islandGeometry(width), [width]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  // The banks' ground: the island takes the natural style, the Garden's default.
  const material = useGroundMaterial('natural');
  const wind = useMemo(() => ({ value: 0 }), []);
  useFrame((_, dt) => { if (!paused) wind.value += Math.min(dt, .05); });
  useRiverReach(group, useMemo(() => [{ z: VOYAGE.island.from + 1 }, { z: VOYAGE.island.to - 1 }], []));
  return <group ref={group} name="voyage-island">
    <mesh geometry={geometry} material={material} receiveShadow />
    {(['reed', 'cattail', 'grass', 'fern'] as const).map(kind => <IslandPlants key={kind} kind={kind} width={width} mobile={mobile} wind={wind} />)}
  </group>;
}

// The low sandstone rock in Sydney's river, where the boats first part. The
// Opera House stands on it and the Harbour Bridge lands on it (eggs/Sydney.tsx).
function Rock({ width }: SlotProps) {
  const group = useRef<THREE.Group>(null);
  const geometry = useMemo(() => rockGeometry(width), [width]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useRiverReach(group, useMemo(() => [{ z: VOYAGE.rock.from + 1 }, { z: VOYAGE.rock.to - 1 }], []));
  return <group ref={group} name="voyage-rock">
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors roughness={.95} flatShading />
    </mesh>
  </group>;
}

// A soft round glow for each light, drawn additively.
function glowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,236,200,1)');
  gradient.addColorStop(.25, 'rgba(255,205,140,.55)');
  gradient.addColorStop(1, 'rgba(255,190,120,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const UNLIT = new THREE.Color('#5f5446'), LIT = new THREE.Color('#ffd9a8');

// The jetty, and warm festoon lights in the old tree and a lantern on the
// jetty that come on as dusk falls over the dock. The lights are emissive,
// with a soft glow around each, rather than real lights, which would cost
// every material in the scene.
function Dock({ width, mobile }: SlotProps) {
  const clock = useJourney();
  const group = useRef<THREE.Group>(null);
  const jetty = useMemo(() => jettyGeometry(width), [width]);
  const { wire, bulbs } = useMemo(() => {
    const strands = festoonStrands(width, mobile ? OLD_TREE_SCALE.mobile : OLD_TREE_SCALE.desktop);
    const wire: number[] = [], bulbs: THREE.Vector3[] = [jettyLantern(width)];
    for (const [a, b] of strands) {
      const points = sagPoints(a, b, FESTOON.sag, FESTOON.spacing / 2);
      points.forEach((point, i) => {
        if (i) wire.push(...points[i - 1].toArray(), ...point.toArray());
        // A bulb every other point, hanging just below the wire.
        if (i % 2 === 1) bulbs.push(point.clone().setY(point.y - .07));
      });
    }
    return { wire: new THREE.Float32BufferAttribute(wire, 3), bulbs };
  }, [width, mobile]);
  const glow = useMemo(glowTexture, []);
  const materials = useMemo(() => ({
    wire: new THREE.LineBasicMaterial({ color: '#3b342b' }),
    bulb: new THREE.MeshBasicMaterial({ color: UNLIT.clone(), toneMapped: false }),
    glow: new THREE.PointsMaterial({ map: glow, size: mobile ? .75 : .95, transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending, color: LIT, toneMapped: false }),
  }), [glow, mobile]);
  useEffect(() => () => { jetty.dispose(); glow.dispose(); Object.values(materials).forEach(m => m.dispose()); }, [jetty, glow, materials]);
  const bulbMesh = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    bulbs.forEach((bulb, i) => {
      dummy.position.copy(bulb);
      // The jetty's lantern is larger than the festoon bulbs.
      dummy.scale.setScalar(i ? 1 : 1.8);
      dummy.updateMatrix();
      bulbMesh.current!.setMatrixAt(i, dummy.matrix);
    });
    bulbMesh.current!.instanceMatrix.needsUpdate = true;
    bulbMesh.current!.computeBoundingSphere();
  }, [bulbs]);
  const glowPoints = useMemo(() => new THREE.BufferGeometry().setFromPoints(bulbs), [bulbs]);
  const wireGeometry = useMemo(() => new THREE.BufferGeometry().setAttribute('position', wire), [wire]);
  useEffect(() => () => { glowPoints.dispose(); wireGeometry.dispose(); }, [glowPoints, wireGeometry]);
  // The lights come up with the sky's dusk (skyCycle.ts), so they are glowing
  // in the old tree as it comes round the bend.
  useFrame(() => {
    const on = lampsAt(clock.progress);
    materials.bulb.color.copy(UNLIT).lerp(LIT, on).multiplyScalar(1 + on * .6);
    materials.glow.opacity = on * .85;
  });
  const { tree } = voyageLandmarks(width);
  useRiverReach(group, useMemo(() => [{ z: tree.z + 10 }, { z: tree.z - 10 }], [tree.z]));
  return <group ref={group} name="voyage-dock">
    <mesh name="voyage-jetty" geometry={jetty} castShadow receiveShadow>
      <meshStandardMaterial vertexColors roughness={.95} />
    </mesh>
    <lineSegments geometry={wireGeometry} material={materials.wire} />
    <instancedMesh ref={bulbMesh} key={bulbs.length} args={[undefined, materials.bulb, bulbs.length]}>
      <sphereGeometry args={[.055, 8, 6]} />
    </instancedMesh>
    <points geometry={glowPoints} material={materials.glow} renderOrder={1} />
  </group>;
}

// Each boat's own little jetty, where it lies tied up under the opening title
// with its lantern still burning from the night. Its lines are let go as the
// guest starts to scroll, and the lanterns fade as the boats pull away.
function Launch({ width, mobile }: SlotProps) {
  const clock = useJourney();
  const group = useRef<THREE.Group>(null), lines = useRef<THREE.Mesh>(null);
  const jetties = useMemo(() => launchJettyGeometry(width), [width]);
  // The hulls' bow and stern ends, a little in from the tips, in world units.
  const tied = useMemo(() => mooringLines(width, side => ({ x: riverCenter(ROUTE.start, width) + side * berth(width) * BOAT_SCALE, z: ROUTE.start }), -.62, .55), [width]);
  const lanterns = useMemo(() => new THREE.BufferGeometry().setFromPoints(launchLanterns(width)), [width]);
  const glow = useMemo(glowTexture, []);
  const materials = useMemo(() => ({
    bulb: new THREE.PointsMaterial({ color: LIT, size: .07, toneMapped: false }),
    glow: new THREE.PointsMaterial({ map: glow, size: mobile ? .5 : .6, transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending, color: LIT, toneMapped: false }),
  }), [glow, mobile]);
  useEffect(() => () => { jetties.dispose(); tied.dispose(); lanterns.dispose(); glow.dispose(); Object.values(materials).forEach(m => m.dispose()); }, [jetties, tied, lanterns, glow, materials]);
  useFrame(() => {
    const away = castingOff(clock.progress);
    if (lines.current) lines.current.visible = away === 0;
    materials.bulb.color.copy(UNLIT).lerp(LIT, 1 - away);
    materials.glow.opacity = (1 - away) * .55;
  });
  useRiverReach(group, useMemo(() => [{ z: ROUTE.start + 2 }, { z: ROUTE.start - 2 }], []));
  return <group ref={group} name="voyage-launch">
    <mesh name="voyage-launch-jetties" geometry={jetties} castShadow receiveShadow>
      <meshStandardMaterial vertexColors roughness={.95} />
    </mesh>
    <mesh ref={lines} geometry={tied}>
      <meshStandardMaterial color="#cbbd9c" roughness={1} />
    </mesh>
    <points geometry={lanterns} material={materials.bulb} />
    <points geometry={lanterns} material={materials.glow} renderOrder={1} />
  </group>;
}

export default function VoyageWorld(props: SlotProps) {
  return <group name="voyage-world">
    <Launch {...props} />
    <Island {...props} />
    <Rock {...props} />
    <Dock {...props} />
  </group>;
}
