// The loading bar under the opening title (see docs/VOYAGE.md, "The loading
// bar"). Before any script arrives it creeps in from the page's own CSS
// (gardenLoader.css); then the page reports each stage of the load here, and
// the bar fills to where that stage puts it and creeps on slowly towards the
// next, never quite reaching it, so it never stops dead and never goes back.
// No imports, so the page can read this without pulling in three.

// In the order they happen. `page` is the HTML and CSS alone, `script` the
// page's code (the butterflies come in), `assets` the scene's models and
// textures downloading, `building` the scene built, compiled and uploaded,
// `prepared` waiting for the opening flock to land, `ready` the scene showing.
export const LOAD_STAGES = ['page', 'script', 'assets', 'building', 'prepared', 'ready'] as const;
export type LoadStage = typeof LOAD_STAGES[number];

// Where each stage starts on the bar and how far it may creep before the next
// arrives, from a phone on throttled 4G (October 2026): about 1.8s to the
// script, 3s downloading, 4.5s building and preparing. The CSS creep before
// the script stops at the script's start (its keyframes in gardenLoader.css).
export const BAR: Record<LoadStage, readonly [start: number, end: number]> = {
  page: [0, .16], script: [.16, .22], assets: [.22, .7], building: [.7, .9], prepared: [.9, 1], ready: [1, 1],
};
// How far towards the end of its stretch the creep goes, and over how long (s).
export const CREEP = { share: .85, seconds: { page: 9, script: 4, assets: 12, building: 6, prepared: 3, ready: 0 } as Record<LoadStage, number> };

export type Items = { loaded: number; total: number };

// Stages only move forwards: a stage reported late (an item finishing after
// the scene was prepared) doesn't take the bar back.
export const laterStage = (a: LoadStage, b: LoadStage) => LOAD_STAGES.indexOf(b) > LOAD_STAGES.indexOf(a) ? b : a;

// The stretch of bar a stage covers. While the assets download it is shared
// out by how many of them have arrived, squared: the downloads share the
// connection, so the small ones finish first and the big tree models last
// (on throttled 3G four in five had arrived by 10s, the rest at 21 to 23s).
// Counted plainly, the bar ran most of the way and then waited; squared, it
// keeps some in hand for them, and creeps on towards the stage's end between
// arrivals.
export function barSpan(stage: LoadStage, items: Items = { loaded: 0, total: 0 }) {
  const [start, end] = BAR[stage];
  if (stage !== 'assets' || items.total <= 0) return { floor: start, ceiling: end };
  const share = Math.min(1, Math.max(0, items.loaded / items.total));
  return { floor: start + (end - start) * share * share, ceiling: end };
}

// One step of the bar from what it shows now: fill to the stage's floor (never
// below what is shown), then creep most of the way to its ceiling. Under
// reduced motion it only fills, without creeping.
export function barStep(shown: number, stage: LoadStage, items?: Items, reduced = false) {
  const { floor, ceiling } = barSpan(stage, items);
  const from = clamp(shown);
  const to = Math.max(from, clamp(floor));
  const creep = reduced ? to : Math.max(to, clamp(floor + CREEP.share * (ceiling - floor)));
  return { from, to, creep, seconds: reduced ? 0 : CREEP.seconds[stage] };
}
const clamp = (value: number) => Math.min(1, Math.max(0, value));

// For screen readers: tens of percent, so the value changes a handful of times in all.
export const announced = (value: number) => Math.floor(clamp(value) * 10 + 1e-9) * 10;

// The scene's chunk reports its asset downloads here (GardenCanvas.tsx); the
// bar listens (useLoadingBar.ts). The latest count is kept for a late listener.
let latest: Items | null = null;
const listeners = new Set<(items: Items) => void>();
export function reportItems(loaded: number, total: number) {
  latest = { loaded, total };
  listeners.forEach(listener => listener(latest!));
}
export function onItems(listener: (items: Items) => void) {
  listeners.add(listener);
  if (latest) listener(latest);
  return () => { listeners.delete(listener); };
}
