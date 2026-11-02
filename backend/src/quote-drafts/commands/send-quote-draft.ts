import type { Deps } from '../../shared/boilerplate/deps'
import { QuoteStatus } from '../../quotes/domain/quote'
import { QuoteStatusesSF, QuoteStatusesSFtoDomain } from '../../quotes/infrastructure/salesforce/quote-status'
import { DraftNotReadyError } from '../domain/errors'
import { QuoteDraft } from '../domain/quote-draft'
import { draftQuoteStatus } from '../infrastructure/draft-quote-status'
import { loadDraftWorkOrders } from '../infrastructure/draft-work-orders'
import { CONTRACT_LINE_SKU } from '../infrastructure/salesforce/contract-line-product'

/**
 * Creates the Salesforce quote with exactly the draft's lines, or replaces the lines of the quote it already has.
 * Lines are never merged: each keeps its own price and customer text.
 */
export async function sendQuoteDraft(input: { draftId: string }, deps: Pick<Deps, 'db' | 'workOrders' | 'quoteDrafts' | 'salesforce'>): Promise<QuoteDraft> {
  const draft = await deps.quoteDrafts.load(input.draftId)
  draft.assertEditable(await draftQuoteStatus(draft, deps))
  const blockers = draft.sendBlockers(await loadDraftWorkOrders(draft.workOrderIds, draft.pricingDate, deps))
  if (blockers.length) throw new DraftNotReadyError(blockers.join(' '))

  const workOrders = await deps.workOrders.find({ ids: draft.workOrderIds })
  const first = workOrders.find((wo) => wo.id === draft.workOrderIds[0])!
  const quote = await deps.salesforce.sendQuote({
    ...(draft.sfQuoteId && { quoteId: draft.sfQuoteId }),
    deviceIds: [first, ...workOrders.filter((wo) => wo !== first)].map((wo) => wo.deviceId),
    rrIds: draft.workOrderIds,
    quoteDescription: first.description,
    products: draft.lines.map((line) => ({
      sku: CONTRACT_LINE_SKU,
      quantity: line.quantity,
      price: line.unitPrice,
      cost: null,
      productName: line.customerText,
      lineId: line.id,
    })),
  })

  const status = QuoteStatusesSFtoDomain[quote.quoteStatus as QuoteStatusesSF] ?? QuoteStatus.DRAFT
  for (const workOrder of workOrders) {
    workOrder.attachQuote(quote.quoteId, status)
    await deps.workOrders.save(workOrder)
  }
  draft.markSent(quote.quoteId)
  return deps.quoteDrafts.save(draft)
}
