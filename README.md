# App Builder AI

Just create an empty project for now, called AppBuilder.AI

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
- `test-cases.json` and `run-tests.mjs`: 12 synthetic invoices with expected results, and a runner that
  prints expected versus actual.

The workflows are saved inactive and have not yet been imported or run. See the
[folder README](n8n/invoice-worker/README.md) for import steps, the rules, how this differs from the
original brief, and what still needs checking.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
