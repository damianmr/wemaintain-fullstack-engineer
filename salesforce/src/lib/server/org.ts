// A toy Salesforce org: just enough of the real one for the quote flow to run end to end.
// Everything lives in memory, loaded from the salesforce schema (see ../../../schema.sql) on start and on POST /toy/reset.
import pg from 'pg';

type SObject = Record<string, any>;

const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:4000';
export const ADMIN = process.env.ADMIN_URL ?? 'http://localhost:5173';
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://wemaintain:wemaintain@127.0.0.1:5432/wemaintain';

export const STATUSES = ['Draft', 'Presented', 'Pre-Accepted', 'Accepted', 'Works in progress', 'To be billed', 'Billed', 'Denied'];

const VAT: Record<string, number> = { FR: 20, GB: 20, PT: 23, SG: 9, HK: 0 };

/** Thrown for anything the real org would answer with an Apex error. */
export class ApexError extends Error {}

// ---- the org --------------------------------------------------------------------

// numeric as numbers, timestamps as ISO strings, dates as YYYY-MM-DD: what the REST API returns.
pg.types.setTypeParser(1700, parseFloat);
pg.types.setTypeParser(1184, (v) => new Date(v).toISOString());
pg.types.setTypeParser(1082, (v) => v);

/** SELECT the fields as Salesforce spells them (the table stores them folded to lower case). */
const select = (db: pg.Pool, object: string, fields: string[]) =>
	db.query(`SELECT ${fields.map((f) => `${f} AS "${f}"`).join(', ')} FROM salesforce.${object}`).then((r) => r.rows as SObject[]);

