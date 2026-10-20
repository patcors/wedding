// A snowman in one mesh with vertex colours: three balls of snow, coal eyes
// and buttons, a carrot nose, a knitted scarf and two stick arms. With
// `sling`, its left arm is bent across its middle with a purple cast on its
// wrist, held in a sling hung from its neck. With `hold`, the arm on that
// side (+1 is +x) reaches out and down to hold the hand of another snowman
// standing HOLD.apart away, holding its own out to this one. `simple` builds
// it plainer, for two at once. It faces +z, standing on y 0, about 1.5 tall.
// About 1,250 triangles, 1,500 with the sling, 760 simple.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

type Point = [number, number, number];
export type SnowmanOptions = { sling?: boolean; scarf?: string; hold?: 1 | -1; simple?: boolean };
const SNOW = '#f3f5f7', SNOW_SHADE = '#cfd8e2', COAL = '#2b2725', CARROT = '#e07a2e', STICK = '#6b4a2f', CAST = '#8a52c4', SLING = '#d9e2ea';
// The three balls, bottom to top: radius and the height of the centre.
export const SNOWMAN = { balls: [[.42, .36], [.3, .9], [.21, 1.3]] as const, height: 1.52 };
// Two snowmen holding hands stand this far apart, middle to middle; their
// hands meet halfway, a little in front.
export const HOLD = { apart: 1, forward: .1 } as const;

