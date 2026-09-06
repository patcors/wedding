# A bright garden journey for Patrick & Amelia

Design investigation, 6 September 2026. Proposed direction, ready to guide a first visual build; the application has not been redesigned yet.

## What I inspected

I opened [Valentime](https://valentime.noomoagency.com/), inspected its opening composition, entered the journey, and scrolled through the column-lined water and first statue scenes. Its loading overlay remained visible in the inspection browser; hiding that overlay locally exposed the running scene and allowed inspection. This was a desktop visual review, not a mobile performance test.

The water carries recognizable, rippled reflections. Near columns have shape and shading; further columns dissolve into a nearly white horizon. Uneven island edges, planted flowers and the waterline ground the sculptures. Red petals provide small, moving accents against a restrained background. The columns establish scale, frame the view and reveal camera movement. These are visual observations, not a complete reconstruction of the renderer. [Reference](https://valentime.noomoagency.com/)

Noomo's own [making-of article](https://noomoagency.com/insights/noomo-valentime-immersive-storytelling) confirms custom fog experiments, authored camera movement, modelled scenery, and deliberately placed petals with baked animation. The polish reflects composition and asset work as well as rendering technology.

## Recommended wedding interpretation

Build a luminous garden around a long reflecting pool: warm ivory sky, softly textured stone and earth, muted sage foliage, and occasional blush petals. A few tall trees frame the water. The camera moves gently towards a garden clearing where the invitation becomes the focus.

This should feel like an imagined garden for the wedding. It need not reproduce Jasper's Berry literally; any venue-specific trees or architecture should be chosen from actual venue references during asset selection.

| User preference | Proposed treatment | Visual check |
| --- | --- | --- |
| Reflective water | A calm pool occupying roughly the lower third of the opening view, with tree trunks and banks reflected in it. Small, slow ripples. | Reflections remain recognizable while moving; the water has something meaningful to reflect. |
| Faded background | Three depth layers: defined foreground, softened middle trees, almost vanished distant silhouettes. Fog and sky share a warm pale color. | The horizon disappears without losing the nearest bark, stones or photographs. |
| Brighter screen | Pale sky and ground, outdoor environment lighting, a soft directional key and deep olive/charcoal HTML text. | Light fills most of the image, but terrain still has visible shaded relief. |
| Real ground | Low, irregular banks with thickness, partly embedded rocks, small plants, visible roots and a darker damp edge at the pool. | No flat floating slabs, uniform green carpet or objects visibly hovering above the bank. |
| Petals in the sky | A few curved blush petals nearby, smaller distant clusters, slow sideways drift and unequal turning. Some petals settle visually on banks. | Petals remain visible when scrolling stops, stay clear of text and feel light rather than busy. |
| Pillars replaced by trees | Begin with three or four loose pairs of tall, slender trees. Use visible trunks, irregular branches and sparse foliage concentrated towards the upper corners. | Trunks frame the route and its reflection; crowns leave a bright central opening. |

The ground should be believable in shape and contact, while its colors remain quiet. Increasing texture contrast everywhere would fight the intended softness. Start with one coherent ground material and one tree family, then introduce subtle variation.

Trees are the largest visual uncertainty. Realistic, well-shaped models are worth more here than dozens of additional effects. Cylinder trunks with round foliage blobs will test spacing, but cannot establish the finished look. A sparse garden tree with pale bark and restrained green foliage is the starting direction; a fully pink blossom avenue would introduce a much stronger fantasy theme.

## How the wedding content fits

1. **Arrival:** Patrick & Amelia, 16 April 2027, Jasper's Berry. Names sit in the clear sky above the reflecting pool. An obvious invitation link remains available immediately.
2. **Our story:** A short forward glide through the trees reveals a few selected photographs and short captions in open spaces beside the water. Compose each stop around one main photograph, including guest-specific memories where available.
3. **The invitation:** The view opens into a clearing. Venue, date and the invitation/RSVP action become the clear destination. Practical information remains readable HTML with direct navigation.

For the first composition, let the garden, photographs and typography carry the scene. The current rope and silk can be reconsidered later as small personal details, such as a ribbon around a frame; their existing large weaving route would dominate this quieter setting.

Keep motion slow, maintain a stable horizon and leave pauses for reading. Compose a portrait version with trees pushed towards the outer edges and one photograph at a time. Provide a still garden view for reduced motion and a static fallback if 3D is unavailable.

## Build sequence

Start a separate `/garden` preview using the existing Astro/React/Three stack. Reuse guest/photo data and the persistent-canvas pattern. Give the garden its own camera path and scene components: the current 420-unit airborne route is tied to the rope-and-silk concept. [Current scene](../src/components/story/Scene.tsx), [camera curves](../src/components/story/curves.ts), [photo data](../src/components/story/billboards.ts).

The first milestone is **one convincing opening scene and a short camera move**. Include finished-quality water, one near tree, repeated distant trees, one realistic bank, petals and the real wedding heading. Review the composition both with motion paused and while moving. Resolve the lighting, reflections, tree silhouette and shoreline before extending the full story.

Acceptance criteria:

- The frame feels bright immediately, with readable names and no heavy canopy.
- The water visibly reflects the trees as the camera moves.
- The nearest ground looks solid; distant scenery gradually disappears.
- Petals are visibly shaped and drift gently without obscuring content.
- Desktop and portrait views preserve the same focal point.
- Reduced motion and direct access to invitation details work.
- Reflection and foliage costs have been measured on an actual phone before expanding the journey.

Detailed renderer options, source links and performance tradeoffs are in [the technical research](./VALENTIME_TECHNICAL_RESEARCH.md). The recommended first version fits the existing renderer; adopting Noomo's full WebGPU pipeline is a separate decision if later atmosphere experiments require it.
