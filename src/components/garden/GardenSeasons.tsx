// The seasons in the scene (seasons.ts): one set of uniforms shared by every
// tree's leaves, the ground and the plants, written once a frame here. Only
// uniforms change, so the year turns with no new draw calls, textures or
// shader compiles; with seasons off they all stand at none.
import { useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useJourney } from './JourneyProvider';
import { NEUTRAL, OLD_TREE_AUTUMN, ROLE, seasonAt, treeSeason, type Season } from './seasons';
import type { Placement } from './gardenTreeSpots';

export const SEASON_UNIFORMS = {
  // turn, bare, fresh, blossom
  seasonCanopy: { value: new THREE.Vector4() },
  // pale, dry
  seasonWash: { value: new THREE.Vector2() },
};

// Gives each tree in a batch of leaves its part in the seasons (treeSeason in
// seasons.ts), carried to the shader as the instance's colour: red its role,
// green its shade. The shader puts the leaves' own colour back.
const roleColour = new THREE.Color();
export function seasonRoles(mesh: THREE.InstancedMesh, placements: readonly Placement[], width: number, mobile: boolean) {
  placements.forEach((p, i) => {
    const { role, shade } = treeSeason(p.x, p.z, p.type, width, mobile);
    mesh.setColorAt(i, roleColour.setRGB(role, shade, 0, THREE.LinearSRGBColorSpace));
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
    SEASON_UNIFORMS.seasonCanopy.value.set(s.turn, s.bare, s.fresh, s.blossom);
    SEASON_UNIFORMS.seasonWash.value.set(s.pale, s.dry);
  });
  return null;
}

const f = (v: number) => v.toFixed(1);

// The leaves. Only the trees treeSeason picks take part; every other tree
// stays as it is all year. The ones that turn go gold or amber card by card
// in autumn, some cards staying green, and the old tree at the dock goes
// gold on a share of its cards; the sparse ones drop most of their
// cards in winter, so a few branches show; the blossoming ones open card by
// card, pale pink to white, so a flowering tree reads clearly, even on a
// phone, among the green. Shared by the colour and depth (shadow) materials,
// so the shadows thin with the canopy.
export function seasonalLeaves(shader: THREE.WebGLProgramParametersWithUniforms) {
  Object.assign(shader.uniforms, SEASON_UNIFORMS);
  shader.vertexShader = `varying vec3 vSeason;\n${shader.vertexShader}`
    .replace('#include <begin_vertex>', `#include <begin_vertex>
      // x: the tree's role, y: its shade, z: which leaf card.
      vSeason = vec3(0., 0., fract(sin(dot(_leafcentre.xz * 7.1 + _leafcentre.y * 3.7, vec2(41.37, 289.13))) * 43758.5453));
      #ifdef USE_INSTANCING_COLOR
        vSeason.xy = instanceColor.rg;
      #endif
    `)
    .replace('#include <color_vertex>', `#include <color_vertex>
      #ifdef USE_INSTANCING_COLOR
        vColor.rgb = vec3(1.);
      #endif
    `);
  shader.fragmentShader = `uniform vec4 seasonCanopy;\nvarying vec3 vSeason;\n${shader.fragmentShader}`
    .replace('#include <map_fragment>', `#include <map_fragment>
      {
        float role = floor(vSeason.x + .5), shade = vSeason.y, card = vSeason.z;
        float turns = step(${f(ROLE.turns)}, role) * step(role, ${f(ROLE.sparse)});
        float sparse = step(abs(role - ${f(ROLE.sparse)}), .1), blossoming = step(abs(role - ${f(ROLE.blossom)}), .1);
        // Winter: the sparse trees drop most of their cards in turn as \`bare\` rises, the others that turn a few.
        if (card < seasonCanopy.y * (.72 * sparse + .15 * turns)) discard;
        vec3 leaf = diffuseColor.rgb;
        float luma = dot(leaf, vec3(.2126, .7152, .0722));
        // Autumn: gold to amber tree by tree, some cards slower to turn, some staying green;
        // lifted a little, so a turned crown glows rather than browns in the late light.
        vec3 autumn = mix(vec3(1.0, .7, .26), vec3(.97, .47, .2), shade) * (luma * 2.3 + .07);
        leaf = mix(leaf, autumn, .75 * seasonCanopy.x * turns * smoothstep(.0, .5, card + .2 * seasonCanopy.x - .15));
        // The old tree at the dock: gold on only a share of its cards, and only partly, so it stays itself.
        float old = step(abs(role - ${f(ROLE.old)}), .1);
        vec3 gold = vec3(1.0, .74, .32) * (luma * 2.3 + .1);
        leaf = mix(leaf, gold, ${OLD_TREE_AUTUMN.turn.toFixed(2)} * seasonCanopy.x * old * step(card, ${OLD_TREE_AUTUMN.cards.toFixed(2)}));
        // Spring: a little fresh growth on the trees that turn.
        vec3 fresh = vec3(luma) * vec3(.95, 1.28, .5) * 1.18;
        leaf = mix(leaf, fresh, seasonCanopy.z * .2 * turns);
        // Blossom: card by card as it opens, pale pink to white, keeping a little of the card's shading.
        float opened = blossoming * smoothstep(.0, .12, seasonCanopy.w * .92 - card);
        vec3 bloom = mix(vec3(1., .6, .68), vec3(1., .88, .89), fract(card * 7.3 + shade) * .85) * (.75 + .35 * smoothstep(.02, .2, luma));
        leaf = mix(leaf, bloom, opened);
        diffuseColor.rgb = leaf;
      }
    `);
}

// The grass and plants: winter pales them a little, autumn dries them
// towards straw, spring freshens them a touch.
const WASH = `uniform vec4 seasonCanopy;
  uniform vec2 seasonWash;
  vec3 seasonGround(vec3 c) {
    float luma = dot(c, vec3(.2126, .7152, .0722));
    c = mix(c, mix(c, vec3(luma) * vec3(1.06, 1.03, .88), .25) * 1.2, seasonWash.x);
    c *= mix(vec3(1.), vec3(1.08, 1.0, .82), seasonWash.y * .3);
    c *= mix(vec3(1.), vec3(.98, 1.04, .92), seasonCanopy.z * .3);
    return c;
  }
`;
// Declares seasonGround(colour) in a ground or plant material's fragment
// shader, for its own code to call.
export function seasonalWash(shader: THREE.WebGLProgramParametersWithUniforms) {
  Object.assign(shader.uniforms, SEASON_UNIFORMS);
  shader.fragmentShader = `${WASH}\n${shader.fragmentShader}`;
}
