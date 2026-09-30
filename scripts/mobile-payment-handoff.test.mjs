import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'vitest';

const script = readFileSync(new URL('../public/mobile-payment.js', import.meta.url), 'utf8');
const order = '11111111-1111-4111-8111-111111111111';
function run({ search = '', hash = '', denied = false, blocked = false } = {}) {
  const elements = Object.fromEntries(['heading', 'message', 'continue', 'note'].map(id => [id, { hidden: id === 'continue', textContent: '', href: '' }]));
  const storage = new Map();
  const navigation = [];
  const history = [];
  vm.runInNewContext(script, {
    URL, URLSearchParams, Date,
    location: { search, hash, pathname: '/mobile-payment.html', replace: url => { navigation.push(url); if (blocked) throw Error('blocked'); } },
    history: { replaceState: (...args) => history.push(args) },
    document: { readyState: 'complete', getElementById: id => elements[id] },
    window: { sessionStorage: { setItem: (key, value) => { if (denied) throw Error('denied'); storage.set(key, value); } }, localStorage: { setItem: (key, value) => { if (denied) throw Error('denied'); storage.set(key, value); } } },
  });
  return { elements, storage, navigation, history };
}
test('successful return uses the exact native order URI with a visible tap fallback', () => {
  const state = run({ search: `?payment=success&order=${order}`, blocked: true });
  assert.deepEqual(state.navigation, [`com.cozycraft.furniture://payment/return?payment=success&order=${order}`]);
  assert.equal(state.elements.continue.href, state.navigation[0]);
  assert.equal(state.elements.continue.hidden, false);
  assert.match(state.elements.message.textContent, /checked securely/);
});
test('cancelled return keeps the original order and never cancels it from the URL', () => {
  const state = run({ search: `?payment=cancelled&order=${order}` });
  assert.equal(state.navigation[0], `com.cozycraft.furniture://payment/return?payment=cancelled&order=${order}`);
  assert.match(state.elements.message.textContent, /original deadline/);
});
test('launcher preserves a legacy session including provider fragment, records the exact order, clears history', () => {
  const checkout = 'https://checkout.paymongo.com/cs_existing#provider_token=fixture';
  const state = run({ hash: '#' + new URLSearchParams({ order, checkout }) });
  assert.deepEqual(state.navigation, [checkout]);
  assert.equal(state.storage.size, 1);
  assert.ok(Number(state.storage.get(`cozycraft-native-payment-return:${order}`)) > Date.now());
  assert.equal(state.history[0][2], '/mobile-payment.html');
});
test('denied browser storage does not strand a new payment at the launcher', () => {
  const state = run({ hash: '#' + new URLSearchParams({ order, checkout: 'https://payments.paymongo.com/fixture' }), denied: true });
  assert.equal(state.navigation[0], 'https://payments.paymongo.com/fixture');
});
test('rejects untrusted checkout destinations and malformed returns', () => {
  for (const checkout of ['https://evil.test/x', 'http://checkout.paymongo.com/x', 'https://checkout.paymongo.com.evil.test/x', 'https://user:secret@checkout.paymongo.com/x', 'https://checkout.paymongo.com:444/x', 'javascript:alert(1)']) {
    assert.equal(run({ hash: '#' + new URLSearchParams({ order, checkout }) }).navigation.length, 0);
  }
  for (const search of ['', '?payment=success&order=invalid', `?payment=paid&order=${order}`]) assert.equal(run({ search }).navigation.length, 0);
});
