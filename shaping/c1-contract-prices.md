# C1: contract price lists in quoting

Shaped for one engineer, about two weeks. The prototype in this branch is the
screen we clicked through and the model it proved. This page says what we
decided, what we left out, and why.

## The problem

Lindenhome and Meridian have a price list in their contract. Today a CSM
generates a Salesforce quote from the work order's repair items, which prices
them from cost, then opens the contract PDF and retypes the price by hand in
Salesforce. The backend never sees that price. Attaching another work order
later rebuilds the quote from the items and loses the typed line.

What real quotes contain (queries in `analysis/`):

- Not only list lines. Of 271 Lindenhome AL lines, 93 cite a list code at the
  list price, but others are hourly labour, off-list parts at a coefficient, or
  a list code at another price.
- Several work orders per quote: 39 of 106 Lindenhome AL quotes and 22 of 49
  Meridian quotes, up to 10 work orders, and across buildings for Lindenhome.
- Meridian prints three time bands, but only item 65 has three prices.

## The solution

A **quote draft card** on the existing work-order page, for contracts linked to
a price list. Contracts without a list keep today's buttons, so a CSM never
sees both on one work order.

1. **Start draft** on a work order. **Add work order** brings in others on the
   same contract, in any building. Every work order in the draft shows the
   same card.
2. **Add from contract list**: search by code or wording, check the scope,
   pick the quantity, and for Meridian the time band (all printed bands are
   shown, even equal ones). The server sets the price; it cannot be changed.
   Link the repair items the line covers.
3. **Add manual line** for anything else, with a reason: part not on the
   list, subcontracted work, negotiated price, other. It can point to the
   contract rule it followed, such as 0097AS (supplier invoice x 1.41).
4. **Send to Salesforce**: the quote gets exactly these lines. While the quote
   is Draft, the CSM can change the draft and update the quote. Once it moves
   on, the draft closes. Sending waits until the supply team has identified
   every part.

