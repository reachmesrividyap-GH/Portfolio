# Checkout Incident Detection Agent

A two-agent n8n pipeline that ingests live checkout events, triages them against deterministic business rules and a per-step failure baseline, and publishes exactly one ALERT-or-LOG command per run — with an LLM used only to explain the decision, never to make it.

## Context / Problem

E-commerce teams watch checkout activity for anything that could cost revenue — payment failures above all — but at real-world volume (hundreds of events/hour) nobody can triage each one by hand. The brief: build an agent that reads new checkout events, judges severity against a normal baseline failure rate, and hands off exactly one clean "command" (ALERT or LOG) per run to downstream systems — without executing any fix itself. The original spec named Zapier as the target platform; this was built on n8n Cloud instead, which gave native Code nodes for the deterministic parts and a free hosted LLM node for the parts that genuinely needed judgment.

## Objective

Prove that a small, cheap automation can do reliable, reproducible incident triage — same input always produces the same severity call — while still reading naturally in plain English, and that the pipeline can be built, tested, and debugged entirely on free-tier tools (n8n Cloud, Google AI Studio, Google Sheets, Slack).

## Approach

The design's central decision — and the one trade-off worth calling out — is **where the LLM sits in the decision path**. It would have been simpler to hand a Gemini/Gemma model the raw event batch and let it decide severity and action directly. That was rejected: an LLM call is non-deterministic-adjacent (temperature, prompt drift, model updates) and hard to unit-test, which is a bad fit for a rule like "PAYMENT step is always HIGH." Instead, severity and action are computed by a deterministic `Aggregate Batch` Code node against four explicit rules (PAYMENT step, cart value over a threshold, event count exceeding the per-step baseline, repeated mobile failures), and the LLM's only job is to write the one-sentence human-readable `reason`, fed the already-triggered rules as context. This keeps the actual decision auditable and testable while still getting natural-language explanations for free.

A second trade-off: triage runs on a 15-minute **schedule** rather than firing per-event in real time. This trades a small amount of latency for staying comfortably inside Google AI Studio's free-tier rate limits and keeping Agent 2 simple (batch read → aggregate → decide, once per run) — the build notes call out that a same-instance `Execute Workflow` call from Agent 1 could remove that lag later if needed.

The build process itself was iterative and testing-driven, not built end-to-end on the first pass. Before any HTML existed, the webhook was exercised with five hand-written `curl` commands (low value, payment failure, high cart value, repeated mobile failures, invalid payload) against n8n's "Listen for test event" URL. Retyping and re-editing raw JSON for every run of every scenario was slow, so a small self-contained test console (`event-sender.html`) was built next to reproduce the same five scenarios as one-click presets, add a free-text form for values the presets don't cover, and log each request/response inline. Testing with deliberately broken input (not just the happy path) is what actually surfaced real bugs — see **Results / Learnings**.

## What It Does

