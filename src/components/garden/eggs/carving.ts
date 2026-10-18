// Carving into wood on a canvas, for the university years' ornaments (see
// uniOrnaments.ts): each groove is cut through the weathered surface to the
// paler wood under it, its upper wall in shadow, and drawn again into a depth
// map the material uses as a bump map, so the sun catches its edges. Shapes
// and text are carved alike, from a function that draws them.
import * as THREE from 'three';

export const WOOD = { shadow: '#1f140b', cut: '#ecd7ae', floor: '#bf9b6a' } as const;
// Draws the shape at `width` (a stroke's width, or how much a glyph is
// thickened) with the context's current fill and stroke.
export type Shape = (ctx: CanvasRenderingContext2D, width: number) => void;
export type Carver = { colour: CanvasRenderingContext2D; depth: CanvasRenderingContext2D };

// A colour canvas and its depth map, as textures. `paint` draws the whole
// surface, carvings and all, and is run again once Cormorant has loaded, so
// lettering is never left in the fallback serif.
export function carvedTextures(width: number, height: number, paint: (carver: Carver) => void) {
  const make = () => Object.assign(document.createElement('canvas'), { width, height });
  const colour = make(), depth = make();
  const map = new THREE.CanvasTexture(colour), bumpMap = new THREE.CanvasTexture(depth);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = bumpMap.anisotropy = 8;
  const draw = () => {
    const carver = { colour: colour.getContext('2d')!, depth: depth.getContext('2d')! };
    carver.depth.fillStyle = '#fff';
    carver.depth.fillRect(0, 0, width, height);
    paint(carver);
    map.needsUpdate = bumpMap.needsUpdate = true;
  };
  draw();
  document.fonts?.load('italic 500 100px "Cormorant Garamond"').then(draw, () => {});
  return { map, bumpMap };
}

// Cuts a shape: the shadowed upper wall, the pale cut wood nudged down and
// right of it, and for strokes a narrow, darker floor down the middle.
export function incise({ colour: ctx, depth }: Carver, shape: Shape, width: number, floor = true) {
  const pass = (target: CanvasRenderingContext2D, style: string, alpha: number, w: number, dx: number, dy: number) => {
    target.save();
    target.globalAlpha = alpha;
    target.fillStyle = target.strokeStyle = style;
    target.lineCap = target.lineJoin = 'round';
    target.translate(dx, dy);
    shape(target, w);
    target.restore();
  };
  const nudge = Math.max(1.5, width * .22);
  pass(ctx, WOOD.shadow, .82, width * 1.5, -nudge * .7, -nudge);
  pass(ctx, WOOD.cut, 1, width, nudge * .35, nudge * .45);
  if (floor) pass(ctx, WOOD.floor, .7, width * .35, nudge * .5, nudge * .6);
  depth.filter = 'blur(1.5px)';
  pass(depth, '#000', 1, width * 1.2, 0, 0);
  depth.filter = 'none';
}

// A polyline as a shape, through points in canvas pixels.
export const line = (points: readonly (readonly [number, number])[]): Shape => (ctx, width) => {
  ctx.lineWidth = width;
  ctx.beginPath();
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.stroke();
};

// Text as a shape, in Cormorant like the Garden's date, centred on x.
export const lettering = (text: string, x: number, y: number, size: number, italic = true): Shape => (ctx, width) => {
  ctx.font = `${italic ? 'italic ' : ''}500 ${size}px "Cormorant Garamond", Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineWidth = width;
  ctx.fillText(text, x, y);
  ctx.strokeText(text, x, y);
};
