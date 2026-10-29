# AppBuilder.ai

AI workers for back-office work, built for the NEXXT AI hackathon (Raiffeisen challenge). Live at
[nexxt.appbuilder.ai](https://nexxt.appbuilder.ai). HubSpot (portal 149650024, synthetic demo data) stands in
for the bank's systems, and the AI workers run in n8n.

The app (TanStack Start, React, Tailwind, shadcn/ui, Supabase auth) has two areas:

- **Invoice desk** (the banking scenario): the accounts-payable team's view of the supplier invoice worker.
  - `/app/invoices`: the queue.
  - Invoice page: the three-way match, every check passed or failed, the supplier, the audit trail, and an
    "Ask the worker" chat. Reviewers approve, send back, reject or mark a duplicate there.
  - `/app/invoices/new`: submit a document as text or PDF.
  - `/app/intake`: email intake. The mailboxes the worker reads (daniel@tigros.io and
    demo+invoices@appbuilder.ai), every invoice that came in by email with who got the result email,
    and the demo invoices to send (also as files in [`demo-invoices/`](demo-invoices)).
  - Desk admins manage suppliers, purchase orders and the team. Everyone on the desk can see the
    approval rules (read-only).
  - The demo account gets a step-by-step guide and a Reset demo action.
- **Platform area** for AppBuilder.ai staff: clients, users and roles, and a revenue dashboard. The earlier
  casings order portal (`/app/$companyId`) is still there for its demo clients.

The invoice rules the reviewer sees (approval limits, price tolerance, the checks) are in
`src/lib/invoice-rules.ts`, with tests in `src/test/`. The worker applies the same rules in n8n (see below).

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/13445394-2e89-4b5a-9498-02255be2bd99).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Supplier invoice worker (n8n)

[`n8n/invoice-worker/`](n8n/invoice-worker) holds three importable n8n workflows for the banking demo, an
AI worker that checks supplier invoices against purchase orders and delivery notes (a three-way match)
and routes each one to the right HubSpot stage:

- `1-process-supplier-invoices.json`: reads an invoice from Gmail or `POST /webhook/invoice-intake`,
  applies the procurement rules, writes the HubSpot deal, line items and audit note, emails the
  recipient how the invoice matched and what to do, and asks the supplier for anything missing.
- `2-invoice-assistant-chat.json`: a read-only chat for the reviewer, on `POST /webhook/invoice-assistant`.
- `3-look-up-purchase-order.json`: the PO lookup used by the chat.
- `4-send-demo-invoice-email.json`: emails a demo invoice to a monitored mailbox, from the app.
- `test-cases.json` and `run-tests.mjs`: 12 synthetic invoices with expected results, and a runner that
  prints expected versus actual.

The workflows are imported and live in n8n. See the
[folder README](n8n/invoice-worker/README.md) for import steps, the rules, how this differs from the
original brief, and what still needs checking. Latest test run: 12 of 12 cases correct
([`evidence/invoice-worker-run-2026-10-29.md`](evidence/invoice-worker-run-2026-10-29.md)).

## Development

The repo uses [bun](https://bun.sh) (`bun.lock`). Copy `.env.example` to `.env.local` and fill it in;
`docs/DOCUMENTATION.md` lists every variable.

```sh
git clone <this-repository-url>
cd <repository-name>
bun install
bun run dev
bun run test                          # unit tests (rules, billing, routing)
bun scripts/hubspot/check-ids.ts      # reads only: hardcoded HubSpot stage IDs still match the portal
```
