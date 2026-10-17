# The Voyage (Garden story, proof of concept)

The Garden's middle chapter becomes a voyage down the river that tells Patrick and Amelia's story, replacing the photo album ("A lifetime of little moments"). The opening (names, date) and the ending ("Meet us in the garden") stay. Status: proof of concept on branch `voyage-poc`. Nothing here ships until Amelia says so.

## The story in scenery

Two small sailboats travel downstream as the guest scrolls. Words are minimal: the only running text is the month and year, shown where the photo album used to be. Everything else is told by scenery.

- **Amelia's boat:** the wooden sailboat (`woodenSailboatGeometry.ts`) in its wooden colour with soft teal highlights, flying a small "A" flag.
- **Patrick's boat:** the same sailboat in soft yellow, flying a small "P" flag.
- **The opening:** under the title each boat is tied up at its own little jetty on the outer bank of its channel, Amelia's on the left and Patrick's on the right, lanterns still burning from the night. As the guest starts to scroll they let go their lines, ease their sails and pull out into their channels.
- **Before they meet (before July 2017):** the river is split by a small island and thick reeds. Each boat is in its own channel and can't see the other.
- **July 2017, they meet:** the channels rejoin and the boats travel side by side from then on.
- **February 2021 – March 2023 (Amelia in Sydney):** the river widens and the boats drift further apart, still in sight. They come back alongside in March 2023.
- **August 2024, they start dating:** the boats come together. Over the following months the hulls grow long and slim and deck planks are laid one by one between them, until just before their engagement they are one catamaran: two hulls and a shared deck.
- **April 2026, they get engaged:** the two small masts give way to one. Each boat furls its sail and brings its flag down, and its mast is lowered aft along its hull. While the date holds, one tall mast rises from the middle of the deck; its sail unrolls with their P&A monogram painted on it, and both flags are run up to its masthead, A to the left and P to the right. The catamaran sails on round the bend and docks under the one sail.
- **The wedding (April 2027):** the river makes an S-bend. Coming round it reveals a massive old tree (the old tree at Jasper's Berry) with a small jetty beneath it. The catamaran docks there.
- **Dawn to dusk:** the whole journey runs through one day. The opening is at soft dawn, the middle is the Garden's existing misty daylight, and the dock is at dusk.

## Easter eggs

Each milestone gets one subtle piece of scenery that a guest is pleased to spot. Eggs are never explained in text. They may stay on screen longer than the true timeline as long as they *arrive* at the right moment. Built so far: the π sculpture and rubber ducks (2017), and the hot-air balloon (2026).

| Month | Milestone | Egg (later unless **built**) |
| --- | --- | --- |
| 2017-07 | Met at university, both starting maths degrees | **A π sculpture on the bank; UOW's rubber ducks tossed into the river** |
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
| 2026-04 | Got engaged | (the two masts give way to one: part of the boats) |
| 2026-07 | Turkey and Greece trip | **A hot-air balloon rises over the river, tied to scroll** |

Recurring, for later: a friends' trip down the coast every November/December until 2023; Amelia's circus show every October from 2023 to 2026, which Patrick attended.

**The university** (`eggs/University.tsx`, placed and timed in `eggs/campus.ts`): a π in weathered bronze, three tapering pen-like strokes gone green where the rain sits, on a stone plinth (`eggs/piSculptureGeometry.ts`, about 1,100 triangles, one draw call, casts a shadow). It stands on the right bank at z −27, turned upstream, so it is small in the mist down the river as July 2017 shows, closest through the first year, and passed during 2018. And UOW's duck pond and its rubber duck races: while the date holds, four of the guests' rubber ducks (simplified to about 420 triangles each, one instanced draw call, plus one for the rings) are tossed one by one from behind the bank's grass a little ahead of the boats (the left bank; portrait's right, where Amelia's boat would hide them). Each arc plays out in real time once the scroll reaches it, so a duck never hangs in the air when the guest stops; it plops in with a ring on the water and drifts slowly downstream and out to its lane while the boats overtake it, gone once the camera has passed. Under reduced motion all four float just off the bank at the meeting's still.

**The balloon** (`eggs/Balloon.tsx`, its course in `eggs/balloonCourse.ts`, `eggs/balloonGeometry.ts`): a teardrop envelope of twelve gores in faded terracotta, cream, ochre and dusty teal, with a terracotta crown, a deep teal skirt, a small wicker basket on four ropes and a burner that flickers now and then. About 900 triangles in three draw calls. The banks' canopies close over the river everywhere but one patch of sky at the top of the picture, over the river's next bend just left of the date label, so the balloon keeps to it: 30 ahead over the water (27 in portrait), fixed in the picture so it never drifts into the leaves. It fades in at the patch's foot as July 2026 shows and climbs straight up and out of the top over the next share and a half (gone by about p .84). Under reduced motion it rests just risen at the July 2026 still.

### Adding an egg

The contract is the comment at the top of `eggs/egg.ts`; in short:

- **Register:** add its id to `EggId` and set `egg` on its milestone in `journey.ts`, and map the id to a component in `eggs/index.tsx`. Each egg gets `EggProps`: its `milestone` and the `SlotProps`.
- **Time:** `eggTime(milestone, progress, reduced, settled)` is scroll since the date first showed, in milestone shares (`scrolledSince`): negative before, running through the date's hold. Arrive at 0; linger as long as the story allows, and leave before the dock.
- **Place:** the trees close over the river, so the only open sky is up its corridor, and portrait sees only about 17° either side of the middle. For something in the air, `inView(p, width, { distance, bearing, height, from, follow })` gives a spot relative to the camera (degrees right of the middle; `follow` below 1 lets it lag the camera's turn, as distant things do), `overRiver` keeps it over the water, clear of the trees, and `heightAt(distance, elevation)` turns degrees above the eye line into a height. Place it nearer than it looks and scale it down rather than truly far, where the canopies would hide it. Keep clear of the date label at the top centre; through the bend the only open sky is just left of it (see the balloon). Something on a bank can use a fixed world spot from `riverCenter`/`bankEdge` at `routeAtMonth(month)`.
- **Motion:** hold idle animation while `paused` (set for reduced motion too). Under `reduced` the camera cuts to each milestone's still, where `eggTime` returns `settled`: show the egg at rest there.
- **Budget:** one to three draw calls and well under 1,500 triangles, built once and disposed, no shadows, and `visible = false` outside its window. For comparison the scene draws about 2.7 to 4 million triangles a frame on desktop and 1.5 to 2.2 million in portrait, in 200 to 300 draw calls (pixel ratio 1, counting the shadow and water-reflection passes).
- **Light:** the sky changes from dawn to dusk. Read colours from `scene.fog` each frame rather than fixing them, as the balloon does for its haze.

## How it is built

All in `src/components/garden/`.

- **`journey.ts`** is the single source of truth, pure and tested (`tests/journey.test.mjs`): `MILESTONES` (`id`, `month`, `description` for screen readers, optional `egg` and `room`), `DATES`, and the chapters over scroll progress p ∈ [0, 1]: arrival `[0, .05)`, voyage `[.05, .92)`, dock `[.92, 1]` (`ARRIVAL_END`, `VOYAGE_END`, `CHAPTERS`, `chapterAt`). The boats are moored from `DOCKED` (.97).
  - `storyMonth(p)`: story time in months since January 2017, piecewise-linear. Scroll is shared out by story, not calendar: each milestone gets one share (`ROOM` of progress) up to the next, with more for the meeting, Sydney, dating and the last stretch round the bend. Each date holds for a third of its share so the label can be read. `progressAt(month)` is the inverse (when a date first shows), `dateLabel(p)` gives "July 2017" during the voyage and `null` outside it.
  - `since(month, p)`: story months since a date (stands still while a date holds). `scrolledSince(month, p)`: scroll since a date in shares, which keeps running; use it for scenery tied to scroll.
  - `routeAt(p)`: where the boats are, as z along the river (x is `riverCenter(z)`). They drift from z 6 to 4 under the title, travel steadily to −164 through the voyage, and glide to the jetty at −172. `routeAtMonth(month)` is where they are on a date. 178 units in all.
  - `stillProgress(p)`: the reduced-motion still for p (the opening, the latest milestone reached, or the dock).
- **The launch jetties:** `launchJetties(width)` (`gardenGeometry.ts`) places one on each outer bank beside `ROUTE.start`, Amelia's a little shorter at the head; the further bank's reaches out further, so both heads are as far from the river's middle. Built in `voyageDock.ts` (`launchJettyGeometry`, its lanterns and `mooringLines`) at a smaller scale than the dock's jetty, Amelia's with a single bollard, a post and her lantern at the head's corner, capped in her teal, Patrick's with two bollards and his lantern back by the bank, capped in his yellow; drawn by `Launch` in `VoyageWorld.tsx`. Each boat lies alongside its jetty's head at p 0, stern to it and bow free (`berth` in `storyBoats.ts`); `castingOff(p)` lets the lines go at p .004 and brings the boats out to the middle of their channels by p .0425, sails easing out as they go (`berthed`), and the lanterns fade. Portrait's channels are only just wider than a boat beside a jetty, so there each jetty is a landing stage along the bank and its boat lies about mid-channel, setting off straight down it. Planting keeps off the jetties (`voyageClearing`); the first reed bed on the left bank stops just upstream of Amelia's, so it doesn't hide it; guests' boats bump off them (`launchJettyStems`, whose upstream sides slant so a boat glances off into the channel) and taps under them don't launch (`underLaunchJetty`).
- **`gardenGeometry.ts`** shapes the river. `VOYAGE` holds the scenery's positions (z falls downstream; `from` is upstream): the island (z 10 to just before the meeting at about −8.5), Sydney's widening (−57 to −68), the S-bend (−135 to −164, swinging the river 12 units to −x), the dock (z −172, jetty on the +x bank) and the old tree (z −175.5). `islandHalfWidth(z, width)` is the island's footprint and `channelOffset(z, width)` the middle of each channel beside it. `voyageLandmarks(width)` gives the jetty, the catamaran's mooring and the tree in world x/z. `RIVER_REACH` (z 26 to −260) is what's planted. Instances are batched by 20-unit stretch (`riverChunks`) and drawn only within the camera's reach (`useRiverReach`), so the longer river costs about what the old one did.
- **`JourneyProvider.tsx`** eases the scroll into `useJourney().progress` (the old damping) before any other frame callback; under reduced motion it jumps to `stillProgress`. Everything that moves with the story reads it in `useFrame`, so it moves with the camera, not the raw scroll. Slots get `SlotProps`: `paused` (guest pause or reduced motion: hold decorative animation), `reduced`, `mobile` and `width` (1, or `MOBILE_RIVER_WIDTH` on portrait).
- **`cameraRig.ts`** (pure, tested in `tests/cameraRig.test.mjs`) and **`VoyageCamera.tsx`**: the camera rides 12 behind the boats at the old height, looking 34 past them, turning through the bend only as far as keeps the boats within about 10° of the middle of the picture (6° in portrait). Over the start of the dock chapter it settles on `dockView`: over the moored catamaran's stern quarter, so the monogram and both flags read beside the jetty, with the old tree to the right and its lights above the copy (portrait sits higher, with the boats below the copy's button). The camera's far plane now stops just past the fog.
- **`GardenScene.tsx`** is wiring only. The rest of the old file moved to `GardenWater.tsx` (water and guest-launched boats), `GardenBankDetails.tsx` and `GardenDrift.tsx` (petals and falling leaves).
- **The boats' rig** (`storyBoats.ts`, `storyBoatGeometry.ts`): `joining(p)` runs from the dating date to the engagement's, so the last plank is down just before April 2026 shows. `rigging(p, still)` then times the change of masts by scroll since that date, in shares (`RIG_CHANGE`): the small sails furl and their flags come down (−.3 to −.1), the small masts are lowered aft (−.2 to .04), the big mast rises (.04 to .34, while the date holds), its sail unrolls (.3 to .58) and the flags go up it (.5 to .8), all before July 2026's balloon. Under reduced motion each still shows the rig settled: two masts before the engagement, one from it. The big mast (`BIG_RIG`) stands mid-deck and its sail is eased well out to port, away from the jetty, so its face turns to the camera behind and at the dock. The monogram is `public/logo.png` (ink on transparency) drawn into the sail's texture low in the sail, where it is widest, so it follows the cloth's curve; the A and P flags share their cloth and waving with the small masts' flags.
- The story boats are kinematic: their positions are a function of progress (`storyBoats.ts`). They don't use `boatPhysics.ts`, which stays for the guest-launched "Float a boat" boats. Those keep to the channels round the island (`islandHalfWidth` is the physics' `island` shore), and bump off the little jetties at the start and the jetty at the dock (`launchJettyStems`, `jettyStems`) and, once it is tied up, the moored catamaran (`mooredStems`). In portrait the channels at the island's head are narrower than a paper boat, which can catch there; "Float a boat" launches beside the island past its head.
- **Light:** `skyCycle.ts` runs the day (`skyAt`). `lampsAt(p)` brings the festoons and the jetty's lantern up through the second half of the dusk, so they glow as the old tree comes round the bend.
- `Garden.tsx` maps its chapters to the journey's boundaries and `.garden-scroll-space` is 2000svh, about a screen per milestone. During the voyage the page shows only the date, high in the sky above the boats, and a quiet "The next chapter" link to the celebration. The date follows the scroll eased as the camera eases it, crossfades, and changes at most every 400ms while rolling. Screen readers hear each milestone's date and `description` from a polite status line once the guest settles on it (`milestoneAt`). The scroll cue and the ←/→ keys step through `STOPS`: the opening, each milestone halfway through its date's hold, and the celebration (`nextStop`, `previousStop`).
- Text over the sky takes its colours from custom properties GardenSky sets on `.garden-prototype`: `--garden-sky-glow` (the pale glows behind copy), `--garden-ink-on-sky` (text, with softer tints mixed from it) and `--garden-sky-top` (the top wash and the phone status-bar band). Unset, each falls back to the misty day's colour.
- **Reduced motion** (the operating-system setting for people who get motion sickness): instead of freezing at the opening, the camera cuts to a still view at each milestone, with no glide and no decorative animation.
- Phones are a first-class target. Check every change at a 390 × 844 portrait size as well as desktop.