async function load(): Promise<Org> {
	const db = new pg.Pool({ connectionString: DATABASE_URL });
	try {
		const [users, accounts, opportunities, products, Pricebook2, entries, quotes, lines, Repair_Request__c, Device__c, Contract, ContractDeviceAssociation__c] =
			await Promise.all([
				select(db, 'User', ['Id', 'Name', 'Email']),
				select(db, 'Account', ['Id', 'Name', 'BillingCountryCode', 'CurrencyIsoCode', 'OwnerId', 'WeMaintain_Customer_ID__c']),
				select(db, 'Opportunity', ['Id', 'OwnerId']),
				select(db, 'Product2', ['Id', 'Name', 'Description', 'StockKeepingUnit', 'Family', 'Source__c']),
				select(db, 'Pricebook2', ['Id', 'Name', 'IsActive', 'Country__c', 'Type__c']),
				select(db, 'PricebookEntry', ['Id', 'Pricebook2Id', 'Product2Id', 'UnitPrice', 'IsActive']),
				select(db, 'Quote', [
					'Id', 'Name', 'QuoteNumber', 'Status', 'GrandTotal', 'Subtotal', 'CurrencyIsoCode', 'CreatedDate', 'SentDate__c',
					'Description__c', 'AccountId', 'OpportunityId', 'ContactId', 'Email', 'Pricebook2Id', 'TVA__c', 'WeMaintain_Quote_ID__c'
				]),
				select(db, 'QuoteLineItem', [
					'Id', 'QuoteId', 'PricebookEntryId', 'Product2Id', 'Quantity', 'UnitPrice', 'Cost__c', 'Discount',
					'QuotePdf_ProductName__c', 'Quote_Line_Description__c'
				]),
				select(db, 'Repair_Request__c', ['Id', 'RRID__c', 'Quote__c']),
				select(db, 'Device__c', ['Id', 'Name', 'WeMaintain_ID__c', 'Country__c']),
				select(db, 'Contract', ['Id', 'Wemaintain_ID__c']),
				select(db, 'ContractDeviceAssociation__c', ['Id', 'Contract__c', 'Device__c', 'Amount__c', 'StartDate__c', 'EndDate__c', 'WeMaintain_ID__c'])
			]);
		// The real org reaches a device's account through Device__c -> Building__c -> Account.
		// The toy takes the same path through the backend's buildings and customers.
		const placed = (
			await db.query(`SELECT d.id AS "deviceId", b."addressLine1" AS "site", b."customerId"::text AS "customerId"
			                FROM devices.device d JOIN buildings.building b ON b.id = d."buildingId"`)
		).rows as { deviceId: string; site: string; customerId: string }[];

		const byId = <T extends SObject>(rows: T[]) => new Map(rows.map((r) => [r.Id as string, r]));
		const [userById, accountById, opportunityById, productById] = [byId(users), byId(accounts), byId(opportunities), byId(products)];
		const accountByCustomer = new Map(accounts.map((a) => [a.WeMaintain_Customer_ID__c, a]));
		const owner = (id: string | null) => {
			const user = id ? userById.get(id) : undefined;
			return user ? { Name: user.Name, Email: user.Email } : null;
		};
		const withProduct = (r: SObject): SObject => ({ ...r, Product2: productById.get(r.Product2Id) ?? { Id: r.Product2Id, Name: '(deleted product)' } });

		const QuoteLineItem = lines.map(withProduct);
		const quoted = new Set(QuoteLineItem.map((l) => l.QuoteId));
		const Quote = quotes.map((q): SObject => ({
			...q,
			Account: { Name: accountById.get(q.AccountId)?.Name ?? null },
			Opportunity: { Owner: owner(opportunityById.get(q.OpportunityId)?.OwnerId ?? null) },
			ContentDocumentLinks: quoted.has(q.Id) ? { records: [{ ContentDocumentId: `069${q.Id.slice(3)}` }] } : null
		}));
		const PricebookEntry = entries.map(withProduct);
		const deviceAccount = new Map(
			placed.map((p) => {
				const account = accountByCustomer.get(p.customerId);
				return [p.deviceId, { site: p.site, account: account ? { Name: account.Name, CurrencyIsoCode: account.CurrencyIsoCode, owner: owner(account.OwnerId) } : null }];
			})
		);
		return {
			Quote,
			QuoteLineItem,
			Repair_Request__c,
			Device__c,
			Contract,
			ContractDeviceAssociation__c,
			Pricebook2,
			PricebookEntry,
			entryBySku: new Map(PricebookEntry.filter((e) => e.IsActive && e.Product2.StockKeepingUnit).map((e) => [`${e.Pricebook2Id}|${e.Product2.StockKeepingUnit}`, e])),
			deviceAccount,
			nextQuote: Math.max(0, ...Quote.map((q) => Number(q.QuoteNumber) || 0)) + 1,
			nextId: 1
		};
	} finally {
		await db.end();
	}
}

interface Org {
	Quote: SObject[];
	QuoteLineItem: SObject[];
	Repair_Request__c: SObject[];
	Device__c: SObject[];
	Contract: SObject[];
	ContractDeviceAssociation__c: SObject[];
	Pricebook2: SObject[];
	PricebookEntry: SObject[];
	/** Active entries by "pricebookId|SKU": how the createQuote Apex resolves a product. */
	entryBySku: Map<string, SObject>;
	deviceAccount: Map<string, { site: string; account: { Name: string; CurrencyIsoCode: string; owner: { Name: string; Email: string } | null } | null }>;
	nextQuote: number;
	nextId: number;
}

const newId = (db: Org, prefix: string) => `${prefix}TOY${String(db.nextId++).padStart(9, '0')}AA`;
const store = globalThis as unknown as { __toyOrg?: Org };
export const org = (): Org => {
	if (!store.__toyOrg) throw new Error('The toy org is still loading');
	return store.__toyOrg;
};
export async function reset() {
	store.__toyOrg = await load();
	console.log(`Toy org loaded: ${store.__toyOrg.Quote.length} quotes, ${store.__toyOrg.PricebookEntry.length} pricebook entries`);
}

// ---- REST API: SOQL and record updates ------------------------------------------

