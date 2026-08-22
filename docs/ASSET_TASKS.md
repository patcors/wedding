# Asset tasks, in the order to do them

Everything the scroll experience needs that **isn't** code, sequenced so each task
unblocks the next. Jargon in **bold** is defined in [GLOSSARY.md](./GLOSSARY.md).

The scaffold runs today with grey-box placeholders generated at runtime
(`src/components/story/placeholder.ts`). Every task below replaces one of them.
Nothing here is blocking — you can work on the code in any order — but the
sequence is roughly cheapest-and-most-visible first.

**Time budget guidance:** tasks 1–4 are the ones that actually make the site look
good, and task 1 is by far the biggest. Task 8 is the only genuinely hard
modelling job left, and it can be deferred to the very end or faked — task 6
turned out not to need Blender at all.

---

## Software you'll need

| Tool | For | Cost |
|---|---|---|
| **Blender** | The knot (task 8), baking textures | Free |
| [Poly Haven](https://polyhaven.com) | Rope/fabric **textures**, **HDRI** lighting | Free, CC0 |
| `@gltf-transform/cli` | Compressing models (**Draco**, **KTX2**) | Free, npm |
| Whatever you edit photos in | Curating and exporting the photographs | — |

Install the compression CLI when you get to task 9:

```bash
pnpm add -D @gltf-transform/cli
```

---

## 1. Curate the photographs — *do this first*

Not a 3D task, and by far the largest one. It is also the only task that can't
be parallelised or outsourced, and everything else is decoration around it.

**Target:** ~15 shared photographs plus 2–3 per guest.

Resist going bigger. At ~15 shared the scroll is already long; every extra
billboard is one more thing nobody reaches. See the note at the top of
`src/components/story/billboards.ts`.

**Export settings:**
- Longest edge **1600px**. They're seen at an angle, at distance, in fog — more
  resolution is wasted bytes.
- Save as `.jpg` into `public/photos/`. Astro's `sharp` pipeline handles
  conversion to **WebP/AVIF** at build time.
- **Portrait 3:4 crops.** The aperture is 4.5 × 6.0 world units (`PHOTO_W` /
  `PHOTO_H` in `frameGeometry.ts`); the mat overlaps it by 0.05 all round. Every
  frame is portrait — crop landscape originals rather than expecting the frame to
  adapt.

**Why portrait, since it's counterintuitive:** three.js `fov` is the *vertical*
angle, and horizontal falls out of the canvas aspect. On a phone held upright
that leaves ~23° horizontal against 48° vertical, so the old 3:2 landscape frame
spanned 31° — wider than the screen — while filling under half its height.

**Two traps in this specific batch:**
- `.heif` won't decode in the `sharp` pipeline without libheif. Convert to
  `.jpg` first.
- Phone photos carry EXIF rotation. `20191122_191734.jpg` is stored 4032 × 3024
  with an orientation flag that displays it portrait, so if you resize with
  `sharp` without calling `.rotate()` the flag is dropped and it comes out
  sideways. `magick` bakes orientation in by default; `sharp` does not.

Then fill in `photo:` fields in `sharedBillboards` and write the real
`personalBillboards` entries. Delete `fallbackFor()` once real personal content
exists — a generic line is worse than no line.

---

## 2. Rope textures — **done**

Using TextureCan `fabrics_0066` (mis-categorised; it is twisted rope), 1K.
Installed in `public/textures/rope/` as `color.jpg`, `roughness.jpg`,
`normal-8.png`, and — temporarily — `normal-16.png`.

Three maps are wired up in `Strands.tsx` via `useTexture`: `map`, `normalMap`,
`roughnessMap`. The `ao` and `height` maps that came in the zip are unused. AO
is skipped because three.js reads it from a second UV set that `TubeGeometry`
doesn't provide, and at this tiling its crevices are sub-pixel anyway; `height`
would need orders of magnitude more geometry.

Three things that were easy to get wrong:

- **`repeat` is the setting that matters, and the tile's aspect ratio
  constrains it.** This tile is a square of ~26 cords twisted at ~45°, so `u`
  and `v` must stay proportional to the tube's real dimensions or the twist
  angle shears. Arc length ≈ 470, circumference = 2π × 0.62 ≈ 3.9 — a ratio of
  ~120:1. Hence `(120, 1)`. **`v` must be a whole number**, or the circumference
  wrap leaves a seam down the whole rope. `(240, 2)` is the same twist angle at
  half the fibre scale. The old placeholder `(260, 3)` is wrong for this texture.
- **`color: '#ffffff'` and `roughness: 1.0`.** Both multiply their maps, so the
  previous `#b9a37e` / `0.92` would have double-applied.
- **Use `normal_opengl`, never `normal_direct`** — the DirectX variant has an
  inverted green channel and lights inside-out.

`useTexture` suspends, so `StoryCanvas.tsx` now has a `<Suspense>` boundary
inside the `<Canvas>`.

### The strand lay — why the rope is not just a textured tube

First look at the real texture showed the rope reading as "an octagon with a
picture painted on it". Two distinct causes, and only one of them was the texture:

1. **`radialSegments` was 8.** A normal map changes shading, never silhouette,
   so the outline stayed an octagon however good the map was. Now 24.
2. **All the fibre lived in the normal map.** Normal maps are convincing until
   the eye checks the outline, which on a rope it does constantly, because a
   rope's outline is *supposed* to be lumpy.

So `ropeLay()` in `strandMaterial.ts` now bulges the tube radius in and out with
6 helical strands — real geometry, on the silhouette. The two scales layer rather
than compete, which is also physically how rope works: a cable-laid rope is a
few large strands, each spun from many fine yarns. Strands are geometry; the ~26
yarns stay in the normal map.

**The strand count cannot be matched to the yarn count, and shouldn't be.**
Measured live in the browser at 2800 × 24: 3–6 ridges are clean, 8 is borderline,
10 aliases into a crawling knurled mesh, 17 is unusable. 6 was chosen by eye — 3
reads as a chunky cable, 6 as properly laid rope.

Getting to 1-to-1 with the texture would mean 26 ridges, because `repeat.y` of 1
puts all ~26 of the tile's cords around the circumference. Since the ridge's
along-length frequency is `strands × turns`, 26 needs ~14,000 tubular segments and
~150 radial to resolve — millions of vertices. Not available, and not worth it:
the point of the layering is that the eye reads strands *and* yarns, which it
cannot do if they are the same frequency.

The lay pitch is `ROPE_LAY_TURNS = ROPE_REPEAT.x`, and that identity is not a
coincidence — both are (arc length / circumference), the pitch that puts a helix
at 45°, which is the angle the texture's yarns already run at.

**This is what set the tessellation, not the wave.** A 45° helix crosses any
longitudinal line ~360 times over the length, so 1400 tubular segments gave under
4 per crossing and the strands aliased into a shimmer. 2800 gives ~8. Combined
with 24 radial that is ~70k verts, 4× the old count — still small for one hero
mesh, but it is the reason for the increase. If it needs to come down, reduce
`uLayTurns` (a shallower lay needs fewer segments) before reducing segments.

Both `uLayAmp` and `normalScale` are live sliders in the debug panel (`lay` and
`nrm`). Setting `lay` to 0 gives back the plain tube for comparison. Hard-code
the values you settle on and delete the knobs.

### Still outstanding: the lighting

Task 4 below is now the biggest remaining factor in whether this material reads
as real. The scene is lit by a hemisphere light plus two directionals, and a
broad ambient is the one lighting setup that makes *any* normal map look painted
on — bump only reads when light arrives from somewhere specific. IBL from an HDRI
is the fix, and it is a handful of lines.

### Bit depth — temporary A/B, delete when settled

TextureCan's normal map is a 16-bit RGBA PNG: **6.44 MB**. Converted to 8-bit
RGB with alpha dropped it is **1.73 MB**:

```bash
magick fabrics_0066_normal_opengl_1k.png -depth 8 -alpha off -strip normal-8.png
```

The debug panel has an `8-bit`/`16-bit` toggle so this can be judged by eye.
Expect **no difference at all** — three's `TextureLoader` decodes via an
`HTMLImageElement`, so the browser hands WebGL 8 bits per channel whatever the
PNG held, and `texture.type` is `UnsignedByteType` on upload regardless. The
extra precision is discarded before anything is drawn.

To remove: delete `src/components/story/debugTextures.ts`,
`public/textures/rope/normal-16.png`, and the blocks marked `DEBUG` in
`Strands.tsx` and `Scrubber.tsx`.

Further compression is available if 1.73 MB proves too heavy — a lossless WebP
is typically ~40% smaller again, and **KTX2** (see task 9) stays compressed in
GPU memory, which matters more than file size. Don't reach for JPEG: its
artifacts on a normal map produce visible blotching.

---

## 3. Silk textures

Same idea, gentler. You want a fine woven fabric **normal map** — subtle, much
lower amplitude than the rope. Silk's character comes from **sheen** (already
configured in `Strands.tsx`) and from how light rakes across it, not from bump.

