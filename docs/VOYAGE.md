# The Voyage (Garden story, proof of concept)

The Garden's middle chapter becomes a voyage down the river that tells Patrick and Amelia's story, replacing the photo album ("A lifetime of little moments"). The opening (names, date) and the ending ("Meet us in the garden") stay. Status: proof of concept on branch `voyage-poc`. Nothing here ships until Amelia says so.

## The story in scenery

Two small sailboats travel downstream as the guest scrolls. Words are minimal: the only running text is the month and year, shown where the photo album used to be. Everything else is told by scenery.

- **Amelia's boat:** the wooden sailboat (`woodenSailboatGeometry.ts`) in its wooden colour with soft teal highlights, flying a small "A" flag.
- **Patrick's boat:** the same sailboat in soft yellow, flying a small "P" flag.
- **Before they meet (before July 2017):** the river is split by a small island and thick reeds. Each boat is in its own channel and can't see the other.
- **July 2017, they meet:** the channels rejoin and the boats travel side by side from then on.
- **February 2021 – March 2023 (Amelia in Sydney):** the river widens and the boats drift further apart, still in sight. They come back alongside in March 2023.
- **August 2024, they start dating:** the boats come together. Over the following months the hulls grow long and slim and deck planks are laid one by one between them, until by the wedding they are one catamaran: two hulls, a shared deck, both flags flying.
- **The wedding (April 2027):** the river makes an S-bend. Coming round it reveals a massive old tree (the old tree at Jasper's Berry) with a small jetty beneath it. The catamaran docks there.
- **Dawn to dusk:** the whole journey runs through one day. The opening is at soft dawn, the middle is the Garden's existing misty daylight, and the dock is at dusk.

## Easter eggs

Each milestone gets one subtle piece of scenery that a guest is pleased to spot. Eggs are never explained in text. They may stay on screen longer than the true timeline as long as they *arrive* at the right moment. The proof of concept has one egg: the hot-air balloon. The others come in later iterations.

| Month | Milestone | Egg (later unless marked) |
| --- | --- | --- |
| 2017-07 | Met at university, both starting maths degrees | Artistic pi sculpture on the bank |
| 2017-11 | First trip away with friends, down the coast | |
| 2018-11 | Started their internship at FinoComp | |
| 2019-07 | Snow trip; Amelia broke her wrist snowboarding | |
| 2020-08 | Graduated university | |
| 2021-02 | Amelia moves to Sydney for two years | (boats drift apart: part of the boats, not an egg) |
| 2023-03 | Started working together at HeirWealth | (boats back alongside) |
| 2024-05 | Both bought apartments | |
| 2024-06 | Started living together | |
| 2024-08 | Started dating | (boats join: part of the boats) |
| 2025-08 | Snow trip | |
| 2026-01 | Started salsa classes | |
| 2026-04 | Got engaged | |
| 2026-07 | Turkey and Greece trip | **POC:** a hot-air balloon rises in the distance, tied to scroll |

Recurring, for later: a friends' trip down the coast every November/December until 2023; Amelia's circus show every October from 2023 to 2026, which Patrick attended.

## How it is built

All in `src/components/garden/`.

- **`journey.ts`** is the single source of truth, pure and tested (`tests/journey.test.mjs`): `MILESTONES` (`id`, `month`, `description` for screen readers, optional `egg` and `room`), `DATES`, and the chapters over scroll progress p ∈ [0, 1]: arrival `[0, .05)`, voyage `[.05, .92)`, dock `[.92, 1]` (`ARRIVAL_END`, `VOYAGE_END`, `CHAPTERS`, `chapterAt`). The boats are moored from `DOCKED` (.97).
  - `storyMonth(p)`: story time in months since January 2017, piecewise-linear. Scroll is shared out by story, not calendar: each milestone gets one share (`ROOM` of progress) up to the next, with more for the meeting, Sydney, dating and the last stretch round the bend. Each date holds for a third of its share so the label can be read. `progressAt(month)` is the inverse (when a date first shows), `dateLabel(p)` gives "July 2017" during the voyage and `null` outside it.
  - `since(month, p)`: story months since a date (stands still while a date holds). `scrolledSince(month, p)`: scroll since a date in shares, which keeps running; use it for scenery tied to scroll.
  - `routeAt(p)`: where the boats are, as z along the river (x is `riverCenter(z)`). They drift from z 6 to 4 under the title, travel steadily to −164 through the voyage, and glide to the jetty at −172. `routeAtMonth(month)` is where they are on a date. 178 units in all.
  - `stillProgress(p)`: the reduced-motion still for p (the opening, the latest milestone reached, or the dock).
- **`gardenGeometry.ts`** shapes the river. `VOYAGE` holds the scenery's positions (z falls downstream; `from` is upstream): the island (z 10 to just before the meeting at about −8.5), Sydney's widening (−57 to −68), the S-bend (−135 to −164, swinging the river 12 units to −x), the dock (z −172, jetty on the +x bank) and the old tree (z −175.5). `islandHalfWidth(z, width)` is the island's footprint and `channelOffset(z, width)` the middle of each channel beside it. `voyageLandmarks(width)` gives the jetty, the catamaran's mooring and the tree in world x/z. `RIVER_REACH` (z 26 to −260) is what's planted. Instances are batched by 20-unit stretch (`riverChunks`) and drawn only within the camera's reach (`useRiverReach`), so the longer river costs about what the old one did.
- **`JourneyProvider.tsx`** eases the scroll into `useJourney().progress` (the old damping) before any other frame callback; under reduced motion it jumps to `stillProgress`. Everything that moves with the story reads it in `useFrame`, so it moves with the camera, not the raw scroll. Slots get `SlotProps`: `paused` (guest pause or reduced motion: hold decorative animation), `reduced`, `mobile` and `width` (1, or `MOBILE_RIVER_WIDTH` on portrait).
- **`cameraRig.ts`** (pure, tested in `tests/cameraRig.test.mjs`) and **`VoyageCamera.tsx`**: the camera rides 12 behind the boats at the old height, looking 34 past them, turning through the bend only as far as keeps the boats within about 10° of the middle of the picture. Over the start of the dock chapter it settles on `dockView`, looking across at the jetty and tree. The camera's far plane now stops just past the fog.
- **`GardenScene.tsx`** is wiring only. The rest of the old file moved to `GardenWater.tsx` (water and guest-launched boats), `GardenBankDetails.tsx` and `GardenDrift.tsx` (petals and falling leaves).
- The story boats are kinematic: their positions are a function of progress. They don't use `boatPhysics.ts`, which stays for the guest-launched "Float a boat" boats.
- `Garden.tsx` maps its chapters to the journey's boundaries and `.garden-scroll-space` is 2000svh, about a screen per milestone. During the voyage the page shows only the date, high in the sky above the boats, and a quiet "The next chapter" link to the celebration. The date follows the scroll eased as the camera eases it, crossfades, and changes at most every 400ms while rolling. Screen readers hear each milestone's date and `description` from a polite status line once the guest settles on it (`milestoneAt`). The scroll cue and the ←/→ keys step through `STOPS`: the opening, each milestone halfway through its date's hold, and the celebration (`nextStop`, `previousStop`).
- Text over the sky takes its colours from custom properties GardenSky sets on `.garden-prototype`: `--garden-sky-glow` (the pale glows behind copy), `--garden-ink-on-sky` (text, with softer tints mixed from it) and `--garden-sky-top` (the top wash and the phone status-bar band). Unset, each falls back to the misty day's colour.
- **Reduced motion** (the operating-system setting for people who get motion sickness): instead of freezing at the opening, the camera cuts to a still view at each milestone, with no glide and no decorative animation.
- Phones are a first-class target. Check every change at a 390 × 844 portrait size as well as desktop.

## For agents

Each slot is mounted from `GardenScene.tsx`; nobody needs to edit that file. `journey.ts` and `gardenGeometry.ts` are shared, stable APIs: add to them, but don't change existing signatures or numbers without telling the others (tests pin the story order).

| Slot | Owner | Reads | May edit |
| --- | --- | --- | --- |
| `VoyageWorld.tsx` (island, reeds in the split, jetty, old tree, bend dressing) | world | `VOYAGE`, `islandHalfWidth`, `voyageLandmarks`, `RIVER_REACH` | `VoyageWorld.tsx`, new files it imports; dressing/perf in `GardenTrees.tsx`, `GardenPlants.tsx`, `gardenPlantGeometry.ts`, `GardenRocks.tsx`, `GardenBankDetails.tsx`, `GardenDrift.tsx`, `GardenGround.tsx`; the island's shape inside `islandHalfWidth` |
| `VoyageBoats.tsx` (the two boats, joining into a catamaran) | boats | `useJourney().progress`, `routeAt`, `since`, `DATES`, `DOCKED`/`VOYAGE_END`, `channelOffset`, `voyageLandmarks().mooring` | `VoyageBoats.tsx`, new boat geometry files |
| `GardenSky.tsx` (sky colour, dome, fog, lights, water tint; dawn to dusk) | sky | `useJourney().progress`, `chapterAt`, `routeAt` | `GardenSky.tsx`. It writes the shared `WaterTint` that `GardenWater` copies in each frame, so it never edits `GardenWater.tsx` |
| `eggs/` (one component per egg) | eggs | `EggProps` (`eggs/egg.ts`): `milestone` plus `SlotProps`; `useJourney().progress`, `scrolledSince`, `routeAtMonth` | `eggs/*`, and in `journey.ts` only the `EggId` union and a milestone's `egg` field |
| Page copy and date label | copy | `dateLabel`, `chapterAt`, `CHAPTERS`, `MILESTONES` | `Garden.tsx`, `garden.css` |

The slot stubs are placeholders that prove the contract: a flat island, a plank jetty and a ball-and-stick tree, two plain sailboats, and a plain balloon.
