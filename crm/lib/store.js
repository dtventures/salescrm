const fs = require('node:fs');
const path = require('node:path');
const { domainOf, isPersonalDomain, isNonPerson } = require('./domains');

// The store keeps the raw facts (which emails went to and came from whom) and
// derives every count and date from them, so a re-sync can never double count.
//
// {
//   messages:    { [messageId]: { date, subject, to: [email] } },    emails you sent
//   replies:     { [messageId]: { date, subject, from: email } },    emails leads sent you
//   contacts:    { [email]: { name, nameDate, addedAt } },
//   companies:   { [domain]: { addedAt } },
//   flows:       [ flow ],         see flows.js
//   enrollments: [ enrollment ],
//   deals:       { [key]: deal },
//   sync:        { boxes: { sent, inbound }, lastSyncAt, lastError }
// }

function emptyStore() {
  return {
    version: 2, messages: {}, replies: {}, contacts: {}, companies: {},
    flows: [], enrollments: [], deals: {}, sync: { boxes: {} },
  };
}

function load(file) {
  let data;
  try {
    data = { ...emptyStore(), ...JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch (err) {
    if (err.code === 'ENOENT') return emptyStore();
    throw err;
  }
  // Version 1 tracked a single mailbox at the top level of `sync`.
  data.sync.boxes ??= {};
  if (data.sync.mailbox && !data.sync.boxes.sent) {
    const { mailbox, uidValidity, lastUid } = data.sync;
    data.sync.boxes.sent = { mailbox, uidValidity, lastUid };
  }
  return data;
}

function save(file, store) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store));
  fs.renameSync(tmp, file);
}

// Decide whether a recipient is someone you reached out to.
// `filters` holds your own addresses and domains plus anything you chose to ignore.
function isLead(email, filters) {
  if (!email || !email.includes('@')) return false;
  if (filters.selfEmails.has(email)) return false;
  if (isNonPerson(email)) return false;
  const domain = domainOf(email);
  return !filters.ignoreDomains.has(domain) && !filters.ignoreEmails.has(email);
}

const normEmail = (a) => String(a || '').trim().toLowerCase();

function upsertContact(store, email, rawName, date, addedAt) {
  const contact = (store.contacts[email] ??= { name: '', nameDate: '', addedAt });
  const name = cleanName(rawName, email);
  if (name && (!contact.name || date >= contact.nameDate)) {
    contact.name = name;
    contact.nameDate = date;
  }
  const domain = domainOf(email);
  if (!isPersonalDomain(domain)) store.companies[domain] ??= { addedAt };
}

// Record one sent email. Returns true when it was new.
// `msg` is { id, date: Date|string, subject, recipients: [{ name, address }] }.
function ingest(store, msg, filters, now = new Date()) {
  if (!msg.id || store.messages[msg.id]) return false;
  const date = new Date(msg.date).toISOString();
  const to = [];

  for (const r of msg.recipients) {
    const email = normEmail(r.address);
    if (!isLead(email, filters) || to.includes(email)) continue;
    to.push(email);
    upsertContact(store, email, r.name, date, now.toISOString());
  }

  store.messages[msg.id] = { date, subject: String(msg.subject || '').trim(), to };
  return true;
}

// Record one received email, but only from someone you already reached out to
// (or a colleague of theirs), so newsletters and strangers never become leads.
// `msg` is { id, date, subject, from: { name, address } }. Returns true when recorded.
function ingestReply(store, msg, filters, now = new Date()) {
  if (!msg.id || store.replies[msg.id] || store.messages[msg.id]) return false;
  const email = normEmail(msg.from?.address);
  if (!isLead(email, filters)) return false;
  if (!store.contacts[email] && !store.companies[domainOf(email)]) return false;

  const date = new Date(msg.date).toISOString();
  upsertContact(store, email, msg.from.name, date, now.toISOString());
  store.replies[msg.id] = { date, subject: String(msg.subject || '').trim(), from: email };
  return true;
}

function cleanName(name, email) {
  const n = String(name || '').replace(/^['"]+|['"]+$/g, '').trim();
  return n && n.toLowerCase() !== email ? n : '';
}

// Build the people and company tables the UI shows.
function view(store) {
  const people = {};
  const companyTouches = {};

  for (const [email, c] of Object.entries(store.contacts)) {
    const domain = domainOf(email);
    people[email] = {
      email,
      name: c.name,
      domain,
      company: isPersonalDomain(domain) ? '' : domain,
      addedAt: c.addedAt,
      firstContact: null,
      lastContact: null,
      timesContacted: 0,
      replies: 0,
      lastReply: null,
      activity: [],
    };
  }

  for (const m of Object.values(store.messages)) {
    const domainsHit = new Set();
    for (const email of m.to) {
      const p = people[email];
      if (!p) continue;
      touch(p, m.date);
      p.activity.push({ dir: 'out', date: m.date, subject: m.subject || '' });
      if (p.company) domainsHit.add(p.company);
    }
    // One email to three people at a company is one touch for that company.
    for (const d of domainsHit) touch((companyTouches[d] ??= blankTouch()), m.date);
  }

  for (const r of Object.values(store.replies)) {
    const p = people[r.from];
    if (!p) continue;
    p.replies += 1;
    if (!p.lastReply || r.date > p.lastReply) p.lastReply = r.date;
    p.activity.push({ dir: 'in', date: r.date, subject: r.subject || '' });
  }

  const all = Object.values(people);
  for (const p of all) p.activity.sort((a, b) => b.date.localeCompare(a.date));

  const companies = Object.entries(store.companies).map(([domain, c]) => {
    const t = companyTouches[domain] || blankTouch();
    const contacts = all.filter((p) => p.company === domain);
    const lastReply = contacts.reduce((max, p) => (p.lastReply && p.lastReply > (max || '') ? p.lastReply : max), null);
    return {
      domain,
      addedAt: c.addedAt,
      people: contacts.length,
      firstContact: t.firstContact,
      lastContact: t.lastContact,
      timesContacted: t.timesContacted,
      replies: contacts.reduce((n, p) => n + p.replies, 0),
      lastReply,
    };
  });

  const byRecent = (a, b) => String(b.lastContact).localeCompare(String(a.lastContact));
  return {
    companies: companies.sort(byRecent),
    people: all.sort(byRecent),
    sync: store.sync,
  };
}

function blankTouch() {
  return { firstContact: null, lastContact: null, timesContacted: 0 };
}

function touch(t, date) {
  t.timesContacted += 1;
  if (!t.firstContact || date < t.firstContact) t.firstContact = date;
  if (!t.lastContact || date > t.lastContact) t.lastContact = date;
}

module.exports = { emptyStore, load, save, ingest, ingestReply, view, isLead };
