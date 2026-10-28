# STATUS — AppBuilder.ai @ NEXXT AI Hackathon (Raiffeisen)

> Updated: Thursday, 29 Oct 2026, 00:20 · Document owner: Lip
> Checked against the code on `main` @ `cce32e0`, the HubSpot portal 149650024 and the live site (29 Oct). Anything that can't be seen in the code stays ⚠️.
> Authors: `prompts/` (n8n + Lovable) = Daniel. The 5 documents = Lip, reviewed against the code with Claude.
> Rule: every member updates their row **every 2 hours** or when they get blocked. Don't discuss status on Discord without it being recorded here.

## Deadlines

| What | When |
|---|---|
| Code + evidence submission | **Thursday, 29 Oct, 10:30** |
| Live presentation | ⚠️ TO BE CONFIRMED |
| Internal code freeze (bugfixes only after) | Thursday, 29 Oct, 08:00 |
| Backup video of the demo recorded | Thursday, 29 Oct, 09:00 |

## Open decisions (they block everything else)

| # | Decision | Options | Who decides | By when |
|---|---|---|---|---|
| D1 | Which track we're entered in | Operational Efficiency / Open Challenge | question for the organisers | NOW |
| D2 | The banking scenario | Order-to-cash / Credit file validation / **Supplier invoices, three-way match (AP)** / stay on orders. The AP option is **Daniel's proposal**: the prompts in `prompts/` (n8n + Lovable) were written by him, it isn't a team decision. **On `main` (29 Oct) the AP option is built and live:** invoice desk in the app + invoice worker in n8n, 12/12 test cases correct (`evidence/invoice-worker-run-2026-10-29.md`). ⚠️ The team decision still needs confirming | the team + 1 Raiffeisen mentor | today |
| D3 | The LLM used in the demo | `prompts/n8n/n8n-prompt.md` asks for Claude `claude-sonnet-5-5`, n8n credential "RTA Anthropic API". **Proposal: D3 = Claude**; ⚠️ to confirm in live n8n which model the order flows run. The invoice flows exported in `n8n/invoice-worker/` use Claude `claude-sonnet-5-5` (Information Extractor for processing, the agent in the reviewer's chat); the app doesn't call the LLM directly | Daniel | today |

## Status by component

| Component | Status | Owner | Blocker |
|---|---|---|---|
| Landing page (nexxt.appbuilder.ai) | 🟢 demo CTA, HubSpot form and `Talk to us → #contact`. The live site runs the build from `main` (checked 29 Oct: the live bundle contains the latest texts from the invoice page) | Daniel | — |
| PR #1 (branch `landing-cta-hubspot`) | 🟡 NOT MERGED, has diverged from `main` (part of its content was redone on `main` in other commits). It brings `supabase/migrations/…user_roles.sql`, which **must not be merged** (see BUGS B-07: the schema stays in `drizzle/migrations/`). Merge only if you remove that file and `types.ts`/`drizzle` from the diff | Daniel | decide: merge or close |
| Order agent (order worker) | 🟡 runs in n8n (6 workflows cited in the prompt), **not in the repo**; the app calls it through 2 webhooks (`order-assistant`, `app-order-offer`). The order rules are in code (`order-rules.ts`, tested) | Daniel | JSON export + prompt in the repo |
| Invoice worker (n8n, AP banking scenario) | 🟢 live in n8n: `Kxhmr00uS4MBXTSO` processes invoices (Gmail `demo+invoices@appbuilder.ai` or webhook `invoice-intake` → deal in Procure-to-pay, line items, audit note), `HI8tvI2HG70NlgPo` is the reviewer's chat (read-only), `rc72KPALhtJhwLZm` looks up the PO. JSON export in `n8n/invoice-worker/`. ⚠️ The export is older than the live version `030f7e0f…`: the split purchase rule counts the supplier's invoices in the export, only those on the same PO live | Daniel | re-export from n8n |
| Invoice desk (app: queue, detail, submit) | 🟢 on `main`: the queue (`/app/invoices`), the invoice page (three-way match, every check passed/failed, supplier, activity, "Ask the worker" chat), decisions (approve, send back, duplicate, reject; the comment starts from the failed checks), `Submit document` (text or PDF), suppliers, POs, team, approval rules, Reset demo, step-by-step guide for the demo account | Daniel | — |
| HubSpot invoice setup (pipeline, POs, suppliers, 12 synthetic documents) | 🟢 `scripts/hubspot/setup-invoices.ts` (rerunnable, `--dry-run`) + `scripts/hubspot/data/invoices/`: 6 suppliers, 10 POs, 6 history invoices, 10 live documents with their expected stage. `scripts/hubspot/check-ids.ts` checks the hardcoded stage IDs. ⚠️ `HUBSPOT.md` and `lovable-prompt-roles.md` are in Daniel's working folder, not in the repo | Daniel | — |
| Separate agents + orchestrator | 🟡 invoices: 3 separate flows (processing, chat with 6 tools, PO lookup as a sub-flow); the LLM only extracts the data, the fixed rules in the *Code node* `Apply Rules` decide. There is no separate orchestrator | ⚠️ | — |
| Banking mock API | 🔴 not started | ⚠️ | D2 |
| Synthetic test data | 🟢 invoices: 12 cases with expected stage and flags in `n8n/invoice-worker/test-cases.json`. Orders: 12 cases in `scripts/hubspot/data/` | Lip (proposed) | — |
| Evidence pack (X/N runs, logs) | 🟢 invoices: `evidence/invoice-worker-run-2026-10-29.md`, 12/12 correct on 4 runs in a row; `run-tests.mjs` archives the test invoices after each run. Orders: no runner | Daniel | — |
| README / setup | 🟡 `README.md` describes the app, the invoice worker and the development/test commands (29 Oct); the environment variables are in `docs/DOCUMENTATION.md` | Daniel | — |
| Deck | 🟡 v1 exists, doesn't answer the brief | ⚠️ | D2 |

Legend: 🟢 done · 🟡 in progress / partial · 🔴 not started or blocked

## Team and roles

| Member | Role | Owns |
|---|---|---|
| Daniel (revtech) | Tech lead | repo, Lovable, Supabase, deploy |
| Lip | Domain + rules + test data + documentation | ⚠️ TO BE CONFIRMED |
| ⚠️ | Agents and orchestration | |
| ⚠️ | Integrations + UI | |
| ⚠️ | Deck + pitch | |

## Access rules (proposal — to be nailed down today)

The problem: we have 6+ tools and it isn't clear who has access where, who can change what, and where the truth lives.

| Tool | What for | Source of truth for | Who has access | Who can write |
|---|---|---|---|---|
| **GitHub** | code, SQL migrations, documentation | **all code and docs** | the whole team (read) | everyone, **only through PRs** on `main` |
| **Lovable** | UI generation | nothing — it's an editor | Daniel + 1 | only on a branch, synced to GitHub |
| **Supabase** | DB, auth | the schema (through migrations in the repo) | Daniel + 1 backup | **`drizzle/migrations/` (decided 28 Oct)**. The real database = `types.ts` on `main` = the migration in `drizzle/`. The `supabase/migrations/…` file from PR #1 is not merged. One table: `user_roles` |
| **HubSpot** | "the bank's system" in the demo + contact form | CRM demo data (portal 149650024); the property schema is in `scripts/hubspot/setup.ts` | ⚠️ | token in `HUBSPOT_ACCESS_TOKEN` (app and scripts; `HUBSPOT_API_KEY` only as the old fallback name) |
| **n8n** | glue between systems + all the agents/the LLM | flows (`revtech-agency.app.n8n.cloud`) | ⚠️ | export in the repo only for the invoice flows (`n8n/invoice-worker/`); the order flows aren't in the repo. The webhooks require the `x-appbuilder-key` header |
| **Claude / Gemini** | assistance | nothing | everyone | — |

Ground rules:
1. **One place of truth: the repo.** What isn't in GitHub doesn't exist for the jury.
2. **No changes directly in Supabase.** The only place for the DB schema is `drizzle/migrations/` (decided 28 Oct, B-07). Lovable writes it when you give it a database prompt; the SQL file enters the repo through a PR. Do **not** create `supabase/migrations/`.
3. **At least 2 people with admin access** to every tool (Daniel + a backup). If Daniel is asleep at 3 a.m., we don't stop.
4. **Secrets don't go in chat, Discord or code.** Only in local `.env` and in the deploy settings. `.env.example` in the repo, without values.
5. **One branch per feature**, named `feat/…`, `fix/…`. Merge after a review from anyone else.
6. **An LLM prompt that ends up in the product goes in the repo** (`/prompts`), it doesn't stay in a chat.

## Change log

| When | Who | What |
|---|---|---|
| 28 Oct | Lip | PR #1 opened: `user_roles` fix, CTAs, HubSpot form |
| 28 Oct | Lip | Working documents created (this one + FEATURES, BUGS, IMPROVEMENTS, DOCUMENTATION) |
| 28 Oct | Claude (review against the code) | Filled in from the code on branch `docs/project-docs` (unpublished): stack, env, structure, rules, new bugs, corrections |
| 29 Oct | Daniel + Claude | AP scenario built and tested: invoice desk, invoice worker in n8n, 12/12 cases (`evidence/`). STATUS, FEATURES and README brought up to date with the code |
| 29 Oct | Daniel + Claude | The 5 documents in `docs/` translated from Romanian to English, content unchanged |
