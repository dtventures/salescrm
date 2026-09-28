# Action patterns: inline actions and focus sessions

Two ways for a user to go from "something needs doing" to "done", always seeing what will happen before it happens. They solve different jobs and ship as separate features:

| Pattern | Job | Where it lives |
|---|---|---|
| **Inline actions** | Triage a mixed daily list (emails, tasks, alerts) and act on one item without leaving the list | The main Today / home list |
| **Focus session** | Clear the day's email follow-ups in one sitting, one email at a time | A dedicated full-screen mode, entered from a button or a morning prompt |

Reference implementations, no dependencies, open directly in a browser:

- [`inline-actions.html`](inline-actions.html)
- [`focus-session.html`](focus-session.html)

Interactive versions of both also live on the design canvas (App demos page).

---

## Shared model

Both patterns act on the same item shape. Field names are suggestions; map them to your API.

```ts
type ActionKind = 'email' | 'task';
type Outcome = 'sent' | 'task' | 'snoozed' | 'done' | 'skipped';

interface ActionItem {
  id: string;
  kind: ActionKind;
  title: string;          // verb first: "Send Priya the go-live plan"
  subtitle: string;       // "Acme Logistics · You promised this yesterday"
  tag?: 'Promised' | 'Draft ready' | 'Task' | 'Blocked';
  context?: string;       // who / account line shown when open
  promise?: string;       // quoted commitment this item fulfils, with its source
  reasons?: string[];     // "why now", each ideally linked to its source

  // email only
  to?: string;
  subject?: string;
  body?: string;          // editable draft

  // what will happen on the primary action, computed by the server, shown BEFORE acting
  effects: string[];      // e.g. ["Email goes to Priya from your Gmail", "Logged on Acme's timeline", ...]
  checks: { passed: boolean; summary: string };   // policy result; if !passed the primary action is disabled

  doneSummary?: string;   // one line shown after success: "Sent · logged on Acme · back Friday if no reply"
}
```

**Rules that apply to both**

1. **Preview before acting.** The effects list and the policy result are always visible next to the primary button. Never compute effects in the client from guesses; ask the server what the action will do.
2. **Blocked means disabled, with the reason.** If `checks.passed` is false (for example, a do-not-contact list or unknown identity), the primary button is disabled and the reason is shown in place of the pass line. Snooze and mark done still work.
3. **Undo is real.** Queue sends server-side and release them after the undo window (8 seconds in the references). Undo cancels the queued send and restores the item. If the send has already left, Undo is hidden, not faked.
4. **Edits are kept.** Draft edits persist per item across expand/collapse, skip, exit and undo.
5. **Every outcome is logged** (activity log) with the item, outcome, time and who approved it.
6. **Tasks never send.** A `task` item's primary action is "Add task"; its effects say nothing is sent.

---

## Inline actions

**Use case:** the user scans today's list and handles items in any order, mixing emails and tasks.

### Behaviour

- Each row is collapsed by default: tick circle, title, subtitle, tag, and a Snooze button.
- **Clicking anywhere on the row** (except the tick and Snooze) expands it in place. Only one row is expanded at a time; expanding another collapses the first.
- Clicking the expanded row's title (or pressing Esc) collapses it.
- Expanded row shows:
  - the promise quote, if any
  - left: To, Subject, and an editable draft (email), or the task description (task)
  - right: "When you send" / "When you add it" with the numbered effects and the checks line
  - footer: primary (Send / Add task), Mark done without sending, Snooze, and a shortcut hint
- After any action the row becomes a **done row**: a check icon, the struck-through title, the `doneSummary` (or "Snoozed until tomorrow at 9:00" / "Marked done without sending"), and **Undo**. The next open item expands automatically.
- A **toast** confirms the action with Undo and auto-hides after the undo window.
- The headline counts open items ("Four things to do.") and becomes "You're all caught up." at zero.

### Keyboard and accessibility

