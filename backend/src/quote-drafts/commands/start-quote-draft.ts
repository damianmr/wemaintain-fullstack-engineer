import type { Deps } from '../../shared/boilerplate/deps'
import { findContractPricing } from '../../price-lists/queries/find-contract-pricing'
import { WorkOrderNotEligibleError } from '../domain/errors'
import { QuoteDraft } from '../domain/quote-draft'
import { toDraftWorkOrder } from '../infrastructure/draft-work-orders'

/** Starts a quote draft from a work order whose contract has a price list. */
export async function startQuoteDraft(input: { workOrderId: string }, deps: Pick<Deps, 'db' | 'workOrders' | 'quoteDrafts'>): Promise<QuoteDraft> {
  const workOrder = await deps.workOrders.load(input.workOrderId)
  if (await deps.quoteDrafts.findByWorkOrder(workOrder.id)) throw new WorkOrderNotEligibleError(`${workOrder.workOrderNumber} is already in a quote draft`)
  const pricingDate = new Date()
  const pricing = await findContractPricing({ deviceId: workOrder.deviceId, on: pricingDate }, deps)
  if (!pricing) throw new WorkOrderNotEligibleError(`${workOrder.workOrderNumber}'s contract has no price list: use the Salesforce quote buttons`)

  const draft = QuoteDraft.start({
    contractId: pricing.contractId,
    priceListId: pricing.priceList.id,
    currency: pricing.priceList.currency,
    workOrder: await toDraftWorkOrder(workOrder, pricingDate, deps),
    pricingDate,
  })
  return deps.quoteDrafts.save(draft)
}
