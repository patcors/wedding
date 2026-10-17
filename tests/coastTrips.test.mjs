import assert from 'node:assert/strict';
import test from 'node:test';
import { cameraPose } from '../src/components/garden/cameraRig.ts';
import { GARDEN_CAMERA, MOBILE_RIVER_WIDTH, VOYAGE, bankEdge, riverCenter } from '../src/components/garden/gardenGeometry.ts';
import { DATES, MILESTONES, ROOM, STOPS, progressAt, routeAt, stillProgress } from '../src/components/garden/journey.ts';
import { BOAT_SCALE, HULL_HALF_BEAM, boatPose } from '../src/components/garden/storyBoats.ts';
import { DUCKS, duckOnWater, piSpot } from '../src/components/garden/eggs/campus.ts';
import { eggTime } from '../src/components/garden/eggs/egg.ts';
import { YEAR_MARKERS, markerShown, yearMarkerSpot } from '../src/components/garden/eggs/yearMarkerSpots.ts';
import { COAST_TRIPS, FRIENDS, LAUNCH, PAPER, lightsAt, paperScale, throwSpot, tripSpan, tripTime, visitorSpot, visitorYaw } from '../src/components/garden/eggs/coastTrips.ts';

const LAYOUTS = [[false, 1, 1440 / 900, GARDEN_CAMERA.fov], [true, MOBILE_RIVER_WIDTH, 390 / 844, GARDEN_CAMERA.mobileFov]];
const degrees = radians => radians * 180 / Math.PI;
const coast = MILESTONES.find(m => m.egg === 'coast');
const first = COAST_TRIPS[0];
// About how far each year marker reaches from where it stands, across the ground.
const MARKER_REACH = { signpost: .5, rock: .8, buoy: .35, shed: .95, stake: .7, pile: .6, slate: .6, lantern: .45, steps: .9, arch: .9 };
// Idle times spanning the visitors' wandering either way.
const IDLES = [0, 5, 10, 15, 20];

// Every visitor out at p, with its trip's clock.
function out(p, width, idle = 0) {
  return COAST_TRIPS.flatMap(trip => {
    const t = tripTime(trip, p);
    return trip.visitors.map((visitor, i) => ({ trip, visitor, i, t, spot: visitorSpot(trip, visitor, t, p, width, idle) })).filter(v => v.spot);
  });
}
// Progress through each trip's window, finely.
function* through(trip, step = .01) {
  const { from, to } = tripSpan(trip), at = progressAt(trip.month);
  for (let t = from; t <= to + .05; t += step) yield at + t * ROOM;
}
// Where a point is in the picture: degrees right of its middle, and degrees above its bottom edge.
function inPicture(p, width, aspect, fov, x, y, z) {
  const { position: [cx, cy, cz], target: [tx, ty, tz] } = cameraPose(p, width);
  const bearing = degrees(Math.atan2(x - cx, cz - z) - Math.atan2(tx - cx, cz - tz));
  const pitch = degrees(Math.atan2(y - cy, Math.hypot(x - cx, z - cz)) - Math.atan2(ty - cy, Math.hypot(tx - cx, tz - cz)));
  return { bearing, side: degrees(Math.atan(Math.tan(fov / 2 * Math.PI / 180) * aspect)), above: pitch + fov / 2 };
}

test('November 2017 is the first trip away with friends, and the trips recur each November or December until 2023', () => {
  assert.equal(coast.id, 'coast');
  assert.equal(coast.month, '2017-11');
  assert.equal(first.month, coast.month);
  assert.deepEqual(COAST_TRIPS.map(trip => trip.month.slice(0, 4)), ['2017', '2018', '2019', '2020', '2021', '2022', '2023']);
  for (const trip of COAST_TRIPS) assert.ok(['11', '12'].includes(trip.month.slice(5)), trip.month);
  // Two parties: the first trip and one later.
  assert.deepEqual(COAST_TRIPS.filter(trip => trip.party).map(trip => trip.month), ['2017-11', '2019-11']);
  for (const trip of COAST_TRIPS) for (const { friend } of trip.visitors) assert.ok(FRIENDS[friend], `friend ${friend}`);
});

