# Glossary

Jargon you'll hit in this project, defined in terms of *where it actually appears
here* rather than generically. Ordered by topic, not alphabetically — related
terms are easier to learn together.

If you're an experienced web dev with no 3D background, the sections that will
feel most alien are **Textures & materials** and **Shaders**. Everything else has
a close analogue in DOM or Canvas work.

---

## Geometry

| Term | Meaning |
|---|---|
| **Mesh** | A renderable object = geometry + material. `<mesh>` in R3F. |
| **Geometry** | The shape: a list of **vertices** plus how they connect. No colour or lighting. |
| **Vertex** | A point in 3D space. Carries **attributes** — position, normal, UV, and any custom ones (this project adds `aCenter`, `aOffset`, `aTangent`, `aBinormal`, `aU`, `aV`). |
| **Attribute** | Per-vertex data, uploaded to the GPU as a **buffer**. Readable in the **vertex shader**. |
| **Face / tri / quad** | A polygon. GPUs only draw triangles; Blender lets you work in quads and triangulates on export. |
| **N-gon** | A face with >4 sides. Fine in Blender, triangulates unpredictably — avoid on anything that will deform. |
| **Topology** | How faces are arranged. "Good topology" = evenly sized quads that deform cleanly. |
| **Indices / index buffer** | A list saying "make a triangle from vertices 4, 7, 9". Lets vertices be shared between faces instead of duplicated. |
| **Tessellation / segments** | How finely a shape is subdivided. The rope uses 1400 segments *along* its length (the wave needs them) and only 8 *around* (a **normal map** supplies that detail). |
| **Normal** (vector) | The direction a surface faces. Drives all lighting. Not the same thing as a **normal map** — see below. |
| **Winding order** | Whether a triangle's vertices go clockwise or not. Determines which side is the front face. |
| **Backface culling** | Skipping triangles facing away from the camera. The silk sets `side: DoubleSide` to disable it, because a ribbon is visible from both sides. |
| **Z-fighting** | Two surfaces at almost the same depth flickering against each other. Fix by offsetting them slightly — why the photo plane sits `0.06` in front of the backing panel. |

## Curves

| Term | Meaning |
|---|---|
| **Curve** | A smooth path through 3D space. The whole experience is built on three of them: rope, silk, camera. |
| **Control point** | A point the curve passes through (or near). `curves.ts` samples 240 of them per strand. |
| **Catmull–Rom** | A curve type that passes *through* all its control points. Used here because sampled positions should be exact. |
| **Bezier** | A curve type with pull-handles that it does *not* pass through. What Blender's curve tools use. |
| **Parameter `t`** | Position along a curve, 0→1. In this project one scroll value *is* `t`, and everything derives from it. |
| **`getPointAt` vs `getPoint`** | `getPointAt` is **arc-length parameterised** — equal `t` steps give equal *distance*. `getPoint` doesn't, so it bunches up in tight corners. Always want `At` here. |
| **Tangent** | Direction the curve is heading at a point. |
| **Binormal** | A direction perpendicular to the tangent — the "sideways" of the curve. Used to sweep the silk ribbon and to rebuild **normals** in the shader. |
| **Frenet frame** | A tangent/normal/binormal set computed along a curve. Deliberately *not* used for the silk: it twists unpredictably through inflection points and would barrel-roll the ribbon. A fixed world-up reference is used instead. |
| **Sweep / extrude along path** | Dragging a 2D cross-section along a curve to make a 3D solid. A circle swept = the rope tube. A line swept = the silk ribbon. |
| **TubeGeometry** | three.js's built-in circle-sweep. Used for the rope. |

## Textures & materials

| Term | Meaning |
|---|---|
| **Texture** | An image mapped onto a surface. |
| **UV / UV unwrap** | The 2D coordinates telling each vertex which part of the texture it gets. "Unwrapping" = flattening a 3D model into 2D, like a papercraft net. `u` and `v` are just the 2D axes. |
| **`repeat`** | How many times a texture tiles across a surface. **The single most important setting on the rope** — it sets the physical size of the fibre twist. |
| **PBR** | Physically Based Rendering. A standard set of texture maps that behave consistently under any lighting. Poly Haven materials are PBR. |
| **Albedo / base colour / diffuse** | The flat colour of a surface with no lighting information in it. A photo of rope in sunlight is *not* an albedo map — it has shadows baked in. |
| **Normal map** | An image where RGB encodes a *direction*, faking surface bumps without adding geometry. This is how the rope gets fibre detail with only 8 segments around. **Tangent space** normal maps (bluish-purple) are relative to the surface and are what you want; object-space ones are not interchangeable. |
| **Roughness** | How blurry reflections are. 0 = mirror, 1 = chalk. Rope ~0.9, silk ~0.6. |
| **Metalness** | Whether a surface is metal. Almost always 0 or 1, never in between. The grommets are 0.6 only because they're painted metal. |
| **AO (ambient occlusion)** | A map darkening crevices where light struggles to reach. |
| **Sheen** | A three.js material term specifically for *fabric* — a soft retroreflective rim at grazing angles. It's what makes cloth read as cloth rather than painted plastic. Used on the silk. |
| **Transmission / subsurface** | Light passing *through* a material. Expensive. Deliberately avoided — **sheen** gets most of the silk look for a fraction of the cost. |
| **Alpha map** | A texture controlling transparency. The dust motes use one to be round instead of square. |
| **Colour space / sRGB** | Colour textures must be tagged `SRGBColorSpace`; data textures (normal, roughness) must **not** be, or they'll be gamma-corrected and wrong. |
| **Tone mapping** | Squashing bright values into displayable range. `toneMapped={false}` on the photos keeps them at their true values. |
| **Anisotropy** | A texture *filtering* setting that keeps surfaces sharp when viewed at a steep angle. Unrelated to anisotropic materials. |
| **Baking** | Pre-computing something expensive (lighting, AO, a normal map) into a texture. Cheaper at runtime and often better-looking than real-time. |

