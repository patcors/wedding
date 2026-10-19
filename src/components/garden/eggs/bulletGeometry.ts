// The bullet garden ornament (see bulletOrnament.ts): a big cartridge standing
// on its head, as a sculpture would. A polished brass casing with a rim and a
// groove at its foot, a round-nosed copper tip, one smooth lathed mesh with
// vertex colours (`bulletGeometry`); and a low square stone plinth it stands
// on, its top edge bevelled (`bulletPlinthGeometry`). Built in its own units:
// 1 tall from the ground (y 0) to its tip, facing +z, its sheen a little to -x.
import * as THREE from 'three';

const BRASS = '#c9a34e', BRASS_LIGHT = '#fbecb4', BRASS_DARK = '#7a5c2c', COPPER = '#a9643f', COPPER_LIGHT = '#eab48e';
const STONE = '#bdb5a4', STONE_DARK = '#8f8878';
// The plinth's half width and its top; the casing's radius.
export const BULLET_MODEL = { plinth: .14, top: .085, radius: .096 } as const;
const SEGMENTS = 24;
const { top, radius } = BULLET_MODEL;
// The tip's round nose: half an ellipse from NOSE up to the point, as wide as the tip.
const NOSE = .68, TIP = radius - .012;
const nose = Array.from({ length: 9 }, (_, i) => {
  const angle = (i + 1) / 10 * Math.PI / 2;
  return [TIP * Math.cos(angle), NOSE + (1 - NOSE) * Math.sin(angle), true] as [number, number, boolean];
});
// The bullet's profile, foot to tip, as [radius, height, copper]: the rim at
// its head, the groove above it, the casing tapering a touch to its mouth,
// a small step in to the tip, and the tip's round nose.
const PROFILE: [number, number, boolean][] = [
  [0, top, false], [radius - .008, top, false], [radius, top + .008, false], [radius, top + .036, false], [radius - .008, top + .044, false],
  [radius - .018, top + .05, false], [radius - .018, top + .068, false], [radius - .004, top + .084, false], [radius - .002, top + .1, false],
  [radius - .004, .6, false], [radius - .005, .612, false], [TIP, .615, true], [TIP, NOSE, true], ...nose, [0, 1, true],
];
// The groove's floor is darker, its shadow.
const inGroove = (y: number) => y > top + .046 && y < top + .072;

export function bulletGeometry() {
  const geometry = new THREE.LatheGeometry(PROFILE.map(([r, y]) => new THREE.Vector2(r, y)), SEGMENTS);
  geometry.deleteAttribute('uv');
  // Polished: a bright vertical sheen a little left of its face, where the
  // afternoon sun catches it from the river's left as it stands there, and
  // the metal darker as it turns away towards its edges, so it reads as
  // round and bright (the garden has no reflections to show).
  const p = geometry.attributes.position, n = geometry.attributes.normal, colours: number[] = [];
  const c = new THREE.Color(), base = new THREE.Color(), light = new THREE.Color(), dark = new THREE.Color(BRASS_DARK);
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), copper = PROFILE.find(([, py]) => Math.abs(py - y) < 1e-6)?.[2] ?? y > .613;
    base.set(copper ? COPPER : BRASS);
    light.set(copper ? COPPER_LIGHT : BRASS_LIGHT);
    const around = Math.atan2(n.getX(i), n.getZ(i)), side = Math.hypot(n.getX(i), n.getZ(i));
    const sheen = Math.exp(-(((around + .4) / .2) ** 2)) * side, glow = Math.exp(-((around / .9) ** 2)) * side;
    const turned = THREE.MathUtils.smoothstep(Math.abs(around), 1, 2.4);
    c.copy(base).lerp(light, Math.min(1, .25 * glow + sheen)).lerp(dark, .55 * turned);
    if (inGroove(y)) c.lerp(dark, .6);
    colours.push(c.r, c.g, c.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  return geometry;
}

// A low square stone block, sunk a little into the lawn, its top edge
// bevelled: a lathe of four sides, turned square to its face.
export function bulletPlinthGeometry() {
  const corner = BULLET_MODEL.plinth * Math.SQRT2, bevel = .014 * Math.SQRT2;
  const geometry = new THREE.LatheGeometry([[0, -.08], [corner, -.08], [corner, top - .014], [corner - bevel, top], [0, top]]
    .map(([r, y]) => new THREE.Vector2(r, y)), 4, Math.PI / 4).toNonIndexed();
  geometry.deleteAttribute('uv');
  geometry.computeVertexNormals();
  const p = geometry.attributes.position, c = new THREE.Color(), stone = new THREE.Color(STONE), dark = new THREE.Color(STONE_DARK), colours: number[] = [];
  for (let i = 0; i < p.count; i++) {
    c.copy(dark).lerp(stone, THREE.MathUtils.clamp((p.getY(i) + .02) / (top + .02), 0, 1));
    colours.push(c.r, c.g, c.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  return geometry;
}
