// How fast the story may travel (see docs/VOYAGE.md). The scene, the date and
// the copy all follow one eased progress, which chases the scroll as the old
// damping did but never faster than PACE.max shares (ROOM) a second, however
// hard the guest scrolls or flings, so each milestone's scene and date still
// register. The opening has no milestone to miss, so there the story may run
// at up to PACE.opening shares a second, settling to PACE.max by the
// meeting's date. The scroll itself is kept within PACE.lead of it, so a fling
// carries the story on a little way, as momentum does, rather than leaving
// the page far ahead. "Sail on" glides the rest of the way to the dock on
// its own, without stopping (glidePlan). Pure, so it can be tested.
import { ARRIVAL_END, MILESTONES, ROOM, progressAt } from './journey.ts';

// `ease` is the old damping's rate, per second; `max` the most shares a
// second the story travels, and `opening` the most under the title;
// `lead` how many shares the scroll may run ahead of it, or behind going back.
export const PACE = { ease: 2, max: .8, opening: 4, lead: 1.5 } as const;
export const MAX_SPEED = PACE.max * ROOM;

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

// Where the opening's speed starts to settle, at the voyage's first date, and
// where it has settled, at the meeting's.
export const OPENING_RUN = [ARRIVAL_END, progressAt(MILESTONES[0].month)] as const;

// The most progress a second the story may travel at p.
export function maxSpeedAt(p: number) {
  const k = clamp((p - OPENING_RUN[0]) / (OPENING_RUN[1] - OPENING_RUN[0]), 0, 1);
  return (PACE.opening + (PACE.max - PACE.opening) * k * k * (3 - 2 * k)) * ROOM;
}

// The eased progress a frame of `dt` seconds on from p, chasing `target`.
export function paceToward(p: number, target: number, dt: number) {
  const most = maxSpeedAt(p) * dt;
  const next = p + clamp((target - p) * (1 - Math.exp(-PACE.ease * dt)), -most, most);
  return Math.abs(target - next) < 1e-5 ? target : next;
}

// The furthest the scroll may be from the eased progress p, either way.
export const leashed = (scroll: number, p: number) => clamp(scroll, p - PACE.lead * ROOM, p + PACE.lead * ROOM);

// "Sail on" glides the rest of the way to the dock in one continuous run
// (Amelia, October 2026: the old glide stopped and started at each
// milestone). It sets off from rest, eases up over `ramp` seconds to `speed`
// shares a second, steady and slower than the most a guest may scroll, so
// each egg can be taken in as it passes, and eases into the dock over another
// `ramp`. It slows for nothing on the way.
export const GLIDE = { speed: .5, ramp: 1.5 } as const;

// `cruise` is slower than GLIDE.speed only on a run too short to reach it.
export type GlidePlan = { from: number; cruise: number; length: number };

// The glide from progress `from` to the dock (p 1), and how long it takes, in seconds.
export function glidePlan(from: number): GlidePlan {
  const distance = Math.max(0, 1 - from) / ROOM;
  const cruise = Math.min(GLIDE.speed, distance / GLIDE.ramp);
  return { from, cruise, length: distance > 0 ? distance / cruise + GLIDE.ramp : 0 };
}

// Where the glide is `t` seconds after it set off: its speed rises as half a
// cosine over the ramp, cruises, and falls the same way into the dock.
export function glideAt(plan: GlidePlan, t: number) {
  if (t >= plan.length) return 1;
  if (t <= 0) return plan.from;
  const ramp = GLIDE.ramp, v = plan.cruise, distance = (1 - plan.from) / ROOM;
  const rising = (s: number) => v * (s / 2 - ramp / (2 * Math.PI) * Math.sin(Math.PI * s / ramp));
  const covered = t < ramp ? rising(t) : t > plan.length - ramp ? distance - rising(plan.length - t) : v * ramp / 2 + v * (t - ramp);
  return plan.from + covered * ROOM;
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

// Whether the story has as good as come to rest: no glide, and less than
// `REST` of a share left to coast, a drift too slow to notice. The scroll
// helper waits for it (scrollGuide.ts), not for the last of the coasting.
export const REST = .05;
export const atRest = (pace: Pace) => !pace.glide && Math.abs(pace.target - pace.progress) < REST * ROOM;
