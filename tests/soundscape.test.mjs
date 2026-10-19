import assert from 'node:assert/strict';
import test from 'node:test';
import { AMBIENCE_KEYS, CHIME, CUE, CUES, ambienceAt, chimeNotes, chimeStep, createChimes, createCues, cuesCrossed, heldMilestone, pentatonic } from '../src/components/garden/soundscape.ts';
import { GUEST_SOUND, REVIEW_SOUND, SOUND_MODES, soundMode } from '../src/components/garden/soundChoices.ts';
import { ARRIVAL_END, DATES, MILESTONES, ROOM, VOYAGE_END, monthIndex, progressAt, stillProgress } from '../src/components/garden/journey.ts';
import { SKY_KEYS, lampsAt } from '../src/components/garden/skyCycle.ts';
import { nestTriggers } from '../src/components/garden/eggs/nesting.ts';

const midday = progressAt('2020-08'), dawn = 0, dusk = 1;

test('sound is off unless chosen, and guests get no button for now', () => {
  assert.equal(soundMode(null), 'off');
  assert.equal(soundMode('nonsense'), 'off');
  for (const mode of Object.keys(SOUND_MODES)) assert.equal(soundMode(mode), mode);
  assert.equal(REVIEW_SOUND, 'pa_dev_sound');
  assert.equal(GUEST_SOUND, false);
});

test('the ambience turns on the sky\'s own keyframes', () => {
  assert.deepEqual(AMBIENCE_KEYS.map(([p]) => p), SKY_KEYS.map(([p]) => p));
  for (let p = 0; p <= 1; p += .005) {
    const a = ambienceAt(p);
    for (const [name, v] of Object.entries(a)) assert.ok(v >= 0 && v <= 1, `${name} at ${p}`);
  }
});

test('quieter at the start, birds brightest at midday, calmer at dusk', () => {
  const [start, noon, evening] = [ambienceAt(dawn), ambienceAt(midday), ambienceAt(dusk)];
  assert.ok(start.level < ambienceAt(progressAt(DATES.meet)).level && start.level < noon.level);
  // Midday is the peak of the birds' song and brightness.
  for (let p = 0; p <= 1; p += .01) {
    assert.ok(ambienceAt(p).birds <= noon.birds + 1e-9);
    assert.ok(ambienceAt(p).birdTone <= noon.birdTone + 1e-9);
  }
  assert.ok(evening.level < noon.level && evening.birds < start.birds && evening.waterTone < start.waterTone);
  // The river never stops, at any hour.
  for (let p = 0; p <= 1; p += .01) assert.ok(ambienceAt(p).water > .5);
  // From the golden light the day only calms.
  for (let p = progressAt(DATES.engaged); p < 1; p += .01) assert.ok(ambienceAt(p + .01).birds <= ambienceAt(p).birds + 1e-9);
});

test('the festoons\' warmth comes up with their lights', () => {
  assert.equal(ambienceAt(midday).warmth, 0);
  assert.equal(ambienceAt(ARRIVAL_END).warmth, 0);
  assert.equal(ambienceAt(1).warmth, 1);
  for (const p of [.85, .9, .92, .97]) assert.equal(ambienceAt(p).warmth, lampsAt(p));
});

test('a milestone is held from its date through its hold, and only in the voyage', () => {
  for (const milestone of MILESTONES) {
    const from = progressAt(milestone.month), to = progressAt(monthIndex(milestone.month) + 1e-3);
    assert.equal(heldMilestone(from)?.id, milestone.id);
    assert.equal(heldMilestone((from + to) / 2)?.id, milestone.id);
    // Reduced motion's still for the milestone holds it too.
    assert.equal(heldMilestone(stillProgress(from + 1e-4))?.id, milestone.id);
  }
  assert.equal(heldMilestone(0), null);
  assert.equal(heldMilestone(ARRIVAL_END + 1e-3), null);
  assert.equal(heldMilestone(VOYAGE_END), null);
  // Between dates, while the label rolls on, nothing is held.
  assert.equal(heldMilestone((progressAt(monthIndex('2018-11') + 1e-3) + progressAt('2019-07')) / 2), null);
});

test('a chime rings once a date has settled, once', () => {
  const chimes = createChimes();
  assert.equal(chimeStep(chimes, 'meet', 10), null);
  assert.equal(chimeStep(chimes, 'meet', 10 + CHIME.settle - .01), null);
  assert.equal(chimeStep(chimes, 'meet', 10 + CHIME.settle), 'meet');
  for (let t = 11; t < 20; t += .1) assert.equal(chimeStep(chimes, 'meet', t), null);
  // Rolling on to the next date, then settling on it.
  assert.equal(chimeStep(chimes, null, 20), null);
  assert.equal(chimeStep(chimes, 'coast', 21), null);
  assert.equal(chimeStep(chimes, 'coast', 21.7), 'coast');
});

