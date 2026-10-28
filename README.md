# App Builder AI

A demo of an AI worker for a bank's accounts-payable team. It reads supplier invoices, checks each one
against the purchase order and delivery note (a three-way match), sends clean invoices to one-click
approval and holds risky ones with the reason. People approve what matters. The demo uses synthetic data,
and a CRM (HubSpot) stands in for the bank's ERP.

## Run it locally

```sh
bun install
bun run dev
```

To run without HubSpot or n8n, add this to `.env.local` and the app uses built-in sample data:

```sh
INVOICE_DATA_SOURCE=mock
```

Run the tests with `bun run test`.

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
  applies the procurement rules, writes the HubSpot deal, line items and audit note, and asks the supplier
  for anything missing.
- `2-invoice-assistant-chat.json`: a read-only chat for the reviewer, on `POST /webhook/invoice-assistant`.
- `3-look-up-purchase-order.json`: the PO lookup used by the chat.
- `run-tests.mjs`: a runner that sends the 10 documents in `scripts/hubspot/data/invoices/live-messages.json`
  to the intake webhook and prints expected versus actual.

The workflows are saved inactive and have not yet been imported or run. See the
[folder README](n8n/invoice-worker/README.md) for import steps, the rules, how this differs from the
original brief, and what still needs checking.
