import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { plantGeometry, plantSites, type PlantKind } from './gardenPlantGeometry';
import { configureGrassMaterial } from './gardenGrassMaterial';

function PlantBatch({ kind, width, mobile, paused, visible }: {
  kind: PlantKind; width: number; mobile: boolean; paused: boolean; visible: boolean;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => plantGeometry(kind), [kind]);
  const sites = useMemo(() => plantSites(kind, width, mobile), [kind, width, mobile]);
  const wind = useMemo(() => ({ value: 0 }), []);
  const material = useMemo(() => {
    const result = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: .95 });
    result.name = `garden-plant-${kind}`;
    result.onBeforeCompile = shader => {
      shader.uniforms.plantTime = wind;
      shader.vertexShader = `uniform float plantTime;\n${shader.vertexShader}`.replace('#include <begin_vertex>', `
        #include <begin_vertex>
        vec3 plantRoot = instanceMatrix[3].xyz;
        float breeze = sin(plantTime * 1.1 + plantRoot.x * .65 + plantRoot.z * .38);
        transformed.x += breeze * position.y * position.y * .13;
        transformed.z += sin(plantTime * .8 + plantRoot.z * .46) * position.y * position.y * .07;
      `);
    };
    result.customProgramCacheKey = () => 'garden-plant-wind-1';
    if (kind === 'meadow') configureGrassMaterial(result, wind, mobile);
    return result;
  }, [kind, wind, mobile]);
  useLayoutEffect(() => {
    const dummy = new THREE.Object3D(), color = new THREE.Color();
    sites.forEach((site, i) => {
      dummy.position.set(site.x, site.y, site.z);
      dummy.rotation.set(0, site.angle, 0);
      if (kind === 'meadow') dummy.scale.set(.85 + site.tint * .35, site.scale, .8 + site.scale * .3);
      else dummy.scale.setScalar(site.scale);
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(i, dummy.matrix);
      mesh.current!.setColorAt(i, color.setRGB(site.tint, site.tint, site.tint * .96));
    });
    mesh.current!.instanceMatrix.needsUpdate = true;
    if (mesh.current!.instanceColor) mesh.current!.instanceColor!.needsUpdate = true;
    mesh.current!.computeBoundingSphere();
    // Include the taller reeds' wind displacement at frustum boundaries.
    mesh.current!.boundingSphere!.radius += .4;
  }, [sites, kind]);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  useFrame((_, dt) => { if (!paused && visible) wind.value += Math.min(dt, .05); });
  return <instancedMesh key={sites.length} name={`garden-plants-${kind}`} ref={mesh}
    args={[geometry, material, sites.length]} visible={visible} receiveShadow />;
}

export default function GardenPlants(props: { width: number; mobile: boolean; paused: boolean; visible: boolean }) {
  return <>{(['grass', 'clover', 'fern', 'meadow', 'reed', 'cattail'] as const).map(kind => <PlantBatch key={kind} kind={kind} {...props} />)}</>;
}
