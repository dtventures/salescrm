# salescrm — Revenue Memory & Intent Platform

A unified system that captures every prospect interaction, connects it to a trusted identity, makes the history searchable, and turns real-time intent into reviewable action.

**One memory. One timeline. One place to act.**

```text
Capture              Resolve              Understand                 Act
Gmail + web SDK  --> person + account --> timeline + cited Q&A --> alert + draft + task
```

## Status

Product discovery and design-partner validation. No production code yet (only the clickable demo below); the next step is **Stage 0 — Foundation** (tenant authentication, canonical event schema, connector framework, audit model, design-partner dataset). The exit evidence for that stage is passing replay and deletion tests.

## Clickable demo

[`demo/index.html`](demo/index.html) is a single-file demo of the core loop on sample data (hosted: https://claude.ai/artifact/YVtzNnKqYT86P5Y8dWdbBj). It covers the intent queue with explainable scores, account timelines with cited rolling memory, cited Q&A, draft approval with policy checks, rules in test mode, connector health, and the audit log. Press **Simulate live event** to watch a tracked-link click become a new signal.

[`demo/onboarding.html`](demo/onboarding.html) is a clickable mockup of first-run onboarding (hosted: https://claude.ai/artifact/DYEtLtrytkBQQ86A246iga): connect Google with a plain list of what Trellis can and never does, choose the history window, watch the import, confirm how companies were sorted, add the website snippet and consent mode, and choose how Trellis acts. It ends on the first to-do list and links to the demo.

[`demo/landing.html`](demo/landing.html) is the marketing landing page (hosted: https://claude.ai/artifact/2vQUMaN8Sa3trggd58toBD). It positions Trellis as one platform for email, CRM and pipeline, calendar, meeting notes, website journey and email tracking: a hero shot of an account timeline mixing every channel, the problem, the eight platform capabilities, how it works, feature rows (timeline, self-updating CRM, buyer journey), pipeline intelligence (intent ranking, deal risk), answers with sources, acting from one place, a teams section (roles, manager views, activity log, connection health), privacy, the design partner offer, FAQ and a mockup sign-up. Earlier streetwear and zine concepts are in git history.

[`demo/landing-v2.html`](demo/landing-v2.html) is a second landing page told as outcomes, not features (hosted: https://claude.ai/artifact/MKkTnNbT8NU8LpEt7jXbUd): a Monday-morning before/after in the hero, "three things you'll stop doing" (searching, forgetting, guessing), an interactive "same day, before and after" with five moments (start of day, before a call, someone reading pricing, after the call, Friday pipeline review), how work feels for each persona, a peace-of-mind section, and a short FAQ. It is built for a polished, spacious look: large type, soft tinted panels and real product windows (the Today list, a customer timeline, cited answers, a live pricing-page alert, deals at risk and the review-and-send checks), with no diagrams or generic icons. It makes no pricing claims and has no invented statistics or testimonials.

All demo files have no build step and no backend. They are written as artifact pages with no `<!doctype>` or `<html>` wrapper, so opened locally it renders in quirks mode.

## Outreach CRM

[`crm/`](crm/README.md) is a small working CRM that fills itself in from your Sent folder over IMAP: companies by domain, people by name and email, and for each one when they were added, first and last contact, and how many times they were contacted. Run it with `npm start` after adding your mailbox details to `crm/.env`.

## Hand-off

- [Action patterns: inline actions and focus sessions](handoff/action-patterns/README.md): spec, acceptance criteria and dependency-free reference implementations, ready to port into another project.

## Documents

- [Product requirements document (v0.1)](docs/prd/revenue-memory-intent-platform.md)

## Open decisions

These need answers before the stages that depend on them (see PRD §12):

| Decision | Owner | Decide before |
|---|---|---|
| Ideal customer profile | Founder | Design |
| Consent posture and launch regions | Founder + counsel | Beta |
| Action autonomy | Product | Alpha |
| Identity economics | Founder | Pricing |
