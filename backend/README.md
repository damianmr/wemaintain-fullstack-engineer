# WeMaintain backend (slice)

A small, runnable slice of our backend: work orders and their items, quotes
(which live in Salesforce), contracts, parts, and the Salesforce sync. It runs
as one NestJS app on one Postgres database with one GraphQL schema.

The slice is recreated from our monorepo. Our code base still calls a work
order a repair request in places; here it is a work order everywhere except in
the Salesforce integration, which keeps the Salesforce names.

## Layout

```
src/
  work-orders/      work orders and their items
  quotes/           quotes: the Salesforce record plus our quote event stream
  contracts/        customers, buildings, devices, contracts (read by quoting; written by the Salesforce sync)
  parts/            the parts catalogue, synced from the ERP
  price-lists/      the contract price lists (Schedules of Rates), one version per import
  salesforce-sync/  what we do when Salesforce tells us something changed
  schema.graphql    the whole API
  shared/
    salesforce.ts     the Salesforce REST client
    event-sourced.ts  the base class of the event-sourced aggregates (WorkOrder, Quote)
    boilerplate/      bootstrap, database, dependencies, GraphQL server: plumbing
docs/               the Salesforce seam, the schema history, what is stubbed
data/               anonymised production data, one gzipped CSV per table
seed/               loads data/ into Postgres
```

Every module reads the same way:

- `domain/`: classes with the business rules (`WorkOrder`, `Quote`, …), their events and errors.
- `commands/`: one file per user action, one exported function `(input, deps)`.
  It loads the aggregate, calls a business method, saves.
- `queries/`: one file per read, one exported function. Reads rows straight into the API shape.
- `infrastructure/`: database entities and repositories (mapping only), Salesforce adapters, GraphQL resolvers.

## Running it

From the repository root, `pnpm dev`, which seeds first (see the root README). The
backend alone: `pnpm --filter backend dev`.

Every variable the three apps read:

| Variable | Read by | Default |
| --- | --- | --- |
| `DATABASE_URL` | backend, seed, toy Salesforce | `postgres://wemaintain:wemaintain@127.0.0.1:5432/wemaintain` |
| `PORT` | backend | `4000` |
| `SALESFORCE_URL` | backend, seed | `http://localhost:4001` |
| `BACKEND_URL` | toy Salesforce (where it sends events) | `http://localhost:4000` |
| `ADMIN_URL` | toy Salesforce (links to work orders) | `http://localhost:5173` |
| `VITE_BACKEND_URL` | admin | `http://localhost:4000` |

The admin and the toy Salesforce always listen on 5173 and 4001.

Try it on http://localhost:4000/graphql:

```graphql
{ workOrders(limit: 5) { totalCount items { id workOrderNumber state sfQuoteId } } }
```
