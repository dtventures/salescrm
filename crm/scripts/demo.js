// Fill a separate data file with made-up sent emails so the UI can be tried
// without connecting a mailbox. Run with: npm run demo
const path = require('node:path');
const store = require('../lib/store');
const { loadConfig } = require('../lib/config');

const file = path.join(__dirname, '..', 'data', 'demo.json');
const { filters } = loadConfig({ IMAP_USER: 'you@yourco.com' });
const data = store.emptyStore();

const people = [
  ['Maya Chen', 'maya@northwind.io'], ['Leo Park', 'leo@northwind.io'], ['Ana Ruiz', 'ana.ruiz@northwind.io'],
  ['Sam Ortiz', 'sam@lumenhq.com'], ['Priya Nair', 'priya@lumenhq.com'],
  ['Jonas Weber', 'jonas@kiteworks.dev'], ['Elle Brooks', 'elle@harborlabs.co'],
  ['Tom Reed', 'tom@harborlabs.co'], ['Nina Rossi', 'nina@fieldstone.ai'],
  ['Omar Haddad', 'omar.haddad@gmail.com'], ['Grace Kim', 'grace@palisade.com'],
];

const day = 86400000;
const now = Date.now();
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

const sent = [];
for (const [i, [name, email]] of people.entries()) {
  const touches = 1 + Math.floor(rand() * 6);
  const start = now - (20 + i * 9 + Math.floor(rand() * 30)) * day;
  for (let t = 0; t < touches; t++) {
    const date = new Date(start + t * (3 + Math.floor(rand() * 9)) * day);
    if (date > now) break;
    sent.push({ id: `demo-${sent.length}`, date, recipients: [{ name, address: email }] });
  }
}
// One email to two people at the same company counts once for the company.
sent.push({
  id: 'demo-group', date: new Date(now - 2 * day),
  recipients: [{ name: 'Maya Chen', address: 'maya@northwind.io' }, { name: 'Leo Park', address: 'leo@northwind.io' }],
});

// Pretend each email was picked up by a sync shortly after it was sent.
sent.sort((a, b) => a.date - b.date);
for (const m of sent) store.ingest(data, m, filters, new Date(+m.date + 5 * 60000));

data.sync = { lastSyncAt: new Date().toISOString(), lastError: '' };
store.save(file, data);
console.log(`Wrote ${sent.length} demo emails to ${file}`);
