// Fake quote drafts, kept in the browser, to click through the screen before the backend exists.
// Same function names as the real API that replaces this file.
import type { ContractPricing, QuoteDraft, QuoteDraftLine, WorkOrder } from '../types.ts';

const PRICE_LISTS: Record<string, ContractPricing['priceList']> = {
	'00019814': { id: 'lindenhome', name: 'Lindenhome AL', currency: 'EUR' },
	'00016840': { id: 'lindenhome', name: 'Lindenhome AL', currency: 'EUR' },
	'00018461': { id: 'meridian', name: 'Meridian Table A', currency: 'SGD' },
	'00016613': { id: 'meridian', name: 'Meridian Table A', currency: 'SGD' },
	'00014296': { id: 'meridian', name: 'Meridian Table A', currency: 'SGD' },
	'00016179': { id: 'meridian', name: 'Meridian Table A', currency: 'SGD' }
};

const drafts = $state<Record<string, QuoteDraft>>({});

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