test('passing through a date without settling never chimes', () => {
  const chimes = createChimes();
  for (const [i, { id }] of MILESTONES.entries()) {
    assert.equal(chimeStep(chimes, id, i), null);
    assert.equal(chimeStep(chimes, id, i + CHIME.settle * .8), null);
    assert.equal(chimeStep(chimes, null, i + .9), null);
  }
});

test('flinging back and forth never chimes in quick succession', () => {
  const chimes = createChimes(), rings = [];
  // A minute of settling on alternate dates every 0.8s, polled as the page does.
  for (let t = 0; t < 60; t += .12) {
    const held = Math.floor(t / .8) % 2 ? 'graduation' : 'sydney';
    const chime = chimeStep(chimes, held, t);
    if (chime) rings.push([t, chime]);
  }
  for (let i = 1; i < rings.length; i++) assert.ok(rings[i][0] - rings[i - 1][0] >= CHIME.gap);
  // Each date rang at most once in any half minute.
  for (const id of ['graduation', 'sydney']) {
    const times = rings.filter(([, r]) => r === id).map(([t]) => t);
    for (let i = 1; i < times.length; i++) assert.ok(times[i] - times[i - 1] >= CHIME.again);
  }
  assert.ok(rings.length <= 4, `${rings.length} chimes`);
  // A blocked chime is dropped, not played late.
  const later = createChimes();
  assert.equal(chimeStep(later, 'meet', 0), null);
  assert.equal(chimeStep(later, 'meet', 1), 'meet');
  assert.equal(chimeStep(later, 'coast', 1.5), null);
  assert.equal(chimeStep(later, 'coast', 2.2), null);
  assert.equal(chimeStep(later, 'coast', 9), null);
});

test('the chimes keep to a gentle pentatonic', () => {
  assert.ok(Math.abs(pentatonic(0) - 587.33) < .01);
  assert.ok(Math.abs(pentatonic(5) - 2 * pentatonic(0)) < 1e-9);
  const scale = [0, 1, 2, 3, 4, 5, 6].map(pentatonic);
  for (const { id } of MILESTONES) {
    const [a, b] = chimeNotes(id);
    assert.ok(scale.some(f => Math.abs(f - a) < 1e-9) && scale.some(f => Math.abs(f - b) < 1e-9));
    assert.ok(b > a && a >= 580 && b < 1400);
  }
  // Consecutive milestones ring different notes.
  for (let i = 1; i < MILESTONES.length; i++) assert.notDeepEqual(chimeNotes(MILESTONES[i].id), chimeNotes(MILESTONES[i - 1].id));
});

test('the touches sit on their scenes\' moments', () => {
  const at = id => CUES.find(cue => cue.id === id).at;
  const trip = progressAt('2026-07');
  assert.ok(at('burner') > trip && at('burner') < progressAt(monthIndex('2026-07') + 1e-3));
  const triggers = nestTriggers();
  const birds = CUES.filter(cue => cue.kind === 'bird');
  // Both birds fly in to hers, his flies home, hers flies over to his.
  assert.deepEqual(birds.map(cue => cue.owner), ['amelia', 'patrick', 'patrick', 'amelia']);
  assert.deepEqual(birds.map(cue => cue.at), [triggers[1], triggers[1], triggers[2], triggers[3]]);
  const [herFirst, hisFirst, hisHome, herMove] = birds;
  assert.ok(herFirst.pan < 0 && herFirst.to < 0);
  assert.ok(hisFirst.pan > 0 && hisFirst.to < 0 && hisFirst.delay > 0);
  assert.ok(hisHome.pan < 0 && hisHome.to > 0);
  assert.ok(herMove.pan < 0 && herMove.to > 0);
});

test('a touch plays once as the scroll passes it going forward', () => {
  const state = createCues(), burner = CUES.find(cue => cue.id === 'burner').at;
  assert.deepEqual(cuesCrossed(state, burner - .01, burner - .001, 0), []);
  assert.deepEqual(cuesCrossed(state, burner - .001, burner + .001, 0).map(cue => cue.id), ['burner']);
  // Back and forth over it soon after: not again.
  assert.deepEqual(cuesCrossed(state, burner + .001, burner - .001, 1), []);
  assert.deepEqual(cuesCrossed(state, burner - .001, burner + .001, 2), []);
  // Long after, it may play again, as the scene does.
  assert.deepEqual(cuesCrossed(state, burner - .001, burner + .001, 2 + CUE.again).map(cue => cue.id), ['burner']);
  // Going backwards never plays it; a jump far past it finds it done.
  assert.deepEqual(cuesCrossed(createCues(), burner + .001, burner - .001, 0), []);
  assert.deepEqual(cuesCrossed(createCues(), burner - .001, burner + CUE.window + .001, 0), []);
  // At the story's fastest pace an update every 120ms passes nothing by.
  assert.ok(.8 * ROOM * .12 < CUE.window);
});
