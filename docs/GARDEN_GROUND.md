# Garden ground and rock comparisons

The garden review toolbar now has three independent selectors:

- **Ground: Original / Leafy / Meadow**. Original preserves the rocky terrain and muted shader treatment. Leafy uses Poly Haven Leafy Grass, with fine vegetation, soil and leaf litter. Meadow uses ambientCG Grass 007 for fuller green groundcover. New materials repeat at a two-unit scale, use color/normal/roughness/AO maps and add subtle broad color variation. Bank shape and planting are shared across all three ground materials.
- **Rocks: Original / Mossy**. Original retains the procedural untextured stones. Mossy uses three simplified Poly Haven rock shapes with a shared color/normal/ARM atlas, partial burial and modest per-instance color variation at the same seeded sites. Both sets are loaded, but only the selected set renders.
- **Plants: Original / Varied**. Original retains the thin grass blades. Varied adds curved grass tufts, low clover-like leaves and small fern-like accents in uneven colonies, with most detail along the camera route. Both retain the small cream/pink flowers. Subtle grass sway respects Pause and reduced motion. Switching preserves the seeded planting, current camera progress and boats.

Defaults are **Meadow + Mossy + Varied**. The mobile/desktop view swap control has been removed; automatic viewport composition remains. Tree palette, pause and scene-only controls are retained. Material changes reuse the scene and preserve camera progress, boat state and river shape; both new ground palettes preload for immediate comparison. On phones, the three selectors sit above the three action buttons in a two-row toolbar.

The new rock variants contain 440, 200 and 660 triangles respectively, reused in three instanced batches. New textures are 1024 × 1024 WebP; all new comparison assets total approximately 3.4 MiB before HTTP compression, including both ground candidates. These asset counts do not establish phone performance. The comparison deliberately loads both alternatives; a final chosen palette can later omit unused files.

## Reproduce

```sh
pnpm prepare:garden-ground
node --test tests/gardenGroundAssets.test.mjs
```

The offline preparation script downloads original files to a temporary cache and creates normalized, simplified rock geometry plus shared maps. Its prune step explicitly retains UVs even though geometry-only GLBs refer to externally loaded textures. The asset regression check covers that mapping contract, base placement and per-rock geometry bounds.

Source credits, licenses and conventions are in [the asset attribution](../public/models/garden/ground/ATTRIBUTION.md). The earlier investigation is in [GROUND_ASSET_RESEARCH.md](GROUND_ASSET_RESEARCH.md). No source assets or generators are fetched at runtime.

## Reuse the plants

[gardenPlantGeometry.ts](../src/components/garden/gardenPlantGeometry.ts) exports `plantGeometry(kind)` and `plantSites(kind, width, mobile)` for `grass`, `clover` and `fern`. These are deterministic, code-generated meshes with no image or model downloads. [GardenPlants.tsx](../src/components/garden/GardenPlants.tsx) renders them in three instanced batches with per-instance tint, ground placement and a shared wind recipe. Plant meshes receive tree shadows but do not cast additional shadows.

Desktop uses 2,100 grass tufts, 950 clover patches and 160 fern accents; portrait composition reduces these to 1,450 / 650 / 100. Their geometry totals 255,440 triangles per pass on desktop and 173,600 in portrait, excluding the retained flowers. Water reflections render an additional pass. These are geometry budgets, not measured physical-phone frame rates.

```sh
node --test tests/gardenPlants.test.mjs
```

The plant checks cover repeatable sites, ground height, footprints staying outside the winding water in both compositions, valid mesh attributes and the portrait triangle budget. Browser checks cover the comparison switch preserving scene/plant identity, pause/resume, reduced motion, viewport resizing and the two-row toolbar at 320 × 568.

## Verification

All six Ground/Rocks combinations were exercised in the browser while paused. The selected materials and rock visibility changed correctly, with no shader compile errors; terrain mesh/geometry identity, camera position and the launched boat were preserved. Desktop and mobile previews were inspected, including a 320 × 568 layout check for toolbar, footer and photo-panel separation. Asset regression tests, existing tree/boat tests, type checking and the production build pass. Regenerating all eleven generated geometry/texture/manifest files produces identical bytes. These are browser and asset checks, not physical-phone frame-rate measurements.
