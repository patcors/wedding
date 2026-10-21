import assert from 'node:assert/strict';
import test from 'node:test';
import { scrollInverted, storyScroll } from '../src/components/garden/scrollChoices.ts';
import { progressFor, scrollFor } from '../src/components/garden/voyagePlace.ts';

test('guests scroll down to sail; only a stored "inverted" turns it over', () => {
  assert.equal(scrollInverted(null), false);
  assert.equal(scrollInverted('normal'), false);
  assert.equal(scrollInverted('nonsense'), false);
  assert.equal(scrollInverted('inverted'), true);
});

test('inverted, the story starts at the bottom of the page and ends at the top', () => {
  const span = 20000;
  assert.equal(storyScroll(0, span, false), 0);
  assert.equal(storyScroll(span, span, true), 0);
  assert.equal(storyScroll(0, span, true), span);
  assert.equal(progressFor(storyScroll(span, span, true), span), 0);
  assert.equal(progressFor(storyScroll(0, span, true), span), 1);
});

test('turning the scroll over keeps the story where it was', () => {
  const span = 18311;
  for (const p of [0, .05, .3, .62, 1]) {
    const page = storyScroll(scrollFor(p, span), span, true);
    assert.equal(storyScroll(page, span, true), scrollFor(p, span));
    assert.ok(Math.abs(progressFor(storyScroll(page, span, true), span) - p) < 1e-3);
  }
});
