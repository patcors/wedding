import { useMemo, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import { chunkSpan, inReach } from './gardenGeometry';

// Hides a batch of instances while its stretch of river is out of the camera's
// reach (see riverChunks). One instanced batch for the whole river would be
// drawn from end to end on every frame.
export function useRiverReach(object: RefObject<THREE.Object3D | null>, items: { z: number }[]) {
  const span = useMemo(() => chunkSpan(items), [items]);
  useFrame(({ camera }) => {
    if (object.current) object.current.visible = inReach(span, camera.position.z, (camera as THREE.PerspectiveCamera).far);
  });
}
