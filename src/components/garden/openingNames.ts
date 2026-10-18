// The opening title's names fly to their boats (see docs/VOYAGE.md). As the
// guest starts to scroll, "Amelia" glides from the title to just above her
// teal boat on the left and "Patrick" to just above his yellow one on the
// right, crossing over each other, as the title reads Patrick first; each
// then fades out above its boat, well before the voyage's date shows. The
// "&" and the subtitle simply fade as they lift off. All by the eased
// progress, so scrolling back brings them home exactly. Where the boats are
// on screen comes from the scene (NameFlight.tsx); this works out the rest.
// Pure, so it can be tested.
// Spans of progress p: the "&" and subtitle fade over `rest`; Patrick's name
// travels over `travel`, Amelia's `stagger` behind, so they don't pass at
// once; both fade above their boats over `fade`. `above` is how far over
// each masthead its name lands, in world units, and `size` its type there:
// `min` to `max` px, `share` of the screen's width between, a little
// smaller than the title so the two sit clear of each other and the masts.
export const NAME_FLIGHT = {
  rest: [.002, .012], travel: [.003, .029], stagger: 0, fade: [.034, .046],
  above: .55, size: { min: 27, share: .03, max: 46 },
} as const;
export type Name = 'patrick' | 'amelia';

const smooth = (t: number) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };
const through = (p: number, [from, to]: readonly [number, number]) => smooth((p - from) / (to - from));

// At p: how much of the "&" and subtitle still shows, and for each name how
// far along its flight it is (0 home, 1 above its boat) and how much shows.
export function nameFlight(p: number) {
  const { rest, travel, stagger, fade } = NAME_FLIGHT, shown = 1 - through(p, fade);
  return {
    rest: 1 - through(p, rest),
    patrick: { k: through(p, travel), shown },
    amelia: { k: through(p, [travel[0] + stagger, travel[1] + stagger]), shown },
  };
}
// Whether the names have left the title, so the butterflies let go of them.
export const namesAway = (p: number) => p > NAME_FLIGHT.travel[0];
// All gone, before the voyage and its date (ARRIVAL_END in journey.ts).
export const NAMES_GONE = NAME_FLIGHT.fade[1];

// The size of a name's type above its boat, as a scale of its size in the title.
export function landingScale(fontSize: number, viewportWidth: number) {
  const { min, share, max } = NAME_FLIGHT.size;
  return Math.min(1, Math.min(max, Math.max(min, viewportWidth * share)) / fontSize);
}

type Point = { x: number; y: number };
// Where each name lands, its bottom middle, from its masthead on screen
// (`mast`, a point just over it) and its width there: centred over its
// boat, unless the boats are so close (a phone) that the names would meet,
// when each moves out from between them just enough to leave `margin`, and
// never off the screen.
export function nameLandings(mast: Record<Name, Point>, width: Record<Name, number>, viewportWidth: number, margin = 10) {
  const x = { amelia: mast.amelia.x, patrick: mast.patrick.x };
  const overlap = (x.amelia + width.amelia / 2 + margin) - (x.patrick - width.patrick / 2);
  if (overlap > 0) { x.amelia -= overlap / 2; x.patrick += overlap / 2; }
  const keep = (name: Name) => Math.min(viewportWidth - width[name] / 2 - 8, Math.max(width[name] / 2 + 8, x[name]));
  return { amelia: { x: keep('amelia'), y: mast.amelia.y }, patrick: { x: keep('patrick'), y: mast.patrick.y } };
}

// Where a name is `k` of the way from `home` (its bottom middle in the title)
// to `to`: it lifts or dips `bow` px off the straight line (negative is up)
// early in its flight, before it sets off sideways, and settles back onto
// the line as it arrives, so the two names, starting side by side on one
// line, pass well over and under each other rather than through.
export function flightPoint(home: Point, to: Point, k: number, bow: number): Point {
  return { x: home.x + (to.x - home.x) * k ** 1.5, y: home.y + (to.y - home.y) * k + bow * Math.sin(Math.PI * Math.sqrt(k)) };
}
// Which way each bows: the name that starts higher bows up and the other
// under it; level, as on one line, Amelia's goes over.
export function nameBows(home: Record<Name, Point>, amount: number): Record<Name, number> {
  const ameliaOver = home.amelia.y <= home.patrick.y + 1;
  return { amelia: ameliaOver ? -amount : amount, patrick: ameliaOver ? amount : -amount };
}
