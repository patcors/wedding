import assert from 'node:assert/strict';
import test from 'node:test';
import { DATES, MILESTONES, ROOM, progressAt, stillProgress } from '../src/components/garden/journey.ts';
import { CATAMARAN, HULL_HALF_BEAM, RIG_CHANGE } from '../src/components/garden/storyBoats.ts';
import { BIG_RIG } from '../src/components/garden/storyBoatGeometry.ts';
import { PETAL_LIST } from '../src/components/garden/eggs/petalTrail.ts';
import { DECK_TOP, FIGURE, POSES, PROPOSAL, STEPS, figurePoints, proposalPose, proposalStage, proposalStages, proposalTime } from '../src/components/garden/eggs/proposal.ts';
import { proposalFigures } from '../src/components/garden/eggs/proposalGeometry.ts';

const engaged = progressAt(DATES.engaged);
const next = MILESTONES[MILESTONES.findIndex(m => m.month === DATES.engaged) + 1];
const at = t => engaged + t * ROOM;
// Every pose they pass through: each step part way, in order.
const stagesAlong = () => {
  const list = [];
  for (let k = 0; k <= 20; k++) list.push({ appear: 1, kneel: k / 20, rise: 0 });
  for (let k = 0; k <= 20; k++) list.push({ appear: 1, kneel: 1, rise: k / 20 });
  return list;
};
const WHO = ['amelia', 'patrick'];
const allPoints = points => [...Object.values(points.frames).map(f => f.at), points.knee.L, points.knee.R, points.ankle.L, points.ankle.R, points.toe.L, points.toe.R, points.hand.L, points.hand.R, points.head, points.top];

test('they come out on deck just before the engagement shows, he kneels as it does and stands once the sail has unrolled, before July 2026', () => {
  assert.ok(PROPOSAL.appear.cue < 0 && PROPOSAL.appear.cue > -.3, 'out on deck just before the date');
  assert.ok(PROPOSAL.appear.cue >= RIG_CHANGE.lower[0], 'as the old masts come down');
  assert.equal(PROPOSAL.kneel.cue, 0);
  assert.ok(PROPOSAL.rise.cue > RIG_CHANGE.unfurl[1], 'kneeling while the date holds and the sail unrolls');
  assert.ok(proposalTime(progressAt(next.month)) > PROPOSAL.rise.cue + .2, `standing well before ${next.month}`);
});

test('each step plays in real time once the scroll reaches it, holds while paused, and plays back going back', () => {
  let u = 0;
  assert.equal(proposalStage(0, PROPOSAL.kneel.cue - .01, 'kneel', .1), 0);
  u = proposalStage(u, .01, 'kneel', .1);
  assert.ok(u > 0 && u < 1);
  assert.equal(proposalStage(u, .02, 'kneel', 0), u, 'held while paused');
  for (let i = 0; i < 40; i++) u = proposalStage(u, .05, 'kneel', .1);
  assert.equal(u, 1);
  // A step that has started finishes in real time however fast the guest scrolls on.
  const started = proposalStage(.3, PROPOSAL.kneel.cue + 1, 'kneel', .1);
  assert.ok(started > .3 && started < 1);
  // Going back before it plays it back.
  assert.ok(proposalStage(1, -.01, 'kneel', .1) < 1);
  // A jump well past a step that hasn't started finds it done, and well back undone.
  for (const name of STEPS) {
    assert.equal(proposalStage(0, PROPOSAL[name].cue + PROPOSAL.late + .01, name, .016), 1);
    assert.equal(proposalStage(1, PROPOSAL[name].cue - PROPOSAL.late - .01, name, .016), 0);
  }
  assert.ok(STEPS.every(name => PROPOSAL[name].seconds >= 1 && PROPOSAL[name].seconds <= 3));
});

test('under reduced motion the engagement\'s still shows him kneeling, the stills after it the two of them standing together', () => {
  const still = p => proposalStages({ appear: 0, kneel: 0, rise: 0 }, proposalTime(stillProgress(p)), 0, true);
  assert.deepEqual(still(at(-.5)), { appear: 0, kneel: 0, rise: 0 });
  assert.deepEqual(still(at(.2)), { appear: 1, kneel: 1, rise: 0 });
  assert.deepEqual(still(progressAt(next.month) + .1 * ROOM), { appear: 1, kneel: 1, rise: 1 });
  assert.deepEqual(still(1), { appear: 1, kneel: 1, rise: 1 });
  const kneeling = proposalPose(still(at(.2))), together = proposalPose(still(1));
  assert.equal(kneeling.opacity, 1);
  assert.ok(kneeling.ring > .99 && together.ring < 1e-9);
});

