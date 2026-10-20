// The university years: distribution curves carved into the bark of a tree on
// Amelia's bank and the quadratic formula into one on Patrick's, small, like
// initials cut into a trunk; and four more further down the river, a sloop,
// a golden spiral, two sloops side by side and a heart with P + A (which
// trees, and where on them, in uniOrnaments.ts; the patch and its carving in
// barkCarvingGeometry.ts). Each is drawn only while its tree is near the
// camera, much as the year markers are, so at most two at a time, and the
// heart not before November 2026, when it dissolves in with 2027's heart. One draw
// call each, 8 to 28 triangles; no shadows cast.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useJourney, type SlotProps } from '../JourneyProvider';
import { TREE_MODELS } from '../GardenTrees';
import { CARVINGS, carvedOn, carvedTree, carvingFaces, carvingShown, grownCut, type BarkCarving, type CarvingId } from './uniOrnaments';
import { barkCarvingTextures, barkPatchGeometry, treeMatrix, type TreeMesh } from './barkCarvingGeometry';

// The model's branches as plain arrays (its normals are stored packed).
export function treeMesh(geometry: THREE.BufferGeometry): TreeMesh {
  const position = geometry.attributes.position, normal = geometry.attributes.normal;
  const positions = new Float32Array(position.count * 3), normals = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    positions.set([position.getX(i), position.getY(i), position.getZ(i)], i * 3);
    normals.set([normal.getX(i), normal.getY(i), normal.getZ(i)], i * 3);
  }
  return { position: positions, normal: normals, index: geometry.index!.array };
}

function Carving({ id, width }: SlotProps & { id: CarvingId }) {
  const clock = useJourney();
  const models = useGLTF(TREE_MODELS);
  const carving: BarkCarving = useMemo(() => grownCut(CARVINGS[id], width), [id, width]);
  const tree = useMemo(() => carvedTree(carving, width), [carving, width]);
  const geometry = useMemo(() => {
    const branches = (models[tree.type].nodes.branches as THREE.Mesh).geometry;
    return barkPatchGeometry(treeMesh(branches), { matrix: treeMatrix(tree), toward: carvingFaces(carving, width), arc: carving.arc, from: carving.from, to: carving.to });
  }, [models, tree, carving, width]);
  // Pale cut wood, toned down a little so it stays a find on the bark.
  const material = useMemo(() => {
    const { map, bumpMap } = barkCarvingTextures(id);
    return new THREE.MeshStandardMaterial({ map, bumpMap, bumpScale: 1.5, color: '#e4dacb', roughness: .95, transparent: true,
      depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  }, [id]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => { material.map?.dispose(); material.bumpMap?.dispose(); material.dispose(); }, [material]);
  const mesh = useRef<THREE.Mesh>(null);

  useFrame(({ camera }) => {
    if (!mesh.current) return;
    const shown = carvingShown(tree, camera.position.z, clock.progress, carving.after);
    mesh.current.visible = shown > 0;
    material.opacity = shown;
  });

  return <mesh ref={mesh} name={`bark-carving-${id}`} geometry={geometry} material={material} visible={false} receiveShadow />;
}

export default function BarkCarvings(props: SlotProps) {
  return <>{(Object.keys(CARVINGS) as CarvingId[]).filter(id => carvedOn(CARVINGS[id], props.width)).map(id => <Carving key={id} id={id} {...props} />)}</>;
}