If a real silk texture is hard to find, silk with *no* normal map at all looks
better than silk with too strong a one.

---

## 4. Environment lighting — **done, and no HDRI needed**

`StudioEnvironment` in `Scene.tsx` gives real **IBL** without an asset file.
drei's `<Environment>` renders its children to an off-screen cubemap, so the
light sources are `<Lightformer>` geometry: a large warm key softbox high and
right, a cool rim from behind left, and a dim overhead strip, inside a dark
blue-grey shell matched to the fog. `frames={1}` bakes it once;
`resolution={128}` is ample because it is only ever integrated over a surface,
never seen directly (`background` is left off, so the fog still owns the void).

This suits the project better than sourcing an HDRI: the light rig is code, so it
can be tuned by editing numbers rather than by hunting for a different `.hdr`.

**The hemisphere light had to go**, and it was the main culprit behind "the
texture is just painted on". A broad ambient lights every fibre from every
direction at once, and bump only reads when light arrives from somewhere
specific. One directional key is retained at 1.8 on top of the IBL, because the
crisp highlight that reads as *fibre* still wants a point source.

### Keep the key light LOW — the rule that matters most here

A normal map's contrast is proportional to how **grazing** the light is. Shading
is N·L, so when L already points along N, tilting the normal a few degrees
barely changes N·L and the bump vanishes.

