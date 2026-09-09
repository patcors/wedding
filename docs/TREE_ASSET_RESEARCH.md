# Polished trees for the Garden

Researched 9 September 2026. This is a source review and an implementation recommendation, not a runtime benchmark. No tree implementation was changed.

## Recommendation

Use authored tree assets for the closest four trees, keeping simpler trees in the distance. Start with two or three variants and judge them under the Garden's actual camera, lighting, fog, and water reflections before replacing the entire grove.

The two most practical approaches are:

1. **Closest to the reference: export trees from FloraSynth, then prepare them for the web.** Its browser product advertises OBJ and glTF export. Author the forms once, optimize their geometry and textures, and load the resulting assets into the existing scene. There is no need to recreate a growth simulator merely to display convincing mature trees. The listed browser export subscription is $8/month; the page gives inconsistent developer prices, so no developer price is quoted here. [FloraSynth purchase](https://www.florasynth.com/purchase)
2. **Best open-source fit: EZ-Tree.** It is already built for Three.js and supports both direct procedural generation and an editor-to-GLB workflow. Start by preparing a few attractive variants, then decide whether to ship exported assets or the generator. This is my preferred free first experiment. [EZ-Tree repository](https://github.com/dgreenheck/ez-tree), [live editor](https://www.eztree.dev/)

These are different production workflows; neither alone guarantees the reference's finish. Silhouette, foliage arrangement, materials, lighting, and distant detail all need to work together.

## What FloraSynth is doing differently

FloraSynth's thickness model considers living, photosynthesizing growth downstream of a branch, and can prioritize growth receiving more light. That is a useful explanation for the convincing relationship between large limbs and the smaller branches they support. [Thickness documentation](https://www.florasynth.com/docs/thickness)

Its update notes explicitly discuss the geometry cost of finer twigs and a `thinBranches` control that removes terminal branches without changing foliage. The same notes acknowledge limitations in weeping forms and possible texture work after export. Its own workflow therefore includes the same visual-detail and export tradeoffs we would need to manage here. [FloraSynth v2.5](https://www.florasynth.com/blog/Florasynth_v2.5_Heavy_Upgrades)

## Open-source and asset options

| Option | Verified capability and licensing | Fit for this project |
| --- | --- | --- |
| **EZ-Tree** | JavaScript/Three.js generator; browser editor exports GLB and PNG. The current repository documents wind updates and distance-based LOD generation, plus raw branch/leaf geometry access. [Repository](https://github.com/dgreenheck/ez-tree). Code is [MIT](https://github.com/dgreenheck/ez-tree/blob/main/LICENSE). | Most direct runtime integration; also usable as an offline asset authoring tool. Retain the software notice when incorporating its code. |
| **Sapling Tree Gen** | Parametric Blender trees. It is now a separate extension offered with limited support; the listed extension targets Blender 4.4+. [Extension page](https://extensions.blender.org/add-ons/sapling-tree-gen/). The Blender manual identifies its code license as GPL. [Manual](https://docs.blender.org/manual/de/4.0/addons/add_curve/sapling.html). | Good free offline starting point. Requires material authoring and conversion/export work; not a browser library. |
| **MTree, maintained Blender fork** | Node-based procedural trees, crown controls, gravity, and geometry-node leaves. Blender 4.3+; add-on GPLv3, core library MIT. Its tested wind-data export targets Unreal Engine 5. [GoodPie repository](https://github.com/GoodPie/modular_tree). | More structural control than a basic generator, but a Blender production workflow. Do not assume its Unreal wind shader carries into Three.js. |
| **tree-gen, by friggog** | Blender generator; code GPL-3.0. The README separately permits generated models except direct sale as assets. [Repository](https://github.com/friggog/tree-gen). | Another free authoring option, but confirm compatibility with the chosen Blender version. Not my first choice given the more direct EZ-Tree path. |
| **Poly Haven trees** | Ready-made assets under [CC0](https://polyhaven.com/license). [Island Tree 01](https://polyhaven.com/a/island_tree_01) offers glTF, bark and leaf maps, and is tagged for LODs. Its page lists 4M triangles and a 338.5 MB download at the displayed settings. | Good source for a realistic hero tree or materials. Those displayed source figures are not a measured optimized web payload; inspect the available LODs and prepare a smaller asset before shipping. |
| **The Grove** | Commercial tree authoring software for Blender/Houdini; its [Indie purchase page](https://www.thegrove3d.com/downloads/the-grove-independent/) offers a paid purchase. | A paid alternative if natural growth and artist control justify a separate tool. It is not presented here as an open-source alternative or as a ready-made web runtime. |

There are multiple unrelated tools called MTree and TreeGen. The table links the precise projects assessed; for example, the [Unity MTree repository](https://github.com/Warwlock/MTree) is an MIT Unity tool, separate from the Blender fork, and would add an unnecessary engine conversion step here.

EZ-Tree's current package manifest declares a Three.js peer dependency of `>=0.167`; this project's Three.js `0.185.1` satisfies that declared range. That is not evidence that every shader hook works with the installed release. Pin the selected package/version and test it in the actual scene. Repository-main LOD documentation may also be newer than a published package, so verify the selected artifact's API before implementation. [Package manifest](https://github.com/dgreenheck/ez-tree/blob/main/package.json)

## What the current code suggests

The following are local code observations rather than claims about an external tool:

- [`treeGeometry`](../src/components/garden/gardenGeometry.ts) builds recursive tubes, tapering each segment by 96%. Child radii use fixed multipliers of the parent's initial radius, rather than the radius at their attachment point. This can make attachments look mechanically assembled and disproportionately thick.
- `mergeGeometries` combines those separate tubes into one geometry; it does not construct blended branch junctions. Adding more tube segments would smooth curves without fixing those junctions.
- Leaves are repeated simple meshes placed with random offsets near terminal branches. [`Trees`](../src/components/garden/GardenScene.tsx) then gives them random rotations and colors with an untextured material. This provides variation but little botanical organization or fine leaf detail.
- The scene already reuses three tree geometries and has simpler distant trees. That is a useful structure to keep. Water reflections also render scene detail, so evaluate tree costs with reflections enabled.

## Proposed asset and rendering pipeline

This is an engineering proposal, not a set of measured performance claims:

1. Replace only the nearest four trees with two or three variants. Favor asymmetric crowns, visible gaps showing sky, convincing major forks, and smaller coherent sprays of foliage. Keep the Garden's muted green palette.
2. Use textured leaf clusters or a small shared atlas for middle-distance foliage, with branch and bark detail concentrated where the camera can see it. Test subtle leaf backlighting and gentle wind in the actual Garden lighting. A detailed geometry replacement with flat foliage shading will still fall short.
3. Export compatible meshes and PBR materials to GLB, reusing materials and textures across variants. Blender supports GLB/glTF export, but arbitrary Blender shader setups do not automatically become equivalent web materials. Its glTF documentation describes supported material channels and the requirement to convert non-mesh data such as curves. [Blender glTF manual](https://docs.blender.org/manual/en/3.0/addons/import_export/scene_gltf2.html?highlight=gltf)
4. Prepare simpler distance variants and use them for outer groves. Consider silhouette impostors only far away; moving along the river still requires enough parallax for nearby trees. Keep alpha-cutout foliage visually clean and inspect shadows and reflections for artifacts.
5. Measure transferred bytes, decoded geometry/texture memory, draw calls, and frame time on desktop and a representative phone. Compare the whole scene with water reflections enabled. Tune texture sizes, foliage coverage, shadows, and LOD switching from those results; there is no evidence yet for a reliable triangle budget or frame-rate guarantee.

The first reviewable result should be a comparison of one exported FloraSynth tree or one EZ-Tree variant beside the current tree, viewed from the same Garden camera. If it works visually, extend that approach to the avenue and then optimize the distant grove.

## Could we improve our own generator instead?

Yes. A plausible design would build a branch graph first, estimate supported foliage below each junction, and then calculate radii from the tips back toward the trunk. That would be a pipe-model-inspired approximation, not a reproduction of FloraSynth's simulator. It would also need connected junction meshing, more deliberate canopy clustering, and bark/leaf textures. This offers complete control but introduces substantial geometry and art-direction work. For a wedding scene with a small number of recurring tree forms, I would first spend that effort selecting and integrating existing generated assets.

## Validation limits

The FloraSynth homepage visual and thickness documentation were inspected in the browser. The hosted EZ-Tree demo stalled at 15% loading in the available preview, so its suitability here is based on its primary documentation and source, not a successful scene integration or a verified visual/performance comparison. No models were imported or benchmarked during this research.
