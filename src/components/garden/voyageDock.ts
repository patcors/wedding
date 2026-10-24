// The jetty under the old tree, and the festoon lights strung in its crown.
// Pure, so it can be tested.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LAUNCH_JETTY, groundHeight, launchJetties, random, voyageLandmarks } from './gardenGeometry.ts';

// `beyond`: where the head ends, from the jetty's reach. It ran .25 past it,
// and the moored catamaran's near hull ran in under the head's end with the
// lantern post up through its deck (Amelia, October 2026); now the head stops
// a little short and the catamaran moors a little further out, so the hull
// lies a hand's width off it (tests/storyBoats.test.mjs).
export const JETTY = { deck: .36, breadth: .95, landing: 1.3, head: 2.5, headDepth: .62, beyond: -.05 } as const;

// A small weathered jetty: planks laid across two bearers on pairs of piles,
// running from a landing on the bank out to a T-shaped head where the
// catamaran moors alongside, tied to a bollard at each end of the head. A
// lantern post stands at one corner. One merged mesh, coloured per part.
export function jettyGeometry(width = 1) {
  const { jetty } = voyageLandmarks(width);
  const rand = random(4423), parts: THREE.BufferGeometry[] = [], color = new THREE.Color();
  const end = jetty.reach + JETTY.beyond, half = JETTY.breadth / 2, head = JETTY.head / 2;
  // `along` runs from the bank out over the water.
  const worldX = (along: number) => jetty.x - jetty.side * along;
  const add = (geometry: THREE.BufferGeometry, along: number, y: number, z: number, shade: string) => {
    geometry.translate(worldX(along), y, jetty.z + z);
    color.set(shade).multiplyScalar(.9 + rand() * .2);
    const colors = new Float32Array(geometry.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) color.toArray(colors, i);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    parts.push(geometry);
  };
  const plank = .17, gap = .028;
  for (let along = -JETTY.landing; along < end; along += plank + gap) {
    const span = along > end - JETTY.headDepth ? JETTY.head : JETTY.breadth;
    const box = new THREE.BoxGeometry(plank, .05, span + (rand() - .5) * .06);
    box.rotateY((rand() - .5) * .03);
    add(box, along + plank / 2, JETTY.deck - .025 + (rand() - .5) * .012, (rand() - .5) * .03, rand() < .2 ? '#8a7860' : '#a08a6a');
  }
  for (const z of [-half + .1, half - .1]) {
    const bearer = new THREE.BoxGeometry(end + JETTY.landing, .1, .09);
    add(bearer, (end - JETTY.landing) / 2, JETTY.deck - .1, z, '#6f5f4b');
  }
  for (const along of [end - JETTY.headDepth + .1, end - .1]) add(new THREE.BoxGeometry(.09, .1, JETTY.head), along, JETTY.deck - .1, 0, '#6f5f4b');
  // Piles stand on the bank's edge and in the water, with a pair under each
  // end of the head; one of those rises above the deck to carry the lantern.
  const pile = (along: number, z: number, top: number) => {
    const ground = along < 0 ? groundHeight(worldX(along), jetty.z + z, width) : -.7;
    add(new THREE.CylinderGeometry(.065, .075, top - ground, 7), along, (top + ground) / 2, z, '#75644f');
  };
  const piers = Math.max(0, Math.round((end - JETTY.headDepth - .35) / .9));
  for (const along of [-.6, .35, ...Array.from({ length: piers }, (_, i) => end - JETTY.headDepth - i * .9)]) {
    for (const z of [-half - .02, half + .02]) pile(along, z, JETTY.deck + .02);
  }
  for (const along of [end - JETTY.headDepth + .08, end - .08]) {
    for (const z of [-head - .02, head + .02]) pile(along, z, JETTY.deck + (along === end - .08 && z < 0 ? .95 : .02));
  }
  // Bollards near each end of the head, with mooring lines dipping slackly
  // down to the catamaran's near hull, which lies just off the head.
  for (const z of [-head + .28, head - .28]) {
    add(new THREE.CylinderGeometry(.06, .075, .2, 8), end - .2, JETTY.deck + .1, z, '#5d5142');
    const from = new THREE.Vector3(worldX(end - .2), JETTY.deck + .17, jetty.z + z);
    const to = new THREE.Vector3(worldX(jetty.reach + .55), .22, jetty.z + z * 1.25);
    const middle = from.clone().lerp(to, .5).setY(Math.min(from.y, to.y) - .1);
    const line = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(from, middle, to), 8, .014, 4, false);
    line.translate(-worldX(0), 0, -jetty.z);
    add(line, 0, 0, 0, '#cbbd9c');
  }
  const geometry = mergeGeometries(parts);
  parts.forEach(part => part.dispose());
  return geometry;
}

