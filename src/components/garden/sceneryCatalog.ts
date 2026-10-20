// Every scenery piece on the voyage, for the timeline (voyageTimeline.ts,
// /dev/timeline, scripts/voyage-timeline.mjs): where each is and when its own
// logic shows it, on one layout. Built from the scene's own exported spots,
// show/hide functions and geometry, so the chart can't drift from the scene;
// the few numbers that live only inside a component are named in COMPONENT
// below, and tests/voyageTimeline.test.mjs checks them against its source.
// Pure (no DOM), so it runs in Node and in the page's frontmatter.
//
// Real-time pieces (the ducks' and caps' tosses, the birds' flights, the
// salsa turn, the proposal's steps) play in seconds once the
// scroll reaches their cue, so at a fixed p the timeline shows where they come
// to rest, and counts the event itself from its cue to its own `late`, past
// which a guest arriving finds it done.
import * as THREE from 'three';
import { VOYAGE, bankEdge, islandHalfWidth, islandSpan, launchJetties, pointSpot, riverCenter, rockHalfWidth, voyageLandmarks } from './gardenGeometry.ts';
import { treeBase } from './gardenTreeSpots.ts';
import { DATES, MILESTONES, ROOM, progressAt, scrolledSince } from './journey.ts';
import { SALSA, boatPose, catamaran, companyFlags, joining, rigging, salsaTime, universityFlag, type Company } from './storyBoats.ts';
import { HULL } from './storyBoatGeometry.ts';
import { rubberDuck } from './rubberDuckGeometry.ts';
import { DUCKS, duckOnWater, duckScale, piSpot } from './eggs/campus.ts';
import { piSculptureGeometry } from './eggs/piSculptureGeometry.ts';
import { growth } from './eggs/egg.ts';
import { ORNAMENTS as UNI, CARVINGS, carvedOn, carvedTree, carvingFaces, carvingShown, grownCut, ornamentSpot as uniSpot, type CarvingId } from './eggs/uniOrnaments.ts';
import { MOBIUS_PLINTH, mobiusGeometry } from './eggs/mobiusGeometry.ts';
import { BENCH, parkBenchGeometry } from './eggs/parkBenchGeometry.ts';
import { TRUNK_RADIUS, YEAR_MARKERS, markerShown, yearCarving, yearMarkerShown, yearMarkerSpot, type YearMarker } from './eggs/yearMarkerSpots.ts';
import { yearMarkerModel } from './eggs/yearMarkerGeometry.ts';
import { CANDLESTICKS, PIE, PIE_BED, candleBoxes, ornamentShown, ornamentSpot } from './eggs/careerSpots.ts';
import { FLURRY, SNOW_GROW, SNOW_SPOTS, snowSpot } from './eggs/flurry.ts';
import { holdingHandsGeometry, snowmanGeometry } from './eggs/snowmanGeometry.ts';
import { CAPS, capLanding, capScale } from './eggs/capToss.ts';
import { mortarboardGeometry } from './eggs/mortarboardGeometry.ts';
import { harbourShown } from './eggs/harbour.ts';
import { harbourGeometry } from './eggs/sydneyGeometry.ts';
import { RIGS, hangSpot, rigShown, type RigId } from './eggs/circusRigs.ts';
import { LYRA_SHAPE } from './eggs/circusGeometry.ts';
import { NEST_EVENTS, nestSpots, nestTriggers, signTree, SIGN } from './eggs/nesting.ts';
import { BIRDHOUSE } from './eggs/birdhouseGeometry.ts';
import { BLADE } from './eggs/streetSign.ts';
import { FLYERS, courtshipTime, flying } from './eggs/datingFlight.ts';
import { truckShown, truckSpot } from './eggs/engagementTruck.ts';
import { truckGeometry } from './eggs/truckGeometry.ts';
import { petalTime, petalsShown } from './eggs/petalTrail.ts';
import { PROPOSAL, proposalTime } from './eggs/proposal.ts';
import { BALLOONS, BALLOON_TIMES, HAGIA_TIMES, balloonSpot, hagiaShown, hagiaSophiaSpot } from './eggs/balloonCourse.ts';
import { balloonGeometry } from './eggs/balloonGeometry.ts';
import { hagiaSophiaGeometry } from './eggs/hagiaSophiaGeometry.ts';
import { bulletShown, bulletSpot } from './eggs/bulletOrnament.ts';
import type { Bank, Piece, Sphere } from './voyageTimeline.ts';

