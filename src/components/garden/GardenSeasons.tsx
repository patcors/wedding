// The seasons in the scene (seasons.ts): one set of uniforms shared by every
// tree's leaves, the ground, the plants and the bank flowers, written once a
// frame here. Only uniforms change, so the year turns with no new draw calls,
// textures or shader compiles; with seasons off they all stand at none.
import { useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useJourney } from './JourneyProvider';
import { AUTUMN_TREE_COLOURS, BLOSSOM_COLOURS, CLOVER_FLOWERS, FLOWER_COLOURS, FLOWER_GROWTH, NEUTRAL, TREE_TURN, seasonAt, seasonChange, treeSeason, type Season } from './seasons';
import type { Placement } from './gardenTreeSpots';

export const SEASON_UNIFORMS = {
  // turn, bare, fresh, blossom: the whole picture's
  seasonCanopy: { value: new THREE.Vector4() },
  // pale, dry, flowers
  seasonWash: { value: new THREE.Vector3() },
  // The change under way (seasonChange): the trees' turn, bare, fresh and
  // blossom it leaves and goes to, how far through it is, and 1 if the trees
  // go in reverse. Each tree works out its own point in it (treeTurn).
  seasonFrom: { value: new THREE.Vector4() },
  seasonTo: { value: new THREE.Vector4() },
  seasonChange: { value: new THREE.Vector2() },
};
const canopy = (v: THREE.Vector4, s: Season) => v.set(s.turn, s.bare, s.fresh, s.blossom);

