const test = require('node:test');
const assert = require('node:assert/strict');
const store = require('../lib/store');
const flows = require('../lib/flows');
const { loadConfig } = require('../lib/config');

const { filters } = loadConfig({ IMAP_USER: 'me@acme.com' });
const t0 = new Date('2026-09-01T00:00:00Z');
const at = (day) => new Date(Date.UTC(2026, 8, day, 10));

function setup() {
  const data = store.emptyStore();
  const sent = (id, day, subject, ...to) => store.ingest(data, { id, date: at(day), subject, recipients: to.map((address) => ({ address })) }, filters, at(day));
  const reply = (id, day, subject, address) => store.ingestReply(data, { id, date: at(day), subject, from: { address } }, filters, at(day));
  const run = (day = 30) => flows.evaluate(data, store.view(data).people, at(day));
  return { data, sent, reply, run };
}

test('only leads matching after a flow is created are queued, unless it includes existing', () => {
  const { data, sent, run } = setup();
  sent('a', 2, 'Intro', 'maya@northwind.io');
  flows.createFlow(data, { name: 'New', trigger: 'first_email' }, at(5));
  sent('b', 6, 'Intro', 'leo@northwind.io');
  assert.deepEqual(run().map((e) => e.email), ['leo@northwind.io']);

  flows.createFlow(data, { name: 'All', trigger: 'first_email', includeExisting: true }, at(7));
  assert.equal(run().length, 2);
  assert.equal(run().length, 0, 'never queues the same person twice');
});

test('entry points', () => {
  const { data, sent, reply, run } = setup();
  sent('a', 2, 'Quick intro', 'maya@northwind.io');
  sent('b', 4, 'Pilot proposal', 'maya@northwind.io', 'leo@northwind.io');
  sent('c', 6, 'Following up', 'maya@northwind.io');
  sent('d', 3, 'Hello', 'sam@lumenhq.com');
  reply('r', 7, 'Re: Pilot proposal', 'leo@northwind.io');
  const make = (trigger, value) => flows.createFlow(data, { trigger, value, includeExisting: true }, t0).id;

  const ids = {
    subject: make('subject', 'proposal'),
    replied: make('replied'),
    emailed: make('emailed_n', '3'),
    noReply: make('no_reply', '2'),
    quiet: make('quiet', '20'),
    domain: make('domain', 'lumenhq.com'),
    people: make('company_people', '2'),
  };
  run(25);
  const by = (id) => data.enrollments.filter((e) => e.flowId === id).map((e) => e.email).sort();
  assert.deepEqual(by(ids.subject), ['leo@northwind.io', 'maya@northwind.io']);
  assert.deepEqual(by(ids.replied), ['leo@northwind.io']);
  assert.deepEqual(by(ids.emailed), ['maya@northwind.io']);
  assert.deepEqual(by(ids.noReply), ['maya@northwind.io']);
  assert.deepEqual(by(ids.quiet), ['sam@lumenhq.com'], 'only Sam has gone 20 days by day 25');
  assert.deepEqual(by(ids.domain), ['sam@lumenhq.com']);
  assert.deepEqual(by(ids.people), ['leo@northwind.io', 'maya@northwind.io']);
  assert.ok(data.enrollments.every((e) => e.status === 'pending'));
});

test('replies from strangers are ignored', () => {
  const { data, sent, reply } = setup();
  sent('a', 2, 'Intro', 'maya@northwind.io');
  assert.equal(reply('r1', 3, 'Newsletter', 'news@randomshop.com'), false);
  assert.equal(reply('r2', 3, 'Re: Intro', 'ceo@northwind.io'), true, 'a colleague at a company you contacted counts');
  assert.equal(reply('r3', 3, 'Note to self', 'me@acme.com'), false);
});

test('approving creates one deal per company and attaches each contact', () => {
  const { data, sent, run } = setup();
  sent('a', 2, 'Intro', 'maya@northwind.io', 'leo@northwind.io');
  sent('b', 3, 'Intro', 'omar@gmail.com');
  flows.createFlow(data, { trigger: 'first_email', stage: 'Lead', includeExisting: true }, t0);
  const queued = run();
  assert.equal(Object.keys(data.deals).length, 0, 'nothing happens before approval');

  for (const e of queued) flows.decide(data, e.id, true);
  assert.deepEqual(Object.keys(data.deals).sort(), ['northwind.io', 'omar@gmail.com']);
  assert.deepEqual(data.deals['northwind.io'].contacts.sort(), ['leo@northwind.io', 'maya@northwind.io']);
  assert.equal(data.deals['northwind.io'].stage, 'Lead');

  // A later flow moves the deal forward, never backward.
  const later = flows.createFlow(data, { name: 'Proposal', trigger: 'first_email', stage: 'Proposal', includeExisting: true }, t0);
  const [e1, e2] = run().filter((e) => e.flowId === later.id && e.email.endsWith('northwind.io'));
  flows.decide(data, e1.id, true);
  assert.equal(data.deals['northwind.io'].stage, 'Proposal');
  flows.updateDeal(data, 'northwind.io', { stage: 'Won' });
  flows.decide(data, e2.id, true);
  assert.equal(data.deals['northwind.io'].stage, 'Won', 'closed deals stay closed');
});

test('dismissing leaves deals alone, and deleting a flow keeps approved history', () => {
  const { data, sent, run } = setup();
  sent('a', 2, 'Intro', 'maya@northwind.io');
  sent('b', 3, 'Intro', 'sam@lumenhq.com');
  const f = flows.createFlow(data, { trigger: 'first_email', includeExisting: true }, t0);
  const [a, b] = run();
  flows.decide(data, a.id, false);
  assert.equal(Object.keys(data.deals).length, 0);
  assert.equal(flows.decide(data, a.id, true), null, 'a decision is final');
  flows.decide(data, b.id, true);
  flows.deleteFlow(data, f.id);
  assert.deepEqual(data.enrollments.map((e) => e.status), ['approved']);
});