**Agent 1 — Event Ingestion** (`IngestionWebhook`, real-time): accepts `POST /checkout-event`, normalizes and uppercases `checkout_step`/`device`, coerces `cart_value` to a number (or `-1` if it isn't one, so bad input fails validation instead of crashing the node), validates that the step is PAYMENT/ADDRESS/SHIPPING, the value is non-negative, and the device is MOBILE/DESKTOP — then appends a clean row to the **Cart Events** sheet and responds `200`, or responds `400` with a fixed error body if any check fails.

**Agent 2 — Triage & Command** (`Schedule Trigger`, every 15 minutes): reads `last_processed_timestamp` from the **State** sheet, reads all of **Cart Events**, and keeps only rows newer than that timestamp (the idempotency guard — this is what makes "never process the same row twice" hold). If there's nothing new, it still writes exactly one `LOG` row so the "one command per run" rule holds even on quiet runs. If there is new data, it reads **Baseline Metrics**, groups the new events by checkout step, and evaluates each step against the four HIGH-severity rules. The AI Agent (Google Gemini Chat Model, temperature 0) then writes a one-sentence explanation referencing whichever rules actually fired. The result is assembled into a 9-field command row, appended to **Agent Commands**, the state timestamp is advanced, and a formatted message is posted to Slack — the sheet write and the Slack post run in parallel so neither blocks the other.

## Architecture / Flow

![Architecture diagram](docs/diagram.svg)

## Sample Data

Real values captured from an actual run (not invented — from the n8n execution trace and the Slack channel message it produced, shown in `docs/overview.pptx`):

```json
{
  "command_id": "CMD_20260813084349_SHIPPING",
  "action": "ALERT",
  "severity": "HIGH",
  "reason": "The SHIPPING step is rated HIGH severity because the cart value of 135672 exceeds the threshold of 1500.",
  "checkout_step": "SHIPPING",
  "cart_value": 135672,
  "device": "MOBILE",
  "baseline_rate": 5.6,
  "timestamp": "2026-08-13 08:43:49"
}
```

Baseline rates seeded in the **Baseline Metrics** sheet: `PAYMENT: 9.8`, `ADDRESS: 3.2`, `SHIPPING: 5.6` (illustrative business config, not derived from real transaction history).

## Results / Learnings

**What held up:** the state-gated idempotency check, the "exactly one command per run" invariant on both the happy path and the empty-batch path, and the deterministic severity logic — all confirmed against real executions, including a live ALERT posted to Slack with matching data across the sheet row, the execution log, and the channel message.

**What testing surfaced (and fixed):** exercising the webhook with deliberately invalid input — not just clean presets — found real defects: `Edit Fields` originally threw a hard type-conversion error on a non-numeric `cart_value` instead of failing validation gracefully; the `If` node originally only checked `checkout_step` and `cart_value`, with no device check at all; and the `IngestionWebhook` node's response mode was left on the default `onReceived`, which meant neither downstream `Respond to Webhook` node ever actually got to fire — caught only because the test console's log showed a generic response instead of the expected `400`. The test console itself had a bug too: its "Invalid payload" preset auto-sent on click while every other preset just filled the form, which was fixed so all presets behave identically (fill, preview if needed, then an explicit Send).

**What I'd change:** three known gaps in this exported JSON, not glossed over. First, the `Respond to Webhook` error node still returns one fixed generic 400 body regardless of which check failed (step, value, or device) — naming the specific failing field was discussed during testing but isn't what's implemented here. Second, every batch still routes through the Gemini/Gemma LLM call to generate the `reason` sentence; a simpler no-LLM variant — templating `reason` directly from the already-computed `triggered_rules_text` — would remove an external dependency for something that's arguably just string formatting. Third, the original problem statement lists a downstream webhook broadcast as **mandatory** ("The agent must trigger a Webhook (POST request) to broadcast its decision"); this workflow satisfies the human-visible hand-off via the Slack message but does not include an outbound HTTP Request node.

## Tech Stack

| Component | Technology |
|---|---|
| Automation platform | n8n Cloud (`app.n8n.cloud`) — no self-hosting |
| Trigger (ingestion) | `n8n-nodes-base.webhook` (POST) |
| Trigger (triage) | `n8n-nodes-base.scheduleTrigger` (every 15 min) |
| Data store (4 tabs) | Google Sheets, via `n8n-nodes-base.googleSheets` (OAuth2) |
| Deterministic logic | `n8n-nodes-base.code` (JavaScript) — filtering, aggregation, rule evaluation, command assembly |
| Validation / branching | `n8n-nodes-base.set`, `n8n-nodes-base.if` |
| LLM reasoning | `@n8n/n8n-nodes-langchain.agent` + `lmChatGoogleGemini` (Google Gemini Chat Model, temperature 0, via a Google AI Studio API key) |
| Notification | `n8n-nodes-base.slack` (Bot Token, scopes `chat:write` / `users:read` / `users:read.email`) |
| Manual test harness | Self-contained HTML/CSS/JS (`event-sender.html`), no server or build step |

## How to Run It

1. Create the 4-tab Google Sheet (`Cart Events`, `Baseline Metrics`, `State`, `Agent Commands`). `Cart Events` and `Agent Commands` start empty — the workflow populates both. Seed the other two once: `Baseline Metrics` with your per-step failure rates (e.g. `PAYMENT: 9.8`, `ADDRESS: 3.2`, `SHIPPING: 5.6`), and `State` with one row — `key: last_processed_timestamp`, `value:` any timestamp earlier than your first real event (e.g. `2020-01-01 00:00:00`).
2. Import `codebase/n8n-workflow.json` into an n8n Cloud workspace and connect the Google Sheets, Google Gemini(PaLM), and Slack credentials.
3. Activate the workflow, then open `codebase/event-sender.html` in a browser, paste in the webhook URL, and use the presets (or the form) to fire test events.
4. Watch the Agent 2 schedule run pick up new events and post to your configured Slack channel — or trigger it manually from the n8n canvas while testing.
