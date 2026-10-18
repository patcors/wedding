// Models for the careers' ornaments on the banks (placed in careerSpots.ts): the
// pie chart's flower bed. The candlesticks are instanced boxes, laid out by
// candleBoxes. Each faces +z with its base at y 0.
import * as THREE from 'three';
import { random } from '../gardenGeometry.ts';
import { PIE, WEDGES, wedgeAngles } from './careerSpots.ts';

type Ground = (x: number, z: number) => number;

const SOIL = '#5b4a36', FOLIAGE = '#4b6136';
// A point in the bed at `angle` and `r` out from its middle, the bed running
// PIE.stretch longer towards the camera than across, `lift` above the ground.
function bedPoint(ground: Ground, angle: number, r: number, lift: number) {
  const x = Math.cos(angle) * r, z = -Math.sin(angle) * r * PIE.stretch;
  return new THREE.Vector3(x, ground(x, z) + lift, z);
}
// The bed as one mesh lying on the ground: a disc of dark soil and on it each
// wedge's low foliage, with bare soil between the wedges. In rings, so it
// follows the bank's slope; `ground` is its height under each point
// (careerSpots' groundUnder), level by default.
export function pieBedGeometry(ground: Ground = () => 0) {
  const positions: number[] = [], colours: number[] = [];
  const tri = (points: THREE.Vector3[], tint: THREE.Color) => points.forEach(point => {
    positions.push(point.x, point.y, point.z);
    colours.push(tint.r, tint.g, tint.b);
  });
  // A fan in rings between two angles, from the middle out to `reach`.
  const fan = (a0: number, a1: number, segments: number, reach: number, lift: number, tint: THREE.Color) => {
    const rings = [0, reach / 3, reach * 2 / 3, reach];
    for (let k = 0; k < segments; k++) {
      const a = a0 + (a1 - a0) * k / segments, b = a0 + (a1 - a0) * (k + 1) / segments;
      tri([bedPoint(ground, a, 0, lift), bedPoint(ground, a, rings[1], lift), bedPoint(ground, b, rings[1], lift)], tint);
      for (let ring = 1; ring < 3; ring++) {
        const [r0, r1] = [rings[ring], rings[ring + 1]];
        tri([bedPoint(ground, a, r0, lift), bedPoint(ground, a, r1, lift), bedPoint(ground, b, r1, lift)], tint);
        tri([bedPoint(ground, a, r0, lift), bedPoint(ground, b, r1, lift), bedPoint(ground, b, r0, lift)], tint);
      }
    }
  };
  fan(0, Math.PI * 2, 24, PIE.radius + .04, .03, new THREE.Color(SOIL));
  const foliage = new THREE.Color(FOLIAGE), angles = wedgeAngles();
  WEDGES.forEach((wedge, w) => {
    const { from, to } = angles[w];
    fan(from + PIE.gap / 2, to - PIE.gap / 2, Math.max(3, Math.round(wedge.share * 30)), PIE.radius, .05, foliage);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  geometry.computeVertexNormals();
  return geometry;
}

// Flower heads planted close over each wedge, as many as its share, in the
// bed's frame: where each sits, a little above the foliage, how large it is
// and its colour, a little lighter or darker than the wedge's.
export const FLOWER_HEADS = 210;
export function pieFlowers(ground: Ground = () => 0) {
  const rand = random(17), angles = wedgeAngles(), heads: { x: number; y: number; z: number; size: number; colour: THREE.Color }[] = [];
  WEDGES.forEach((wedge, w) => {
    const { from, to } = angles[w];
    const count = Math.round(wedge.share * FLOWER_HEADS);
    for (let i = 0; i < count; i++) {
      // Even over the wedge's area, kept in from its edges.
      const r = PIE.radius * (.06 + .9 * Math.sqrt((i + rand()) / count));
      const inset = Math.min(PIE.gap / 2 + .06 / r, (to - from) * .4);
      const at = bedPoint(ground, from + inset + (to - from - 2 * inset) * rand(), r, .07 + rand() * .05);
      heads.push({ x: at.x, y: at.y, z: at.z, size: .8 + rand() * .45, colour: new THREE.Color(wedge.flowers).offsetHSL(0, .04, (rand() - .4) * .12) });
    }
  });
  return heads;
}
// A flower head: five petals round a raised eye, as a shallow open cone.
export const flowerHeadGeometry = () => new THREE.ConeGeometry(.065, .022, 5, 1, true).deleteAttribute('uv');
