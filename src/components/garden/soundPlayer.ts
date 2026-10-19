// Ties the voyage's sound to the page (see useSoundscape.ts): called a few
// times a second with the progress the scene shows, it sets the ambience for
// the time of day, plans the birdsong a little ahead, rings a milestone's
// chime once its date has settled, and plays a scenery touch as its scene
// starts. Loaded only once a guest turns the sound on.
import { createSoundEngine } from './soundEngine';
import { ambienceAt, chimeNotes, chimeStep, createChimes, createCues, cuesCrossed, heldMilestone } from './soundscape';
import type { SoundMode } from './soundChoices';

// Seconds of birdsong planned ahead, longer than the gap between updates.
const AHEAD = .6;

export type SoundPlayer = ReturnType<typeof createSoundPlayer>;
export function createSoundPlayer(ctx: BaseAudioContext) {
  const engine = createSoundEngine(ctx, Math.floor(Math.random() * 1e9));
  const chimes = createChimes(), cues = createCues();
  let last: number | null = null;
  return {
    // `now` in seconds on the page's clock, for the chimes' and touches' spacing.
    update({ p, reduced, mode, now }: { p: number; reduced: boolean; mode: SoundMode; now: number }) {
      const at = ctx.currentTime, ambience = ambienceAt(p);
      engine.scene(ambience, mode, at);
      if (mode !== 'off') engine.birdsong(at, at + AHEAD, ambience.birds);
      const held = heldMilestone(p)?.id ?? null, chime = chimeStep(chimes, held, now);
      if (mode === 'chimes' && chime) engine.chime(chimeNotes(chime), at + .02);
      // The scenes don't play under reduced motion, and neither do their sounds.
      const touches = last === null || reduced ? [] : cuesCrossed(cues, last, p, now);
      if (mode === 'chimes') touches.forEach(cue => engine.touch(cue, at + .02));
      last = p;
    },
    // After a pause, nothing passed while it was silent plays late.
    resume() { last = null; },
    fade: engine.fade,
  };
}
