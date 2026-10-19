// Dev only: the Review panel's inspect mode (see docs/VOYAGE.md, "Inspect and
// notes"). What each object in the scene is called and where it is made, the
// notes Amelia and Patrick pin on things, the Markdown they copy for Claude,
// and the ?at= link to a moment. Pure, so it can be tested; used by
// InspectProbe.tsx (in the scene) and InspectTools.tsx (on the page), which
// only the dev server loads.
import { bankEdge, riverCenter, voyageLandmarks } from '../gardenGeometry.ts';
import { MILESTONES, STOPS, chapterAt, storyMonth } from '../journey.ts';
import { digitDate, settledOn } from '../dateLabelMode.ts';

// Remembered across reloads, like the Review panel's other choices.
export const INSPECT_KEY = 'pa_dev_inspect', NOTES_KEY = 'pa_dev_inspect_notes';

// What an object is: a human name, the file it is made in, and the story
// moment it belongs to, a milestone's id or, for scenery timed otherwise, when
// it shows. `background` (the sky) loses to anything else on the same ray.
// `sided` parts are shared by both boats, so the label says whose side.
export type InspectEntry = { name: string; file: string; milestone?: string; when?: string; background?: boolean; sided?: boolean };

const G = 'src/components/garden/';
const E = `${G}eggs/`;