// Posts around the jetty's footprint over the water, for guests' boats to bump
// off (see boatPhysics' stems). They're set close, so the jetty's sides are
// smooth, and slippery, so a hull pressed against it by the current slides
// along and round the end rather than sticking there.
export function jettyStems(width = 1) {
  const { jetty } = voyageLandmarks(width);
  const end = jetty.reach + JETTY.beyond, neck = end - JETTY.headDepth, half = JETTY.breadth / 2, head = JETTY.head / 2;
  const outline: [number, number][] = [[0, half], [neck, half], [neck, head], [end, head], [end, -head], [neck, -head], [neck, -half], [0, -half]];
  const stems: { x: number; z: number; radius: number; grip: number }[] = [];
  outline.slice(1).forEach(([along, z], i) => {
    const [fromAlong, fromZ] = outline[i], steps = Math.ceil(Math.hypot(along - fromAlong, z - fromZ) / .1);
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      stems.push({ x: jetty.x - jetty.side * (fromAlong + (along - fromAlong) * t), z: jetty.z + fromZ + (z - fromZ) * t, radius: .12, grip: 0 });
    }
  });
  return stems;
}

// Whether a point over the water lies under the jetty.
export function underJetty(x: number, z: number, width = 1) {
  const { jetty } = voyageLandmarks(width);
  const along = (jetty.x - x) * jetty.side, end = jetty.reach + JETTY.beyond;
  return along > -.2 && along < end && Math.abs(z - jetty.z) < (along > end - JETTY.headDepth ? JETTY.head : JETTY.breadth) / 2;
}

// Where the jetty's lantern hangs, from the taller post at the head's corner.
export function jettyLantern(width = 1) {
  const { jetty } = voyageLandmarks(width);
  return new THREE.Vector3(jetty.x - jetty.side * (jetty.reach + JETTY.beyond - .08), JETTY.deck + 1.03, jetty.z - JETTY.head / 2 - .02);
}

// The little jetties the boats set out from, in the dock's weathered wood at
// a smaller scale: a short neck of planks from a landing on the bank to a
// head along the bank, on piles, with a lantern post. Amelia's has a single
// bollard and her lantern at the head's downstream corner, its post caps
// painted her teal; Patrick's is longer, with a bollard at each end of the
// head and his lantern back by the bank, its caps his yellow. `along` runs
// from the bank out over the water, `z` along the bank from the jetty's middle.
// Things on the head are placed by z as a share of its length; the lantern is
// [z, along], with along < 0 on the landing and otherwise at the head's edge.
export const LAUNCH_DECK = .28;
const LAUNCH_STYLE: Record<number, { cap: string; bollards: number[]; posts: number[]; lantern: [number, number] }> = {
  [-1]: { cap: '#86aaa1', bollards: [-.28], posts: [.42], lantern: [-.46, 1] },
  [1]: { cap: '#e0c87f', bollards: [-.4, .4], posts: [], lantern: [.17, -.3] },
};
type LaunchJetty = ReturnType<typeof launchJetties>[number];
const launchStyle = (jetty: LaunchJetty) => LAUNCH_STYLE[jetty.side];
// Where things on a jetty's head are, as `along` from the bank: the head's
// outer edge less an inset.
const onHead = (jetty: LaunchJetty, inset: number) => jetty.reach - inset;

