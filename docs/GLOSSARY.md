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
| **Aliasing** | Detail finer than the sampling rate, showing up as a false pattern — shimmer, moiré, stair-steps. Applies to geometry, not just images: the strand lay crosses a longitudinal line ~360 times, so at 1400 tubular segments it aliased into a crawling shimmer. Rule of thumb: ~8 samples per feature. |
| **Lay** (rope) | The helical twist of a rope's strands, and by extension its pitch. "Lay length" is the distance along the rope for one full turn — typically ~4× the diameter, which is what puts the strands near 45°. |
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
| **Metalness** | Whether a surface is metal. Almost always 0 or 1, never in between. The frame moulding sits at 0.05 — timber, with just enough to catch the key light. |
| **AO (ambient occlusion)** | A map darkening crevices where light struggles to reach. |
| **Sheen** | A three.js material term specifically for *fabric* — a soft retroreflective rim at grazing angles. It's what makes cloth read as cloth rather than painted plastic. Used on the silk. |
| **Transmission / subsurface** | Light passing *through* a material. Expensive. Deliberately avoided — **sheen** gets most of the silk look for a fraction of the cost. |
| **Alpha map** | A texture controlling transparency. The dust motes use one to be round instead of square. |
| **Tileable / seamless** | A texture whose opposite edges match, so it can **repeat** without a visible join. An ornament map that isn't tileable shows a seam on every frame. |
| **Texture resolution (1K / 2K / 4K)** | Pixel dimensions — 2K means 2048×2048. Cost is quadratic: 2K is 4× the memory of 1K. Uncompressed, a 2K RGBA texture occupies ~16 MB of GPU memory no matter how small the PNG was. **KTX2** is the fix. |
| **Saturation** | How intense a hue is, independent of brightness. Convincing gold is *less* saturated than people expect; a saturated yellow reads as plastic. |
| **Bit depth** | Bits per channel. 8-bit gives 256 levels per channel and is what WebGL receives from any PNG or JPEG loaded through `TextureLoader` — the browser's image decoder flattens 16-bit sources on the way in. So a 16-bit normal map costs download size and delivers identical pixels. 16-bit only earns its keep for **displacement**, where banding shows, and only via a loader that bypasses the image path. |
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
| **Hemisphere light** | A cheap two-colour ambient: one colour from above, one from below. `Scene.tsx` uses sky-blue over warm brown. Being fake, it cannot be *reflected* by a metal. |
| **Analytic light** | Any light defined by maths rather than by an image — directional, point, spot, hemisphere. The current scene is analytic-only, which is why `metalness: 1` would render near-black: there's no environment for the metal to mirror. |
| **Specular highlight / hot spot** | The bright mirror-image of a light source on a surface. On a rough surface it's a soft patch; on polished metal it's a small hard dot. Gold lit *only* by analytic lights is those few dots and nothing else. |
| **Grazing / raking light** | Light arriving nearly parallel to a surface rather than square-on. **The single most important idea for making normal maps read.** Shading is N·L, so a light already pointing along the normal barely changes as the normal tilts — bump detail disappears. Raking light maximises that change. It is why the key lights in `Scene.tsx` sit near camera height instead of overhead. |
| **Lightformer** | A drei helper: a piece of emissive geometry rendered into an `<Environment>` cubemap, so it acts as a soft area light. How this project gets IBL with no `.hdr` file. |
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

## Frames & gilding

Decorative-arts vocabulary rather than graphics. Worth knowing because the venue
(Jasper's Berry) has ornate gold frames throughout, and the billboard frame is
meant to echo them — so the reference material and the tutorials you'll find are
all written in these words.

The load-bearing idea: **a frame's design is almost entirely its profile.** Get
the cross-section right and it reads as a gilt frame from across the room.
Ornament is the last 10%, and here it belongs in a **normal map**, not geometry.

| Term | Meaning |
|---|---|
| **Gilt / gilded** | Gold *leaf* laid over a non-gold base — usually wood and gesso — not solid gold. Relevant to the material: gilding is thin and slightly uneven, so it reads warmer and more broken up than machined metal. |
| **Gesso** | The chalky white primer under the gold leaf. Carved *into* on good frames, which is where fine ornament detail comes from. |
| **Moulding** | The long shaped strip a frame is built from. In the real world you buy it and cut it to length; here it's one **profile** swept around a rectangle. |
| **Profile / cross-section** | The 2D shape you'd see if you sawed through the moulding. Draw it once in Blender, **sweep** it around a rectangle, and you have a frame. |
| **Cove** | A concave scoop in a profile. Traps a dark band of shadow. |
| **Ogee** | An S-curve — convex flowing into concave. The most common classical frame profile. |
| **Fillet** | A small flat or rounded step separating two larger elements. Reads as a crisp highlight line. Stacking these is what makes a frame look expensive. |
| **Bevel / chamfer** | A flat angled cut across an edge. Also the name of the Blender **modifier** that produces them. |
| **Sight edge** | The innermost edge, the one touching the photograph. The single highest-value highlight line on the model — it's what separates photo from frame. |
| **Rabbet / rebate** | The step cut into the *back* of the sight edge that the artwork actually sits in. Invisible from the front; safe to omit. |
| **Mitre** | A corner joint where both pieces are cut at 45° so they meet cleanly. The thing to get right when sweeping a profile around a rectangle, versus four bars crudely overlapping. |
| **Ornament** | The decoration applied on top of the profile. Common motifs: **acanthus** (stylised leaf scrollwork — the standard baroque motif), **beading** (a row of small spheres), **egg-and-dart**, and **cartouche** or shell corners. |
| **Baroque / rococo** | The 17th–18th century styles that "ornate gold frame" almost always means. Heavy, deep-carved, rococo asymmetric. |
| **Antiqued / tarnished / distressed** | Deliberately dulled and darkened gilding, often with the base showing through on high points. What's wanted here — bright gold out-shouts the photographs. |
| **Burnished vs matt gilding** | Water gilding can be polished to near-mirror; oil gilding stays matt. Real frames carry both on one object, which is the justification for varying **roughness** across the model rather than using one flat value. |
| **Silhouette** | The object's outline against its background. The functional argument for a gilt frame here: the current dark panel (`#2b2723`) has effectively no silhouette against `#0d1117` fog, so photographs read as rectangles floating in nothing. |

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
