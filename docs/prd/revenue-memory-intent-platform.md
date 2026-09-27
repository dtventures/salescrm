# Revenue Memory & Intent Platform

## Product requirements document

**Draft:** v0.1  
**Date:** September 27, 2026  
**Purpose:** Product discovery and design-partner validation

A unified system that captures every prospect interaction, connects it to a trusted identity, makes the history searchable, and turns real-time intent into reviewable action.

---

## Executive brief

### Product definition

**One memory. One timeline. One place to act.**

The product replaces manual CRM upkeep with an event-driven customer memory. It ingests conversations and behavioral signals, resolves them to people and accounts, answers questions with citations, and recommends or executes actions under explicit policy.

- **System of record — capture automatically:** Email, meetings, notes, calls, web visits, link clicks, contacts, deals, and outcomes enter one canonical history.

- **System of intelligence — retrieve with evidence:** Users search and ask questions across the complete relationship, with every answer linked to its source events.

- **System of action — respond to intent:** The product detects meaningful behavior, scores confidence, and triggers a task, alert, draft, or workflow in real time.

**Core thesis:** The durable asset is not a prettier CRM table. It is an owned event ledger and customer graph that make every downstream model, workflow, and interface better.

### The first release closes one complete loop

```text
Capture              Resolve              Understand                 Act
Gmail + web SDK  --> person + account --> timeline + cited Q&A --> alert + draft + task
```

### Recommended product boundary

Build the CRM, event capture, retrieval, scoring, and orchestration. Use first-party identifiers whenever possible. Treat anonymous person-level identification and native meeting bots as optional licensed or integrated capabilities, not prerequisites for product-market fit.

Initial product targets:

- **Signal-to-alert:** under 5 minutes
- **Known-contact match rate:** at least 95%
- **AI traceability:** 100% of factual claims cite evidence

---

## Working assumptions

- **Initial customer:** Founder-led B2B sales teams and small revenue teams with 1–20 sellers.

- **Primary workspace:** Google Workspace; Gmail and Google Calendar are the first connectors.

- **Primary website:** A customer-controlled site on which a first-party JavaScript SDK can be installed.

- **Action posture:** Recommendations and drafts require human approval by default; autonomous sends are opt-in and policy-bound.

- **Data posture:** Tenant isolation, configurable retention, export, and deletion are launch requirements rather than enterprise add-ons.

- **Commercial posture:** The product must deliver value without requiring a third-party anonymous identity subscription.

**Decision dependency:** Confirm the target customer, geographic launch scope, and consent model before enabling anonymous identity or automated outreach.

### Definitions

**Known visitor:** A web session linked through a first-party signal such as a tracked email click, authenticated session, or form submission.

**Anonymous visitor:** A browser or company visit with no first-party person identifier. A vendor may enrich it, but confidence and legal scope vary.

---

## 1. Problem and users

### Problem statement

A seller's customer knowledge is fragmented across inboxes, meeting notes, recordings, CRM fields, calendars, and website analytics. Each tool preserves a slice, but none reconstructs the relationship quickly enough to guide the next action.

### Current failure modes

- Notes are copied manually, incompletely, or not at all.
- Search is trapped inside each application.
- CRM timelines contain activity metadata but not useful context.
- Web intent and email engagement are separated from deal history.
- Signals arrive without identity, confidence, or recommended follow-up.
- Automation fires on shallow events and creates noisy outreach.

### Jobs to be done

- **Before a conversation:** “Tell me everything that matters about this account.”

- **During follow-up:** “What did they say about timing, budget, and objections?”

- **When intent spikes:** “Who is active, why does it matter, and what should I do?”

- **During review:** “Which actions moved the opportunity, with evidence?”

- **During handoff:** “Transfer the full relationship without a briefing meeting.”

### Primary personas

| Persona | Primary need | Desired outcome |
|---|---|---|
| Founder-seller | Fast context | Zero-upkeep recall |
| Account executive | Prioritized follow-up | Daily action queue |
| Sales leader | Pipeline truth | Evidence-backed risk |
| Revenue operations | Reliable automation | Governed event model |

> Show me the complete relationship, explain why this moment matters, and help me act without making me maintain the system.

