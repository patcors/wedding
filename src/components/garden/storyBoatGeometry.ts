// Patrick's and Amelia's boats for the Voyage: the wooden sailboat
// (woodenSailboatGeometry.ts, which the guests' boats keep) rebuilt with a
// painted stripe, a taller mast for a flag, and a hull that morphs into a long,
// slim catamaran hull. Both hull shapes share one topology, so the morph is a
// morph target the GPU blends.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

type Point = [number, number, number];
export type StoryPalette = {
  topsides: string; bottom: string; stripe: string; transom: string;
  rim: string; wall: string; floor: string;
};

// Muted to sit with the Garden's paper and ink: Amelia's is the natural wood
// with soft teal paintwork, Patrick's is painted soft yellow.
export const STORY_PALETTES = {
  amelia: {
    topsides: '#d3ad76', bottom: '#ac824f', stripe: '#86aaa1', transom: '#86aaa1',
    rim: '#9dbcb3', wall: '#bd9058', floor: '#c99f65',
  },
  patrick: {
    topsides: '#e6d193', bottom: '#c8b273', stripe: '#f4ecd6', transom: '#e0c87f',
    rim: '#efe2b0', wall: '#d6bf7c', floor: '#dcc688',
  },
} satisfies Record<string, StoryPalette>;

// Cross-sections from bow (−z) to stern: [z, half-beam]. The dinghy's are the
// wooden sailboat's; the catamaran hull is nearly twice as long and a third as wide.
const DINGHY = { sections: [[-.78, .015], [-.55, .23], [-.12, .36], [.30, .33], [.66, .22]], keel: -.07, bilge: [.65, -.015], floor: .065 };
const CATAMARAN = { sections: [[-1.5, .008], [-1.0, .1], [-.2, .135], [.6, .125], [1.15, .085]], keel: -.11, bilge: [.6, -.03], floor: .148 };
export const HULL = {
  stern: { dinghy: .66, catamaran: 1.15 },
  mast: { dinghy: -.42, catamaran: -.36 },
  mastTop: 1.44,
} as const;
const RIM = .15, STRIPE = .095;

type HullShape = typeof DINGHY;
// The hull's triangles in a fixed order, so both shapes line up vertex for
// vertex. Tints come from the first shape built.
function hullPanels({ sections, keel, bilge, floor }: HullShape, palette: StoryPalette) {
  const positions: number[] = [], colours: number[] = [];
  const triangle = (a: Point, b: Point, c: Point, tint: string) => {
    positions.push(...a, ...b, ...c);
    const colour = new THREE.Color(tint);
    for (let i = 0; i < 3; i++) colours.push(colour.r, colour.g, colour.b);
  };
  // Rim, the foot of the painted stripe, the bilge, the keel, then mirrored.
  const rings = sections.map(([z, w]): Point[] => [
    [-w, RIM, z], [-w * .985, STRIPE, z], [-w * bilge[0], bilge[1], z], [0, keel, z],
    [w * bilge[0], bilge[1], z], [w * .985, STRIPE, z], [w, RIM, z],
  ]);
  const outside = [palette.stripe, palette.topsides, palette.bottom, palette.bottom, palette.topsides, palette.stripe];
  const inside = [palette.rim, palette.wall, palette.floor, palette.wall, palette.rim];
  const ring = (i: number): Point[] => {
    const [z, w] = sections[i];
    return [rings[i][0], [-w * .88, RIM, z], [-w * .70, floor, z], [w * .70, floor, z], [w * .88, RIM, z], rings[i][6]];
  };
  for (let i = 1; i < rings.length; i++) {
    for (let j = 0; j < 6; j++) {
      triangle(rings[i - 1][j], rings[i][j], rings[i][j + 1], outside[j]);
      triangle(rings[i - 1][j], rings[i][j + 1], rings[i - 1][j + 1], outside[j]);
    }
    const previous = ring(i - 1), current = ring(i);
    for (let j = 0; j < 5; j++) {
      triangle(previous[j], current[j], current[j + 1], inside[j]);
      triangle(previous[j], current[j + 1], previous[j + 1], inside[j]);
    }
  }
  // The bow's point and the painted transom, the part seen from behind.
  rings.forEach((r, i) => {
    if (i !== 0 && i !== rings.length - 1) return;
    for (let j = 1; j < r.length - 1; j++) triangle(r[0], r[j], r[j + 1], i ? palette.transom : palette.topsides);
  });
  return { positions, colours };
}

