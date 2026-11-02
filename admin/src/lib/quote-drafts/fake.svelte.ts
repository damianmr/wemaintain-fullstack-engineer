// Fake quote drafts, kept in the browser, to click through the screen before the backend exists.
// Same function names as the real API that replaces this file.
import type { ContractPricing, NewContractLine, NewManualLine, PriceListEntry, PriceListRule, PriceListSearch, QuoteDraft, QuoteDraftLine, WorkOrder } from '../types.ts';

const PRICE_LISTS: Record<string, ContractPricing['priceList']> = {
	'00019814': { id: 'lindenhome', name: 'Lindenhome AL', currency: 'EUR' },
	'00016840': { id: 'lindenhome', name: 'Lindenhome AL', currency: 'EUR' },
	'00018461': { id: 'meridian', name: 'Meridian Table A', currency: 'SGD' },
	'00016613': { id: 'meridian', name: 'Meridian Table A', currency: 'SGD' },
	'00014296': { id: 'meridian', name: 'Meridian Table A', currency: 'SGD' },
	'00016179': { id: 'meridian', name: 'Meridian Table A', currency: 'SGD' }
};

const MERIDIAN_BANDS = [
	{ id: 'office', code: 'OFFICE', label: 'Office hours', timeWindow: 'Mon–Fri 08:30–18:00, Sat 08:30–13:30' },
	{ id: 'after-hours', code: 'AFTER_HOURS', label: 'After office hours', timeWindow: 'Mon–Fri 18:01–08:29, Sat 00:01–08:29' },
	{ id: 'weekend', code: 'WEEKEND_HOLIDAY', label: 'Saturday afternoon, Sunday and public holidays', timeWindow: 'Sat 13:31–midnight, Sunday, public holidays' }
];

const entry = (code: string, section: string, wording: string, unit: string | null, notes: string | null, amounts: number[]): PriceListEntry => ({
	id: code,
	code,
	section,
	wording,
	unit,
	notes,
	pickable: unit !== null,
	rates: amounts.map((amount, i) => ({ id: `${code}-${i}`, amount, band: amounts.length > 1 ? MERIDIAN_BANDS[i] : null }))
});

// A few rows of each real list, enough to click through.
const ENTRIES: Record<string, PriceListEntry[]> = {
	lindenhome: [
		entry('0001AS', 'HOURLY RATE', 'Hourly rate (travel included)', 'h', null, [103.72]),
		entry('0002AS', 'HOURLY RATE', 'Surcharged hourly rate (travel included)', 'h', 'night (midnight - 6am), Sunday, public holiday', [108.97]),
		entry('0090AS', 'CAR', 'Car push-button box, base 6 levels', 'each', 'voice announcer + position indicator + remote alarm pre-wiring', [4558.3]),
		entry('0095AS', 'CAR', 'Replacement of the car push-button box - supplement or deduction per additional level', 'per level', 'supplement or deduction on code 0090AS', [171.81]),
		entry('0430AS', 'CAR', 'Installation of a GSM gateway on the existing remote alarm', 'each', null, [533.43]),
		entry('0435AS', 'CAR', 'Remote alarm replacement incl. three-way intercom and GSM gateway', 'each', null, [1360]),
		entry('6056AS', 'COMPLETE LIFT REPLACEMENT', 'Supply and installation of a lift, 6 levels served, speed above 1 m/s and below 2 m/s', null, 'rated load <= 450 kg speed > 1m/s', [94168])
	],
	meridian: [
		entry('1', 'Table A', 'ARD Battery 65AH - 4 x 12 AH', 'Per Set', null, [588, 705, 705]),
		entry('38', 'Table A', 'Escalator Step Chain', 'Per Escalator', null, [20247, 23774, 23774]),
		entry('65', 'Table A', 'Standby technician', 'Per Man-hr', null, [111, 167, 222]),
		entry('67', 'Table A', 'Lift No Load Testing', 'Per test', null, [392, 392, 392])
	]
};

const RULES: Record<string, PriceListRule[]> = {
	lindenhome: [
		{ id: '0097AS', code: '0097AS', kind: 'INVOICE_MULTIPLIER', value: 1.41, description: 'Coefficient on a part not on the price list', appliesTo: "the supplier's invoice (to be provided)" },
		{ id: '5600AS', code: '5600AS', kind: 'QUANTITY_DISCOUNT', value: 6, description: 'Unit discount for an order of 11 to 50 units of the same part reference', appliesTo: 'units of the same part reference, 11 to 50' }
	],
	meridian: [{ id: 'star-rates', code: null, kind: 'STAR_RATES_ADJUSTMENT', value: 10, description: 'Star Rates: percentage adjustment to Star Rate items', appliesTo: 'agreed rates for work Table A does not list' }]
};

