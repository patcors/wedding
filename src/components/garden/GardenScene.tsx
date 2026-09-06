// PROTOTYPE: a short, self-contained garden composition, not the production story.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { bankEdge, bankGeometry, barkTexture, groundHeight, leafGeometry, random, treeGeometry } from './gardenGeometry';

const BASE = import.meta.env.BASE_URL;
export const SKY = '#eeeee5';
type SceneProps = { progress: number; paused: boolean; reduced: boolean; onReady: () => void };

function Pool({ paused }: { paused: boolean }) {
  const normals = useTexture(`${BASE}textures/garden/water-normal.jpg`);
  const water = useMemo(() => {
    normals.wrapS = normals.wrapT = THREE.RepeatWrapping;
    const object = new Water(new THREE.PlaneGeometry(240, 260), {
      textureWidth: 768, textureHeight: 768,
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
  return <primitive object={water} />;
}

function Banks() {
  const maps = useTexture([
    `${BASE}textures/garden/ground-color.jpg`, `${BASE}textures/garden/ground-normal.jpg`,
    `${BASE}textures/garden/ground-roughness.jpg`,
  ]);
  useMemo(() => {
    maps.forEach(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; });
    maps[0].colorSpace = THREE.SRGBColorSpace;
  }, [maps]);
  const geometries = useMemo(() => [bankGeometry(-1), bankGeometry(1)], []);
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

function Trees() {
  const trees = useMemo(() => [treeGeometry(12), treeGeometry(83)], []);
  const leaf = useMemo(() => leafGeometry(), []);
  const bark = useMemo(() => barkTexture(), []);
  const placements = useMemo(() => [
    [-8.6, 4, 1.22, .3], [8.8, 0, 1.30, 2.1],
    [-11.5, -17, 1.08, 1.3], [11.7, -21, 1.2, .7],
    [-10.2, -37, 1.17, 2.9], [10.7, -43, 1.03, .1],
    [-8.7, -59, 1.12, 1.8], [9, -67, 1.23, 3.5],
    [-8, -85, 1.05, .2], [8, -95, 1.15, 2.2],
  ], []);
  const instances = useRef<THREE.InstancedMesh>(null);
  const total = placements.reduce((n, _, i) => n + trees[i % 2].leaves.length, 0);
  useLayoutEffect(() => {
    if (!instances.current) return;
    const dummy = new THREE.Object3D(), group = new THREE.Object3D();
    const rand = random(631), color = new THREE.Color();
    let i = 0;
    placements.forEach(([x, z, scale, rotation], ti) => {
      group.position.set(x, groundHeight(x, z), z); group.rotation.y = rotation;
      group.scale.setScalar(scale); group.updateMatrix();
      trees[ti % 2].leaves.forEach(l => {
        dummy.position.copy(l.position);
        dummy.rotation.set(rand() * 2.7, rand() * 6.28, rand() * 6.28);
        dummy.scale.set(l.scale * .65, l.scale, l.scale);
        dummy.updateMatrix();
        instances.current!.setMatrixAt(i, new THREE.Matrix4().multiplyMatrices(group.matrix, dummy.matrix));
        color.setHSL(.20 + rand() * .07, .12 + rand() * .16, .30 + rand() * .26);
        instances.current!.setColorAt(i++, color);
      });
    });
    instances.current.instanceMatrix.needsUpdate = true;
    if (instances.current.instanceColor) instances.current.instanceColor.needsUpdate = true;
    instances.current.computeBoundingSphere();
  }, [placements, trees]);
  return <>
    {placements.map(([x, z, scale, rotation], i) => <mesh key={i} geometry={trees[i % 2].trunk}
      position={[x, groundHeight(x, z), z]} scale={scale} rotation={[0, rotation, 0]} castShadow receiveShadow>
      <meshStandardMaterial map={bark} bumpMap={bark} bumpScale={.045} color="#d8cbb0" roughness={.95} />
    </mesh>)}
    <instancedMesh ref={instances} args={[leaf, undefined, total]} castShadow>
      <meshStandardMaterial side={THREE.DoubleSide} roughness={.86} />
    </instancedMesh>
  </>;
}

function BankDetails() {
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
      const z = 16 - rand() * 116, x = (bankEdge(z) + rand() * 3.4) * (i % 2 ? 1 : -1);
      dummy.position.set(x, groundHeight(x, z) - .04, z);
      dummy.rotation.set(rand(), rand() * 6, rand());
      const s = .1 + Math.pow(rand(), 3) * .55;
      dummy.scale.set(s * 1.4, s * .5, s);
      dummy.updateMatrix(); stones.current!.setMatrixAt(i, dummy.matrix);
      color.setHSL(.12, .08, .48 + rand() * .2); stones.current!.setColorAt(i, color);
    }
    for (let i = 0; i < 7000; i++) {
      const cluster = Math.floor(i / 20), r = random(cluster * 91 + 31);
      const z = 15 - r() * 115, x = (bankEdge(z) + .5 + r() * 4) * (cluster % 2 ? 1 : -1);
      const px = x + (rand() - .5) * .9, pz = z + (rand() - .5) * .9;
      dummy.position.set(px, groundHeight(px, pz) - .02, pz);
      dummy.rotation.set((rand() - .5) * .3, rand() * 6.28, (rand() - .5) * .5);
      dummy.scale.setScalar(.25 + rand() * .48);
      dummy.updateMatrix(); grasses.current!.setMatrixAt(i, dummy.matrix);
      color.setHSL(.18 + rand() * .08, .16, .30 + rand() * .20); grasses.current!.setColorAt(i, color);
    }
    for (let i = 0; i < 1500; i++) {
      const cluster = Math.floor(i / 5), r = random(cluster * 79 + 16);
      const z = 12 - r() * 86, x = (bankEdge(z) + .8 + r() * 2.6) * (cluster % 2 ? 1 : -1);
      const angle = i % 5 / 5 * Math.PI * 2;
      dummy.position.set(x, groundHeight(x, z) + .18 + r() * .2, z);
      dummy.rotation.set(-Math.PI / 2 + .4, angle, angle);
      dummy.scale.setScalar(.11); dummy.updateMatrix(); flowers.current!.setMatrixAt(i, dummy.matrix);
      color.set(cluster % 3 ? '#ece6cc' : '#d6a6a0'); flowers.current!.setColorAt(i, color);
    }
    [stones, grasses, flowers].forEach(ref => {
      ref.current!.instanceMatrix.needsUpdate = true;
      if (ref.current!.instanceColor) ref.current!.instanceColor!.needsUpdate = true;
      ref.current!.computeBoundingSphere();
    });
  }, []);
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
    return Array.from({ length: 100 }, () => ({
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

export default function GardenScene({ progress, paused, reduced, onReady }: SceneProps) {
  const { camera, size } = useThree();
  const current = useRef(0);
  const target = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => { onReady(); }, [onReady]);
  useFrame((_, dt) => {
    const p = reduced ? 0 : progress;
    if (reduced) current.current = 0;
    else if (!paused) current.current = THREE.MathUtils.damp(current.current, p, 2, Math.min(dt, .05));
    const t = current.current;
    const narrow = size.width < 700;
    camera.position.set(Math.sin(t * Math.PI) * .75, narrow ? 3.9 : 3.2, (narrow ? 32 : 18) - t * 19);
    target.set(Math.sin(t * Math.PI) * .3, narrow ? 3.2 : 2.5, -28 - t * 19);
    camera.lookAt(target);
  });
  return <>
    <color attach="background" args={[SKY]} />
    <fog attach="fog" args={[SKY, 12, 85]} />
    <hemisphereLight args={['#fffbee', '#b0b5a0', 1.7]} />
    <directionalLight position={[-18, 24, 9]} intensity={2.3} color="#fff2d6" castShadow
      shadow-mapSize={[2048, 2048]} shadow-camera-left={-30} shadow-camera-right={30}
      shadow-camera-top={35} shadow-camera-bottom={-35} shadow-camera-far={110}
      shadow-bias={-.0003} shadow-normalBias={.07} />
    <Banks />
    <Trees />
    <BankDetails />
    <Pool paused={paused || reduced} />
    <Petals paused={paused || reduced} />
  </>;
}