export function launchJettyGeometry(width = 1) {
  const rand = random(7121), parts: THREE.BufferGeometry[] = [], color = new THREE.Color();
  for (const jetty of launchJetties(width)) {
    const style = launchStyle(jetty), neck = jetty.reach - jetty.headDepth, half = LAUNCH_JETTY.neck / 2, head = jetty.head / 2;
    const worldX = (along: number) => jetty.x - jetty.side * along;
    const add = (geometry: THREE.BufferGeometry, along: number, y: number, z: number, shade: string) => {
      geometry.translate(worldX(along), y, jetty.z + z);
      color.set(shade).multiplyScalar(.9 + rand() * .2);
      const colors = new Float32Array(geometry.attributes.position.count * 3);
      for (let i = 0; i < colors.length; i += 3) color.toArray(colors, i);
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      parts.push(geometry);
    };
    const plank = .13, gap = .022;
    for (let along = -LAUNCH_JETTY.landing; along < jetty.reach - plank / 2; along += plank + gap) {
      const span = along + plank > neck ? jetty.head : LAUNCH_JETTY.neck;
      const box = new THREE.BoxGeometry(plank, .04, span + (rand() - .5) * .05);
      box.rotateY((rand() - .5) * .04);
      add(box, along + plank / 2, LAUNCH_DECK - .02 + (rand() - .5) * .01, (rand() - .5) * .025, rand() < .2 ? '#8a7860' : '#a08a6a');
    }
    for (const z of [-half + .07, half - .07]) add(new THREE.BoxGeometry(neck + LAUNCH_JETTY.landing, .08, .07), (neck - LAUNCH_JETTY.landing) / 2, LAUNCH_DECK - .08, z, '#6f5f4b');
    for (const along of [neck + .07, jetty.reach - .07]) add(new THREE.BoxGeometry(.07, .08, jetty.head), along, LAUNCH_DECK - .08, 0, '#6f5f4b');
    const pile = (along: number, z: number, top: number, cap?: string) => {
      const ground = along < 0 ? groundHeight(worldX(along), jetty.z + z, width) : -.6;
      add(new THREE.CylinderGeometry(.05, .058, top - ground, 7), along, (top + ground) / 2, z, '#75644f');
      if (cap) add(new THREE.CylinderGeometry(.062, .062, .05, 7), along, top + .02, z, cap);
    };
    // Piles under the landing's edge and each corner of the head; the outer
    // ones stand a little proud of the deck with painted caps.
    for (const z of [-half, half]) pile(-.35, z, LAUNCH_DECK);
    for (const along of [neck + .05, jetty.reach - .05]) {
      for (const z of [-head, head]) pile(along, z, LAUNCH_DECK + (along > neck + .05 || neck < .1 ? .12 : 0), along > neck + .05 || neck < .1 ? style.cap : undefined);
    }
    for (const z of style.posts) pile(onHead(jetty, .05), z * jetty.head, LAUNCH_DECK + .12, style.cap);
    for (const z of style.bollards) add(new THREE.CylinderGeometry(.045, .055, .14, 8), onHead(jetty, .14), LAUNCH_DECK + .07, z * jetty.head, '#5d5142');
    // The lantern's post, with a little dark hood over where the light hangs.
    const [z, along] = style.lantern, at = along < 0 ? along : onHead(jetty, .12);
    pile(at, z * jetty.head, LAUNCH_DECK + .62);
    add(new THREE.ConeGeometry(.07, .07, 6), at, LAUNCH_DECK + .7, z * jetty.head, '#4a4036');
  }
  const geometry = mergeGeometries(parts);
  parts.forEach(part => part.dispose());
  return geometry;
}

// Where each launch jetty's lantern hangs, under its hood.
export function launchLanterns(width = 1) {
  return launchJetties(width).map(jetty => {
    const [z, along] = launchStyle(jetty).lantern, at = along < 0 ? along : onHead(jetty, .12);
    return new THREE.Vector3(jetty.x - jetty.side * at, LAUNCH_DECK + .63, jetty.z + z * jetty.head);
  });
}

