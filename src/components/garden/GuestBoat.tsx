// The guests' own sloops (or paper boats, a Review choice: `look`), one for
// each guest with their first name on its card sail (guestBoat.ts), coming in
// to the dock with the catamaran.
// Only on a Personal link, or once one has been opened on this device
// (GardenPage remembers it as pa_party); the plain Garden shows none.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { readParty } from '../details/rsvp';
import { useJourney, type SlotProps } from './JourneyProvider';
import { GUEST_ARRIVAL, guestArrivalCap, guestArrivalStep, guestBerths, guestFleetPosesAt, guestNames, guestRig, guestScale } from './guestBoat';
import { cardGeometry, cardTexture, guestBoatHull } from './guestBoatGeometry';
import { BOAT_LOOK, type GuestLook } from './boatLookChoices';
import { sharpenFlag } from './storyBoatGeometry';

export function rememberedParty() {
  try { return readParty(localStorage.getItem('pa_party')); } catch { return null; }
}
// The first names the remembered Party's boats carry, or none.
export const rememberedNames = () => guestNames(rememberedParty()?.guests ?? []);

// `height` is the visible height in px, for their size on a short screen (guestScale).
export default function GuestBoat({ look = BOAT_LOOK.guest, ...slot }: SlotProps & { height?: number; look?: GuestLook }) {
  const [names] = useState(rememberedNames);
  return names.length ? <Fleet names={names} look={look} {...slot} /> : null;
}

// Each boat's own rocking: a phase and a pace a little apart, so they bob out of step.
const ROCK = [{ phase: 0, pace: 1 }, { phase: 2.1, pace: .87 }, { phase: 4.3, pace: 1.12 }, { phase: 1.2, pace: .94 }];

function Fleet({ names, look, width, height, paused, reduced }: SlotProps & { names: string[]; look: GuestLook; height?: number }) {
  const clock = useJourney();
  const boats = useRef<(THREE.Group | null)[]>([]), cards = useRef<(THREE.Group | null)[]>([]);
  // Each boat's mast and card: every other one stands on a tall mast (guestBerths).
  const rigs = useMemo(() => guestBerths(names.length, width, height).map(({ tall }) => guestRig(tall, width, height, names.length, look)), [names, width, height, look]);
  // The hull (one for each height of mast), its creases and the card, shared
  // by every boat, and each one's name.
  const model = useMemo(() => {
    const tops = [...new Set(rigs.map(rig => rig.top))], built = tops.map(top => guestBoatHull(look, rigs.find(rig => rig.top === top)!));
    for (const { creases } of built.slice(1)) creases?.dispose();
    return {
      hulls: rigs.map(rig => built[tops.indexOf(rig.top)].geometry), creases: built[0].creases, card: cardGeometry(), names: names.map(name => cardTexture(name)),
      hull: new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 1 }),
      lines: new THREE.LineBasicMaterial({ color: '#8b795a', transparent: true, opacity: .32 }),
    };
  }, [names, rigs, look]);
  // Each card a little of its own light, so the names still read in the dusk.
  const faces = useMemo(() => model.names.map(({ texture: map }) => {
    const material = new THREE.MeshStandardMaterial({ map, emissive: '#ffffff', emissiveMap: map, emissiveIntensity: .18, side: THREE.DoubleSide, roughness: 1 });
    material.onBeforeCompile = sharpenFlag;
    return material;
  }), [model]);
  useEffect(() => () => {
    for (const hull of new Set(model.hulls)) hull.dispose();
    model.creases?.dispose(); model.card.dispose(); model.hull.dispose(); model.lines.dispose();
    for (const { texture } of model.names) texture.dispose();
    for (const face of faces) face.dispose();
  }, [model, faces]);
  // The names go up to the GPU now, not as the boats first show near the wedding.
  const gl = useThree(state => state.gl);
  useEffect(() => { for (const { texture } of model.names) gl.initTexture(texture); }, [gl, model]);
  const time = useRef(0);
  // How far into their arrival they are, in seconds (guestFleetPosesAt), and the progress last frame.
  const scene = useRef({ time: 0, last: -1 });
  useFrame((_, dt) => {
    const p = clock.progress, arrival = scene.current;
    // Most of the voyage they haven't set off: nothing to place.
    if (p < GUEST_ARRIVAL.cue) {
      for (const boat of boats.current) if (boat) boat.visible = false;
      Object.assign(arrival, { time: 0, last: p });
      return;
    }
    // Their scene plays in real time, as far as the scroll allows: once the
    // catamaran is tied up, all the way in, with no more scrolling. A still,
    // or a jump (the monogram's "Back to the beginning", say), finds it as far
    // in as the scroll allows; scrolling back takes them back (guestArrivalStep).
    const step = paused ? 0 : Math.min(dt, .05);
    arrival.time = reduced || Math.abs(p - arrival.last) > .02 ? guestArrivalCap(p, names.length, width, height)
      : guestArrivalStep(arrival.time, p, arrival.last, step, names.length, width, height);
    arrival.last = p;
    time.current += step;
    const t = time.current;
    guestFleetPosesAt(arrival.time, names.length, width, height).forEach((pose, i) => {
      const boat = boats.current[i], card = cards.current[i];
      if (!boat || !card) return;
      boat.visible = pose.shown;
      // A gentle bob, keel just under the water as the guests' boats keep it.
      const { phase, pace } = ROCK[i % ROCK.length], s = t * pace + phase;
      boat.position.set(pose.x, -.02 + Math.sin(s * 1.5) * .008, pose.z);
      boat.rotation.set(Math.sin(s * 1.2) * .02, pose.yaw, Math.sin(s * .95 + 1) * .03);
      card.rotation.y = pose.card;
    });
  });
  const scale = guestScale(width, height, names.length);
  return <>{names.map((name, i) => <group key={`${i}-${name}`} ref={el => { boats.current[i] = el; }} name="guest-boat" visible={false} scale={scale}>
    <mesh geometry={model.hulls[i]} material={model.hull} />
    {model.creases && <lineSegments geometry={model.creases} material={model.lines} />}
    <group ref={el => { cards.current[i] = el; }} position={[0, rigs[i].foot, 0]} scale={rigs[i].card}>
      {/* Just in front of the mast, so the mast never shows through the name;
          a sloop's flies from it by its left edge, just clear of the mast. */}
      <mesh geometry={model.card} material={faces[i]} position={[rigs[i].flies ? model.names[i].width / 2 + .016 : 0, 0, .02]} scale={[model.names[i].width, 1, 1]} />
    </group>
  </group>)}</>;
}
