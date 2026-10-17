// November 2017, their first trip away with friends, down the coast: friends'
// paper boats are tossed in from both banks just ahead of the two boats, sail
// along with them and gather round them under a few strings of lights, then
// sail on or fall behind. Every November or December after it until 2023 a
// few more come and go for a while, and in 2019 they gather again. Courses
// in coastTrips.ts. One draw call for the boats (each tinted with its
// friend's paper, FRIENDS), and two more for the lights while they are up.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { foldedPaper } from '../paperBoatGeometry';
import { useJourney } from '../JourneyProvider';
import { COAST_TRIPS, FLEET, FRIENDS, LAUNCH, MOST_STRINGS, lightsAt, paperScale, throwSpot, tripSpan, tripTime, visitorSpot, visitorYaw } from './coastTrips';
import { eggTime, type EggProps } from './egg';

// Room for every visitor of every trip, so trips that overlap still fit.
const CAPACITY = COAST_TRIPS.reduce((sum, trip) => sum + trip.visitors.length, 0);
// Each string sags in a curve of SEGMENTS lines with BULBS lights along it,
// hung from the peaks of the boats' centre folds (model height PEAK).
const SEGMENTS = 8, BULBS = 3, PEAK = .55;

// The guests' folded paper boat, its upright centre fold marked to take a
// friend's trim. Each friend's paper and trim are per instance; `fade`
// fades a boat out as it sails away or falls behind.
function paperFleet() {
  const { geometry, creases } = foldedPaper();
  creases.dispose();
  const position = geometry.attributes.position, trimmed = new Float32Array(position.count);
  for (let i = 0; i < position.count; i += 3) {
    const fold = Math.max(position.getY(i), position.getY(i + 1), position.getY(i + 2)) > .3 ? 1 : 0;
    trimmed.fill(fold, i, i + 3);
  }
  geometry.setAttribute('trimmed', new THREE.BufferAttribute(trimmed, 1));
  geometry.setAttribute('trim', new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY * 4), 4));
  geometry.setAttribute('fade', new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY).fill(1), 1));
  const paper = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 1, transparent: true });
  paper.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float trimmed;\nattribute vec4 trim;\nattribute float fade;\nvarying float vFade;')
      .replace('#include <color_vertex>', '#include <color_vertex>\nvColor.rgb = mix(vColor.rgb, color * trim.rgb, trimmed * trim.a);\nvFade = fade;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vFade;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vFade;');
  };
  paper.customProgramCacheKey = () => 'voyage-friends-paper-1';
  return { geometry, paper };
}

