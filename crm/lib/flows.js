const crypto = require('node:crypto');
const { domainOf, isPersonalDomain } = require('./domains');

// Flows watch for an entry point. A lead who matches is added to the flow as
// "pending" and waits for you to approve or dismiss it; nothing happens to them
// until you do. Approving opens the company's deal (one per company, with every
// approved contact attached) or moves it forward to the flow's stage.

const STAGES = ['Lead', 'Qualified', 'Meeting', 'Proposal', 'Won', 'Lost'];
const CLOSED = new Set(['Won', 'Lost']);
const DAY = 86400000;

const list = (v) => String(v || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const count = (v) => Math.max(1, Math.floor(Number(v)) || 1);
const oldestFirst = (items) => [...items].sort((a, b) => a.date.localeCompare(b.date));
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Each entry point returns { at, reason } for a person, or null.
// `at` is when the person started matching; a flow only picks up people who
// match after it was created, unless it was set to include existing leads.
const TRIGGERS = {
  first_email: {
    label: 'First email sent',
    describe: () => 'You email someone for the first time',
    match: (p) => p.firstContact && { at: p.firstContact, reason: 'First email sent' },
  },
  subject: {
    label: 'Subject contains',
    param: 'Words, comma separated',
    describe: (v) => `You send an email with "${list(v).join('" or "')}" in the subject`,
    match: (p, v) => {
      const words = list(v);
      const hit = words.length && oldestFirst(p.activity).find((e) => e.dir === 'out' && words.some((w) => e.subject.toLowerCase().includes(w)));
      return hit && { at: hit.date, reason: `You sent "${hit.subject}"` };
    },
  },
  replied: {
    label: 'They replied',
    describe: () => 'A lead replies to you',
    match: (p) => {
      const hit = oldestFirst(p.activity).find((e) => e.dir === 'in');
      return hit && { at: hit.date, reason: hit.subject ? `Replied "${hit.subject}"` : 'Replied' };
    },
  },
  emailed_n: {
    label: 'Emailed N times',
    param: 'Number of emails',
    describe: (v) => `You've emailed someone ${plural(count(v), 'time')}`,
    match: (p, v) => {
      const sent = oldestFirst(p.activity).filter((e) => e.dir === 'out');
      const nth = sent[count(v) - 1];
      return nth && { at: nth.date, reason: `Emailed ${plural(count(v), 'time')}` };
    },
  },
  no_reply: {
    label: 'No reply after N emails',
    param: 'Number of emails',
    describe: (v) => `${plural(count(v), 'email')} sent and no reply yet`,
    match: (p, v) => {
      if (p.replies) return null;
      const nth = oldestFirst(p.activity).filter((e) => e.dir === 'out')[count(v) - 1];
      return nth && { at: nth.date, reason: `${plural(count(v), 'email')}, no reply` };
    },
  },
  quiet: {
    label: 'Gone quiet',
    param: 'Days without contact',
    describe: (v) => `No email either way for ${plural(count(v), 'day')}`,
    match: (p, v, now) => {
      const last = [p.lastContact, p.lastReply].filter(Boolean).sort().pop();
      if (!last) return null;
      const at = new Date(Date.parse(last) + count(v) * DAY).toISOString();
      return at <= now && { at, reason: `No contact for ${plural(count(v), 'day')}` };
    },
  },
  domain: {
    label: 'Domain on a list',
    param: 'Domains, comma separated',
    describe: (v) => `Their domain is ${list(v).join(', ')}`,
    match: (p, v) => list(v).includes(p.domain) && (p.firstContact || p.addedAt)
      && { at: p.firstContact || p.addedAt, reason: `${p.domain} is on your list` },
  },
  company_people: {
    label: 'N people at a company',
    param: 'Number of people',
    describe: (v) => `You've emailed ${plural(count(v), 'person')} at the same company`,
    match: (p, v, now, ctx) => {
      if (!p.company) return null;
      const firsts = ctx.firstsByCompany[p.company] || [];
      const at = firsts[count(v) - 1];
      return at && { at: at > (p.firstContact || at) ? at : p.firstContact, reason: `${plural(count(v), 'person')} at ${p.company} emailed` };
    },
  },
};

const id = () => crypto.randomBytes(6).toString('hex');

function cleanFlow(input, existing = {}) {
  const trigger = TRIGGERS[input.trigger] ? input.trigger : existing.trigger || 'first_email';
  return {
    name: String(input.name ?? existing.name ?? '').trim() || TRIGGERS[trigger].label,
    trigger,
    value: String(input.value ?? existing.value ?? '').trim(),
    stage: STAGES.includes(input.stage) ? input.stage : existing.stage || 'Lead',
    enabled: input.enabled ?? existing.enabled ?? true,
  };
}

function createFlow(store, input, now = new Date()) {
  const flow = {
    id: id(),
    ...cleanFlow(input),
    createdAt: now.toISOString(),
    // Include existing leads: look back to the beginning instead of from now on.
    startAt: input.includeExisting ? new Date(0).toISOString() : now.toISOString(),
  };
  store.flows.push(flow);
  return flow;
}

function updateFlow(store, flowId, input) {
  const flow = store.flows.find((f) => f.id === flowId);
  if (!flow) return null;
  Object.assign(flow, cleanFlow(input, flow));
  for (const e of store.enrollments) if (e.flowId === flowId) e.flowName = flow.name;
  return flow;
}

// Deleting a flow drops its pending approvals but keeps what you already approved.
function deleteFlow(store, flowId) {
  store.flows = store.flows.filter((f) => f.id !== flowId);
  store.enrollments = store.enrollments.filter((e) => e.flowId !== flowId || e.status === 'approved');
}

// Check every enabled flow against every person and queue new matches for approval.
function evaluate(store, people, now = new Date()) {
  const nowIso = now.toISOString();
  const seen = new Set(store.enrollments.map((e) => `${e.flowId}|${e.email}`));
  const firstsByCompany = {};
  for (const p of people) if (p.company && p.firstContact) (firstsByCompany[p.company] ??= []).push(p.firstContact);
  for (const list of Object.values(firstsByCompany)) list.sort();
  const ctx = { firstsByCompany };

  const added = [];
  for (const flow of store.flows) {
    if (!flow.enabled) continue;
    const trigger = TRIGGERS[flow.trigger];
    for (const p of people) {
      if (seen.has(`${flow.id}|${p.email}`)) continue;
      const m = trigger.match(p, flow.value, nowIso, ctx);
      if (!m || m.at < flow.startAt || m.at > nowIso) continue;
      const e = {
        id: id(), flowId: flow.id, flowName: flow.name, email: p.email,
        status: 'pending', reason: m.reason, matchedAt: m.at, createdAt: nowIso,
      };
      store.enrollments.push(e);
      seen.add(`${flow.id}|${p.email}`);
      added.push(e);
    }
  }
  return added;
}

// A company's deal is keyed by its domain; someone on gmail.com etc. gets their own.
const dealKey = (email) => (isPersonalDomain(domainOf(email)) ? email : domainOf(email));

function decide(store, enrollmentId, approve, now = new Date()) {
  const e = store.enrollments.find((x) => x.id === enrollmentId);
  if (!e || e.status !== 'pending') return null;
  e.status = approve ? 'approved' : 'dismissed';
  e.decidedAt = now.toISOString();
  if (!approve) return e;

  const flow = store.flows.find((f) => f.id === e.flowId);
  const stage = flow?.stage || 'Lead';
  const key = dealKey(e.email);
  const contact = store.contacts[e.email];
  let deal = store.deals[key];
  if (!deal) {
    deal = store.deals[key] = {
      key,
      name: key.includes('@') ? contact?.name || key : key,
      stage, value: 0, contacts: [],
      createdAt: e.decidedAt, updatedAt: e.decidedAt,
      history: [{ date: e.decidedAt, text: `Created in ${stage} by "${e.flowName}"` }],
    };
  } else if (!CLOSED.has(deal.stage) && STAGES.indexOf(stage) > STAGES.indexOf(deal.stage)) {
    deal.history.push({ date: e.decidedAt, text: `Moved from ${deal.stage} to ${stage} by "${e.flowName}"` });
    deal.stage = stage;
    deal.updatedAt = e.decidedAt;
  }
  if (!deal.contacts.includes(e.email)) {
    deal.contacts.push(e.email);
    if (deal.contacts.length > 1) deal.history.push({ date: e.decidedAt, text: `${contact?.name || e.email} added by "${e.flowName}"` });
  }
  e.dealKey = key;
  return e;
}

function updateDeal(store, key, input, now = new Date()) {
  const deal = store.deals[key];
  if (!deal) return null;
  const date = now.toISOString();
  if (STAGES.includes(input.stage) && input.stage !== deal.stage) {
    deal.history.push({ date, text: `Moved from ${deal.stage} to ${input.stage}` });
    deal.stage = input.stage;
  }
  if (input.value !== undefined) deal.value = Math.max(0, Number(input.value) || 0);
  deal.updatedAt = date;
  return deal;
}

// Everything the UI needs about flows, approvals and deals.
function pipelineView(store, base) {
  const people = Object.fromEntries(base.people.map((p) => [p.email, p]));
  const companies = Object.fromEntries(base.companies.map((c) => [c.domain, c]));
  const flows = store.flows.map((f) => {
    const mine = store.enrollments.filter((e) => e.flowId === f.id);
    return {
      ...f,
      description: TRIGGERS[f.trigger].describe(f.value),
      approved: mine.filter((e) => e.status === 'approved').length,
      pending: mine.filter((e) => e.status === 'pending').length,
    };
  });
  const deals = Object.values(store.deals).map((d) => {
    const c = companies[d.key] || people[d.key] || {};
    return {
      ...d,
      lastContact: c.lastContact || null,
      lastReply: c.lastReply || null,
      timesContacted: c.timesContacted || 0,
    };
  });
  return {
    stages: STAGES,
    triggers: Object.entries(TRIGGERS).map(([key, t]) => ({ key, label: t.label, param: t.param || '' })),
    flows,
    enrollments: [...store.enrollments].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.matchedAt.localeCompare(a.matchedAt)),
    deals,
  };
}

module.exports = { STAGES, TRIGGERS, createFlow, updateFlow, deleteFlow, evaluate, decide, updateDeal, pipelineView };