---

## 2. Product principles and scope

### Design principles

1. **Events before fields:** Raw interactions are immutable evidence. CRM fields are derived views that can be recalculated as the product improves.

2. **Evidence before confidence:** Every summary, answer, score, and recommendation links to the events that support it.

3. **Identity before automation:** No person-specific action runs unless identity confidence and policy thresholds are satisfied.

4. **Review before autonomy:** Drafts and tasks come first. Autonomous external communication is a later, explicit setting.

5. **First-party value first:** Email clicks, forms, authentication, and customer-owned data must produce value without an anonymous identity vendor.

6. **One interface, modular plumbing:** The customer experiences one product even when specialized capabilities are licensed behind stable adapters.

### In scope for MVP

- Gmail sync and Calendar metadata
- Contacts, accounts, and a basic deal pipeline
- First-party web SDK and tracked links
- Unified timeline and cited search
- Rules, alerts, and draft generation

### Explicitly out of scope for MVP

| Capability | Why deferred | Interim path |
|---|---|---|
| Global person graph | Data-network moat | Provider adapter |
| Native meeting bot | Platform burden | Notes or uploads |
| Marketing automation | Scope distraction | Webhooks |
| Autonomous outbound | Trust risk | Reviewable drafts |
| Enterprise forecasting | Different buyer | Basic pipeline |

---

## 3. System architecture

### The event ledger is the center of gravity

Every source is normalized into the same event envelope. Identity resolution attaches events to people and accounts. Derived state powers CRM views, retrieval, scoring, and actions.

```text
Sources                 Ingestion                  Event ledger
email, calendar,   -->  sync, webhook, SDK,   -->  immutable,
web, calls, notes       upload, deduplication      tenant-scoped
                                                     |
                                                     v
Identity graph          Derived state              Experience
person, account,   -->  fields, summaries,    -->  search, timeline,
device, confidence      scores, signals             queue, API
```

### System planes

- **Capture plane:** Connector workers, web SDK, redirect service, file intake, deduplication, replay, and dead-letter handling.

- **Data plane:** Relational storage for tenants and CRM state; object storage for raw content; a keyword search index; and a vector index for semantic retrieval.

- **Intelligence plane:** Extraction, summarization, embeddings, retrieval, opportunity risk, intent scoring, and action recommendations.

- **Action plane:** Rules, identity and consent gates, queues, approvals, notifications, CRM updates, webhooks, and auditable execution.

- **Control plane:** Tenant settings, OAuth connections, retention, roles, schemas, policies, usage, observability, export, and deletion.

**Architectural rule:** Connectors may fail independently. The event ledger accepts replayable, idempotent writes so a provider outage never corrupts customer state.

### Implementation posture

Begin as a modular monolith with background workers and a shared schema. Preserve interface boundaries around connectors, identity providers, model providers, and action destinations. Split services only after measured load or operational isolation requires it.

---

## 4. Data and identity

### Canonical event model

Source-specific payloads remain available, but all interactions expose the same minimum contract.

```text
Event {
  id, tenant_id, source, source_event_id,
  type, occurred_at, ingested_at, actor,
  person_candidates[], account_candidates[],
  channel, content_ref, metadata,
  consent_basis, identity_confidence,
  schema_version
}
```

### Core entities

| Entity | Purpose | Key relationships |
|---|---|---|
| Person | Canonical human | Emails, devices |
| Account | Buying organization | People, deals |
| Opportunity | Commercial process | Account, stage |
| Event | Immutable interaction | Person, source |
| Signal | Interpreted intent | Events, score |
| Action | Proposed or completed work | Signal, result |
| Artifact | Source content | Event, permissions |

### Launch event types

- `email.sent`
- `email.received`
- `email.opened`
- `link.clicked`
- `meeting.scheduled`
- `meeting.note_added`
- `page.viewed`
- `form.submitted`
- `deal.updated`
- `task.completed`

### Storage rules

- Preserve raw source identifiers and timestamps for deduplication and traceability.
- Store large bodies and transcripts outside primary transactional tables.
- Generate embeddings per permission boundary, never across tenants.
- Version extractors and derived fields so recalculation is safe.
- Support event deletion and downstream retraction from indexes and summaries.