- Row and title are real `<button>`s with `aria-expanded`.
- ⌘/Ctrl + Enter runs the primary action on the expanded row; Esc collapses.
- Focus moves to the draft when a row expands.
- The list is `aria-live="polite"` so outcome changes are announced; the toast has `role="status"`.

### Acceptance criteria

- [ ] Clicking a row expands it; clicking another collapses the first.
- [ ] The effects and checks are visible before the primary button is pressed.
- [ ] A blocked item shows the block reason and its Send is disabled.
- [ ] Sending marks the row done, opens the next open item, and shows a toast with Undo.
- [ ] Undo restores the item as open and expanded with the edited draft intact.
- [ ] Snooze and Mark done work from both collapsed and expanded rows.
- [ ] Task items say "Add task" and never send anything.

---

## Focus session

**Use case:** a daily routine to clear email follow-ups quickly. Emails only; tasks stay in the list.

### Behaviour

- **Entry:** a button or banner on Today ("Email follow-ups · 4 drafts ready · about 8 minutes · Start"), or a link in the morning digest. The time estimate is 2 minutes per email.
- **Start screen:** count, estimate, and a preview of the first item.
- **Queue snapshot:** the queue is the open emails at the moment Start is pressed. Emails that arrive mid-session wait for the next session.
- **Card:** left is context (who, title, promise, reasons) and the "When you send" line with the checks; right is To, Subject, and the draft (read view; Edit switches to a textarea).
- **Controls:** Skip (S), Snooze (Z), Edit (E), Send & next (⌘/Ctrl + Enter), Exit (Esc). On the last remaining card the primary reads "Send & finish".
- **Progress:** one segment per email: current (accent), sent (green), skipped or snoozed (grey), pending (track).
- **Exit** any time. Progress is kept; exiting after acting shows the recap.
- **Recap:** "Follow-ups done" with counts, and one row per email: Sent / Snoozed / Skipped with a note, and **Undo** (sent, snoozed) or **Do it now** (skipped), which reopens that card.
- **Skipped** emails stay on today's list. **Snoozed** return tomorrow at 9:00. **Sent** show as done rows on Today.

### Keyboard and accessibility

- Single-key shortcuts (S, Z, E) are ignored while typing in the draft; ⌘/Ctrl + Enter and Esc always work.
- Every control is a real button with its shortcut shown.
- The card heading is the email title; move focus to it when the card changes.

### Acceptance criteria

- [ ] Start shows the count and estimate and begins at the first email.
- [ ] Send & next sends, marks the segment green and moves to the next unhandled email.
- [ ] Skip and Snooze move on without sending; their segments turn grey.
- [ ] Edits made in Edit mode are what gets sent.
- [ ] A blocked email cannot be sent; Skip and Snooze still work.
- [ ] The last card says "Send & finish" and ends on the recap.
- [ ] Recap Undo and Do it now reopen the right card with its draft intact.
- [ ] Items added during a session do not appear until the next one.

---

## Using this in another project with Claude Code

On your Mac, get these files, then point Claude Code at them from your other project.

```bash
# 1. Get the files (the repo is private, so use your normal GitHub login)
git clone https://github.com/dtventures/salescrm.git ~/code/salescrm
cd ~/code/salescrm
git checkout claude/revenue-memory-intent-prd-8elwmj

# 2. Open your other project and give Claude Code access to the hand-off folder
cd ~/path/to/your-other-project
claude --add-dir ~/code/salescrm/handoff/action-patterns
```

Then paste a prompt like this:

```text
Read handoff/action-patterns/README.md and the two reference files
inline-actions.html and focus-session.html in the added directory.

Implement both patterns in this project using our existing stack, components and styling:
1. Inline actions on our main list view.
2. A separate focus session for email follow-ups, launched from a button on that list.

Map ActionItem to our data model, keep the "preview before acting" effects list and the
policy checks, make Undo cancel a queued send, and cover the acceptance criteria in the
README with tests. Start by proposing where each piece goes in our codebase before writing code.
```

If you only want one pattern, name just that one in the prompt.
