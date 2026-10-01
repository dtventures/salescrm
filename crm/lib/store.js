const fs = require('node:fs');
const path = require('node:path');
const { domainOf, isPersonalDomain, isNonPerson } = require('./domains');

// The store keeps the raw facts (which sent emails went to whom) and derives
// every count and date from them, so a re-sync can never double count.
//
// {
//   messages:  { [messageId]: { date, subject, to: [email] } },
//   contacts:  { [email]: { name, nameDate, addedAt } },
//   companies: { [domain]: { addedAt } },
//   sync:      { uidValidity, lastUid, lastSyncAt, lastError }
// }

function emptyStore() {
  return { version: 1, messages: {}, contacts: {}, companies: {}, sync: {} };
}

function load(file) {
  try {
    return { ...emptyStore(), ...JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch (err) {
    if (err.code === 'ENOENT') return emptyStore();
    throw err;
  }
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

// Record one sent email. Returns true when it was new.
// `msg` is { id, date: Date|string, subject, recipients: [{ name, address }] }.
function ingest(store, msg, filters, now = new Date()) {
  if (!msg.id || store.messages[msg.id]) return false;
  const date = new Date(msg.date).toISOString();
  const addedAt = now.toISOString();
  const to = [];

  for (const r of msg.recipients) {
    const email = String(r.address || '').trim().toLowerCase();
    if (!isLead(email, filters) || to.includes(email)) continue;
    to.push(email);

    const contact = (store.contacts[email] ??= { name: '', nameDate: '', addedAt });
    const name = cleanName(r.name, email);
    if (name && (!contact.name || date >= contact.nameDate)) {
      contact.name = name;
      contact.nameDate = date;
    }

    const domain = domainOf(email);
    if (!isPersonalDomain(domain)) store.companies[domain] ??= { addedAt };
  }

  store.messages[msg.id] = { date, subject: String(msg.subject || '').trim(), to };
  return true;
}

function cleanName(name, email) {
  const n = String(name || '').replace(/^['"]+|['"]+$/g, '').trim();
  return n && n.toLowerCase() !== email ? n : '';
}

// Build the two tables the UI shows.
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
      emails: [],
    };
  }

  for (const m of Object.values(store.messages)) {
    const domainsHit = new Set();
    for (const email of m.to) {
      const p = people[email];
      if (!p) continue;
      touch(p, m.date);
      p.emails.push({ date: m.date, subject: m.subject || '' });
      if (p.company) domainsHit.add(p.company);
    }
    // One email to three people at a company is one touch for that company.
    for (const d of domainsHit) touch((companyTouches[d] ??= blankTouch()), m.date);
  }

  const companies = Object.entries(store.companies).map(([domain, c]) => {
    const t = companyTouches[domain] || blankTouch();
    const contacts = Object.values(people).filter((p) => p.company === domain);
    return {
      domain,
      addedAt: c.addedAt,
      people: contacts.length,
      firstContact: t.firstContact,
      lastContact: t.lastContact,
      timesContacted: t.timesContacted,
    };
  });

  const byRecent = (a, b) => String(b.lastContact).localeCompare(String(a.lastContact));
  for (const p of Object.values(people)) p.emails.sort((a, b) => b.date.localeCompare(a.date));
  return {
    companies: companies.sort(byRecent),
    people: Object.values(people).sort(byRecent),
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

module.exports = { emptyStore, load, save, ingest, view, isLead };
