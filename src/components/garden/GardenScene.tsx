// PROTOTYPE: a short, self-contained garden composition, not the production story.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { bankEdge, bankGeometry, barkTexture, groundHeight, leafGeometry, random, treeGeometry } from './gardenGeometry';
import { BOAT_MARGIN, PaperBoat, type BoatLaunch } from './PaperBoat';

const BASE = import.meta.env.BASE_URL;
export const SKY = '#eeeee5';
type SceneProps = { progress: number; paused: boolean; reduced: boolean; onReady: () => void; boatLaunchRequest: number };

function Pool({ paused, width, launchRequest }: { paused: boolean; width: number; launchRequest: number }) {
  const camera = useThree(s => s.camera);
  const [boats, setBoats] = useState<BoatLaunch[]>([]);
  const nextId = useRef(0), lastRequest = useRef(launchRequest);
  const launch = useCallback((x: number, z: number) => {
    const halfWidth = Math.max(.1, bankEdge(z, width) - BOAT_MARGIN);
    const boat = { id: ++nextId.current, z, lateral: THREE.MathUtils.clamp(x / halfWidth, -1, 1) };
    // Keep this a small passing detail even if someone taps repeatedly.
    setBoats(previous => [...previous.slice(-3), boat]);
  }, [width]);
  const retire = useCallback((id: number) => setBoats(previous => previous.filter(boat => boat.id !== id)), []);
  useEffect(() => {
    if (launchRequest === lastRequest.current) return;
    lastRequest.current = launchRequest;
    launch(0, camera.position.z - 10);
  }, [launchRequest, launch, camera]);
  const tapWater = (event: ThreeEvent<MouseEvent>) => {
    const { x, z } = event.point;
    // The reflecting plane extends underneath the terrain. Only exposed
    // stream water is interactive; drags and native touch scrolling are not taps.
    if (event.delta > 6 || event.button !== 0 || Math.abs(x) >= bankEdge(z, width) - .08
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
    {boats.map(boat => <PaperBoat key={boat.id} boat={boat} width={width} paused={paused} onRetire={retire} />)}
  </>;
}

function Banks({ width }: { width: number }) {
  const maps = useTexture([
    `${BASE}textures/garden/ground-color.jpg`, `${BASE}textures/garden/ground-normal.jpg`,
    `${BASE}textures/garden/ground-roughness.jpg`,
  ]);
  useMemo(() => {
    maps.forEach(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; });
    maps[0].colorSpace = THREE.SRGBColorSpace;
  }, [maps]);
  const geometries = useMemo(() => [bankGeometry(-1, width), bankGeometry(1, width)], [width]);
  useEffect(() => () => geometries.forEach(g => g.dispose()), [geometries]);
  return <>{geometries.map((geometry, i) => <mesh key={i} geometry={geometry} receiveShadow>
    <meshStandardMaterial map={maps[0]} normalMap={maps[1]} roughnessMap={maps[2]}
      normalScale={[.8, .8]} roughness={1} vertexColors onBeforeCompile={shader => {
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
          #include <map_fragment>
          float groundLuma = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(groundLuma), 0.65);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.30, 0.32, 0.22), 0.30);
        `);
      }} />
  </mesh>)}</>;
}

function Trees({ width, mobile }: { width: number; mobile: boolean }) {
  const trees = useMemo(() => [treeGeometry(12), treeGeometry(83), treeGeometry(47, true)], []);
  const leaf = useMemo(() => leafGeometry(), []);
  const bark = useMemo(() => barkTexture(), []);
  const placements = useMemo(() => {
    const avenue = [
    [-8.6, 4, 1.22, .3], [8.8, 0, 1.30, 2.1],
    [-11.5, -17, 1.08, 1.3], [11.7, -21, 1.2, .7],
    [-10.2, -37, 1.17, 2.9], [10.7, -43, 1.03, .1],
    [-8.7, -59, 1.12, 1.8], [9, -67, 1.23, 3.5],
    [-8, -85, 1.05, .2], [8, -95, 1.15, 2.2],
    ].map(([x, z, scale, rotation], i) => ({
      x: mobile ? Math.sign(x) * (bankEdge(z, width) + 3.8 + (i % 3) * .2) : x,
      z, scale: scale * (mobile ? .88 : 1), rotation, type: i >= 4 ? 2 : i % 2, distant: i >= 4,
    }));
    // Staggered outer groves fill the edges of the horizon. These use much
    // simpler branches and foliage than the trees close to the camera.
    const rand = random(415);
    const groves = Array.from({ length: mobile ? 12 : 24 }, (_, i) => {
      const row = Math.floor(i / 8), column = Math.floor(i % 8 / 2);
      return {
        x: (i % 2 ? 1 : -1) * ((mobile ? 6.5 : 17) + column * (mobile ? 3 : 8) + rand() * 2),
        z: -14 - row * 23 - rand() * 11,
        scale: 1.05 + rand() * .5, rotation: rand() * Math.PI * 2, type: 2, distant: true,
      };
    });
    return [...avenue, ...groves];
  }, [width, mobile]);
  const instances = useRef<THREE.InstancedMesh>(null);
  const total = placements.reduce((n, p) => n + trees[p.type].leaves.length, 0);
  useLayoutEffect(() => {
    if (!instances.current) return;
    const dummy = new THREE.Object3D(), group = new THREE.Object3D();
    const rand = random(631), color = new THREE.Color();
    let i = 0;
    placements.forEach(({ x, z, scale, rotation, type, distant }) => {
      group.position.set(x, groundHeight(x, z, width), z); group.rotation.y = rotation;
      group.scale.setScalar(scale); group.updateMatrix();
      trees[type].leaves.forEach(l => {
        dummy.position.copy(l.position);
        dummy.rotation.set(rand() * 2.7, rand() * 6.28, rand() * 6.28);
        dummy.scale.set(l.scale * .65, l.scale, l.scale);
        dummy.updateMatrix();
        instances.current!.setMatrixAt(i, new THREE.Matrix4().multiplyMatrices(group.matrix, dummy.matrix));
        color.setHSL(.20 + rand() * .07, .12 + rand() * .16, (distant ? .26 : .30) + rand() * .26);
        instances.current!.setColorAt(i++, color);
      });
    });
    instances.current.instanceMatrix.needsUpdate = true;
    if (instances.current.instanceColor) instances.current.instanceColor.needsUpdate = true;
    instances.current.computeBoundingSphere();
  }, [placements, trees, width]);
  return <>
    {placements.map(({ x, z, scale, rotation, type, distant }, i) => <mesh key={i} geometry={trees[type].trunk}
      position={[x, groundHeight(x, z, width), z]} scale={scale} rotation={[0, rotation, 0]} castShadow={!distant} receiveShadow>
      <meshStandardMaterial map={bark} bumpMap={bark} bumpScale={.045} color="#d8cbb0" roughness={.95} />
    </mesh>)}
    <instancedMesh ref={instances} args={[leaf, undefined, total]} castShadow={!mobile}>
      <meshStandardMaterial side={THREE.DoubleSide} roughness={.86} />
    </instancedMesh>
  </>;
}

function BankDetails({ width }: { width: number }) {
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
      const z = 26 - rand() * 126, x = (bankEdge(z, width) + rand() * 3.4) * (i % 2 ? 1 : -1);
      dummy.position.set(x, groundHeight(x, z, width) - .04, z);
      dummy.rotation.set(rand(), rand() * 6, rand());
      const s = .1 + Math.pow(rand(), 3) * .55;
      dummy.scale.set(s * 1.4, s * .5, s);
      dummy.updateMatrix(); stones.current!.setMatrixAt(i, dummy.matrix);
      color.setHSL(.12, .08, .48 + rand() * .2); stones.current!.setColorAt(i, color);
    }
    for (let i = 0; i < 7000; i++) {
      const cluster = Math.floor(i / 20), r = random(cluster * 91 + 31);
      const z = 26 - r() * 126, x = (bankEdge(z, width) + .5 + r() * 4) * (cluster % 2 ? 1 : -1);
      const px = x + (rand() - .5) * .9, pz = z + (rand() - .5) * .9;
      dummy.position.set(px, groundHeight(px, pz, width) - .02, pz);
      dummy.rotation.set((rand() - .5) * .3, rand() * 6.28, (rand() - .5) * .5);
      dummy.scale.setScalar(.25 + rand() * .48);
      dummy.updateMatrix(); grasses.current!.setMatrixAt(i, dummy.matrix);
      color.setHSL(.18 + rand() * .08, .16, .30 + rand() * .20); grasses.current!.setColorAt(i, color);
    }
    for (let i = 0; i < 1500; i++) {
      const cluster = Math.floor(i / 5), r = random(cluster * 79 + 16);
      const z = 24 - r() * 98, x = (bankEdge(z, width) + .8 + r() * 2.6) * (cluster % 2 ? 1 : -1);
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
    <instancedMesh ref={stones} args={[stone, undefined, 260]} castShadow receiveShadow>
      <meshStandardMaterial color="#b4b29b" roughness={.95} />
    </instancedMesh>
    <instancedMesh ref={grasses} args={[blade, undefined, 7000]}>
      <meshStandardMaterial color="#6d7954" side={THREE.DoubleSide} roughness={1} />
    </instancedMesh>
    <instancedMesh ref={flowers} args={[petal, undefined, 1500]}>
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
      return { x: (bankEdge(z, width) + .3 + rand() * 1.8) * (i % 2 ? 1 : -1), z,
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

export default function GardenScene({ progress, paused, reduced, onReady, boatLaunchRequest }: SceneProps) {
  const { camera, size } = useThree();
  const mobile = size.width / size.height < .85;
  const bankWidth = mobile ? .30 : 1;
  const current = useRef(0);
  const target = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => { onReady(); }, [onReady]);
  useLayoutEffect(() => {
    const lens = camera as THREE.PerspectiveCamera;
    lens.fov = mobile ? 58 : 48;
    lens.updateProjectionMatrix();
  }, [camera, mobile]);
  useFrame((_, dt) => {
    const p = reduced ? 0 : progress;
    if (reduced) current.current = 0;
    else if (!paused) current.current = THREE.MathUtils.damp(current.current, p, 2, Math.min(dt, .05));
    const t = current.current;
    // Portrait is its own garden composition: narrow water, visible banks,
    // and a shorter journey that keeps a pair of trunks in view throughout.
    const travel = t * (mobile ? 8 : 19);
    camera.position.set(Math.sin(t * Math.PI) * (mobile ? .15 : .75), mobile ? 5.4 : 3.2, (mobile ? 27 : 18) - travel);
    target.set(Math.sin(t * Math.PI) * .3, mobile ? 4 : 2.5, -28 - travel);
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
    <Banks width={bankWidth} />
    <Trees width={bankWidth} mobile={mobile} />
    <BankDetails width={bankWidth} />
    <Pool paused={paused || reduced} width={bankWidth} launchRequest={boatLaunchRequest} />
    <Petals paused={paused || reduced} />
    <FallingLeaves paused={paused || reduced} width={bankWidth} />
  </>;
}