## For agents

Each slot is mounted from `GardenScene.tsx`; nobody needs to edit that file. `journey.ts` and `gardenGeometry.ts` are shared, stable APIs: add to them, but don't change existing signatures or numbers without telling the others (tests pin the story order).

| Slot | Built | Main files |
| --- | --- | --- |
| World | A little jetty for each boat to set out from; a raised, reed-ringed island splitting the river; a wooded headland hiding the old tree until the S-bend; a T-headed jetty under the old tree, strung with festoon lights and a lantern | `VoyageWorld.tsx`, `voyageIsland.ts`, `voyageDock.ts`; the old tree and headland in `GardenTrees.tsx` |
| Boats | Patrick's yellow and Amelia's teal-trimmed sailboats under their initials, apart in Sydney, joined plank by plank into a catamaran that takes one tall mast with their monogram on its sail as they get engaged, and moors at the jetty | `VoyageBoats.tsx`, `storyBoats.ts`, `storyBoatGeometry.ts` |
| Sky | One day from dawn under the title through misty daylight and golden light to dusk at the dock, colouring the page's copy | `GardenSky.tsx`, `skyCycle.ts` |
| Copy | The month and year high above the boats, a quiet link to the celebration, milestone stops for the scroll cue and arrow keys, screen-reader announcements | `Garden.tsx`, `garden.css` |
| Eggs | The π sculpture and rubber ducks for July 2017, the hot-air balloon for July 2026 | `eggs/` |

Ideas not yet built: the other eggs in the table above; the recurring coast trips and circus shows.