test('the first fleet is tossed in from the bank while November 2017 holds', () => {
  const launched = first.visitors.filter(v => v.launch);
  assert.ok(launched.length >= 3);
  for (const width of [1, MOBILE_RIVER_WIDTH]) {
    for (const visitor of launched) {
      assert.ok(visitor.launch.at > 0 && visitor.launch.at < .3, 'launched while the date holds');
      assert.ok(Math.abs(visitor.keys[0][0] - visitor.launch.at - LAUNCH.settle) < 1e-9, 'caught up at its first key');
      const from = throwSpot(first, visitor, width);
      assert.ok(Math.abs(from.x - riverCenter(from.z, width)) > bankEdge(from.z, width), 'thrown from the bank');
      // Lands a boat's length ahead of the bows, so none is thrown at the boats, and away from the π.
      const p = progressAt(first.month) + visitor.launch.at * ROOM;
      const spot = visitorSpot(first, visitor, visitor.launch.at, p, width);
      assert.ok(spot.z < routeAt(p) - 1.8, `lands ${routeAt(p) - spot.z} ahead`);
      const pi = piSpot(width < 1, width);
      assert.ok(Math.hypot(from.x - pi.x, from.z - pi.z) > 2, `thrown ${Math.hypot(from.x - pi.x, from.z - pi.z)} from the π`);
    }
  }
});

test('each trip comes and goes: nothing is out before November 2017, between trips or after 2023', () => {
  for (const width of [1, MOBILE_RIVER_WIDTH]) {
    assert.equal(out(progressAt('2017-07'), width).length, 0);
    assert.equal(out(progressAt(first.month) - .001, width).length, 0);
    COAST_TRIPS.forEach((trip, k) => {
      const { to } = tripSpan(trip), next = COAST_TRIPS[k + 1];
      const end = progressAt(trip.month) + (to + .05) * ROOM;
      for (const idle of IDLES) assert.equal(out(end, width, idle).filter(v => v.trip === trip).length, 0, `${trip.month} gone`);
      // Gone before the next trip's boats come.
      if (next) assert.ok(end < progressAt(next.month) + tripSpan(next).from * ROOM, `${trip.month} before ${next.month}`);
    });
    // All gone before the boats start to join.
    for (let p = progressAt(DATES.dating); p < 1; p += .005) assert.equal(out(p, width).length, 0);
  }
});

test('paper boats drift with the current: none falls back past the boats much faster than they sail', () => {
  const pace = routeAt(progressAt('2019-01')) - routeAt(progressAt('2019-01') + ROOM);
  for (const width of [1, MOBILE_RIVER_WIDTH]) {
    for (const trip of COAST_TRIPS) {
      const at = progressAt(trip.month);
      trip.visitors.forEach(visitor => {
        let last = null;
        for (let t = tripSpan(trip).from; t <= tripSpan(trip).to; t += .005) {
          const p = at + t * ROOM, spot = visitorSpot(trip, visitor, t, p, width);
          const v = spot && spot.z - routeAt(p);
          // At most a unit a share upstream, too slow to see.
          if (last !== null && v !== null) assert.ok((v - last) / .005 < pace + 1, `${trip.month} friend ${visitor.friend} falls back at ${((v - last) / .005).toFixed(1)} a share at ${t.toFixed(3)}`);
          last = v;
        }
      });
    }
  }
});

test('each party is over before the next milestone\'s date', () => {
  for (const trip of COAST_TRIPS.filter(trip => trip.party)) {
    const at = progressAt(trip.month), next = MILESTONES.find(m => progressAt(m.month) > at + 1e-9);
    assert.ok(at + trip.party.lights[3] * ROOM < progressAt(next.month), `${trip.month}'s lights out before ${next.id}`);
  }
});