export function snowmanGeometry({ sling = false, scarf = '#4d827f', hold, simple = false }: SnowmanOptions = {}) {
  const pieces: THREE.BufferGeometry[] = [];
  const c = new THREE.Color();
  const add = (geometry: THREE.BufferGeometry, colour: string | ((y: number) => THREE.Color)) => {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    if (g !== geometry) geometry.dispose();
    g.deleteAttribute('uv');
    const p = g.attributes.position, colours: number[] = [];
    for (let i = 0; i < p.count; i++) {
      (typeof colour === 'string' ? c.set(colour) : c.copy(colour(p.getY(i)))).toArray(colours, i * 3);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
    pieces.push(g);
  };
  // Segments round the balls of snow, the coal and the scarf, and the sticks' sides.
  const detail: { snow: [number, number]; coal: number; scarf: [number, number]; stick: number } = simple
    ? { snow: [11, 8], coal: 4, scarf: [5, 11], stick: 4 } : { snow: [14, 10], coal: 6, scarf: [6, 14], stick: 5 };
  const ball = (r: number, at: Point, colour: string, segments = detail.coal) =>
    add(new THREE.SphereGeometry(r, segments, Math.max(simple ? 3 : 4, segments - 2)).translate(...at), colour);
  // A rod from a to b, tapering, as for sticks and the carrot.
  const rod = (a: Point, b: Point, r0: number, r1: number, colour: string, sides = detail.stick) => {
    const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), length = from.distanceTo(to);
    const g = new THREE.CylinderGeometry(r1, r0, length, sides, 1).translate(0, length / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize()));
    add(g.translate(...a), colour);
  };

  // Snow, a little bluer underneath where the sky doesn't reach.
  const shade = new THREE.Color(SNOW_SHADE), snow = new THREE.Color(SNOW), tint = new THREE.Color();
  SNOWMAN.balls.forEach(([r, y], i) => {
    const g = new THREE.SphereGeometry(r, ...detail.snow);
    // Packed, not perfect: a little squat, the bottom flattened where it sits.
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const ly = p.getY(k);
      p.setXYZ(k, p.getX(k) * 1.04, Math.max(ly * .94, i === 0 ? -r * .78 : -r), p.getZ(k) * 1.04);
    }
    g.computeVertexNormals();
    add(g.translate(0, y, 0), ly => tint.copy(shade).lerp(snow, THREE.MathUtils.smoothstep(ly - y, -r * .7, r * .4)));
  });
  const [, [mr, my], [hr, hy]] = SNOWMAN.balls;
  // Coal eyes and a carrot nose, a little upturned.
  for (const side of [-1, 1]) ball(.026, [side * .075, hy + .06, hr * .9], COAL);
  rod([0, hy, hr * .92], [.01, hy + .03, hr + .24], .042, .006, CARROT, simple ? 5 : 7);
  // Three coal buttons down the middle ball.
  for (const [i, y] of [.16, .04, -.08].entries()) ball(.03 - i * .002, [0, my + y, mr * Math.cos(Math.asin(y / mr)) * .99 + .01], COAL);

  // A knitted scarf: a band round the neck and one tail hanging down the front.
  add(new THREE.TorusGeometry(.17, .055, ...detail.scarf).rotateX(Math.PI / 2).scale(1, .8, 1).translate(0, hy - hr * .82, 0), scarf);
  add(new THREE.BoxGeometry(.11, .3, .04).rotateZ(.12).translate(-.09, hy - hr * .82 - .15, mr * .62 + .08), scarf);

  // Stick arms from the middle ball, each with a twig or two at the end.
  const stick = (from: Point, to: Point, twigs: Point[]) => {
    rod(from, to, .022, .014, STICK);
    for (const twig of twigs) rod(to, twig, .012, .006, STICK, detail.stick - 1);
  };
  // Holding hands: out and a little down to meet a partner's halfway, its
  // twigs curled round the other's hand.
  const reach = (side: number) => {
    const hand: Point = [side * HOLD.apart / 2, my - .08, HOLD.forward];
    stick([side * mr * .9, my + .05, 0], hand, [[side * (HOLD.apart / 2 + .03), my - .15, HOLD.forward + .04], [side * (HOLD.apart / 2 - .04), my - .15, HOLD.forward - .03]]);
  };
  if (hold === 1) reach(1);
  else stick([mr * .9, my + .05, 0], [.78, my + .32, .02], [[.9, my + .42, .03], [.88, my + .26, -.02]]);
  if (hold === -1) reach(-1);
  else if (!sling) stick([-mr * .9, my + .05, 0], [-.78, my + .3, .02], [[-.9, my + .4, .03], [-.88, my + .22, .01]]);
  else {
    // Its left arm in a sling: upper arm down from the shoulder, forearm
    // bent across the front, in a purple cast at the wrist (purple so it
    // shows against the snow, Amelia, October 2026), the sling's cloth
    // cradling it and its strap round the neck.
    const elbow: Point = [-mr * 1.02, my - .1, mr * .55], wrist: Point = [mr * .05, my - .02, mr * 1.02];
    rod([-mr * .9, my + .05, 0], elbow, .022, .019, STICK);
    rod(elbow, wrist, .019, .015, STICK);
    rod([wrist[0] - .04, wrist[1], wrist[2]], [wrist[0] + .16, wrist[1] + .02, wrist[2] - .02], .058, .054, CAST, 8);
    for (const twig of [[.24, my + .06, mr * .96], [.22, my - .06, mr * .99]] as Point[]) rod([wrist[0] + .15, wrist[1] + .01, wrist[2] - .02], twig, .011, .006, STICK, 4);
    // The cloth: a shallow pocket under the forearm, from elbow to wrist.
    const cloth = new THREE.CylinderGeometry(.075, .075, .44, 10, 1, true, Math.PI * .5, Math.PI);
    cloth.rotateZ(Math.PI / 2).rotateY(-.42).translate(-mr * .48, my - .1, mr * .84);
    add(cloth, SLING);
    // The strap, up from each end of the cloth and round behind the neck.
    const strap = new THREE.CatmullRomCurve3([[-mr * .95, my - .08, mr * .62], [-.16, hy - hr * .7, .1], [0, hy - hr * .78, -.17],
      [.16, hy - hr * .7, .1], [mr * .1, my - .06, mr * 1.02]].map(p => new THREE.Vector3(...(p as Point))));
    add(new THREE.TubeGeometry(strap, 20, .03, 5, false), SLING);
  }

  const geometry = mergeGeometries(pieces);
  pieces.forEach(piece => piece.dispose());
  return geometry;
}

// Two simple snowmen holding hands, in one mesh: `left` on the −x side
// holding out its +x arm, `right` its −x, HOLD.apart between their middles.
export function holdingHandsGeometry(left: SnowmanOptions, right: SnowmanOptions) {
  const pair = [snowmanGeometry({ ...left, hold: 1, simple: true }).translate(-HOLD.apart / 2, 0, 0),
    snowmanGeometry({ ...right, hold: -1, simple: true }).translate(HOLD.apart / 2, 0, 0)];
  const geometry = mergeGeometries(pair);
  pair.forEach(piece => piece.dispose());
  return geometry;
}
