// July 2026's hot-air balloons in one mesh: for each, a teardrop envelope of
// vertical gores in its own warm colours and pattern, a crown and skirt, and a
// small wicker basket. Each balloon's vertices are bound to its own bone
// (`skinIndex`), so one skinned draw call moves them all; its ropes are lines
// (`ropes`, placed each frame). Each envelope's mouth is at its origin; the
// basket hangs below it. The first balloon is the nearest and most finely
// made; the others, further off, have fewer facets.
import * as THREE from 'three';

// Faded terracotta, cream, ochre and dusty teal, with a faded rose and a soft
// yellow, a little richer than the page palette because distance and the mist
// wash them out.
const TERRACOTTA = '#a9553b', CREAM = '#e9d9b8', OCHRE = '#c48f35', TEAL = '#4d827f', DEEP_TEAL = '#3f5f5c', ROSE = '#c27a72', YELLOW = '#d9b45a';
const WICKER = '#8b6a45', WICKER_DARK = '#5e4630', ROPE = '#5a4a3a';
// Each look: its gores, how finely each is made (`facets`), its colours and
// how they are laid out: in vertical stripes gore by gore, in bands up the
// envelope, in checks, or in a zigzag round its middle.
export type BalloonLook = { gores: number; facets: number; pattern: 'stripes' | 'bands' | 'checks' | 'zigzag'; colours: string[]; crown: string; skirt: string };
export const BALLOON_LOOKS: readonly BalloonLook[] = [
  { gores: 12, facets: 2, pattern: 'stripes', colours: [TERRACOTTA, CREAM, OCHRE, TEAL, CREAM, OCHRE], crown: TERRACOTTA, skirt: DEEP_TEAL },
  { gores: 10, facets: 1, pattern: 'bands', colours: [TEAL, CREAM, TEAL, OCHRE], crown: TEAL, skirt: TERRACOTTA },
  { gores: 10, facets: 1, pattern: 'checks', colours: [ROSE, CREAM], crown: TERRACOTTA, skirt: ROSE },
  { gores: 10, facets: 1, pattern: 'zigzag', colours: [YELLOW, TERRACOTTA], crown: OCHRE, skirt: TERRACOTTA },
];
// The envelope's profile, mouth to crown: [radius, height].
const PROFILE: [number, number][] = [[.3, 0], [.38, .18], [.56, .5], [.78, .88], [.99, 1.28], [1.15, 1.66], [1.24, 2.02],
  [1.26, 2.34], [1.19, 2.66], [1.02, 2.94], [.74, 3.15], [.4, 3.28], [0, 3.32]];
const BULGE = .035;
const BASKET = { half: .2, top: -.5, bottom: -.78 };

export const BALLOON = { height: PROFILE[PROFILE.length - 1][1] - BASKET.bottom, radius: 1.26, burner: -.22, basketTop: BASKET.top };

// The colour of a band (`i`, mouth to crown) of a gore in a look.
function clothColour({ pattern, colours, crown, skirt }: BalloonLook, gore: number, i: number) {
  const last = PROFILE.length - 1;
  // Two bands of skirt at the mouth and two of crown at the top.
  if (i < 2) return skirt;
  if (i >= last - 2) return crown;
  const n = colours.length, band = i - 2;
  if (pattern === 'stripes') return colours[gore % n];
  if (pattern === 'bands') return colours[Math.floor(band / 2) % n];
  if (pattern === 'checks') return colours[(gore + Math.floor(band / 2)) % n];
  // A zigzag round its middle, stepping up and down gore by gore, on a plain ground.
  const low = gore % 2 ? 4 : 3;
  return band === low || band === low + 1 ? colours[1] : colours[0];
}

