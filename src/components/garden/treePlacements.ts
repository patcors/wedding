// Where the Voyage's trees stand: the avenue along both banks, the groves
// behind it, the headland's stand and shrubs that hide the old tree, and the
// old tree itself. Drawn by GardenTrees.tsx; pure, so eggs hung from a tree
// (see eggs/circusRigs.ts) can find one and it can be tested.
import { riverCenter, bankEdge, bendShift, groundHeight, random, sydneyWiden, voyageClearing, voyageLandmarks, islandHalfWidth, VOYAGE, RIVER_REACH } from './gardenGeometry.ts';
import { islandHeight } from './voyageIsland.ts';

// The old tree's scale: on a phone's narrow river it stands a little smaller.
export const OLD_TREE_SCALE = { desktop: 1.2, mobile: .9 };
// How far the old tree's crown spreads from its trunk at desktop scale; other
// trees keep out from under it.
const OLD_TREE_SPREAD = 9.5;
// `type` is the model: the two near ashes (0, 1), the two distant ones (2, 3),
// the old tree (4) and the shrub (5). `y` sets the height of the ground where
// it isn't the banks', on the island.
export type Placement = { x: number; y?: number; z: number; scale: number; rotation: number; type: number; distant: boolean };

// The height a tree's model stands at: on the ground, sunk a little.
export const treeBase = (p: Placement, width: number) => (p.y ?? groundHeight(p.x, p.z, width)) - .08;

