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

[`demo/landing.html`](demo/landing.html) is the marketing landing page (hosted: https://claude.ai/artifact/2vQUMaN8Sa3trggd58toBD): hero with a product shot of the Today screen, the problem, how it works, four feature rows with product mockups, privacy and control, the design partner offer, FAQ, and a sign-up form that is a mockup. Earlier streetwear and zine concepts are in git history.

All demo files have no build step and no backend. They are written as artifact pages with no `<!doctype>` or `<html>` wrapper, so opened locally it renders in quirks mode.

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