// Gives each tree in a batch of leaves its part in the seasons (treeSeason in
// seasons.ts), carried to the shader as the instance's colour: red its parts,
// green its shade, blue its order in a change. The shader puts the leaves'
// own colour back.
const roleColour = new THREE.Color();
export function seasonRoles(mesh: THREE.InstancedMesh, placements: readonly Placement[], width: number, mobile: boolean) {
  placements.forEach((p, i) => {
    const { parts, shade, order } = treeSeason(p.x, p.z, p.type, width, mobile);
    mesh.setColorAt(i, roleColour.setRGB(parts, shade, order, THREE.LinearSRGBColorSpace));
  });
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

// The season this frame, or none with seasons off. Under reduced motion the
// progress is already the milestone's still, so it shows that moment's season.
export function currentSeason(progress: number, on: boolean): Season {
  return on ? seasonAt(progress) : NEUTRAL;
}

export default function GardenSeasons({ on }: { on: boolean }) {
  const clock = useJourney();
  const invalidate = useThree(state => state.invalidate);
  // A paused or reduced-motion scene draws only on demand.
  useEffect(() => { invalidate(); }, [on, invalidate]);
  useFrame(() => {
    const s = currentSeason(clock.progress, on);
    canopy(SEASON_UNIFORMS.seasonCanopy.value, s);
    SEASON_UNIFORMS.seasonWash.value.set(s.pale, s.dry, s.flowers);
    const change = on ? seasonChange(clock.progress) : { from: NEUTRAL, to: NEUTRAL, t: 0, reverse: false };
    canopy(SEASON_UNIFORMS.seasonFrom.value, change.from);
    canopy(SEASON_UNIFORMS.seasonTo.value, change.to);
    SEASON_UNIFORMS.seasonChange.value.set(change.t, change.reverse ? 1 : 0);
  });
  return null;
}

const f = (v: number) => v.toFixed(2);
// A colour given in sRGB, as GLSL in the shaders' linear light, so a pink
// stays as saturated on screen as it is written.
const linear = (srgb: readonly number[]) => {
  const c = new THREE.Color().setRGB(srgb[0], srgb[1], srgb[2], THREE.SRGBColorSpace);
  return `vec3(${f(c.r)}, ${f(c.g)}, ${f(c.b)})`;
};
const AUTUMN_LEAVES = AUTUMN_TREE_COLOURS, BLOSSOM = BLOSSOM_COLOURS;
// One of FLOWER_COLOURS by a hash from 0 to 1.
const FLOWER = `vec3 seasonFlower(float h) {
    return h < .3 ? ${linear(FLOWER_COLOURS[0])} : h < .55 ? ${linear(FLOWER_COLOURS[1])} : h < .8 ? ${linear(FLOWER_COLOURS[2])} : ${linear(FLOWER_COLOURS[3])};
  }
  float seasonHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
`;

// The leaves. Each tree's parts say which seasons it takes part in. In winter
// the bare trees drop most of their cards in turn, so their branches show,
// and the rest a few, their leaves a cooler green. In autumn the trees that
// turn go amber, orange, rust and red card by card, a few cards staying
// green, and the rest of the avenue warms a little. In spring the trees that
// blossom open card by card in cherry pink, and every tree's green freshens.
// Through a change each tree turns over its own share of it, in its own
// order (treeTurn in seasons.ts), so they go one by one. The old tree at the
// dock is an evergreen and stays as it is all year. Shared by the colour and
// depth (shadow) materials, so the shadows thin with the canopy.
export function seasonalLeaves(shader: THREE.WebGLProgramParametersWithUniforms) {
  Object.assign(shader.uniforms, SEASON_UNIFORMS);
  shader.vertexShader = `varying vec4 vSeason;\n${shader.vertexShader}`
    .replace('#include <begin_vertex>', `#include <begin_vertex>
      // x: the tree's parts, y: its shade, z: which leaf card, w: its order in a change.
      vSeason = vec4(0., 0., fract(sin(dot(_leafcentre.xz * 7.1 + _leafcentre.y * 3.7, vec2(41.37, 289.13))) * 43758.5453), 0.);
      #ifdef USE_INSTANCING_COLOR
        vSeason.xyw = instanceColor.rgb;
      #endif
    `)
    .replace('#include <color_vertex>', `#include <color_vertex>
      #ifdef USE_INSTANCING_COLOR
        vColor.rgb = vec3(1.);
      #endif
    `);
  shader.fragmentShader = `uniform vec4 seasonFrom;\nuniform vec4 seasonTo;\nuniform vec2 seasonChange;\nvarying vec4 vSeason;\n${shader.fragmentShader}`
    .replace('#include <map_fragment>', `#include <map_fragment>
      {
        // The bits of PART (seasons.ts): turns 1, bare 2, blossom 4, old 8.
        float parts = floor(vSeason.x + .5), shade = vSeason.y, card = vSeason.z;
        // The old tree at the dock is an evergreen: no season touches it.
        if (parts < 7.5) {
          float turns = mod(parts, 2.), bare = mod(floor(parts * .5), 2.), blossoming = mod(floor(parts * .25), 2.);
          // This tree's own point in the change under way (treeTurn in seasons.ts).
          float order = mix(vSeason.w, 1. - vSeason.w, seasonChange.y);
          vec4 seasonCanopy = mix(seasonFrom, seasonTo, smoothstep(0., 1., (seasonChange.x - order * ${f(1 - TREE_TURN)}) / ${f(TREE_TURN)}));
          // Winter: the bare trees drop most of their cards in turn as \`bare\` rises, the rest a few.
          if (card < seasonCanopy.y * mix(.2, .94, bare)) discard;
          vec3 leaf = diffuseColor.rgb;
          float luma = dot(leaf, vec3(.2126, .7152, .0722));
          // Winter: the leaves left a cooler green.
          leaf = mix(leaf, vec3(luma) * vec3(.78, 1.05, 1.1), .3 * seasonCanopy.y);
          // Autumn: each tree round the palette, its cards a little either side, amber
          // and orange the most, then rust, then a little red.
          float hue = pow(fract(shade + (card - .5) * .3), 1.6) * 3.;
          vec3 autumn = mix(mix(${linear(AUTUMN_LEAVES[0])}, ${linear(AUTUMN_LEAVES[1])}, clamp(hue, 0., 1.)),
            mix(${linear(AUTUMN_LEAVES[2])}, ${linear(AUTUMN_LEAVES[3])}, clamp(hue - 2., 0., 1.)), clamp(hue - 1., 0., 1.));
          autumn *= clamp(luma * 5.5, .35, 1.15);
          leaf = mix(leaf, autumn, seasonCanopy.x * (turns * .92 * step(.12, card) + (1. - turns) * .14));
          // Spring: every tree's green a little fresher and brighter.
          vec3 fresh = vec3(luma) * vec3(.9, 1.32, .5) * 1.25;
          leaf = mix(leaf, fresh, seasonCanopy.z * .32);
          // Blossom: card by card as it opens, cherry pink, deeper to paler, keeping a little of the card's shading.
          float opened = blossoming * smoothstep(.0, .12, seasonCanopy.w * .88 - card);
          vec3 bloom = mix(${linear(BLOSSOM[0])}, ${linear(BLOSSOM[1])}, fract(card * 7.3 + shade)) * clamp(.55 + luma * 3., .6, 1.);
          leaf = mix(leaf, bloom, opened);
          diffuseColor.rgb = leaf;
        }
      }
    `);
}

// The grass and plants: winter frosts them, cool and bright; autumn dries
// them towards straw; spring freshens them.
const WASH = `uniform vec4 seasonCanopy;
  uniform vec3 seasonWash;
  ${FLOWER}
  vec3 seasonGround(vec3 c) {
    float luma = dot(c, vec3(.2126, .7152, .0722));
    c = mix(c, vec3(luma) * vec3(.9, 1., 1.14) * 1.7 + vec3(.012, .016, .026), .3 * seasonWash.x);
    c *= mix(vec3(1.), vec3(1.2, 1.0, .66), seasonWash.y * .5);
    c *= mix(vec3(1.), vec3(.96, 1.12, .84), seasonCanopy.z * .5);
    return c;
  }
`;
// Declares seasonGround(colour) in a ground or plant material's fragment
// shader, for its own code to call.
export function seasonalWash(shader: THREE.WebGLProgramParametersWithUniforms) {
  Object.assign(shader.uniforms, SEASON_UNIFORMS);
  shader.fragmentShader = `${WASH}\n${shader.fragmentShader}`;
}

// Spring's flowers on the banks, in the materials already there, so no draw
// calls are added. The bank flowers (GardenBankDetails.tsx) grow and take a
// clump's colour; about half the clover's colonies (GardenPlants.tsx) lift
// their heads above the grass in a colony's colour.
export function seasonalFlowers(shader: THREE.WebGLProgramParametersWithUniforms) {
  Object.assign(shader.uniforms, SEASON_UNIFORMS);
  shader.vertexShader = `uniform vec3 seasonWash;\nvarying float vFlower;\n${FLOWER}\n${shader.vertexShader}`
    .replace('#include <begin_vertex>', `#include <begin_vertex>
      vFlower = seasonHash(floor(instanceMatrix[3].xz / 1.5));
      transformed *= 1. + ${f(FLOWER_GROWTH)} * seasonWash.z;
    `);
  shader.fragmentShader = `uniform vec3 seasonWash;\nvarying float vFlower;\n${FLOWER}\n${shader.fragmentShader}`
    .replace('#include <color_fragment>', `#include <color_fragment>
      diffuseColor.rgb = mix(diffuseColor.rgb, seasonFlower(vFlower), seasonWash.z);
    `);
}
export function seasonalClover(shader: THREE.WebGLProgramParametersWithUniforms) {
  shader.vertexShader = `uniform vec3 seasonWash;\nvarying float vFlower;\n${FLOWER}\n${shader.vertexShader}`
    .replace('#include <begin_vertex>', `#include <begin_vertex>
      vec2 colony = floor(instanceMatrix[3].xz / 3.);
      vFlower = step(seasonHash(colony + 7.), ${f(CLOVER_FLOWERS.share)}) * seasonWash.z;
      transformed.y += vFlower * ${f(CLOVER_FLOWERS.lift)};
      vFlower += floor(seasonHash(colony) * 4.) * 2.;
    `);
  shader.fragmentShader = `varying float vFlower;\n${shader.fragmentShader}`
    .replace('diffuseColor.rgb = seasonGround(diffuseColor.rgb);', `diffuseColor.rgb = seasonGround(diffuseColor.rgb);
      diffuseColor.rgb = mix(diffuseColor.rgb, seasonFlower(floor(vFlower * .5) * .25 + .05), fract(vFlower * .5) * 2.);
    `);
}