test('nobody sinks into the deck or floats off it: the lowest knee or shoe rests on it in every pose', () => {
  for (const stages of stagesAlong()) {
    const pose = proposalPose(stages);
    for (const who of WHO) {
      const f = FIGURE[who];
      for (const scale of [PROPOSAL.scale.desktop, PROPOSAL.scale.mobile]) {
        const points = figurePoints(who, pose[who], undefined, scale);
        const feet = ['L', 'R'].flatMap(s => [points.knee[s][1] - f.limb * scale, points.ankle[s][1] - Math.max(f.shoe, f.limb) * scale, points.toe[s][1] - f.shoe * scale]);
        assert.ok(Math.abs(Math.min(...feet) - DECK_TOP) < 1e-9, `${who} on the deck at ${JSON.stringify(stages)}`);
        for (const point of [points.hand.L, points.hand.R, points.head]) assert.ok(point[1] > DECK_TOP + .02);
      }
    }
  }
});

test('they stand on the deck between the hulls, aft of the mast and clear of its sail, forward of where the petals blow off', () => {
  const inner = CATAMARAN - HULL_HALF_BEAM.catamaran - .03;
  // The sail's foot runs from the mast out to port and aft, eased BIG_RIG.eased.
  const along = [-Math.sin(BIG_RIG.eased), Math.cos(BIG_RIG.eased)], across = [along[1], -along[0]];
  const firstPetal = Math.min(...PETAL_LIST.map(petal => petal.from[2]).filter(z => z > .5));
  for (const stages of stagesAlong()) {
    const pose = proposalPose(stages);
    for (const who of WHO) {
      for (const scale of [PROPOSAL.scale.desktop, PROPOSAL.scale.mobile]) {
        for (const [x, y, z] of allPoints(figurePoints(who, pose[who], undefined, scale))) {
          assert.ok(Math.abs(x) < inner, `${who} between the hulls (${x})`);
          assert.ok(z > BIG_RIG.z + .4 && z < firstPetal - .2, `${who} aft of the mast, forward of the petals (${z})`);
          assert.ok(across[0] * x + across[1] * (z - BIG_RIG.z) > .1, `${who} clear of the sail`);
          assert.ok(y < DECK_TOP + BIG_RIG.top * .3);
        }
      }
    }
  }
});

test('he kneels on starboard holding the ring up to her on port, then they stand side by side, her right hand in his left', () => {
  const { patrick, amelia } = POSES;
  const kneeling = figurePoints('patrick', patrick.proposing), her = figurePoints('amelia', amelia.proposing);
  assert.ok(patrick.proposing.x > 0 && amelia.proposing.x < 0, 'his on the right, hers on the left, as their boats were');
  // Facing each other across the deck.
  assert.ok(patrick.proposing.yaw > 1.4 && amelia.proposing.yaw < -1.4);
  // One knee down, the other foot forward.
  assert.ok(Math.abs(kneeling.knee.L[1] - FIGURE.patrick.limb - DECK_TOP) < .002, 'his left knee on the deck');
  assert.ok(kneeling.knee.R[1] > DECK_TOP + FIGURE.patrick.thigh * .8, 'his right knee up');
  assert.ok(kneeling.top[1] < her.top[1] - .03, 'down below her');
  // The ring held up towards her, above his shoulder and nearer her than he is.
  const ring = kneeling.hand.R;
  assert.ok(ring[1] > kneeling.shoulder.R[1] && ring[0] < patrick.proposing.x - .08 && ring[0] > amelia.proposing.x);
  // Her hands to her face.
  for (const hand of [her.hand.L, her.hand.R]) assert.ok(hand[1] > her.head[1] - .06);
  // Then side by side, facing down the river, hand in hand.
  const him = figurePoints('patrick', patrick.together), them = figurePoints('amelia', amelia.together);
  assert.ok(amelia.together.x < patrick.together.x && Math.abs(patrick.together.yaw) < .5 && Math.abs(amelia.together.yaw) < .5);
  assert.ok(Math.hypot(...him.hand.L.map((v, i) => v - them.hand.R[i])) < .025, 'hands meet');
  assert.ok(Math.abs(him.top[1] - figurePoints('patrick', patrick.facing).top[1]) < .005, 'standing again');
});

test('little next to the mast, a little larger on a phone', () => {
  for (const who of WHO) {
    const height = figurePoints(who, POSES[who].facing).top[1] - DECK_TOP;
    assert.ok(height > BIG_RIG.top / 7 && height < BIG_RIG.top / 4.5, `${who} ${height}`);
  }
  assert.ok(PROPOSAL.scale.mobile > PROPOSAL.scale.desktop && PROPOSAL.scale.mobile < 1.4);
});

test('the figures are one skinned mesh, well within an egg\'s budget, hidden until they come out, casting no shadow', () => {
  const { mesh, bones, dispose } = proposalFigures();
  const triangles = mesh.geometry.attributes.position.count / 3;
  assert.ok(triangles < 1200, `${triangles} triangles`);
  assert.equal(mesh.isSkinnedMesh, true);
  assert.equal(mesh.visible, false);
  assert.equal(mesh.castShadow, false);
  assert.equal(mesh.children.length, 2, 'both figures on the one mesh');
  assert.ok(bones.patrick.ring.parent === bones.patrick.foreArmR, 'the ring in his right hand');
  dispose();
});
