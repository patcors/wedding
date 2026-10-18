// Late 2025's rocket (see rocketLaunch.ts): the Bullet rocket, a bullet of a
// rocket. A brass casing with a rim and a groove at its
// foot, a copper nose, four swept fins in darker brass and a dark nozzle, in
// one mesh with vertex colours, about 520 triangles; it stands on its fins
// at y 0, about .97 tall, its nose up +y. Its launch stand is a wooden
// trestle on a stone pad with a slim launch rod, about 110 triangles, facing
// +z with its deck at STAND.deck. The exhaust's puffs and flame share one
// small ball of a puff, 20 triangles.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

type Point = [number, number, number];
const BRASS = '#c39a4a', BRASS_DARK = '#8a6a2e', COPPER = '#b8683e', NOZZLE = '#3a3430';
const WOOD = '#8a7055', WOOD_DARK = '#6a563f', STONE = '#b9b2a2', ROD = '#9a9a94';
// The casing and nose as a profile, foot to tip: [radius, height]. The nose
// is an ogive from the casing's mouth (CASE_MOUTH) up.
const CASE_MOUTH = .53;
const PROFILE: [number, number][] = [[0, 0], [.085, 0], [.096, .018], [.096, .05], [.082, .062], [.082, .084], [.1, .1], [.1, .5], [.098, CASE_MOUTH],
  [.096, .6], [.088, .67], [.074, .74], [.054, .81], [.03, .87], [.008, .91], [0, .915]];
// Where it rests on its fins' feet: the casing's foot stands this high.
const LIFT = .055;
export const ROCKET_MODEL = { height: .915 + LIFT, radius: .1 };
export const STAND = { deck: .3, rod: 1.05 };

function painter() {
  const pieces: THREE.BufferGeometry[] = [];
  const c = new THREE.Color();
  const add = (geometry: THREE.BufferGeometry, colour: string | ((y: number) => string)) => {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    if (g !== geometry) geometry.dispose();
    g.deleteAttribute('uv');
    const p = g.attributes.position, colours: number[] = [];
    // Coloured a triangle at a time, so bands keep crisp edges.
    for (let i = 0; i < p.count; i += 3) {
      c.set(typeof colour === 'string' ? colour : colour((p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3));
      for (let k = 0; k < 3; k++) c.toArray(colours, (i + k) * 3);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
    pieces.push(g);
  };
  // A square beam from a to b.
  const beam = (a: Point, b: Point, size: number, colour: string) => {
    const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), length = from.distanceTo(to);
    const g = new THREE.BoxGeometry(size, length, size).translate(0, length / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize()));
    add(g.translate(from.x, from.y, from.z), colour);
  };
  const merge = () => {
    const geometry = mergeGeometries(pieces);
    pieces.forEach(piece => piece.dispose());
    geometry.computeVertexNormals();
    return geometry;
  };
  return { add, beam, merge };
}

export function rocketGeometry() {
  const { add, merge } = painter();
  // Brass up to the casing's mouth, the groove darker, the nose copper.
  const lathe = new THREE.LatheGeometry(PROFILE.map(([r, y]) => new THREE.Vector2(r, y)), 14);
  add(lathe, y => y > CASE_MOUTH ? COPPER : y > .06 && y < .09 ? BRASS_DARK : BRASS);
  add(new THREE.CylinderGeometry(.05, .066, .06, 10, 1, true).translate(0, .03 - LIFT, 0), NOZZLE);
  // Four fins swept back from the casing's foot, standing on their tips.
  const fin = new THREE.Shape([new THREE.Vector2(0, .3), new THREE.Vector2(0, .04), new THREE.Vector2(.12, -LIFT), new THREE.Vector2(.13, .03)]);
  for (let i = 0; i < 4; i++) {
    const g = new THREE.ExtrudeGeometry(fin, { depth: .014, bevelEnabled: false }).translate(.088, 0, -.007).rotateY(i * Math.PI / 2 + Math.PI / 4);
    add(g, BRASS_DARK);
  }
  return merge().translate(0, LIFT, 0);
}

// The stand: a stone pad, four splayed legs up to a small deck, and the
// launch rod beside it that the rocket rides up as it leaves.
export function launchStandGeometry() {
  const { add, beam, merge } = painter(), { deck, rod } = STAND;
  add(new THREE.BoxGeometry(.5, .06, .5).translate(0, .01, 0), STONE);
  for (const [x, z] of [[1, 1], [1, -1], [-1, -1], [-1, 1]]) beam([x * .19, .04, z * .19], [x * .11, deck - .02, z * .11], .03, WOOD_DARK);
  // A brace across the front and back.
  for (const z of [-1, 1]) beam([-.16, .14, z * .16], [.16, .14, z * .16], .022, WOOD);
  add(new THREE.BoxGeometry(.3, .03, .3).translate(0, deck - .015, 0), WOOD);
  beam([.16, deck, -.02], [.16, deck + rod, -.02], .012, ROD);
  return merge();
}

// A puff of smoke, or stretched tall, the flame: a low-poly ball, shaded
// smooth as a round one would be.
export function puffGeometry() {
  const geometry = new THREE.IcosahedronGeometry(1, 0), p = geometry.attributes.position;
  geometry.setAttribute('normal', p.clone());
  return geometry;
}
