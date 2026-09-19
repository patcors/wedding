import * as THREE from 'three';

// Adapted from CK42BB/procedural-grass-threejs's layered-wind approach.
// See licenses/procedural-grass-threejs.txt for the upstream MIT license.
export function configureGrassMaterial(material: THREE.MeshStandardMaterial, time: { value: number }, mobile: boolean) {
  material.onBeforeCompile = shader => {
    shader.uniforms.grassTime = time;
    shader.uniforms.grassFadeEnd = { value: mobile ? 80 : 108 };
    shader.vertexShader = `uniform float grassTime;
      uniform float grassFadeEnd;
      ${shader.vertexShader}`.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      vec3 root = instanceMatrix[3].xyz;
      float heightFraction = clamp(position.y / .28, 0.0, 1.0);
      float bend = heightFraction * heightFraction;
      float phase = dot(root.xz, vec2(.32, .19));
      float sway = sin(phase + grassTime * .85) * .028;
      float gust = pow(.5 + .5 * sin(phase * .43 - grassTime * .65), 3.0)
        * sin(phase * 1.7 - grassTime * 1.4) * .045;
      float flutter = sin(grassTime * 2.8 + root.x * 13.7 + root.z * 9.2) * .009;
      // Convert the shared world wind to blade-local coordinates so all
      // instances lean together despite their random rotation and scale.
      vec2 worldWind = vec2(sway + gust + flutter, (sway + gust) * .6);
      vec3 localX = instanceMatrix[0].xyz;
      vec3 localZ = instanceMatrix[2].xyz;
      transformed.x += dot(worldWind, localX.xz) / dot(localX, localX) * bend;
      transformed.z += dot(worldWind, localZ.xz) / dot(localZ, localZ) * bend;
      // Sink blades smoothly into the ground near the fog horizon. Use the
      // active view matrix so reflections use their own camera distance.
      float distanceToRoot = length((modelViewMatrix * vec4(root, 1.0)).xyz);
      float visibility = 1.0 - smoothstep(grassFadeEnd - 24.0, grassFadeEnd, distanceToRoot);
      transformed.y *= visibility;
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
      // A restrained backlit glow, retaining the scene's lights and shadows.
      vec3 grassSun = normalize((viewMatrix * vec4(-.5, .8, -.2, 0.0)).xyz);
      float transmission = pow(max(dot(-normalize(vViewPosition), grassSun), 0.0), 3.0);
      outgoingLight += diffuseColor.rgb * transmission * .18;
      #include <opaque_fragment>
    `);
  };
  material.customProgramCacheKey = () => 'garden-meadow-layered-wind-v1';
}
