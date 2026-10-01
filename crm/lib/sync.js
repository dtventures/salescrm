const { ImapFlow } = require('imapflow');
const { ingest, ingestReply } = require('./store');

const BATCH = 500;

// Read new messages from your Sent folder (who you emailed) and from your
// incoming mail (who replied). Only headers are fetched; bodies are never downloaded.
async function syncMail(store, config, log = () => {}) {
  const { imap } = config;
  if (!imap.user || !imap.pass) throw new Error('Set IMAP_USER and IMAP_PASSWORD in .env');

  const client = new ImapFlow({
    host: imap.host,
    port: imap.port,
    secure: true,
    auth: { user: imap.user, pass: imap.pass },
    logger: false,
  });

  await client.connect();
  try {
    const boxes = await client.list();
    const sent = imap.sentMailbox || findBox(boxes, '\\Sent', /^sent\b|\/sent\b/i);
    if (!sent) throw new Error('Could not find a Sent folder. Set SENT_MAILBOX in .env');
    // Gmail's All Mail also holds replies you archived; elsewhere use the inbox.
    const inbound = imap.inboxMailbox || findBox(boxes, '\\All') || 'INBOX';

    // Sent first, so a reply from someone you only just emailed is recognised.
    const added = await syncBox(client, store, 'sent', sent, config, log, (msg, env) =>
      ingest(store, { ...msg, recipients: [...(env.to || []), ...(env.cc || []), ...(env.bcc || [])] }, config.filters));
    const replies = await syncBox(client, store, 'inbound', inbound, config, log, (msg, env) =>
      ingestReply(store, { ...msg, from: (env.from || [])[0] }, config.filters));
    return { added, replies };
  } finally {
    await client.logout().catch(() => {});
  }
}

function findBox(boxes, specialUse, pattern) {
  const box = boxes.find((b) => b.specialUse === specialUse) || (pattern && boxes.find((b) => pattern.test(b.path)));
  return box?.path;
}

async function syncBox(client, store, kind, mailbox, config, log, record) {
  const lock = await client.getMailboxLock(mailbox, { readOnly: true });
  let added = 0;
  try {
    const state = store.sync.boxes[kind] || {};
    const uidValidity = String(client.mailbox.uidValidity);

    // UIDs only grow, so after the first sync we just ask for anything above the last one seen.
    let uids;
    let lastUid;
    if (state.mailbox === mailbox && state.uidValidity === uidValidity) {
      lastUid = state.lastUid;
      uids = await client.search({ uid: `${lastUid + 1}:*` }, { uid: true });
      uids = uids.filter((u) => u > lastUid);
    } else {
      const since = new Date(Date.now() - config.syncSinceDays * 86400000);
      uids = await client.search({ since }, { uid: true });
      lastUid = Math.max(0, Number(client.mailbox.uidNext) - 1);
      log(`First sync of "${mailbox}": ${uids.length} emails since ${since.toDateString()}`);
    }

    for (let i = 0; i < uids.length; i += BATCH) {
      const range = uids.slice(i, i + BATCH).join(',');
      for await (const msg of client.fetch(range, { uid: true, envelope: true, internalDate: true }, { uid: true })) {
        const env = msg.envelope || {};
        const base = {
          id: env.messageId || `uid:${mailbox}:${uidValidity}:${msg.uid}`,
          date: env.date || msg.internalDate,
          subject: env.subject,
        };
        if (record(base, env)) added += 1;
        if (msg.uid > lastUid) lastUid = msg.uid;
      }
    }

    store.sync.boxes[kind] = { mailbox, uidValidity, lastUid };
  } finally {
    lock.release();
  }
  return added;
}

module.exports = { syncMail };
