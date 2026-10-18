// A hot-air balloon in one mesh: a teardrop envelope of vertical gores in
// warm stripes, a crown and skirt, and a small wicker basket, plus the ropes
// between them as lines. About 900 triangles. The envelope's mouth is at the
// origin; the basket hangs below it.
import * as THREE from 'three';

// Faded terracotta, cream, ochre and dusty teal, a little richer than the
// page palette because distance and the mist wash them out.
const STRIPES = ['#a9553b', '#e9d9b8', '#c48f35', '#4d827f', '#e9d9b8', '#c48f35'];
const CROWN = '#a9553b', SKIRT = '#3f5f5c', WICKER = '#8b6a45', WICKER_DARK = '#5e4630', ROPE = '#5a4a3a';
// The envelope's profile, mouth to crown: [radius, height].
const PROFILE: [number, number][] = [[.3, 0], [.38, .18], [.56, .5], [.78, .88], [.99, 1.28], [1.15, 1.66], [1.24, 2.02],
  [1.26, 2.34], [1.19, 2.66], [1.02, 2.94], [.74, 3.15], [.4, 3.28], [0, 3.32]];
const GORES = 12, PER_GORE = 3, BULGE = .035;
const BASKET = { half: .2, top: -.5, bottom: -.78 };

export const BALLOON = { height: PROFILE[PROFILE.length - 1][1] - BASKET.bottom, burner: -.22, basketTop: BASKET.top };

export function balloonGeometry() {
  const positions: number[] = [], normals: number[] = [], colors: number[] = [];
  const color = new THREE.Color();
  const push = (p: THREE.Vector3, n: THREE.Vector3, c: THREE.Color) => {
    positions.push(p.x, p.y, p.z); normals.push(n.x, n.y, n.z); colors.push(c.r, c.g, c.b);
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
  const surface = (i: number, gore: number, step: number) => {
    const u = step / PER_GORE, angle = (gore + u) / GORES * Math.PI * 2;
    const { r, y, nr, ny } = ring[i];
    const bulge = 1 + BULGE * Math.sin(Math.PI * u);
    // The bulge tips the normal towards each seam.
    const tilt = -BULGE * Math.PI * Math.cos(Math.PI * u) * GORES / (Math.PI * 2);
    const cos = Math.cos(angle), sin = Math.sin(angle);
    return {
      p: new THREE.Vector3(cos * r * bulge, y, sin * r * bulge),
      n: new THREE.Vector3(nr * (cos - tilt * sin), ny, nr * (sin + tilt * cos)).normalize(),
    };
  };
  for (let gore = 0; gore < GORES; gore++) {
    for (let i = 0; i < last; i++) {
      // Two bands of skirt at the mouth and two of crown at the top.
      color.set(i < 2 ? SKIRT : i >= last - 2 ? CROWN : STRIPES[gore % STRIPES.length]);
      for (let step = 0; step < PER_GORE; step++) {
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

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  // Four ropes from the mouth to the basket's corners.
  const ropes: number[] = [];
  for (const [x, z] of [[1, 1], [1, -1], [-1, -1], [-1, 1]]) {
    const angle = Math.atan2(z, x), r = PROFILE[0][0];
    ropes.push(Math.cos(angle) * r, 0, Math.sin(angle) * r, x * half * .9, top, z * half * .9);
  }
  const lines = new THREE.BufferGeometry();
  lines.setAttribute('position', new THREE.Float32BufferAttribute(ropes, 3));
  return { geometry, lines, rope: ROPE };
}
