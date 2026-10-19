import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { GUEST_ARRIVAL, GUEST_BOAT, GUEST_CARD, GUEST_SCALE, cormorantWidth, guestBerths, guestBoatStems, guestCard, guestCardScale, guestFleetPoses, guestNames, guestRig, guestScale } from '../src/components/garden/guestBoat.ts';
import { cameraPose, dockView } from '../src/components/garden/cameraRig.ts';
import { DOCKED, VOYAGE_END, progressAt, DATES } from '../src/components/garden/journey.ts';
import { GARDEN_CAMERA, MOBILE_RIVER_WIDTH, bankEdge, riverCenter } from '../src/components/garden/gardenGeometry.ts';
import { CATAMARAN, HULL_HALF_BEAM, BOAT_SCALE, boatPose, mooredStems } from '../src/components/garden/storyBoats.ts';
import { underJetty } from '../src/components/garden/voyageDock.ts';
import { parties } from '../src/data/parties.ts';

// Desktop, a portrait phone, and phones on their side, which keep desktop's
// framing. `button`: the dock copy's button as a share of the screen (left,
// top, right, bottom; measured in the browser); the cards stay clear of it.
const SCREENS = [{ width: 1, w: 1440, h: 900, fov: GARDEN_CAMERA.fov, button: [.43, .6, .57, .66] }, { width: MOBILE_RIVER_WIDTH, w: 390, h: 844, fov: GARDEN_CAMERA.mobileFov, button: [.25, .57, .75, .63] },
  { width: 1, w: 844, h: 390, fov: GARDEN_CAMERA.fov, button: [.385, .49, .615, .6] }, { width: 1, w: 667, h: 375, fov: GARDEN_CAMERA.fov, button: [.36, .48, .64, .6] }, { width: 1, w: 932, h: 430, fov: GARDEN_CAMERA.fov, button: [.39, .49, .61, .6] }];
const lens = (screen, pose = dockView(screen.width)) => {
  const camera = new THREE.PerspectiveCamera(screen.fov, screen.w / screen.h, .2, 200);
  camera.position.set(...pose.position);
  camera.lookAt(new THREE.Vector3(...pose.target));
  camera.updateMatrixWorld();
  return camera;
};
const onScreen = (camera, point) => { const v = point.clone().project(camera); return [(v.x + 1) / 2, (1 - v.y) / 2]; };
// Every Party, and a Party of four, which none has yet.
const PARTIES = [...parties.map(party => guestNames(party.guests)), ['Kirsten', 'Michael', 'Kai', 'Lou']];
// A card's corners on screen when moored, and its distance from the camera.
function cardOnScreen(berth, name, count, screen, camera) {
  const scale = guestScale(screen.width, screen.h, count), rig = guestRig(berth.tall, screen.width, screen.h, count), cardScale = rig.card * scale;
  const half = guestCard(name, cormorantWidth).width / 2 * cardScale, foot = rig.foot * scale, top = foot + GUEST_BOAT.card.height * cardScale;
  const facing = berth.yaw + berth.card, across = new THREE.Vector3(Math.cos(facing), 0, -Math.sin(facing));
  const corners = [[-half, foot], [half, foot], [-half, top], [half, top]].map(([u, y]) => onScreen(camera, new THREE.Vector3(berth.x, y, berth.z).addScaledVector(across, u)));
  const middle = new THREE.Vector3(berth.x, (foot + top) / 2, berth.z);
  return { box: [Math.min(...corners.map(c => c[0])), Math.min(...corners.map(c => c[1])), Math.max(...corners.map(c => c[0])), Math.max(...corners.map(c => c[1]))], distance: camera.position.distanceTo(middle), cardScale };
}
const overlap = (a, b) => Math.min(a[2], b[2]) - Math.max(a[0], b[0]) > .002 && Math.min(a[3], b[3]) - Math.max(a[1], b[1]) > .002;

