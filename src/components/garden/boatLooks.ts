// How the story boats look, the two dinghies before they join and the
// catamaran they become, and the guests' own boats. Guests see BOAT_LOOK: the
// toy sloops, joining into the original catamaran in their paint, and paper
// boats for themselves. The others are dev-only Review
// choices. Each look is paint (hull colours and sail cloth) here, and shape
// (rig, cabin) in storyBoatGeometry.ts.
import * as THREE from 'three';

// The looks to choose from, apart so the page's first script needn't load three.
import type { CatamaranLook, DinghyLook } from './boatLookChoices.ts';
export { BOAT_LOOK, CATAMARAN_LOOKS, DINGHY_LOOKS, GUEST_LOOKS, boatLook, type BoatLook, type CatamaranLook, type DinghyLook, type GuestLook } from './boatLookChoices.ts';

export type Owner = 'amelia' | 'patrick';
// Each one's colour, carried into every look so the two boats stay told apart.
const ACCENT = {
  amelia: { paint: '#86aaa1', deep: '#5f8a81', light: '#a9cdc4' },
  patrick: { paint: '#e0c87f', deep: '#c4a24f', light: '#ecd896' },
} as const;

// A hull's paint: its outside strakes from the rim down to the keel (mirrored
// to starboard), the straps painted across some strakes, and the inside.
// `sheer` lifts the rim towards the bow, in model units.
export type HullPaint = {
  strakes: string[]; strap?: string; rim: string; wall: string; floor: string;
  transom: string; bow: string; sheer: number;
};

// The original boats' paint, as they were before the looks.
const ORIGINAL = {
  amelia: { topsides: '#d3ad76', bottom: '#ac824f', stripe: '#86aaa1', transom: '#86aaa1', rim: '#9dbcb3', wall: '#bd9058', floor: '#c99f65' },
  patrick: { topsides: '#e6d193', bottom: '#c8b273', stripe: '#f4ecd6', transom: '#e0c87f', rim: '#efe2b0', wall: '#d6bf7c', floor: '#dcc688' },
} as const;

export function dinghyPaint(look: DinghyLook, owner: Owner): HullPaint {
  const accent = ACCENT[owner];
  switch (look) {
    case 'toy': return {
      strakes: [accent.deep, accent.paint, accent.paint, accent.paint, '#f4efe3', '#ece6d8'],
      rim: '#f4efe3', wall: '#efe7d4', floor: '#c99f65', transom: accent.paint, bow: accent.paint, sheer: .03,
    };
    case 'lugger': return {
      strakes: ['#4e3328', '#6b4434', '#5e3b2e', '#6b4434', '#5a392c', '#4a3027'], strap: '#34302d',
      rim: '#3e2a22', wall: '#5e3b2e', floor: '#6b4434', transom: '#5a392c', bow: '#5a392c', sheer: .09,
    };
    case 'skiff': return {
      strakes: [accent.paint, '#7a6a5a', '#6e5f50', '#7a6a5a', '#e8e2d6', '#ded8cb'],
      rim: '#5e5044', wall: '#6e5f50', floor: '#857262', transom: '#6e5f50', bow: '#7a6a5a', sheer: .06,
    };
    default: {
      const o = ORIGINAL[owner];
      return {
        strakes: [o.stripe, o.topsides, o.topsides, o.topsides, o.bottom, o.bottom],
        rim: o.rim, wall: o.wall, floor: o.floor, transom: o.transom, bow: o.topsides, sheer: 0,
      };
    }
  }
}
// The guests' sloops: ivory, as their cards are, with a stripe of the
// invitations' brown under the rim, a warm wooden bottom and floor, so
// they're never taken for Amelia's teal or Patrick's yellow.
export const GUEST_SLOOP_PAINT: HullPaint = {
  strakes: ['#6b4f3e', '#f4efe3', '#f4efe3', '#efe8d8', '#d8c6a2', '#cdb991'],
  rim: '#f4efe3', wall: '#efe7d4', floor: '#c99f65', transom: '#6b4f3e', bow: '#f4efe3', sheer: .03,
};

// The catamaran's hull paint, which the dinghy's blends into as the hulls
// grow long; the original keeps the dinghy's.
export function catamaranPaint(look: CatamaranLook, owner: Owner, dinghy: HullPaint): HullPaint {
  switch (look) {
    case 'cruiser': case 'numbered': return {
      strakes: ['#2f4a6b', '#f3f1ec', '#f3f1ec', '#eeece6', '#e4e2dc', '#dcdad4'],
      rim: '#f3f1ec', wall: '#eeece6', floor: '#f3f1ec', transom: '#eeece6', bow: '#f3f1ec', sheer: 0,
    };
    case 'warm': return {
      strakes: [ACCENT[owner].paint, '#f1ead9', '#f1ead9', '#ebe3d0', '#e2d8c2', '#d9cfb8'],
      rim: '#efe6d2', wall: '#e9e0cb', floor: '#efe6d2', transom: '#e9e0cb', bow: '#f1ead9', sheer: 0,
    };
    default: return { ...dinghy, strap: undefined, sheer: 0 };
  }
}

// Deck planks, crossbeams first.
export function deckColours(look: CatamaranLook) {
  return look === 'cruiser' || look === 'numbered'
    ? { beam: '#d4d1c9', planks: ['#ebe8e1', '#f1eee8', '#e5e2da', '#eeebe4'] }
    : { beam: '#bd9058', planks: ['#c99f65', '#d3ad76', '#bd9058', '#cfa66c'] };
}
// The big mast and boom: alloy on the cruisers, wood otherwise.
export const bigSparTint = (look: CatamaranLook) => look === 'cruiser' || look === 'numbered' ? '#d3d6d6' : '#d8b47d';