/** Understands only the WHERE shapes our backend sends: Id = / Id IN, Status IN, Quote__c =, QuoteId =. */
export function soql(q: string): { totalSize: number; done: true; records: SObject[] } {
	const db = org() as unknown as Record<string, SObject[]>;
	const where = q.replace(/\(SELECT[^)]*\)/gi, '');
	const from = /FROM (\w+)/i.exec(where)![1];
	const list = (re: RegExp) => re.exec(where)?.[1].split(',').map((v) => v.trim().replace(/'/g, ''));
	const ids = list(/\bId IN \(([^)]*)\)/i) ?? list(/\bId = ('[^']*')/i);
	const statuses = list(/\bStatus IN \(([^)]*)\)/i);
	const quoteId = /Quote__c = '([^']*)'/i.exec(where)?.[1];
	const lineQuoteId = /\bQuoteId = '([^']*)'/i.exec(where)?.[1];
	const records = (db[from] ?? []).filter(
		(r) =>
			(!ids || ids.includes(r.Id)) &&
			(!statuses || statuses.includes(r.Status)) &&
			(!quoteId || r.Quote__c === quoteId) &&
			(!lineQuoteId || r.QuoteId === lineQuoteId)
	);
	const withQuote = records.map((r) => (r.Quote__c ? { ...r, Quote__r: db.Quote.find((x) => x.Id === r.Quote__c) } : r));
	return { totalSize: records.length, done: true, records: /COUNT\(\)/i.test(q) ? [] : withQuote };
}

export function updateRecord(sobject: string, id: string, fields: SObject) {
	const record = ((org() as unknown as Record<string, SObject[]>)[sobject] ?? []).find((r) => r.Id === id);
	if (!record) throw new ApexError(`Provided external ID field does not exist or is not accessible: ${id}`);
	Object.assign(record, fields);
}

// ---- Apex REST: /services/apexrest/createQuote ------------------------------------

export interface Product {
	sku: string;
	quantity: number;
	cost?: number | null;
	price?: number;
	productName?: string;
	productDescription?: string;
}

export interface CreateQuoteRequest {
	quoteId?: string;
	deviceIds: string[];
	rrIds?: string[];
	quoteDescription?: string;
	ownerEmail?: string | null;
	products: Product[];
}

export async function createQuote(r: CreateQuoteRequest): Promise<{ quoteId: string; quoteStatus: string }> {
	const db = org();
	const device = db.Device__c.find((d) => d.WeMaintain_ID__c === r.deviceIds?.[0]);
	if (!device) throw new ApexError(`No device found for id ${r.deviceIds?.[0]}`);
	const country: string = device.Country__c;

	let quote = r.quoteId ? db.Quote.find((q) => q.Id === r.quoteId) : undefined;
	if (r.quoteId && !quote) throw new ApexError(`No quote found for id ${r.quoteId}`);
	if (quote && quote.Status !== 'Draft') throw new ApexError('Only Draft quotes can be overwritten.');

	const lines = priceLines(db, pricebookOf(db, country).Id, r.products);
	const created = !quote;
	if (!quote) {
		const n = db.nextQuote++;
		const placed = db.deviceAccount.get(device.WeMaintain_ID__c);
		const account = placed?.account;
		if (!account) throw new ApexError(`No account found for device ${device.Name}`);
		const number = String(n).padStart(8, '0');
		quote = {
			Id: `0Q0TOY${String(n).padStart(10, '0')}AA`,
			QuoteNumber: number,
			Name: `Q${number} - ${placed.site} - ${account.Name}`,
			Status: 'Draft',
			CurrencyIsoCode: account.CurrencyIsoCode,
			CreatedDate: new Date().toISOString(),
			SentDate__c: null,
			Account: { Name: account.Name },
			Email: null,
			Opportunity: { Owner: { Name: account.owner?.Name ?? null, Email: r.ownerEmail ?? account.owner?.Email ?? null } },
			WeMaintain_Quote_ID__c: null,
			ContentDocumentLinks: null
		};
		db.Quote.push(quote);
	}

	quote.Description__c = r.quoteDescription ?? null;
	db.QuoteLineItem = db.QuoteLineItem.filter((l) => l.QuoteId !== quote.Id);
	db.Repair_Request__c = db.Repair_Request__c.filter((rr) => rr.Quote__c !== quote.Id);
	setPricedLines(db, quote, country, lines);
	for (const rrId of r.rrIds ?? []) db.Repair_Request__c.push({ Id: `a0R${rrId.replace(/-/g, '').slice(0, 15)}`, RRID__c: rrId, Quote__c: quote.Id });
	// The real org renders the PDF and attaches it to the quote on every push.
	quote.ContentDocumentLinks = { records: [{ ContentDocumentId: `069${quote.Id.slice(3)}` }] };

	if (created) await publishStatusChange(quote, '');
	return { quoteId: quote.Id, quoteStatus: quote.Status };
}

