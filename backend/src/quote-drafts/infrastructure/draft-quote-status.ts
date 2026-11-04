import type { Deps } from '../../shared/boilerplate/deps'
import { QuoteStatus } from '../../quotes/domain/quote'
import { QuoteDraft } from '../domain/quote-draft'

/** The status of the draft's Salesforce quote, as the status events left it on its work orders. */
export async function draftQuoteStatus(draft: QuoteDraft, deps: Pick<Deps, 'workOrders'>): Promise<QuoteStatus | null> {
  if (!draft.sfQuoteId) return null
  const [workOrder] = await deps.workOrders.find({ ids: draft.workOrderIds.slice(0, 1) })
  return workOrder?.quoteStatus ?? null
}
