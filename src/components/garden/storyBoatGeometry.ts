// Patrick's and Amelia's boats for the Voyage: a dinghy with a painted
// stripe, ensign staffs at its stern for its flags, and a hull that morphs
// into a long, slim catamaran hull. Both hull shapes share one topology, so
// the morph (shape and paint) is a morph target the GPU blends. How each
// looks, dinghy and catamaran, is a Review choice (boatLooks.ts).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { catamaranSailCloth, dinghySailCloth, type CatamaranLook, type DinghyLook, type HullPaint, type Owner } from './boatLooks.ts';

type Point = [number, number, number];

// Cross-sections from bow (−z) to stern: [z, half-beam]. The dinghy's are the
// wooden sailboat's; the catamaran hull is nearly twice as long and a third as
// wide. `quarter` is how far out the ensign staffs stand, a share of the
// stern's half-beam.
const DINGHY = { sections: [[-.78, .015], [-.55, .23], [-.12, .36], [.30, .33], [.66, .22]], keel: -.07, bilge: [.65, -.015], floor: .065, quarter: .6 };
const CATAMARAN = { sections: [[-1.5, .008], [-1.0, .1], [-.2, .135], [.6, .125], [1.15, .085]], keel: -.11, bilge: [.6, -.03], floor: .148, quarter: 0 };
export const HULL = {
  stern: { dinghy: .66, catamaran: 1.15 },
  mast: { dinghy: -.42, catamaran: -.36 },
  mastTop: 1.44,
} as const;
const RIM = .15, STRIPE = .095;
// How a sheer lifts each section's rim, bow to stern, as a share of the paint's `sheer`.
const SHEER = [1, .45, 0, .1, .35];
// Each stretch between sections is split in three, the middle strip narrow,
// where a strap can be painted round the hull (the lugger's iron bands);
// otherwise the three read as one.
const STRAP = [.46, .54];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

type HullShape = typeof DINGHY;
// The hull's triangles in a fixed order, so both shapes line up vertex for
// vertex, each painted in its own paint.
function hullPanels({ sections, keel, bilge, floor }: HullShape, paint: HullPaint) {
  const positions: number[] = [], colours: number[] = [];
  const triangle = (a: Point, b: Point, c: Point, tint: string) => {
    positions.push(...a, ...b, ...c);
    const colour = new THREE.Color(tint);
    for (let i = 0; i < 3; i++) colours.push(colour.r, colour.g, colour.b);
  };
  const stations: { z: number; w: number; rise: number; strap: boolean }[] = [];
  sections.forEach(([z, w], i) => {
    const rise = SHEER[i] * paint.sheer;
    if (i) {
      const [z0, w0] = sections[i - 1], rise0 = SHEER[i - 1] * paint.sheer;
      for (const f of STRAP) stations.push({ z: lerp(z0, z, f), w: lerp(w0, w, f), rise: lerp(rise0, rise, f), strap: f === STRAP[1] && i > 1 });
    }
    stations.push({ z, w, rise, strap: false });
  });
  // Down the port side from the rim, by the foot of the painted stripe, the
  // strakes to the bilge and the keel, then back up to starboard.
  const rings = stations.map(({ z, w, rise }): Point[] => {
    const rim: [number, number] = [w, RIM + rise], stripe: [number, number] = [w * .985, STRIPE + rise * .7];
    const turn: [number, number] = [w * bilge[0], bilge[1]], bottom: [number, number] = [0, keel];
    const half = [rim, stripe,
      ...[1 / 3, 2 / 3].map((t): [number, number] => [lerp(stripe[0], turn[0], t), lerp(stripe[1], turn[1], t)]),
      turn, [turn[0] / 2, (turn[1] + keel) / 2] as [number, number], bottom];
    return [...half.map(([x, y]): Point => [-x, y, z]), ...half.slice(0, -1).reverse().map(([x, y]): Point => [x, y, z])];
  });
  const outside = [...paint.strakes, ...[...paint.strakes].reverse()];
  const inside = [paint.rim, paint.wall, paint.floor, paint.wall, paint.rim];
  const ring = (i: number): Point[] => {
    const { z, w, rise } = stations[i], last = rings[i].length - 1;
    return [rings[i][0], [-w * .88, RIM + rise, z], [-w * .70, floor, z], [w * .70, floor, z], [w * .88, RIM + rise, z], rings[i][last]];
  };
  for (let i = 1; i < rings.length; i++) {
    for (let j = 0; j < outside.length; j++) {
      const tint = stations[i].strap && paint.strap ? paint.strap : outside[j];
      triangle(rings[i - 1][j], rings[i][j], rings[i][j + 1], tint);
      triangle(rings[i - 1][j], rings[i][j + 1], rings[i - 1][j + 1], tint);
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
    for (let j = 1; j < r.length - 1; j++) triangle(r[0], r[j], r[j + 1], i ? paint.transom : paint.bow);
  });
  return { positions, colours };
}

