import assert from 'node:assert/strict';
import test from 'node:test';
import { telHref, withPhoneLinks } from '../src/components/details/phone.ts';

test('a number as we write it becomes an international tel: link', () => {
  assert.equal(telHref('0435 597 406'), 'tel:+61435597406');
  assert.equal(telHref('0435597406'), 'tel:+61435597406');
  assert.equal(telHref('+61 435 597 406'), 'tel:+61435597406');
  assert.equal(telHref('(02) 4464 1234'), 'tel:+61244641234');
});

test('the Q&A links the phone number in an answer and leaves the words as they are', () => {
  assert.deepEqual(withPhoneLinks('You can call Jonathon Dale on 0435 597 406.'),
    [{ text: 'You can call Jonathon Dale on ' }, { text: '0435 597 406', tel: 'tel:+61435597406' }, { text: '.' }]);
  assert.deepEqual(withPhoneLinks('Call 0435597406 or +61 435 597 406'),
    [{ text: 'Call ' }, { text: '0435597406', tel: 'tel:+61435597406' }, { text: ' or ' }, { text: '+61 435 597 406', tel: 'tel:+61435597406' }]);
  // No number, no link; times and years aren't numbers to call.
  assert.deepEqual(withPhoneLinks('Formal. Long dresses, and suits with ties.'), [{ text: 'Formal. Long dresses, and suits with ties.' }]);
  assert.deepEqual(withPhoneLinks('From 3:00 pm on 16 April 2027.'), [{ text: 'From 3:00 pm on 16 April 2027.' }]);
});