The first version of this rig had the key at `[18, 26, 12]` — high overhead. On a
roughly horizontal rope that hits the top square-on, so the tube's underside
showed crisp strands while the top was a flat pale band. The lumpy silhouette was
still there, which is what made it look like two different materials.

Both the key softbox and the directional light now sit near camera height
(`y ≈ 6–7`) so they rake *along* the tube. The overhead Lightformer dropped from
1.4 to 0.45 — enough to lift the top edge off the void, not enough to flatten it
— and a low fill was added opposite the key so the underside is not the only
surface getting rake.

If the rope ever looks washed out again, check the key's elevation before
touching `normalScale` or `uLayAmp`.

Verified in the browser: the rope reads as rope. Judge `uLayAmp` with this
lighting in place, not without it — the two changes compound.

---

## 5. Blender: learn just enough

Before modelling anything, do Blender Guru's **"Donut" tutorial** on YouTube —
but only far enough to be comfortable with:

- Viewport navigation (orbit, pan, zoom)
- Object vs Edit mode
- Extrude, bevel, loop cut
- The **modifier** stack (especially **Mirror**)
- **Object origin**, and why `Apply → All Transforms` matters before export

You can stop before the shading, lighting and rendering chapters. You are not
rendering in Blender — three.js does that. You need Blender purely as a mesh
editor and exporter.

Two conventions to internalise now, because they cause most first-export pain:

1. **Blender is Z-up, glTF is Y-up.** The glTF exporter converts automatically —
   just don't fight it or add your own rotations.
2. **1 Blender unit = 1 world unit here.** The frame should be modelled ~7.2
   units wide. Apply scale before exporting or three.js inherits the transform.

---

## 6. The billboard frame — **done, in code rather than Blender**

`src/components/story/frameGeometry.ts` builds the frame at runtime: a bevelled
moulding, a cream mat board with the aperture cut out of it, and a dark backing
panel. Outer size 5.8 × 7.3 × 0.2, aperture 4.5 × 6.0 portrait.

**Why not Blender.** A picture frame is one of the very few props that is
*entirely* describable as "rectangle with a rectangular hole, bevelled" — which
is exactly what `THREE.Shape` + `ExtrudeGeometry` produce, bevel included. A
downloaded `.glb` arrives with its own scale, its own aperture ratio and its own
materials to reconcile, for the same silhouette at this distance and in this fog.
So this task turned out not to need the Blender detour; task 8 still does.

Two things that were easy to get wrong:

