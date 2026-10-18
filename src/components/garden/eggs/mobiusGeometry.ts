// A Möbius strip in weathered bronze, a companion to July 2017's π (see
// piSculptureGeometry.ts, whose bronze and plinth it shares): a broad band
// standing on its edge in a loop on a stone plinth, like a ring turned to
// face the front, with its half twist gathered into the right side of the
// loop, where it turns edge on and over, so from the river it reads as a
// band that comes back round with its other face out. One mesh with vertex
// colours, about 1,050 triangles. It faces +z; the plinth's base is at y 0.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { stonePlinth, weatheredBronze } from './piSculptureGeometry.ts';

export const MOBIUS = { radius: .5, band: .2, thickness: .04, segments: 64, turn: .35 } as const;
export const MOBIUS_PLINTH = { width: .82, height: .5, depth: .5 };
// Round the band's section, from one edge across a face to the other edge
// and back, so a half turn round it is the same section upside down.
const SECTION = [0, 30, 90, 150, 180, 210, 270, 330].map(d => d * Math.PI / 180);

export function mobiusGeometry() {
  const { radius, band, thickness, segments, turn } = MOBIUS, sides = SECTION.length;
  const base = MOBIUS_PLINTH.height + radius + band;
  const positions: number[] = [], normals: number[] = [], index: number[] = [];
  const centre = new THREE.Vector3(), out = new THREE.Vector3(), across = new THREE.Vector3(), through = new THREE.Vector3();
  const z = new THREE.Vector3(0, 0, 1), p = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < segments; i++) {
    // Round the loop from its foot, up the right side first; the band turns
    // its half turn on the way up that side and lies face on everywhere else.
    const u = -Math.PI / 2 + i / segments * Math.PI * 2, twist = Math.PI * THREE.MathUtils.smootherstep(i / segments, .04, .46);
    out.set(Math.cos(u), Math.sin(u), 0);
    centre.copy(out).multiplyScalar(radius).setY(base + radius * Math.sin(u));
    across.copy(out).multiplyScalar(Math.cos(twist)).addScaledVector(z, Math.sin(twist));
    through.copy(out).multiplyScalar(-Math.sin(twist)).addScaledVector(z, Math.cos(twist));
    for (const a of SECTION) {
      p.copy(centre).addScaledVector(across, band * Math.cos(a)).addScaledVector(through, thickness * Math.sin(a));
      n.copy(across).multiplyScalar(Math.cos(a) / band).addScaledVector(through, Math.sin(a) / thickness).normalize();
      positions.push(p.x, p.y, p.z);
      normals.push(n.x, n.y, n.z);
    }
  }
  for (let i = 0; i < segments; i++) for (let j = 0; j < sides; j++) {
    // The last ring meets the first half way round its section: the half twist.
    const next = (i + 1) % segments, shift = next === 0 ? sides / 2 : 0;
    const a = i * sides + j, b = i * sides + (j + 1) % sides;
    const c = next * sides + (j + shift) % sides, d = next * sides + (j + 1 + shift) % sides;
    index.push(a, c, b, b, c, d);
  }
  const strip = new THREE.BufferGeometry();
  strip.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  strip.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  strip.setIndex(index);
  // Turned a little on its plinth, so the loop is seen in depth from the front.
  const loop = weatheredBronze(strip.toNonIndexed().rotateY(turn));
  strip.dispose();
  const [block, cap] = stonePlinth(MOBIUS_PLINTH);
  const geometry = mergeGeometries([loop, block, cap])!;
  [loop, block, cap].forEach(g => g.dispose());
  return geometry;
}
