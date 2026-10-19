// The places' far-off ridgelines (places.ts) as low-poly meshes: each ridge
// a strip of faceted rows from below the horizon up to its crest, on a ring
// round the camera, every triangle its own flat colour so the sun picks out
// the facets. A `haze` attribute says how much of the fog's colour each
// vertex takes: more for the further ridges, and more towards their feet,
// as valley haze lies. One geometry per place. Pure (three's maths only), so
// it can be tested in Node.
import * as THREE from 'three';
import { PLACE_RIDGES, PLACE_RING, type Kind, type PlaceId, type Ridge } from './places.ts';

// The rows of each kind, foot to crest, from its crest elevation c (degrees):
// each row's elevation and its share of the ridge's distance (the foot
// nearer, the crest further back, so the slopes lean back and catch the sky),
// and the band of colour between it and the next row up. The escarpment is
// wooded slopes under a sandstone cliff band and a wooded rim; the heads are
// sheer sandstone from the water to a scrubby cap; the hills pasture; the
// mountain forest; the bush a low wooded line. `relief` sets spurs forward
// and gullies back along the ridge, as a share of its distance, so the
// facets turn to the light and away; `gullies` darkens the wooded faces in
// the folds; `broken` is the share of columns where scrub grows over the
// cliff. `smooth` kinds are lit as rolling ground rather than cut facets.
type Row = { e: number; d: number };
const FOOT = -2.5;
const cliff = (c: number) => Math.min(1, Math.max(0, (c - .6) / 1.2));
type KindLook = { rows: (c: number) => Row[]; bands: readonly string[]; relief: number; gullies: number; broken?: number; smooth?: boolean };
export const KIND_ROWS: Record<Kind, KindLook> = {
  escarpment: {
    rows: c => [{ e: FOOT, d: .95 }, { e: c * .3 - .4, d: .962 }, { e: c * .62 - .25, d: .974 }, { e: c - .3 - .5 * cliff(c), d: .984 }, { e: c - .3 * cliff(c), d: .986 }, { e: c, d: 1 }],
    bands: ['wood', 'wood', 'wood', 'cliff', 'rim'], relief: .05, gullies: .45, broken: .25,
  },
  heads: {
    rows: c => [{ e: FOOT, d: .96 }, { e: -.2, d: .982 }, { e: c * .45 - .1, d: .983 }, { e: c - .32, d: .985 }, { e: c - .1, d: .993 }, { e: c, d: 1 }],
    bands: ['rock', 'cliff', 'cliffTop', 'scrub', 'scrub'], relief: .012, gullies: .15, broken: .08,
  },
  bush: {
    rows: c => [{ e: FOOT, d: .96 }, { e: c * .5, d: .98 }, { e: c, d: 1 }],
    bands: ['scrub', 'scrub'], relief: .01, gullies: .2, smooth: true,
  },
  hills: {
    rows: c => [{ e: FOOT, d: .95 }, { e: c * .4, d: .975 }, { e: c * .78, d: .988 }, { e: c, d: .995 }],
    bands: ['pasture', 'pasture', 'pasture'], relief: .008, gullies: 0, smooth: true,
  },
  mountain: {
    rows: c => [{ e: FOOT, d: .97 }, { e: c * .45, d: .985 }, { e: c * .82, d: .995 }, { e: c, d: 1 }],
    bands: ['forest', 'forest', 'forest'], relief: .015, gullies: .2, smooth: true,
  },
};
// sRGB colours for each band. Dark stands of trees in the hills' folds
// (`trees`, blended into about that share of each row's vertices) and the escarpment's wooded
// slopes are near the avenue's own greens, before the haze softens them.
// The heads' sandstone (`cliff` on the heads) is warmer than the escarpment's.
export const PLACE_COLOURS: Record<string, string> = {
  wood: '#2b4630', cliff: '#a08a6a', rim: '#304b2e',
  rock: '#8a6c4c', headsCliff: '#d48f4c', cliffTop: '#e2ad6c', scrub: '#55663c',
  pasture: '#7f9d4c', trees: '#3d5a2f',
  forest: '#355132',
};
export const TREES_SHARE = [.24, .16, .06];
const WOODED = new Set(['wood', 'rim', 'scrub', 'forest', 'trees']);