// Every tree but the old one, on each composition.
export function voyageTrees(width: number, mobile: boolean): Placement[] {
  const avenue = [
    [-8.6, 4, 1.22, .3], [8.8, 0, 1.30, 2.1],
    [-11.5, -17, 1.08, 1.3], [11.7, -21, 1.2, .7],
    [-10.2, -37, 1.17, 2.9], [10.7, -43, 1.03, .1],
    [-8.7, -59, 1.12, 1.8], [9, -67, 1.23, 3.5],
    [-8, -85, 1.05, .2], [8, -95, 1.15, 2.2],
  ].map(([x, z, scale, rotation], i) => ({
    // In portrait the first right-hand tree stands nearer the water, to
    // balance the reed bed opposite. Desktop's are placed by hand, moved
    // only where the Voyage widens or bends the river.
    x: mobile ? riverCenter(z, width) + Math.sign(x) * (bankEdge(z, width) + (i === 1 ? 2.2 : 3.8 + (i % 3) * .2))
      : x + bendShift(z) + Math.sign(x) * sydneyWiden(z, width),
    z, scale: scale * (mobile ? .88 : 1), rotation, type: i % 2 + (i >= 4 ? 2 : 0), distant: i >= 4,
  }));
  // The avenue carries on down the rest of the river, alternating banks.
  for (let z = -105, i = 0; z > RIVER_REACH.to + 10; z -= 10 + (i * 7 % 5), i++) {
    const side = i % 2 ? 1 : -1;
    avenue.push({ x: riverCenter(z, width) + side * (bankEdge(z, width) + (mobile ? 3.8 : 3.2) + (i % 3) * .4), z,
      scale: (1.05 + (i * 3 % 4) * .06) * (mobile ? .88 : 1), rotation: i * 1.7, type: 2 + i % 2, distant: true });
  }
  // Portrait also fills the open stretch of left bank between the first two trees.
  if (mobile) avenue.push({ x: riverCenter(-7, width) - bankEdge(-7, width) - 3.6, z: -7, scale: .95, rotation: 4.4, type: 1, distant: false });
  // An ash by the water on Amelia's bank past 2020's boathouse, as Sydney
  // starts to widen the river, for 2020's aerial silk to hang from
  // (eggs/circusRigs.ts); on a phone nearer the water, so the silk's limb
  // reaches out over the bank into its narrower picture.
  avenue.push({ x: riverCenter(-63.5, width) - bankEdge(-63.5, width) - (mobile ? 2.6 : 3.2), z: -63.5, scale: mobile ? .97 : 1.1, rotation: Math.PI, type: 2, distant: true });
  const rand = random(415);
  // Stagger groves along both banks all the way into the mist. The inner
  // trees overlap the avenue while outer trees fill gaps between canopies.
  const perRow = mobile ? 6 : 10, rows = Math.ceil((-16 - RIVER_REACH.to) / 12);
  const groves = Array.from({ length: rows * perRow }, (_, i) => {
    const row = Math.floor(i / perRow);
    const lane = Math.floor(i % perRow / 2);
    const z = -16 - row * 12 - rand() * 8;
    const inland = 4.8 + lane * (mobile ? 3.8 : 6) + rand() * 2.5;
    return {
      x: riverCenter(z, width) + (i % 2 ? 1 : -1) * (bankEdge(z, width) + inland),
      z, scale: .95 + rand() * .6, rotation: rand() * Math.PI * 2,
      type: 2 + (i + row + lane) % 2, distant: true,
    };
  });
  // Coming round the S-bend, the old tree must stay hidden until the river
  // turns towards it. It stands where the river would have run on had it not
  // bent, so a stand on the headland inside the second curve screens it from
  // upstream: tall trees, staggered from the bank to well inland, over an
  // understorey of shrubs that fills between their trunks.
  const headland: Placement[] = [], shrubs: Placement[] = [];
  const hide = random(733), squeeze = mobile ? .8 : 1;
  for (let i = 0; i < 20; i++) {
    const z = VOYAGE.bend.from - 11 - i * 1.1 - hide() * 1.6;
    const inland = 2.2 + (i * 3 % 5) * 1.9 + hide() * 1.6;
    headland.push({ x: riverCenter(z, width) + bankEdge(z, width) + inland * squeeze, z,
      scale: (1.05 + hide() * .4) * (mobile ? .88 : 1), rotation: hide() * Math.PI * 2, type: 2 + i % 2, distant: true });
  }
  for (let i = 0; i < 14; i++) {
    const z = VOYAGE.bend.from - 11 - i * 1.6 - hide() * 1.2;
    const inland = 1.8 + (i % 3) * 1.8 + hide() * 1.2;
    shrubs.push({ x: riverCenter(z, width) + bankEdge(z, width) + inland * squeeze, z,
      scale: .36 + hide() * .16, rotation: hide() * Math.PI * 2, type: 5, distant: true });
  }
  // A few shrubs on the island's crown, low enough to keep the opening's
  // view down the river, so it reads as land rather than a reed bed.
  for (const [z, across, scale] of [[6.6, -.25, .18], [4.4, .2, .22], [2.6, -.1, .17], [.6, .15, .14]]) {
    const x = riverCenter(z, width) + across * islandHalfWidth(z, width);
    shrubs.push({ x, y: islandHeight(x, z, width), z, scale: scale * (mobile ? .75 : 1), rotation: z * 2.1, type: 5, distant: true });
  }
  // Keep every tree out from under the old tree's crown and off the jetty.
  const { tree } = voyageLandmarks(width);
  const spread = OLD_TREE_SPREAD * (mobile ? OLD_TREE_SCALE.mobile : OLD_TREE_SCALE.desktop);
  const clear = (p: Placement) => Math.hypot(p.x - tree.x, p.z - tree.z) > spread && !voyageClearing(p.x, p.z, width, 1.5);
  return [...avenue, ...groves, ...headland, ...shrubs].filter(clear);
}

export function oldTreePlacement(width: number, mobile: boolean): Placement {
  const { tree } = voyageLandmarks(width);
  // Turned so its longest limb reaches inland, and the shorter ones shade
  // the jetty without hanging out across the river.
  return { ...tree, scale: mobile ? OLD_TREE_SCALE.mobile : OLD_TREE_SCALE.desktop, rotation: Math.PI, type: 4, distant: false };
}