// The lines that hold each boat to its jetty until it casts off: from the
// bollards (or the post) at the head's ends to the boat's bow and stern, given
// where the boat's hull lies off the head (its centre's x and z) and its
// length (bow at −, stern at +, in world units).
export function mooringLines(width: number, berth: (side: number) => { x: number; z: number }, bow: number, stern: number) {
  const parts = launchJetties(width).flatMap(jetty => {
    const style = launchStyle(jetty), boat = berth(jetty.side);
    const ties = [...style.bollards.map(z => ({ along: onHead(jetty, .14), z })), ...style.posts.map(z => ({ along: onHead(jetty, .05), z }))];
    return ties.map(({ along, z }) => {
      const from = new THREE.Vector3(jetty.x - jetty.side * along, LAUNCH_DECK + .12, jetty.z + z * jetty.head);
      // Downstream ties go to the bow, upstream to the stern.
      const to = new THREE.Vector3(boat.x + jetty.side * .2, .2, boat.z + (z < 0 ? bow : stern));
      const middle = from.clone().lerp(to, .5).setY(Math.min(from.y, to.y) - .08);
      return new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(from, middle, to), 8, .011, 4, false);
    });
  });
  const geometry = mergeGeometries(parts);
  parts.forEach(part => part.dispose());
  return geometry;
}

// Posts round each launch jetty over the water, as for the dock's jetty. Its
// upstream side slants from the bank out to the head, so a boat the current
// carries along the bank glances off it into the channel rather than lodging
// in the corner.
export function launchJettyStems(width = 1) {
  const stems: { x: number; z: number; radius: number; grip: number }[] = [];
  for (const jetty of launchJetties(width)) {
    const neck = jetty.reach - jetty.headDepth, half = LAUNCH_JETTY.neck / 2, head = jetty.head / 2;
    const outline: [number, number][] = [[0, head + .5], [jetty.reach, head], [jetty.reach, -head], [neck, -head], [neck, -half], [0, -half]];
    outline.slice(1).forEach(([along, z], i) => {
      const [fromAlong, fromZ] = outline[i], steps = Math.ceil(Math.hypot(along - fromAlong, z - fromZ) / .1);
      for (let k = 0; k < steps; k++) {
        const t = k / steps;
        stems.push({ x: jetty.x - jetty.side * (fromAlong + (along - fromAlong) * t), z: jetty.z + fromZ + (z - fromZ) * t, radius: .1, grip: 0 });
      }
    });
  }
  return stems;
}

// Whether a point over the water lies under a launch jetty.
export function underLaunchJetty(x: number, z: number, width = 1) {
  return launchJetties(width).some(jetty => {
    const along = (jetty.x - x) * jetty.side;
    return along > -.2 && along < jetty.reach && Math.abs(z - jetty.z) < (along > jetty.reach - jetty.headDepth ? jetty.head : LAUNCH_JETTY.neck) / 2;
  });
}

// Festoon lights: strands swung from the trunk out to the tips of the lower
// limbs, and a ring of swags between those tips around the crown's edge. The
// crown is measured at desktop scale and shrinks with the tree.
export const FESTOON = { trunk: 4.3, height: 4.9, radius: 7.2, strands: 9, sag: .55, spacing: .5 } as const;

export function festoonStrands(width: number, scale: number) {
  const { tree } = voyageLandmarks(width);
  const rand = random(9187), base = groundHeight(tree.x, tree.z, width);
  const centre = new THREE.Vector3(tree.x, base + FESTOON.trunk * scale, tree.z);
  const tips = Array.from({ length: FESTOON.strands }, (_, i) => {
    const angle = i / FESTOON.strands * Math.PI * 2 + rand() * .3;
    const radius = FESTOON.radius * scale * (.85 + rand() * .25);
    return new THREE.Vector3(tree.x + Math.cos(angle) * radius, base + (FESTOON.height + (rand() - .5) * .6) * scale, tree.z + Math.sin(angle) * radius);
  });
  return [...tips.map(tip => [centre, tip]), ...tips.map((tip, i) => [tip, tips[(i + 1) % tips.length]])] as [THREE.Vector3, THREE.Vector3][];
}

// Points along a hanging strand, sagging most in the middle.
export function sagPoints(a: THREE.Vector3, b: THREE.Vector3, sag: number, spacing: number) {
  const count = Math.max(2, Math.round(a.distanceTo(b) / spacing));
  return Array.from({ length: count + 1 }, (_, i) => {
    const t = i / count;
    return a.clone().lerp(b, t).setY(a.y + (b.y - a.y) * t - sag * 4 * t * (1 - t));
  });
}
