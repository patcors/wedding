// Their working lives as still ornaments on the banks (see careerSpots.ts for
// where and when): candlestick posts for the internship year, and a round
// flower bed planted in a pie chart's slices for working together at
// HeirWealth.
// Each dissolves in as the year markers do and goes once the camera has
// passed it, so at most one or two cost anything at a time.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useJourney } from '../JourneyProvider';
import type { SlotProps } from '../JourneyProvider';
import { ORNAMENTS, PIE, PIE_BED, candleBoxes, groundUnder, ornamentShown, ornamentSpot } from './careerSpots';
import { flowerHeadGeometry, pieBedGeometry, pieFlowers } from './careerGeometry';

// Painted posts, the wicks a dark iron.
const PAINT = { rising: '#4f9a5b', falling: '#c64a3f', wick: '#34322c' };

export default function Careers({ mobile, width }: SlotProps) {
  const clock = useJourney();
  const boxes = useMemo(candleBoxes, []);
  const spots = useMemo(() => ORNAMENTS.map(ornament => ornamentSpot(ornament, width)), [width]);
  // The bed lies on the bank's slope where it stands.
  const ground = useMemo(() => groundUnder(spots[ORNAMENTS.indexOf(PIE_BED)], width), [spots, width]);
  const flowers = useMemo(() => pieFlowers(ground), [ground]);
  const parts = useMemo(() => ({
    box: new THREE.BoxGeometry(1, 1, 1).deleteAttribute('uv'),
    head: flowerHeadGeometry(),
  }), []);
  const bed = useMemo(() => pieBedGeometry(ground), [ground]);
  useEffect(() => () => bed.dispose(), [bed]);
  // Hashed alpha dissolves each without sorting, as the year markers do.
  const materials = useMemo(() => ({
    paint: new THREE.MeshStandardMaterial({ roughness: .7, alphaHash: true }),
    bed: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, alphaHash: true }),
    petals: new THREE.MeshStandardMaterial({ roughness: .8, alphaHash: true }),
  }), []);
  useEffect(() => () => {
    Object.values(parts).forEach(part => part.dispose());
    Object.values(materials).forEach(material => material.dispose());
  }, [parts, materials]);
  const groups = useRef<(THREE.Group | null)[]>([]);
  const candles = useRef<THREE.InstancedMesh>(null);
  const heads = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D(), colour = new THREE.Color();
    boxes.forEach((box, i) => {
      dummy.position.set(box.x, box.y, 0);
      dummy.scale.set(box.width, box.height, box.width);
      dummy.updateMatrix();
      candles.current?.setMatrixAt(i, dummy.matrix);
      candles.current?.setColorAt(i, colour.set(box.wick ? PAINT.wick : box.rising ? PAINT.rising : PAINT.falling));
    });
    flowers.forEach((flower, i) => {
      // Turned up to the camera, as flowers turn to the light.
      dummy.position.set(flower.x, flower.y, flower.z);
      dummy.scale.setScalar(flower.size);
      dummy.rotation.set(PIE.face, i * 1.3, 0);
      dummy.updateMatrix();
      heads.current?.setMatrixAt(i, dummy.matrix);
      heads.current?.setColorAt(i, flower.colour);
    });
    // The bed follows the ground, so a new width moves its flowers.
    if (heads.current) heads.current.instanceMatrix.needsUpdate = true;
    if (heads.current?.instanceColor) heads.current.instanceColor.needsUpdate = true;
  }, [boxes, flowers]);

  useFrame(({ camera }) => {
    const p = clock.progress;
    ORNAMENTS.forEach((ornament, i) => {
      const group = groups.current[i];
      if (!group) return;
      const shown = ornamentShown(ornament, spots[i], p, camera.position.z, mobile);
      group.visible = shown > 0;
      if (i === 0) materials.paint.opacity = shown;
      if (i === 1) materials.bed.opacity = materials.petals.opacity = shown;
    });
  });

  const place = (i: number) => ({ ref: (el: THREE.Group | null) => { groups.current[i] = el; }, visible: false,
    position: [spots[i].x, spots[i].y, spots[i].z] as const, rotation: [0, spots[i].yaw, 0] as const, scale: spots[i].scale });
  return <group name="careers">
    <group name="candlesticks" {...place(0)}>
      <instancedMesh ref={candles} args={[parts.box, materials.paint, boxes.length]} frustumCulled={false} receiveShadow />
    </group>
    <group name="pie-bed" {...place(1)}>
      <mesh geometry={bed} material={materials.bed} receiveShadow />
      <instancedMesh ref={heads} args={[parts.head, materials.petals, flowers.length]} frustumCulled={false} receiveShadow />
    </group>
  </group>;
}
