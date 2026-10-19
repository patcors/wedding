// The guest's own paper boat at the dock, with their Party's names on its
// card sail (guestBoat.ts). Only on a Personal link, or once one has been
// opened on this device (GardenPage remembers it as pa_party); the plain
// Garden shows no boat.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { readParty } from '../details/rsvp';
import { useJourney, type SlotProps } from './JourneyProvider';
import { GUEST_ARRIVAL, GUEST_BOAT, guestBoatPose, guestScale } from './guestBoat';
import { cardGeometry, cardTexture, guestHull } from './guestBoatGeometry';
import { sharpenFlag } from './storyBoatGeometry';

export function rememberedParty() {
  try { return readParty(localStorage.getItem('pa_party')); } catch { return null; }
}

// `height` is the visible height in px, for its size on a short screen (guestScale).
export default function GuestBoat(slot: SlotProps & { height?: number }) {
  const [party] = useState(rememberedParty);
  return party ? <Boat greeting={party.greeting} {...slot} /> : null;
}

function Boat({ greeting, width, height, paused }: SlotProps & { greeting: string; height?: number }) {
  const clock = useJourney();
  const group = useRef<THREE.Group>(null), card = useRef<THREE.Group>(null);
  const model = useMemo(() => ({ ...guestHull(), card: cardGeometry(), names: cardTexture(greeting) }), [greeting]);
  useEffect(() => () => { model.geometry.dispose(); model.creases.dispose(); model.card.dispose(); model.names.dispose(); }, [model]);
  // The card's names go up to the GPU now, not as the boat first shows near the wedding.
  const gl = useThree(state => state.gl);
  useEffect(() => gl.initTexture(model.names), [gl, model]);
  const time = useRef(0);
  useFrame((_, dt) => {
    const boat = group.current;
    if (!boat || !card.current) return;
    // Most of the voyage it hasn't set off: nothing to place.
    if (clock.progress < GUEST_ARRIVAL.from) { boat.visible = false; return; }
    const pose = guestBoatPose(clock.progress, width, height);
    boat.visible = pose.shown;
    if (!pose.shown) return;
    if (!paused) time.current += Math.min(dt, .05);
    const t = time.current;
    // A gentle bob, keel just under the water as the guests' boats keep it.
    boat.position.set(pose.x, -.02 + Math.sin(t * 1.5) * .008, pose.z);
    boat.rotation.set(Math.sin(t * 1.2) * .02, pose.yaw, Math.sin(t * .95 + 1) * .03);
    card.current.rotation.y = pose.card;
  });
  return <group ref={group} name="guest-boat" visible={false} scale={guestScale(width, height)}>
    <mesh geometry={model.geometry}>
      <meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={1} />
    </mesh>
    <lineSegments geometry={model.creases}>
      <lineBasicMaterial color="#8b795a" transparent opacity={.32} />
    </lineSegments>
    <group ref={card} position={[0, GUEST_BOAT.foot, 0]}>
      <mesh geometry={model.card}>
        {/* A little of its own light, so the names still read in the dusk. */}
        <meshStandardMaterial map={model.names} emissive="#ffffff" emissiveMap={model.names} emissiveIntensity={.18}
          side={THREE.DoubleSide} roughness={1} onBeforeCompile={sharpenFlag} />
      </mesh>
    </group>
  </group>;
}
