// Mailbox providers whose domain says nothing about the company someone works at.
// People on these domains are still tracked, just not grouped under a company.
const PERSONAL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'hotmail.co.uk',
  'live.com', 'msn.com', 'yahoo.com', 'yahoo.co.uk', 'ymail.com', 'aol.com',
  'icloud.com', 'me.com', 'mac.com', 'proton.me', 'protonmail.com', 'pm.me',
  'gmx.com', 'gmx.de', 'mail.com', 'zoho.com', 'yandex.com', 'fastmail.com',
  'hey.com', 'qq.com', '163.com', 'web.de',
]);

// Automated senders and lists are never leads.
const NON_PERSON = /^(no-?reply|do-?not-?reply|notifications?|mailer-daemon|postmaster|bounce)/i;

function domainOf(email) {
  const at = email.lastIndexOf('@');
  return at === -1 ? '' : email.slice(at + 1);
}

function isPersonalDomain(domain) {
  return PERSONAL_DOMAINS.has(domain);
}

function isNonPerson(email) {
  return NON_PERSON.test(email);
}

module.exports = { domainOf, isPersonalDomain, isNonPerson };
