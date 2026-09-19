// Smooth signals mix slow steering with individual wing strokes. No framewise
// randomness: a paused butterfly freezes, then resumes the same movement.
export function butterflyMotion(time: number, seed: number, wingPhase: number) {
  // The selected powered-flight variant: deep strokes and a trailing abdomen.
  const profile = { rate: 5.4, glide: .12, wander: 10, lift: 17, pitch: 25, turn: 10 };
  const cycle = time * 2.6 + seed;
  const opening = Math.max(0, (Math.sin(cycle) - .45) / .55);
  const glide = opening * opening * (3 - 2 * opening) * profile.glide;
  const steering = Math.sin(time * 1.7 + seed) * .65 + Math.sin(time * 3.1 + seed * 2) * .35;
  // A quick closing stroke and a slower opening stroke, with the outside wing
  // lagging slightly through a turn rather than mirroring perfectly.
  const beat = (phase: number) => ((Math.sin(phase) + 1) / 2) ** .7;
  const left = 8 + beat(wingPhase) * 76 * (1 - glide);
  const right = 8 + beat(wingPhase + steering * .4) * 76 * (1 - glide);
  return {
    rate: profile.rate * (1 + .16 * Math.sin(time * 2.3 + seed)) * (1 - glide * .7),
    left, right,
    x: steering * profile.wander,
    y: Math.sin(time * 2.2 + seed) * profile.lift + Math.cos(wingPhase - .6) * 3 * (1 - glide),
    bank: steering * profile.turn,
    pitch: 12 + Math.cos(wingPhase - .7) * profile.pitch * (1 - glide),
    yaw: steering * 18,
    flex: Math.sin(wingPhase - .65) * 12 * (1 - glide),
    abdomen: Math.sin(wingPhase - 1.2) * 9,
    scale: 1 + Math.sin(time * 1.3 + seed) * .045,
  };
}