export default function FriendsFleet({ milestone, paused, reduced, width }: EggProps) {
  const clock = useJourney();
  const group = useRef<THREE.Group>(null);
  const boats = useRef<THREE.InstancedMesh>(null);
  const strings = useRef<THREE.LineSegments>(null);
  const bulbs = useRef<THREE.InstancedMesh>(null);
  const parts = useMemo(() => {
    const fleet = paperFleet();
    const line = new THREE.BufferGeometry();
    line.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MOST_STRINGS * SEGMENTS * 6), 3));
    return {
      ...fleet, line,
      cord: new THREE.LineBasicMaterial({ color: '#6f604c', transparent: true, opacity: 0 }),
      bulb: new THREE.IcosahedronGeometry(.032, 0),
      glow: new THREE.MeshBasicMaterial({ color: '#ffd58a', toneMapped: false }),
    };
  }, []);
  useEffect(() => () => Object.values(parts).forEach(part => part.dispose()), [parts]);
  const colours = useMemo(() => FRIENDS.map(({ paper, trim }) => ({ paper: new THREE.Color(paper), trim: trim ? new THREE.Color(trim) : null })), []);
  const spans = useMemo(() => COAST_TRIPS.map(tripSpan), []);
  const throws = useMemo(() => COAST_TRIPS.map(trip => trip.visitors.map(visitor => visitor.launch ? throwSpot(trip, visitor, width) : null)), [width]);
  // Seconds each launched boat has been in the air or water since it was
  // tossed, or null while it waits behind the bank.
  const thrown = useRef(COAST_TRIPS.map(trip => trip.visitors.map((): number | null => null)));
  const idle = useRef(0);
  const scale = paperScale(width);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const peaks = useMemo(() => Array.from({ length: CAPACITY }, () => new THREE.Vector3()), []);
  // The paper colours exist from the first frame, so the material is built with them.
  useLayoutEffect(() => {
    for (let i = 0; i < CAPACITY; i++) boats.current?.setColorAt(i, new THREE.Color(1, 1, 1));
  }, []);

  useFrame((_, dt) => {
    if (!group.current || !boats.current || !strings.current || !bulbs.current) return;
    const p = clock.progress, step = paused ? 0 : Math.min(dt, .1);
    idle.current += step;
    const s = idle.current;
    const trim = parts.geometry.getAttribute('trim') as THREE.InstancedBufferAttribute;
    const fade = parts.geometry.getAttribute('fade') as THREE.InstancedBufferAttribute;
    const line = parts.line.getAttribute('position') as THREE.BufferAttribute;
    let count = 0, cords = 0, lights = 0, level = 0;
    COAST_TRIPS.forEach((trip, k) => {
      // Reduced motion shows only the first trip, at rest at its milestone's still.
      const first = trip.month === milestone.month;
      if (reduced && !first) return;
      const t = first ? eggTime(milestone, p, reduced, FLEET.settled) : tripTime(trip, p);
      if (reduced && t !== FLEET.settled) return;
      if (t < spans[k].from || t > spans[k].to + .1) {
        thrown.current[k].fill(null);
        return;
      }
      const at: (number | null)[] = [];
      trip.visitors.forEach((visitor, i) => {
        const spot = visitorSpot(trip, visitor, t, p, width, s);
        if (!spot || spot.shown <= 0) {
          thrown.current[k][i] = null;
          at.push(null);
          return;
        }
        const phase = visitor.friend * 2.4 + i;
        let { x, z } = spot, y = -.012 + Math.sin(s * 1.7 + phase) * .007, tumble = 0;
        // Tossed in from behind the bank, in real time, so it never hangs in
        // the air when the guest stops; already in if the scroll jumped past.
        const from = throws[k][i];
        if (visitor.launch && from) {
          let air = thrown.current[k][i];
          air = air === null ? (reduced || t > visitor.launch.at + .1 ? 10 : 0) : air + step;
          thrown.current[k][i] = air;
          const f = Math.min(1, air / LAUNCH.flight);
          if (f < 1) {
            x = from.x + (x - from.x) * f; z = from.z + (z - from.z) * f;
            y = from.y + (y - from.y) * f + LAUNCH.arc * 4 * f * (1 - f);
            tumble = (1 - f) * .9;
          }
        }
        dummy.position.set(x, y, z);
        dummy.rotation.set(Math.sin(s * 1.4 + phase) * .03 + tumble, visitorYaw(trip, visitor, t, p, width, s), Math.sin(s * 1.1 + phase * 1.3) * .04);
        dummy.scale.setScalar(scale);
        dummy.updateMatrix();
        boats.current!.setMatrixAt(count, dummy.matrix);
        const colour = colours[visitor.friend];
        boats.current!.setColorAt(count, colour.paper);
        if (colour.trim) trim.setXYZW(count, colour.trim.r, colour.trim.g, colour.trim.b, 1);
        else trim.setW(count, 0);
        fade.setX(count, spot.shown);
        peaks[count].set(x, y + PEAK * scale, z);
        at.push(count++);
      });
      // Strings of lights between the boats at a party.
      const up = lightsAt(trip, t);
      if (!trip.party || up <= 0) return;
      level = up;
      trip.party.strings.forEach(([a, b]) => {
        const ia = at[a], ib = at[b];
        if (ia === null || ib === null) return;
        const from = peaks[ia], to = peaks[ib], sag = Math.min(.12, from.distanceTo(to) * .06);
        const point = (u: number) => dummy.position.lerpVectors(from, to, u).setY(from.y + (to.y - from.y) * u - sag * 4 * u * (1 - u));
        for (let j = 0; j < SEGMENTS; j++) {
          const v = cords * SEGMENTS * 2 + j * 2;
          const a0 = point(j / SEGMENTS);
          line.setXYZ(v, a0.x, a0.y, a0.z);
          const a1 = point((j + 1) / SEGMENTS);
          line.setXYZ(v + 1, a1.x, a1.y, a1.z);
        }
        for (let j = 1; j <= BULBS; j++) {
          const twinkle = 1 + Math.sin(s * 2.3 + lights * 1.9) * .12;
          // Each bulb hangs just below its string.
          point(j / (BULBS + 1)).y -= .025;
          dummy.rotation.set(0, 0, 0);
          dummy.scale.setScalar(up * twinkle);
          dummy.updateMatrix();
          bulbs.current!.setMatrixAt(lights++, dummy.matrix);
        }
        cords++;
      });
    });
    group.current.visible = count > 0;
    boats.current.count = count;
    boats.current.instanceMatrix.needsUpdate = true;
    if (boats.current.instanceColor) boats.current.instanceColor.needsUpdate = true;
    trim.needsUpdate = fade.needsUpdate = true;
    strings.current.visible = bulbs.current.visible = cords > 0;
    parts.line.setDrawRange(0, cords * SEGMENTS * 2);
    line.needsUpdate = true;
    parts.cord.opacity = .6 * level;
    bulbs.current.count = lights;
    bulbs.current.instanceMatrix.needsUpdate = true;
  });

  return <group ref={group} name="friends-fleet" visible={false}>
    <instancedMesh ref={boats} args={[parts.geometry, parts.paper, CAPACITY]} frustumCulled={false} />
    <lineSegments ref={strings} args={[parts.line, parts.cord]} frustumCulled={false} visible={false} />
    <instancedMesh ref={bulbs} args={[parts.bulb, parts.glow, MOST_STRINGS * BULBS]} frustumCulled={false} visible={false} />
  </group>;
}
