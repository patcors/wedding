# Garden proof of concept

Question: does the bright garden direction work with Patrick and Amelia's wedding content?

Run `pnpm dev` and open `/garden` at the port printed by Astro. The current review server is on port 4322. This is an isolated, noindex prototype on the existing working branch; review is pending, so no design decision has been promoted to the live invitation.

The study includes real planar water reflections with animated normal-map ripples, distance fog, textured shaped banks, stones and plants, procedural branching trees with instanced leaves, and gently drifting curved petals. Scroll or use the three chapter buttons to see the opening, a five-photo album and the invitation. The invitation links open the existing invitation-code route.

## Study 02 — mobile composition and more memories

The user liked the first direction and asked for visible trees on phones, a tree-lined desktop distance, more photographs and restrained falling leaves. This revision keeps the garden direction and changes its staging:

- Portrait screens use a narrower waterway, trees placed nearer the view, a wider vertical field of view and a shorter camera journey. Terrain, plants and roots all share the revised shoreline; tree shapes retain their proportions.
- Staggered outer groves fill the sides of the desktop horizon. Distant trees use simpler geometry; portrait has fewer outer trees and avoids foliage shadow rendering. Reflection resolution is 512px, shadow maps 1024px and pixel ratio capped at 1.25.
- The five existing photographs appear as an album, with neighbouring photos peeking from behind the current one. Vertical scrolling advances the album; arrows, dots, keyboard arrows and horizontal swipes also work. Vertical swipes remain available for page scrolling.
- Eighteen small olive/gold leaves fall beside the banks. The original petal population drops from 100 to 45, so the total moving population is lower. Pause and reduced motion cover both.
- Soft, local pale backgrounds behind the phone heading and story copy preserve readability as trees pass behind them.

The first direction is positively received; this revision is ready for another visual review. No production promotion is implied by that feedback.

Use **Pause motion** to hold the camera, water, petals and falling leaves. The canvas renders on demand while paused. **Scene only** hides the wedding copy for inspecting the composition. Reduced-motion preferences keep the camera at the opening and stop decorative animation. There is no audio.

The implementation lives in `src/components/garden/` and `src/pages/garden.astro`. These are throwaway study files. There is one design direction, as requested, rather than unrelated layout alternatives. Assets and their sources are recorded in [ATTRIBUTION.md](../public/textures/garden/ATTRIBUTION.md).

Review limitations: trees are procedural studies rather than final botanical models; photo and narrative selection are provisional; this is a short camera route rather than the full personalized story. Desktop and portrait browser checks do not establish performance on a physical phone. The new route includes its 3D bundle and approximately 2.5 MB of terrain/water maps. Finish asset optimization and actual-device profiling after the visual direction is chosen.

Validation: `pnpm astro check` completed with zero errors and two existing hints in the older story/invitation code; `pnpm build` passed. Local Chromium checks covered 1440 × 900 and 390 × 844 layouts, chapter controls, motion pause, scene-only visibility, invitation link destination and reduced-motion behavior. No runtime errors were reported and the portrait layout had no horizontal overflow. The shared preview's screenshot/animation callbacks were unreliable, so screenshots were inspected through local Chromium instead.

Study 02 verification also covered 375 × 667, all five decoded photos, gallery button navigation, a simulated horizontal touch swipe, keyboard navigation and album/footer separation. Mobile opening and end compositions were inspected by advancing the actual scene frame callbacks in local Chromium; the camera stays above the water at y=5.4 while travelling from z=27 to z=19. The leaf matrices move downward during those callbacks and remain unchanged when paused. This verifies the staging and animation controls, not physical-phone frame rate. Build and type checks pass with the same two existing hints.

Before promoting any of this to the live site, capture the user's verdict here, retain this study on its working branch, and implement the chosen direction in the production flow.

## Paper boats

Tap or click exposed stream water to launch a small ivory origami boat at that point. It bobs gently downstream toward the distance, with a faint wake and a path that stays inside the banks. Boats fade after 48 seconds of animation; at most four remain in the scene. The footer's **Float a paper boat** button provides keyboard access. Pause and reduced motion hold boats still, and vertical touch scrolling remains available without launching a boat.

