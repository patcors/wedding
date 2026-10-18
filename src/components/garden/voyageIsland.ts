// The island that splits the river before Patrick and Amelia meet: a low
// grassy mound whose shape follows islandHalfWidth, ringed by tall reeds and
// cattails so each channel feels separate. Pure, so it can be tested.
import * as THREE from 'three';
import { islandHalfWidth, islandSpan, random, riverCenter } from './gardenGeometry.ts';

// How far the island's shore runs on underwater beyond its waterline, so the
// mound rises out of the water rather than standing on it.
const skirt = (width: number) => .7 * Math.max(width, .6);
// Its crown sits a little higher than the banks' first rise, so it reads as
// raised ground even through a screen of reeds.
const crown = (width: number) => width < 1 ? .5 : .62;

// Distance inland from the island's waterline at x, z; negative in the water.
export const islandInland = (x: number, z: number, width = 1) =>
  islandHalfWidth(z, width) - Math.abs(x - riverCenter(z, width));

export function islandHeight(x: number, z: number, width = 1) {
  const inland = islandInland(x, z, width);
  if (inland < 0) return -.12 + Math.max(-.4, inland * .45);
  const rise = Math.min(1, inland / Math.max(.45, 1.05 * width));
  const wobble = (Math.sin(x * 1.3 + z * .7) * .05 + Math.sin(z * 2.1 - x) * .03) * Math.min(1, inland / .6);
  return -.12 + rise * rise * (3 - 2 * rise) * crown(width) + wobble;
}

// A grid laid across the island from one underwater shore to the other, with
// the same attributes as the banks so it takes the ground's material.
export function islandGeometry(width = 1) {
  const { from, to } = islandSpan(width), margin = skirt(width);
  const rows = Math.round((from - to + 2) * 4), columns = 28;
  const positions: number[] = [], uvs: number[] = [], colors: number[] = [], inlands: number[] = [], indices: number[] = [];
  const color = new THREE.Color();
  for (let i = 0; i <= rows; i++) {
    const z = from + 1 - i / rows * (from - to + 2), center = riverCenter(z, width);
    const reach = islandHalfWidth(z, width) + margin;
    for (let j = 0; j <= columns; j++) {
      // Columns bunch towards the shores, where the ground changes most.
      const u = j / columns * 2 - 1, x = center + Math.sign(u) * Math.pow(Math.abs(u), .8) * reach;
      const inland = islandInland(x, z, width);
      positions.push(x, islandHeight(x, z, width), z);
      uvs.push(x / 16, z / 16);
      color.set(inland < .6 ? '#797866' : '#e3dfc8');
      colors.push(color.r, color.g, color.b);
      inlands.push(inland);
      if (i < rows && j < columns) {
        const a = i * (columns + 1) + j, b = a + 1, c = a + columns + 1, d = c + 1;
        indices.push(a, b, c, b, d, c);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('inland', new THREE.Float32BufferAttribute(inlands, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export type IslandPlant = 'reed' | 'cattail' | 'grass' | 'fern';
export type IslandSite = { x: number; y: number; z: number; angle: number; scale: number; tint: number };

// Reeds stand thick along both shores, half in the water, and grow taller than
// the bank's beds: tall enough to hide one boat's mast from the other. They
// shorten towards the island's tail, so the channels open up as they rejoin.
// Cattails stand among them in the shallows; grass and ferns cover the crown.
export function islandPlantSites(kind: IslandPlant, width = 1, mobile = false): IslandSite[] {
  const { from, to } = islandSpan(width);
  const rand = random(kind === 'reed' ? 6211 : kind === 'cattail' ? 6337 : kind === 'grass' ? 6451 : 6577);
  const sites: IslandSite[] = [];
  const place = (x: number, z: number, inland: number, scale: number) => sites.push({
    x, z, y: inland < 0 ? -.22 : islandHeight(x, z, width) - .025,
    angle: rand() * Math.PI * 2, scale, tint: .85 + rand() * .2,
  });
  if (kind === 'reed' || kind === 'cattail') {
    const step = kind === 'reed' ? (mobile ? .1 : .075) : .3;
    for (let row = from - .05; row > to; row -= step) {
      for (const side of [-1, 1]) {
        for (let k = 0; k < (kind === 'reed' ? 2 : 1); k++) {
          const z = row + (rand() - .5) * step, half = islandHalfWidth(z, width);
          // Cattails grow in clumps along the reeds, not in a row.
          if (half < .04 || kind === 'cattail' && Math.sin(row * 1.3 + side * 2) < .3) continue;
          // Full height from the head to just past the middle, then lower to the tail.
          const t = (from - z) / (from - to), height = 1 - .45 * Math.max(0, (t - .55) / .45);
          // Portrait's camera rides low over a narrow river, so there they
          // keep closer to the shore, leaving each channel's boat in view.
          const out = mobile ? .7 : 1;
          const inland = kind === 'reed' ? (-.42 + rand() * .64) * out : (-.32 + rand() * .26) * out;
          const x = riverCenter(z, width) + side * (half - inland);
          // Shorter out in the water and up on the bank, so the screen thins at its edges.
          const edge = 1 - .25 * Math.min(1, Math.abs(inland + .05) / .4);
          // Portrait's narrow river, seen from nearer, takes shorter reeds so
          // both boats still show from the camera above.
          const scale = (kind === 'reed' ? (1.3 + rand() * .45) * edge : .75 + rand() * .2) * height * (mobile ? .62 : 1);
          place(x, z, inland, scale);
        }
      }
    }
    return sites;
  }
  // Ground cover: scatter over the island and keep what lands on the crown.
  const tries = kind === 'grass' ? (mobile ? 260 : 520) : (mobile ? 30 : 60);
  for (let i = 0; i < tries; i++) {
    const z = from - rand() * (from - to), half = islandHalfWidth(z, width);
    const x = riverCenter(z, width) + (rand() * 2 - 1) * half;
    const inland = half - Math.abs(x - riverCenter(z, width));
    if (inland < .3 || islandHeight(x, z, width) < .06) continue;
    place(x, z, inland, (kind === 'grass' ? .7 : .8) + rand() * .55);
  }
  return sites;
}