// By the names the scene already gives its groups and meshes (name="…" in
// each component), so nothing deep in the scene needs touching.
const NAMED: Readonly<Record<string, InspectEntry>> = {
  'amelia-boat': { name: 'Amelia’s boat', file: `${G}VoyageBoats.tsx` },
  'guest-boat': { name: 'The guest’s paper boat', file: `${G}GuestBoat.tsx` },
  'patrick-boat': { name: 'Patrick’s boat', file: `${G}VoyageBoats.tsx` },
  'big-mast': { name: 'the catamaran’s big mast and sail', file: `${G}VoyageBoats.tsx`, milestone: 'engaged' },
  'voyage-boats': { name: 'the boats', file: `${G}VoyageBoats.tsx` },
  'flag-staffs': { name: 'flag staff', file: `${G}storyBoats.ts`, sided: true },
  deck: { name: 'the catamaran’s deck', file: `${G}VoyageBoats.tsx`, milestone: 'dating', sided: true },
  'voyage-world': { name: 'the riverside world', file: `${G}VoyageWorld.tsx` },
  'voyage-launch': { name: 'the launch jetties', file: `${G}voyageDock.ts`, when: 'the opening' },
  'voyage-launch-jetties': { name: 'the launch jetties', file: `${G}voyageDock.ts`, when: 'the opening' },
  'voyage-island': { name: 'the island', file: `${G}voyageIsland.ts`, when: 'the opening' },
  'voyage-rock': { name: 'Sydney’s rock', file: `${G}voyageRock.ts`, milestone: 'sydney' },
  'voyage-point': { name: 'Bennelong Point', file: `${G}voyageRock.ts`, milestone: 'sydney' },
  'voyage-dock': { name: 'the dock’s jetty and festoon lights', file: `${G}voyageDock.ts`, when: 'the dock' },
  'voyage-jetty': { name: 'the dock’s jetty', file: `${G}voyageDock.ts`, when: 'the dock' },
  'ez-tree-grove': { name: 'tree', file: `${G}GardenTrees.tsx` },
  'ez-tree-leaves': { name: 'tree (leaves)', file: `${G}GardenTrees.tsx` },
  'ez-tree-branches': { name: 'tree (trunk and branches)', file: `${G}GardenTrees.tsx` },
  'garden-original-rocks': { name: 'bank rocks', file: `${G}GardenBankDetails.tsx` },
  'garden-original-grass': { name: 'grass', file: `${G}GardenBankDetails.tsx` },
  'garden-bank-flowers': { name: 'bank flowers', file: `${G}GardenBankDetails.tsx` },
  'garden-moss-rocks': { name: 'mossy rock', file: `${G}GardenRocks.tsx` },
  'falling-leaves': { name: 'falling leaves', file: `${G}GardenDrift.tsx` },
  'boat-wakes': { name: 'a guest’s boat’s wake', file: `${G}PaperBoat.tsx` },
  'pi-sculpture': { name: 'π sculpture', file: `${E}PiSculpture.tsx`, milestone: 'meet' },
  'duck-launch': { name: 'rubber ducks', file: `${E}Ducks.tsx`, milestone: 'meet' },
  'mobius-sculpture': { name: 'Möbius strip sculpture', file: `${E}MobiusSculpture.tsx`, milestone: 'meet' },
  'park-bench': { name: 'park bench', file: `${E}ParkBench.tsx`, milestone: 'meet' },
  'snow-reveal': { name: 'snowman in its snow patch', file: `${E}SnowReveal.tsx` },
  mortarboards: { name: 'mortarboards', file: `${E}Graduation.tsx`, milestone: 'graduation' },
  'sydney-harbour': { name: 'Sydney Harbour', file: `${E}Sydney.tsx`, milestone: 'sydney' },
  'harbour-bridge': { name: 'Harbour Bridge', file: `${E}Sydney.tsx`, milestone: 'sydney' },
  'opera-house': { name: 'Sydney Opera House', file: `${E}Sydney.tsx`, milestone: 'sydney', when: '2022' },
  birdhouses: { name: 'birdhouses and birds', file: `${E}Birdhouses.tsx`, milestone: 'apartments' },
  'church-st': { name: 'Church St sign', file: `${E}Birdhouses.tsx`, milestone: 'apartments' },
  'dating-butterflies': { name: 'dating butterflies', file: `${E}DatingButterflies.tsx`, milestone: 'dating' },
  'engagement-petals': { name: 'rose petals in the wake', file: `${E}EngagementPetals.tsx`, milestone: 'engaged' },
  'engagement-truck': { name: 'the old truck', file: `${E}EngagementTruck.tsx`, milestone: 'engaged' },
  proposal: { name: 'the proposal on deck', file: `${E}Proposal.tsx`, milestone: 'engaged' },
  careers: { name: 'working-life ornaments', file: `${E}Careers.tsx` },
  candlesticks: { name: 'candlestick posts', file: `${E}Careers.tsx`, milestone: 'internship' },
  'pie-bed': { name: 'pie-chart flower bed', file: `${E}Careers.tsx`, milestone: 'heirwealth' },
  rocket: { name: 'brass rocket (Bullet)', file: `${E}Rocket.tsx`, when: 'October 2026' },
  circus: { name: 'Amelia’s circus', file: `${E}Circus.tsx` },
  'aerial-silk': { name: 'purple aerial silk', file: `${E}Circus.tsx`, when: 'late 2022' },
  lyra: { name: 'lyra', file: `${E}Circus.tsx`, when: 'October 2025' },
  'hanging-bird': { name: 'bird hanging from the lyra', file: `${E}Circus.tsx`, when: 'October 2025' },
  'year-markers': { name: 'year marker', file: `${E}YearMarkers.tsx` },
  balloon: { name: 'hot-air balloons', file: `${E}Balloon.tsx`, milestone: 'turkey-greece' },
  'hagia-sophia': { name: 'Hagia Sophia', file: `${E}HagiaSophia.tsx`, milestone: 'turkey-greece' },
  'place-illawarra': { name: 'the Illawarra escarpment, far off (places)', file: `${G}places.ts`, when: 'the opening to late 2020' },
  'place-sydney': { name: 'Sydney’s sandstone heads, far off (places)', file: `${G}places.ts`, when: 'February 2021 to March 2023' },
  'place-berry': { name: 'Berry’s hills and Coolangatta Mountain, far off (places)', file: `${G}places.ts`, when: 'the bend to the dock' },
};
// Names with a number or kind in them.
const PATTERNS: readonly [RegExp, (match: RegExpMatchArray) => InspectEntry][] = [
  [/^year-(\d{4})$/, ([, year]) => ({ name: `${year} year marker`, file: `${E}YearMarkers.tsx`, when: `January ${year}` })],
  [/^bark-carving-(.+)$/, ([, id]) => ({ name: `bark carving (${id})`, file: `${E}BarkCarvings.tsx`, milestone: 'meet' })],
  [/^voyage-island-(.+)$/, ([, kind]) => ({ name: `island ${kind}`, file: `${G}voyageIsland.ts`, when: 'the opening' })],
  [/^garden-bank-\d+$/, () => ({ name: 'bank (ground)', file: `${G}GardenGround.tsx` })],
  [/^garden-plants-(.+)$/, ([, kind]) => ({ name: `${kind} plants`, file: `${G}GardenPlants.tsx` })],
  [/^garden-moss-rock-\d+$/, () => ({ name: 'mossy rock', file: `${G}GardenRocks.tsx` })],
  [/^(paper-boat|wooden-sailboat|tugboat|rubber-duck)-\d+$/, ([, kind]) => ({ name: `a guest’s ${kind.replace('-', ' ')}`, file: `${G}PaperBoat.tsx` })],
];
// By the ids given to <Inspectable> where a slot or egg is mounted
// (GardenScene.tsx, eggs/index.tsx): parts with no name of their own, and
// each egg, so anything inside it unnamed still says where it is made.
const TAGGED: Readonly<Record<string, InspectEntry>> = {
  sky: { name: 'sky', file: `${G}GardenSky.tsx`, background: true },
  water: { name: 'river', file: `${G}GardenWater.tsx` },
  petals: { name: 'drifting petals', file: `${G}GardenDrift.tsx` },
  places: { name: 'a far-off place (places)', file: `${G}GardenPlaces.tsx` },
  university: { name: 'the university egg (π and ducks)', file: `${E}University.tsx` },
  'snow-2019': { name: 'snowman with his arm in a sling', file: `${E}SnowTrip.tsx` },
  graduation: { name: 'mortarboards', file: `${E}Graduation.tsx` },
  sydney: { name: 'Sydney', file: `${E}Sydney.tsx` },
  apartments: { name: 'birdhouses and birds', file: `${E}Birdhouses.tsx` },
  'snow-2025': { name: 'snowmen holding hands', file: `${E}SecondSnowTrip.tsx` },
  balloon: { name: 'Turkey and Greece', file: `${E}TurkeyGreece.tsx` },
};

