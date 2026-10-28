// A guest's boat (guestBoat.ts): the guests' folded paper boat with a
// toothpick mast, or a little sloop (a Review choice, GUEST_LOOKS), and a
// card sail with their first name on it, at full size (GuestBoat scales it
// for the layout, guestScale). Every boat shares the hull, creases and card;
// only the name's texture is each boat's own.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { foldedPaper } from './paperBoatGeometry.ts';
import { GUEST_BOAT, GUEST_CARD, cormorantWidth, guestCard } from './guestBoat.ts';
import { GUEST_SLOOP_PAINT, type GuestLook } from './boatLooks.ts';
import { SAIL_EASED, dinghyHull, sail, spar } from './storyBoatGeometry.ts';

type Point = [number, number, number];

// A guest's hull and mast for a look, and the paper's creases (the sloop has none).
export const guestBoatHull = (look: GuestLook, top: number): { geometry: THREE.BufferGeometry; creases: THREE.BufferGeometry | null } =>
  look === 'sloop' ? { geometry: guestSloop(top), creases: null } : guestHull(top);

// The hull and its mast, up to `top`, in one mesh, coloured per vertex, and
// the hull's creases. In the boat's frame: bow to −z, the water at y 0.
export function guestHull(top: number) {
  const { geometry: paper, creases } = foldedPaper();
  const foot = .06;
  const mast = new THREE.CylinderGeometry(.011, .013, top - foot, 6, 1, true).toNonIndexed();
  mast.translate(0, (top + foot) / 2, -.012);
  mast.deleteAttribute('uv');
  const wood = new THREE.Color('#c9a878'), colors = new Float32Array(mast.attributes.position.count * 3);
  for (let i = 0; i < colors.length; i += 3) wood.toArray(colors, i);
  mast.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const geometry = mergeGeometries([paper, mast])!;
  paper.dispose(); mast.dispose();
  return { geometry, creases };
}

// The sloop: the story dinghies' hull a little larger, to the paper boat's
// length (GUEST_BOAT.halfLength, which the berths keep clear), in the guests'
// paint, a wooden mast up to `top` where the paper boat's toothpick stands,
// with the name's card at its head as on the paper boat, and below the card
// a mainsail on a boom aft of the mast and a jib to the bow, ivory banded in
// the invitations' brown as the toy sloops' are in their colours. They're
// eased wing on wing, the main to starboard and the jib to port, as the
// story boats' are (SAIL_EASED): on the centreline a phone's dock view, along
// the boats from above, saw only their edges, and desktop's, off their beam,
// still sees most of their faces.
// All one mesh, coloured per vertex. In the boat's frame: bow to −z, the
// water at y 0.
const SLOOP = {
  scale: 1.05, mast: -.012, head: .57, foot: .2, cloth: '#fbf6ea', band: '#6b4f3e',
  eased: SAIL_EASED, main: { boom: .62, bands: [2, 6] }, jib: { tack: -.74, foot: .5, bands: [3, 7] },
} as const;
// A sail's rows run level from its foot to its head (sail: 12 of them), so
// whole rows painted make straight bands.
function banded(cloth: THREE.BufferGeometry, rows: readonly number[], foot: number, head: number) {
  const position = cloth.attributes.position, colour = cloth.attributes.color as THREE.BufferAttribute;
  const band = new THREE.Color(SLOOP.band);
  for (let i = 0; i < position.count; i += 3) {
    const middle = (position.getY(i) + position.getY(i + 1) + position.getY(i + 2)) / 3;
    if (!rows.includes(Math.floor((middle - foot) / (head - foot) * 12))) continue;
    for (let k = 0; k < 3; k++) colour.setXYZ(i + k, band.r, band.g, band.b);
  }
  cloth.deleteAttribute('uv');
  return cloth;
}
export function guestSloop(top: number) {
  const hull = dinghyHull(GUEST_SLOOP_PAINT);
  hull.scale(SLOOP.scale, SLOOP.scale, SLOOP.scale);
  const { mast: z, head, foot, eased, main, jib } = SLOOP;
  const mast = spar([0, .06, z], [0, top, z], .013, '#c9a878');
  // The boom out to starboard from the mast; the jib's clew out to port, its foot `jib.foot` from the tack.
  const clew: Point = [Math.sin(eased) * main.boom, foot, z + .02 + Math.cos(eased) * main.boom];
  const jibClew: Point = [-Math.sin(eased) * jib.foot, foot, jib.tack + Math.cos(eased) * jib.foot];
  const boom = spar([0, foot, z + .02], clew, .009, '#c9a878');
  const mainsail = banded(sail([0, head, z + .02], [0, foot, z + .02], clew, .03, SLOOP.cloth), main.bands, foot, head);
  const jibsail = banded(sail([0, head, z - .02], [0, foot, jib.tack], jibClew, -.03, SLOOP.cloth), jib.bands, foot, head);
  const geometry = mergeGeometries([hull, mast, boom, mainsail, jibsail])!;
  for (const part of [hull, mast, boom, mainsail, jibsail]) part.dispose();
  return geometry;
}

// The card, threaded on the mast at its middle, bowed a little back at its
// edges like a sail; its front faces +z. Its foot is at y 0. One unit wide:
// each boat stretches it to its name's width (guestCard).
export function cardGeometry() {
  const { height } = GUEST_BOAT.card;
  const geometry = new THREE.PlaneGeometry(1, height, 8, 1);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const u = position.getX(i) * 2;
    position.setZ(i, u * u * .035);
    position.setY(i, position.getY(i) + height / 2);
  }
  geometry.computeVertexNormals();
  return geometry;
}

// The card's paper and the name in the Garden's ink, at CARD_PIXELS a unit:
// Cormorant Garamond, as the celebration's copy and the invitations, at the
// size guestCard gives (measured with Cormorant's own widths, so the card is
// the same width before the font has loaded). Drawn again once it is in.
const PAPER = '#f8f4e9', INK = '#384135', FONT = (size: number) => `500 ${size}px "Cormorant Garamond", Georgia, serif`;
export const CARD_PIXELS = 1400;
export function cardTexture(name: string) {
  const { height } = GUEST_BOAT.card, card = guestCard(name, cormorantWidth);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(CARD_PIXELS * card.width); canvas.height = Math.round(CARD_PIXELS * height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const ctx = canvas.getContext('2d')!;
  const draw = () => {
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, canvas.width, canvas.height);
    // A fine ruled border, as on a place card.
    ctx.strokeStyle = '#b9b29c'; ctx.lineWidth = 5;
    ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);
    let size = card.size * CARD_PIXELS;
    ctx.font = FONT(size);
    // Georgia, before Cormorant is in, runs wider: kept inside the card.
    const room = canvas.width - 2 * GUEST_CARD.margin * GUEST_CARD.em * CARD_PIXELS;
    size *= Math.min(1, room / ctx.measureText(name).width);
    ctx.font = FONT(size); ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // Optically centred: lowercase sits a little above the line's middle.
    ctx.fillText(name, canvas.width / 2, canvas.height / 2 + size * .04);
    texture.needsUpdate = true;
  };
  draw();
  void document.fonts?.load(FONT(100), name).then(draw, () => {});
  return { texture, width: card.width };
}
