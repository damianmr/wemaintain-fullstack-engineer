# WeMaintain: Senior Fullstack Engineer case study

Hi, and thanks for taking the time!

This repository is a slice of WeMaintain's platform: a recreated cut of our
backend, a toy version of our admin and of our Salesforce, anonymised
production data, and a product exploration our PM just closed.
It is the material for the next step of our conversation, set up like a
working session we would have internally.

## The situation

WeMaintain maintains lifts, escalators and automatic doors, and quotes the
repairs to building owners. Several large clients have a contractual price
list for repairs (called a Schedule Of Rate, or SoR). Meaning that before we enter under contract with them, we both
agree on a set of parts/service and at what price we'll quote that to our customers.
For example: "We agree that every time you need to replace the doors, it'll cost me 500€ and not more."
Today that list is burried in the contract's PDF, and there's no automation to help!
CSMs re-types every price manually in every quote, wether or not we have an SoR with this customers. Meaning that when
we do, CSMs have to remember that the PDF exists, where it lives, and have to look up the prices everytime.

I think you can agree that it sucks!

A PM spent six weeks thinking about this problem and compiling ALL the context possible in what we call an "exploration" (or discovery) project. It ends with a list of discovery projects we could prioritize and then tackle to solve the "Schedule of Rate" issues.

Imagine you have just joined as a Senior Fullstack Engineer. Here is your
next assignment, as it landed on your Slack:

> Hey! The SoR exploration is closed and leadership greenlit
> its first deliver project. which is "price lists as structured data in
> quoting, for Lindenhome and Meridian". Can you shape it? What I mean is: a
> project description a dev (or an agent) could pick up and build without
> another shaping conversation.
> The problem Problem and rough solution is well defined, but: data model, sketch of
> the solution, milestones, how we deliver, what to leave out and why, all of that is stuff
> We ask our Software Engineers to "shape" (inspired by [shape up](https://basecamp.com/shapeup))
> Appetite is about two weeks of build for one engineer.
> Please take some time, shape it, and then let's review your shaping together
> for 60 minutes. Shape it the way you'd shape it here.

That meeting is the interview. Prepare for it the way you would if this were
your job. Reach out before with any questions, exactly as you would with
colleagues.

## What is in the repository

| Folder         | What                                                                                                                                                                                              | URL                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `exploration/` | The PM's documents; start with `00-read-me-first.md`. `price-lists/` holds the price lists of the two clients the first project covers, as CSV.                                                   |                               |
| `backend/`     | A slice of our backend: work orders, quotes, contracts, parts. NestJS, Postgres, GraphQL. `data/` holds anonymised production data, one gzipped CSV per table (`.csv.gz`), loaded by `pnpm seed`. | http://localhost:4000/graphql |
| `admin/`       | A toy version of our admin: the work order list and the work order page. SvelteKit.                                                                                                               | http://localhost:5173         |
| `salesforce/`  | A toy Salesforce: the API our backend calls, and a quote page to play the sales side. SvelteKit.                                                                                                  | http://localhost:4001         |
| `shaping/`     | The shaping of C1: the project description (`c1-contract-prices.md`) and the queries behind it. | |

The three apps run together (see "Running it").
`backend/README.md` is the technical entry point: how the code is laid out,
and the variables it reads.

**About the data.** It is real production data, anonymised: names, ids and
contractual rates are changed, the rest is as it was, including whatever is
odd, incomplete or inconsistent. Most of it covers the last year; older
quotes and work orders are there because recent records point at them.
The exploration worked from more data than this, and its rates and prices come
from different contracts and snapshots, so its figures will not always match
what you compute here, or add up with each other. This is not a data exercise so don't sweat it.

## Running it

With [devenv](https://devenv.sh), which brings Node 22, pnpm and Postgres 16:

```bash
devenv up      # terminal 1: Postgres
devenv shell   # terminal 2, then:
pnpm install
pnpm dev       # loads the supplied data, then starts the backend, admin and toy Salesforce
```

Without devenv: Node 22, pnpm (`corepack enable`) and a Postgres 16 with a
`wemaintain` database owned by `wemaintain`/`wemaintain` on localhost:5432
(`docker compose up -d` gives you one). Set `DATABASE_URL` if yours is elsewhere.

Every `pnpm dev` starts from the supplied data: it runs `pnpm seed` first, so
quote drafts, sent quotes and other changes from the last session are gone.
`pnpm seed` alone puts the data and the toy Salesforce back as they were.

To query the data, `psql "$DATABASE_URL"`, or
`psql postgres://wemaintain:wemaintain@127.0.0.1:5432/wemaintain` if you did not set it.
Tables are grouped by schema: `workorders`, `contracts`, `users`, `buildings`,
`devices`, `pricing` (the contract price lists) and `salesforce`.

## A tour

1. Open work order `R26-16849` in the admin
   (http://localhost:5173/work-orders/details/R26-16849), look at its items,
   and click "Generate quote on Salesforce".
2. Follow the link to the quote in Salesforce. Move it to `Presented`, then
   `Accepted`: the admin follows, and the backend logs the acceptance email it
   would send.

## How we shape here

A few habits from the team, for context:

- We start from the screen, not the schema. Before writing anything down, we
  build a throwaway frontend on fake data and click through it, alone first,
  then with a CSM. It costs an afternoon with an agent, and it settles more
  arguments than a document.
- Only then do we wire it to the real backend and data. The data model we
  write down is the one the toy proved it needed, and it has to hold in
  production, not just in the toy.
- The write-up comes last and stays short: what we decided, what we left out,
  and why.

The `admin/` and `salesforce/` toys in this repository were built the same way.

## About the meeting

Before we meet, share a repository with your shaping in it (a private GitHub
repo with access for `Superd22` is perfect). We go through it first, and we
book the 60 minutes once we have. If we don't think it's ready for the
conversation, we'll tell you why.

You drive the first half and present. We spend the second half on the
decisions you made and the ones you did not. We are interested in how deep
you went, what you looked for, whether the data model holds, and how you work
with a non-technical stakeholder. Use any tool you like, AI included; we do.
We'd rather click through something than read about it.

Any questions before then, feel free to reach out.