Why a contract price cannot be edited: the agreed price is a ceiling ("it'll
cost me 500€ and not more"). Any other price is a manual line, so every
difference from the list stays visible.

## The data model

| Table | Holds |
| --- | --- |
| `pricing.price_list` | one imported version of a client's list |
| `pricing.price_list_band` | the list's time bands, stored once (Meridian: 3, Lindenhome: none) |
| `pricing.price_list_entry`, `price_list_rate` | each operation, and its price per band (or one price) |
| `pricing.price_list_rule` | multipliers, volume discounts, Star Rates: rules, never prices |
| `pricing.contract_price_list` | which list version prices a contract, valid from and to. It is also the rollout switch |
| `workorders.quote_draft` | one quote being prepared for one contract, with its pricing date |
| `quote_draft_work_order` | its work orders; a work order is in one draft at most |
| `quote_draft_line` | contract or manual line, with copied code, wording, band and price |
| `quote_draft_line_item` | the repair items a line covers: the data C2 learns matching from |
| `quote_draft_observation` | what reached the customer, read when the quote is presented |

Prices are never edited in place: a new price is a new list version, and a line
keeps the price it copied.

## Salesforce

Each line goes on the existing product REPAIR SERVICES (SKU 1008536), with its
own price and customer text. That product is in every country's Repair
pricebook, and CSMs already put Schedule of Rates lines on it. So C1 creates no
product per contract entry and needs no catalogue sync. Lines are never merged
by SKU. Each line also carries our line id (`WeMaintain_Line_ID__c`), so we can
match it back.

## Rollout and measurement

- A contract with a link quotes through drafts. Six pilot contracts are linked,
  each with evidence that the list applies. Not linked yet: Kembang's second
  contract, North Gem and Ardmoor (other prices for item 38), Lindenhome PM
  (its earlier list is not supplied).
- Existing quotes past Draft stay as they are. An old-way Draft quote can be
  **adopted**: its work orders join a draft, its lines come in as manual lines
  to review, and sending updates the same quote.
- The roadmap counts a line when its final sent price is the list price. When
  a quote moves to Presented, the backend reads its lines and records how many
  contract lines arrived unchanged, changed, removed or added in Salesforce.

## Left out, on purpose

Each was considered and cut because it serves none of C1's three features, or
does not fit two weeks.

- A lock on sent drafts: the measure reads Salesforce at presentation,
  which also catches edits made there.
- A default band per draft, hiding equal bands: nothing says which
  band applies; showing every band matches the contract.
- A separate draft page or a Quotes menu: the card gives one screen
  with less new UI; the backend has no list of quotes to show.
- A retry key against duplicate quotes: today's button has the same gap.
  We assume production handles it; if not, store the draft id on the quote.
- Calculating rules (x 1.41, volume discounts, Star Rates), automatic
  matching, labour from parts, time bands from a schedule: C2 to C4.

## How it supports the next projects

- C2, matching: a contract line can link the repair items it covers, and the
  card asks for it. These links are what matching learns from.
- C3, full drafts: a draft already holds a whole quote across work orders.
- C4, pricing controls: every line says where its price came from, and rules
  are stored apart from prices, so C4 can extend the model without replacing
  C1's records or losing saved prices. Expected additions: an amount range on
  rules, a calculated line kind, and drafts priced from several sources of one
  contract. The schema already allows several links per contract, but today a
  draft prices from one list and two applicable links are refused.
- C5, send controls needs a check before the customer receives the quote.
  Today Salesforce changes the status first and tells the backend afterwards;
  that integration change is outside C1.

The roadmap's model requirements (section 6), one by one:

| Requirement | In C1 |
| --- | --- |
| Per-contract lists, per-account part mapping, shared concepts | lists now; mapping and concepts with C2, fed by the coverage links |
| Both pricing patterns, side by side | several sources per contract, rules stored; calculation in C4 |
| Labour by time band | covered: bands per list version, Lindenhome's two labour codes |
| Off-list coefficients, banded by amount | stored as rules; an amount range with C4 |
| Labour derived from the part | C3 |
| Output configuration per account, as data | all-in lines, written as the contract prints each row; split parts and labour later |
| Per-line rate conformance | contract or manual line with a reason, plus the observation |
| No-match, aliasing, roll-up | manual line; one line covering several items; aliases with C2 |
| Effective-dated versions | immutable versions, dated links, a pricing date per draft |
| Chargeability scope | the existing work-order flag |
| Confidence tier | later, as evidence on the contract link |

## Assumptions to confirm

- The rate comes from the list version linked on the draft's creation date. A
  draft is not repriced if a new version arrives.
- A link is valid for the contract's own term. Meridian's table states this;
  Lindenhome's list states no period.
- The backend owns the rates and drafts, and Salesforce receives finished
  lines. Who should own the rates in production is still open.
- Linking more clients will bring buildings that mix linked and unlinked
  contracts. Before that, the old quote command must refuse quotes a draft
  manages. In the pilot no such building exists.

## Delivery plan

Ten working days, in four checkpoints. Each ends with something a CSM can
try.

| Days | Checkpoint | Done when |
| --- | --- | --- |
| 1 to 2 | Card on fake data, reviewed with a CSM from each country | The flow and the line wording are agreed |
| 3 to 5 | Lists imported, contracts linked, drafts saved | A CSM builds a draft on real work orders; prices come from the list |
| 6 to 8 | Send, update, return to Draft, adoption | A draft becomes a correct Salesforce quote for both clients |
| 9 to 10 | Measurement, rollout on the six contracts, write-up | The first presented quotes are measured |

The one outside dependency is Salesforce, in two parts:

- The Apex quote API must take each line's price and customer text. Without
  it, the send checkpoint is blocked, so this is the first thing to confirm.
- A field on quote lines for our line id. If only this is missing by day 6,
  measurement falls back to matching lines by text and price, and is
  approximate. That fallback is a plan, not built: the prototype matches by
  line id.

## Known limits

- After sending, a CSM can still edit lines in Salesforce. C1 does not see it
  until the quote is presented.
- If a CSM changes a sent draft and does not update the quote, they differ.
- Nothing stores a lift's number of levels, so the CSM must know it for
  per-level supplements. Deductions are manual lines; past quotes have none.
- The line id field on Salesforce quote lines is an assumption about the real
  org (question 1 below).

## Questions for WeMaintain

The ones that change the plan most:

1. Can we add a draft-line id field to QuoteLineItem and change the Apex quote
   API, and who deploys it?
2. How should a contract line read on each client's quote? Is a base line and
   its per-level supplement as two lines fine?
3. When a quote is cloned or edited in Salesforce, which system owns the lines?
   Does production already prevent duplicate quotes after a timeout?
4. Do North Gem, Ardmoor and Kembang's second contract use Table A, or is the
   price difference a side effect of the anonymised data?
5. Can a CSM prepare a draft before supply identifies the parts, with Send
   waiting, as we built it?

## Try it

`pnpm dev` loads the supplied data, the two lists and the six links, then starts
the apps. Everything done in a session is gone at the next start.

- Lindenhome, several buildings: open R26-15442, start a draft, add R26-15155,
  add 0435AS and a manual line from rule 0097AS, send.
- Meridian, time bands: open R26-11241, add SOR item 65 after office hours x 8.
- Adoption: open R26-13309 (quote 00032043, no lines yet), adopt it, add 0320AS
  for the electrocam of R26-15307. Send waits for the supply team: on R26-15307,
  assign a catalogue part to the electrocam, then update the quote.
- Measurement: move a sent quote to Presented in the toy Salesforce, and the
  card shows how many contract lines arrived at the list price.

## Built in this order

The commits tell the story: the queries behind the analysis, the card on fake
data (contract lines, manual lines, several work orders), then the tables the
screen proved (price lists, contract links, drafts), then Salesforce (send,
return to Draft, adoption, measurement).
