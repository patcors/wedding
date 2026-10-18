// Every year of the voyage, 2017 to 2027, marked once in the scenery as the
// boats enter it, each in its own medium: a signpost, a carved rock, a buoy, a
// milestone, a garden stake, an old pile, a slate on a landing, a paper
// lantern, stone steps, a garden arch and the wedding's heart on a post (see
// yearMarkerSpots.ts for where and when). Each is drawn only from a little way
// ahead of the camera, dissolving in out of the haze, until just past it, so
// only one or two cost anything at a time.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useJourney } from '../JourneyProvider';
import type { SlotProps } from '../JourneyProvider';
import { YEAR_MARKERS, yearMarkerShown, yearMarkerSpot } from './yearMarkerSpots';
import { yearAtlas, yearMarkerModel } from './yearMarkerGeometry';

export default function YearMarkers({ paused, mobile, width }: SlotProps) {
  const clock = useJourney();
  const models = useMemo(() => YEAR_MARKERS.map(yearMarkerModel), []);
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
    models.forEach(({ body, face, hanging }) => { body.dispose(); face?.dispose(); hanging?.body.dispose(); hanging?.face.dispose(); });
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
      if (!group) return;
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
      const { body, face, hanging } = models[i], spot = spots[i];
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