- **The bevel changes the dimensions.** `ExtrudeGeometry` grows the outer contour
  outward by `bevelSize`, shrinks holes inward by the same, and adds
  `bevelThickness` to each end of the extrusion. Every dimension in
  `buildMoulding()` is pre-shrunk by exactly what the bevel adds back, so the
  finished part measures its nominal size. Skip that and you get a frame
  mysteriously 0.09 too wide.
- **Geometries and materials are module-level singletons.** ~18 billboards share
  one set, so the frame is a handful of draw calls total. This is most of what
  `<Instances>` would have bought, without the wiring.

**The cords are gone.** The two cylinders that ran from the strand to the
frame's top corners, and the grommets they threaded through, are deleted. They
were the least convincing thing in the scene: five-sided cylinders read as facets
at that distance, and straight cords cannot bend the way the frame's pendulum
implies they should, so the frame appeared to pivot while its cords stayed rigid.
The frame now hangs clear of the strand with nothing drawn between them, which
reads as suspension perfectly well. `DROP` in `Billboard.tsx` keeps the frame's
centre at the same -6.5 the old cord-plus-frame stack put it, so the camera
framing did not need retuning.

**If you do want a modelled frame later** — an ornate carved moulding, say,
which the extrude cannot do — the seam is small: load it with `useGLTF` and
replace the two `<mesh>` elements for the moulding and mat in `Billboard.tsx`.
The model must be portrait, `+Y` up, 1 Blender unit = 1 world unit, transforms
applied, origin at the frame's centre, and its aperture must be 4.5 × 6.0 or
`PHOTO_W` / `PHOTO_H` need to change to match. Model it portrait rather than
scaling one frame per billboard: non-uniform scale turns a uniform bevel radius
elliptical, which is the exact "sharp edges read as fake" problem the bevel
exists to avoid.

---

## 7. Fix the captions

Currently captions are drawn to a canvas and used as a texture — self-contained,
but soft and not selectable.

Pick a typeface, self-host it in `public/fonts/`, and swap `captionTexture()` for
drei's `<Text font="/fonts/…">`. That gives crisp **SDF** text that still fades
correctly with the scene **fog** — which a DOM overlay would not.

Keep captions short and facing the camera squarely. Oblique floating text is the
classic failure of this whole genre.

---

## 8. Blender: the knot — *the hard one, do it last*

Right now the strands run parallel to the end and stop at a flat cut. The
intended ending is a sailor's knot tying the rope and the silk together.

This is the only genuinely difficult model in the project. Two approaches:

**Option A — Blender curves (recommended).** Model the knot as a **Bezier curve**
path, then give it a circular **bevel** profile to thicken it into rope. Do the
same with a flat rectangular profile for the silk. Convert to mesh, decimate,
export. You are essentially drawing the knot's centreline in 3D rather than
sculpting it — far more tractable, and it matches how the strands are built in
code.

**Option B — fake it.** Have both strands run off into fog/light and never show
the knot. Put the venue, the date and the RSVP link at the end instead. This is
a perfectly good ending and costs nothing. Decide honestly whether the knot is
worth the weeks — the site is not worse without it.

Either way, the end of the scroll still needs its payoff: **16 April 2027,
Jasper's Berry, and the RSVP.** That's a code task, but it's the actual point of
the site, so don't leave it until last.

---

## 9. Compress everything

Once real models and textures exist, before deploying:

```bash
# Geometry compression + texture transcoding
pnpm gltf-transform optimize public/models/frame.glb public/models/frame.opt.glb \
  --compress draco --texture-compress ktx2
```

**Budget check.** A bare spinning cube already costs ~1.1MB of uncompressed JS
in this project. Your guests will open this once, on a phone, possibly on hotel
wifi. Targets:

- Total JS: keep under ~400KB gzipped
- Total images: under ~4MB for the whole scroll
- Load photographs progressively in a window around the current scroll position,
  not all upfront — **this is the main engineering problem left in the project**
  and it's worth solving before adding more content.

---

## 10. Before it goes out

- Remove or `import.meta.env.DEV`-gate the `<Scrubber />` in `StoryCanvas.tsx`
- Test on a real mid-range phone, not a desktop window scaled down
- Add a static fallback for no-WebGL / reduced-motion
- `prefers-reduced-motion`: freeze the strand undulation, keep the scroll
