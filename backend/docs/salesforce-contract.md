# The Salesforce seam

What the backend expects from Salesforce, and what it expects Salesforce to
send it. The toy Salesforce implements this; the real org implements the same
thing through its REST API, an Apex REST class and platform events.

Base URL: `SALESFORCE_URL` (default `http://localhost:4001`). API version `v59.0`.
Every error is a non-2xx response; its body text becomes the error message.
Client code: `src/shared/salesforce.ts`.

## 1. Calls the backend makes

### SOQL query

`GET /services/data/v59.0/query?q=<SOQL>` → `{ "totalSize": n, "done": true, "records": [...] }`

Relationship fields come back nested (`Account.Name` → `{ "Account": { "Name": … } }`),
and a child subquery comes back as `{ "records": [...] }` or `null`.

The backend sends these shapes, and only these:

| From | Query | Used by |
| --- | --- | --- |
| `QuoteRepository` | `SELECT Id, Name, QuoteNumber, Description__c, Status, GrandTotal, CurrencyIsoCode, SentDate__c, CreatedDate, Account.Name, Email, Opportunity.Owner.Name, Opportunity.Owner.Email, (SELECT ContentDocumentId FROM ContentDocumentLinks ORDER BY SystemModstamp DESC) FROM Quote WHERE Id IN (…)` | quote reads |
| `adoptQuote` | `SELECT Id, Quantity, UnitPrice, Discount, QuotePdf_ProductName__c, Quote_Line_Description__c, Product2.Name FROM QuoteLineItem WHERE QuoteId = '<quote id>'` | the lines of a Draft quote a quote draft takes over |
| `observeSentQuote` | `SELECT Id, Quantity, UnitPrice, Discount, WeMaintain_Line_ID__c FROM QuoteLineItem WHERE QuoteId = '<quote id>'` | the lines of a quote presented to the customer |
| quote status consumer | `SELECT Id, RRID__c, Quote__r.QuoteNumber, Quote__r.Status FROM Repair_Request__c WHERE Quote__c = '<quote id>'` | which work orders a quote covers |
| contract-device consumer | `SELECT Id, Wemaintain_ID__c FROM Contract WHERE Id = '<id>'` | our contract id |
| contract-device consumer | `SELECT Id, WeMaintain_ID__c FROM Device__c WHERE Id = '<id>'` | our device id |

On create or update, every SKU is looked up in the pricebook of the first
device's country. An unknown SKU fails the whole call
(`No PriceBookEntry found for SKU …`). A line's price is `price` if sent,
otherwise a margin on `cost`, otherwise the pricebook price. Only `Draft`
quotes can be updated.

`Quote.Status` values: `Draft`, `Presented`, `Pre-Accepted`, `Accepted`,
`Works in progress`, `To be billed`, `Billed`, `Denied`.

`Repair_Request__c` is the Salesforce record of one of our work orders;
`RRID__c` holds our work order id.

### Update a record

`PATCH /services/data/v59.0/sobjects/<SObject>/<Id>` with the fields to set → `204`.

Used to write our id back: `ContractDeviceAssociation__c.WeMaintain_ID__c`.

### Create or update a quote (Apex REST)

`POST /services/apexrest/createQuote`

```json
{
  "r": {
    "quoteId": "0Q0…",            // absent: create a quote; present: update that quote
    "deviceIds": ["00000000-0000-4000-8000-000000000001"], // our device ids (UUIDs)
    "rrIds": ["<work order id>"],  // optional
    "quoteDescription": "…",
    "ownerEmail": null,
    "products": [
      { "sku": "DOOR-ROLLER-01", "quantity": 3, "cost": 120, "price": 210 },
      { "sku": "1008536", "quantity": 1, "price": 1360, "cost": null,
        "productName": "0435AS Remote alarm replacement …", "lineId": "<quote draft line id>" }
    ]
  }
}
```

`cost` and `price` are each optional (`cost` may be `null`). `productName` replaces
the product's name on the customer quote (`QuotePdf_ProductName__c`). `lineId` is
kept on the line as `WeMaintain_Line_ID__c`, so a quote draft can match each
Salesforce line back to its own; it is a C1 assumption about the real org. Response:
`{ "quoteId": "0Q0…", "quoteStatus": "Draft" }`. On update, the quote's lines
and its `Repair_Request__c` links are replaced by the payload's. An unknown
`quoteId` answers with an error containing `No quote found for id`.

## 2. Events Salesforce sends the backend

`POST {BACKEND_URL}/salesforce/events` (default `http://localhost:4000`)

```json
{ "topic": "<SObject or platform event>", "changeType": "created|updated|deleted|undeleted", "record": { … } }
```

Answer: `200 { "handled": <number of listeners> }`, or `500` if a listener failed.

| Topic | changeType | Record fields | Listener |
| --- | --- | --- | --- |
| `QuoteStatusChangeEvent__e` | (none) | `QuoteId__c`, `From__c`, `To__c`, `CreatedDate` | `onQuoteStatusChanged` |
| `ContractDeviceAssociation__c` | `created`, `updated`, `undeleted` | `Id`, `Contract__c`, `Device__c`, `Amount__c`, `StartDate__c`, `EndDate__c`, `IsTerminated__c`, `WeMaintain_ID__c` | `upsertContractDevice` |

Salesforce fires `QuoteStatusChangeEvent__e` when a quote is created (`From__c`
empty, `To__c` `Draft`) and on every status change, including back to `Draft`.

## 3. The toy Salesforce

`../salesforce/` implements this contract, plus what a Salesforce user does on
a quote. Its quote page is laid out like the real org's. On it you can:

- change the status on the path, which publishes `QuoteStatusChangeEvent__e`;
- add a line through the "Add Product" flow: pick a product from the quote's
  pricebook, or type a new name and a new product is created;
- edit lines one by one (including the PDF name and description) or all at
  once ("Edit Products"), and delete them;
- clone the quote and preview its PDF.

Editing lines publishes nothing. The org lives in memory, loaded from the
`salesforce` schema (`../salesforce/schema.sql`) on start; `pnpm seed` reloads it.
