# Richer ground and natural rocks for the Garden

Researched 9 September 2026. This is a primary-source review and staged implementation recommendation, not a runtime benchmark. No scene implementation was changed for this research.

## Recommendation

Keep the existing river landscape and improve the layers that make it feel alive: a finer grass-and-soil surface, coherent patches of varied groundcover, and a small reusable collection of textured rocks. Aim for a soft, lush garden with weathered stone; shiny rocks and a uniformly dense lawn would change the atmosphere.

The best first experiment is **one new ground material and three textured rock variants on the nearest banks**, compared with the current scene from the same camera. Add richer grass clusters after establishing the surface palette and scale. This recommendation is an engineering/art-direction judgment based on the local implementation and the asset capabilities below; no imported candidate has yet been benchmarked in the Garden.

## What the current implementation is doing

These are local code observations, not external claims:

- The existing ground already uses a CC0 material: **Rocky Terrain 02**, with 1024 × 1024 base-color, normal and roughness maps. It is a rocky surface rather than a grassy foundation. See [local attribution](../public/textures/garden/ATTRIBUTION.md) and [source asset](https://polyhaven.com/a/rocky_terrain_02).
- [`bankGeometry`](../src/components/garden/gardenGeometry.ts) sets UVs to `x / 16, z / 16`: one tile covers 16 scene units. A small physical grass swatch substituted at this scale would look enlarged. Establish scale first; higher texture resolution alone would not correct enlarged blades or stones.
- [`Banks`](../src/components/garden/GardenScene.tsx) desaturates the ground color by 65%, then blends it 30% toward olive, in addition to multiplying vertex colors. This intentionally muted treatment is another reason a richer source may still appear dull.
- `BankDetails` places 7,000 untextured, curved single-plane grass blades in clusters across 126 scene units. Every cluster draws on the same blade shape, with static color, height and rotation variation. There are 1,500 small flower meshes as a separate batch.
- All 260 stones reuse one deformed `IcosahedronGeometry(1, 2)`. Their normals are already smoothed; UVs are deleted, and their material has no color, normal or roughness texture. Repetition and missing surface variation are more immediate limitations than faceted shading.
- The two banks contain 32,400 triangles each. The scene's reflecting water renders landscape detail again. More ground tessellation or an indiscriminately larger grass population should therefore follow measurement, not precede it.

Instantiating the current geometries with the installed Three.js version confirms 180 triangles per rock (46,800 across 260 instances) and eight per grass blade (56,000 across 7,000 instances). Together with the banks' 64,800 triangles, these are authored geometry totals before culling and additional rendering passes, not measurements of GPU frame cost.

## Concrete reusable assets

The listed descriptions, formats and source sizes are verified from the linked first-party asset pages. Suitability is a proposal. Displayed source triangle counts and download totals are **not** optimized browser payloads.

| Candidate | Verified characteristics | Proposed Garden use |
| --- | --- | --- |
| [Poly Haven Leafy Grass](https://polyhaven.com/a/leafy_grass) | Grass with scattered leaves/twigs; 2 m swatch; color, GL normal, roughness, AO, packed ARM, height and mask maps; resolutions from 1K. | First base-material candidate. The leaf detail fits the grove; preview at small scale to avoid a visibly trampled lawn. |
| [ambientCG Grass 007](https://ambientcg.com/view?id=Grass007) | PBR material tagged grass, lawn, moss and weeds; made procedurally with bitmap elements; 1K–8K downloads. It is not described as a photoscan. | Alternative greener foundation if Leafy Grass looks too littered. Select by appearance under the existing lighting, not by scan versus procedural provenance. |
| [Poly Haven Forest Ground 01](https://polyhaven.com/a/forrest_ground_01) | 2 m swatch of litter, dry grass, twigs and mossy soil; color, GL normal, roughness, AO and height maps. The URL intentionally spells `forrest`. | Secondary patches below trees and around larger stones. Using it everywhere could make the scene look drier. |
| [Poly Haven Rock Moss Set 01](https://polyhaven.com/a/rock_moss_set_01) | Six weathered rock silhouettes; glTF available; color, normal, roughness and AO maps; page lists 63K triangles for the source set. | Preferred ready-made rock starting point. Extract two or three sympathetic shapes, reduce geometry where needed and reuse textures. Inspect the shapes before assuming they resemble rounded river pebbles. |
| [Poly Haven Rock Moss Set 02](https://polyhaven.com/a/rock_moss_set_02) | Another textured rock collection; glTF, GL normals and packed ARM available; source listing shows 58K triangles. | Backup set if the first collection is too angular or lacks the desired proportions. |
| [Poly Haven River Small Rocks](https://polyhaven.com/a/river_small_rocks) | Ground texture of mixed stones and soil; 2.9 m tall swatch; color, GL normal, roughness, AO and height maps. | A narrow gravel transition at the water edge. This is a surface texture, not individual rock geometry; do not wrap many pictured pebbles around one large stone. |
| [Poly Haven Grass Medium 01](https://polyhaven.com/a/grass_medium_01) | Tuft asset with glTF, alpha and normal maps, dry-color alternative and LOD tag; source listing shows approximately 2M triangles. | Authoring/reference source for a few simplified tuft variants. Inspect the available geometry and LODs before export; do not repeat the whole source arrangement across the riverbanks. |

Poly Haven makes its downloadable textures and models available under CC0, including redistribution in projects. ambientCG also provides assets under CC0 and explicitly permits including raw files. This makes both suitable for reusable assets committed to this repository. Preserve the existing attribution convention and record source URLs, selected maps, source dimensions and conversion commands for reproducibility. Website graphics have separate treatment: Poly Haven excludes example renders from the asset license, while ambientCG explicitly includes material previews. Link asset pages in documentation rather than assuming all website imagery is redistributable. [Poly Haven license](https://polyhaven.com/license), [ambientCG license](https://docs.ambientcg.com/license/)

## Ranked implementation plan

The following steps are proposals for this project, not measured performance claims.

### 1. Fix the foundation and its scale

Start with Leafy Grass or Grass 007 using color, normal and roughness maps. Reduce the blanket desaturation while preserving the restrained green palette. Make fine leaf/blade detail repeat at an appropriate scene scale, and add a much broader, subtle color variation so distant ground does not become an obvious tiled carpet. The two scales serve different purposes: fine surface detail and larger patches of growth.

Blend grass into sparse earthy or gravel patches using distance from the winding bank plus low-frequency noise. The same mask should influence plant density. This avoids a random grass field laid over an unrelated ground image. Begin with two material layers at most; extra layers add shader work and asset memory. If runtime blending proves expensive on phones, bake the patch mask or combined surface offline.

Use normal maps for fine relief first. Poly Haven's model standards specifically distinguish silhouette-changing geometry from small details that can be represented by normals. Reserve geometry changes for visible bank shape, shallow hummocks and rock outlines. A flat material cannot provide blade silhouettes, regardless of texture resolution. [Poly Haven model standards](https://docs.polyhaven.com/en/technical-standards/models)

### 2. Replace the most conspicuous rocks

Preferred route: prepare three variants from a textured rock set, export compact GLBs, and instance each variant. Retain the baked color/normal/roughness relationship when simplifying geometry; inspect normal-map artifacts after large reductions. Vary orientation and size modestly, partially bury stones, and place larger rocks among smaller companions rather than evenly distributing them. Use the existing `groundHeight`, `riverCenter` and `bankEdge` for grounding and shoreline alignment.

Alternative route: keep procedural rock generation, create several flatter and rounder shapes, restore sensible UVs and apply a stone material. This offers exact silhouette control and a reusable generator, but matching UVs, seams and fine surface detail takes more work. Triplanar mapping is a possible UV-free fallback, with additional texture sampling and care required for normals. Imported UV-mapped assets are the more direct first trial.

Interpret “polished” as convincing detail and integration. Keep most surfaces matte, with gentle roughness variation; add a darker, slightly smoother strip only near the water if useful. A universal gloss or clearcoat would make the stones feel coated. Small shadow/contact cues and restrained moss should connect rocks to the ground.

### 3. Build lushness through varied clusters

Replace the repeated grass silhouette with two or three small tuft forms and a low broad-leaf/clover form. Concentrate them on the banks visible along the camera route, leave irregular small gaps, and let low groundcover bridge those gaps. Denser near-camera clusters can give more apparent richness without filling the whole landscape with additional geometry.

Keep instancing: Three.js documents its benefit as reducing draw calls when sharing geometry and material. Use smaller or simpler variants into the distance and avoid large overlapping transparent cards. If cutout atlases are used, trim them tightly around useful foliage and compare their GPU cost with small opaque blade meshes on a phone. `alphaTest` can cut out empty pixels without ordinary blended transparency; `alphaToCoverage` requires MSAA. [Three.js InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html), [Three.js Material](https://threejs.org/docs/pages/Material.html)

Add only a slight shared wind motion with per-clump variation after the still scene looks convincing. Crossed grass-cluster cards and vertex-shader wind are established approaches described in NVIDIA's grass-rendering chapter. Its historical hardware figures are not a current mobile performance estimate. [NVIDIA GPU Gems, grass rendering](https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-7-rendering-countless-blades-waving-grass)

### 4. Integrate lighting and validate the whole journey

Review the surface with the current dark trees, pale text treatment, fog and reflection active. Fine normals need enough directional variation to read; strong uniform fill can wash out contact and shape. First tune existing light balance and local contact cues, including baked AO for rock crevices and restrained ground contact shading. The current scene has no environment map; a low-intensity environment-lighting trial may help rock materials, but should preserve the warm lighting and readable text. Do not assume a new full-screen ambient-occlusion effect, shadows on every grass blade or higher shadow resolution is required.

Compare fixed camera positions at the beginning, middle and end on desktop and portrait phones. Check that fine patterns do not shimmer, grass does not appear in water, rocks sit into the bank, and the invitation remains calm and legible. Measure added transferred bytes, decoded texture memory, draw calls, triangles and frame time with water reflections enabled. Start candidate textures at 1K, test 2K only where visible detail warrants it, and set final budgets from those measurements.

## Reusable asset preparation

Follow the existing tree-asset workflow: keep a script and small manifest in the repo, recording source, author, license, chosen files, resizing, texture packing and geometry processing. Commit the prepared runtime assets and the recipe needed to reproduce them. Store large original downloads outside the served `public` tree.

Poly Haven's conventions provide `diff`, `nor_gl`, `rough` and `ao`; its generated `arm` map packs ambient occlusion, roughness and metallic information. Download only the channels the runtime will use. Blender-specific procedural or scatter setups require preparation into supported meshes/materials; a glTF download option is not evidence that every source procedural behavior transfers to this renderer. [Poly Haven model standards](https://docs.polyhaven.com/en/technical-standards/models)

For runtime texture memory, evaluate KTX2/Basis compression after visual selection. Three.js can transcode supported KTX2/Basis payloads to GPU formats, and its loader requires `detectSupport(renderer)` before loading. Smaller JPEG/WebP download files alone do not establish a corresponding reduction in GPU texture memory. Inspect compressed normals and fine grass alpha edges rather than applying one encoding blindly to every map. [Three.js KTX2Loader](https://threejs.org/docs/pages/KTX2Loader.html)

Keep color maps in sRGB and normal/roughness/AO maps as non-color data. Use GL-convention normals, and select the UV channel matching the prepared asset. Three.js exposes channel selection through `Texture.channel`; the local renderer respects that choice for AO too. Existing procedural rocks have no UVs, so a conventional mapped material requires restoring them or explicitly implementing another projection. [Three.js MeshStandardMaterial](https://threejs.org/docs/pages/MeshStandardMaterial.html), [Three.js Texture](https://threejs.org/docs/pages/Texture.html)

## Validation limits

The local implementation and primary asset descriptions, formats, map lists and licensing pages were inspected. No candidate model was downloaded, imported, optimized or benchmarked. Some direct CDN requests returned HTTP 403, so the asset shortlist is not a verified visual comparison of rendered models. In particular, the mossy rock collections require inspection to choose suitably gentle, rounded silhouettes. The proposed first bank comparison is the next step that resolves those visual and mobile-performance uncertainties.
