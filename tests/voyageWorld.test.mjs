import assert from 'node:assert/strict';
import test from 'node:test';
import { VOYAGE, bankEdge, channelOffset, groundHeight, islandHalfWidth, islandSpan, launchJetties, riverCenter, voyageClearing, voyageLandmarks } from '../src/components/garden/gardenGeometry.ts';
import { islandGeometry, islandHeight, islandInland, islandPlantSites } from '../src/components/garden/voyageIsland.ts';
import { JETTY, LAUNCH_DECK, festoonStrands, jettyGeometry, jettyLantern, launchJettyGeometry, launchLanterns, underLaunchJetty } from '../src/components/garden/voyageDock.ts';
import { plantSites } from '../src/components/garden/gardenPlantGeometry.ts';
import { ROUTE } from '../src/components/garden/journey.ts';

const compositions = [[1, false], [.45, true]];
// Half a story boat's beam, plus a little water around it.
const BOAT_CLEARANCE = .29 + .05;

test('the island rises out of the water and its reeds line its shores, clear of both boats', () => {
  for (const [width, mobile] of compositions) {
    const geometry = islandGeometry(width);
    assert.ok([...geometry.attributes.position.array].every(Number.isFinite));
    geometry.dispose();
    const middle = (VOYAGE.island.from + VOYAGE.island.to) / 2;
    assert.ok(islandHeight(riverCenter(middle, width), middle, width) > .3, 'the crown stands above the water');
    for (const kind of ['reed', 'cattail']) {
      const sites = islandPlantSites(kind, width, mobile);
      assert.ok(sites.length > (kind === 'reed' ? 200 : 10), `${kind}: the shores are planted`);
      for (const site of sites) {
        assert.ok(Math.abs(islandInland(site.x, site.z, width)) < .5, `${kind} stays on the island's shore`);
        // The boats start under the title at ROUTE.start, in the middle of each channel.
        if (site.z > ROUTE.start) continue;
        const center = riverCenter(site.z, width), channel = channelOffset(site.z, width);
        for (const side of [-1, 1]) assert.ok(Math.abs(site.x - (center + side * channel)) > BOAT_CLEARANCE, `${kind} stands in a boat's way`);
      }
    }
    for (const kind of ['grass', 'fern']) {
      for (const site of islandPlantSites(kind, width, mobile)) {
        assert.ok(islandInland(site.x, site.z, width) >= .3 && site.y > 0, `${kind} grows on the crown`);
      }
    }
  }
});

test('the island tapers to nothing where the channels rejoin', () => {
  for (const [width] of compositions) {
    assert.equal(islandHalfWidth(VOYAGE.island.to, width), 0);
    assert.ok(islandHalfWidth(VOYAGE.island.to + 1, width) < islandHalfWidth(islandSpan(width).from - 3, width) * .25);
    assert.ok(islandHalfWidth(VOYAGE.island.to, width) < bankEdge(VOYAGE.meet, width));
  }
});

test('the jetty runs from the bank to the mooring, and planting keeps off it and the old tree', () => {
  for (const [width, mobile] of compositions) {
    const { jetty, mooring, tree } = voyageLandmarks(width);
    const geometry = jettyGeometry(width);
    geometry.computeBoundingBox();
    assert.ok([...geometry.attributes.position.array].every(Number.isFinite));
    const box = geometry.boundingBox;
    // The jetty's head stops short of where the catamaran lies.
    assert.ok(box.min.x > mooring.x && box.min.x < jetty.x - jetty.reach, 'the jetty reaches out towards the mooring');
    geometry.dispose();
    assert.ok(jettyLantern(width).y > JETTY.deck + .5);
    assert.ok(voyageClearing(jetty.x, jetty.z, width) && voyageClearing(tree.x, tree.z, width));
    for (const kind of ['grass', 'clover', 'fern', 'meadow']) {
      for (const site of plantSites(kind, width, mobile)) assert.ok(!voyageClearing(site.x, site.z, width), `${kind} grows through the jetty or the trunk`);
    }
    for (const [a, b] of festoonStrands(width, 1)) assert.ok(a.y > 3 && b.y > 3, 'the festoons hang above head height');
  }
});

test('a little jetty on each outer bank by the start, clear of planting, its deck above the bank', () => {
  for (const [width, mobile] of compositions) {
    const geometry = launchJettyGeometry(width);
    assert.ok([...geometry.attributes.position.array].every(Number.isFinite));
    geometry.dispose();
    const lanterns = launchLanterns(width);
    launchJetties(width).forEach((jetty, i) => {
      const center = riverCenter(jetty.z, width);
      // On the bank, reaching out over the water but well short of the island.
      assert.ok(Math.abs(Math.abs(jetty.x - center) - bankEdge(jetty.z, width)) < 1e-9);
      assert.ok(Math.abs(jetty.x - center) - jetty.reach > islandHalfWidth(jetty.z, width) + 1);
      assert.ok(Math.abs(jetty.z - ROUTE.start) < 1, 'beside where the boats start');
      assert.ok(groundHeight(jetty.x + jetty.side * .5, jetty.z, width) < LAUNCH_DECK - .05, 'the landing stands above the bank');
      assert.ok(voyageClearing(jetty.x, jetty.z, width) && voyageClearing(jetty.x + jetty.side * .5, jetty.z, width));
      assert.ok(underLaunchJetty(jetty.x - jetty.side * jetty.reach * .9, jetty.z, width));
      assert.ok(lanterns[i].y > LAUNCH_DECK + .4 && Math.sign(lanterns[i].x - center) === jetty.side);
    });
    for (const kind of ['grass', 'clover', 'fern', 'meadow', 'reed', 'cattail']) {
      for (const site of plantSites(kind, width, mobile)) {
        const on = launchJetties(width).some(j => Math.abs(site.z - j.z) < j.head / 2 + .1 && (site.x - j.x) * j.side > -j.reach - .1 && (site.x - j.x) * j.side < .6);
        assert.ok(!on, `${kind} grows through a little jetty`);
      }
    }
  }
});
