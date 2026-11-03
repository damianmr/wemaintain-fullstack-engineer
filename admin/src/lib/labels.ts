import type { Item, ManualReason, QuoteFilter, QuoteStatus, WorkOrderState } from './types';

export type Theme = 'neutral' | 'success' | 'warning' | 'danger';

export const STATE: Record<WorkOrderState, [string, Theme]> = {
	PART_TO_ESTIMATE: ['Part to estimate', 'warning'],
	QUOTE_TO_SEND: ['Quote to send', 'danger'],
	QUOTE_TO_SIGN_BY_CUSTOMER: ['Quote to sign', 'neutral'],
	QUOTE_TO_VERIFY_PO: ['Verify client PO', 'danger'],
	WORK_TO_DO: ['Work to do', 'neutral'],
	DONE: ['Done', 'success'],
	DENIED: ['Denied', 'danger'],
	CANCELLED: ['Cancelled', 'neutral']
};

export const URGENCY: Record<string, string> = { URGENT: '!!!', IN_THE_WEEK: '!!', FOR_THE_NEXT_VISIT: '!' };

const QUOTE: Record<QuoteStatus, [string, Theme]> = {
	DRAFT: ['Quote to be sent', 'danger'],
	TO_SIGN: ['Quote sent', 'neutral'],
	VALIDATION: ['Verify client PO', 'danger'],
	SIGNED: ['Quote accepted', 'success'],
	WORKS_IN_PROGRESS: ['Quote accepted', 'success'],
	TO_BE_BILLED: ['Quote to be billed', 'success'],
	BILLED: ['Quote done', 'success'],
	REFUSED: ['Quote denied', 'danger']
};

/** Before a quote exists, the pill depends on whether every part has a cost. */
export function quoteStatusPill(status: QuoteStatus | null | undefined, items: Item[]): [string, Theme] {
	if (status) return QUOTE[status];
	const priced = items.filter((i) => i.type === 'PART' || i.type === 'EXTERNAL_PART').every((i) => i.price != null);
	return priced ? QUOTE.DRAFT : ['Waiting for part cost', 'warning'];
}

/** The old way: a Salesforce quote made with Generate or Attach, not from a quote draft. */
export const QUOTE_FILTER: Record<QuoteFilter, string> = {
	NO_QUOTE: 'No quote yet',
	IN_QUOTE_DRAFT: 'Priced with the contract list',
	OLD_WAY_DRAFT: 'Old quote, can be adopted',
	OLD_WAY_PAST_DRAFT: 'Old quote, already sent'
};

export const TABS = {
	ongoing: ['PART_TO_ESTIMATE', 'QUOTE_TO_SEND', 'QUOTE_TO_SIGN_BY_CUSTOMER', 'QUOTE_TO_VERIFY_PO', 'WORK_TO_DO'],
	done: ['DONE'],
	denied: ['DENIED'],
	cancelled: ['CANCELLED']
} satisfies Record<string, WorkOrderState[]>;

export const isEditable = (state: WorkOrderState) => !['DONE', 'CANCELLED', 'DENIED'].includes(state);

export const PAGE_SIZE = 30;

/** How a repair item reads in a list: its part, its free-text name, or its kind. */
export const itemLabel = (item: Item) =>
	(item.type === 'PART' ? item.part?.name : item.type === 'EXTERNAL_PART' ? item.description : item.type === 'MAN_HOUR' ? 'Labour (hours)' : 'Installation') ?? '';

/** Why a line does not take its price from the contract list. IMPORTED is set by adopting a quote, not picked. */
export const MANUAL_REASON: Record<ManualReason, string> = {
	PART_NOT_ON_LIST: 'Part not on the list',
	SUBCONTRACTED_WORK: 'Subcontracted work',
	NEGOTIATED_PRICE: 'Negotiated price',
	IMPORTED: 'Imported from the existing quote',
	OTHER: 'Other'
};
