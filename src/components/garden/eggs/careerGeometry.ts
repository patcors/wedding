// Models for the careers' ornaments on the banks (placed in careerSpots.ts): the
// rubber duck on its plinth and the pie-chart flower bed. The candlesticks are
// instanced boxes, laid out by candleBoxes. Each faces +z with its base at y 0.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { random } from '../gardenGeometry.ts';
import { simplifiedRubberDuck } from '../rubberDuckGeometry.ts';
import { PIE, WEDGES, wedgeAngles } from './careerSpots.ts';

const STONE = '#cfc8b6', STONE_DARK = '#9a9282';
const c = new THREE.Color();

// Pale stone, darker towards its foot, as on the π's plinth.
function stoneTint(geometry: THREE.BufferGeometry, top: number, foot = 0) {
  const stone = new THREE.Color(STONE), dark = new THREE.Color(STONE_DARK), p = geometry.attributes.position, tint: number[] = [];
  for (let i = 0; i < p.count; i++) {
    c.copy(dark).lerp(stone, THREE.MathUtils.clamp((p.getY(i) - foot) / (top - foot), 0, 1));
    tint.push(c.r, c.g, c.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(tint, 3));
}

// The plinth's size, in the duck's own units (it stands about .55 tall).
export const DUCK_PLINTH = { width: .66, height: .36 } as const;
// The guests' bath duck, the classic yellow toy with its orange beak, kept in
// more detail than the university's tossed ones as it is seen close by. It
// sits on its plinth turned three-quarters to the river on the camera's left,
// so the beak, the eye and the upturned tail show in profile.
export function duckStatueGeometry() {
  const duck = simplifiedRubberDuck(.22).rotateY(2.2).translate(0, DUCK_PLINTH.height - .02, 0);
  // A squat block with a narrower cap, sunk a little at its foot.
  const { width, height } = DUCK_PLINTH;
  const block = new THREE.BoxGeometry(width, height * .78, width).translate(0, height * .39 - .08, 0).toNonIndexed();
  const cap = new THREE.BoxGeometry(width * .9, height * .3, width * .9).translate(0, height * .85, 0).toNonIndexed();
  for (const box of [block, cap]) { box.deleteAttribute('uv'); stoneTint(box, height, -.08); }
  const plinth = mergeGeometries([block, cap]);
  block.dispose(); cap.dispose();
  return { duck, plinth };
}

const FOLIAGE = '#6f8a4f';
const height = (r: number) => PIE.rim + PIE.mound * (1 - (r / PIE.radius) ** 2);
// Where its edging runs down to, below the bed, so tilted it still meets the ground.
const FOOT = -.5;
// The raised bed as one mesh: each wedge a planter of its own, its top a
// mound of foliage tinted by its flowers, edged in stone. The pulled wedge
// stands out from the rest by PIE.pull. In the bed's frame, before its tilt.
export function pieBedGeometry() {
  const positions: number[] = [], colours: number[] = [];
  const stone = new THREE.Color(STONE), dark = new THREE.Color(STONE_DARK), foliage = new THREE.Color(FOLIAGE);
  const tri = (points: THREE.Vector3[], tints: THREE.Color[]) => points.forEach((point, i) => {
    positions.push(point.x, point.y, point.z);
    colours.push(tints[i].r, tints[i].g, tints[i].b);
  });
  const edging = (y: number) => dark.clone().lerp(stone, THREE.MathUtils.clamp((y - FOOT * .4) / (PIE.rim - FOOT * .4), 0, 1));
  const angles = wedgeAngles();
  WEDGES.forEach((wedge, w) => {
    const { from, to, middle } = angles[w];
    // Each wedge's apex sits a little out from the middle, so the gaps between them are even.
    const out = (wedge.pulled ? PIE.pull : 0) + PIE.gap * .8;
    const ox = Math.cos(middle) * out, oz = -Math.sin(middle) * out;
    const at = (angle: number, r: number, y: number) => new THREE.Vector3(ox + Math.cos(angle) * r, y, oz - Math.sin(angle) * r);
    const top = foliage.clone().lerp(new THREE.Color(wedge.flowers), .8);
    const n = Math.max(3, Math.round(wedge.share * 48));
    const a0 = from + PIE.gap / 2, a1 = to - PIE.gap / 2, reach = PIE.radius;
    for (let k = 0; k < n; k++) {
      const a = a0 + (a1 - a0) * k / n, b = a0 + (a1 - a0) * (k + 1) / n, half = reach / 2;
      const apex = at(middle, 0, height(0));
      // The planted top: a fan from the apex to halfway, then a band out to the rim.
      tri([apex, at(a, half, height(half)), at(b, half, height(half))], [top, top, top]);
      tri([at(a, half, height(half)), at(a, reach, PIE.rim), at(b, reach, PIE.rim)], [top, top, top]);
      tri([at(a, half, height(half)), at(b, reach, PIE.rim), at(b, half, height(half))], [top, top, top]);
      // The stone edging round the rim, down into the ground.
      tri([at(a, reach, PIE.rim), at(a, reach, FOOT), at(b, reach, FOOT)], [edging(PIE.rim), edging(FOOT), edging(FOOT)]);
      tri([at(a, reach, PIE.rim), at(b, reach, FOOT), at(b, reach, PIE.rim)], [edging(PIE.rim), edging(FOOT), edging(PIE.rim)]);
    }
    // The edging along each straight side, outward-facing, up to the mound.
    for (const [angle, flip] of [[a0, false], [a1, true]] as const) {
      const ring = [0, reach / 2, reach].map(r => [at(angle, r, r === reach ? PIE.rim : height(r)), at(angle, r, FOOT)]);
      for (let k = 0; k < 2; k++) {
        const [[t0, f0], [t1, f1]] = [ring[k], ring[k + 1]];
        const quad: [THREE.Vector3, THREE.Vector3, THREE.Vector3][] = [[t0, f0, f1], [t0, f1, t1]];
        for (const [p, q, r] of quad) tri(flip ? [p, r, q] : [p, q, r], [p, q, r].map(v => edging(v.y)));
      }
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  geometry.computeVertexNormals();
  return geometry;
}

// Flower heads scattered over each wedge, as many as its share, in the bed's
// frame: where each sits and its colour, a little lighter or darker than the
// wedge's.
export const FLOWER_HEADS = 100;
export function pieFlowers() {
  const rand = random(17), angles = wedgeAngles(), heads: { x: number; y: number; z: number; colour: THREE.Color }[] = [];
  WEDGES.forEach((wedge, w) => {
    const { from, to, middle } = angles[w];
    const out = (wedge.pulled ? PIE.pull : 0) + PIE.gap * .8, reach = PIE.radius;
    const count = Math.round(wedge.share * FLOWER_HEADS);
    for (let i = 0; i < count; i++) {
      // Even over the wedge's area, kept in from its edges.
      const r = reach * (.18 + .72 * Math.sqrt((i + rand()) / count));
      const angle = from + PIE.gap + (to - from - 2 * PIE.gap) * rand();
      heads.push({
        x: Math.cos(middle) * out + Math.cos(angle) * r, y: height(r) + .02, z: -Math.sin(middle) * out - Math.sin(angle) * r,
        colour: new THREE.Color(wedge.flowers).offsetHSL(0, .05, (rand() - .3) * .12),
      });
    }
  });
  return heads;
}
// A flower head: five petals round a raised eye, as a shallow open cone.
export const flowerHeadGeometry = () => new THREE.ConeGeometry(.075, .03, 5, 1, true).deleteAttribute('uv');