const flatNormals = (positions: number[]) => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry.attributes.normal as THREE.BufferAttribute;
};

// The ensign staffs the company's and the university's flags fly from, one
// at each stern quarter (side −1 port, +1 starboard), so each flag has its
// own and both read when two fly. On a catamaran hull both stand on its
// centreline at the stern, where the company's flies alone. They follow the
// hull's morph aft as it grows long; `ensignStaff` is the top of one at a
// morph, in the hull's frame, and `ensignStaffGeometry` one staff standing
// on y 0, to be stood at its foot.
export const ENSIGN = { foot: .1, height: .46, radius: .011 } as const;
const staffFoot = ({ sections, quarter }: HullShape, side: number): Point => {
  const [z, w] = sections[sections.length - 1];
  return [side * w * quarter, ENSIGN.foot, z - .05];
};
export const ensignStaff = (side: number, morph: number): Point => {
  const [dx, , dz] = staffFoot(DINGHY, side), [cx, , cz] = staffFoot(CATAMARAN, side);
  return [lerp(dx, cx, morph), ENSIGN.foot + ENSIGN.height, lerp(dz, cz, morph)];
};
export const ensignStaffGeometry = () => spar([0, 0, 0], [0, ENSIGN.height, 0], ENSIGN.radius);

// The dinghy's hull, with the catamaran hull's shape as morph target 0 and
// its paint kept to blend into.
export function storyHull(dinghyPaint: HullPaint, catamaranPaint: HullPaint) {
  const dinghy = hullPanels(DINGHY, dinghyPaint), catamaran = hullPanels(CATAMARAN, catamaranPaint);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(dinghy.positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(dinghy.colours, 3));
  geometry.setAttribute('normal', flatNormals(dinghy.positions));
  geometry.morphAttributes.position = [new THREE.Float32BufferAttribute(catamaran.positions, 3)];
  geometry.morphAttributes.normal = [flatNormals(catamaran.positions)];
  // The paint blends on the CPU (blendHullPaint): a colour morph target
  // stops three drawing the hull at all.
  geometry.userData.paint = { dinghy: Float32Array.from(dinghy.colours), catamaran: Float32Array.from(catamaran.colours) };
  // Bounds that hold both shapes, so neither is culled early.
  geometry.computeBoundingSphere();
  geometry.boundingSphere!.radius = 1.6;
  return geometry;
}

// Paints the hull `morph` of the way from the dinghy's paint to the catamaran's.
export function blendHullPaint(geometry: THREE.BufferGeometry, morph: number) {
  const { dinghy, catamaran } = geometry.userData.paint as { dinghy: Float32Array; catamaran: Float32Array };
  const colour = geometry.attributes.color as THREE.BufferAttribute, values = colour.array as Float32Array;
  for (let i = 0; i < values.length; i++) values[i] = dinghy[i] + (catamaran[i] - dinghy[i]) * morph;
  colour.needsUpdate = true;
}

