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

- `src/components/garden/journey.ts` is the single source of truth: milestones, key dates, the mapping from scroll progress to story time, and the route along the river. Boats, sky, eggs and the date label all read from it. Adding an egg means adding an entry and a component, nothing else.
- Scroll space is shared out by story, not by calendar time, so quiet years don't become long empty stretches.
- The story boats are kinematic: their positions are a function of scroll progress. They don't use `boatPhysics.ts`, which stays for the guest-launched "Float a boat" boats.
- Each part of the scene lives in its own component so it can be worked on without touching the others: the river world, the story boats, the sky and light, the Easter eggs, and the page copy and date label.
- **Reduced motion** (the operating-system setting for people who get motion sickness): instead of freezing at the opening, the scene shows a still view at each milestone and cuts between them, with no camera glide and no decorative animation.
- Phones are a first-class target. Check every change at a 390 × 844 portrait size as well as desktop.