// Numbers the scene keeps inside its components, copied here and checked
// against their source by the test: the snow trips' size (`scale` in
// SnowTrip.tsx and SecondSnowTrip.tsx, and SnowReveal's portrait factor), the
// flurry's box (half extents, SnowReveal.tsx), and how far the silk and the
// lyra hang clear of the ground (Circus.tsx).
export const COMPONENT = {
  snowScale: 1.25, snowMobile: .9,
  flurryBox: { across: 3.4, up: 3.4, along: 3.4 },
  silkClear: .15, lyraClear: 1.1,
} as const;

type Spot = { x: number; y: number; z: number; yaw?: number; scale?: number };
// A geometry's bounding sphere in its own frame, worked out once.
const bounds = new Map<string, Sphere>();
function local(key: string, build: () => THREE.BufferGeometry): Sphere {
  if (!bounds.has(key)) {
    const geometry = build();
    geometry.computeBoundingSphere();
    const { center, radius } = geometry.boundingSphere!;
    bounds.set(key, { centre: [center.x, center.y, center.z], radius });
    geometry.dispose();
  }
  return bounds.get(key)!;
}
// That sphere where a piece stands: turned by its yaw about +y, scaled, moved.
function placed({ centre: [x, y, z], radius }: Sphere, { x: px, y: py, z: pz, yaw = 0, scale = 1 }: Spot): Sphere {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return { centre: [px + (x * c + z * s) * scale, py + y * scale, pz + (-x * s + z * c) * scale], radius: radius * scale };
}
const sphere = (x: number, y: number, z: number, radius: number): Sphere => ({ centre: [x, y, z], radius });

// The bank a spot is on: either side of the river's middle past its banks, or the river.
export function bankOf(x: number, z: number, width: number): Bank {
  const out = x - riverCenter(z, width);
  return Math.abs(out) <= bankEdge(z, width) ? 'river' : out < 0 ? 'left' : 'right';
}
const sideBank = (side: number): Bank => side < 0 ? 'left' : 'right';
const on = (value: boolean) => value ? 1 : 0;
const monthOf = (id: string) => MILESTONES.find(m => m.id === id)!.month;

// The boats, for whatever rides on them: round both hulls and up to the masthead.
function boats(p: number, width: number, extra = 0): Sphere[] {
  const pose = boatPose(p, width), half = HULL.mastTop * pose.scale / 2;
  return [sphere(pose.x, half, pose.z, Math.hypot(pose.gap * pose.scale + .5, half) + extra)];
}

