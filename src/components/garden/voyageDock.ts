// The jetty under the old tree, and the festoon lights strung in its crown.
// Pure, so it can be tested.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { groundHeight, random, voyageLandmarks } from './gardenGeometry.ts';

export const JETTY = { deck: .36, breadth: .95, landing: 1.3, head: 2.5, headDepth: .62 } as const;

// A small weathered jetty: planks laid across two bearers on pairs of piles,
// running from a landing on the bank out to a T-shaped head where the
// catamaran moors alongside, tied to a bollard at each end of the head. A
// lantern post stands at one corner. One merged mesh, coloured per part.
export function jettyGeometry(width = 1) {
  const { jetty } = voyageLandmarks(width);
  const rand = random(4423), parts: THREE.BufferGeometry[] = [], color = new THREE.Color();
  const end = jetty.reach + .25, half = JETTY.breadth / 2, head = JETTY.head / 2;
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

// Where the jetty's lantern hangs, from the taller post at the head's corner.
export function jettyLantern(width = 1) {
  const { jetty } = voyageLandmarks(width);
  return new THREE.Vector3(jetty.x - jetty.side * (jetty.reach + .17), JETTY.deck + 1.03, jetty.z - JETTY.head / 2 - .02);
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
