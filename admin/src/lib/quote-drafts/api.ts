import { gql } from '../graphql.ts';
import type { DraftCandidate, NewContractLine, NewManualLine, PriceListSearch, WorkOrder } from '../types.ts';

/** What the card reads about a work order's draft: asked for with the work order itself. */
export const QUOTE_DRAFT = `
	contractPricing { contractId contractNo priceList { id name currency } }
	quoteDraft {
		id contractNo priceListId priceListName currency status editable sendBlockers sfQuoteId sfQuoteLink quoteNumber total
		workOrders { id workOrderNumber state deviceNo buildingName items { id type partId part { id sku name } quantity description } }
		lines { id kind code customerText bandLabel unit quantity unitPrice total reason note ruleCode coverage { itemId workOrderNumber quantity } }
	}`;

export const startDraft = (workOrder: WorkOrder) =>
	gql(`mutation StartDraft($workOrderId: ID!) { startQuoteDraft(workOrderId: $workOrderId) { id } }`, { workOrderId: workOrder.id });

export const findWorkOrdersToAdd = (draftId: string) =>
	gql<{ draftCandidates: DraftCandidate[] }>(
		`query Candidates($draftId: ID!) { draftCandidates(draftId: $draftId) { id workOrderNumber title state deviceNo buildingName } }`,
		{ draftId }
	).then((data) => data.draftCandidates);

export const addWorkOrders = (draftId: string, workOrderIds: string[]) =>
	gql(`mutation AddWorkOrders($draftId: ID!, $workOrderIds: [ID!]!) { addWorkOrdersToDraft(draftId: $draftId, workOrderIds: $workOrderIds) { id } }`, {
		draftId,
		workOrderIds
	});

export const removeWorkOrder = (draftId: string, workOrderId: string) =>
	gql(`mutation RemoveWorkOrder($draftId: ID!, $workOrderId: ID!) { removeWorkOrderFromDraft(draftId: $draftId, workOrderId: $workOrderId) { id } }`, {
		draftId,
		workOrderId
	});

export const searchPriceList = (priceListId: string, search: string) =>
	gql<{ priceListSearch: PriceListSearch }>(
		`query SearchPriceList($priceListId: ID!, $search: String) {
			priceListSearch(priceListId: $priceListId, search: $search) {
				entries { id code section wording unit notes pickable rates { id amount band { id code label timeWindow } } }
				rules { id code kind value description appliesTo }
			}
		}`,
		{ priceListId, search }
	).then((data) => data.priceListSearch);

export const addContractLine = (draftId: string, line: NewContractLine) =>
	gql(`mutation AddContractLine($input: ContractLineInput!) { addContractLine(input: $input) { id } }`, { input: { draftId, ...line } });

export const addManualLine = (draftId: string, line: NewManualLine) =>
	gql(`mutation AddManualLine($input: ManualLineInput!) { addManualLine(input: $input) { id } }`, { input: { draftId, ...line } });

export const removeLine = (draftId: string, lineId: string) =>
	gql(`mutation RemoveLine($draftId: ID!, $lineId: ID!) { removeDraftLine(draftId: $draftId, lineId: $lineId) { id } }`, { draftId, lineId });

/** Creates the Salesforce quote with the draft's lines, or replaces its lines. Returns the quote's page. */
export const sendDraft = (draftId: string) =>
	gql<{ sendQuoteDraft: { sfQuoteLink: string | null } }>(`mutation SendDraft($draftId: ID!) { sendQuoteDraft(draftId: $draftId) { sfQuoteLink } }`, {
		draftId
	}).then((data) => data.sendQuoteDraft.sfQuoteLink);

/** Takes over the work order's Draft quote made the old way. */
export const adoptQuote = (workOrder: WorkOrder) =>
	gql(`mutation AdoptQuote($workOrderId: ID!) { adoptQuote(workOrderId: $workOrderId) { id } }`, { workOrderId: workOrder.id });