### Identity strategy

Known identity is buildable; anonymous identity has a data moat. The product should maximize deterministic first-party matching, quantify probabilistic matches, and never disguise an inferred identity as a fact.

| Method | Confidence | Decision | Example |
|---|---|---|---|
| Email address | Very high | Build | Inbound email |
| Tracked click token | High | Build | Email to website |
| Authenticated user | Very high | Build | Product login |
| Form submission | High | Build | Demo request |
| Company IP | Account only | License | Company visit |
| Anonymous person | Variable | Do not build | Vendor graph |

#### Resolution sequence

1. Match stable first-party identifiers exactly.
2. Attach browser sessions after a signed tracked-link redirect or form event.
3. Merge duplicate people only when deterministic rules pass; otherwise queue review.
4. Use account-domain inference separately from person identity.
5. Call optional enrichment adapters only under customer policy and regional eligibility.
6. Persist match method, provider, timestamp, and confidence on every edge.

**Hard boundary:** Building a person-level identity graph requires a broad data-acquisition network, not merely an algorithm. The core product must not depend on reproducing that asset.

#### Known visitor journey

```text
Tracked email          Redirect                         Website
signed link token --> record click + set first ID --> page events join timeline
```

---

## 5. Product experience

### Primary interface

The home screen should answer: **Who needs attention, and why?**

The product has four primary areas:

1. **Universal query:** Ask questions across all permitted relationship data.
2. **Live intent queue:** Rank accounts and people by explainable, recent buying intent.
3. **Prospect timeline:** Merge emails, meetings, notes, website behavior, CRM updates, and actions in chronological order.
4. **Action controls:** Create a task, draft an email, notify an owner, snooze a signal, or inspect the score.

#### Example query

> What changed at Acme this week, and what should I do next?

Example response:

> The champion revisited pricing twice after asking about implementation. The security lead opened the follow-up but has not replied. Recommend a concise implementation-plan email.

Every claim should open its supporting email, note, transcript segment, or web event in an evidence drawer.

#### Example prospect timeline

- **10:42 — Website:** Viewed `/pricing` for 3 minutes 12 seconds. Identity source: tracked link.
- **10:37 — Email:** Clicked “implementation guide.” Source email available.
- **Yesterday — Meeting note:** Asked whether onboarding can finish before quarter-end.
- **Six days ago — Email:** Proposal sent to the champion and security lead.

### Critical workflows

| Workflow | Entry point | Successful result |
|---|---|---|
| Account briefing | Search or account | Cited summary |
| Intent response | Signal queue | Approved action |
| Relationship lookup | Global search | Answer + evidence |
| Opportunity handoff | Opportunity | Complete timeline |
| Automation setup | Rule builder | Tested policy |

---

## 6. Functional requirements

Priorities:

- **P0:** Required for design-partner use
- **P1:** Beta follow-on
- **P2:** Post-beta

### 6.1 Connection and ingestion

- **ING-01 — Google OAuth (P0):** Connect Gmail and Calendar with least-privilege scopes and clear data-use explanations.
- **ING-02 — Historical sync (P0):** Import a configurable lookback window, checkpoint progress, and resume safely.
- **ING-03 — Incremental sync (P0):** Capture new and changed messages without duplicate events.
- **ING-04 — Meeting notes (P0):** Accept pasted notes, file uploads, and one structured note-source adapter.
- **ING-05 — Connector health (P0):** Show last success, lag, errors, and reconnect state.

### 6.2 CRM foundation

- **CRM-01 — Automatic records (P0):** Create or suggest people and accounts from observed interactions.
- **CRM-02 — Configurable pipeline (P0):** Support stage, owner, amount, close date, probability, and custom fields.
- **CRM-03 — Unified timeline (P0):** Order permitted events across sources with channel and evidence filters.
- **CRM-04 — Merge controls (P1):** Detect duplicates, explain match reasons, and support reversible merges.
- **CRM-05 — Import and export (P1):** Provide CSV mapping and complete customer-controlled export.

#### Capture and CRM acceptance criteria

