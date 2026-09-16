# ecom-hunter

An autonomous e-commerce product-hunting and eBay-listing platform. It discovers
retail products (via pluggable `SourceConnector`s), resolves them to canonical
products, scores their resale opportunity, checks profitability against
configurable eBay AU fee assumptions, screens them for policy/compliance risk,
generates eBay listing drafts strictly from real product data, and publishes
them to eBay (or, for local dev, a fully functional in-memory mock) — all
behind operating-mode and safety-limit guardrails.

## What it does

1. **Discover** — a `SourceConnector` (`FixtureConnector` today) returns a
   catalog of retail products.
2. **Normalize** — raw source products are stored as `SourceProduct` rows.
3. **Dedupe** — `SourceProduct`s are matched to a `CanonicalProduct` by
   GTIN/EAN/UPC/MPN, then brand+model, then fuzzy title similarity (Dice
   coefficient).
4. **Score** — a weighted opportunity score (demand/trend/competition/stock/
   risk/shipping) is computed and stored.
5. **Profitability + Pricing** — landed cost, eBay fees, and a target sell
   price (respecting min/max bounds and competitor signals) are calculated.
6. **Risk** — a keyword/category-based screen classifies each product
   SAFE_TO_LIST / REVIEW_REQUIRED / BLOCKED.
7. **Listing generation** — a title/description/item-specifics draft is built
   using *only* fields present on the canonical product record.
8. **Validate + Publish** — shortlisted, safety-limit-passing drafts are
   published via a `MarketplaceAdapter` (`MockEbayAdapter` for dry-run/tests,
   `EbayAdapter` for the real eBay Sell API).

All of the above can be run in one shot via **dry-run mode**
(`POST /api/pipeline/dry-run`), which is the primary way to prove the system
works without touching the real eBay API.

## Architecture

```
                 ┌───────────────────────────┐
                 │        Frontend            │
                 │ Vite + React + TS admin SPA│
                 └──────────────┬─────────────┘
                                │ REST (fetch)
                 ┌──────────────▼─────────────┐
                 │      Backend (Express)      │
                 │  routes: pipeline, jobs,     │
                 │  settings, products,         │
                 │  listing-drafts, listings,   │
                 │  sources, overview            │
                 └───┬───────────────┬──────────┘
                     │               │
        ┌────────────▼───┐   ┌───────▼─────────────┐
        │   Engines        │   │  Connectors           │
        │ profitability     │   │ SourceConnector iface │
        │ pricing            │   │ FixtureConnector (real)│
        │ scoring            │   │ kmart/bigw/target/    │
        │ risk               │   │ amazon_au/catch (stubs)│
        │ duplicates          │   └───────────────────────┘
        └───────────────┘
                     │
        ┌────────────▼─────────────┐   ┌────────────────────────┐
        │  Marketplace abstraction   │   │ Prisma ORM / SQLite     │
        │ MarketplaceAdapter iface   │   │ (Postgres-compatible     │
        │ MockEbayAdapter (real, in- │   │  schema; swap DATABASE_ │
        │ memory, used by dry-run)   │   │  URL to go to Postgres) │
        │ EbayAdapter (real Sell API,│   └────────────────────────┘
        │ OAuth2, throws cleanly if  │
        │ not configured)            │
        └───────────────────────────┘
                     │
        ┌────────────▼─────────────┐
        │ DB-backed Queue + Worker    │
        │ (jobs/job_runs/queue_items) │
        │ setInterval polling loop —  │
        │ swap for BullMQ+Redis later │
        │ node-cron scheduler:        │
        │  discovery (6h), price/     │
        │  stock (30m), monitoring    │
        │  (2h), rescoring (daily),   │
        │  weekly analysis (weekly)   │
        └───────────────────────────┘
```

## Install

Requires Node 20+.

```bash
# Backend
cd backend
npm install
npx prisma migrate dev --name init   # creates dev.db and applies schema

# Frontend
cd ../frontend
npm install
```

## Environment variables

