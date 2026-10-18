// The engagement's two little figures (see proposal.ts) as one skinned mesh:
// stylised toys in the boats' paper style, no faces. Patrick in a soft
// yellow jacket over white trousers, as his boat is yellow over white;
// Amelia in a teal dress. Each part is a few flat-shaded facets bound
// rigidly to one bone, and the ring to his right hand, so the whole scene is
// one draw call of about a thousand triangles.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BONES, FIGURE, boneOffset, boneParent, type Bone, type Who } from './proposal.ts';

const SKIN = '#efcfb4';
export const FIGURE_LOOK = {
  patrick: { top: '#e0c87f', legs: '#f4efe3', shoes: '#6b5040', hair: '#5a4232' },
  amelia: { top: '#7fa69c', legs: SKIN, shoes: '#5f8a81', hair: '#4a3329' },
  ring: { band: '#e9c46a', stone: '#ffffff' },
} as const;

type Part = { bone: Bone; geometry: THREE.BufferGeometry; tint: string };
const cylinder = (top: number, bottom: number, from: number, to: number, sides = 6, depth = 1) =>
  new THREE.CylinderGeometry(top, bottom, Math.abs(to - from), sides).scale(1, 1, depth).translate(0, (from + to) / 2, 0);
const ball = (r: number, [x, y, z]: [number, number, number], w = 8, h = 6) => new THREE.SphereGeometry(r, w, h).translate(x, y, z);

// Each figure's parts, in its bones' frames.
function figureParts(who: Who): Part[] {
  const f = FIGURE[who], look = FIGURE_LOOK[who], her = who === 'amelia';
  const parts: Part[] = [];
  const add = (bone: Bone, geometry: THREE.BufferGeometry, tint: string) => parts.push({ bone, geometry, tint });
  if (her) {
    // A dress flaring from the waist to below the knee, over a fitted bodice.
    add('hips', cylinder(f.limb * 2.3, f.limb * 4.8, .03, -f.thigh * .82, 10), look.top);
    add('spine', cylinder(f.limb * 2.5, f.limb * 2, f.torso, 0, 8, .8), look.top);
  } else {
    add('hips', new THREE.BoxGeometry(f.hip * 2.6, .03, f.limb * 2.8).translate(0, .004, 0), look.legs);
    add('spine', cylinder(f.limb * 2.7, f.limb * 2.2, f.torso, 0, 8, .78), look.top);
  }
  add('head', cylinder(f.limb * .8, f.limb * .8, -f.neck - .004, .004, 6), SKIN);
  add('head', ball(f.head, [0, f.head, 0]), SKIN);
  // Hair over the crown and the back of the head, the face left bare; hers up in a bun.
  add('head', ball(f.head * 1.03, [0, f.head * 1.2, f.head * .16], 8, 5), look.hair);
  if (her) add('head', ball(f.head * .5, [0, f.head * 1.7, f.head * .95], 6, 4), look.hair);
  for (const s of ['L', 'R'] as const) {
    add(`upperArm${s}`, cylinder(f.limb, f.limb * .9, 0, -f.upperArm), look.top);
    add(`foreArm${s}`, cylinder(f.limb * .9, f.limb * .8, 0, -f.forearm + f.limb * .6), her ? SKIN : look.top);
    add(`foreArm${s}`, new THREE.IcosahedronGeometry(f.limb * 1.05, 0).translate(0, -f.forearm, 0), SKIN);
    // Her thighs are under the dress.
    if (!her) add(`thigh${s}`, cylinder(f.limb * 1.1, f.limb, 0, -f.thigh), look.legs);
    add(`shin${s}`, cylinder(f.limb, f.limb * .85, her ? -f.thigh * .3 : 0, -f.shin), look.legs);
    add(`foot${s}`, new THREE.BoxGeometry(f.limb * 2, f.shoe * 2, f.toe + .008).translate(0, 0, -(f.toe - .008) / 2), look.shoes);
  }
  if (!her) {
    // The ring, a little larger than life, held up between his fingers.
    add('ring', new THREE.TorusGeometry(.011, .0035, 4, 10).translate(0, .012, 0), FIGURE_LOOK.ring.band);
    add('ring', new THREE.OctahedronGeometry(.0065).translate(0, .026, 0), FIGURE_LOOK.ring.stone);
  }
  return parts;
}

export type ProposalFigures = {
  mesh: THREE.SkinnedMesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  bones: Record<Who, Record<Bone, THREE.Bone>>;
  dispose: () => void;
};
// Both figures, their bones at rest (standing, arms down) for the bind.
export function proposalFigures(): ProposalFigures {
  const all: THREE.Bone[] = [], geometries: THREE.BufferGeometry[] = [];
  const bones = {} as ProposalFigures['bones'];
  for (const who of ['amelia', 'patrick'] as const) {
    const f = FIGURE[who], own = {} as Record<Bone, THREE.Bone>, rest = {} as Record<Bone, THREE.Vector3>;
    for (const bone of BONES) {
      const b = new THREE.Bone(), parent = boneParent[bone];
      b.name = `${who}-${bone}`;
      b.position.set(...boneOffset(f, bone));
      if (parent) own[parent].add(b);
      rest[bone] = parent ? rest[parent].clone().add(b.position) : new THREE.Vector3();
      own[bone] = b;
    }
    const first = all.length;
    all.push(...BONES.map(bone => own[bone]));
    bones[who] = own;
    for (const { bone, geometry, tint } of figureParts(who)) {
      // The polyhedra (hands, stone) come unindexed already.
      const flat = geometry.index ? geometry.toNonIndexed() : geometry;
      if (flat !== geometry) geometry.dispose();
      flat.deleteAttribute('uv');
      flat.translate(rest[bone].x, rest[bone].y, rest[bone].z);
      const n = flat.attributes.position.count, colour = new THREE.Color(tint), index = first + BONES.indexOf(bone);
      const colours = new Float32Array(n * 3), skinIndex = new Uint16Array(n * 4), skinWeight = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) {
        colour.toArray(colours, i * 3);
        skinIndex[i * 4] = index;
        skinWeight[i * 4] = 1;
      }
      flat.setAttribute('color', new THREE.BufferAttribute(colours, 3));
      flat.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
      flat.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4));
      flat.computeVertexNormals();
      geometries.push(flat);
    }
  }
  const geometry = mergeGeometries(geometries);
  geometries.forEach(part => part.dispose());
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85 });
  const mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.name = 'proposal';
  mesh.frustumCulled = false;
  mesh.visible = false;
  mesh.add(bones.amelia.root, bones.patrick.root);
  mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(all));
  return { mesh, bones, dispose: () => { geometry.dispose(); material.dispose(); mesh.skeleton.dispose(); } };
}
