# Outreach CRM

A minimal CRM that fills itself in from your mail. You never enter contacts: every email you send is picked up, replies are matched to the people you emailed, and the people and companies appear with their dates and counts. Flows watch for entry points and queue leads for your approval, and approving opens or moves the company's deal.

![Outreach CRM](screenshot.png)

## Companies and people

For each **company** (grouped by email domain) and each **person** (name and email address) it shows:

| Column | Meaning |
|---|---|
| Added | When the CRM first picked them up |
| First contact | The date of the first email you sent them |
| Last contact | The date of the most recent email you sent them |
| Emails sent | How many times you contacted them. For a company, one email to three people there counts once |
| Replies | How many times they wrote back |
| Deal | The stage of the company's deal, if it has one |
| Activity | This week, This month, or Quiet (no email in over 30 days). The filters at the top use the same groups |

Click any row to open a side panel with its details, the people at that company, its deal, the flows it's in, and a timeline of every email you sent and every reply. Press `/` to search and `Esc` to close the panel.

## Flows

A flow has an **entry point** and a **deal stage**. When a lead matches the entry point, they're added to the flow and wait in **Approvals**. Nothing happens to them until you approve.

| Entry point | A lead matches when |
|---|---|
| First email sent | You email them for the first time |
| Subject contains | You send them an email with any of your words in the subject, e.g. `proposal, pricing` |
| They replied | They reply to you |
| Emailed N times | You've emailed them N times |
| No reply after N emails | You've emailed them N times and they haven't replied |
| Gone quiet | No email either way for N days |
| Domain on a list | Their domain is on your list, e.g. target accounts |
| N people at a company | You've emailed N different people at their company |

- A new flow only picks up leads who match **after** it was created. Tick "Also add leads who already match" to look back through your history as well.
- A lead goes into each flow at most once. Turn a flow off with its switch, or delete it. Deleting removes leads still waiting for approval but keeps the ones you approved.
- **Notifications:** the Approvals count shows in the sidebar and the browser tab title. Click **Turn on** in Approvals to also get a desktop notification while the CRM is open in a tab.

## Deals

There is **one deal per company**, with each approved contact attached to it. Someone on a personal address (gmail.com etc.) gets a deal of their own.

- Approving a lead creates the company's deal in the flow's stage. If the deal already exists, approving adds the contact and moves the deal forward to the flow's stage if it's behind. Flows never move a deal backward, and never reopen a deal that's Won or Lost.
- The stages are Lead, Qualified, Meeting, Proposal, Won and Lost. Drag a card between columns, or change the stage and value in the deal's panel. Each deal keeps a history of what moved it.
- Last contact and last reply on a deal update by themselves from your mail.

## How it works

The server connects to your mailbox over IMAP and reads the headers (To, Cc, Bcc, From, Date, Subject) of your **Sent** folder and your incoming mail. Gmail's All Mail is used for incoming mail so replies you archived count too; other providers use the inbox. Everything is stored in `data/crm.json`. Message bodies are never downloaded, and nothing is ever sent or changed in your mailbox (folders are opened read-only).

- The first sync looks back `SYNC_SINCE_DAYS` (default 365). After that it checks for new mail every `SYNC_INTERVAL_MINUTES` (default 5), and **Sync now** checks straight away. Flows are checked after every sync.
- Re-syncing never double counts: each email is stored once by its Message-ID.
- Incoming mail is only recorded from people you've emailed, or colleagues at their company, so newsletters and strangers never become leads.
- Skipped automatically: you, your other addresses, colleagues on your own work domain, and robot addresses (`noreply@`, `notifications@` …).
- People on personal domains (gmail.com, outlook.com …) are tracked as people, marked **Personal**, and not grouped into a company.
- Use `IGNORE_DOMAINS` / `IGNORE_EMAILS` for anyone you email who isn't outreach.
- Company logos are loaded from DuckDuckGo's favicon service, which means it sees those domains. Set `COMPANY_LOGOS=off` to show letters instead.

## Quick start

Double-click **Start CRM.command** (Mac) or **Start CRM.bat** (Windows). It installs what it needs, opens http://localhost:3000, and shows sample data until you add a `.env` with your mailbox. It needs [Node.js](https://nodejs.org) 22 or newer; if Node.js is missing, it opens the download page.

On a Mac, the first time you open it you may need to right-click the file, choose **Open**, then confirm.

## Setup

Requires Node.js 22 or newer.

```bash
cd crm
npm install
cp .env.example .env   # then fill in your mailbox details
npm start              # open http://localhost:3000
```

**Gmail / Google Workspace:** set `IMAP_USER` to your address and `IMAP_PASSWORD` to an [app password](https://myaccount.google.com/apppasswords) (needs 2-step verification on). Leave the host as `imap.gmail.com`. Your normal password will not work.

**Outlook / Microsoft 365:** set `IMAP_HOST=outlook.office365.com`. Other providers: use their IMAP host. Folders are found automatically, or set `SENT_MAILBOX` and `INBOX_MAILBOX`.

Keep it running (for example with `pm2 start npm -- start`, or a login item) and it stays up to date on its own. The server only listens on `localhost` because there is no login, and it refuses changes sent from other websites.

## Try it without a mailbox

```bash
npm run demo
```

Loads made-up data (emails, replies, flows, approvals and deals) into `data/demo.json` and starts the UI with syncing turned off.

## Tests

```bash
npm test
```

## Files

- `server.js` — web server, API and the sync schedule
- `lib/sync.js` — reads the Sent folder and incoming mail over IMAP
- `lib/store.js` — records emails and replies and works out every date and count
- `lib/flows.js` — entry points, approvals and deals
- `lib/config.js`, `lib/domains.js` — settings, and which addresses count as leads
- `public/index.html` — the whole UI, no build step