function pricebookOf(db: Org, country: string) {
	const pricebook = db.Pricebook2.find((pb) => pb.Country__c === country && pb.Type__c === 'Repair' && pb.IsActive);
	if (!pricebook) throw new ApexError(`No Repair pricebook for ${country}`);
	return pricebook;
}

/** Resolves every SKU in the quote's pricebook. Unknown SKU: the whole push fails, like the real org. */
function priceLines(db: Org, pricebookId: string, products: Product[]) {
	return products.map((product) => {
		const entry = db.entryBySku.get(`${pricebookId}|${product.sku}`);
		if (!entry) throw new ApexError(`No PriceBookEntry found for SKU ${product.sku}`);
		// An explicit price wins; otherwise a margin on the cost; otherwise the pricebook's price.
		const unitPrice = product.price ?? (product.cost != null ? Math.round(product.cost * 135) / 100 : entry.UnitPrice);
		return { entry, product, unitPrice };
	});
}

function setPricedLines(db: Org, quote: SObject, country: string, lines: ReturnType<typeof priceLines>) {
	quote.Pricebook2Id = pricebookOf(db, country).Id;
	quote.TVA__c = VAT[country];
	lines.forEach(({ entry, product, unitPrice }) =>
		db.QuoteLineItem.push({
			Id: newId(db, '0QL'),
			QuoteId: quote.Id,
			PricebookEntryId: entry.Id,
			Product2: entry.Product2,
			Quantity: product.quantity,
			UnitPrice: unitPrice,
			Cost__c: product.cost ?? null,
			Discount: null,
			QuotePdf_ProductName__c: product.productName ?? null,
			Quote_Line_Description__c: product.productDescription ?? null
		})
	);
	updateTotal(db, quote);
}

// ---- what a Salesforce user does ------------------------------------------------------

export const quote = (id: string) => org().Quote.find((q) => q.Id === id);
export const linesOf = (quoteId: string) => org().QuoteLineItem.filter((l) => l.QuoteId === quoteId);
export const linkedWorkOrdersOf = (quoteId: string) => org().Repair_Request__c.filter((rr) => rr.Quote__c === quoteId);

export async function changeStatus(id: string, status: string): Promise<string> {
	const record = quote(id);
	if (!record) throw new ApexError(`No quote ${id}`);
	const from = record.Status;
	if (from === status) return 'No change';
	record.Status = status;
	if (status === 'Presented' && !record.SentDate__c) record.SentDate__c = new Date().toISOString();
	return publishStatusChange(record, from);
}

