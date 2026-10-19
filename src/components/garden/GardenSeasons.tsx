// The seasons in the scene (seasons.ts): one set of uniforms shared by every
// tree's leaves, the ground and the plants, written once a frame here. Only
// uniforms change, so the year turns with no new draw calls, textures or
// shader compiles; with seasons off they all stand at none.
import { useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useJourney } from './JourneyProvider';
import { NEUTRAL, seasonAt, type Season } from './seasons';

export const SEASON_UNIFORMS = {
  // turn, bare, fresh, blossom
  seasonCanopy: { value: new THREE.Vector4() },
  // grey, lush, dry
  seasonWash: { value: new THREE.Vector3() },
  // Where a tree stands that keeps its leaves whatever the season: the old
  // tree at the dock, the venue's own, whose kind isn't for the scene to say.
  seasonEvergreen: { value: new THREE.Vector2(1e4, 1e4) },
};

// The season this frame, or none with seasons off.
export function currentSeason(progress: number, reduced: boolean, on: boolean): Season {
  return on ? seasonAt(progress, !reduced) : NEUTRAL;
}

export default function GardenSeasons({ on, reduced }: { on: boolean; reduced: boolean }) {
  const clock = useJourney();
  const invalidate = useThree(state => state.invalidate);
  // A paused or reduced-motion scene draws only on demand.
  useEffect(() => { invalidate(); }, [on, invalidate]);
  useFrame(() => {
    const s = currentSeason(clock.progress, reduced, on);
    SEASON_UNIFORMS.seasonCanopy.value.set(s.turn, s.bare, s.fresh, s.blossom);
    SEASON_UNIFORMS.seasonWash.value.set(s.grey, s.lush, s.dry);
  });
  return null;
}

const HASH = `float seasonHash(vec2 p) { return fract(sin(dot(p, vec2(41.37, 289.13))) * 43758.5453); }`;

// The leaves: about two trees in five are deciduous (by a hash of where each
// stands), turning gold, amber or russet card by card in autumn and dropping
// most of their leaf cards in winter, so their branches show; a third of
// those blossom pink in spring and the rest put out fresh, yellower
// green. Every tree greys a little in winter and deepens in summer. Shared by
// the colour and depth (shadow) materials, so the shadows thin with the canopy.
export function seasonalLeaves(shader: THREE.WebGLProgramParametersWithUniforms) {
  Object.assign(shader.uniforms, SEASON_UNIFORMS);
  shader.vertexShader = `uniform vec2 seasonEvergreen;\nvarying vec2 vSeason;\n${HASH}\n${shader.vertexShader}`
    .replace('#include <begin_vertex>', `#include <begin_vertex>
      vec2 seasonTree = vec2(0.);
      #ifdef USE_INSTANCING
        seasonTree = instanceMatrix[3].xz;
      #endif
      // x: which kind of tree, y: which leaf card.
      vSeason = vec2(seasonHash(floor(seasonTree * 4.) + .5), seasonHash(_leafcentre.xz * 7.1 + _leafcentre.y * 3.7 + seasonTree));
      if (distance(seasonTree, seasonEvergreen) < 1.) vSeason.x = 0.;
    `);
  shader.fragmentShader = `uniform vec4 seasonCanopy;\nuniform vec3 seasonWash;\nvarying vec2 vSeason;\n${shader.fragmentShader}`
    .replace('#include <map_fragment>', `#include <map_fragment>
      {
        float deciduous = step(.6, vSeason.x), card = vSeason.y;
        // Fallen leaves: the cards drop out in turn as \`bare\` rises.
        if (deciduous > .5 && card < seasonCanopy.y * .68) discard;
        vec3 leaf = diffuseColor.rgb;
        float luma = dot(leaf, vec3(.2126, .7152, .0722));
        // Autumn: gold to russet tree by tree, some cards slower to turn.
        float hue = fract(vSeason.x * 13.7);
        vec3 autumn = mix(vec3(1.0, .66, .2), vec3(.9, .36, .14), hue) * luma * 2.1;
        leaf = mix(leaf, autumn, .85 * seasonCanopy.x * deciduous * smoothstep(.0, .55, card + .25 * seasonCanopy.x));
        // Spring: fresh yellow-green growth, and blossom on a third of the deciduous trees.
        vec3 fresh = vec3(luma) * vec3(.95, 1.28, .5) * 1.18;
        leaf = mix(leaf, fresh, seasonCanopy.z * (.18 + .5 * deciduous));
        // Blossom washes the whole crown pink, as a flowering tree reads from afar.
        float blossoming = deciduous * step(.87, vSeason.x);
        vec3 bloom = vec3(1.0, .7, .78) * (.12 + luma * 1.9);
        leaf = mix(leaf, bloom, seasonCanopy.w * blossoming * (.4 + .3 * card));
        // Winter: greyer and cooler, the remaining deciduous leaves dull and brown.
        float l2 = dot(leaf, vec3(.2126, .7152, .0722));
        leaf = mix(leaf, vec3(l2) * vec3(.97, .99, 1.03), seasonWash.x * (.28 + .3 * deciduous));
        leaf = mix(leaf, vec3(l2) * vec3(1.12, .98, .78), seasonWash.x * deciduous * .35);
        // Summer: a little richer.
        leaf = mix(vec3(l2), leaf, 1. + .14 * seasonWash.y);
        diffuseColor.rgb = leaf;
      }
    `);
}

// The grass and plants: winter greys and cools them, autumn dries them
// towards straw, spring freshens them, summer deepens them.
const WASH = `uniform vec4 seasonCanopy;
  uniform vec3 seasonWash;
  vec3 seasonGround(vec3 c) {
    float luma = dot(c, vec3(.2126, .7152, .0722));
    c = mix(c, vec3(luma) * vec3(.98, 1., 1.03), seasonWash.x * .38);
    c *= mix(vec3(1.), vec3(1.1, 1.0, .8), seasonWash.z * .45);
    c *= mix(vec3(1.), vec3(.98, 1.06, .88), seasonCanopy.z * .4);
    return mix(vec3(luma), c, 1. + .1 * seasonWash.y);
  }
`;
// Declares seasonGround(colour) in a ground or plant material's fragment
// shader, for its own code to call.
export function seasonalWash(shader: THREE.WebGLProgramParametersWithUniforms) {
  Object.assign(shader.uniforms, SEASON_UNIFORMS);
  shader.fragmentShader = `${WASH}\n${shader.fragmentShader}`;
}
