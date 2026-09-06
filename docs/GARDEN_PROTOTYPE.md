# Garden proof of concept

Question: does the bright garden direction work with Patrick and Amelia's wedding content?

Run `pnpm dev` and open `/garden` at the port printed by Astro. The current review server is on port 4322. This is an isolated, noindex prototype on the existing working branch; review is pending, so no design decision has been promoted to the live invitation.

The study includes real planar water reflections with animated normal-map ripples, distance fog, textured shaped banks, stones and plants, procedural branching trees with instanced leaves, and gently drifting curved petals. Scroll or use the three chapter buttons to see the opening, an existing photograph and the invitation. The invitation links open the existing invitation-code route.

Use **Pause motion** to hold the camera, water and petals. The canvas renders on demand while paused. **Scene only** hides the wedding copy for inspecting the composition. Reduced-motion preferences keep the camera at the opening and stop decorative animation. There is no audio.

The implementation lives in `src/components/garden/` and `src/pages/garden.astro`. These are throwaway study files. There is one design direction, as requested, rather than unrelated layout alternatives. Assets and their sources are recorded in [ATTRIBUTION.md](../public/textures/garden/ATTRIBUTION.md).

Review limitations: trees are procedural studies rather than final botanical models; photo and narrative selection are provisional; this is a short camera route rather than the full personalized story. Desktop and portrait browser checks do not establish performance on a physical phone. The new route includes its 3D bundle and approximately 2.5 MB of terrain/water maps. Finish asset optimization and actual-device profiling after the visual direction is chosen.

Validation: `pnpm astro check` completed with zero errors and two existing hints in the older story/invitation code; `pnpm build` passed. Local Chromium checks covered 1440 × 900 and 390 × 844 layouts, chapter controls, motion pause, scene-only visibility, invitation link destination and reduced-motion behavior. No runtime errors were reported and the portrait layout had no horizontal overflow. The shared preview's screenshot/animation callbacks were unreliable, so screenshots were inspected through local Chromium instead.

Before promoting any of this to the live site, capture the user's verdict here, retain this study on its working branch, and implement the chosen direction in the production flow.
