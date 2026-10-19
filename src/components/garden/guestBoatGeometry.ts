// The guest's paper boat (guestBoat.ts): the guests' folded paper boat with a
// toothpick mast, and a card sail with the Party's names on it, at full size
// (GuestBoat scales it for the layout, guestScale).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { foldedPaper } from './paperBoatGeometry.ts';
import { CARD_TYPE, GUEST_BOAT, fitGreeting } from './guestBoat.ts';

// The hull and its mast in one mesh, coloured per vertex, and the hull's
// creases. In the boat's frame: bow to −z, the water at y 0.
export function guestHull() {
  const { geometry: paper, creases } = foldedPaper();
  const { top } = GUEST_BOAT, foot = .06;
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

// The card, threaded on the mast at its middle, bowed a little back at its
// edges like a sail; its front faces +z. Its foot is at y 0.
export function cardGeometry() {
  const { width, height } = GUEST_BOAT.card;
  const geometry = new THREE.PlaneGeometry(width, height, 8, 1);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const u = position.getX(i) / (width / 2);
    position.setZ(i, u * u * .045);
    position.setY(i, position.getY(i) + height / 2);
  }
  geometry.computeVertexNormals();
  return geometry;
}

// The card's paper and the names in the Garden's ink, at 1024px across:
// Cormorant Garamond, as the celebration's copy and the invitations, set as
// large as fits in one to three lines (fitGreeting). Drawn once the font is in.
const PAPER = '#f8f4e9', INK = '#384135', FONT = (size: number) => `500 ${size}px "Cormorant Garamond", Georgia, serif`;
export const CARD_PIXELS = 1024;
export function cardTexture(greeting: string) {
  const { width, height } = GUEST_BOAT.card;
  const canvas = document.createElement('canvas');
  canvas.width = CARD_PIXELS; canvas.height = Math.round(CARD_PIXELS * height / width);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const ctx = canvas.getContext('2d')!;
  const draw = () => {
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, canvas.width, canvas.height);
    // A fine ruled border, as on a place card.
    ctx.strokeStyle = '#b9b29c'; ctx.lineWidth = 5;
    ctx.strokeRect(26, 26, canvas.width - 52, canvas.height - 52);
    const measure = (text: string) => { ctx.font = FONT(100); return ctx.measureText(text).width / 100; };
    const { lines, size } = fitGreeting(greeting, measure, { width: canvas.width, height: canvas.height });
    ctx.font = FONT(size); ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const step = size * CARD_TYPE.lineHeight;
    // Optically centred: lowercase sits a little above the line's middle.
    lines.forEach((line, i) => ctx.fillText(line, canvas.width / 2, canvas.height / 2 + (i - (lines.length - 1) / 2) * step + size * .04));
    texture.needsUpdate = true;
  };
  draw();
  void document.fonts?.load(FONT(100), greeting).then(draw, () => {});
  return texture;
}