## Lighting

| Term | Meaning |
|---|---|
| **HDRI** | A 360° photograph with brightness values beyond 0–1, used to light a scene realistically. |
| **IBL (image-based lighting)** | Lighting a scene *from* an HDRI, so surfaces reflect a real environment. Biggest single quality win available here. |
| **Environment map** | The HDRI as three.js consumes it. drei's `<Environment>`. |
| **Key / fill light** | Key = the main directional light. Fill = a dimmer one from the opposite side so shadows aren't black. Both present in `Scene.tsx`. |
| **Fog** | Fading distant objects toward a colour. **Not optional here** — without depth cueing, billboards read as sprites pasted on a flat background rather than objects in space. |
| **Depth cueing** | Any visual signal conveying distance: fog, scale, overlap, focus. |

## Shaders

| Term | Meaning |
|---|---|
| **Shader** | A small program running on the GPU, once per vertex or once per pixel. Written in **GLSL**. |
| **GLSL** | The shading language. C-like, no memory allocation, runs massively in parallel. |
| **Vertex shader** | Runs per **vertex**, decides where it lands on screen. All the strand undulation happens here. |
| **Fragment shader** | Runs per pixel, decides its colour. Untouched in this project. |
| **Uniform** | A value constant across a whole draw, set from JS. `uTime`, `uAmp`, `uVel` are uniforms — this is how scroll velocity reaches the GPU. |
| **Varying** | A value computed per-vertex and interpolated across the triangle for the fragment shader. |
| **`onBeforeCompile`** | A three.js escape hatch to inject custom GLSL into a *built-in* material, keeping all its PBR lighting. How `strandMaterial.ts` adds displacement without writing a full material from scratch. |
| **`#include <begin_vertex>`** | A three.js shader chunk marker. Injection works by string-replacing these. If a marker name is wrong the replace silently does nothing and you get a static mesh with no error — worth knowing when debugging. |
| **Displacement** | Moving vertices in the shader. Free compared to rebuilding geometry on the CPU, which would mean a **buffer** re-upload every frame. |
| **WebGL / WebGPU** | The browser graphics APIs. WebGL is universal; WebGPU is faster and now widely available. three.js supports both. |

## Rendering & performance

| Term | Meaning |
|---|---|
| **Draw call** | One instruction to the GPU to draw something. Lots of draw calls is a common bottleneck. |
| **Instancing** | Drawing many copies of one mesh in a single **draw call**, each with its own transform. The right answer for ~18 identical frames. |
| **Frustum culling** | Skipping objects outside the camera's view. Disabled on the strands (`frustumCulled={false}`) because their **bounding box** is computed pre-displacement and would cull them incorrectly. |
| **Bounding box / sphere** | A cheap volume enclosing a mesh, used for culling and hit-testing. |
| **FOV** | Field of view, in degrees. 48 here. Higher = wider and more distorted. |
| **Near / far plane** | The depth range the camera renders. Anything outside is invisible. `0.1` to `700`. |
| **DPR (device pixel ratio)** | Render resolution multiplier. Capped at 1.75 so retina phones don't render 3× the pixels for no visible gain. |
| **Size attenuation** | Whether points shrink with distance. On for the dust — which is why motes near the lens ballooned before they were kept away from the camera path. |
| **LOD** | Level of detail: swapping simpler geometry at distance. Not needed at this scale. |

## Files & pipeline

| Term | Meaning |
|---|---|
| **glTF / GLB** | The standard 3D format for the web — "the JPEG of 3D". `.gltf` is JSON + separate files; `.glb` is one binary file. **Always export `.glb`.** |
| **Draco** | Geometry compression for glTF. Large wins on vertex-heavy models. |
| **Meshopt** | An alternative geometry compression, faster to decode than Draco. |
| **KTX2 / Basis** | Compressed texture formats that stay compressed *in GPU memory*, unlike JPEG/PNG which decompress to raw pixels. Matters more than file size for memory. |
| **gltf-transform** | The CLI that applies all of the above. |
| **Apply transforms** | In Blender, baking an object's position/rotation/scale into its vertex data. Skip it and three.js inherits surprising transforms. |
| **Object origin** | The pivot a model rotates about. Set deliberately — the frame's origin belongs at the top centre so the pendulum swings from where the cords attach. |
| **Modifier** | A non-destructive Blender operation (Bevel, Mirror, Subdivision). Applied at export time. |
| **Decimate** | Reducing polygon count. Useful after converting curves to mesh. |
| **Z-up vs Y-up** | Blender treats Z as up; glTF and three.js treat Y as up. The exporter converts — don't add rotations to compensate. |

---

## One naming collision worth flagging

In this project **"billboard"** means *a photograph hanging from a strand* — the
roadside-sign metaphor.

In three.js and computer graphics generally, **"billboarding"** means *a flat
object that always rotates to face the camera*. drei even has a `<Billboard>`
component that does exactly that.

Our billboards deliberately do **not** billboard in the graphics sense. They're
oriented once, with **yaw** only, toward where the camera will be when the reader
arrives — because a frame that pitches to track the camera reads as broken rather
than as depth.