See `.env.example` at the repo root (and `backend/.env`, `frontend/.env` for
per-app values). Key vars:

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Prisma connection string. Defaults to `file:./dev.db` (SQLite). Swap to a `postgresql://...` URL + change `provider` in `schema.prisma` to go to Postgres. |
| `PORT` | Backend HTTP port (default 4000). |
| `EBAY_ENVIRONMENT` | `SANDBOX` or `PRODUCTION` — selects the eBay API base URL. |
| `EBAY_CLIENT_ID` / `EBAY_CLIENT_SECRET` / `EBAY_RU_NAME` | eBay Sell API OAuth2 app credentials. Leave blank to run in mock/dry-run-only mode. |
| `QUEUE_POLL_INTERVAL_MS` | How often the worker polls `queue_items` for pending work. |
| `VITE_API_BASE_URL` | Frontend's backend API base URL. |

## Run locally

```bash
# Terminal 1 — backend API
cd backend
npm run dev            # http://localhost:4000

# Terminal 2 — worker (queue processor + cron scheduler)
cd backend
npm run worker

# Terminal 3 — frontend
cd frontend
npm run dev             # http://localhost:5173
```

## Run tests

```bash
cd backend
npm test
```

This runs Vitest across all engine/connector/adapter/listing-generator unit
tests plus the **end-to-end acceptance test**
(`tests/e2e.dryRunPipeline.test.ts`), which runs the full dry-run pipeline
against `FixtureConnector` + `MockEbayAdapter` and asserts: candidates were
discovered, at least one listing was generated and published via the mock
adapter, profit calculations are internally consistent, there are no
duplicate canonical products, and a stock-out simulation causes the
corresponding mock listing to be paused.

## Dry-run mode

The primary way to prove the system works end-to-end without touching the
real eBay API:

```bash
curl -X POST http://localhost:4000/api/pipeline/dry-run -H "Content-Type: application/json" -d '{}'
```

Returns a JSON summary: candidates found, shortlisted, listings generated,
listings published (mock), and estimated revenue/profit, plus a per-product
breakdown. The Overview page in the frontend has a button that does the same.

## Admin job API

Every scheduled job type can be triggered on demand for testing:

```bash
curl -X POST http://localhost:4000/api/jobs/trigger -H "Content-Type: application/json" -d '{"type":"DISCOVERY"}'
```

Job types: `DISCOVERY`, `PRICE_STOCK_CHECK`, `MONITORING`, `RESCORING`,
`WEEKLY_ANALYSIS`, `PUBLISH_QUEUE`.

## Settings & safety limits

`GET /api/settings` / `PUT /api/settings/:key` read/write the `settings`
table, which holds:

- `operating_mode` — `MANUAL` | `ASSISTED` (default) | `AUTONOMOUS`.
- `safety_limits` — `MAX_NEW_LISTINGS_PER_DAY` (20), `MIN_PROFIT_AUD` (10),
  `MIN_MARGIN_PERCENT` (15), `MAX_PRICE_CHANGE_PERCENT` (20),
  `MAX_SOURCE_REQUESTS_PER_MINUTE` (30). Enforced in
  `backend/src/queue/publishHandler.ts` before any real publish happens.
- `fee_settings` — eBay AU fee assumptions (see below).
- `scoring_weights` — opportunity scoring weights (see `engines/scoring.ts`).
- `desired_margin_percent` — target margin used by the pricing engine.

### Enabling AUTONOMOUS mode

Set `operating_mode` to `AUTONOMOUS` via `PUT /api/settings/operating_mode`.
In this build, operating mode is read by API/queue code as a policy flag; the
publish queue processor (`publishHandler.ts`) always enforces the safety
limits above regardless of mode. Before relying on AUTONOMOUS mode in
production, wire real connectors' discovery output into the queue via the
scheduler (currently the scheduler's `DISCOVERY`/etc. jobs run against the
demo `FixtureConnector`) and configure real `EBAY_CLIENT_ID`/`SECRET`.

## eBay fee assumptions (cited)

As of this writing: eBay AU final value fee ~13% of the total sale amount for
most managed-payments categories, plus a modeled payment-processing
component of ~2.9% + $0.30 AUD per transaction (in practice eBay AU bundles
payment processing into the FVF for many categories, but this build keeps it
as a separate configurable line so you can tune it against your actual
category fee schedule). **Fees change over time and by category — verify
against eBay's current published AU fee schedule before relying on these
numbers for real listings.** See `backend/src/engines/profitability.ts`.