/** Like the real org's quote clone: a new Draft quote with the same lines, no repair requests, and our id cleared. */
export async function cloneQuote(id: string): Promise<string> {
	const db = org();
	const source = quote(id);
	if (!source) throw new ApexError(`No quote ${id}`);
	const n = db.nextQuote++;
	const clone = {
		...structuredClone(source),
		Id: `0Q0TOY${String(n).padStart(10, '0')}AA`,
		QuoteNumber: `0000${1000 + n}`,
		Status: 'Draft',
		WeMaintain_Quote_ID__c: null,
		SentDate__c: null,
		CreatedDate: new Date().toISOString(),
		ContentDocumentLinks: null
	};
	db.Quote.push(clone);
	linesOf(id).forEach((line) => db.QuoteLineItem.push({ ...line, Id: newId(db, '0QL'), QuoteId: clone.Id }));
	await publishStatusChange(clone, '');
	return clone.Id;
}

/** QuoteStatusChangeEvent__e, published on insert (From__c empty) and on every status change. */
async function publishStatusChange(record: SObject, from: string): Promise<string> {
	const event = {
		topic: 'QuoteStatusChangeEvent__e',
		record: {
			QuoteId__c: record.Id,
			From__c: from,
			To__c: record.Status,
			EventType__c: 'quoteStatusChange',
			CreatedDate: new Date().toISOString()
		}
	};
	try {
		const response = await fetch(`${BACKEND}/salesforce/events`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(event)
		});
		const text = await response.text();
		console.log(`QuoteStatusChangeEvent__e ${record.Id} ${from || '∅'} → ${record.Status}: ${response.status} ${text}`);
		return response.ok ? `Event delivered to the backend` : `Backend answered ${response.status}: ${text}`;
	} catch (error) {
		console.log(`QuoteStatusChangeEvent__e ${record.Id}: backend unreachable (${error})`);
		return `Backend unreachable at ${BACKEND}`;
	}
}

export const lineSubtotal = (l: SObject) => l.UnitPrice * l.Quantity;
export const lineTotal = (l: SObject) => lineSubtotal(l) * (1 - (l.Discount ?? 0) / 100);

/** Subtotal before line discounts; GrandTotal (what the backend reads) after them, before VAT. */
function updateTotal(db: Org, quote: SObject) {
	const lines = db.QuoteLineItem.filter((l) => l.QuoteId === quote.Id);
	quote.Subtotal = lines.reduce((sum, l) => sum + lineSubtotal(l), 0);
	quote.GrandTotal = Math.round(lines.reduce((sum, l) => sum + lineTotal(l), 0) * 100) / 100;
}

// ---- editing quote lines by hand, as sales reps do ------------------------------------

export const pricebook = (id: string) => org().Pricebook2.find((pb) => pb.Id === id);
export const entriesOf = (pricebookId: string) => org().PricebookEntry.filter((e) => e.Pricebook2Id === pricebookId);
/** The first `limit` products by name, with their price in each pricebook, as the Products list view shows them. */
export const products = (limit = 50) => {
	const db = org();
	const byProduct = new Map<string, { product: SObject; pricebooks: { name: string; price: number }[] }>();
	for (const e of db.PricebookEntry) {
		const row = byProduct.get(e.Product2.Id) ?? byProduct.set(e.Product2.Id, { product: e.Product2, pricebooks: [] }).get(e.Product2.Id)!;
		row.pricebooks.push({ name: pricebook(e.Pricebook2Id)?.Name, price: e.UnitPrice });
	}
	const rows = [...byProduct.values()].sort((a, b) => a.product.Name.localeCompare(b.product.Name));
	return { total: rows.length, products: rows.slice(0, limit).map(({ product, pricebooks }): SObject => ({ ...product, pricebooks })) };
};

export interface LineFields {
	Quantity: number;
	UnitPrice: number;
	Cost__c: number | null;
	Discount: number | null;
	QuotePdf_ProductName__c?: string | null;
	Quote_Line_Description__c?: string | null;
}

