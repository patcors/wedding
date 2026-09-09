import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { bankEdge } from './gardenGeometry';

export type BoatLaunch = { id: number; z: number; lateral: number };
export const BOAT_MARGIN = .48;
const LIFETIME = 48;

function foldedPaper() {
  const positions: number[] = [], colors: number[] = [];
  type Point = [number, number, number];
  const bow: Point = [0, .23, -.82], stern: Point = [0, .23, .82];
  const left: Point = [-.43, .19, 0], right: Point = [.43, .19, 0];
  const keel: Point = [0, -.035, 0];
  const innerLeft: Point = [-.09, .07, 0], innerRight: Point = [.09, .07, 0];
  const peakLeft: Point = [-.018, .57, 0], peakRight: Point = [.018, .57, 0];
  const frontFold: Point = [0, .15, -.57], backFold: Point = [0, .15, .57];
  const triangle = (a: Point, b: Point, c: Point, tint: string) => {
    const color = new THREE.Color(tint);
    positions.push(...a, ...b, ...c);
    for (let i = 0; i < 3; i++) colors.push(color.r, color.g, color.b);
  };
  // Four folded hull panels, an open trough, and the upright centre fold.
  // Separate triangle normals preserve the crisp creases of folded paper.
  triangle(bow, keel, left, '#e7d6b6');
  triangle(left, keel, stern, '#f4e8ce');
  triangle(bow, right, keel, '#fff4df');
  triangle(stern, keel, right, '#eadcc0');
  triangle(bow, left, innerLeft, '#fcf1db');
  triangle(left, stern, innerLeft, '#e3cfaa');
  triangle(bow, innerRight, right, '#e8d8b8');
  triangle(stern, right, innerRight, '#fff6e5');
  triangle(frontFold, peakLeft, backFold, '#fff9ea');
  triangle(backFold, peakRight, frontFold, '#dfc9a2');
  triangle(frontFold, innerLeft, peakLeft, '#f0e0bf');
  triangle(backFold, peakRight, innerRight, '#f7eacd');
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const creases = new THREE.BufferGeometry();
  creases.setAttribute('position', new THREE.Float32BufferAttribute([
    ...bow, ...left, ...left, ...stern, ...stern, ...right, ...right, ...bow,
    ...frontFold, ...peakLeft, ...peakLeft, ...backFold,
  ], 3));
  return { geometry, creases };
}

export function PaperBoat({ boat, width, paused, onRetire }: {
  boat: BoatLaunch; width: number; paused: boolean; onRetire: (id: number) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const wake = useRef<THREE.Group>(null);
  const paper = useRef<THREE.MeshStandardMaterial>(null);
  const ink = useRef<THREE.LineBasicMaterial>(null);
  const ripples = useRef<THREE.MeshBasicMaterial>(null);
  const age = useRef(0), retired = useRef(false);
  const { geometry, creases } = useMemo(foldedPaper, []);
  const startX = boat.lateral * Math.max(.1, bankEdge(boat.z, width) - BOAT_MARGIN);

  useFrame((_, dt) => {
    if (!group.current || retired.current) return;
    if (!paused) age.current += Math.min(dt, .05);
    const t = age.current;
    if (t >= LIFETIME) {
      retired.current = true; onRetire(boat.id); return;
    }
    const z = boat.z - t * .82;
    const channel = Math.max(.1, bankEdge(z, width) - BOAT_MARGIN);
    // The current gradually carries a boat towards the centre. Normalised
    // placement also keeps it inside the banks when the viewport changes.
    const x = THREE.MathUtils.clamp(boat.lateral * channel * Math.exp(-t * .035)
      + (Math.sin(t * .48 + boat.id) - Math.sin(boat.id)) * .07, -channel, channel);
    group.current.position.set(x, .04 + Math.sin(t * 1.7) * .013, z);
    group.current.rotation.set(Math.sin(t * 1.4) * .025, .24 + Math.sin(t * .32) * .12, Math.sin(t * 1.1) * .035);
    const opacity = Math.min(1, (LIFETIME - t) / 5);
    if (paper.current) paper.current.opacity = opacity;
    if (ink.current) ink.current.opacity = .32 * opacity;
    if (wake.current) {
      wake.current.position.set(x, .018, z + .48);
      wake.current.scale.setScalar(1 + Math.sin(t * 1.2) * .05);
    }
    if (ripples.current) ripples.current.opacity = .12 * opacity;
  });

  return <>
    <group ref={group} name={`paper-boat-${boat.id}`} position={[startX, .04, boat.z]} rotation={[0, .24, 0]}>
      <mesh geometry={geometry} castShadow>
        <meshStandardMaterial ref={paper} vertexColors side={THREE.DoubleSide} roughness={1} transparent />
      </mesh>
      <lineSegments geometry={creases}>
        <lineBasicMaterial ref={ink} color="#8b795a" transparent opacity={.32} />
      </lineSegments>
    </group>
    <group ref={wake} name={`boat-wake-${boat.id}`} position={[startX, .018, boat.z + .48]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} scale={[.65, 1.3, 1]}>
        <ringGeometry args={[.45, .465, 40]} />
        <meshBasicMaterial ref={ripples} color="#f7f0d8" transparent opacity={.12} depthWrite={false} />
      </mesh>
    </group>
  </>;
}