const drafts = $state<Record<string, QuoteDraft>>({});
const listOf = (draft: QuoteDraft) => (draft.currency === 'SGD' ? 'meridian' : 'lindenhome');

export function contractPricingOf(workOrder: WorkOrder): ContractPricing | null {
	for (const { contract } of workOrder.device?.contracts ?? []) {
		const priceList = PRICE_LISTS[contract.contractNo];
		if (priceList) return { contractId: contract.contractNo, contractNo: contract.contractNo, priceList };
	}
	return null;
}

export function quoteDraftOf(workOrder: WorkOrder): QuoteDraft | null {
	return Object.values(drafts).find((draft) => draft.workOrders.some((wo) => wo.id === workOrder.id)) ?? null;
}

export async function startDraft(workOrder: WorkOrder) {
	const pricing = contractPricingOf(workOrder)!;
	const id = crypto.randomUUID();
	drafts[id] = refresh({
		id,
		contractNo: pricing.contractNo,
		priceListName: pricing.priceList.name,
		currency: pricing.priceList.currency,
		status: 'OPEN',
		editable: true,
		sendBlockers: [],
		sfQuoteId: null,
		sfQuoteLink: null,
		quoteNumber: null,
		workOrders: [toDraftWorkOrder(workOrder)],
		lines: [],
		total: 0
	});
}

export async function searchPriceList(draftId: string, search: string): Promise<PriceListSearch> {
	const list = listOf(drafts[draftId]);
	const matches = (text: string) => text.toLowerCase().includes(search.trim().toLowerCase());
	return {
		entries: ENTRIES[list].filter((e) => matches(`${e.code} ${e.wording} ${e.section}`)),
		rules: RULES[list].filter((r) => matches(`${r.code ?? ''} ${r.description}`))
	};
}

export async function addContractLine(draftId: string, line: NewContractLine) {
	const draft = drafts[draftId];
	const list = listOf(draft);
	const entry = ENTRIES[list].find((e) => e.rates.some((r) => r.id === line.rateId))!;
	const rate = entry.rates.find((r) => r.id === line.rateId)!;
	const items = draft.workOrders.flatMap((wo) => wo.items.map((item) => ({ item, workOrderNumber: wo.workOrderNumber })));
	draft.lines.push({
		id: crypto.randomUUID(),
		kind: 'CONTRACT',
		code: entry.code,
		customerText: [`${entry.code} ${entry.wording}`, entry.unit, rate.band?.label.toLowerCase()].filter(Boolean).join(', '),
		bandLabel: rate.band?.label ?? null,
		unit: entry.unit,
		quantity: line.quantity,
		unitPrice: rate.amount,
		total: Math.round(rate.amount * line.quantity * 100) / 100,
		reason: null,
		note: null,
		ruleCode: null,
		coverage: line.coverage.map((c) => ({ ...c, workOrderNumber: items.find((i) => i.item.id === c.itemId)!.workOrderNumber }))
	});
	refresh(draft);
}

export async function addManualLine(draftId: string, line: NewManualLine) {
	const draft = drafts[draftId];
	draft.lines.push({
		id: crypto.randomUUID(),
		kind: 'MANUAL',
		code: null,
		customerText: line.customerText,
		bandLabel: null,
		unit: null,
		quantity: line.quantity,
		unitPrice: line.unitPrice,
		total: Math.round(line.unitPrice * line.quantity * 100) / 100,
		reason: line.reason,
		note: line.note || null,
		ruleCode: RULES[listOf(draft)].find((r) => r.id === line.ruleId)?.code ?? null,
		coverage: []
	});
	refresh(draft);
}

export async function removeLine(draftId: string, lineId: string) {
	const draft = drafts[draftId];
	draft.lines = draft.lines.filter((line) => line.id !== lineId);
	refresh(draft);
}

function toDraftWorkOrder(workOrder: WorkOrder) {
	return {
		id: workOrder.id,
		workOrderNumber: workOrder.workOrderNumber,
		state: workOrder.state,
		deviceNo: workOrder.device?.deviceNo ?? '',
		buildingName: workOrder.device?.building.name ?? '',
		items: workOrder.items.filter((item) => item.type !== 'TECH_SUPPORT')
	};
}

/** What the backend will compute: the total, and why the draft cannot be sent yet. */
function refresh(draft: QuoteDraft): QuoteDraft {
	draft.total = draft.lines.reduce((sum, line: QuoteDraftLine) => sum + line.total, 0);
	draft.sendBlockers = [
		...(draft.lines.length ? [] : ['Add at least one line.']),
		...draft.workOrders
			.filter((wo) => wo.state === 'PART_TO_ESTIMATE' || wo.items.some((item) => item.type === 'EXTERNAL_PART' && !item.partId))
			.map((wo) => `${wo.workOrderNumber} is waiting for the supply team to identify its parts.`)
	];
	return draft;
}
