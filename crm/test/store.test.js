const test = require('node:test');
const assert = require('node:assert/strict');
const store = require('../lib/store');
const { loadConfig } = require('../lib/config');

const { filters } = loadConfig({ IMAP_USER: 'me@acme.com', IGNORE_DOMAINS: 'vendor.com' });
const added = new Date('2026-09-01T00:00:00Z');

function send(data, id, date, ...recipients) {
  return store.ingest(data, {
    id, date,
    recipients: recipients.map((r) => (typeof r === 'string' ? { address: r } : r)),
  }, filters, added);
}

test('tracks first, last and count per person and company', () => {
  const data = store.emptyStore();
  send(data, 'a', '2026-09-03T10:00:00Z', { name: 'Maya Chen', address: 'Maya@Northwind.io' });
  send(data, 'b', '2026-09-10T10:00:00Z', 'maya@northwind.io');
  send(data, 'c', '2026-09-05T10:00:00Z', 'leo@northwind.io');

  const v = store.view(data);
  const maya = v.people.find((p) => p.email === 'maya@northwind.io');
  assert.equal(maya.name, 'Maya Chen');
  assert.equal(maya.timesContacted, 2);
  assert.equal(maya.firstContact, '2026-09-03T10:00:00.000Z');
  assert.equal(maya.lastContact, '2026-09-10T10:00:00.000Z');
  assert.equal(maya.addedAt, added.toISOString());

  assert.deepEqual(v.companies.map((c) => [c.domain, c.people, c.timesContacted]), [['northwind.io', 2, 3]]);
});

test('one email to several people at a company is one company touch', () => {
  const data = store.emptyStore();
  send(data, 'a', '2026-09-03T10:00:00Z', 'maya@northwind.io', 'leo@northwind.io');
  const [co] = store.view(data).companies;
  assert.equal(co.timesContacted, 1);
  assert.equal(co.people, 2);
});

test('re-syncing the same message does not double count', () => {
  const data = store.emptyStore();
  assert.equal(send(data, 'a', '2026-09-03T10:00:00Z', 'maya@northwind.io'), true);
  assert.equal(send(data, 'a', '2026-09-03T10:00:00Z', 'maya@northwind.io'), false);
  assert.equal(store.view(data).people[0].timesContacted, 1);
});

test('skips yourself, your own domain, ignored domains and robots', () => {
  const data = store.emptyStore();
  send(data, 'a', '2026-09-03T10:00:00Z',
    'me@acme.com', 'teammate@acme.com', 'billing@vendor.com', 'noreply@northwind.io', 'maya@northwind.io');
  assert.deepEqual(Object.keys(data.contacts), ['maya@northwind.io']);
});

test('personal addresses are people without a company', () => {
  const data = store.emptyStore();
  send(data, 'a', '2026-09-03T10:00:00Z', 'omar@gmail.com');
  const v = store.view(data);
  assert.equal(v.companies.length, 0);
  assert.equal(v.people[0].company, '');
});

test('keeps the most recent display name', () => {
  const data = store.emptyStore();
  send(data, 'a', '2026-09-10T10:00:00Z', { name: 'Maya Chen', address: 'maya@northwind.io' });
  send(data, 'b', '2026-09-03T10:00:00Z', { name: 'maya', address: 'maya@northwind.io' });
  send(data, 'c', '2026-09-12T10:00:00Z', { name: '', address: 'maya@northwind.io' });
  assert.equal(data.contacts['maya@northwind.io'].name, 'Maya Chen');
});
