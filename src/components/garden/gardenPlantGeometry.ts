import * as THREE from 'three';
import { bankEdge, groundHeight, random, riverCenter } from './gardenGeometry.ts';

export type PlantKind = 'grass' | 'clover' | 'fern';
export type PlantStyle = 'original' | 'varied';

// Small opaque meshes keep the shoreline detailed without layers of alpha cards.
// Each batch reuses one clump; rotation, scale and tint vary at each planted site.
export function plantGeometry(kind: PlantKind) {
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const rand = random(kind === 'grass' ? 814 : kind === 'clover' ? 296 : 507);
  const rootColor = new THREE.Color(kind === 'grass' ? '#596b36' : '#476139');
  const tipColor = new THREE.Color(kind === 'grass' ? '#a5b46b' : '#87a363');
  const color = new THREE.Color();
  function ribbon(origin: THREE.Vector3, angle: number, length: number, height: number, breadth: number, grass = false) {
    const offset = positions.length / 3;
    for (let row = 0; row <= 4; row++) {
      const t = row / 4;
      const spread = grass ? breadth * (1 - t) * (.7 + t) : breadth * Math.sin(Math.PI * t);
      const reach = length * (grass ? t * t : t);
      for (const side of [-1, 1]) {
        positions.push(origin.x + Math.sin(angle) * reach + Math.cos(angle) * spread * side,
          origin.y + height * t + (grass ? 0 : Math.sin(t * Math.PI) * .035),
          origin.z + Math.cos(angle) * reach - Math.sin(angle) * spread * side);
        color.copy(rootColor).lerp(tipColor, t * .8 + (side === 1 ? .08 : 0));
        colors.push(color.r, color.g, color.b);
      }
      if (row < 4) {
        const a = offset + row * 2;
        indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
  }
  if (kind === 'grass') {
    for (let blade = 0; blade < 9; blade++) {
      const angle = blade * 2.4 + rand() * .5;
      ribbon(new THREE.Vector3(Math.sin(angle) * .035, 0, Math.cos(angle) * .035), angle,
        .12 + rand() * .22, .32 + rand() * .36, .018 + rand() * .015, true);
    }
  } else if (kind === 'clover') {
    for (let stem = 0; stem < 3; stem++) {
      const angle = stem * 2.4;
      const origin = new THREE.Vector3(Math.sin(angle) * .13, .045 + rand() * .06, Math.cos(angle) * .13);
      for (let leaf = 0; leaf < 3; leaf++) ribbon(origin, angle + leaf * Math.PI * 2 / 3, .16 + rand() * .05, .035, .075);
    }
  } else {
    for (let frond = 0; frond < 4; frond++) {
      const angle = frond * 2.4, length = .36 + rand() * .12;
      ribbon(new THREE.Vector3(), angle, length, .23, .013, true);
      for (let pair = 1; pair <= 3; pair++) {
        const t = pair / 4;
        const origin = new THREE.Vector3(Math.sin(angle) * length * t * t, .23 * t, Math.cos(angle) * length * t * t);
        for (const side of [-1, 1]) ribbon(origin, angle + side * 1.05, .15 * (1 - t * .6), .04, .029);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export function plantSites(kind: PlantKind, width: number, mobile: boolean) {
  const counts = mobile ? { grass: 1450, clover: 650, fern: 100 } : { grass: 2100, clover: 950, fern: 160 };
  const salt = kind === 'grass' ? 731 : kind === 'clover' ? 937 : 1143;
  const rand = random(salt);
  return Array.from({ length: counts[kind] }, (_, i) => {
    // Different species favour different pockets, with gaps between colonies.
    // Most detail lies along the camera's route; the mist needs fewer clumps.
    const cluster = Math.floor(i / (kind === 'fern' ? 3 : 14));
    const pocket = random(cluster * 97 + salt);
    const z = 23 - Math.pow(pocket(), 1.5) * 111 + (rand() - .5) * 3;
    const side = cluster % 2 ? 1 : -1;
    const inland = .7 + pocket() * (kind === 'fern' ? 3.5 : 4.5) + rand() * .7;
    const x = riverCenter(z, width) + side * (bankEdge(z, width) + inland);
    return { x, y: groundHeight(x, z, width) - .025, z, angle: rand() * Math.PI * 2,
      scale: .65 + rand() * .6, tint: .85 + rand() * .25 };
  });
}