- A connected mailbox reaches current state after initial sync and shows visible progress.
- Replaying a connector batch creates no duplicate canonical events.
- A seller can open a contact and see email, meeting, web, and CRM events in one ordered view.
- Disconnecting a source stops future collection without deleting existing data unless requested.

### 6.3 Website and email engagement

- **WEB-01 — Web SDK (P0):** Capture page, referrer, campaign parameters, session, and configurable custom events.
- **WEB-02 — Consent mode (P0):** Suppress or limit collection according to customer configuration and region.
- **WEB-03 — Identity handoff (P0):** Bind a browser after signed tracked-link clicks, form submissions, or authenticated events.
- **EML-01 — Click tracking (P0):** Redirect through a signed, expiring token and preserve the destination safely.
- **EML-02 — Open tracking (P1):** Support an optional tracking pixel and label opens as noisy, not definitive intent.
- **WEB-04 — Page taxonomy (P1):** Classify pages by intent level and buying topic.

### 6.4 Search and retrieval

- **SRH-01 — Universal search (P0):** Search people, accounts, opportunities, event metadata, and permitted content.
- **SRH-02 — Natural-language answers (P0):** Answer scoped questions using hybrid keyword and semantic retrieval.
- **SRH-03 — Citations (P0):** Each factual claim opens its exact supporting source and location when available.
- **SRH-04 — Permission-aware retrieval (P0):** Excluded content cannot influence results, summaries, or embeddings.
- **SRH-05 — Saved briefings (P1):** Provide reusable prompts for pre-call, handoff, risk, and weekly review.

#### Attribution and retrieval acceptance criteria

- A known prospect's tracked click and subsequent eligible page views appear on the timeline within five minutes.
- An answer with insufficient evidence says so rather than filling the gap.
- Every answer can be evaluated against the retrieved event set.
- Search results respect source-level and user-level permissions.

---

## 7. Intelligence and actions

### Evidence-first intelligence

The model proposes; product policy decides.

- **Entity extraction:** Identify stakeholders, products, dates, amounts, objections, commitments, and competitors.

- **Rolling memory:** Update account and opportunity summaries from new evidence.

- **Intent scoring:** Use explicit, explainable components instead of one opaque number.

- **Risk detection:** Identify reply gaps, missing stakeholders, timeline slips, conflicting statements, and stalled stages.

- **Next-best action:** Propose an action with a rationale, evidence, confidence, and expected outcome.

#### Example signal

**Signal:** Pricing interest increased  
**Strength:** 82/100  
**Evidence:** Two pricing-page views after a proposal, an implementation-guide click, and no reply for four business days.  
**Recommended action:** Draft a short note answering the open implementation-timing question.  
**Confidence adjustment:** Email opens are excluded from the score.

### Policy engine

```text
Detect            Resolve              Check                       Execute
event pattern --> identity confidence --> consent, frequency,  --> queue, alert,
                                          owner, suppression        draft, webhook
```

### Action requirements

- **ACT-01 — Rule conditions (P0):** Combine event, person, account, opportunity, time-window, and confidence conditions.
- **ACT-02 — Rule governance (P0):** Every rule has test mode, version history, rate limits, quiet hours, and an owner.
- **ACT-03 — Launch actions (P0):** Support in-app alerts, email notifications, tasks, CRM updates, drafts, and webhooks.
- **ACT-04 — Approval gate (P0):** External sends require approval unless an administrator explicitly enables autonomy.
- **ACT-05 — Audit record (P0):** Record trigger input, policy result, action payload, approver, outcome, and error.

**Do not optimize for open rate.** Opens are distorted by privacy proxies and security scanners. Treat clicks, repeated topic exploration, forms, replies, meetings, and buying-group activity as stronger evidence.

---

## 8. Trust, security, and operations

### Non-functional requirements

| Area | Launch requirement | Target |
|---|---|---|
| Tenant isolation | Scoped reads/writes | No cross-tenant paths |
| Encryption | Transit and rest | Managed keys |
| OAuth tokens | Encrypted, revocable | No raw exposure |
| Availability | App and ingestion | 99.9% after beta |
| Event latency | Known web events | P95 under 5 min |
| Search latency | Standard retrieval | P95 under 3 sec |
| Answer latency | Cited response | P95 under 12 sec |
| Recovery | Restore drills | RPO 24h / RTO 8h |
| Audit | Admin and actions | Complete export |