function random(seed: number) {
  let s = seed * 9301 + 49297;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
const rad = (deg: number) => deg * Math.PI / 180;

// The crest at bearing b, between the profile's points: straight lines, or
// eased between them for rolling hills.
export function crestAt(ridge: Ridge, b: number) {
  const points = ridge.crest;
  if (b <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [b1, e1] = points[i];
    if (b <= b1) {
      const [b0, e0] = points[i - 1];
      let t = (b - b0) / (b1 - b0);
      if (ridge.smooth) t = t * t * (3 - 2 * t);
      return e0 + (e1 - e0) * t;
    }
  }
  return points[points.length - 1][1];
}

// One ridge's triangles, appended to the arrays.
type Out = { position: number[]; normal: number[]; color: number[]; haze: number[] };
function addRidge(ridge: Ridge, radius: number, squeeze: number, lift: number, out: Out) {
  const look = KIND_ROWS[ridge.kind], { rows, bands } = look;
  const rand = random(ridge.seed);
  const first = ridge.crest[0][0], last = ridge.crest[ridge.crest.length - 1][0];
  const columns = Math.max(2, Math.round((last - first) / ridge.step));
  // Spurs and gullies: a smooth wander along the ridge, 0 (a spur) to 1 (a gully).
  const knots = Array.from({ length: Math.ceil(columns / 3) + 2 }, rand);
  const fold = (i: number) => {
    const k = i / 3, at = Math.floor(k), t = k - at, e = t * t * (3 - 2 * t);
    return knots[at] + (knots[at + 1] - knots[at]) * e;
  };
  // The grid of vertices: columns along the ridge, rows up it, each row
  // kept above the one below and under the crest.
  const grid: { x: number; y: number; z: number; foot: number }[][] = [];
  for (let i = 0; i <= columns; i++) {
    const b = first + (last - first) * i / columns;
    const end = i === 0 || i === columns;
    const c = (crestAt(ridge, b) + (end ? 0 : (rand() - .5) * .14)) * lift;
    const g = fold(i), column = [];
    let below = -Infinity;
    for (const [j, row] of rows(c).entries()) {
      const e = Math.min(c, Math.max(below, row.e));
      below = e;
      const middle = j > 0 && j < rows(c).length - 1 && !end;
      const r = radius * ridge.distance * row.d * (1 + (middle ? look.relief * (g - .5) * 2 + (rand() - .5) * .008 : 0));
      const bearing = rad(b * squeeze);
      column.push({ x: r * Math.sin(bearing), y: r * Math.tan(rad(e)), z: -r * Math.cos(bearing), foot: 1 - Math.min(1, Math.max(0, (e - FOOT) / (Math.max(c, 0) - FOOT))) });
    }
    grid.push(column);
  }
  // Facets: each triangle lit flat, so the escarpment's and the heads'
  // cliffs read as cut stone; smooth kinds lit by the average of the faces
  // round each vertex, so pasture rolls rather than stepping in light and shade.
  const v3 = (v: { x: number; y: number; z: number }) => new THREE.Vector3(v.x, v.y, v.z);
  const faceNormal = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => b.clone().sub(a).cross(c.clone().sub(a)).normalize();
  const vertexNormals = grid.map(column => column.map(() => new THREE.Vector3()));
  if (look.smooth) for (let i = 0; i < columns; i++) for (let j = 0; j < bands.length; j++) {
    const n = faceNormal(v3(grid[i][j]), v3(grid[i + 1][j]), v3(grid[i + 1][j + 1]));
    for (const [ci, cj] of [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]]) vertexNormals[ci][cj].add(n);
  }
  vertexNormals.forEach(column => column.forEach(n => n.normalize()));
  // Smooth kinds take their colour per vertex, so the stands of trees in
  // the folds are soft blotches that fade into the pasture, not cut shapes.
  const blend = new THREE.Color(), shade = new THREE.Color();
  const vertexColours = look.smooth ? grid.map((column, i) => column.map((_, j) => {
    const band = bands[Math.min(j, bands.length - 1)];
    const wooded = band === 'pasture' && j < bands.length && rand() < TREES_SHARE[j] * 1.4;
    return new THREE.Color(PLACE_COLOURS[band]).lerp(shade.set(PLACE_COLOURS.trees), wooded ? .6 : 0)
      .multiplyScalar((.94 + rand() * .12) * (WOODED.has(band) ? 1 - look.gullies * fold(i) : 1));
  })) : null;
  const colour = new THREE.Color();
  const vertexHaze = (foot: number) => ridge.haze + (1 - ridge.haze) * .35 * foot ** 1.5;
  for (let i = 0; i < columns; i++) {
    const g = (fold(i) + fold(i + 1)) / 2, overgrown = rand() < (look.broken ?? 0);
    for (let j = 0; j < bands.length; j++) {
      const corners = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]] as const;
      for (const triangle of [[corners[0], corners[1], corners[2]], [corners[0], corners[2], corners[3]]]) {
        const flat = faceNormal(...triangle.map(([ci, cj]) => v3(grid[ci][cj])) as [THREE.Vector3, THREE.Vector3, THREE.Vector3]);
        let band = bands[j];
        if (band === 'cliff' && ridge.kind === 'heads') band = 'headsCliff';
        if (overgrown && (band === 'cliff' || band === 'cliffTop')) band = ridge.kind === 'heads' ? 'scrub' : 'rim';
        colour.set(PLACE_COLOURS[band]).multiplyScalar((.92 + rand() * .16) * (WOODED.has(band) ? 1 - look.gullies * g : 1));
        for (const [ci, cj] of triangle) {
          const v = grid[ci][cj], n = look.smooth ? vertexNormals[ci][cj] : flat;
          const c = vertexColours ? blend.copy(vertexColours[ci][cj]) : colour;
          out.position.push(v.x, v.y, v.z);
          out.normal.push(n.x, n.y, n.z);
          out.color.push(c.r, c.g, c.b);
          out.haze.push(vertexHaze(v.foot));
        }
      }
    }
  }
}

// A place's ridges in one geometry, nearer ridges last so they draw over the
// further ones; `mobile` uses the phone's ring (PLACE_RING).
export function placeGeometry(id: PlaceId, mobile: boolean) {
  const { radius, squeeze, lift } = mobile ? PLACE_RING.mobile : PLACE_RING.desktop;
  const out: Out = { position: [], normal: [], color: [], haze: [] };
  for (const ridge of [...PLACE_RIDGES[id]].reverse()) addRidge(ridge, radius, squeeze, lift, out);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(out.position, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(out.normal, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(out.color, 3));
  geometry.setAttribute('haze', new THREE.Float32BufferAttribute(out.haze, 1));
  geometry.computeBoundingSphere();
  geometry.name = `place-${id}`;
  return geometry;
}
