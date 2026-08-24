# Kioskeo

Point-of-sale for Argentine corner shops. Works with no internet. Live at **[kioskeo.com](https://kioskeo.com)**.

Built in 2026 by [Lucas Medina](mailto:worklmdok@gmail.com). One store uses it daily; more in onboarding.

---

## The problem

A kiosco in Argentina runs on a paper notebook. Sales, store credit, who owes what, what the employee took out of the till. The existing software is either desktop-only from around 2010 and costs more than a million pesos up front, or it's cloud software that stops working when the connection drops. In this market the connection drops.

Two more things the incumbents get wrong. Prices change constantly because of inflation, so bulk price updates by category are not a nice-to-have. And the owner's real worry is not accounting, it's whether the person behind the counter is stealing.

Kioskeo is built around those three facts: works offline, updates prices in bulk, and makes the till auditable per shift.

## Decisions worth explaining

**Money is integer cents. Never floats.** Every amount in the system is an integer. There is one module that knows how to do arithmetic on money and everything else calls it.

**A sale is an immutable event.** Sales are never edited. A mistake is corrected by voiding the sale and creating a new one. This started as a data-integrity decision and turned out to be the anti-theft feature: an employee cannot quietly change what was rung up, because the void stays in the record forever.

**Offline-first, not offline-tolerant.** The app writes to local storage first and always. Every local change is written and queued into an outbox in the *same* transaction, so a crash between the two is impossible. A sync engine drains the queue in order and only deletes from the outbox after the server confirms. Downloads are cursor-based per table and idempotent on write, so replaying the same rows changes nothing.

**The business core has no idea a UI exists.** `src/core/` is pure functions: sales, pricing, voids, till sessions, store credit. It doesn't read the clock, touch the network, or know about React. That's what makes it testable, and it's a direct lesson from an earlier project of mine where financial formulas were inlined in components and two screens disagreed about the same number.

**The codebase is in Spanish.** Deliberate. The domain is Spanish — *fiado*, *caja*, *turno*, *rubro* — and these words have no clean English equivalents that a shop owner would recognize. Translating them would add a layer of lossy indirection between the code and the business.

## Architecture

```
src/core/     pure business logic, no I/O        (money, sales, voids, till, store credit)
src/db/       IndexedDB via Dexie + outbox queue
src/sync/     sync engine + Supabase connector
src/ui/       React components
src/import/   Excel import, product lookup by barcode
supabase/     schema, row-level security, admin RPCs
```

Data flow on a sale: UI → core validates and builds the immutable event → one Dexie transaction writes the sale, decrements stock, and appends to the outbox → sync engine pushes when online → Postgres, isolated per business by row-level security.

## What's in it

Checkout with camera barcode scanning (native `BarcodeDetector`, falling back to ZXing, falling back to typing it in). Split payments across cash, transfer and store credit, where the parts must sum exactly to the total or the sale is rejected. Products with stock, bulk price increases by category with a preview of before/after. Till sessions tied to an employee, with a blind close and a lateness indicator per shift. Store credit per customer. An owner dashboard. Excel import, including an LLM fallback that maps the columns of badly-formatted spreadsheets. Installable as a PWA.

Around 70 automated tests, concentrated on the core.

## Stack

React 19, TypeScript, Vite, Dexie (IndexedDB), Supabase (Postgres + Auth), Vercel. Vitest. No UI framework — the CSS is hand-written against design tokens.

## Running it

```bash
npm install
cp .env.example .env.local   # add Supabase credentials, or leave it empty to run fully local
npm run dev
npm test
```

Without credentials the app runs entirely on-device with no cloud. That's not a degraded mode; it's the primary one.

## A note on how this was built

I designed and directed this system; the code was written AI-assisted. The architecture decisions here are mine and I'll defend any of them. I'm not going to pretend otherwise, because the interesting part of this project isn't the typing.

## License

All rights reserved. Public for reference, not for reuse.
