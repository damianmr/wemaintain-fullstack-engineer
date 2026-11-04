import type { Deps } from '../../shared/boilerplate/deps'
import { WorkOrderNotEligibleError } from '../domain/errors'
import { QuoteDraft } from '../domain/quote-draft'
import { loadDraftWorkOrders } from '../infrastructure/draft-work-orders'
import { draftQuoteStatus } from '../infrastructure/draft-quote-status'

export async function addWorkOrdersToDraft(
  input: { draftId: string; workOrderIds: string[] },
  deps: Pick<Deps, 'db' | 'workOrders' | 'quoteDrafts'>,
): Promise<QuoteDraft> {
  const draft = await deps.quoteDrafts.load(input.draftId)
  draft.assertEditable(await draftQuoteStatus(draft, deps))
  for (const workOrder of await loadDraftWorkOrders(input.workOrderIds, draft.pricingDate, deps)) {
    const other = await deps.quoteDrafts.findByWorkOrder(workOrder.id)
    if (other && other.id !== draft.id) throw new WorkOrderNotEligibleError(`${workOrder.workOrderNumber} is already in another quote draft`)
    draft.addWorkOrder(workOrder)
  }
  return deps.quoteDrafts.save(draft)
}