test('a Party gets a boat for each guest, by first name, four at most', () => {
  assert.deepEqual(guestNames(['Dean', 'Kelly']), ['Dean', 'Kelly']);
  assert.deepEqual(guestNames(['Kirsten', 'Michael', 'Kai']), ['Kirsten', 'Michael', 'Kai']);
  assert.deepEqual(guestNames([' Paula ', '']), ['Paula']);
  assert.equal(guestNames(['A', 'B', 'C', 'D', 'E']).length, 4);
  for (const party of parties) assert.equal(guestNames(party.guests).length, party.guests.length);
});

test('every name fits its card on one line, a short name on a card of its own, a very long one set smaller', () => {
  for (const names of PARTIES) for (const name of names) {
    const { width, size } = guestCard(name, cormorantWidth);
    assert.ok(cormorantWidth(name) * size + 2 * GUEST_CARD.margin * GUEST_CARD.em <= width + 1e-9, `${name} fits across`);
    assert.ok(size <= GUEST_CARD.em && size * 1.2 < GUEST_BOAT.card.height, `${name} fits down`);
  }
  assert.equal(guestCard('Kai', cormorantWidth).width, GUEST_CARD.least * GUEST_CARD.em);
  const long = guestCard('Maximiliana-Josephine', cormorantWidth);
  assert.ok(long.size < GUEST_CARD.em && Math.abs(long.width - GUEST_CARD.most * GUEST_CARD.em) < 1e-9);
});

test('the cards grow only on short screens, the hulls never; a bigger Party takes smaller hulls on a phone', () => {
  for (const height of [900, 800, 720, GUEST_SCALE.short]) assert.equal(guestCardScale(1, height), GUEST_SCALE.desktop);
  for (const height of [844, 667, 568, 390]) assert.equal(guestCardScale(MOBILE_RIVER_WIDTH, height), GUEST_SCALE.mobile);
  assert.ok(guestCardScale(1, 390) > 1.2 && guestCardScale(1, 300) <= GUEST_SCALE.most);
  for (const height of [900, 390]) assert.equal(guestScale(1, height, 1), GUEST_SCALE.desktop);
  assert.equal(guestScale(MOBILE_RIVER_WIDTH, 844, 1), GUEST_SCALE.mobile);
  for (let n = 2; n <= 4; n++) assert.ok(guestScale(MOBILE_RIVER_WIDTH, 844, n) < guestScale(MOBILE_RIVER_WIDTH, 844, n - 1), 'smaller hulls for a bigger Party on a phone');
  // The mast always reaches above its card.
  for (const screen of SCREENS) for (let n = 1; n <= 4; n++) for (const tall of [0, 1]) {
    const rig = guestRig(tall, screen.width, screen.h, n);
    assert.ok(rig.top > rig.foot + GUEST_BOAT.card.height * rig.card);
  }
});

test('moored, every boat lies on the water upstream of the jetty, clear of it, the catamaran and each other', () => {
  for (const screen of SCREENS) for (let n = 1; n <= 4; n++) {
    const { width, h } = screen, berths = guestBerths(n, width, h), scale = guestScale(width, h, n);
    // Each hull's outline, as guestBoatStems lays it out for the boats' physics.
    const stems = guestBoatStems(n, width, h), each = stems.length / n;
    const hulls = berths.map((_, i) => stems.slice(i * each, (i + 1) * each));
    hulls.forEach((hull, i) => {
      for (const point of hull) {
        assert.ok(Math.abs(point.x - riverCenter(point.z, width)) < bankEdge(point.z, width) + .1, `on the water (${screen.w}, ${n})`);
        assert.ok(!underJetty(point.x, point.z, width), `clear of the jetty (${screen.w}, ${n})`);
        for (const stem of mooredStems(width)) assert.ok(Math.hypot(point.x - stem.x, point.z - stem.z) > .25, `clear of the catamaran (${screen.w}, ${n})`);
      }
      for (const other of hulls.slice(i + 1)) {
        const near = Math.min(...hull.flatMap(a => other.map(b => Math.hypot(a.x - b.x, a.z - b.z))));
        assert.ok(near > .04, `boats ${i} and the next clear of each other (${screen.w}, ${n}): ${near.toFixed(2)}`);
      }
    });
    assert.ok(berths.every(b => Math.abs(b.x - riverCenter(b.z, width)) < bankEdge(b.z, width) - GUEST_BOAT.halfBeam * scale * .5));
    // Their names face the camera.
    const camera = lens(screen);
    for (const b of berths) assert.ok(Math.abs(Math.sin(b.yaw + b.card - Math.atan2(camera.position.x - b.x, camera.position.z - b.z))) < 1e-9);
  }
});

