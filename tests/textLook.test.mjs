import assert from 'node:assert/strict';
import test from 'node:test';
import { INK_TURNS_WHITE, TEXT_LOOKS, inkTurnsWhite, textLook } from '../src/components/garden/textLook.ts';
import { DATES, STOPS, VOYAGE_END, progressAt } from '../src/components/garden/journey.ts';

test('the copy keeps its glow unless the Review panel chose another look', () => {
  assert.deepEqual(Object.keys(TEXT_LOOKS), ['glow', 'white', 'shadow', 'ink', 'scrim']);
  assert.equal(textLook(null), 'glow');
  for (const look of Object.keys(TEXT_LOOKS)) assert.equal(textLook(look), look);
  for (const stored of ['', 'halo', 'toString', 'constructor']) assert.equal(textLook(stored), 'glow');
});

test('ink turns white as the light turns golden, as the trip\'s date shows, through to the dock', () => {
  assert.ok(INK_TURNS_WHITE > progressAt(DATES.engaged) && Math.abs(INK_TURNS_WHITE - progressAt('2026-07')) < 1e-9);
  for (const stop of STOPS) assert.equal(inkTurnsWhite(stop), stop >= progressAt('2026-07'), `stop ${stop.toFixed(4)}`);
  assert.ok(inkTurnsWhite(VOYAGE_END) && inkTurnsWhite(1) && !inkTurnsWhite(0));
});