export function sceneryCatalog(width: number): Piece[] {
  const mobile = width < 1, pieces: Piece[] = [];
  const add = (piece: Piece) => pieces.push(piece);

  // --- Milestone eggs -------------------------------------------------------
  const meet = monthOf('meet');
  {
    const spot = piSpot(mobile, width), s = placed(local('pi', piSculptureGeometry), spot);
    add({ id: 'pi', name: 'π sculpture', group: 'Milestone eggs', file: 'eggs/PiSculpture.tsx', bank: bankOf(spot.x, spot.z, width), counts: true,
      shown: (p, cameraZ) => on(scrolledSince(meet, p) > -1.2 && cameraZ > spot.z - 2), spheres: () => [s] });
  }
  {
    const duck = local('duck', () => rubberDuck().geometry), scale = duckScale(mobile);
    add({ id: 'ducks', name: 'Rubber ducks', group: 'Milestone eggs', file: 'eggs/Ducks.tsx', bank: sideBank(mobile ? DUCKS.side.mobile : DUCKS.side.desktop), counts: true,
      note: 'Each toss plays in .75s; drawn where it bobs on the water.',
      shown: p => { const t = scrolledSince(meet, p); return on(t > 0 && t < DUCKS.gone); },
      spheres: p => {
        const t = scrolledSince(meet, p);
        return DUCKS.launches.flatMap((launch, i) => t < launch.at ? [] : [placed(duck, { ...duckOnWater(i, t, width), y: 0, scale })]);
      } });
  }
  const snow = (year: 2019 | 2025, milestone: string, model: () => THREE.BufferGeometry, what: string, file: string) => {
    const month = monthOf(milestone), spot = snowSpot(SNOW_SPOTS[year], month, width);
    const scale = COMPONENT.snowScale * (mobile ? COMPONENT.snowMobile : 1) * growth(mobile, SNOW_GROW), box = COMPONENT.flurryBox;
    const passed = (cameraZ: number) => cameraZ > spot.z - 2, bank = bankOf(spot.x, spot.z, width);
    const flurry = sphere(spot.x, box.up * scale / 2, spot.z, Math.hypot(box.across, box.up / 2, box.along) * scale * .6);
    add({ id: `flurry-${year}`, name: `Snow flurry (${year})`, group: 'Milestone eggs', file: 'eggs/SnowReveal.tsx', bank, counts: true,
      shown: (p, cameraZ) => { const t = scrolledSince(month, p); return on(t > 0 && t < FLURRY.gone && passed(cameraZ)); }, spheres: () => [flurry] });
    const figure = placed(local(`snow-${year}`, model), { ...spot, scale });
    add({ id: `snow-${year}`, name: what, group: 'Milestone eggs', file, bank, counts: true,
      shown: (p, cameraZ) => { const t = scrolledSince(month, p); return on(t >= FLURRY.reveal && passed(cameraZ)); }, spheres: () => [figure] });
  };
  snow(2019, 'snow-2019', () => snowmanGeometry({ sling: true }), 'Snowman with a sling (2019)', 'eggs/SnowTrip.tsx');
  {
    const month = monthOf('graduation'), cap = local('cap', mortarboardGeometry), scale = capScale(mobile);
    CAPS.tosses.forEach(toss => {
      const to = capLanding(month, toss, width), s = placed(cap, { ...to, scale });
      add({ id: `cap-${toss.side < 0 ? 'amelia' : 'patrick'}`, name: `${toss.side < 0 ? "Amelia's" : "Patrick's"} mortarboard`, group: 'Milestone eggs',
        file: 'eggs/Graduation.tsx', bank: bankOf(to.x, to.z, width), counts: true, note: 'Its toss plays in 1.9s; drawn where it lands.',
        shown: (p, cameraZ) => on(scrolledSince(month, p) > CAPS.tosses[0].at && cameraZ > to.z - 2), spheres: () => [s] });
    });
  }
  {
    const geometry = harbourGeometry(width);
    for (const key of ['bridge', 'opera'] as const) {
      const { center, radius } = geometry[key].boundingSphere!, s = sphere(center.x, center.y, center.z, radius);
      add({ id: key, name: key === 'bridge' ? 'Harbour Bridge' : 'Opera House', group: 'Milestone eggs', file: 'eggs/Sydney.tsx',
        bank: sideBank(VOYAGE.point.side), counts: true,
        shown: (p, cameraZ) => harbourShown(p, cameraZ, mobile)[key], spheres: () => [s] });
    }
    geometry.opera.dispose(); geometry.bridge.dispose();
  }
  {
    const houses = nestSpots(width), triggers = nestTriggers(), build = NEST_EVENTS.findIndex(e => e.build);
    const passed = (cameraZ: number) => cameraZ > Math.min(houses.amelia.z, houses.patrick.z) - 2;
    const house = (spot: typeof houses.amelia) => sphere(spot.x, spot.y + BIRDHOUSE.height * spot.scale / 2, spot.z, BIRDHOUSE.height * spot.scale * .7);
    for (const owner of ['amelia', 'patrick'] as const) {
      const s = house(houses[owner]);
      add({ id: `birdhouse-${owner}`, name: `${owner === 'amelia' ? "Amelia's" : "Patrick's"} birdhouse`, group: 'Milestone eggs', file: 'eggs/Birdhouses.tsx',
        bank: bankOf(houses[owner].x, houses[owner].z, width), counts: true,
        shown: (p, cameraZ) => on(p >= triggers[build] && passed(cameraZ)), spheres: () => [s] });
    }
    const names = ['Both birds fly in to hers', "Patrick's bird flies home", "Amelia's bird flies over to his"];
    NEST_EVENTS.forEach((event, i) => {
      if (!event.moves) return;
      add({ id: `birds-${i}`, name: names.shift()!, group: 'Milestone eggs', file: 'eggs/Birdhouses.tsx', bank: 'river', counts: true,
        note: 'A flight plays in 1.5s; counted from its cue to .25 of a share on.',
        shown: (p, cameraZ) => on(p >= triggers[i] && p <= triggers[i] + .25 * ROOM && passed(cameraZ)), spheres: () => [house(houses.amelia), house(houses.patrick)] });
    });
    const tree = signTree(width), y = treeBase(tree, width) + (mobile ? SIGN.height.mobile : SIGN.height.desktop);
    const blade = sphere(tree.x, y, tree.z, BLADE.length * (mobile ? BLADE.mobile : 1) / 2);
    add({ id: 'church-st', name: 'Church St sign', group: 'Milestone eggs', file: 'eggs/Birdhouses.tsx', bank: 'left', counts: true,
      shown: (_, cameraZ) => carvingShown({ ...tree, y }, cameraZ), spheres: () => [blade] });
  }
  snow(2025, 'snow-2025', () => holdingHandsGeometry({ scarf: '#4d827f' }, { scarf: '#e3c46a' }), 'Snowmen holding hands (2025)', 'eggs/SecondSnowTrip.tsx');
  {
    const month = monthOf('turkey-greece'), shell = local('balloon', () => balloonGeometry().geometry);
    const flown = BALLOONS.flatMap((_, i) => balloonSpot(progressAt(month), 0, mobile, width, i) ? [i] : []);
    const { arrive, climb, gone } = BALLOON_TIMES;
    const smooth = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
    add({ id: 'balloons', name: `Hot-air balloons (${flown.length})`, group: 'Milestone eggs', file: 'eggs/Balloon.tsx', bank: 'river', counts: true, fog: false,
      shown: p => { const t = scrolledSince(month, p); return t > -.05 && t < gone ? smooth(t / arrive) * (1 - smooth((t - climb) / (gone - climb))) : 0; },
      spheres: p => {
        const t = scrolledSince(month, p);
        return flown.map(i => { const { position: [x, y, z], scale } = balloonSpot(p, t, mobile, width, i)!; return placed(shell, { x, y, z, scale }); });
      } });
    const spot = hagiaSophiaSpot(month, width), s = placed(local('hagia', hagiaSophiaGeometry), spot);
    add({ id: 'hagia-sophia', name: 'Hagia Sophia', group: 'Milestone eggs', file: 'eggs/HagiaSophia.tsx', bank: bankOf(spot.x, spot.z, width), counts: true, fog: false,
      note: `Seen far off down the river, ${HAGIA_TIMES.arrive} to ${HAGIA_TIMES.gone} shares round its date.`,
      shown: p => hagiaShown(scrolledSince(month, p)), spheres: () => [s] });
  }

  // --- Ornaments: the university years, working lives, the circus, the truck, the bullet
  for (const id of ['mobius', 'bench'] as const) {
    const footprint = id === 'mobius' ? MOBIUS_PLINTH.width / 2 : BENCH.length / 2, spot = uniSpot(UNI[id], width, footprint);
    const s = placed(local(id, id === 'mobius' ? mobiusGeometry : parkBenchGeometry), spot);
    add({ id, name: id === 'mobius' ? 'Möbius sculpture' : 'Park bench', group: 'Ornaments', file: `eggs/${id === 'mobius' ? 'MobiusSculpture' : 'ParkBench'}.tsx`,
      bank: bankOf(spot.x, spot.z, width), counts: true, shown: (_, cameraZ) => markerShown(spot.z, cameraZ, mobile), spheres: () => [s] });
  }
  {
    const boxes = candleBoxes(), reach = Math.max(...boxes.map(b => Math.abs(b.x) + b.width / 2)), top = Math.max(...boxes.map(b => b.y + b.height / 2));
    const candles: Sphere = { centre: [0, top / 2, 0], radius: Math.hypot(reach, top / 2) };
    const bed: Sphere = { centre: [0, .1, 0], radius: PIE.radius * PIE.stretch };
    for (const [ornament, id, name, shape] of [[CANDLESTICKS, 'candlesticks', 'Candlestick posts', candles], [PIE_BED, 'pie-bed', 'Pie-chart flower bed', bed]] as const) {
      const spot = ornamentSpot(ornament, width), s = placed(shape, spot);
      add({ id, name, group: 'Ornaments', file: 'eggs/Careers.tsx', bank: bankOf(spot.x, spot.z, width), counts: true,
        shown: (p, cameraZ) => ornamentShown(ornament, spot, p, cameraZ, mobile), spheres: () => [s] });
    }
  }
  {
    const names: Record<RigId, string> = { silk: 'Aerial silk', lyra: 'Lyra' };
    for (const id of Object.keys(RIGS) as RigId[]) {
      const rig = RIGS[id], spot = hangSpot(rig, width);
      let s: Sphere;
      if (id === 'silk') {
        const bottom = spot.ground + COMPONENT.silkClear;
        s = sphere(spot.x, (spot.y + bottom) / 2, spot.z, (spot.y - bottom) / 2 + .2);
      } else {
        const drop = Math.max(.4, (spot.y - spot.ground - COMPONENT.lyraClear) / spot.scale - LYRA_SHAPE.radius * 2);
        s = sphere(spot.x, spot.y - (drop + LYRA_SHAPE.radius) * spot.scale, spot.z, LYRA_SHAPE.radius * spot.scale * 1.1);
      }
      add({ id, name: names[id], group: 'Ornaments', file: 'eggs/Circus.tsx', bank: bankOf(spot.x, spot.z, width), counts: true,
        shown: (p, cameraZ) => rigShown(rig, spot, p, cameraZ, mobile), spheres: () => [s] });
    }
  }
  {
    const spot = truckSpot(width), s = placed(local('truck', truckGeometry), spot);
    add({ id: 'truck', name: 'Engagement truck', group: 'Ornaments', file: 'eggs/EngagementTruck.tsx', bank: bankOf(spot.x, spot.z, width), counts: true,
      shown: p => truckShown(p), spheres: () => [s] });
  }
  {
    // Upright, 1 tall in its own units, plinth to tip.
    const spot = bulletSpot(width), s = sphere(spot.x, spot.y + spot.scale / 2, spot.z, spot.scale * .52);
    add({ id: 'bullet', name: 'Bullet garden ornament', group: 'Ornaments', file: 'eggs/BulletOrnament.tsx', bank: bankOf(spot.x, spot.z, width), counts: true,
      shown: (p, cameraZ) => bulletShown(spot, p, cameraZ, mobile), spheres: () => [s] });
  }

  // --- Carvings in the bark -------------------------------------------------
  const carvingNames: Record<CarvingId, string> = { stats: 'Statistics carving', algebra: 'Quadratic formula carving', sloop: 'Sloop carving',
    spiral: 'Golden spiral carving', sloops: 'Two sloops carving', heart: 'P + A heart carving' };
  for (const id of Object.keys(CARVINGS) as CarvingId[]) {
    const carving = grownCut(CARVINGS[id], width);
    if (!carvedOn(carving, width)) continue;
    const tree = carvedTree(carving, width), faces = carvingFaces(carving, width), toward = Math.atan2(faces.x - tree.x, faces.z - tree.z);
    const r = TRUNK_RADIUS * tree.scale;
    const s = sphere(tree.x + Math.sin(toward) * r, tree.y + (carving.from + carving.to) / 2 * tree.scale, tree.z + Math.cos(toward) * r,
      Math.max((carving.to - carving.from) / 2, carving.arc * TRUNK_RADIUS) * tree.scale);
    add({ id: `carving-${id}`, name: carvingNames[id], group: 'Carvings', file: 'eggs/BarkCarvings.tsx', bank: sideBank(carving.side), counts: true,
      shown: (p, cameraZ) => carvingShown(tree, cameraZ, p, 'after' in carving ? carving.after : undefined), spheres: () => [s] });
  }

  // --- Year markers ---------------------------------------------------------
  YEAR_MARKERS.forEach((marker: YearMarker, i) => {
    const spot = yearMarkerSpot(marker, width);
    let s: Sphere, z = spot.z;
    if ('carved' in marker) {
      const { tree, carving } = yearCarving(marker, width);
      z = tree.z;
      s = sphere(spot.x, spot.y, spot.z, Math.max((carving.to - carving.from) / 2, carving.arc * TRUNK_RADIUS) * tree.scale);
    } else s = placed(local(`year-${marker.year}`, () => yearMarkerModel({ ...marker, medium: marker.medium as Exclude<typeof marker.medium, 'carving'> }, i).body), spot);
    add({ id: `year-${marker.year}`, name: `${marker.year} ${marker.medium}`, group: 'Year markers', file: 'eggs/YearMarkers.tsx',
      bank: 'share' in marker ? 'river' : sideBank(marker.side), counts: true,
      shown: (p, cameraZ) => yearMarkerShown(marker, z, p, cameraZ, mobile), spheres: () => [s] });
  });

  // --- On the boats ---------------------------------------------------------
  const moving = (k: number) => k > 0 && k < 1;
  add({ id: 'uni-flag', name: 'UOW flags', group: 'On the boats', file: 'storyBoats.ts', bank: 'river', counts: p => moving(universityFlag(p)),
    note: 'Counted only while going up or coming down.', shown: p => on(universityFlag(p) > 0), spheres: p => boats(p, width) });
  const flags: [number, Company, string][] = [[0, 'finocomp', "Amelia's FinoComp flag"], [1, 'finocomp', "Patrick's FinoComp flag"],
    [0, 'interim', "Amelia's interim flag"], [0, 'heirwealth', "Amelia's HeirWealth flag"], [1, 'heirwealth', "Patrick's HeirWealth flag"]];
  for (const [k, company, name] of flags) {
    const flag = (p: number) => companyFlags(p)[k];
    add({ id: `flag-${k ? 'patrick' : 'amelia'}-${company}`, name, group: 'On the boats', file: 'storyBoats.ts', bank: k ? 'right' : 'left',
      note: 'Counted only while going up or coming down.',
      counts: p => moving(flag(p).hoist), shown: p => on(flag(p).company === company), spheres: p => boats(p, width) });
  }
  {
    const dating = DATES.dating;
    add({ id: 'butterflies', name: 'Dating butterflies', group: 'On the boats', file: 'eggs/DatingButterflies.tsx', bank: 'river', counts: true,
      shown: p => on(FLYERS.some(flyer => flying(flyer, courtshipTime(p)))), spheres: p => boats(p, width, 1) });
    add({ id: 'joining', name: 'Joining into a catamaran', group: 'On the boats', file: 'storyBoats.ts', bank: 'river',
      note: 'Counted while the crossbeams go across; the planks follow over a year and a half.',
      counts: p => catamaran(joining(p)).beams.some(moving), shown: p => on(scrolledSince(dating, p) >= 0 && joining(p) < 1), spheres: p => boats(p, width) });
  }
  add({ id: 'salsa', name: 'Salsa turn', group: 'On the boats', file: 'storyBoats.ts', bank: 'river', counts: true,
    note: `Plays in ${SALSA.seconds}s; counted from its cue to its \`late\`.`,
    shown: p => { const t = salsaTime(p); return on(t >= SALSA.cue && t <= SALSA.late); }, spheres: p => boats(p, width) });
  add({ id: 'rig-change', name: 'Change of masts', group: 'On the boats', file: 'storyBoats.ts', bank: 'river', counts: true,
    shown: p => on(Object.values(rigging(p)).some(moving)), spheres: p => boats(p, width) });
  add({ id: 'proposal', name: 'Proposal on the deck', group: 'On the boats', file: 'eggs/Proposal.tsx', bank: 'river',
    note: 'Counted from coming out on deck until he has stood; they then ride on hand in hand.',
    counts: p => proposalTime(p) <= PROPOSAL.rise.cue + PROPOSAL.late, shown: p => on(proposalTime(p) >= PROPOSAL.appear.cue), spheres: p => boats(p, width) });
  add({ id: 'petals', name: 'Rose petals', group: 'On the boats', file: 'eggs/EngagementPetals.tsx', bank: 'river', counts: true,
    shown: p => on(petalsShown(petalTime(p))), spheres: p => boats(p, width, 1) });
  add({ id: 'monogram', name: 'Monogram flag', group: 'On the boats', file: 'storyBoats.ts', bank: 'river', counts: false,
    shown: p => on(rigging(p).hoist > 0), spheres: p => boats(p, width) });

  // --- The river's landforms (drawn, not counted) ---------------------------
  const always = () => 1;
  for (const jetty of launchJetties(width)) {
    const s = sphere(jetty.x - jetty.side * jetty.reach / 2, .3, jetty.z, Math.max(jetty.reach, jetty.head) / 2 + .3);
    add({ id: `jetty-${jetty.side < 0 ? 'amelia' : 'patrick'}`, name: `${jetty.side < 0 ? "Amelia's" : "Patrick's"} launch jetty`, group: 'World',
      file: 'VoyageWorld.tsx', bank: sideBank(jetty.side), counts: false, shown: always, spheres: () => [s] });
  }
  const along = (from: number, to: number, half: (z: number) => number) => {
    const out: Sphere[] = [];
    for (let z = from; z >= to; z -= 1.5) if (half(z) > 0) out.push(sphere(riverCenter(z, width), .4, z, Math.max(half(z), .75)));
    return out;
  };
  const island = along(islandSpan(width).from, islandSpan(width).to, z => islandHalfWidth(z, width));
  add({ id: 'island', name: 'Island and reeds', group: 'World', file: 'voyageIsland.ts', bank: 'river', counts: false, shown: always, spheres: () => island });
  const rock = along(VOYAGE.rock.from, VOYAGE.rock.to, z => rockHalfWidth(z, width));
  add({ id: 'rock', name: "Sydney's rock", group: 'World', file: 'voyageRock.ts', bank: 'river', counts: false, shown: always, spheres: () => rock });
  {
    const point = pointSpot(width), s = sphere(point.x + point.side * (point.back - point.out) / 2, .4, point.z, Math.max(point.wide, point.out + point.back) / 2);
    add({ id: 'point', name: 'Bennelong Point', group: 'World', file: 'voyageRock.ts', bank: 'left', counts: false, shown: always, spheres: () => [s] });
  }
  {
    const { jetty, tree } = voyageLandmarks(width);
    const deck = sphere(jetty.x - jetty.side * jetty.reach / 2, .5, jetty.z, jetty.reach / 2 + .6);
    add({ id: 'dock', name: 'Dock jetty', group: 'World', file: 'voyageDock.ts', bank: sideBank(jetty.side), counts: false, shown: always, spheres: () => [deck] });
    // The old tree is large; its crown is about this wide (GardenTrees.tsx).
    const crown = sphere(tree.x, 5, tree.z, 6);
    add({ id: 'old-tree', name: 'The old tree', group: 'World', file: 'GardenTrees.tsx', bank: sideBank(jetty.side), counts: false, shown: always, spheres: () => [crown] });
  }
  return pieces;
}

