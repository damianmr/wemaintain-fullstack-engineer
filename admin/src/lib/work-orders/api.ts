import { gql } from '../graphql.ts';
import { QUOTE_DRAFT } from '../quote-drafts/api.ts';
import type { Part, QuoteFilter, WorkOrder, WorkOrderState } from '../types.ts';

const DEVICE = `device {
	id deviceNo
	building { id name city countryCode customer { companyName } }
	contracts { contract { contractNo type } }
}`;

export const listWorkOrders = (
	variables: { states: WorkOrderState[]; search?: string; withPriceList?: boolean; chargeable?: boolean; quote?: QuoteFilter; limit: number; offset: number },
	fetcher?: typeof fetch
) =>
	gql<{ workOrders: { totalCount: number; items: WorkOrder[] } }>(
		`query WorkOrders($states: [WorkOrderState!], $search: String, $withPriceList: Boolean, $chargeable: Boolean, $quote: QuoteFilter, $limit: Int, $offset: Int) {
			workOrders(states: $states, search: $search, withPriceList: $withPriceList, chargeable: $chargeable, quote: $quote, limit: $limit, offset: $offset) {
				totalCount
				items { id workOrderNumber title state urgencyLevel createdAt quoteNumber quoteStatus quoteDraftId ${DEVICE} }
			}
		}`,
		variables,
		fetcher
	).then((data) => data.workOrders);

export const getWorkOrder = (id: string, fetcher?: typeof fetch) =>
	gql<{ workOrder: WorkOrder | null }>(
		`query WorkOrder($id: ID!) {
			workOrder(id: $id) {
				id workOrderNumber workOrderType urgencyLevel state title description isChargeable createdAt
				sfQuoteId sfQuoteLink quoteNumber quoteStatus
				# Read live from Salesforce by the backend.
				quote { id reference number status grandTotal currencyISOCode emittedDate description accountName documentAvailable }
				bundledWorkOrders { id workOrderNumber device { deviceNo } }
				${DEVICE}
				items { id type partId part { id sku name brand averageCost } quantity description comment price sellPrice }
				${QUOTE_DRAFT}
			}
		}`,
		{ id },
		fetcher
	).then((data) => data.workOrder);

/** Work orders in the same building that sit on a draft quote: the quotes this one can be bundled with. */
export const findDraftQuotesInBuilding = (buildingId: string) =>
	gql<{ workOrders: { items: WorkOrder[] } }>(
		`query Bundles($buildingId: ID!) {
			workOrders(buildingId: $buildingId, states: [QUOTE_TO_SEND], limit: 200) {
				items { id workOrderNumber title sfQuoteId sfQuoteLink quoteNumber quoteStatus device { deviceNo } }
			}
		}`,
		{ buildingId }
	).then((data) => data.workOrders.items.filter((wo) => wo.sfQuoteId && wo.quoteStatus === 'DRAFT'));

export const findParts = (search: string) =>
	gql<{ parts: Part[] }>(`query Parts($search: String) { parts(search: $search, limit: 20) { id sku name brand averageCost } }`, { search }).then(
		(data) => data.parts
	);

export const addItem = (input: Record<string, unknown>) =>
	gql(`mutation AddItem($input: AddItemInput!) { addItem(input: $input) { id } }`, { input });

export const updateItem = (input: { workOrderId: string; itemId: string; quantity?: number; price?: number }) =>
	gql(`mutation UpdateItem($input: UpdateItemInput!) { updateItem(input: $input) { id } }`, { input });

export const assignCataloguePart = (workOrderId: string, itemId: string, partId: string) =>
	gql(
		`mutation AssignCataloguePart($workOrderId: ID!, $itemId: ID!, $partId: ID!) {
			assignCataloguePart(workOrderId: $workOrderId, itemId: $itemId, partId: $partId) { id }
		}`,
		{ workOrderId, itemId, partId }
	);

export const removeItem = (workOrderId: string, itemId: string) =>
	gql(`mutation RemoveItem($workOrderId: ID!, $itemId: ID!) { removeItem(workOrderId: $workOrderId, itemId: $itemId) { id } }`, {
		workOrderId,
		itemId
	});

/** Creates the Salesforce quote, or (with sfQuoteId) adds the work orders to that draft quote. */
export const pushQuoteToSalesforce = (workOrderIds: string[], sfQuoteId?: string) =>
	gql<{ pushQuoteToSalesforce: { id: string; sfQuoteLink: string | null }[] }>(
		`mutation PushQuote($workOrderIds: [ID!]!, $sfQuoteId: String) {
			pushQuoteToSalesforce(workOrderIds: $workOrderIds, sfQuoteId: $sfQuoteId) { id sfQuoteLink }
		}`,
		{ workOrderIds, sfQuoteId }
	).then((data) => data.pushQuoteToSalesforce);
