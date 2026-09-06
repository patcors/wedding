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