export function balloonGeometry(looks: readonly BalloonLook[] = BALLOON_LOOKS) {
  const positions: number[] = [], normals: number[] = [], colors: number[] = [], bones: number[] = [];
  const color = new THREE.Color();
  let bone = 0;
  const push = (p: THREE.Vector3, n: THREE.Vector3, c: THREE.Color) => {
    positions.push(p.x, p.y, p.z); normals.push(n.x, n.y, n.z); colors.push(c.r, c.g, c.b); bones.push(bone);
  };
  // Each gore bulges a little between its seams, so the stripes catch the
  // light like stitched cloth. Normals are worked out from the shape rather
  // than averaged, so the seams stay crisp and each stripe can keep its colour.
  const last = PROFILE.length - 1;
  const ring = PROFILE.map(([r, y], i) => {
    const [r0, y0] = PROFILE[Math.max(0, i - 1)], [r1, y1] = PROFILE[Math.min(last, i + 1)];
    const length = Math.hypot(y1 - y0, r1 - r0);
    return { r, y, nr: (y1 - y0) / length, ny: (r0 - r1) / length };
  });

  looks.forEach((look, index) => {
    bone = index;
    const { gores, facets } = look;
    const surface = (i: number, gore: number, step: number) => {
      const u = step / facets, angle = (gore + u) / gores * Math.PI * 2;
      const { r, y, nr, ny } = ring[i];
      const bulge = 1 + BULGE * Math.sin(Math.PI * u);
      // The bulge tips the normal towards each seam.
      const tilt = -BULGE * Math.PI * Math.cos(Math.PI * u) * gores / (Math.PI * 2);
      const cos = Math.cos(angle), sin = Math.sin(angle);
      return {
        p: new THREE.Vector3(cos * r * bulge, y, sin * r * bulge),
        n: new THREE.Vector3(nr * (cos - tilt * sin), ny, nr * (sin + tilt * cos)).normalize(),
      };
    };
    for (let gore = 0; gore < gores; gore++) {
      for (let i = 0; i < last; i++) {
        color.set(clothColour(look, gore, i));
        for (let step = 0; step < facets; step++) {
          const a = surface(i, gore, step), b = surface(i, gore, step + 1), c = surface(i + 1, gore, step + 1), d = surface(i + 1, gore, step);
          // Wound so the outside faces out.
          for (const v of [a, c, b, a, d, c]) push(v.p, v.n, color);
        }
      }
    }
    // The basket: a box, darker at its rim.
    const { half, top, bottom } = BASKET;
    const corner = (x: number, y: number, z: number) => new THREE.Vector3(x * half, y ? top : bottom, z * half);
    const faces: [THREE.Vector3, THREE.Vector3[]][] = [
      [new THREE.Vector3(1, 0, 0), [corner(1, 0, -1), corner(1, 0, 1), corner(1, 1, 1), corner(1, 1, -1)]],
      [new THREE.Vector3(-1, 0, 0), [corner(-1, 0, 1), corner(-1, 0, -1), corner(-1, 1, -1), corner(-1, 1, 1)]],
      [new THREE.Vector3(0, 0, 1), [corner(1, 0, 1), corner(-1, 0, 1), corner(-1, 1, 1), corner(1, 1, 1)]],
      [new THREE.Vector3(0, 0, -1), [corner(-1, 0, -1), corner(1, 0, -1), corner(1, 1, -1), corner(-1, 1, -1)]],
      [new THREE.Vector3(0, -1, 0), [corner(-1, 0, -1), corner(-1, 0, 1), corner(1, 0, 1), corner(1, 0, -1)]],
      [new THREE.Vector3(0, 1, 0), [corner(-1, 1, 1), corner(-1, 1, -1), corner(1, 1, -1), corner(1, 1, 1)]],
    ];
    for (const [n, [a, b, c, d]] of faces) {
      for (const v of [a, c, b, a, d, c]) push(v, n, color.set(v.y === top && n.y === 0 ? WICKER_DARK : WICKER));
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(bones.flatMap(b => [b, 0, 0, 0]), 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(bones.flatMap(() => [1, 0, 0, 0]), 4));

  // Four ropes from the mouth to the basket's corners, in a balloon's own frame.
  const ropes: THREE.Vector3[] = [];
  for (const [x, z] of [[1, 1], [1, -1], [-1, -1], [-1, 1]]) {
    const angle = Math.atan2(z, x), r = PROFILE[0][0];
    ropes.push(new THREE.Vector3(Math.cos(angle) * r, 0, Math.sin(angle) * r), new THREE.Vector3(x * BASKET.half * .9, BASKET.top, z * BASKET.half * .9));
  }
  return { geometry, ropes, rope: ROPE };
}
