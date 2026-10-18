// The university years: two old trunks across the river from each other
// early in 2019, carved with what they studied, statistics on Amelia's bank
// and algebra on Patrick's (placed in uniOrnaments.ts, built in
// carvedTrunkGeometry.ts). Still scenery, dissolving in out of the haze like
// the year markers and gone once the camera has passed. Both stumps are one
// mesh: one draw call, about 900 triangles; they cast a shadow, as the π does.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { SlotProps } from '../JourneyProvider';
import { markerShown } from './yearMarkerSpots';
import { ORNAMENTS, ornamentSpot } from './uniOrnaments';
import { carvedTrunkTextures, carvedTrunksGeometry, type Carving } from './carvedTrunkGeometry';

const TRUNKS: { carving: Carving; ornament: typeof ORNAMENTS.statsTrunk | typeof ORNAMENTS.algebraTrunk }[] = [
  { carving: 'stats', ornament: ORNAMENTS.statsTrunk },
  { carving: 'algebra', ornament: ORNAMENTS.algebraTrunk },
];
// Half a stump's width at its roots, so it stands on the lowest ground under them.
const FOOTPRINT = .6;

export default function CarvedTrunks({ mobile, width }: SlotProps) {
  const spots = useMemo(() => TRUNKS.map(({ ornament }) => ornamentSpot(ornament, width, FOOTPRINT)), [width]);
  const geometry = useMemo(() => carvedTrunksGeometry(TRUNKS.map(({ carving }, i) => {
    const { x, y, z, yaw, scale } = spots[i];
    return { carving, matrix: new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(scale, scale, scale)) };
  })), [spots]);
  const material = useMemo(() => {
    const { map, bumpMap } = carvedTrunkTextures();
    return new THREE.MeshStandardMaterial({ map, bumpMap, bumpScale: 2.5, vertexColors: true, roughness: .95, alphaHash: true });
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => { material.map?.dispose(); material.bumpMap?.dispose(); material.dispose(); }, [material]);
  const mesh = useRef<THREE.Mesh>(null);

  useFrame(({ camera }) => {
    if (!mesh.current) return;
    const shown = Math.max(...spots.map(spot => markerShown(spot.z, camera.position.z, mobile)));
    mesh.current.visible = shown > 0;
    material.opacity = shown;
  });

  return <mesh ref={mesh} name="carved-trunks" geometry={geometry} material={material} visible={false} castShadow receiveShadow />;
}