Verification: local Chromium confirmed mobile water taps, desktop clicks, bank and mouse-drag rejection, keyboard activation, native touch scrolling without launching, the four-boat limit, downstream movement, pause/reduced-motion behavior and eventual removal. Animation checks advanced the scene's frame callbacks and do not measure physical-phone performance. `pnpm astro check` passed with the same two existing hints; `pnpm build` passed with its existing large-chunk warning.

## Polaroid transition correction

The original album changed a photo's z-index immediately while its position animated for 650 ms. A browser reproduction caught the incoming side photo above the centre on the first transition frame, still 70 px off centre on mobile. Holding the old layer order removed that jump. The album now uses three fixed card positions with permanent stacking order and a 450 ms crossfade between their contents. Images and captions remain mounted, so rapid changes reverse the fades without swapping image sources or moving hidden cards across the stack. Reduced motion disables the fade.

Verification sampled 44 transition states each at 390 px and 1440 px, covering forward/back navigation, all photo dots, wraparound, interrupted fades and scroll-driven selection. The centre remained above both side cards, the selected dot matched the visible photo, exactly one photo was exposed to accessibility tools, and there was no horizontal overflow. Reduced motion produced no album transitions. Type checks and the build passed with the existing hints/warning.

## Wooden sailboat variation

Each launch (water tap or the **Float a boat** button) independently selects a wooden sailboat with probability 0.45, a toy tugboat with probability 0.05, or a paper boat with probability 0.50. The selection is stored on the launch, so rendering, pausing, and tree-palette changes cannot reroll it. The pale timber hull with a recessed interior, forward mast, minimal rigging, and single ivory mainsail are generated by `woodenSailboatGeometry.ts` and use the existing drift, spin, bob, fade, and ripple loop. The sail has one ivory colour and a subdivided curved surface with shared smooth normals to avoid visible triangle seams. The wooden model is scaled to 80% of its first version to match the smaller toy-boat reference. All three types share the four-boat limit and remain seated in the water.

The toy tugboat is generated by `tugboatGeometry.ts`: grey and red hull, timber deck, cream wheelhouse and railings, dark windows, and a red funnel with a black cap. It uses the same motion and ripples as the other boats.

## Mobile river shoreline

The review toolbar now offers independent Ground, Rocks and Plants comparisons alongside the tree palette and motion controls. Varied plants add curved grass tufts, low clover-like groundcover and fern-like accents, retaining the small flowers. The previous mobile/desktop view swap has been removed. See [GARDEN_GROUND.md](GARDEN_GROUND.md) for options and the reusable asset and plant geometry recipes.

Portrait layouts use the same winding shoreline and rough bank heights as desktop, at a fixed width scale of 0.45 (50% wider than the original mobile scale of 0.30). Perspective provides the natural taper into the distance. Banks, tree roots, plants, boat paths, and ripples all share this width. There is no camera-based width calculation or straightened foreground; the exact screen coverage varies naturally across phones and along the camera journey.

Mobile now shares the desktop camera height (3.2), aim (target height 2.5), and full journey (z=18 to z=-10.5), with a wider 68° vertical field of view instead of desktop’s 48°. This preserves the viewpoint and horizon as the camera moves. It uses ordinary perspective, keeping straight trunks straight. The mobile shoreline and tree arrangement remain adapted for portrait screens. The camera covers 28.5 units, giving 50% more downstream travel per scroll than the previous 19-unit route, while the page length and chapter timing stay the same.

Camera verification covered 390 × 844 and 375 × 667 compositions across the opening, story, and celebration, plus layout checks at 430 × 932. Swapping the view while paused changes the lens from 68° to 48° without changing camera position or aim. Type checking and the build pass with the existing hint and chunk-size warning.

The river now has a gentle lateral meander, plus slightly larger broad and local indentations along its banks. Terrain, bank details, avenue trees, water hit testing, boat launches, drift, and wakes share the same centre line, so the moving boats follow the bends. The camera remains on its existing route.
