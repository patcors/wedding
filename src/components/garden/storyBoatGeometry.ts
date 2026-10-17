// Patrick's and Amelia's boats for the Voyage: the wooden sailboat
// (woodenSailboatGeometry.ts, which the guests' boats keep) rebuilt with a
// painted stripe, a taller mast for a flag, and a hull that morphs into a long,
// slim catamaran hull. Both hull shapes share one topology, so the morph is a
// morph target the GPU blends.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Company } from './storyBoats';

type Point = [number, number, number];
export type StoryPalette = {
  topsides: string; bottom: string; stripe: string; transom: string;
  rim: string; wall: string; floor: string; flag: string; letter: string;
};

// Muted to sit with the Garden's paper and ink: Amelia's is the natural wood
// with soft teal paintwork, Patrick's is painted soft yellow.
export const STORY_PALETTES = {
  amelia: {
    topsides: '#d3ad76', bottom: '#ac824f', stripe: '#86aaa1', transom: '#86aaa1',
    rim: '#9dbcb3', wall: '#bd9058', floor: '#c99f65', flag: '#6f978e', letter: '#f7f3e8',
  },
  patrick: {
    topsides: '#e6d193', bottom: '#c8b273', stripe: '#f4ecd6', transom: '#e0c87f',
    rim: '#efe2b0', wall: '#d6bf7c', floor: '#dcc688', flag: '#e2c770', letter: '#384135',
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

// A small flag from the masthead, its hoist on the mast and its fly along +x.
export const FLAG = { length: .34, height: .22, segments: 8 } as const;
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

// The flag's cloth with its initial: Cormorant, the Garden's display face,
// once it has loaded.
export function flagTexture(letter: string, palette: StoryPalette) {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 84;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const font = '600 76px "Cormorant Garamond", Georgia, serif';
  const draw = () => {
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = palette.flag; ctx.fillRect(0, 0, 128, 84);
    ctx.fillStyle = palette.letter; ctx.font = font;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(letter, 60, 47);
    texture.needsUpdate = true;
  };
  draw();
  document.fonts?.load(font).then(draw, () => {});
  return texture;
}

// A canvas to paint a cloth on, as a texture that's updated when it changes.
function canvasCloth(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return { ctx: canvas.getContext('2d')!, texture };
}

// The flag the big mast flies from its masthead once they are engaged: their
// monogram on a paper-coloured swallowtail, larger than the initials' flags so
// it reads at the dock on a phone. In the big mast's units, hoist on the mast
// at its top (y 0) and fly along +x, to starboard, clear of the sail.
export const LOGO_FLAG = { length: .7, height: .46, segments: 10, notch: .2 } as const;
export function logoFlagGeometry() {
  const geometry = new THREE.PlaneGeometry(LOGO_FLAG.length, LOGO_FLAG.height, LOGO_FLAG.segments, 3);
  geometry.translate(LOGO_FLAG.length / 2, -LOGO_FLAG.height / 2, 0);
  return geometry;
}
export function logoFlagTexture(logo: string) {
  const width = 384, height = Math.round(width * LOGO_FLAG.height / LOGO_FLAG.length);
  const { ctx, texture } = canvasCloth(width, height);
  const notch = LOGO_FLAG.notch * width;
  ctx.fillStyle = '#f7f3e8';
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(width, 0); ctx.lineTo(width - notch, height / 2); ctx.lineTo(width, height); ctx.lineTo(0, height);
  ctx.fill();
  // A darker heading along the hoist, where it's sewn to the halyard.
  ctx.fillStyle = '#e4dcc6'; ctx.fillRect(0, 0, width * .04, height);
  const image = new Image();
  image.onload = () => {
    // Centred between the heading and the notch, as large as fits.
    const from = width * .07, to = width - notch - width * .02;
    const w = Math.min(to - from, height * .84 * image.width / image.height), h = w * image.height / image.width;
    ctx.drawImage(image, (from + to - w) / 2, (height - h) / 2, w, h);
    texture.needsUpdate = true;
  };
  image.src = logo;
  return texture;
}

// The company pennants each small mast flies under its initial: a tapering
// pennant in the company's colour with its mark in paper at the hoist, so on
// a phone it reads as a shape and a colour even where the mark barely does.
// Hoist on the mast, fly along +x.
export const PENNANT = { length: .32, height: .17, segments: 6, top: HULL.mastTop - FLAG.height - .035 } as const;
export function pennantGeometry() {
  const geometry = new THREE.PlaneGeometry(PENNANT.length, PENNANT.height, PENNANT.segments, 1);
  geometry.translate(PENNANT.length / 2, PENNANT.top - PENNANT.height / 2, 0);
  return geometry;
}
const PAPER = '#f7f3e8';
export function pennantTexture(company: Company, crown: string) {
  const width = 128, height = 68, mark = { x: 24, y: height / 2 };
  const { ctx, texture } = canvasCloth(width, height);
  // Cut off short of a point at the fly, so it keeps some body when small.
  const cloth = () => {
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(width, height * .41); ctx.lineTo(width, height * .59); ctx.lineTo(0, height);
  };
  cloth();
  if (company === 'finocomp') {
    // FinoComp's orange running to amber, as its mark does.
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, '#e27a16'); gradient.addColorStop(1, '#f0b938');
    ctx.fillStyle = gradient; ctx.fill();
    // Only the power symbol from its logo: a ring broken at the top, and the bar through the gap.
    const r = 13;
    ctx.strokeStyle = PAPER; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(mark.x, mark.y + 1, r, -Math.PI / 2 + .7, Math.PI * 1.5 - .7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mark.x, mark.y - r - 2); ctx.lineTo(mark.x, mark.y + 1); ctx.stroke();
    return texture;
  }
  ctx.fillStyle = '#783593'; ctx.fill();
  // HeirWealth's crown, purple on transparency, painted in paper.
  const image = new Image();
  image.onload = () => {
    const size = 34, tint = document.createElement('canvas');
    tint.width = tint.height = size * 2;
    const t = tint.getContext('2d')!;
    t.drawImage(image, 0, 0, size * 2, size * 2);
    t.globalCompositeOperation = 'source-in';
    t.fillStyle = PAPER; t.fillRect(0, 0, size * 2, size * 2);
    ctx.drawImage(tint, mark.x - size / 2, mark.y - size / 2, size, size);
    texture.needsUpdate = true;
  };
  image.src = crown;
  return texture;
}

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
