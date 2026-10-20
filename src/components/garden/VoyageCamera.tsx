import { useLayoutEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GARDEN_CAMERA } from './gardenGeometry';
import { cameraPose } from './cameraRig';
import { useJourney } from './JourneyProvider';

// Places the camera along the voyage (see cameraRig.ts) from the eased
// progress, ending on the dock's view.
export default function VoyageCamera({ mobile, width, visibleHeight }: { mobile: boolean; width: number; visibleHeight: number }) {
  const { camera, size } = useThree();
  const clock = useJourney();
  const target = useMemo(() => new THREE.Vector3(), []);
  useLayoutEffect(() => {
    const lens = camera as THREE.PerspectiveCamera;
    // The camera is manual: the lens frames the visible area and the view
    // offset extends the picture down over the rest of the canvas.
    lens.fov = mobile ? GARDEN_CAMERA.mobileFov : GARDEN_CAMERA.fov;
    lens.far = mobile ? GARDEN_CAMERA.mobileFar : GARDEN_CAMERA.far;
    lens.aspect = size.width / visibleHeight;
    lens.setViewOffset(size.width, visibleHeight, 0, 0, size.width, size.height);
    lens.updateProjectionMatrix();
  }, [camera, mobile, size.width, size.height, visibleHeight]);
  useFrame(() => {
    const { position, target: look } = cameraPose(clock.progress, width);
    camera.position.set(...position);
    camera.lookAt(target.set(...look));
  });
  return null;
}
