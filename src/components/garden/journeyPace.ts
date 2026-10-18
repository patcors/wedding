// How fast the story may travel (see docs/VOYAGE.md). The scene, the date and
// the copy all follow one eased progress, which chases the scroll as the old
// damping did but never faster than PACE.max shares (ROOM) a second, however
// hard the guest scrolls or flings, so each milestone's scene and date still
// register. The scroll itself is kept within PACE.lead of it, so a fling
// carries the story on a little way, as momentum does, rather than leaving
// the page far ahead. "The next chapter" glides the rest of the way to the
// dock on its own (glidePlan). Pure, so it can be tested.
import { MILESTONES, ROOM, STOPS } from './journey.ts';

// `ease` is the old damping's rate, per second; `max` the most shares a
// second the story travels; `lead` how many shares the scroll may run ahead
// of it, or behind going back.
export const PACE = { ease: 2, max: .8, lead: 1.5 } as const;
export const MAX_SPEED = PACE.max * ROOM;

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

// The eased progress a frame of `dt` seconds on from p, chasing `target`.
export function paceToward(p: number, target: number, dt: number) {
  const most = MAX_SPEED * dt;
  const next = p + clamp((target - p) * (1 - Math.exp(-PACE.ease * dt)), -most, most);
  return Math.abs(target - next) < 1e-5 ? target : next;
}

// The furthest the scroll may be from the eased progress p, either way.
export const leashed = (scroll: number, p: number) => clamp(scroll, p - PACE.lead * ROOM, p + PACE.lead * ROOM);

// The glide to the dock stops at each milestone (STOPS) and at the
// celebration. Each leg sets off from rest, eases up over `ramp` seconds to
// `cruise` shares a second (the most a guest can scroll),
// travels on and eases into the next stop over another `ramp`, where it holds
// for `hold` seconds, or longer where something plays out there: the caps
// tossed at graduation, the birds flying in as they buy their apartments,
// the rocket at August 2025's snow trip, the catamaran's turn as they start
// salsa and the proposal on its deck.
export const GLIDE = {
  cruise: .8, ramp: 1, hold: 1.8,
  holds: { graduation: 2.6, apartments: 2.6, 'snow-2025': 3.9, salsa: 3.2, engaged: 2.6 } as Partial<Record<string, number>>,
} as const;

export type GlideLeg = { from: number; to: number; start: number; travel: number; hold: number; cruise: number };
export type GlidePlan = { legs: GlideLeg[]; length: number };

// The legs from progress `from` to the celebration, with when each starts, in
// seconds, how long it travels and holds, and its cruising speed (slower on
// a leg too short to reach `cruise`).
export function glidePlan(from: number): GlidePlan {
  const legs: GlideLeg[] = [];
  let at = from, start = 0;
  for (const [i, stop] of STOPS.entries()) {
    if (stop <= at + 5e-4) continue;
    const distance = (stop - at) / ROOM, ramp = GLIDE.ramp;
    const cruise = Math.min(GLIDE.cruise, distance / ramp);
    const travel = distance / cruise + ramp;
    const milestone = MILESTONES[i - 1];
    const hold = i === STOPS.length - 1 ? 0 : GLIDE.holds[milestone.id] ?? GLIDE.hold;
    legs.push({ from: at, to: stop, start, travel, hold, cruise });
    start += travel + hold;
    at = stop;
  }
  return { legs, length: start };
}

// Shares covered `t` seconds into a leg: its speed rises as half a cosine
// over the ramp, cruises, and falls the same way into the stop.
function covered(leg: GlideLeg, t: number) {
  const ramp = GLIDE.ramp, v = leg.cruise, distance = (leg.to - leg.from) / ROOM;
  const rising = (s: number) => v * (s / 2 - ramp / (2 * Math.PI) * Math.sin(Math.PI * s / ramp));
  if (t <= 0) return 0;
  if (t >= leg.travel) return distance;
  if (t < ramp) return rising(t);
  if (t > leg.travel - ramp) return distance - rising(leg.travel - t);
  return v * ramp / 2 + v * (t - ramp);
}

// Where the glide is `t` seconds after it set off.
export function glideAt(plan: GlidePlan, t: number) {
  const leg = plan.legs.findLast(leg => leg.start <= t) ?? plan.legs[0];
  if (!leg) return 1;
  return leg.from + covered(leg, t - leg.start) * ROOM;
}

// The one eased progress, shared by the page and the scene, each of which
// moves it on as its frame comes (advancePace); a second call in the same
// frame finds no time has passed. `glide` is the glide under way, `t`
// seconds in: it moves the progress itself.
export type Pace = { progress: number; target: number; at: number; glide: { plan: GlidePlan; t: number } | null };
export const createPace = (): Pace => ({ progress: 0, target: 0, at: -1, glide: null });

export function advancePace(pace: Pace, now: number) {
  if (now <= pace.at) return;
  // A frame never counts for more than .05s, so a stall or a hidden tab doesn't leap.
  const dt = pace.at < 0 ? 0 : Math.min(.05, (now - pace.at) / 1000);
  pace.at = now;
  if (pace.glide) {
    const glide = pace.glide;
    glide.t += dt;
    pace.progress = pace.target = glideAt(glide.plan, glide.t);
    if (glide.t >= glide.plan.length) pace.glide = null;
  } else pace.progress = paceToward(pace.progress, pace.target, dt);
}