### Privacy controls

- Configurable collection and retention by source and event type.
- Consent mode and regional suppression for website tracking.
- Per-person access, correction, export, suppression, and deletion workflows.
- Do-not-contact state enforced in the action plane.
- Provider inventory and data-processing terms visible to administrators.

### AI controls

- Tenant content is not used to train shared models by default.
- Prompts and outputs are logged with redaction and retention controls.
- Retrieved evidence is displayed alongside generated claims.
- Model-provider abstraction supports routing, fallback, and cost controls.
- Evaluation sets track groundedness, extraction accuracy, and harmful actions.

### Operational instrumentation

Monitor connector lag, event rejection, deduplication rate, identity conflicts, index lag, query quality, action failures, and provider spend.

**Launch gate:** No automated external message can bypass consent, suppression, frequency, ownership, and identity checks. A model output is never itself authorization.

### Administrative roles

- **Member:** Views permitted records and acts on assigned work.
- **Manager:** Views team activity and configures shared views.
- **Administrator:** Controls connectors, policies, retention, roles, and exports.

Fine-grained field and source permissions are a post-MVP enterprise requirement.

---

## 9. Build feasibility

Most of the product is software; two capabilities are network businesses.

| Capability | Verdict | Product decision |
|---|---|---|
| CRM objects | Build | Own core |
| Event ledger | Build | Own core |
| Gmail sync | Build | First connector |
| Web SDK | Build | First-party default |
| Link tracking | Build | Clicks before opens |
| Open tracking | Build carefully | Optional weak signal |
| Search and RAG | Build | Own UX and evals |
| Transcription | Integrate | Provider adapter |
| Meeting bot | Integrate | Defer native bot |
| Company IP match | License | Optional adapter |
| Anonymous person ID | Do not build | Region-gated option |
| Email delivery | Integrate | Use mailbox first |

### What “from scratch” should mean

**Own the durable layer:**

- Event and identity schemas
- Customer graph
- Timeline and retrieval
- Signal logic and evaluations
- Policy engine and audit trail
- Product experience

**Abstract commodity capabilities:**

- Language models
- Transcription
- Email delivery
- Object storage
- Company enrichment
- Optional identity data

**Recommended approach:** Build a coherent product on commodity infrastructure, not every underlying capability. “One platform” is an experience and data-model decision, not a requirement to own every data network.

### Largest engineering risks

- Connector correctness and replay
- Permissions across indexed content
- Duplicate identity merges
- Retrieval evaluation
- Action-policy safety
- High-cardinality event storage
- Support load from provider changes

---

## 10. Delivery roadmap

### Stage 0 — Foundation

Build tenant authentication, the canonical event schema, connector framework, audit model, and design-partner dataset.

**Exit evidence:** Replay and deletion tests pass.  
**Stop condition:** Events cannot be audited reliably.

### Stage 1 — Memory alpha

Build Gmail sync, contacts and accounts, a unified timeline, keyword search, and basic opportunity management.

**Exit evidence:** Users retrieve context they previously could not find.  
**Stop condition:** Manual cleanup dominates regular use.

### Stage 2 — Intent beta

Build the web SDK, tracked links, known-identity binding, signal queue, alerts, and tasks.

**Exit evidence:** Signals consistently cause useful action.  
**Stop condition:** Identity errors exceed design-partner tolerance.

### Stage 3 — Intelligence

Build cited Q&A, rolling summaries, the rule builder, draft generation, and evaluation suites.

**Exit evidence:** Citations improve trust and decision speed.  
**Stop condition:** Answers invent unsupported facts.

### Indicative team

- **Product:** One founder or product manager for discovery, scope, design partners, and policy.
- **Engineering:** Three to five engineers across backend/data, integrations, full-stack, and AI.
- **Design:** Half-time to one full-time product designer focused on workflows, evidence UX, and usability.

**Planning assumption:** A focused team can pursue a design-partner MVP in roughly two quarters, but connector approval, data migration, and security work may dominate the schedule. Produce a real estimate only after a technical spike against the selected APIs.

### Parallel discovery tracks