/** Products of the quote's pricebook whose name matches, as the Add Product flow's search shows them. */
export function searchProducts(quoteId: string, term: string) {
	const record = quote(quoteId);
	if (!record || term.trim().length < 2) return [];
	const needle = term.trim().toLowerCase();
	return entriesOf(record.Pricebook2Id)
		.filter((e) => e.Product2.Name.toLowerCase().includes(needle))
		.slice(0, 50)
		.map((e) => ({ entryId: e.Id, name: e.Product2.Name, description: e.Product2.Description, salesPrice: e.UnitPrice }));
}

/**
 * The Add Product flow. With a product picked in step 1, it adds a line on it,
 * with optional PDF name and description overrides. Without one, it creates a new Product2 named as
 * typed (refusing a name that already exists), a pricebook entry for it, then the line.
 */
export function addProductLine(
	quoteId: string,
	input: { entryId: string | null; name: string; description: string | null; pdfName: string | null; pdfDescription: string | null } & LineFields
) {
	const db = org();
	const record = quote(quoteId);
	if (!record) throw new ApexError(`No quote ${quoteId}`);
	let entry = input.entryId ? db.PricebookEntry.find((e) => e.Id === input.entryId) : undefined;
	if (input.entryId && !entry) throw new ApexError('Unexpected error occurs : pricebook entry not found');
	if (!entry) {
		if (!input.name) throw new ApexError('Product Name: Complete this field.');
		if (db.PricebookEntry.some((e) => e.Product2.Name === input.name))
			throw new ApexError(`Product "${input.name}" already exists in Salesforce. Please select it from step 1.`);
		const product2 = { Id: newId(db, '01t'), Name: input.name, Description: input.description, StockKeepingUnit: null, Family: 'Repair', Source__c: 'Salesforce' };
		entry = { Id: newId(db, '01u'), Pricebook2Id: record.Pricebook2Id, UnitPrice: input.UnitPrice, CostPrice__c: input.Cost__c, Product2: product2 };
		db.PricebookEntry.push(entry);
	}
	db.QuoteLineItem.push({
		Id: newId(db, '0QL'),
		QuoteId: quoteId,
		PricebookEntryId: entry.Id,
		Product2: entry.Product2,
		Quantity: input.Quantity,
		UnitPrice: input.UnitPrice,
		Cost__c: input.Cost__c,
		Discount: input.Discount,
		QuotePdf_ProductName__c: input.entryId ? input.pdfName : null,
		Quote_Line_Description__c: input.entryId ? input.pdfDescription : null
	});
	updateTotal(db, record);
}

/** One line's record edit. */
export function updateLine(lineId: string, fields: LineFields) {
	const db = org();
	const line = db.QuoteLineItem.find((l) => l.Id === lineId);
	if (!line) throw new ApexError(`No quote line ${lineId}`);
	Object.assign(line, fields);
	updateTotal(db, quote(line.QuoteId)!);
}

/** "Edit All Quote Line Items": every row's cost, quantity, sales price and discount at once, plus the rows deleted there. */
export function saveAllLines(quoteId: string, rows: ({ Id: string } & LineFields)[], deletedIds: string[]) {
	const db = org();
	const record = quote(quoteId);
	if (!record) throw new ApexError(`No quote ${quoteId}`);
	for (const row of rows) {
		if (row.Cost__c == null || row.Quantity == null || row.UnitPrice == null) throw new ApexError('Required fields are missing: [Cost, Quantity, Sales Price]');
	}
	db.QuoteLineItem = db.QuoteLineItem.filter((l) => !deletedIds.includes(l.Id));
	for (const { Id, ...fields } of rows) Object.assign(db.QuoteLineItem.find((l) => l.Id === Id && l.QuoteId === quoteId) ?? {}, fields);
	updateTotal(db, record);
}

export function deleteLine(lineId: string) {
	const db = org();
	const line = db.QuoteLineItem.find((l) => l.Id === lineId);
	if (!line) throw new ApexError(`No quote line ${lineId}`);
	db.QuoteLineItem = db.QuoteLineItem.filter((l) => l.Id !== lineId);
	updateTotal(db, quote(line.QuoteId)!);
}
