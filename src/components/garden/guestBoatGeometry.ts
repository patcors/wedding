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
import { dinghyHull, sail, spar } from './storyBoatGeometry.ts';

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
// length (GUEST_BOAT.halfLength, which the berths keep clear), in the guests' paint, a wooden mast up to `top` where the paper
// boat's toothpick stands, and a jib from the bow to the mast below the card,
// eased to starboard so it shows its face beside the card. The card is its
// main. All one mesh, coloured per vertex. In the boat's frame: bow to −z,
// the water at y 0.
const SLOOP = { scale: 1.05, mast: -.012, jib: { head: .57, tack: [0, .2, -.74], clew: [.3, .23, -.02] } } as const;
export function guestSloop(top: number) {
  const hull = dinghyHull(GUEST_SLOOP_PAINT);
  hull.scale(SLOOP.scale, SLOOP.scale, SLOOP.scale);
  const mast = spar([0, .06, SLOOP.mast], [0, top, SLOOP.mast], .013, '#c9a878');
  const { head, tack, clew } = SLOOP.jib;
  const jib = sail([0, head, SLOOP.mast - .02], [...tack], [...clew], .03, '#fbf6ea');
  jib.deleteAttribute('uv');
  const geometry = mergeGeometries([hull, mast, jib])!;
  hull.dispose(); mast.dispose(); jib.dispose();
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