const flatNormals = (positions: number[]) => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry.attributes.normal as THREE.BufferAttribute;
};

// The dinghy's hull, with the catamaran hull as morph target 0.
export function storyHull(palette: StoryPalette) {
  const dinghy = hullPanels(DINGHY, palette), catamaran = hullPanels(CATAMARAN, palette);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(dinghy.positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(dinghy.colours, 3));
  geometry.setAttribute('normal', flatNormals(dinghy.positions));
  geometry.morphAttributes.position = [new THREE.Float32BufferAttribute(catamaran.positions, 3)];
  geometry.morphAttributes.normal = [flatNormals(catamaran.positions)];
  // Bounds that hold both shapes, so neither is culled early.
  geometry.computeBoundingSphere();
  geometry.boundingSphere!.radius = 1.6;
  return geometry;
}

const tinted = (geometry: THREE.BufferGeometry, tint: string) => {
  const colour = new THREE.Color(tint);
  const values = new Float32Array(geometry.attributes.position.count * 3);
  for (let i = 0; i < values.length; i += 3) colour.toArray(values, i);
  geometry.setAttribute('color', new THREE.BufferAttribute(values, 3));
  return geometry;
};
function spar(a: Point, b: Point, radius: number) {
  const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
  const direction = end.clone().sub(start);
  const cylinder = new THREE.CylinderGeometry(radius, radius, direction.length(), 8).toNonIndexed();
  cylinder.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()));
  cylinder.translate(...start.add(end).multiplyScalar(.5).toArray());
  cylinder.deleteAttribute('uv');
  return tinted(cylinder, '#d8b47d');
}

// The mainsail as in the wooden sailboat: a gently billowed ivory triangle,
// with uv across its foot and up its luff for anything painted on it.
function sail(a: Point, b: Point, c: Point, fullness: number, tint = '#fff6df') {
  const vertices: number[] = [], uvs: number[] = [], indices: number[] = [], rows: number[][] = [];
  const segments = 12;
  for (let i = 0; i <= segments; i++) {
    rows[i] = [];
    for (let j = 0; j <= segments - i; j++) {
      const u = i / segments, v = j / segments, w = 1 - u - v;
      rows[i][j] = vertices.length / 3;
      vertices.push(
        a[0] * u + b[0] * w + c[0] * v + fullness * 27 * u * v * w,
        a[1] * u + b[1] * w + c[1] * v,
        a[2] * u + b[2] * w + c[2] * v,
      );
      uvs.push(v, u);
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < segments - i; j++) {
      indices.push(rows[i][j], rows[i + 1][j], rows[i][j + 1]);
      if (j < segments - i - 1) indices.push(rows[i + 1][j], rows[i + 1][j + 1], rows[i][j + 1]);
    }
  }
  const cloth = new THREE.BufferGeometry();
  cloth.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  cloth.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  cloth.setIndex(indices);
  cloth.computeVertexNormals();
  const result = tinted(cloth.toNonIndexed(), tint);
  cloth.dispose();
  return result;
}

// The mast, and the sail and boom about its foot. The boom is eased out to
// `side` (−1 port, +1 starboard) by turning the sail about the mast, as if
// running before the wind, so it shows its face to the camera behind rather
// than its edge.
export function storyRig(side: number) {
  const cloth = sail([0, 1.16, .03], [0, .26, .03], [0, .26, .98], -.06 * side);
  cloth.deleteAttribute('uv');
  const boom = spar([0, .26, .03], [0, .26, .98], .012);
  const sheet = mergeGeometries([cloth, boom]);
  const mast = spar([0, .065, 0], [0, HULL.mastTop, 0], .019);
  cloth.dispose(); boom.dispose();
  return { mast, sheet };
}
export const SAIL_EASED = .62;

// The catamaran's one tall mast, stepped in the middle of the deck once they
// are engaged, in the pair's model units from the deck at its foot. Its sail
// is wider and taller than the dinghies', and is run well out to port, away
// from the jetty, so its face turns to the camera behind.
export const BIG_RIG = { deck: .23, z: -.46, top: 1.92, boom: .2, head: 1.7, foot: 1.24, eased: 1.05 } as const;
export function bigRig() {
  const { top, boom, head, foot } = BIG_RIG;
  // Plain ivory: their monogram flies from the masthead instead (logoFlag).
  const cloth = sail([0, head, .035], [0, boom, .035], [0, boom, foot], .07);
  return { mast: spar([0, 0, 0], [0, top, 0], .026), boom: spar([0, boom, .035], [0, boom, foot], .015), cloth };
}