test('the visitors keep to the water, clear of the banks and the island', () => {
  for (const [, width] of LAYOUTS) {
    for (const trip of COAST_TRIPS) for (const p of through(trip)) for (const idle of IDLES) {
      for (const { trip: its, spot, t } of out(p, width, idle)) {
        const half = PAPER.beam * paperScale(width);
        assert.ok(Math.abs(spot.x - riverCenter(spot.z, width)) + half < bankEdge(spot.z, width) - .1, `${its.month} on the water at ${t}`);
        assert.ok(spot.z < VOYAGE.island.to - 1, 'past the island');
      }
    }
  }
});

// Whether a visitor (or with `paper` false, a point) keeps clear of the
// story hulls' footprints, in the hulls' frame.
function clearOfHulls(p, width, spot, yaw, paper = true) {
  const pose = boatPose(p, width), scale = paperScale(width);
  const half = HULL_HALF_BEAM.dinghy * BOAT_SCALE, bow = .78 * BOAT_SCALE, stern = .66 * BOAT_SCALE;
  const turn = Math.abs(yaw - pose.yaw) + Math.abs(pose.turn);
  const across = paper ? PAPER.beam * scale + PAPER.bow * scale * Math.sin(turn) : 0, lengthwise = paper ? PAPER.bow * scale : 0;
  return [-1, 1].every(side => {
    const dx = spot.x - pose.x, dz = spot.z - pose.z, c = Math.cos(pose.yaw), s = Math.sin(pose.yaw);
    const u = dx * c - dz * s - side * pose.gap * BOAT_SCALE, w = dx * s + dz * c;
    return Math.abs(u) > half + across + .03 || w < -bow - lengthwise - .03 || w > stern + lengthwise + .03;
  });
}
// How far a point is from a visitor's paper footprint.
function fromPaper(spot, yaw, width, x, z) {
  const scale = paperScale(width), c = Math.cos(yaw), s = Math.sin(yaw), dx = x - spot.x, dz = z - spot.z;
  const u = Math.abs(dx * c - dz * s) - PAPER.beam * scale, w = Math.abs(dx * s + dz * c) - PAPER.bow * scale;
  return Math.hypot(Math.max(0, u), Math.max(0, w));
}

test('the visitors keep clear of the story boats, beside them and as they pass', () => {
  for (const [, width] of LAYOUTS) {
    for (const trip of COAST_TRIPS) for (const p of through(trip, .005)) for (const idle of IDLES) {
      for (const { trip: its, visitor, spot, t } of out(p, width, idle)) {
        const yaw = visitorYaw(its, visitor, t, p, width, idle);
        assert.ok(clearOfHulls(p, width, spot, yaw), `${its.month} friend ${visitor.friend} at ${t.toFixed(3)} (width ${width})`);
      }
    }
  }
});

test('the visitors keep clear of each other, the year markers and the ducks', () => {
  for (const [, width] of LAYOUTS) {
    const markers = YEAR_MARKERS.map(marker => yearMarkerSpot(marker, width));
    const scale = paperScale(width);
    for (const trip of COAST_TRIPS) for (const p of through(trip)) for (const idle of [0, 10]) {
      const boats = out(p, width, idle), cameraZ = cameraPose(p, width).position[2];
      boats.forEach(({ trip: its, spot, visitor, t }, i) => {
        for (const other of boats.slice(i + 1)) {
          assert.ok(Math.hypot(spot.x - other.spot.x, spot.z - other.spot.z) > PAPER.beam * scale * 2 + .1, `${its.month} friends ${visitor.friend} and ${other.visitor.friend} at ${t.toFixed(2)}`);
        }
        // Only what is in front of the camera can be seen to meet.
        if (spot.z > cameraZ - 4) return;
        const yaw = visitorYaw(its, visitor, t, p, width, idle);
        markers.forEach((marker, k) => {
          if (!markerShown(marker.z, cameraZ, width < 1)) return;
          const gap = fromPaper(spot, yaw, width, marker.x, marker.z) - MARKER_REACH[YEAR_MARKERS[k].medium] * marker.scale;
          assert.ok(gap > .1, `${its.month} friend ${visitor.friend} ${gap.toFixed(2)} from ${YEAR_MARKERS[k].year}'s marker at ${t.toFixed(2)} (width ${width})`);
        });
        const sinceMeet = (p - progressAt('2017-07')) / ROOM;
        if (sinceMeet < DUCKS.gone) DUCKS.launches.forEach((_, d) => {
          const duck = duckOnWater(d, sinceMeet, width);
          assert.ok(fromPaper(spot, yaw, width, duck.x, duck.z) > .45, `friend ${visitor.friend} by duck ${d} at ${t.toFixed(2)} (width ${width})`);
        });
      });
    }
  }
});