// Sail cloth, drawn on a canvas in the sail's uv: x along its foot from the
// mast, y up its luff (uv 0,0 the tack, canvas bottom left).
function cloth(size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
// A horizontal band between heights `from` and `to` (0 the foot, 1 the head).
const band = (ctx: CanvasRenderingContext2D, s: number, from: number, to: number, fill: string) => {
  ctx.fillStyle = fill; ctx.fillRect(0, s * (1 - to), s, s * (to - from));
};
// A row of curling waves along a band, as on the lugger's sail.
function waves(ctx: CanvasRenderingContext2D, s: number, from: number, to: number, ground: string, ink: string) {
  band(ctx, s, from, to, ground);
  const h = s * (to - from), cy = s * (1 - (from + to) / 2), r = h * .3;
  ctx.strokeStyle = ink; ctx.lineWidth = Math.max(1.5, h * .08); ctx.lineCap = 'round';
  for (let x = r * 1.4; x < s + r * 3; x += r * 3.2) {
    ctx.beginPath();
    for (let a = 0; a <= Math.PI * 3.2; a += .15) {
      const k = 1 - a / (Math.PI * 4);
      ctx.lineTo(x + Math.cos(a + Math.PI) * r * k, cy + Math.sin(a + Math.PI) * r * k);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - r, cy);
    ctx.quadraticCurveTo(x - r * 1.6, cy + r * 1.1, x - r * 2.6, cy + r * .2);
    ctx.stroke();
  }
}

// The small boats' mainsail and jib for a dinghy look; null for the plain ivory original.
export function dinghySailCloth(look: DinghyLook, owner: Owner, sail: 'main' | 'jib') {
  const accent = ACCENT[owner];
  switch (look) {
    case 'toy': return cloth(128, (ctx, s) => {
      band(ctx, s, 0, 1, '#f6f1e4');
      const stripes = sail === 'main' ? [[.14, .3], [.5, .63]] : [[.2, .34], [.56, .67]];
      for (const [from, to] of stripes) band(ctx, s, from, to, accent.paint);
    });
    case 'lugger': return cloth(256, (ctx, s) => {
      band(ctx, s, 0, 1, '#d6cfc2');
      waves(ctx, s, .2, .34, '#3d3734', accent.light);
      waves(ctx, s, .58, .72, '#3d3734', accent.light);
    });
    case 'skiff': return cloth(128, (ctx, s) => {
      band(ctx, s, 0, 1, '#f1ece0');
      ctx.fillStyle = '#e1d9c8';
      for (let k = 1; k < 8; k++) ctx.fillRect(0, s * k / 8, s, 1);
      ctx.fillStyle = accent.paint; ctx.fillRect(0, s - 4, s, 4);
    });
    default: return null;
  }
}

// The original catamaran's one main is the toy sloops' white cloth, each of
// their two stripes now a band of Amelia's teal under one of Patrick's
// yellow, their colours joined. Lower and finer than the sloops', as the
// sail is so much larger.
export const JOINED_STRIPES = [[.12, .2, 'amelia'], [.2, .28, 'patrick'], [.44, .5, 'amelia'], [.5, .56, 'patrick']] as const;

// The catamaran's mainsail or jib: the original's joined stripes (it has no
// jib), or for a cruiser look a coloured leech and foot, and on the main a
// pale panel, numbered on 'numbered'. `aspect` is the sail's height over
// its foot, so the numbers aren't stretched.
export function catamaranSailCloth(look: CatamaranLook, sail: 'main' | 'jib', aspect = 1) {
  if (look === 'original') return sail === 'jib' ? null : cloth(256, (ctx, s) => {
    band(ctx, s, 0, 1, '#f6f1e4');
    for (const [from, to, owner] of JOINED_STRIPES) band(ctx, s, from, to, ACCENT[owner].paint);
  });
  const warm = look === 'warm';
  const ground = warm ? '#f6efdd' : '#f7f5f0', edge = warm ? '#66715e' : '#2f4a6b', panel = warm ? '#dfe1d3' : '#b9cadb';
  return cloth(512, (ctx, s) => {
    band(ctx, s, 0, 1, ground);
    if (sail === 'main') band(ctx, s, look === 'numbered' ? .3 : .36, look === 'numbered' ? .54 : .5, panel);
    // The leech, the edge from the head to the clew (x + y = 1 in uv).
    const d = sail === 'main' ? .07 : .09;
    ctx.fillStyle = edge;
    ctx.beginPath();
    ctx.moveTo(s, s); ctx.lineTo(0, 0); ctx.lineTo(0, s * d); ctx.lineTo(s * (1 - d), s);
    ctx.fill();
    band(ctx, s, 0, .045, edge);
    if (look === 'numbered' && sail === 'main') {
      ctx.save();
      ctx.translate(s * .25, s * (1 - .42));
      // Mirrored: the camera behind sees the main's other face, eased to port.
      ctx.scale(-1, 1 / aspect);
      ctx.fillStyle = edge; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `600 ${s * .07}px Montserrat, Helvetica, Arial, sans-serif`;
      ctx.fillText('P & A', 0, -s * .1);
      ctx.fillRect(-s * .1, -s * .045, s * .2, s * .008);
      ctx.font = `500 ${s * .15}px Montserrat, Helvetica, Arial, sans-serif`;
      ctx.fillText('27', 0, s * .07);
      ctx.restore();
    }
  });
}
