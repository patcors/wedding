import assert from 'node:assert/strict';
import test from 'node:test';
import { DATE_LABEL_MODES, dateLabelMode, shownDate } from '../src/components/garden/dateLabelMode.ts';

test('the date label reads month and year unless the Review panel chose otherwise', () => {
  assert.equal(dateLabelMode(null), 'full');
  for (const mode of Object.keys(DATE_LABEL_MODES)) assert.equal(dateLabelMode(mode), mode);
  for (const stored of ['', 'month', 'toString', 'constructor']) assert.equal(dateLabelMode(stored), 'full');
});

test('each mode shows the month and year, the year alone, or nothing', () => {
  assert.deepEqual(shownDate('July 2017', 'full'), { month: 'July', year: '2017' });
  assert.deepEqual(shownDate('July 2017', 'year'), { month: '', year: '2017' });
  assert.deepEqual(shownDate('July 2017', 'off'), { month: '', year: '' });
  assert.deepEqual(shownDate('', 'full'), { month: '', year: '' });
});
