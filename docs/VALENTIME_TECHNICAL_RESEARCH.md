# Valentime-inspired garden: technical feasibility

Research date: 6 September 2026. This note evaluates techniques for our wedding site against repository code and first-party renderer documentation. These are proposed implementations, **not claims about how Noomo built Valentime**. Visual inspection of the reference is a separate part of the design review.

Noomo confirms WebGPU/TSL fog, authored geometry, manually placed petals, baked animation and a designed camera path. Our proposed techniques adapt those effects to the existing renderer. Source: [creator's technical writeup](https://noomoagency.com/insights/noomo-valentime-immersive-storytelling).

## Recommendation

Build one short garden scene first: pale daylight, a shallow reflecting pool, textured banks, a few pairs of trees, and gently turning petals. Prove the composition at desktop and portrait phone sizes before extending it along the story. The current stack supports this without replacing Astro or the renderer.

The existing story has a useful persistent canvas and scroll controller, but its staging belongs to another setting: a dark studio environment, floating strands, and a 420-unit route whose elevation changes along the journey. A convincing garden needs a camera with a deliberate height above the ground and photographs positioned for that new route. Simply adding a ground plane beneath the current camera would leave the site feeling airborne. Sources: [Scene.tsx](../src/components/story/Scene.tsx), [StoryCanvas.tsx](../src/components/story/StoryCanvas.tsx), [curves.ts](../src/components/story/curves.ts).

## Techniques and decisions

| Desired effect | Recommended implementation | What makes it convincing |
| --- | --- | --- |
| Reflective water | One horizontal plane using drei `MeshReflectorMaterial`; begin with a 512px reflection target and very restrained distortion. | Trees and banks must appear in the reflected scene. Keep enough stillness to recognize their shapes. |
| Faded background | Match the background and fog to a pale warm neutral; retain `FogExp2`, tuning density after deciding scene scale. | Nearby bark and stone retain definition while successive tree pairs lose contrast into the distance. |
| Brighter screen | Replace the dark studio environment with an outdoor lighting composition and pale sky; coordinate the HTML background and text colors. | A bright sky and visible shaded detail, with one directional light preserving material relief. |
| Real ground | Shaped banks, a defined waterline, small stones and restrained vegetation, with color, roughness and normal textures. | Geometry supplies the silhouette and shoreline; textures supply detail below that scale. |
| Floating petals | Shared, slightly curved petal geometry rendered with `InstancedMesh`; vary position, scale, phase and slow tumble. | Sparse distribution, unequal motion and depth, with clear space around names and photographs. |
| Tree colonnade | A few matching tree pairs along the route, with varied rotation and scale; open crowns leave sky visible. | Repeated trunks preserve the pillars' rhythm and perspective without creating a dark canopy. |

`MeshReflectorMaterial` supplies a virtual reflection camera and renders the scene into an offscreen texture each frame. Blur adds another processing stage. This is why one pool is a reasonable first step, while several independent reflective surfaces would need deliberate budgeting. The proposed 512px target is a starting value to measure, not a performance guarantee. Source: [drei 10.7.7 implementation](https://github.com/pmndrs/drei/blob/v10.7.7/src/core/MeshReflectorMaterial.tsx).

For a later water-specific shader, Three.js also provides `Water`, with reflection resolution, animated time, normal map and distortion controls. It supports the existing WebGL renderer; its fog option defaults to false and should be enabled for this setting. Start with the simpler reflector to judge composition, then switch only if the surface still reads as polished stone. Source: [Three.js Water](https://threejs.org/docs/pages/Water.html).

`FogExp2` preserves clearer foreground objects and increases fog rapidly with distance. Our recommendation is distance-dependent atmosphere, rather than a uniform pale overlay that also erases foreground detail. Source: [Three.js FogExp2](https://threejs.org/docs/pages/FogExp2.html).

`MeshStandardMaterial` supports the needed material maps and environment lighting. Normal maps affect shading, not the silhouette; displacement affects vertices. For the first garden scene, author the broad terrain shape as geometry and reserve normal maps for fine grain. Source: [Three.js MeshStandardMaterial](https://threejs.org/docs/pages/MeshStandardMaterial.html).

Instancing reduces draw calls for objects sharing geometry and material. For moving petals, update instance transforms in the existing frame loop rather than React state; mark the instance matrix updated and ensure culling bounds cover their movement. Source: [Three.js InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html).

## Assets, mobile, and access

The checked-in public assets currently contain photographs and rope textures, with no terrain or tree models. Attractive tree silhouettes and coherent ground textures are the principal new asset work. Use a small number of deliberately chosen, licensed tree models; simple cylinder trunks and sphere crowns are only composition placeholders. GLB fits the renderer's supported glTF loading path. Sources: [existing asset notes](./ASSET_TASKS.md), [Three.js GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html).

Foliage made from transparent planes can exhibit ordering artifacts. Prefer cutout leaves where appropriate, and inspect them both directly and in reflection. Instancing alone does not solve overlapping transparent surfaces. Source: [Three.js transparency guide](https://threejs.org/manual/en/transparency.html).

Measure actual phones before expanding the scene. Suggested quality steps: lower reflection resolution, disable reflection blur, lower canvas pixel ratio, then reduce distant foliage and petals. A final fallback can use an environment-lit surface, but it will lose accurate nearby tree reflections. Drei's `PerformanceMonitor` can trigger changes based on measured frame rate; use stable quality levels to avoid oscillation. Source: [drei PerformanceMonitor documentation](https://github.com/pmndrs/drei/blob/master/docs/performances/performance-monitor.mdx).

Keep names, date, story text and RSVP available as ordinary HTML. Respect reduced-motion preferences by stopping decorative drift and avoiding the moving camera journey; provide a still composition with readable content. W3C specifically identifies scroll-triggered parallax as potentially problematic motion. Source: [W3C animation from interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html).

## First implementation and review

1. Stage one opening view with a near-level camera, pale fog/background, ground banks, pool and temporary tree silhouettes.
2. Verify recognizable reflections and readable text in desktop and portrait compositions.
3. Introduce one finished tree family and one coherent ground material; refine their contact with the ground and water.
4. Add a small field of petals, reduced-motion behavior and measured quality fallback.
5. Only then reshape the longer scroll journey and rehang the shared and personal photographs along it.

Review by visible outcomes: foreground texture survives the bright lighting; distant trees dissolve gradually; water reflects recognizable objects; banks have real depth; petals drift without resembling confetti; tree crowns frame the content without darkening it. No application code was changed for this research.
