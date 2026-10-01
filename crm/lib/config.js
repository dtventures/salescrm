const path = require('node:path');
const { domainOf, isPersonalDomain } = require('./domains');

const list = (v) =>
  String(v || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

function loadConfig(env = process.env) {
  const user = (env.IMAP_USER || '').trim().toLowerCase();
  const selfEmails = new Set([user, ...list(env.MY_OTHER_EMAILS)].filter(Boolean));

  // Mail to your own colleagues isn't outreach, so your own work domain is ignored.
  const ignoreDomains = new Set(list(env.IGNORE_DOMAINS));
  for (const email of selfEmails) {
    const d = domainOf(email);
    if (d && !isPersonalDomain(d)) ignoreDomains.add(d);
  }

  return {
    port: Number(env.PORT) || 3000,
    dataFile: path.resolve(env.DATA_FILE || path.join(__dirname, '..', 'data', 'crm.json')),
    syncIntervalMinutes: Number(env.SYNC_INTERVAL_MINUTES) || 5,
    syncSinceDays: Number(env.SYNC_SINCE_DAYS) || 365,
    // Logos are fetched from DuckDuckGo's favicon service, which sees the domains.
    companyLogos: env.COMPANY_LOGOS !== 'off',
    imap: {
      host: env.IMAP_HOST || 'imap.gmail.com',
      port: Number(env.IMAP_PORT) || 993,
      user,
      pass: (env.IMAP_PASSWORD || '').replace(/\s+/g, ''),
      sentMailbox: env.SENT_MAILBOX || '',
      inboxMailbox: env.INBOX_MAILBOX || '',
    },
    filters: {
      selfEmails,
      ignoreDomains,
      ignoreEmails: new Set(list(env.IGNORE_EMAILS)),
    },
  };
}

module.exports = { loadConfig };
