// The year markers' models and their lettering (see yearMarkerSpots.ts). Each is a
// body in vertex colours and a face carrying its year, cut from one shared
// atlas, so a marker is two draw calls (the lantern's paper is a third, as it
// sways). Built in its own units: its face looks down +z, the river lies
// towards +x on the left bank and −x on the right, and y 0 is where it stands.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { random } from '../gardenGeometry.ts';
import { YEAR_MARKERS, type YearMarker } from './yearMarkerSpots.ts';

// The atlas: a square cell per year, in YEAR_MARKERS' order.
const CELL = 256, COLS = 4, ROWS = Math.ceil(YEAR_MARKERS.length / COLS);
type Lettering = { kind: 'paint' | 'carve' | 'chalk' | 'scratch' | 'ink' | 'brush' | 'burn'; colour: string; italic?: boolean; weight?: number };
// How each year is written, and the face's proportions (width over height;
// `lines` 2 stacks the year, for a narrow upright face).
type Face = { width: number; height: number; lines?: 1 | 2; lettering: Lettering };

type Colour = string | ((x: number, y: number, z: number) => string);
type At = { position?: [number, number, number]; rotation?: [number, number, number]; scale?: [number, number, number] | number };
const matrixFor = ({ position = [0, 0, 0], rotation = [0, 0, 0], scale = 1 }: At) => new THREE.Matrix4().compose(
  new THREE.Vector3(...position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
  typeof scale === 'number' ? new THREE.Vector3(scale, scale, scale) : new THREE.Vector3(...scale));

// Places a primitive and paints it, a shade lighter or darker face by face so
// it looks weathered rather than new.
function part(source: THREE.BufferGeometry, colour: Colour, at: At = {}, jitter = .06, seed = 1): THREE.BufferGeometry {
  const geometry = source.index ? source.toNonIndexed() : source;
  if (geometry !== source) source.dispose();
  for (const name of Object.keys(geometry.attributes)) if (name !== 'position' && name !== 'normal') geometry.deleteAttribute(name);
  geometry.applyMatrix4(matrixFor(at));
  const position = geometry.attributes.position, rand = random(seed), c = new THREE.Color(), values = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i += 3) {
    const x = (position.getX(i) + position.getX(i + 1) + position.getX(i + 2)) / 3;
    const y = (position.getY(i) + position.getY(i + 1) + position.getY(i + 2)) / 3;
    const z = (position.getZ(i) + position.getZ(i + 1) + position.getZ(i + 2)) / 3;
    c.set(typeof colour === 'string' ? colour : colour(x, y, z)).multiplyScalar(1 + (rand() - .5) * 2 * jitter);
    for (let k = 0; k < 3; k++) c.toArray(values, (i + k) * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(values, 3));
  return geometry;
}
const merged = (parts: THREE.BufferGeometry[]) => {
  const geometry = mergeGeometries(parts)!;
  parts.forEach(p => p.dispose());
  return geometry;
};
const box = (w: number, h: number, d: number, segments: [number, number, number] = [1, 1, 1]) => new THREE.BoxGeometry(w, h, d, ...segments);
const cylinder = (top: number, bottom: number, h: number, radial = 10, rows = 1) => new THREE.CylinderGeometry(top, bottom, h, radial, rows);
const blob = (r: number, detail = 0) => new THREE.IcosahedronGeometry(r, detail);

// The part of a year's cell its lettering fills, for a face of that shape.
function cellRect(index: number, aspect: number) {
  const col = index % COLS, row = Math.floor(index / COLS);
  const w = aspect >= 1 ? 1 : aspect, h = aspect >= 1 ? 1 / aspect : 1;
  return { u: (col + (1 - w) / 2) / COLS, v: 1 - (row + (1 + h) / 2) / ROWS, w: w / COLS, h: h / ROWS };
}
// Maps a face's own 0–1 UVs onto its year's cell.
function toCell(geometry: THREE.BufferGeometry, index: number, aspect: number) {
  const { u, v, w, h } = cellRect(index, aspect), uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u + uv.getX(i) * w, v + uv.getY(i) * h);
  for (const name of Object.keys(geometry.attributes)) if (!['position', 'normal', 'uv'].includes(name)) geometry.deleteAttribute(name);
  return geometry;
}
const flatFace = (index: number, face: Face, at: At) =>
  toCell(new THREE.PlaneGeometry(face.width, face.height).applyMatrix4(matrixFor(at)), index, face.width / face.height);
