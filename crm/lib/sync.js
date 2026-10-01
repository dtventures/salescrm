const { ImapFlow } = require('imapflow');
const { ingest } = require('./store');

const BATCH = 500;

// Read new messages from the Sent folder and record who each one went to.
// Only headers are fetched; message bodies are never downloaded.
async function syncSent(store, config, log = () => {}) {
  const { imap, filters, syncSinceDays } = config;
  if (!imap.user || !imap.pass) throw new Error('Set IMAP_USER and IMAP_PASSWORD in .env');

  const client = new ImapFlow({
    host: imap.host,
    port: imap.port,
    secure: true,
    auth: { user: imap.user, pass: imap.pass },
    logger: false,
  });

  await client.connect();
  let added = 0;
  try {
    const mailbox = imap.sentMailbox || (await findSentMailbox(client));
    const lock = await client.getMailboxLock(mailbox, { readOnly: true });
    try {
      const state = store.sync;
      const uidValidity = String(client.mailbox.uidValidity);

      // UIDs only grow, so after the first sync we just ask for anything above the last one seen.
      let uids;
      let lastUid;
      if (state.mailbox === mailbox && state.uidValidity === uidValidity) {
        lastUid = state.lastUid;
        uids = await client.search({ uid: `${lastUid + 1}:*` }, { uid: true });
        uids = uids.filter((u) => u > lastUid);
      } else {
        const since = new Date(Date.now() - syncSinceDays * 86400000);
        uids = await client.search({ since }, { uid: true });
        lastUid = Math.max(0, Number(client.mailbox.uidNext) - 1);
        log(`First sync of "${mailbox}": ${uids.length} sent emails since ${since.toDateString()}`);
      }

      for (let i = 0; i < uids.length; i += BATCH) {
        const range = uids.slice(i, i + BATCH).join(',');
        for await (const msg of client.fetch(range, { uid: true, envelope: true, internalDate: true }, { uid: true })) {
          const env = msg.envelope || {};
          const recipients = [...(env.to || []), ...(env.cc || []), ...(env.bcc || [])];
          const isNew = ingest(store, {
            id: env.messageId || `uid:${uidValidity}:${msg.uid}`,
            date: env.date || msg.internalDate,
            recipients,
          }, filters);
          if (isNew) added += 1;
          if (msg.uid > lastUid) lastUid = msg.uid;
        }
      }

      store.sync = { ...store.sync, mailbox, uidValidity, lastUid };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
  return added;
}

async function findSentMailbox(client) {
  const boxes = await client.list();
  const sent = boxes.find((b) => b.specialUse === '\\Sent') || boxes.find((b) => /^sent\b|\/sent\b/i.test(b.path));
  if (!sent) throw new Error('Could not find a Sent folder. Set SENT_MAILBOX in .env');
  return sent.path;
}

module.exports = { syncSent };