- Interview 8–12 founder-sellers and collect real retrieval and trigger moments.
- Run a Gmail sync and deduplication spike on representative mailboxes.
- Test known-visitor continuity across email click, browser session, and return visit.
- Define a regional consent matrix with qualified legal counsel.
- Evaluate whether one note or recording integration supplies enough meeting context for MVP.

---

## 11. Success metrics and economics

### North-star metric

**Qualified intent-to-action rate:** The share of high-confidence signals that lead to a seller-approved useful action within one business day.

### Product quality hypotheses

| Metric | Initial target | Guardrail |
|---|---:|---|
| Known-contact match | ≥ 95% | False merges < 0.5% |
| Event freshness | P95 < 5 min | No silent gaps |
| Answer groundedness | ≥ 95% | Every claim cited |
| Signal usefulness | ≥ 40% | Dismissal captured |
| Draft acceptance | ≥ 30% | No unauthorized sends |
| Weekly active teams | ≥ 60% | Meaningful action |

These targets are hypotheses for design-partner validation, not market benchmarks.

### Business-model hypotheses

- **Core subscription:** Charge for seats plus a shared event allowance. Include first-party tracking, memory, search, and core actions so the base plan delivers predictable value.

- **Usage and data add-ons:** Meter high-volume events, model usage, transcription, or licensed enrichment separately. Do not hide external identity costs inside unlimited base pricing.

### Cost model

```text
Monthly COGS per tenant =
connector compute
+ event storage
+ search and indexing
+ model tokens
+ transcription
+ notifications
+ support allocation
+ optional licensed data
```

Track cost by tenant, source, feature, and workflow. Cache repeated summaries, batch embeddings, route tasks by required model quality, archive cold artifacts, and give customers usage visibility.

**Economic gate:** The core plan must retain healthy gross margin without anonymous person-level identification. Sell external identity as a metered add-on or let customers connect their own provider contract.

### Product analytics events

Log query submitted, evidence opened, answer copied, signal viewed, signal dismissed with reason, task created, draft edited, draft sent, opportunity advanced, rule tested, rule enabled, connector repaired, and deletion completed.

---

## 12. Risks and open decisions

### Highest-priority decisions

1. **Ideal customer profile:** Solo founder, small sales team, or mid-market revenue organization? This determines permissions, onboarding, integrations, and price. Owner: founder. Decide before design.

2. **Consent posture:** Which launch regions and tracking modes are supported? This determines SDK behavior and identity-provider eligibility. Owners: founder and counsel. Decide before beta.

3. **Action autonomy:** Drafts only, approval workflows, or autonomous external sends? This determines policy and audit requirements. Owner: product. Decide before alpha.

4. **Identity economics:** Customer-supplied provider, metered add-on, or company-level enrichment only? This determines gross margin and packaging. Owner: founder. Decide before pricing.

### Risk register

| Risk | Impact | Mitigation |
|---|---|---|
| Connector drift | Missing history | Health and replay |
| False identity merge | Wrong disclosure | Confidence gates |
| Hallucinated answer | Lost trust | Evidence and evals |
| Tracking backlash | Brand/legal risk | Consent and restraint |
| Notification fatigue | Product ignored | Frequency caps |
| Mailbox restrictions | Blocked onboarding | Minimal scopes |
| Variable AI spend | Margin pressure | Budgets and caching |
| CRM breadth creep | Slow delivery | One-loop MVP |

### Launch-readiness checklist

- [ ] Events replay idempotently.
- [ ] Evidence opens from every AI claim.
- [ ] Identity confidence is visible.
- [ ] Deletion propagates to derived stores.
- [ ] Connector failure is visible.
- [ ] Rules have test mode and rate limits.
- [ ] Do-not-contact is enforced.
- [ ] External sends require approval.
- [ ] Cost is attributable by tenant.
- [ ] Design partners complete the core loop.

---

## Product decision

Proceed with a design-partner MVP centered on Gmail, known-visitor website behavior, cited relationship search, and reviewable actions. Defer anonymous person-level identification until the core loop proves willingness to pay.

**Validation note:** Assumptions in this draft require confirmation with customers, engineering, security, and qualified legal counsel.