const tinted = (geometry: THREE.BufferGeometry, tint: string) => {
  const colour = new THREE.Color(tint);
  const values = new Float32Array(geometry.attributes.position.count * 3);
  for (let i = 0; i < values.length; i += 3) colour.toArray(values, i);
  geometry.setAttribute('color', new THREE.BufferAttribute(values, 3));
  return geometry;
};
function spar(a: Point, b: Point, radius: number, tint = '#d8b47d') {
  const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
  const direction = end.clone().sub(start);
  const cylinder = new THREE.CylinderGeometry(radius, radius, direction.length(), 8).toNonIndexed();
  cylinder.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()));
  cylinder.translate(...start.add(end).multiplyScalar(.5).toArray());
  cylinder.deleteAttribute('uv');
  return tinted(cylinder, tint);
}
const spars = (...parts: THREE.BufferGeometry[]) => {
  const merged = mergeGeometries(parts);
  parts.forEach(part => part.dispose());
  return merged;
};

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
// A four-sided sail (a lug or a spritsail): tack and clew along the foot,
// throat and peak along the head, billowed in its middle, with uv along the
// foot and up the luff.
function quadSail(tack: Point, clew: Point, peak: Point, throat: Point, fullness: number) {
  const segments = 10, vertices: number[] = [], uvs: number[] = [], indices: number[] = [];
  for (let i = 0; i <= segments; i++) {
    for (let j = 0; j <= segments; j++) {
      const s = j / segments, t = i / segments;
      const at = (k: number) => lerp(lerp(tack[k], clew[k], s), lerp(throat[k], peak[k], s), t);
      vertices.push(at(0) + fullness * 16 * s * (1 - s) * t * (1 - t), at(1), at(2));
      uvs.push(s, t);
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < segments; j++) {
      const k = i * (segments + 1) + j;
      indices.push(k, k + 1, k + segments + 1, k + 1, k + segments + 2, k + segments + 1);
    }
  }
  const cloth = new THREE.BufferGeometry();
  cloth.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  cloth.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  cloth.setIndex(indices);
  cloth.computeVertexNormals();
  const result = tinted(cloth.toNonIndexed(), '#ffffff');
  cloth.dispose();
  return result;
}
// A headsail that rolls up round its forestay: built with the forestay
// (tack to head) as its y axis and the clew in its yz plane, so scaling x and
// z furls it. `position` and `quaternion` stand it in place.
export type Furlable = { geometry: THREE.BufferGeometry; position: THREE.Vector3; quaternion: THREE.Quaternion; map: THREE.Texture | null };
function furlable(head: Point, tack: Point, clew: Point, fullness: number, map: THREE.Texture | null): Furlable {
  const origin = new THREE.Vector3(...tack);
  const y = new THREE.Vector3(...head).sub(origin).normalize();
  const toClew = new THREE.Vector3(...clew).sub(origin);
  const z = toClew.clone().sub(y.clone().multiplyScalar(toClew.dot(y))).normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  const frame = new THREE.Matrix4().makeBasis(x, y, z).setPosition(origin);
  const geometry = sail(head, tack, clew, 0, map ? '#ffffff' : '#fff6df');
  geometry.applyMatrix4(frame.clone().invert());
  // Billow it out along its own x, away from the centreline the clew is eased to.
  const position = geometry.attributes.position, uv = geometry.attributes.uv;
  for (let i = 0; i < position.count; i++) {
    const u = uv.getY(i), v = uv.getX(i);
    position.setX(i, position.getX(i) + fullness * 27 * u * v * (1 - u - v));
  }
  geometry.computeVertexNormals();
  return { geometry, position: origin, quaternion: new THREE.Quaternion().setFromRotationMatrix(frame), map };
}

// A small box, for cabins: centred on x and z, standing on y 0.
const block = (w: number, h: number, l: number, y: number, tint: string) =>
  tinted(new THREE.BoxGeometry(w, h, l).toNonIndexed().translate(0, y + h / 2, 0), tint);
const merged = (...parts: THREE.BufferGeometry[]) => {
  parts.forEach(part => part.deleteAttribute('uv'));
  return spars(...parts);
};