export function namedEntry(name: string): InspectEntry | undefined {
  if (Object.hasOwn(NAMED, name)) return NAMED[name];
  for (const [pattern, entry] of PATTERNS) {
    const match = name.match(pattern);
    if (match) return entry(match);
  }
}
export const taggedEntry = (id: string): InspectEntry | undefined => Object.hasOwn(TAGGED, id) ? TAGGED[id] : undefined;

// One object on the ray, then each of its parents up to the scene: its name,
// three.js type, and the tag <Inspectable> put on it, if any.
export type InspectLink = { name: string; type: string; tag?: { id: string; milestone?: string } };
export type Described = { name: string; file?: string; milestone?: string; when?: string; background: boolean; sided: boolean; path: string };

// The nearest name or tag that is known names it. The file and moment come
// from it, or failing that from the nearest ancestor that has them (an egg's
// tag gives everything in it its milestone). Nothing known: the nearest name
// the scene gave, or its type.
export function describe(chain: readonly InspectLink[]): Described {
  let found: InspectEntry | undefined, file: string | undefined, milestone: string | undefined, when: string | undefined;
  for (const link of chain) {
    const entry = (link.tag && taggedEntry(link.tag.id)) || (link.name ? namedEntry(link.name) : undefined);
    if (entry && !found) found = entry;
    file ??= entry?.file;
    milestone ??= entry?.milestone ?? link.tag?.milestone;
    when ??= entry?.when;
  }
  const path = chain.map(link => link.name || link.tag?.id).filter(Boolean).join(' < ');
  const name = found?.name ?? chain.find(link => link.name)?.name ?? chain[0]?.type ?? 'nothing';
  return { name, file, milestone, when, background: !!found?.background, sided: !!found?.sided, path };
}

// The old tree is one of the grove's trees: told apart by where it stands.
// A part both boats share says whose side of the pair it is on (`side`, −1
// for Amelia's, from where it was hit in the boats' own frame).
export function refine(described: Described, origin: { x: number; z: number } | null, width: number, side?: number): Described {
  const { tree } = voyageLandmarks(width);
  if (origin && described.name.startsWith('tree') && Math.hypot(origin.x - tree.x, origin.z - tree.z) < .5)
    return { ...described, name: described.name.replace('tree', 'the old tree') };
  if (described.sided && side) return { ...described, name: `${described.name}, ${side < 0 ? 'Amelia’s' : 'Patrick’s'} side` };
  return described;
}

// Which bank a point is on: Amelia's on the left (−x), Patrick's on the right.
export function bankAt(x: number, z: number, width: number) {
  const off = x - riverCenter(z, width);
  if (Math.abs(off) < bankEdge(z, width)) return 'in the river';
  return off < 0 ? 'Amelia’s bank (left)' : 'Patrick’s bank (right)';
}

// "sydney, 27-02-2021" for a milestone's moment (its id and its day), or when
// the scenery shows.
export function moment({ milestone, when }: { milestone?: string; when?: string }) {
  const found = milestone ? MILESTONES.find(m => m.id === milestone) : undefined;
  const day = found ? settledOn(found.month).split('-').reverse().join('-') : undefined;
  return [found ? `${found.id}, ${day}` : milestone, when].filter(Boolean).join('; ') || null;
}

