# HubSpot setup for the order-worker demo

`setup.ts` prepares a HubSpot portal for the AppBuilder.ai order worker:

1. Properties on products, companies, deals and line items (group "AppBuilder.ai order worker").
2. An **Orders** deal pipeline: Received → Waiting on client → Needs staff → Ready to confirm → Confirmed, plus Duplicate and Rejected.
3. The casing catalogue (`data/catalogue.json`, 180 products) with pack sizes.
4. Four demo clients with a contact each (`data/demo-orders.json`).
5. Twelve processed demo orders as deals with line items and an audit note, covering every exception on the exceptions slide.

## Run it

```sh
cp .env.example .env.local                # add a HubSpot private app token (never in .env)
bun scripts/hubspot/setup.ts --dry-run    # reads only
bun scripts/hubspot/setup.ts              # writes
bun scripts/hubspot/setup.ts --history-only   # live-demo setup (below)
```

**Live demo:** `--history-only` loads only the six confirmed orders, which build each client's code map. The other six go to `data/live-messages.json` as raw messages (channel, sender, text) to send during the live run. Each message also lists the stage and exception the order worker should reach, for scoring the run. Without the flag, all twelve load already processed, as a backup dataset if the live run fails.

The private app needs read and write access to products, companies, contacts, deals, line items and notes, plus permission to create properties on products, companies, deals and line items, and to create deal pipelines. If a scope is missing, the script stops and prints HubSpot's message naming it.

The script is safe to rerun: it reuses existing properties, the pipeline, products (matched by SKU), companies (by domain) and contacts (by email), and skips orders that are already loaded.

## Where the data model lives

- **Pack sizes:** on each product (`pack_type`, `units_per_pack`, `min_sale_packs`).
- **Negotiated list:** `negotiated_skus` on the client's company.
- **Client code map:** the client's past confirmed line items. Each line keeps `client_code_as_written` next to our product, so once staff confirm a match, the next order with that code matches on its own.

## Data

- `catalogue.json` comes from the client's item sheet. Product names are built from type, calibre and colour; supplier names, brands and customer names are left out.
- Prices and stock in `catalogue.json` are demo values, not the client's: `price_per_metre` = a base per casing family plus a step per mm of calibre (USD, the portal currency), `price` = one whole pack, `stock_packs` = whole packs in stock. A few items are out of stock or low so the agents have to offer alternatives; the SKUs used by the demo orders always have enough stock.
- All demo clients are fictional: their names end in "(demo)" and they use `example.com` domains.