test('the first fleet is in the picture at November 2017\'s stop and both parties in full while their lights are up', () => {
  const stop = STOPS.find(s => s > progressAt(first.month) && s < progressAt(first.month) + ROOM);
  for (const [, width, aspect, fov] of LAYOUTS) {
    const check = (p, label, launched = false) => {
      const boats = out(p, width).filter(({ spot, visitor }) => spot.shown > .5 && (!launched || visitor.launch));
      for (const { spot, visitor } of boats) {
        const { bearing, side, above } = inPicture(p, width, aspect, fov, spot.x, 0, spot.z);
        assert.ok(Math.abs(bearing) < side - 2 && above > 1, `${label}: friend ${visitor.friend} at ${bearing.toFixed(1)}°, ${above.toFixed(1)}° up (width ${width})`);
      }
      return boats.length;
    };
    // The launched boats; the rest are still coming up from below the picture.
    assert.ok(check(stop, 'the stop', true) >= 2, 'some launched by the stop');
    for (const trip of COAST_TRIPS.filter(trip => trip.party)) {
      const [, full, dim] = trip.party.lights;
      for (const t of [full, (full + dim) / 2, dim]) {
        const p = progressAt(trip.month) + t * ROOM;
        assert.equal(lightsAt(trip, t), 1);
        assert.equal(check(p, `${trip.month} party`), trip.visitors.length, `${trip.month}: everyone at the party`);
      }
    }
  }
});

test('the party\'s strings of lights run round the boats, not across them', () => {
  for (const [, width] of LAYOUTS) {
    for (const trip of COAST_TRIPS.filter(trip => trip.party)) {
      const [up, , , out] = trip.party.lights;
      for (let t = up; t <= out; t += .01) {
        const p = progressAt(trip.month) + t * ROOM;
        for (const [a, b] of trip.party.strings) {
          const from = visitorSpot(trip, trip.visitors[a], t, p, width), to = visitorSpot(trip, trip.visitors[b], t, p, width);
          assert.ok(from && to, `${trip.month} string ${a}–${b} has both ends out at ${t}`);
          for (let k = 0; k <= 1; k += .1) {
            const spot = { x: from.x + (to.x - from.x) * k, z: from.z + (to.z - from.z) * k };
            assert.ok(clearOfHulls(p, width, spot, 0, false), `${trip.month} string ${a}–${b} at ${t.toFixed(2)}`);
          }
        }
      }
    }
  }
});

test('under reduced motion, November 2017\'s still shows the first fleet at its party, at rest', async () => {
  const { FLEET } = await import('../src/components/garden/eggs/coastTrips.ts');
  const still = stillProgress(progressAt(coast.month) + ROOM * .2);
  const t = eggTime(coast, still, true, FLEET.settled);
  assert.equal(t, FLEET.settled);
  assert.equal(lightsAt(first, t), 1);
  for (const width of [1, MOBILE_RIVER_WIDTH]) {
    const sinceMeet = (still - progressAt('2017-07')) / ROOM;
    for (const visitor of first.visitors) {
      const spot = visitorSpot(first, visitor, t, still, width);
      assert.ok(spot, `friend ${visitor.friend} out`);
      // Clear of the ducks, which the still shows where they are on its date.
      const yaw = visitorYaw(first, visitor, t, still, width);
      DUCKS.launches.forEach((_, d) => {
        const duck = duckOnWater(d, sinceMeet, width);
        assert.ok(fromPaper(spot, yaw, width, duck.x, duck.z) > .45, `friend ${visitor.friend} by duck ${d} (width ${width})`);
      });
    }
  }
});
