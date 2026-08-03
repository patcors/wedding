# Asset tasks, in the order to do them

Everything the scroll experience needs that **isn't** code, sequenced so each task
unblocks the next. Jargon in **bold** is defined in [GLOSSARY.md](./GLOSSARY.md).

The scaffold runs today with grey-box placeholders generated at runtime
(`src/components/story/placeholder.ts`). Every task below replaces one of them.
Nothing here is blocking — you can work on the code in any order — but the
sequence is roughly cheapest-and-most-visible first.

**Time budget guidance:** tasks 1–4 are the ones that actually make the site look
good. Tasks 5–7 are real Blender work but small. Task 8 is the only genuinely
hard modelling job, and it can be deferred to the very end or faked.

---

## Software you'll need

| Tool | For | Cost |
|---|---|---|
| **Blender** | The frame model, the knot, baking textures | Free |
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
- Landscape crops. The frame is 7.2 × 5.0 world units, roughly 3:2.

Then fill in `photo:` fields in `sharedBillboards` and write the real
`personalBillboards` entries. Delete `fallbackFor()` once real personal content
exists — a generic line is worse than no line.

---

## 2. Rope textures

The biggest single visual upgrade for the least work, and no modelling.

Download a rope or twisted-fibre material from Poly Haven. You want three maps:

- **albedo** (aka base colour / diffuse) — the colour, with no lighting baked in
- **normal map** — the fibre bumps. **Tangent space**, not object space.
- **roughness** — where it's matte vs sheen

Drop them in `public/textures/rope/`, then in `src/components/story/Strands.tsx`
replace `proceduralRopeNormal()` with real `useTexture` loads and set
`map` / `normalMap` / `roughnessMap`.

**The critical setting is `repeat`.** The rope is ~420 units long and ~0.6 units
thick, so the texture must tile far more along its length than around its
circumference. The placeholder uses `repeat.set(260, 3)`. Start near that and
tune until the fibre twist looks the right physical size — this single number is
the difference between "rope" and "corrugated hose".

---

## 3. Silk textures

Same idea, gentler. You want a fine woven fabric **normal map** — subtle, much
lower amplitude than the rope. Silk's character comes from **sheen** (already
configured in `Strands.tsx`) and from how light rakes across it, not from bump.

If a real silk texture is hard to find, silk with *no* normal map at all looks
better than silk with too strong a one.

---

## 4. HDRI environment lighting

Currently the scene uses three hand-placed lights. Swapping to an **HDRI** with
**IBL** is a handful of lines and makes both materials look dramatically more
real — particularly the silk sheen and the metal grommets, which need something
in the environment to reflect.

Grab a dim studio or dusk HDRI from Poly Haven (`.hdr`, 2k is plenty), then in
`Scene.tsx` add drei's `<Environment files="..." />`. Keep the directional light
as a key light; drop the hemisphere light.

Use a **low-resolution** HDRI. It's only providing ambient light, never seen
directly — 2k is generous, 4k is waste.

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

## 6. Blender: the billboard frame

Your first real model, and a genuinely beginner-level one.

**What to build:** a rectangular picture frame, 7.2 × 5.0 units, ~0.15 deep,
with a slight **bevel** on the outer edges and two **grommets** (metal eyelets)
at the top corners.

**How:**
1. Add a cube, scale to 7.2 × 5.0 × 0.15, `Apply → All Transforms`.
2. **Inset** the front face, delete it — that's the aperture the photo shows through.
3. **Bevel** the outer edges lightly. Sharp 90° edges read as fake because real
   objects always have some edge radius to catch light.
4. Add a **torus** for a grommet at one top corner; use a **Mirror** modifier
   across X for the other. Keep it low-poly — 12 segments is plenty.
5. Set the **origin** at the point the cords attach (top centre), so the
   pendulum in `Billboard.tsx` rotates about the right pivot.
6. Export as **glTF** (`.glb`) to `public/models/frame.glb`. In the exporter:
   include only the selected object, `+Y up`, and enable Draco compression if
   offered.

Then in `Billboard.tsx`, replace the placeholder `<boxGeometry>` + `<torusGeometry>`
with a `useGLTF` load. Keep the photo as a separate plane inset slightly behind
the aperture.

**Reuse it properly:** ~18 frames all sharing one model is exactly what
**instancing** is for. drei's `<Instances>` / `<Instance>` collapses them into a
single **draw call**. Not urgent at this count, but it's free once the model is a
single mesh.

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