test('at the dock every name reads at a dozen pixels to the em or more, its card in the picture below the copy, clear of the others and right of the catamaran', () => {
  for (const screen of SCREENS) {
    const camera = lens(screen);
    const catamaran = Math.max(...mooredStems(screen.width).flatMap(stem => [onScreen(camera, new THREE.Vector3(stem.x, 0, stem.z))[0], onScreen(camera, new THREE.Vector3(stem.x, .45, stem.z))[0]]));
    for (const names of PARTIES) {
      const n = names.length, berths = guestBerths(n, screen.width, screen.h);
      const cards = names.map((name, i) => {
        const card = cardOnScreen(berths[i], name, n, screen, camera);
        const pixels = screen.h / 2 / Math.tan(screen.fov / 2 * Math.PI / 180) / card.distance;
        const em = guestCard(name, cormorantWidth).size * card.cardScale * pixels;
        assert.ok(em >= 12, `${name}: ${em.toFixed(1)}px to the em on ${screen.w} × ${screen.h}`);
        const [left, top, right, bottom] = card.box;
        assert.ok(left > .02 && right < .98 && bottom < .95, `${name}'s card in the picture on ${screen.w} × ${screen.h}`);
        assert.ok(!overlap(card.box, screen.button) && top > screen.button[3], `${name}'s card below the copy's button on ${screen.w} × ${screen.h}`);
        assert.ok(left > catamaran - .025, `${name}'s card right of the catamaran on ${screen.w} × ${screen.h}: ${left.toFixed(3)} by ${catamaran.toFixed(3)}`);
        return card.box;
      });
      // Read in the Party's order, left to right, none over another (a
      // Party of four, which none is yet, may touch).
      if (n < 4) for (let i = 1; i < n; i++) assert.ok((cards[i][0] + cards[i][2]) / 2 > (cards[i - 1][0] + cards[i - 1][2]) / 2, `${names.join(', ')} in order on ${screen.w}`);
      if (n < 4) cards.forEach((a, i) => cards.slice(i + 1).forEach(b => assert.ok(!overlap(a, b), `${names.join(', ')}: cards clear of each other on ${screen.w} × ${screen.h}`)));
    }
  }
});

test('they come up the river as the catamaran rounds the bend and are settled in their berths as it is tied up', () => {
  assert.ok(GUEST_ARRIVAL.from < progressAt(DATES.wedding) && GUEST_ARRIVAL.from > progressAt(DATES.wedding) - .02, 'they set off before the wedding\'s date shows');
  assert.ok(GUEST_ARRIVAL.to < DOCKED && GUEST_ARRIVAL.to > VOYAGE_END + .04, 'settling as the catamaran moors');
  for (const screen of SCREENS) for (let n = 1; n <= 4; n++) {
    const { width, h } = screen, berths = guestBerths(n, width, h);
    for (const p of [0, GUEST_ARRIVAL.from - .001]) assert.ok(guestFleetPoses(p, n, width, h).every(pose => !pose.shown));
    for (const p of [GUEST_ARRIVAL.to, DOCKED, 1]) guestFleetPoses(p, n, width, h).forEach((pose, i) => {
      assert.ok(pose.shown && pose.settled === 1);
      for (const key of ['x', 'z', 'yaw', 'card']) assert.ok(Math.abs(pose[key] - berths[i][key]) < 1e-9, `${key} at its berth`);
    });
  }
});

