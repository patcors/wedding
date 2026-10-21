import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { OLD_TREE_FIRST } from '../src/components/garden/gardenTreeSpots.ts';
import { sceneryCatalog } from '../src/components/garden/sceneryCatalog.ts';
import { LAYOUTS, samples, trackOf } from '../src/components/garden/voyageTimeline.ts';
import { paceToward } from '../src/components/garden/journeyPace.ts';

// The old tree at the dock loads once the rest of the scene is prepared
// (GardenTrees.tsx), so the scene doesn't wait for it. That is safe only if no
// guest can see it before it can have arrived: it must first come into the
// picture (even a sliver through the haze) well after a scene opening at
// the title could get there, and after OLD_TREE_FIRST, past which a scene
// opening part way along waits for it, as does one under reduced motion,
// which cuts straight to wherever the guest scrolls.
const source = file => readFileSync(new URL(`../src/components/garden/${file}`, import.meta.url), 'utf8');

test('nobody can see the old tree before it has loaded', () => {
  for (const [name, lens] of Object.entries(LAYOUTS)) {
    const piece = sceneryCatalog(lens.width).find(piece => piece.id === 'old-tree');
    const ps = samples(), seen = trackOf(piece, lens, ps).seen;
    const first = ps[seen.findIndex(share => share > 0)];
    assert.ok(first > OLD_TREE_FIRST + .05, `${name}: first in the picture at p ${first}`);
    // At the story's fastest pace, held from the title, it takes this long to get there.
    let p = 0, seconds = 0;
    while (p < first) { p = paceToward(p, 1, 1 / 60); seconds += 1 / 60; }
    assert.ok(seconds > 10, `${name}: ${seconds.toFixed(1)}s from the title`);
  }
});

test('the opening waits for every tree but the old one, which follows at once', () => {
  const trees = source('GardenTrees.tsx'), scene = source('GardenScene.tsx');
  assert.match(trees, /export const OPENING_TREE_MODELS = TREE_MODELS\.filter\(url => url !== OLD_TREE_MODEL\);/);
  assert.match(scene, /models: \[OPENING_TREE_MODELS, .*\.\.\.oldTreeFirst \? \[\[OLD_TREE_MODEL\]\] : \[\]\]/);
  // Asked for only once the prepared scene starts to run.
  assert.match(trees, /const running = useThree\(state => state\.frameloop !== 'never'\);/);
  assert.match(trees, /if \(running && !oldTreeNext\) setOldTreeNext\(true\);/);
  assert.match(trees, /oldTreeNext && <Suspense fallback=\{null\}><OldTree/);
  // Reduced motion cuts straight to any point, so it waits for the old tree as well.
  assert.match(scene, /useState\(\(\) => progress >= OLD_TREE_FIRST \|\| matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches\)/);
  // The eggs set on trees take the opening's models, by tree type.
  for (const egg of ['eggs/YearMarkers.tsx', 'eggs/BarkCarvings.tsx', 'eggs/Birdhouses.tsx']) assert.doesNotMatch(source(egg), /useGLTF\(TREE_MODELS\)/, egg);
});