## eBay sandbox setup

1. Register a developer account at https://developer.ebay.com and create a
   Sandbox keyset (App ID / Cert ID / RuName).
2. Set `EBAY_ENVIRONMENT=SANDBOX`, `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`,
   `EBAY_RU_NAME` in `backend/.env`.
3. `EbayAdapter.connect()` performs a client-credentials OAuth2 token request
   against `https://api.sandbox.ebay.com/identity/v1/oauth2/token`. For calls
   requiring a seller's own consent (creating live inventory/offers), you'll
   need to complete eBay's user-consent (authorization code) flow and store
   the resulting refresh token in `api_credentials`.
4. `EbayAdapter`'s listing/order methods are stubbed with clear "not
   implemented without live sandbox credentials" errors — they document the
   exact Sell API calls to wire up (`PUT /sell/inventory/v1/inventory_item/{sku}`,
   `POST /sell/inventory/v1/offer`, `POST /sell/inventory/v1/offer/{offerId}/publish`)
   once you have real sandbox credentials to test against.

## Switching to production

- Set `EBAY_ENVIRONMENT=PRODUCTION` and use production eBay credentials.
- Swap `DATABASE_URL` to a Postgres connection string and change
  `provider = "sqlite"` to `provider = "postgresql"` in
  `backend/prisma/schema.prisma`, then `npx prisma migrate deploy`.
- Replace the `Queue` class's internals with BullMQ + Redis if you need
  horizontal scaling — the public `enqueue`/`register`/`processPending`
  surface is deliberately BullMQ-shaped so this is a drop-in change.

## Adding a new retailer connector

1. Implement `SourceConnector` (see `backend/src/connectors/base.ts`) in a
   new file under `backend/src/connectors/`.
2. If you have a real public product API or affiliate feed, implement the
   methods against it. **Never scrape a site without an API or bypass
   bot-detection/CAPTCHA** — that's a hard constraint for this project.
   Otherwise, follow the stub pattern in `backend/src/connectors/stubs.ts`
   (`healthCheck()` returns `UNAVAILABLE` with a reason).
3. Register it in `backend/src/routes/sources.ts`'s `allConnectors()` (and
   wherever jobs resolve connectors per-source, once multi-source discovery
   is wired up beyond the current single shared-connector demo job runner).

## Adding a new marketplace adapter

1. Implement `MarketplaceAdapter` (see `backend/src/marketplace/base.ts`).
2. Model `EbayAdapter` — throw a clear, catchable error from `connect()` if
   credentials are missing, so the API can surface a "not configured" status
   instead of crashing.
3. Wire it into `backend/src/queue/publishHandler.ts` (or a new handler) in
   place of / alongside `MockEbayAdapter`.

## Known limitations

- **No live retailer feeds.** `FixtureConnector` is the only real, working
  connector; it reads a static local JSON catalog and simulates price/stock
  drift deterministically. The kmart/bigw/target/amazon_au/catch connectors
  are architecture-proving stubs only — wiring them up requires each
  retailer's actual public product API or affiliate feed credentials, which
  this build does not have.
- **`EbayAdapter` listing/order calls are not exercised against a live
  sandbox** — `connect()`'s OAuth2 client-credentials flow is implemented,
  but `createListing`/`updateListing`/etc. are documented stubs pending real
  sandbox credentials.
- The scheduler's job runners (`DISCOVERY`, `PRICE_STOCK_CHECK`, etc.) all
  currently invoke the same dry-run pipeline slice against the shared demo
  `FixtureConnector`/`MockEbayAdapter` pair rather than per-source, per-store
  routing — this is enough to prove the queue/scheduler/safety-limit
  machinery end-to-end, but a production build should split these into
  narrower, per-source job payloads.
- `demandScore`/`trendScore` in the scoring engine are placeholder constants
  (60/55) — a real deployment would feed these from a trend/search-volume
  data source (`product_trends` table exists for this).
- Risk keyword/category lists are a curated starting point, not a compliance
  system — a human familiar with eBay AU policy should review before
  AUTONOMOUS-mode listing of any high-risk category.
