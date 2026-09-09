# Garden tree assets and comparison

The `/garden` preview defaults to EZ-Tree ash trees. The **Trees: EZ-Tree / Original** button in the bottom review controls switches the tree groups while preserving the camera, scroll position, boats, and lighting. Both groups stay mounted for immediate comparisons. **Scene only** hides the invitation copy; **Pause motion** freezes the camera, leaf wind, and other animation. Reduced motion also freezes wind.

## Regenerate and adjust

```sh
pnpm install --frozen-lockfile
pnpm generate:garden-trees
node --test tests/gardenTreeAssets.test.mjs
```

The complete authoring script is [`scripts/generate-garden-trees.mjs`](../scripts/generate-garden-trees.mjs). It uses pinned EZ-Tree 1.1.0 and glTF Transform/Meshoptimizer development dependencies. The browser never imports the generator or its full bundled texture collection. Generated files are checked into `public/models/garden/`; ordinary builds do not regenerate them.

The script loads the pinned package's Ash Medium preset, applies two explicit seeds, raises the first branches, shortens the crown limbs, and scales the results into garden units. Change the seeds or `tree.options` overrides to adjust the shapes. The detailed trees have 20,000 triangles each. Distant variants use fewer branch segments and larger, fewer leaf cards, for 6,120 triangles each. These are separately authored detail variants, not automatic distance-switching LODs; their placement is selected in `GardenTrees.tsx`.

Each tree exports `branches` and `leaves` meshes with baked transforms. A custom `_LEAFCENTRE` vertex attribute lets the wind shader move leaf cards coherently. Meshopt FILTER compression retains world-unit geometry without introducing quantization transforms. Colour, normal, roughness, and foliage maps are exported separately so all four models share them. The GLBs contain no textures and preserve the source EZ-Tree UV convention; externally loaded maps use `flipY: true`.

The Node-only texture-loader stub avoids fetching browser images during geometry generation. The small FileReader adapter serves Three.js's binary GLB exporter. Neither shim is included in the application.

## Runtime

[`GardenTrees.tsx`](../src/components/garden/GardenTrees.tsx) loads the four GLBs and shared maps using Drei. Four instanced tree batches, each with a bark mesh and foliage mesh, reuse the assets across the avenue and outer groves. Only the nearest trees cast shadows; mobile omits foliage shadow casting. Matching leaf displacement is applied to the colour and depth materials, so the water reflection and shadows follow the animated canopy. The original procedural implementation lives in `OriginalGardenTrees.tsx` for comparison.

The four compressed models total about 1.3 MB, plus roughly 583 KB of shared textures before HTTP compression. The colour-map processing and material tints intentionally approach the original pale wood and sage palette. These are asset byte counts, not a frame-rate claim. Evaluate real-phone performance with water reflections and the comparison feature enabled before increasing density. Keeping both comparison groups mounted uses more memory than shipping one tree implementation alone.

## Verification

Type checks, production build, generated-asset tests, and the existing paper-boat geometry tests pass. Regenerating the assets produces identical bytes. Browser inspection covered the new materials and reflections at 1280 × 800 and 390 × 844; the comparison controls also fit at 375 × 667. Switching back and forth preserves the camera and scene, and advancing frame callbacks while paused leaves the wind clock unchanged. These checks do not measure physical-phone frame rate.

License and source attribution are in [`public/models/garden/ATTRIBUTION.md`](../public/models/garden/ATTRIBUTION.md).
