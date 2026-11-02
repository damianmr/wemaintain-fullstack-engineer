export type WorkOrderState =
	| 'PART_TO_ESTIMATE'
	| 'QUOTE_TO_SEND'
	| 'QUOTE_TO_SIGN_BY_CUSTOMER'
	| 'QUOTE_TO_VERIFY_PO'
	| 'WORK_TO_DO'
	| 'DONE'
	| 'DENIED'
	| 'CANCELLED';

export type QuoteStatus = 'DRAFT' | 'TO_SIGN' | 'VALIDATION' | 'SIGNED' | 'WORKS_IN_PROGRESS' | 'TO_BE_BILLED' | 'BILLED' | 'REFUSED';

export type ItemType = 'PART' | 'MAN_HOUR' | 'EXTERNAL_PART' | 'TECH_SUPPORT' | 'INSTALLATION';

export interface Part {
	id: string;
	sku: string;
	name: string;
	brand: string | null;
	averageCost: number | null;
}

export interface Item {
	id: string;
	type: ItemType;
	partId: string | null;
	part: Part | null;
	quantity: number | null;
	description: string | null;
	comment: string | null;
	/** What the item costs us. */
	price: number | null;
	sellPrice: number | null;
}

export interface Device {
	id: string;
	deviceNo: string;
	building: { id: string; name: string; city: string; countryCode: string; customer: { companyName: string } };
	contracts: { contract: { contractNo: string; type: string } }[];
}

export interface Quote {
	id: string;
	reference: string;
	number: string;
	status: QuoteStatus;
	grandTotal: number;
	currencyISOCode: string;
	emittedDate: string;
	description: string | null;
	accountName: string | null;
	documentAvailable: boolean;
}

export interface WorkOrder {
	id: string;
	workOrderNumber: string;
	workOrderType: string;
	urgencyLevel: string;
	state: WorkOrderState;
	title: string | null;
	description: string;
	isChargeable: boolean;
	createdAt: string;
	sfQuoteId: string | null;
	sfQuoteLink: string | null;
	quoteNumber: string | null;
	quoteStatus: QuoteStatus | null;
	quote: Quote | null;
	bundledWorkOrders: { id: string; workOrderNumber: string; device: { deviceNo: string } | null }[];
	device: Device | null;
	items: Item[];
}

/** The price list that applies to a work order's contract, if C1 has linked one. */
export interface ContractPricing {
	contractId: string;
	contractNo: string;
	priceList: { id: string; name: string; currency: string };
}

export type DraftLineKind = 'CONTRACT' | 'MANUAL';

export type ManualReason = 'PART_NOT_ON_LIST' | 'SUBCONTRACTED_WORK' | 'NEGOTIATED_PRICE' | 'IMPORTED' | 'OTHER';

export interface CoveredItem {
	itemId: string;
	workOrderNumber: string;
	quantity: number;
}

export interface QuoteDraftLine {
	id: string;
	kind: DraftLineKind;
	/** The contract code: 0435AS, or 65 for a Meridian SOR item. */
	code: string | null;
	/** What the customer reads on the quote. */
	customerText: string;
	bandLabel: string | null;
	unit: string | null;
	quantity: number;
	unitPrice: number;
	total: number;
	reason: ManualReason | null;
	note: string | null;
	ruleCode: string | null;
	coverage: CoveredItem[];
}

export interface QuoteDraftWorkOrder {
	id: string;
	workOrderNumber: string;
	state: WorkOrderState;
	deviceNo: string;
	buildingName: string;
	items: Item[];
}

export interface QuoteDraft {
	id: string;
	contractNo: string;
	priceListName: string;
	currency: string;
	status: 'OPEN' | 'SENT';
	editable: boolean;
	/** Why the draft cannot be sent yet. Empty when it can. */
	sendBlockers: string[];
	sfQuoteId: string | null;
	sfQuoteLink: string | null;
	quoteNumber: string | null;
	workOrders: QuoteDraftWorkOrder[];
	lines: QuoteDraftLine[];
	total: number;
}

export interface PriceListBand {
	id: string;
	code: string;
	label: string;
	timeWindow: string;
}

export interface PriceListRate {
	id: string;
	amount: number;
	/** Empty when the list has no time bands, like Lindenhome's. */
	band: PriceListBand | null;
}

export interface PriceListEntry {
	id: string;
	code: string;
	section: string;
	wording: string;
	unit: string | null;
	notes: string | null;
	/** False when the list leaves something to confirm, such as a missing unit. */
	pickable: boolean;
	rates: PriceListRate[];
}

/** A rule printed in the list, not a price: a multiplier, a volume discount, an adjustment. */
export interface PriceListRule {
	id: string;
	code: string | null;
	kind: 'INVOICE_MULTIPLIER' | 'QUANTITY_DISCOUNT' | 'STAR_RATES_ADJUSTMENT';
	value: number;
	description: string;
	appliesTo: string;
}

export interface PriceListSearch {
	entries: PriceListEntry[];
	rules: PriceListRule[];
}

export interface NewContractLine {
	rateId: string;
	quantity: number;
	coverage: { itemId: string; quantity: number }[];
}

export interface NewManualLine {
	customerText: string;
	quantity: number;
	unitPrice: number;
	reason: ManualReason;
	note: string;
	/** The contract rule the CSM followed, such as 0097AS. */
	ruleId: string | null;
}

/** A work order the CSM can bring into a draft: same contract, chargeable, no quote, no draft. */
export interface DraftCandidate {
	id: string;
	workOrderNumber: string;
	/** The title, or the description when there is no title. */
	title: string;
	state: WorkOrderState;
	deviceNo: string;
	buildingName: string;
}
