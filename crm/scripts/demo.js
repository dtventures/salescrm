// Fill a separate data file with made-up sent emails so the UI can be tried
// without connecting a mailbox. Run with: npm run demo
const path = require('node:path');
const store = require('../lib/store');
const { loadConfig } = require('../lib/config');
const flows = require('../lib/flows');

const file = path.join(__dirname, '..', 'data', 'demo.json');
const { filters } = loadConfig({ IMAP_USER: 'you@yourco.com' });
const data = store.emptyStore();

const people = [
  ['Maya Chen', 'maya@northwind.io'], ['Leo Park', 'leo@northwind.io'], ['Ana Ruiz', 'ana.ruiz@northwind.io'],
  ['Sam Ortiz', 'sam@lumenhq.com'], ['Priya Nair', 'priya@lumenhq.com'],
  ['Jonas Weber', 'jonas@kiteworks.dev'], ['Elle Brooks', 'elle@harborlabs.co'],
  ['Tom Reed', 'tom@harborlabs.co'], ['Nina Rossi', 'nina@fieldstone.ai'],
  ['Omar Haddad', 'omar.haddad@gmail.com'], ['Grace Kim', 'grace@palisade.com'],
  ['Daniel Osei', 'daniel@brightpath.io'], ['Hana Sato', 'hana@brightpath.io'],
  ['Lucas Moreau', 'lucas@quarry.so'], ['Isla Grant', 'isla@tidewater.co'],
  ['Felix Novak', 'felix@tidewater.co'], ['Zara Ahmed', 'zara@meridianlabs.com'],
  ['Ben Carter', 'ben@outpost.dev'], ['Chloe Martin', 'chloe@verdant.ai'],
  ['', 'founders@stackline.io'], ['Ravi Shah', 'ravi.shah@outlook.com'],
];

const subjects = ['Quick intro', 'Following up', 'Re: Quick intro', 'Worth a call next week?', 'Notes from our chat', 'Last note from me'];

const day = 86400000;
const now = Date.now();
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

const sent = [];
for (const [i, [name, email]] of people.entries()) {
  const touches = 1 + Math.floor(rand() * 6);
  const start = now - (3 + i * 6 + Math.floor(rand() * 30)) * day;
  for (let t = 0; t < touches; t++) {
    const date = new Date(start + t * (3 + Math.floor(rand() * 9)) * day);
    if (date > now) break;
    sent.push({ id: `demo-${sent.length}`, date, subject: subjects[t], recipients: [{ name, address: email }] });
  }
}
// One email to two people at the same company counts once for the company.
sent.push({
  id: 'demo-group', date: new Date(now - 2 * day), subject: 'Pilot proposal for Northwind',
  recipients: [{ name: 'Maya Chen', address: 'maya@northwind.io' }, { name: 'Leo Park', address: 'leo@northwind.io' }],
});

// Pretend each email was picked up by a sync shortly after it was sent.
sent.sort((a, b) => a.date - b.date);
for (const m of sent) store.ingest(data, m, filters, new Date(+m.date + 5 * 60000));

// Some of them wrote back.
const replies = [
  ['maya@northwind.io', 1, 'Re: Pilot proposal for Northwind'], ['leo@northwind.io', 3, 'Re: Quick intro'],
  ['elle@harborlabs.co', 5, 'Re: Worth a call next week?'], ['sam@lumenhq.com', 26, 'Re: Following up'],
  ['daniel@brightpath.io', 60, 'Re: Quick intro'], ['zara@meridianlabs.com', 85, 'Re: Notes from our chat'],
  ['jonas@kiteworks.dev', 21, 'Re: Following up'],
];
for (const [i, [email, daysAgo, subject]] of replies.entries()) {
  const contact = data.contacts[email];
  store.ingestReply(data, { id: `reply-${i}`, date: new Date(now - daysAgo * day), subject, from: { name: contact.name, address: email } }, filters);
}

// A few flows, set to include leads that already matched so the demo has history.
const longAgo = new Date(now - 120 * day);
const make = (input) => flows.createFlow(data, { ...input, includeExisting: true }, longAgo);
const fReplied = make({ name: 'Replied → Qualified', trigger: 'replied', stage: 'Qualified' });
const fProposal = make({ name: 'Proposal sent', trigger: 'subject', value: 'proposal, pricing', stage: 'Proposal' });
make({ name: 'Warm after 4 emails', trigger: 'emailed_n', value: '4', stage: 'Lead' });
make({ name: 'Gone quiet 30 days', trigger: 'quiet', value: '30', stage: 'Lead' });
make({ name: 'Target accounts', trigger: 'domain', value: 'quarry.so, verdant.ai, tidewater.co', stage: 'Lead' });

flows.evaluate(data, store.view(data).people, new Date(now));

// Approve the older matches as if they'd been handled at the time; leave recent ones waiting.
for (const e of [...data.enrollments].sort((a, b) => a.matchedAt.localeCompare(b.matchedAt))) {
  const age = now - Date.parse(e.matchedAt);
  if (age > 6 * day && e.flowId !== fProposal.id) flows.decide(data, e.id, age < 70 * day || e.flowId === fReplied.id, new Date(Date.parse(e.matchedAt) + day));
}
data.enrollments.forEach((e) => { e.createdAt = new Date(Math.min(Date.parse(e.matchedAt) + 3600000, now)).toISOString(); });
if (data.deals['harborlabs.co']) flows.updateDeal(data, 'harborlabs.co', { stage: 'Meeting', value: 18000 }, new Date(now - 3 * day));
if (data.deals['lumenhq.com']) flows.updateDeal(data, 'lumenhq.com', { value: 9500 }, new Date(now - 20 * day));
if (data.deals['brightpath.io']) flows.updateDeal(data, 'brightpath.io', { stage: 'Won', value: 24000 }, new Date(now - 30 * day));
if (data.deals['meridianlabs.com']) flows.updateDeal(data, 'meridianlabs.com', { stage: 'Lost', value: 6000 }, new Date(now - 60 * day));
if (data.deals['kiteworks.dev']) flows.updateDeal(data, 'kiteworks.dev', { value: 12000 }, new Date(now - 18 * day));

data.sync = { boxes: {}, lastSyncAt: new Date().toISOString(), lastError: '' };
store.save(file, data);
const pending = data.enrollments.filter((e) => e.status === 'pending').length;
console.log(`Wrote ${sent.length} demo emails, ${replies.length} replies, ${Object.keys(data.deals).length} deals and ${pending} approvals to ${file}`);