// The date on screen at p, in the digits guests see (Review "Date" aside):
// the running date through the voyage, or the chapter either side of it.
export function shownDate(p: number) {
  const chapter = chapterAt(p);
  return chapter === 'voyage' ? digitDate(storyMonth(p)) : chapter === 'arrival' ? 'the opening' : 'the dock';
}
// ".3712", as in the docs.
export const formatP = (p: number) => p >= 1 ? '1' : p.toFixed(4).replace(/^0/, '');

export type Viewport = 'desktop' | 'phone';
export type InspectNote = {
  id: string;
  // ms since 1970, when it was written.
  at: number;
  object: { name: string; file?: string; milestone?: string; when?: string; path?: string };
  // The progress the scene showed, and the date on screen with it.
  p: number; date: string;
  viewport: Viewport;
  // Where on the screen, in CSS pixels, and the screen's size.
  screen: { x: number; y: number; width: number; height: number };
  // The point on the object in world units, and which bank it is on.
  world?: [number, number, number]; bank?: string;
  text: string;
};

export function createNote(hit: { described: Described; p: number; screen: InspectNote['screen']; world?: [number, number, number]; bank?: string },
  text: string, viewport: Viewport, at: number): InspectNote {
  const { name, file, milestone, when, path } = hit.described;
  const object = Object.fromEntries(Object.entries({ name, file, milestone, when, path }).filter(([, v]) => v !== undefined)) as InspectNote['object'];
  return { id: `${at.toString(36)}-${Math.round(hit.screen.x)}-${Math.round(hit.screen.y)}`, at, object, p: hit.p, date: shownDate(hit.p), viewport,
    screen: hit.screen, ...hit.world && { world: hit.world }, ...hit.bank && { bank: hit.bank }, text: text.trim() };
}

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
// Notes as stored: anything malformed (an older shape, a hand edit) is dropped.
export function readNotes(stored: string | null): InspectNote[] {
  let parsed: unknown;
  try { parsed = JSON.parse(stored ?? '[]'); } catch { return []; }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((n): n is InspectNote => !!n && typeof n === 'object' && typeof n.id === 'string' && typeof n.text === 'string'
    && isNumber(n.p) && n.p >= 0 && n.p <= 1 && typeof n.date === 'string' && (n.viewport === 'desktop' || n.viewport === 'phone')
    && !!n.object && typeof n.object.name === 'string' && !!n.screen && isNumber(n.screen.x) && isNumber(n.screen.y));
}

// One line for Claude, as Amelia asked:
//   - 27-02-2021 (p .3712, phone): **Harbour Bridge** (src/components/garden/eggs/Sydney.tsx): make it fade in sooner
// then a line under it with where exactly it was pointed at.
export function formatNote(note: InspectNote) {
  const where = note.object.file ? ` (${note.object.file})` : '';
  const text = note.text.replace(/\s*\n\s*/g, ' ');
  const { x, y, width, height } = note.screen;
  const details = [
    `screen ${Math.round(x)}, ${Math.round(y)} of ${width}×${height}`,
    note.world && `world ${note.world.map(v => v.toFixed(2)).join(', ')}`,
    note.bank,
    note.object.path && `object ${note.object.path}`,
    `?at=${atValue(note.p)}`,
  ].filter(Boolean).join('; ');
  return `- ${note.date} (p ${formatP(note.p)}, ${note.viewport}): **${note.object.name}**${where}: ${text}\n  - ${details}`;
}
export function formatNotes(notes: readonly InspectNote[]) {
  if (!notes.length) return '';
  const sorted = [...notes].sort((a, b) => a.p - b.p || a.at - b.at);
  return `Notes on the Garden's voyage from inspect mode (p is scroll progress, 0 to 1; the dev server's /?at=<p> opens each moment):\n\n${sorted.map(formatNote).join('\n')}\n`;
}

// ?at=<p> (0 to 1) or ?at=<milestone id> (its stop, halfway through its date's
// hold, where the arrow keys land), plus "opening" and "dock". Anything else
// is ignored.
export function parseAt(value: string | null): number | null {
  if (value == null) return null;
  const at = value.trim();
  if (/^(\d+(\.\d*)?|\.\d+)$/.test(at)) {
    const p = Number(at);
    return p >= 0 && p <= 1 ? p : null;
  }
  if (at === 'opening') return 0;
  if (at === 'dock') return 1;
  const i = MILESTONES.findIndex(m => m.id === at);
  return i < 0 ? null : STOPS[i + 1];
}
// The ?at= value that comes back to p: a milestone's id when p is at its stop.
const AT_STOP = 5e-4;
export function atValue(p: number) {
  const i = MILESTONES.findIndex((_, j) => Math.abs(STOPS[j + 1] - p) < AT_STOP);
  return i < 0 ? p.toFixed(4) : MILESTONES[i].id;
}
