// PROTOTYPE: deterministic botanical geometry for the /garden visual study.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export function random(seed: number) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export const GARDEN_CAMERA = { fov: 48, mobileFov: 68, height: 3.2, startZ: 18, targetY: 2.5, targetZ: -28, travel: 28.5 };
// Portrait uses the same irregular shoreline as desktop, at a smaller scale.
export const MOBILE_RIVER_WIDTH = .45;

export function riverCenter(z: number, width = 1) {
  return (Math.sin(z * .12 + .7) * 1.15 + Math.sin(z * .26 - 1.2) * .25) * width;
}

export function bankEdge(z: number, width = 1) {
  return (5.5 + Math.sin(z * .17) * 1.15 + Math.sin(z * .48) * .38) * width;
}

export function groundHeight(x: number, z: number, width = 1) {
  const inland = Math.abs(x - riverCenter(z, width)) - bankEdge(z, width);
  return -.12 + Math.min(1, Math.max(0, inland / 2.4)) * .85
    + Math.sin(x * 1.1 + z * .31) * .10 + Math.sin(z * 1.7 + x * 2.4) * .045;
}

export function bankGeometry(side: number, width = 1) {
  const geometry = new THREE.PlaneGeometry(54, 140, 90, 180);
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  const colors = [];
  const color = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    const z = position.getY(i) - 44;
    const inland = position.getX(i) + 27;
    const x = riverCenter(z, width) + (bankEdge(z, width) + inland) * side;
    const y = groundHeight(x, z, width);
    position.setXYZ(i, x, y, z);
    uv.setXY(i, x / 16, z / 16);
    color.set(inland < .6 ? '#797866' : '#e3dfc8');
    colors.push(color.r, color.g, color.b);
  }
  // PlaneGeometry faces +Z; mapping to X/Y/Z here needs the opposite winding on +X.
  if (side === 1) {
    const index = geometry.index!;
    for (let i = 0; i < index.count; i += 3) {
      const a = index.getX(i); index.setX(i, index.getX(i + 2)); index.setX(i + 2, a);
    }
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function leafGeometry(petal = false) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(-.40, .28, -.40, .68, 0, 1);
  shape.bezierCurveTo(.40, .68, .40, .28, 0, 0);
  const geometry = new THREE.ShapeGeometry(shape, 5);
  const p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    p.setZ(i, Math.sin(y * Math.PI) * (petal ? .23 : .12) + x * x * .5);
  }
  geometry.computeVertexNormals();
  return geometry;
}

export type LeafPlacement = { position: THREE.Vector3; scale: number };

export function treeGeometry(seed: number, distant = false) {
  const rand = random(seed);
  const branches: THREE.BufferGeometry[] = [];
  const leaves: LeafPlacement[] = [];
  function grow(start: THREE.Vector3, direction: THREE.Vector3, length: number, radius: number, depth: number) {
    const end = start.clone().addScaledVector(direction, length);
    const middle = start.clone().lerp(end, .5).add(new THREE.Vector3((rand() - .5) * length * .14, .12, (rand() - .5) * length * .14));
    const curve = new THREE.CatmullRomCurve3([start, middle, end]);
    const radial = distant ? 5 : depth < 2 ? 14 : 7;
    const segments = distant ? 4 : depth === 0 ? 16 : 8;
    const tube = new THREE.TubeGeometry(curve, segments, radius, radial, false);
    const positions = tube.attributes.position;
    for (let i = 0; i <= segments; i++) {
      const center = curve.getPointAt(i / segments);
      for (let j = 0; j <= radial; j++) {
        const index = i * (radial + 1) + j;
        const v = new THREE.Vector3().fromBufferAttribute(positions, index);
        v.sub(center).multiplyScalar(1 - i / segments * .96).add(center);
        positions.setXYZ(index, v.x, v.y, v.z);
      }
    }
    tube.deleteAttribute('normal');
    const smoothTube = mergeVertices(tube);
    smoothTube.computeVertexNormals();
    branches.push(smoothTube);
    tube.dispose();
    if (depth >= (distant ? 2 : 3)) {
      for (let i = 0; i < (distant ? 7 : 10); i++) {
        const t = .25 + rand() * .9;
        const position = start.clone().lerp(end, t);
        position.add(new THREE.Vector3((rand() - .5) * 1.15, (rand() - .5) * .8, (rand() - .5) * 1.15));
        leaves.push({ position, scale: (distant ? .45 : .27) + rand() * .27 });
      }
    }
    if (depth >= (distant ? 3 : 4)) return;
    const count = depth === 0 ? 7 : depth === 1 ? 4 : 3;
    for (let i = 0; i < count; i++) {
      const t = depth === 0 ? .45 + i / count * .55 : .50 + rand() * .50;
      const origin = curve.getPoint(t);
      const angle = i * 2.399 + rand() * 1.4 + depth;
      const next = new THREE.Vector3(Math.cos(angle) * .8, .5 + rand() * .7, Math.sin(angle) * .8);
      if (depth > 0) next.addScaledVector(direction, .55);
      next.normalize();
      grow(origin, next, length * (depth === 0 ? .66 : .57) * (.85 + rand() * .3), radius * (depth === 0 ? .40 : .46), depth + 1);
    }
  }
  grow(new THREE.Vector3(), new THREE.Vector3(.06, 1, -.03).normalize(), 6.6, .32, 0);
  // Visible spreading roots marry the trunk to the bank.
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, .4, 0), new THREE.Vector3(Math.cos(a) * .6, .05, Math.sin(a) * .6),
      new THREE.Vector3(Math.cos(a) * 1.1, -.1, Math.sin(a) * 1.1),
    ]);
    branches.push(new THREE.TubeGeometry(curve, 5, .07, 5, false));
  }
  const trunk = mergeGeometries(branches);
  branches.forEach(g => g.dispose());
  return { trunk, leaves };
}

export function barkTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#aea895'; ctx.fillRect(0, 0, 128, 512);
  const rand = random(829);
  for (let i = 0; i < 1600; i++) {
    ctx.strokeStyle = `rgba(${rand() > .45 ? '70,66,52' : '228,219,193'},${.07 + rand() * .25})`;
    ctx.lineWidth = .3 + rand() * 2;
    const x = rand() * 128, y = rand() * 512;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (rand() - .5) * 4, y + rand() * 80); ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 3);
  return texture;
}