// The mast, and the sail and its spars about its foot, for a dinghy look.
// The sail is eased out to `side` (−1 port, +1 starboard) by turning it
// about the mast, as if running before the wind, so it shows its face to the
// camera behind rather than its edge. The toy sloop adds a jib on a forestay
// to the bow, eased the other way (wing on wing) so it shows beside the main, and a little cabin (`cabin`, in the hull's frame).
export type StoryRig = {
  mast: THREE.BufferGeometry; spars: THREE.BufferGeometry; cloth: THREE.BufferGeometry; map: THREE.Texture | null;
  jib: Furlable | null; cabin: { geometry: THREE.BufferGeometry; z: number } | null;
};
export function storyRig(side: number, look: DinghyLook = 'original', owner: Owner = 'amelia'): StoryRig {
  const mast = spar([0, .065, 0], [0, HULL.mastTop, 0], .019);
  const map = dinghySailCloth(look, owner, 'main');
  switch (look) {
    case 'toy': {
      const deep = owner === 'amelia' ? '#5f8a81' : '#c4a24f';
      return {
        mast, map,
        cloth: sail([0, 1.18, .03], [0, .26, .03], [0, .26, .86], -.06 * side, '#ffffff'),
        spars: spar([0, .26, .03], [0, .26, .86], .012),
        jib: furlable([0, 1.1, -.02], [0, .19, -.34], [-side * .16, .3, .08], .03 * side, dinghySailCloth(look, owner, 'jib')),
        cabin: { z: .14, geometry: merged(block(.3, .11, .3, .06, '#f4efe3'), block(.34, .03, .34, .17, deep), block(.31, .03, .2, .1, '#3d4a48')) },
      };
    }
    case 'lugger': return {
      mast, map, jib: null, cabin: null,
      cloth: quadSail([0, .24, -.1], [0, .24, .9], [0, 1.24, .8], [0, .92, -.16], -.05 * side),
      spars: spars(spar([0, .24, -.1], [0, .24, .92], .012, '#6b4434'), spar([0, .88, -.24], [0, 1.28, .84], .014, '#6b4434')),
    };
    case 'skiff': return {
      mast, map, jib: null, cabin: null,
      cloth: quadSail([0, .3, .03], [0, .3, .92], [0, 1.24, .88], [0, 1.0, .03], -.05 * side),
      spars: spar([0, .36, .03], [0, 1.27, .9], .013, '#7a6a5a'),
    };
    default: {
      const cloth = sail([0, 1.16, .03], [0, .26, .03], [0, .26, .98], -.06 * side);
      cloth.deleteAttribute('uv');
      return { mast, map: null, jib: null, cabin: null, cloth, spars: spar([0, .26, .03], [0, .26, .98], .012) };
    }
  }
}
export const SAIL_EASED = .62;

// The catamaran's one tall mast, stepped in the middle of the deck once they
// are engaged, in the pair's model units from the deck at its foot. Its sail
// is wider and taller than the dinghies', and is run well out to port, away
// from the jetty, so its face turns to the camera behind. The cruisers add a
// jib on a forestay to a beam across the bows, eased to starboard (wing on
// wing) below the monogram's flag, a cabin aft of the mast, and
// a taller main.
export const BIG_RIG = { deck: .23, z: -.46, top: 1.92, boom: .2, head: 1.7, foot: 1.24, eased: 1.05 } as const;
export function bigRig(look: CatamaranLook = 'original') {
  const { top, boom, foot } = BIG_RIG;
  const cruiser = look !== 'original', head = cruiser ? 1.84 : BIG_RIG.head;
  const tint = look === 'cruiser' || look === 'numbered' ? '#d3d6d6' : '#d8b47d';
  // The toy sloops' white cloth in both their stripes, or the cruiser's: their monogram flies from the masthead instead (logoFlag).
  const map = catamaranSailCloth(look, 'main', (head - boom) / (foot - .035));
  const cloth = sail([0, head, .035], [0, boom, .035], [0, boom, foot], .07, map ? '#ffffff' : '#fff6df');
  const extras = cruiser ? {
    jib: furlable([0, 1.45, -.02], [0, -.04, -.6], [.34, .2, -.04], -.035, catamaranSailCloth(look, 'jib')),
    bow: spar([-.52, -.06, -.6], [.52, -.06, -.6], .024, tint),
    cabin: merged(
      block(.56, .1, .66, 0, look === 'warm' ? '#efe6d2' : '#f3f1ec'),
      block(.57, .045, .6, .1, '#3a4652'),
      block(.6, .028, .72, .145, look === 'warm' ? '#e6dcc6' : '#e8e6e0'),
    ).translate(0, 0, .52),
  } : { jib: null, bow: null, cabin: null };
  return { mast: spar([0, 0, 0], [0, top, 0], .026, tint), boom: spar([0, boom, .035], [0, boom, foot], .015, tint), cloth, map, ...extras };
}

