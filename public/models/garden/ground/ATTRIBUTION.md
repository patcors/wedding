# Garden ground and rocks

Prepared runtime assets are derived from these CC0 sources:

- `leafy_grass-*.webp`: **Leafy Grass**, Charlotte Baglioni / Poly Haven. https://polyhaven.com/a/leafy_grass
- `grass007-*.webp`: **Grass 007**, ambientCG / Lennart Demes. https://ambientcg.com/view?id=Grass007
- `moss-rocks.glb`, `rock_moss_set_01-*.webp`: **Rock Moss Set 01**, Kless Gyzen / Poly Haven. Source rocks 1, 3 and 5; simplified geometry, preserved UVs, normalized footprint and grounded origins. https://polyhaven.com/a/rock_moss_set_01

Licenses: https://polyhaven.com/license and https://docs.ambientcg.com/license/ . No website preview renders are included.

Run `pnpm prepare:garden-ground` from the repo root to reproduce these files. The recipe is `scripts/prepare-garden-ground.mjs`; it uses curl and unzip for downloads/extraction, Sharp for 1K WebP maps, and the pinned glTF Transform/Meshoptimizer dependencies for geometry preparation. Original downloads are cached in the system temporary directory under `wedding-ground-sources` (override with `GARDEN_ASSET_CACHE`).

Color maps use sRGB; normal maps use OpenGL convention; ARM packs ambient occlusion in red, roughness in green, metalness in blue. The renderer uses AO and roughness and keeps all surfaces non-metallic. Model UVs use glTF's texture orientation; terrain textures repeat at a two-scene-unit scale. `sources.json` records source and processing metadata.
