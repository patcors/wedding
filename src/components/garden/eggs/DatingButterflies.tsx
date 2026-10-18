// August 2024, they start dating: butterflies circle the boats as they come
// together (see datingFlight.ts). In the scene rather than over the page, so
// they pass behind the sails and keep with the boats as the camera moves.
// Each wears the page's butterfly artwork (butterflyWing.ts), its wings two
// cards hinged at the body, beating as the page's butterflies do
// (butterflyMotion.ts). Eight draw calls while they fly, none otherwise.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BUTTERFLY_COLORS } from '../butterflyColors';
import { butterflyMotion } from '../butterflyMotion';
import { WING } from '../butterflyWing';
import { BOAT_SCALE, boatPose } from '../storyBoats';
import { useJourney, type SlotProps } from '../JourneyProvider';
import { FLYERS, courtshipTime, flightPoint, flying, perch } from './datingFlight';

// Each wing card is half the artwork's viewBox: 50 wide by 100 long.
const CELL = { width: 128, height: 256 };
// A wing's length, nose to tail, in world units: well larger than life,
// so they read beside the boats, and larger again on a phone's wider lens.
const SIZE = { desktop: .55, mobile: .7 };
// Half raised, as the page's butterflies rest on a letter.
const RESTING_FOLD = 55;

// The left wing of each flyer's colour, side by side, from the page's artwork.
function wingAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = CELL.width * FLYERS.length; canvas.height = CELL.height;
  const ctx = canvas.getContext('2d')!, scale = CELL.width / 50;
  FLYERS.forEach(({ colour }, i) => {
    ctx.save();
    ctx.translate(i * CELL.width, 0); ctx.scale(scale, scale);
    const palette = BUTTERFLY_COLORS[colour], { from, to, stops } = WING.gradient;
    const gradient = ctx.createLinearGradient(from[0], from[1], to[0], to[1]);
    stops.forEach((offset, k) => gradient.addColorStop(offset, palette[k]));
    for (const { edge, fill } of [WING.forewing, WING.hindwing]) {
      ctx.fillStyle = WING.edgeColour; ctx.fill(new Path2D(edge));
      ctx.fillStyle = gradient; ctx.fill(new Path2D(fill));
    }
    ctx.lineWidth = .7; ctx.strokeStyle = WING.veinColour; ctx.globalAlpha = .45; ctx.stroke(new Path2D(WING.veins));
    ctx.lineWidth = 1.4; ctx.strokeStyle = WING.spotColour; ctx.globalAlpha = .7; ctx.stroke(new Path2D(WING.spots));
    // Half the body along the hinge; the other wing carries the other half.
    ctx.globalAlpha = 1; ctx.fillStyle = '#16222d';
    for (const [x, y, rx, ry] of [[50, 55, 2, 14], [50, 45, 3, 5], [50, 39, 2.7, 2.7]]) {
      ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// A wing card lying flat, hinged along the body at x 0, its tip forward (−z).
function wingGeometry(index: number, side: -1 | 1) {
  const geometry = new THREE.PlaneGeometry(.5, 1).translate(side * .25, 0, 0).rotateX(-Math.PI / 2);
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, (index + (side < 0 ? uv.getX(i) : 1 - uv.getX(i))) / FLYERS.length);
  return geometry;
}

export default function DatingButterflies({ paused, reduced, mobile, width }: SlotProps) {
  const clock = useJourney();
  const { atlas, material, wings } = useMemo(() => {
    const atlas = wingAtlas();
    return {
      atlas,
      material: new THREE.MeshBasicMaterial({ map: atlas, alphaTest: .5, side: THREE.DoubleSide }),
      wings: FLYERS.map((_, i) => [wingGeometry(i, -1), wingGeometry(i, 1)] as const),
    };
  }, []);
  useEffect(() => () => { atlas.dispose(); material.dispose(); wings.flat().forEach(wing => wing.dispose()); }, [atlas, material, wings]);
  const pair = useRef<THREE.Group>(null);
  const bodies = useRef<(THREE.Group | null)[]>([]);
  const lefts = useRef<(THREE.Mesh | null)[]>([]), rights = useRef<(THREE.Mesh | null)[]>([]);
  const state = useMemo(() => FLYERS.map((_, i) => ({ wing: i * 1.3, heading: 0 })), []);
  const idle = useRef(0);
  const ahead = useMemo(() => new THREE.Vector3(), []);
  const light = useMemo(() => new THREE.Color(), []);

  useFrame(({ scene }, dt) => {
    const group = pair.current;
    if (!group) return;
    const t = courtshipTime(clock.progress), still = reduced && Math.abs(t) < 1e-6;
    group.visible = still || FLYERS.some(flyer => flying(flyer, t));
    if (!group.visible) return;
    const step = paused ? 0 : Math.min(dt, .05);
    idle.current += step;
    const s = idle.current, pose = boatPose(clock.progress, width);
    group.position.set(pose.x, 0, pose.z);
    group.rotation.y = pose.yaw;
    group.scale.setScalar(1);
    // Lit like the morning around them: a touch of the haze's colour.
    if (scene.fog instanceof THREE.Fog) material.color.copy(light.set('#ffffff').lerp(scene.fog.color, .25));
    FLYERS.forEach((flyer, i) => {
      const body = bodies.current[i], left = lefts.current[i], right = rights.current[i];
      if (!body || !left || !right) return;
      const rest = still ? perch(flyer, pose.gap * BOAT_SCALE) : null;
      body.visible = still ? !!rest : flying(flyer, t);
      if (!body.visible) return;
      body.scale.setScalar(mobile ? SIZE.mobile : SIZE.desktop);
      if (rest) {
        // Side by side on the bows, facing forward, wings half raised.
        body.position.set(...rest);
        body.rotation.set(0, (flyer.partner ?? 1) * .5, 0);
        left.rotation.z = -RESTING_FOLD * Math.PI / 180;
        right.rotation.z = RESTING_FOLD * Math.PI / 180;
        return;
      }
      const seed = i * 1.7 + .4, own = state[i];
      const motion = butterflyMotion(s, seed, own.wing);
      own.wing += step * motion.rate * Math.PI * 2;
      const [x, y, z] = flightPoint(flyer, s, t);
      body.position.set(x, y + motion.y * .004, z);
      // Facing the way it's flying, nose a little up, banking with its wander.
      ahead.set(...flightPoint(flyer, s + .08, t)).sub(body.position);
      if (ahead.lengthSq() > 1e-8) own.heading = Math.atan2(-ahead.x, -ahead.z);
      body.rotation.set((motion.pitch * .3) * Math.PI / 180, own.heading, motion.bank * Math.PI / 180, 'YXZ');
      left.rotation.z = -motion.left * Math.PI / 180;
      right.rotation.z = motion.right * Math.PI / 180;
    });
  });

  return <group ref={pair} name="dating-butterflies" visible={false}>
    {FLYERS.map((flyer, i) => <group key={flyer.colour} ref={el => { bodies.current[i] = el; }}>
      <mesh ref={el => { lefts.current[i] = el; }} geometry={wings[i][0]} material={material} />
      <mesh ref={el => { rights.current[i] = el; }} geometry={wings[i][1]} material={material} />
    </group>)}
  </group>;
}