// The flag on each ensign staff, its hoist on the staff, its top at y 0 and
// its fly along +x: the mark of the company each works for, from their
// internship until they get engaged, and the university's while they're
// there. Each is cut to its logo's shape: FinoComp's a disc of paper, the
// university's its shield, HeirWealth's a rounded square of paper round its
// crown, and the plain interim flag an ordinary flag of paper.
export type FlagShape = 'cloth' | 'circle' | 'square' | 'shield';
export const FLAGS: Record<FlagShape, { length: number; height: number }> = {
  cloth: { length: .32, height: .23 },
  circle: { length: .26, height: .26 },
  square: { length: .25, height: .25 },
  // The shield's own proportions (uow-shield.png).
  shield: { length: .205, height: .267 },
};
export const FLAG_SEGMENTS = 8;
export function flagGeometry(mirrored: boolean, shape: FlagShape) {
  const { length, height } = FLAGS[shape];
  const geometry = new THREE.PlaneGeometry(length, height, FLAG_SEGMENTS, 2);
  geometry.translate(length / 2, -height / 2, 0);
  // Seen from its back, a flag flying to the left would read backwards.
  if (mirrored) {
    const uv = geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
  }
  return geometry;
}

const PAPER = '#f7f3e8';

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
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, width, height);
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

// A company's flag, or the university's, at 512px across its longer side:
// its mark in its own colour, filling most of the flag, and an alpha map
// that cuts the cloth to its shape (drawn with alphaTest). The colour is
// opaque everywhere, so the cut edge never picks up a dark fringe. The
// shield is its own cloth: uow-shield.png carries the paper inside it, and
// its navy rim runs out under the cut. Centred, so it sits the same whichever
// way the flag flies. The plain interim flag needs no cut.
const MARK_FILL: Record<FlagShape, number> = { cloth: .82, circle: .84, square: .82, shield: 1 };
export function companyFlagTexture(mark: string | null, shape: FlagShape) {
  const { length, height } = FLAGS[shape], scale = 512 / Math.max(length, height);
  const width = Math.round(length * scale), tall = Math.round(height * scale);
  const canvas = (fill?: string) => {
    const element = document.createElement('canvas');
    element.width = width; element.height = tall;
    const ctx = element.getContext('2d')!;
    if (fill) { ctx.fillStyle = fill; ctx.fillRect(0, 0, width, tall); }
    return { element, ctx };
  };
  const texture = (element: HTMLCanvasElement, colour: boolean) => {
    const made = new THREE.CanvasTexture(element);
    if (colour) made.colorSpace = THREE.SRGBColorSpace;
    made.anisotropy = 8;
    return made;
  };
  const cloth = canvas(shape === 'shield' ? '#061b3e' : PAPER), map = texture(cloth.element, true);
  const cut = shape === 'cloth' ? null : canvas('#000');
  const alphaMap = cut && texture(cut.element, false);
  if (cut && shape !== 'shield') {
    cut.ctx.fillStyle = '#fff';
    cut.ctx.beginPath();
    if (shape === 'circle') cut.ctx.arc(width / 2, tall / 2, Math.min(width, tall) / 2, 0, Math.PI * 2);
    else cut.ctx.roundRect(0, 0, width, tall, Math.min(width, tall) * .14);
    cut.ctx.fill();
  }
  if (!mark) return { map, alphaMap };
  const image = new Image();
  image.onload = () => {
    const fill = MARK_FILL[shape];
    const w = Math.min(width * fill, tall * fill * image.width / image.height), h = w * image.height / image.width;
    const x = (width - w) / 2, y = (tall - h) / 2;
    cloth.ctx.drawImage(image, x, y, w, h);
    map.needsUpdate = true;
    if (cut && shape === 'shield') {
      // The shield's silhouette, white on black, from its own alpha.
      const silhouette = canvas();
      silhouette.ctx.drawImage(image, x, y, w, h);
      silhouette.ctx.globalCompositeOperation = 'source-in';
      silhouette.ctx.fillStyle = '#fff'; silhouette.ctx.fillRect(0, 0, width, tall);
      cut.ctx.drawImage(silhouette.element, 0, 0);
      alphaMap!.needsUpdate = true;
    }
  };
  image.src = mark;
  return { map, alphaMap };
}

// A flag is only a few dozen pixels across on screen, where the usual mip
// level blurs its mark, so its material samples the map a level sharper.
export function sharpenFlag(shader: THREE.WebGLProgramParametersWithUniforms) {
  shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>',
    THREE.ShaderChunk.map_fragment.replace('texture2D( map, vMapUv )', 'texture2D( map, vMapUv, -1.0 )'));
}

// The flag the big mast flies from its masthead once they are engaged: their
// monogram on paper, larger than the company flags so it reads at the
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