// A face wrapped round a cylinder, centred on +z.
const bandFace = (index: number, face: Face, radius: number, at: At) => {
  const arc = face.width / radius;
  const geometry = new THREE.CylinderGeometry(radius, radius, face.height, 24, 1, true, -arc / 2, arc);
  return toCell(geometry.applyMatrix4(matrixFor(at)), index, face.width / face.height);
};

// The year's lettering, in Cormorant like the Garden's date, weathered by hand.
function letter(ctx: CanvasRenderingContext2D, index: number, text: string, face: Face) {
  const rand = random(index * 97 + 13), { kind, colour, italic, weight = 500 } = face.lettering;
  const col = index % COLS, row = Math.floor(index / COLS), aspect = face.width / face.height;
  const rw = CELL * (aspect >= 1 ? 1 : aspect), rh = CELL * (aspect >= 1 ? 1 / aspect : 1);
  const lines = face.lines === 2 ? [text.slice(0, 2), text.slice(2)] : [text];
  ctx.save();
  ctx.beginPath(); ctx.rect(col * CELL, row * CELL, CELL, CELL); ctx.clip();
  ctx.translate(col * CELL + CELL / 2, row * CELL + CELL / 2);
  ctx.rotate((rand() - .5) * .06);
  const family = `"Cormorant Garamond", Georgia, serif`;
  const font = (size: number) => `${italic ? 'italic ' : ''}${weight} ${size}px ${family}`;
  ctx.font = font(100);
  const metrics = lines.map(line => ctx.measureText(line));
  const wide = Math.max(...metrics.map(m => m.width)), tall = Math.max(...metrics.map(m => m.actualBoundingBoxAscent + m.actualBoundingBoxDescent)) || 64;
  const gap = .22;
  const size = 100 * Math.min(rw * .84 / wide, rh * .7 / (tall * (lines.length + gap * (lines.length - 1))));
  ctx.font = font(size);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const lineHeight = tall * size / 100, total = lineHeight * (lines.length + gap * (lines.length - 1));
  const ys = lines.map((_, i) => -total / 2 + lineHeight * (i + 1) + i * gap * lineHeight);
  const draw = (fill: string, alpha: number, dx = 0, dy = 0, stroke = 0) => {
    ctx.globalAlpha = alpha;
    lines.forEach((line, i) => {
      if (stroke) { ctx.strokeStyle = fill; ctx.lineWidth = stroke; ctx.strokeText(line, dx, ys[i] + dy); }
      else { ctx.fillStyle = fill; ctx.fillText(line, dx, ys[i] + dy); }
    });
  };
  if (kind === 'paint') { draw(colour, .9); draw(colour, .3, .9, -.7); }
  else if (kind === 'carve') { draw('#f3eee2', .55, 2.4, 2.4); draw('#3a362f', .8); draw('#77716a', .75, 1.3, 1.3); }
  else if (kind === 'chalk') { draw(colour, .82); draw(colour, .35, 0, 0, 2); }
  else if (kind === 'scratch') { draw(colour, .45); draw(colour, .9, 0, 0, 3.5); draw(colour, .55, 1.6, -.9, 1.4); draw(colour, .5, -1.4, 1.1, 1.4); }
  else {
    ctx.shadowColor = kind === 'burn' ? '#8a5a2c' : colour;
    ctx.shadowBlur = kind === 'burn' ? 7 : kind === 'brush' ? 3 : 1.4;
    draw(colour, kind === 'brush' ? .85 : .9);
    ctx.shadowBlur = 0;
  }
  // Weathering: flecks worn away, more for chalk; grain streaks through paint.
  ctx.globalCompositeOperation = 'destination-out';
  const flecks = kind === 'chalk' ? 1400 : kind === 'scratch' ? 120 : 320;
  for (let i = 0; i < flecks; i++) {
    ctx.globalAlpha = .25 + rand() * .6;
    ctx.beginPath();
    ctx.arc((rand() - .5) * rw, (rand() - .5) * rh, kind === 'chalk' ? .5 + rand() * 1.1 : .6 + rand() * 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  if (kind === 'paint' || kind === 'burn') for (let i = 0; i < 14; i++) {
    ctx.globalAlpha = .2 + rand() * .3; ctx.lineWidth = .6 + rand() * 1.4;
    const y = (rand() - .5) * rh, x = (rand() - .5) * rw;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 20 + rand() * 60, y + (rand() - .5) * 2); ctx.stroke();
  }
  ctx.restore();
}

// A rough weathered board's colour, darker towards its foot.
const BARK = '#6b604f', WEATHERED = '#8e7d65', IRON = '#3f3d39';

type Model = { body: THREE.BufferGeometry; face?: THREE.BufferGeometry;
  // The lantern's paper and lettering swing from `pivot`.
  hanging?: { body: THREE.BufferGeometry; face: THREE.BufferGeometry; pivot: [number, number, number] } };
type Build = (index: number, face: Face, river: number, seed: number) => Model;

const MODELS: Record<YearMarker['medium'], { face: Face; build: Build }> = {
  // 2017: an arrow-board nailed to an old snag on the bank, painted cream.
  signpost: {
    face: { width: .84, height: .36, lettering: { kind: 'paint', colour: '#f1e8d2' } },
    build: (index, face, river, seed) => {
      const rand = random(seed);
      const trunk = cylinder(.15, .23, 1.75, 10, 5);
      const p = trunk.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i), wobble = 1 + Math.sin(y * 7 + Math.atan2(p.getZ(i), p.getX(i)) * 3) * .06;
        p.setXYZ(i, p.getX(i) * wobble, y > .8 ? y - rand() * .22 : y, p.getZ(i) * wobble);
      }
      const arrow = new THREE.Shape();
      // Pointing on towards the river.
      [[-.48, -.19], [.4, -.19], [.55, 0], [.4, .19], [-.48, .19]].forEach(([x, y], i) => i ? arrow.lineTo(x * river, y) : arrow.moveTo(x * river, y));
      arrow.closePath();
      const board = new THREE.ExtrudeGeometry(arrow, { depth: .045, bevelEnabled: false });
      const tilt = -.05 * river;
      return {
        body: merged([
          part(trunk, (_, y) => y > 1.55 ? '#857862' : BARK, { position: [0, .82, 0] }, .1, seed),
          ...[0, 2.1, 4.2].map((a, i) => part(new THREE.ConeGeometry(.1, .45, 5), BARK, { position: [Math.cos(a) * .2, .1, Math.sin(a) * .2], rotation: [Math.sin(a) * .9, 0, -Math.cos(a) * .9] }, .1, seed + i)),
          part(board, WEATHERED, { position: [0, 1.12, .17], rotation: [0, 0, tilt] }, .08, seed + 5),
          ...[-.38, .3].map(x => part(blob(.018), IRON, { position: [x * river, 1.12 + x * tilt * river, .22] })),
        ]),
        face: flatFace(index, face, { position: [-.04 * river, 1.12, .218], rotation: [0, 0, tilt] }),
      };
    },
  },
  // 2018: carved into a pale boulder at the water's edge.
  rock: {
    face: { width: .92, height: .42, lettering: { kind: 'carve', colour: '#3a362f' } },
    build: (index, face, _river, seed) => {
      const rock = blob(.6, 3), p = rock.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const v = new THREE.Vector3().fromBufferAttribute(p, i), n = v.clone().normalize();
        v.multiplyScalar(1 + Math.sin(n.x * 4 + seed) * .07 + Math.sin(n.y * 5 + n.z * 3) * .06).multiply(new THREE.Vector3(1.3, .82, .95));
        // A face worn flat towards the river, and a base sunk into the bank.
        p.setXYZ(i, v.x, Math.max(v.y, -.3), Math.min(v.z, .4));
      }
      // Smooth, worn by the water, but for the flat face.
      const worn = mergeVertices(rock);
      rock.dispose();
      worn.computeVertexNormals();
      return {
        body: part(worn, (x, y) => Math.sin(x * 9 + y * 5) > .7 ? '#97a084' : y < -.1 ? '#8c877b' : '#aca699', { position: [0, .24, 0] }, .08, seed),
        face: flatFace(index, face, { position: [0, .27, .405] }),
      };
    },
  },
  // 2019: painted on a bobbing buoy, terracotta with a cream band.
  buoy: {
    face: { width: .8, height: .36, lettering: { kind: 'paint', colour: '#353a3b' } },
    build: (index, face, _river, seed) => {
      const R = .34, TERRACOTTA = '#a35a4b';
      return {
        body: merged([
          part(new THREE.SphereGeometry(R, 16, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), TERRACOTTA, { position: [0, .02, 0] }, .05, seed),
          part(cylinder(R, R, .1, 16), '#7a4a3f', { position: [0, .07, 0] }, .04, seed + 1),
          part(cylinder(R, R, .42, 16), '#e6dcc6', { position: [0, .33, 0] }, .04, seed + 2),
          part(cylinder(.07, R, .3, 16), TERRACOTTA, { position: [0, .69, 0] }, .05, seed + 3),
          part(new THREE.TorusGeometry(.07, .016, 5, 12), IRON, { position: [0, .9, 0] }),
        ]),
        face: bandFace(index, face, R + .004, { position: [0, .33, 0] }),
      };
    },
  },
  // 2020: painted across a little boathouse's double doors.
  shed: {
    face: { width: .92, height: .4, lettering: { kind: 'paint', colour: '#f2ead7' } },
    build: (index, face, _river, seed) => {
      const W = 1.5, H = 1.05, D = 1.2;
      const roof = new THREE.CylinderGeometry(.92, .92, D + .2, 3, 1).rotateX(-Math.PI / 2).rotateZ(0);
      return {
        body: merged([
          // Weatherboards: bands of light and shade up the walls.
          part(box(W, H, D, [1, 10, 1]), (_, y) => Math.floor(y * 9.5 + 20) % 2 ? '#8a7860' : '#7d6c56', { position: [0, H / 2, -D / 2] }, .05, seed),
          part(roof, '#5f644f', { position: [0, H + .21, -D / 2], scale: [1, .5, 1] }, .08, seed + 1),
          part(box(1.12, .86, .05), '#6d8582', { position: [0, .43, .02] }, .06, seed + 2),
          part(box(.03, .86, .06), '#56696a', { position: [0, .43, .025] }),
          part(box(1.2, .07, .07), '#5d5246', { position: [0, .9, .03] }),
          ...[-.05, .05].map(x => part(blob(.018), IRON, { position: [x, .4, .055] })),
        ]),
        face: flatFace(index, face, { position: [0, .55, .052] }),
      };
    },
  },
  // 2021: a garden marker stake among flowers, the year in ink.
  stake: {
    face: { width: .66, height: .3, lettering: { kind: 'ink', colour: '#2f3a33', italic: true, weight: 500 } },
    build: (index, face, _river, seed) => {
      const rand = random(seed), parts = [
        part(box(.05, .8, .035), '#a08a6c', { position: [0, .4, 0] }, .05, seed),
        part(box(.72, .34, .03), '#e8e2d2', { position: [0, .64, .025], rotation: [0, 0, .04] }, .03, seed + 1),
      ];
      const PETALS = ['#d8a2ad', '#efe6d1', '#b9a9d2', '#e6d48e', '#e2b3a3'];
      for (let i = 0; i < 18; i++) {
        const a = rand() * Math.PI * 2, r = .2 + rand() * .45, x = Math.cos(a) * r * 1.3, z = Math.sin(a) * r - .12;
        // Keep the stake's board clear: low in front, taller behind.
        const h = z > 0 ? .12 + rand() * .15 : .25 + rand() * .3;
        parts.push(part(cylinder(.008, .01, h, 4), '#6d7f55', { position: [x, h / 2, z] }, .1, seed + 10 + i));
        parts.push(part(blob(.05 + rand() * .025), PETALS[i % PETALS.length], { position: [x, h, z], scale: [1, .7, 1] }, .08, seed + 40 + i));
      }
      for (let i = 0; i < 7; i++) {
        const a = i * .9 + rand(), r = .25 + rand() * .3;
        parts.push(part(blob(.13 + rand() * .06), '#73875a', { position: [Math.cos(a) * r * 1.2, .05, Math.sin(a) * r - .1], scale: [1, .55, 1] }, .12, seed + 80 + i));
      }
      return { body: merged(parts), face: flatFace(index, face, { position: [0, .64, .042], rotation: [0, 0, .04] }) };
    },
  },
  // 2022: scratched into an old timber pile in the river, beside a shorter one.
  pile: {
    face: { width: .38, height: .48, lines: 2, lettering: { kind: 'scratch', colour: '#e4dcc8' } },
    build: (index, face, river, seed) => {
      const wet = (_: number, y: number) => y < .12 ? '#47503f' : y > 1.3 ? '#6f6656' : '#5b5346';
      return {
        body: merged([
          part(cylinder(.19, .21, 1.9, 12, 6), wet, { position: [0, .55, 0] }, .1, seed),
          part(cylinder(.15, .17, 1.3, 10, 4), wet, { position: [-.42 * river, .25, -.25], rotation: [.06, 0, .1 * river] }, .1, seed + 1),
          part(new THREE.TorusGeometry(.215, .025, 5, 14), '#b8a57f', { position: [0, 1.05, 0], rotation: [Math.PI / 2 + .15, 0, 0] }, .06, seed + 2),
        ]),
        face: bandFace(index, face, .207, { position: [0, .62, 0] }),
      };
    },
  },
  // 2023: chalked on a slate A-board standing on a little landing.
  slate: {
    face: { width: .76, height: .4, lettering: { kind: 'chalk', colour: '#f4f2ea' } },
    build: (index, face, river, seed) => {
      const parts: THREE.BufferGeometry[] = [];
      // Planks run out from the bank towards the river.
      for (let i = 0; i < 5; i++) parts.push(part(box(1.7, .05, .2), ['#a68b67', '#9a7f5d', '#ae9470'][i % 3], { position: [.45 * river, .3, .5 - i * .22] }, .06, seed + i));
      for (const [x, z] of [[.1, .55], [.1, -.4], [1.2, .55], [1.2, -.4]]) parts.push(part(cylinder(.05, .05, .75, 6), '#5d5446', { position: [x * river, 0, z] }, .08, seed + 9));
      // The board leans back on its legs, slate in a wooden frame.
      const lean = -.14, centre: [number, number, number] = [.8 * river, .76, .2];
      parts.push(part(box(.9, .86, .04), '#8b7556', { position: centre, rotation: [lean, 0, 0] }, .05, seed + 20));
      parts.push(part(box(.8, .74, .02), '#3b423f', { position: [centre[0], centre[1], centre[2] + .025], rotation: [lean, 0, 0] }, .04, seed + 21));
      parts.push(part(box(.86, .82, .04), '#8b7556', { position: [centre[0], .74, -.05], rotation: [-lean, 0, 0] }, .05, seed + 22));
      return { body: merged(parts), face: flatFace(index, face, { position: [centre[0], centre[1] + .05, centre[2] + .041], rotation: [lean, 0, 0] }) };
    },
  },
  // 2024: brushed in ink on a paper lantern hung from a crook over the water.
  lantern: {
    face: { width: .46, height: .44, lines: 2, lettering: { kind: 'brush', colour: '#3a2f2a', italic: true, weight: 400 } },
    build: (index, face, river, seed) => {
      // A post with an arm out over the water, braced, the lantern hung from its end.
      const reach = .75, top = 2.05, IRONWOOD = '#4a4238';
      return {
        body: merged([
          part(cylinder(.035, .045, top, 6), IRONWOOD, { position: [0, top / 2, 0] }, .06, seed),
          part(cylinder(.025, .025, reach, 5), IRONWOOD, { position: [river * reach / 2, top, 0], rotation: [0, 0, Math.PI / 2] }),
          part(cylinder(.018, .018, .42, 4), IRONWOOD, { position: [river * .15, top - .15, 0], rotation: [0, 0, -river * Math.PI / 4] }),
          part(blob(.04), IRONWOOD, { position: [river * reach, top, 0] }),
          part(blob(.05), IRONWOOD, { position: [0, top + .03, 0] }),
        ]),
        hanging: {
          pivot: [river * (reach - .08), top, 0],
          body: merged([
            part(cylinder(.004, .004, .3, 3), '#2f2b26', { position: [0, -.15, 0] }),
            part(cylinder(.17, .17, .05, 12), '#3f3a34', { position: [0, -.32, 0] }),
            part(cylinder(.27, .27, .44, 16, 4), '#ece0c3', { position: [0, -.57, 0] }, .03, seed + 1),
            part(cylinder(.17, .17, .05, 12), '#3f3a34', { position: [0, -.81, 0] }),
          ]),
          face: bandFace(index, face, .274, { position: [0, -.57, 0] }),
        },
      };
    },
  },
  // 2025: whitewashed on the riser of old stone steps down to the water.
  steps: {
    face: { width: 1.04, height: .3, lettering: { kind: 'paint', colour: '#f6f2e8' } },
    build: (index, face, river, seed) => {
      // Three steps cut into the bank, worn treads over darker risers, between
      // low stone cheeks, the lowest at the water.
      const RISE = .32, RUN = .42, WIDTH = 1.24, SINK = .1, parts: THREE.BufferGeometry[] = [];
      for (let i = 0; i < 3; i++) {
        const top = (i + 1) * RISE - SINK, z = -i * RUN;
        const w = WIDTH - i * .06, skew = (i - 1) * .04;
        parts.push(part(box(w, top + SINK, RUN), '#8b8477', { position: [skew, (top - SINK) / 2, z], rotation: [0, skew, 0] }, .1, seed + i));
        // Worn, mossy treads.
        parts.push(part(box(w + .04, .05, RUN + .05), (x) => Math.sin(x * 7 + i) > .55 ? '#9ba184' : '#b2ab9c', { position: [skew, top, z + .02], rotation: [0, skew, 0] }, .08, seed + 10 + i));
        // Rough stones either side.
        for (const x of [-1, 1]) parts.push(part(blob(.2, 1), '#7c766b', { position: [skew + x * (w / 2 + .12), top - .12, z], scale: [.8, (top + SINK) * 2.2, 1.1] }, .14, seed + 20 + i * 2 + x));
      }
      parts.push(part(blob(.22, 1), '#8a8478', { position: [.95 * river, .08, .15], scale: [1, .55, 1] }, .12, seed + 6));
      return { body: merged(parts), face: flatFace(index, face, { position: [0, RISE * 1.5 - SINK, -RUN / 2 + .003] }) };
    },
  },
  // 2026: pokerwork on a pale board hung under a garden arch twined with flowers.
  arch: {
    face: { width: .86, height: .32, lettering: { kind: 'burn', colour: '#4a3526' } },
    build: (index, face, _river, seed) => {
      const rand = random(seed), WOOD = '#86704f', parts = [
        ...[-.66, .66].map(x => part(box(.09, 1.85, .09), WOOD, { position: [x, .92, 0] }, .06, seed)),
        part(new THREE.TorusGeometry(.66, .045, 6, 18, Math.PI), WOOD, { position: [0, 1.84, 0] }, .06, seed + 1),
        ...[-.36, .36].map(x => part(cylinder(.006, .006, .22, 3), '#3a342c', { position: [x, 2.22, 0] })),
        part(box(.94, .36, .035), '#d6c4a0', { position: [0, 1.95, 0] }, .04, seed + 2),
      ];
      // Leaves and white and blush flowers twined up the posts and over the arch.
      for (let i = 0; i < 34; i++) {
        const t = rand(), side = i % 2 ? 1 : -1;
        const [x, y] = t < .55 ? [side * .66, .2 + t / .55 * 1.62] : [Math.cos((t - .55) / .45 * Math.PI) * .66 * side, 1.84 + Math.sin((t - .55) / .45 * Math.PI) * .66];
        const flower = i % 3 === 0;
        parts.push(part(blob(flower ? .045 : .075), flower ? (i % 2 ? '#f1ebdc' : '#e4bcb8') : '#6f8456', { position: [x + (rand() - .5) * .1, y, (rand() - .3) * .12], scale: [1, .8, .7] }, .1, seed + 10 + i));
      }
      return { body: merged(parts), face: flatFace(index, face, { position: [0, 1.95, .019] }) };
    },
  },
};

// One canvas holding every year's lettering. Drawn again once Cormorant has
// loaded, so the numerals are never left in the fallback serif.
export function yearAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = CELL * COLS; canvas.height = CELL * ROWS;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const draw = () => {
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    YEAR_MARKERS.forEach((marker, i) => letter(ctx, i, String(marker.year), MODELS[marker.medium].face));
    texture.needsUpdate = true;
  };
  draw();
  document.fonts?.load('500 100px "Cormorant Garamond"').then(draw, () => {});
  return texture;
}

export function yearMarkerModel(marker: YearMarker, index: number): Model {
  const { face, build } = MODELS[marker.medium];
  return build(index, face, -marker.side, marker.year);
}
