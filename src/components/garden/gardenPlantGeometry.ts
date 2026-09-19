import * as THREE from 'three';
import { bankEdge, groundHeight, random, riverCenter } from './gardenGeometry.ts';

export type PlantKind = 'grass' | 'clover' | 'fern' | 'meadow' | 'reed' | 'cattail';
export type PlantStyle = 'original' | 'varied';

// Small opaque meshes keep the shoreline detailed without layers of alpha cards.
// Each batch reuses one clump; rotation, scale and tint vary at each planted site.
export function plantGeometry(kind: PlantKind) {
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const rand = random(kind === 'grass' ? 814 : kind === 'clover' ? 296 : 507);
  const rootColor = new THREE.Color(kind === 'grass' || kind === 'meadow' ? '#596b36' : '#476139');
  const tipColor = new THREE.Color(kind === 'grass' || kind === 'meadow' ? '#a5b46b' : '#87a363');
  const color = new THREE.Color();
  function stalk(bottom: number, top: number, radius: number, shade: string) {
    const cylinder = new THREE.CylinderGeometry(radius, radius * .85, top - bottom, 6);
    cylinder.translate(0, (top + bottom) / 2, 0);
    const offset = positions.length / 3;
    const vertices = cylinder.getAttribute('position');
    color.set(shade);
    for (let i = 0; i < vertices.count; i++) {
      positions.push(vertices.getX(i), vertices.getY(i), vertices.getZ(i));
      colors.push(color.r, color.g, color.b);
    }
    for (const index of cylinder.index!.array) indices.push(offset + index);
    cylinder.dispose();
  }
  function ribbon(origin: THREE.Vector3, angle: number, length: number, height: number, breadth: number, grass = false) {
    const offset = positions.length / 3;
    const segments = kind === 'meadow' ? 2 : 4;
    for (let row = 0; row <= segments; row++) {
      const t = row / segments;
      const spread = grass ? breadth * (1 - t) * (.7 + t) : breadth * Math.sin(Math.PI * t);
      const reach = length * (grass ? t * t : t);
      for (const side of [-1, 1]) {
        positions.push(origin.x + Math.sin(angle) * reach + Math.cos(angle) * spread * side,
          origin.y + height * t + (grass ? 0 : Math.sin(t * Math.PI) * .035),
          origin.z + Math.cos(angle) * reach - Math.sin(angle) * spread * side);
        color.copy(rootColor).lerp(tipColor, t * .8 + (side === 1 ? .08 : 0));
        colors.push(color.r, color.g, color.b);
      }
      if (row < segments) {
        const a = offset + row * 2;
        indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
  }
  if (kind === 'meadow') {
    // One tapered blade following a quadratic Bezier; instances vary its
    // width, height and orientation instead of repeating a three-blade tuft.
    for (let row = 0; row <= 3; row++) {
      const t = row / 3;
      const halfWidth = .026 * Math.pow(1 - t, .8);
      const y = 2 * (1 - t) * t * .19 + t * t * .28;
      const z = t * t * .12;
      color.copy(rootColor).multiplyScalar(.65).lerp(tipColor, Math.sqrt(t) * .85);
      for (const side of [-1, 1]) {
        positions.push(side * halfWidth, y, z);
        colors.push(color.r, color.g, color.b);
      }
      if (row < 3) {
        const a = row * 2;
        indices.push(a, a + 2, a + 1);
        if (row < 2) indices.push(a + 1, a + 2, a + 3);
      }
    }
  } else if (kind === 'grass') {
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
  } else if (kind === 'reed' || kind === 'cattail') {
    for (let blade = 0; blade < (kind === 'reed' ? 5 : 2); blade++) {
      const angle = blade * 2.4 + rand() * .5;
      ribbon(new THREE.Vector3(), angle, .18 + rand() * .16,
        .65 + rand() * .45, .025 + rand() * .012, true);
    }
    if (kind === 'cattail') {
      stalk(0, 1.52, .013, '#667342');
      stalk(1.12, 1.43, .048, '#68482e');
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
  if (kind === 'reed' || kind === 'cattail') {
    const rand = random(kind === 'reed' ? 3107 : 4129);
    const patches = [{ z: 7, side: -1 }, { z: -5, side: 1 }, { z: -23, side: -1 },
      { z: -39, side: 1 }, { z: -61, side: -1 }, { z: -80, side: 1 }];
    const reedColumns = 8, reedRows = mobile ? 8 : 12;
    const perPatch = kind === 'reed' ? reedColumns * reedRows : (mobile ? 4 : 6);
    return patches.flatMap(patch => Array.from({ length: perPatch }, (_, i) => {
      // A gently jittered grid fills the shallows with a small overlap onto
      // the bank, keeping the fringe connected where the shoreline bends.
      const z = kind === 'reed'
        ? patch.z + ((Math.floor(i / reedColumns) + .3 + rand() * .4) / reedRows - .5) * 3.5
        : patch.z + (rand() - .5) * 3;
      const inland = kind === 'cattail' ? -.4 - rand() * .4
        : -1.05 + (i % reedColumns + .3 + rand() * .4) / reedColumns * 1.825;
      const x = riverCenter(z, width) + patch.side * (bankEdge(z, width) + inland);
      const y = inland < 0 ? -.22 : groundHeight(x, z, width) - .025;
      return { x, y, z, angle: rand() * Math.PI * 2,
        scale: .8 + rand() * .3, tint: .85 + rand() * .2 };
    }));
  }
  if (kind === 'meadow') {
    const rand = random(2081);
    const columns = mobile ? 100 : 200;
    const rows = mobile ? 200 : 250;
    // Jitter a continuous carpet across the whole terrain, beyond the narrow
    // shoreline colonies. Both sides retain coverage at every depth.
    return Array.from({ length: columns * rows * 2 }, (_, i) => {
      const cell = Math.floor(i / 2);
      // Concentrate blades on the visible inner meadow, retaining coverage
      // beneath the outer trees. Roots remain clear of the water.
      const lateral = (cell % columns + .1 + rand() * .8) / columns;
      const inland = .65 + Math.pow(lateral, 1.6) * 52;
      const z = 25 - (Math.floor(cell / columns) + .15 + rand() * .7) / rows * 138;
      const x = riverCenter(z, width) + (i % 2 ? 1 : -1) * (bankEdge(z, width) + inland);
      return { x, y: groundHeight(x, z, width) - .025, z, angle: rand() * Math.PI * 2,
        scale: .65 + rand() * .65, tint: .8 + rand() * .3 };
    });
  }
  const counts = mobile ? { grass: 1530, clover: 650, fern: 100 } : { grass: 3000, clover: 1250, fern: 220 };
  const salt = kind === 'grass' ? 731 : kind === 'clover' ? 937 : 1143;
  const rand = random(salt);
  return Array.from({ length: counts[kind] }, (_, i) => {
    // Different species favour different pockets, with gaps between colonies.
    // Reserve colonies for the middle and far banks so planting continues
    // into the mist instead of thinning out behind the foreground.
    const cluster = Math.floor(i / (kind === 'fern' ? 3 : 14));
    const pocket = random(cluster * 97 + salt);
    const distant = cluster % 3 === 0;
    const z = distant
      ? -24 - pocket() * 84 + (rand() - .5) * 3
      : 23 - Math.pow(pocket(), 1.5) * 111 + (rand() - .5) * 3;
    const side = cluster % 2 ? 1 : -1;
    const inland = .7 + pocket() * (distant ? 8 : kind === 'fern' ? 3.5 : 4.5) + rand() * .7;
    const x = riverCenter(z, width) + side * (bankEdge(z, width) + inland);
    return { x, y: groundHeight(x, z, width) - .025, z, angle: rand() * Math.PI * 2,
      scale: .65 + rand() * .6, tint: .85 + rand() * .25 };
  });
}