test('on the way in they keep to the water, clear of the jetty, the catamaran coming in and each other, with no jumps', () => {
  const half = (CATAMARAN + HULL_HALF_BEAM.catamaran) * BOAT_SCALE, ends = [-1.5 * BOAT_SCALE, 1.15 * BOAT_SCALE];
  for (const screen of SCREENS.slice(0, 3)) for (let n = 1; n <= 4; n++) {
    const { width, h } = screen, length = GUEST_BOAT.halfLength * guestScale(width, h, n), beam = GUEST_BOAT.halfBeam * guestScale(width, h, n);
    let last = guestFleetPoses(GUEST_ARRIVAL.from, n, width, h);
    for (let p = GUEST_ARRIVAL.from; p <= DOCKED; p += .0005) {
      const poses = guestFleetPoses(p, n, width, h), cat = boatPose(p, width);
      poses.forEach((pose, i) => {
        if (!pose.shown) return;
        assert.ok(Math.hypot(pose.x - last[i].x, pose.z - last[i].z) < .5, `no jumps (${screen.w}, ${n}, ${p.toFixed(4)})`);
        // Bow, stern and either side.
        const s = Math.sin(pose.yaw), c = Math.cos(pose.yaw);
        for (const [u, v] of [[0, -length], [0, length], [beam, 0], [-beam, 0]]) {
          const x = pose.x + c * u + s * v, z = pose.z - s * u + c * v;
          assert.ok(Math.abs(x - riverCenter(z, width)) < bankEdge(z, width), `on the water (${screen.w}, ${n}, ${p.toFixed(4)})`);
          assert.ok(!underJetty(x, z, width), `clear of the jetty (${screen.w}, ${n}, ${p.toFixed(4)})`);
          // In the catamaran's frame: clear of its deck and hulls, with a margin.
          const dx = x - cat.x, dz = z - cat.z, cs = Math.cos(cat.yaw), sn = Math.sin(cat.yaw);
          const across = cs * dx - sn * dz, along = sn * dx + cs * dz;
          assert.ok(Math.abs(across) > half + .15 || along < ends[0] - .15 || along > ends[1] + .15, `clear of the catamaran (${screen.w}, ${n}, boat ${i}, ${p.toFixed(4)})`);
        }
        for (const other of poses.slice(i + 1)) if (other.shown) assert.ok(Math.hypot(pose.x - other.x, pose.z - other.z) > 1.2 * beam, `clear of each other (${screen.w}, ${n}, ${p.toFixed(4)})`);
      });
      last = poses;
    }
  }
});

test('they come into the picture well before they moor, coming up the river towards the camera', () => {
  for (const screen of SCREENS.slice(0, 2)) {
    const { width, h } = screen;
    // From when the copy starts to show, every boat is in the picture, low, under way.
    for (const p of [VOYAGE_END, (VOYAGE_END + DOCKED) / 2]) {
      const camera = lens(screen, cameraPose(p, width));
      for (const pose of guestFleetPoses(p, 3, width, h)) {
        const [x, y] = onScreen(camera, new THREE.Vector3(pose.x, .5, pose.z));
        assert.ok(pose.shown && x > 0 && x < 1 && y > .3 && y < 1, `in the picture at ${p.toFixed(3)} on ${screen.w}: ${x.toFixed(2)}, ${y.toFixed(2)}`);
      }
    }
    // They come upstream.
    const early = guestFleetPoses(GUEST_ARRIVAL.from + .01, 2, width, h), late = guestFleetPoses(VOYAGE_END, 2, width, h);
    early.forEach((pose, i) => assert.ok(late[i].z > pose.z + 3));
  }
});
