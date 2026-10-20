// Every year of the voyage, 2017 to 2027, marked once in the scenery as the
// boats enter it, each in its own medium: a signpost, a carved rock, a buoy, a
// year carved into a tree's bark, a garden stake, an old pile, a slate on a landing, a paper
// lantern, an oar, a garden arch and the wedding's heart on a post (see
// yearMarkerSpots.ts for where and when). Each is drawn only from a little way
// ahead of the camera, dissolving in out of the haze, until just past it, so
// only one or two cost anything at a time.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useJourney } from '../JourneyProvider';
import type { SlotProps } from '../JourneyProvider';
import { TREE_MODELS } from '../GardenTrees';
import { YEAR_MARKERS, markerSide, yearCarving, yearMarkerShown, yearMarkerSpot, type YearCarving, type YearMarker } from './yearMarkerSpots';
import { yearAtlas, yearCarvingTextures, yearMarkerModel } from './yearMarkerGeometry';
import { barkPatchGeometry, treeMatrix } from './barkCarvingGeometry';
import { treeMesh } from './BarkCarvings';

// A year carved into a real tree's bark: a patch laid on the trunk's own
// faces, as the university years' carvings are (BarkCarvings.tsx), dissolving
// in and out as the other markers do. One draw call, a dozen triangles.
function CarvedYear({ marker, mobile, width }: { marker: YearMarker & { carved: YearCarving }; mobile: boolean; width: number }) {
  const clock = useJourney();
  const models = useGLTF(TREE_MODELS);
  const { tree, carving } = useMemo(() => yearCarving(marker, width), [marker, width]);
  const spot = useMemo(() => yearMarkerSpot(marker, width), [marker, width]);
  const geometry = useMemo(() => {
    const branches = (models[tree.type].nodes.branches as THREE.Mesh).geometry;
    return barkPatchGeometry(treeMesh(branches), { matrix: treeMatrix(tree), toward: { x: spot.x + Math.sin(spot.yaw), z: spot.z + Math.cos(spot.yaw) }, arc: carving.arc, from: carving.from, to: carving.to });
  }, [models, tree, carving, spot]);
  // Pale cut wood, a shade brighter than the university years', as a year must read.
  const material = useMemo(() => {
    const { map, bumpMap } = yearCarvingTextures(marker.year);
    return new THREE.MeshStandardMaterial({ map, bumpMap, bumpScale: 1.5, color: '#ebe2d4', roughness: .95, transparent: true,
      depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  }, [marker.year]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => { material.map?.dispose(); material.bumpMap?.dispose(); material.dispose(); }, [material]);
  const mesh = useRef<THREE.Mesh>(null);
  useFrame(({ camera }) => {
    if (!mesh.current) return;
    const shown = yearMarkerShown(marker, tree.z, clock.progress, camera.position.z, mobile);
    mesh.current.visible = shown > 0;
    material.opacity = shown;
  });
  return <mesh ref={mesh} name={`year-${marker.year}`} geometry={geometry} material={material} visible={false} receiveShadow />;
}

export default function YearMarkers({ paused, mobile, width }: SlotProps) {
  const clock = useJourney();
  const models = useMemo(() => YEAR_MARKERS.map((marker, i) => marker.medium === 'carving' ? null : yearMarkerModel({ ...marker, medium: marker.medium }, i, markerSide(marker, width))), [width]);
  // Each marker has its own pair of materials, to dissolve on its own; they
  // share one shader. Hashed alpha fades the solid body without sorting.
  const { atlas, materials } = useMemo(() => {
    const atlas = yearAtlas();
    return { atlas, materials: YEAR_MARKERS.map(() => ({
      body: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, alphaHash: true }),
      // The lettering sits just proud of its surface.
      face: new THREE.MeshStandardMaterial({ map: atlas, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 }),
    })) };
  }, []);
  useEffect(() => () => {
    models.forEach(model => { model?.body.dispose(); model?.face?.dispose(); model?.hanging?.body.dispose(); model?.hanging?.face.dispose(); });
    materials.forEach(({ body, face }) => { body.dispose(); face.dispose(); });
    atlas.dispose();
  }, [models, materials, atlas]);
  const spots = useMemo(() => YEAR_MARKERS.map(marker => yearMarkerSpot(marker, width)), [width]);
  const groups = useRef<(THREE.Group | null)[]>([]);
  const lanterns = useRef<(THREE.Group | null)[]>([]);
  const time = useRef(0);

  useFrame(({ camera }, dt) => {
    if (!paused) time.current += Math.min(dt, .1);
    const t = time.current;
    YEAR_MARKERS.forEach((marker, i) => {
      const group = groups.current[i], spot = spots[i];
      if (!group || !models[i]) return;
      const shown = yearMarkerShown(marker, spot.z, clock.progress, camera.position.z, mobile);
      group.visible = shown > 0;
      if (!group.visible) return;
      materials[i].body.opacity = materials[i].face.opacity = shown;
      // The buoy rides the river's swell; the lantern sways a little on its hook.
      if (marker.medium === 'buoy') {
        group.position.y = spot.y + Math.sin(t * 1.3) * .035;
        group.rotation.set(Math.sin(t * 1.1) * .06, spot.yaw, Math.sin(t * .8 + 1) * .07);
      }
      const lantern = lanterns.current[i];
      if (lantern) lantern.rotation.set(Math.sin(t * .9) * .05, 0, Math.sin(t * .7 + 2) * .06);
    });
  });

  return <group name="year-markers">
    {YEAR_MARKERS.map((marker, i) => {
      if ('carved' in marker) return <CarvedYear key={marker.year} marker={marker} mobile={mobile} width={width} />;
      const { body, face, hanging } = models[i]!, spot = spots[i];
      return <group key={marker.year} name={`year-${marker.year}`} ref={el => { groups.current[i] = el; }} visible={false}
        position={[spot.x, spot.y, spot.z]} rotation={[0, spot.yaw, 0]} scale={spot.scale}>
        <mesh geometry={body} material={materials[i].body} receiveShadow />
        {face && <mesh geometry={face} material={materials[i].face} receiveShadow />}
        {hanging && <group position={hanging.pivot} ref={el => { lanterns.current[i] = el; }}>
          <mesh geometry={hanging.body} material={materials[i].body} receiveShadow />
          <mesh geometry={hanging.face} material={materials[i].face} />
        </group>}
      </group>;
    })}
  </group>;
}