// The flag at each small masthead, its hoist on the mast and its fly along
// +x: the mark of the company each works for, on paper, from their
// internship until they get engaged.
export const FLAG = { length: .36, height: .26, segments: 8 } as const;
export function flagGeometry(mirrored: boolean) {
  const geometry = new THREE.PlaneGeometry(FLAG.length, FLAG.height, FLAG.segments, 2);
  geometry.translate(FLAG.length / 2, HULL.mastTop - FLAG.height / 2 - .01, 0);
  // Seen from its back, a flag flying to the left would read backwards.
  if (mirrored) {
    const uv = geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
  }
  return geometry;
}

// Paper cloth with a mark (an image on transparency) as large as fits
// `fill` of its height, centred between `from` and the fly. `heading` adds
// a darker strip along the hoist, where it's sewn to the halyard, for a flag
// whose hoist is always on the canvas's left.
function markedCloth(width: number, height: number, mark: string | null, { fill, from = 0, heading = false }: { fill: number; from?: number; heading?: boolean }) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#f7f3e8'; ctx.fillRect(0, 0, width, height);
  if (heading) { ctx.fillStyle = '#e4dcc6'; ctx.fillRect(0, 0, width * .04, height); }
  if (!mark) return texture;
  const image = new Image();
  image.onload = () => {
    const left = width * from, right = width * (1 - from / 3);
    const w = Math.min(right - left, height * fill * image.width / image.height), h = w * image.height / image.width;
    ctx.drawImage(image, (left + right - w) / 2, (height - h) / 2, w, h);
    texture.needsUpdate = true;
  };
  image.src = mark;
  return texture;
}

// A company's flag: its mark in its own colour on paper, or plain paper
// without one. Centred, so it sits the same whichever way the flag flies.
export const companyFlagTexture = (mark: string | null) =>
  markedCloth(192, Math.round(192 * FLAG.height / FLAG.length), mark, { fill: .82 });

// The flag the big mast flies from its masthead once they are engaged: their
// monogram on paper, larger than the small masts' flags so it reads at the
// dock on a phone, and short enough to stay clear of the copy beside it on
// desktop. In the big mast's units, hoist on the mast at its top (y 0) and
// fly along +x, to starboard, clear of the sail.
export const LOGO_FLAG = { length: .52, height: .38, segments: 10 } as const;
export function logoFlagGeometry() {
  const geometry = new THREE.PlaneGeometry(LOGO_FLAG.length, LOGO_FLAG.height, LOGO_FLAG.segments, 3);
  geometry.translate(LOGO_FLAG.length / 2, -LOGO_FLAG.height / 2, 0);
  return geometry;
}
export const logoFlagTexture = (logo: string) =>
  markedCloth(384, Math.round(384 * LOGO_FLAG.height / LOGO_FLAG.length), logo, { fill: .84, from: .07, heading: true });

// Waves a flag's cloth about its rest shape, more towards the fly, and lets
// the fly droop a little. `rest` is its positions as built.
export function flutter(geometry: THREE.BufferGeometry, rest: Float32Array, length: number, t: number, phase: number, size = 1) {
  const cloth = geometry.attributes.position as THREE.BufferAttribute;
  for (let v = 0; v < cloth.count; v++) {
    const u = rest[v * 3] / length;
    cloth.setZ(v, (Math.sin(u * 5 - t * 5.5 + phase) * .028 * u + Math.sin(u * 3 - t * 3.1) * .01 * u) * size);
    cloth.setY(v, rest[v * 3 + 1] - u * u * .015 * size);
  }
  cloth.needsUpdate = true;
  geometry.computeVertexNormals();
}

// The V of ripples spreading behind a stern, faded towards its tail.
export function wakeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.lineCap = 'round';
  for (let k = 0; k < 3; k++) {
    for (const side of [-1, 1]) {
      ctx.beginPath();
      for (let y = 4 + k * 22; y < 128; y += 4) {
        const x = 32 + side * (4 + y * .22);
        const alpha = (1 - y / 128) ** 1.5 * (1 - k * .25);
        ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
        ctx.lineWidth = 2.4 - k * .5;
        ctx.lineTo(x, y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, y);
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
