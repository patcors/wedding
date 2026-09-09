// Previous garden trees, retained for the visual comparison toggle.
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { bankEdge, barkTexture, groundHeight, leafGeometry, random, treeGeometry } from './gardenGeometry';

export default function OriginalGardenTrees({ width, mobile }: { width: number; mobile: boolean }) {
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

