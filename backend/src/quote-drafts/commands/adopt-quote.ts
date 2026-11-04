import type { Deps } from '../../shared/boilerplate/deps'
import { findContractPricing } from '../../price-lists/queries/find-contract-pricing'
import { QuoteStatus } from '../../quotes/domain/quote'
import { WorkOrderNotEligibleError } from '../domain/errors'
import { QuoteDraft } from '../domain/quote-draft'
import { toDraftWorkOrder } from '../infrastructure/draft-work-orders'

interface SalesforceLine {
  Quantity: number
  UnitPrice: number
  Discount: number | null
  QuotePdf_ProductName__c: string | null
  Quote_Line_Description__c: string | null
  Product2: { Name: string } | null
}

/**
 * Takes over a Draft quote made the old way, so it can be priced from the contract list. Its work orders join the
 * draft, and its lines come in as manual lines for the CSM to review. Sending then updates that same quote.
 */
export async function adoptQuote(input: { workOrderId: string }, deps: Pick<Deps, 'db' | 'workOrders' | 'quoteDrafts' | 'salesforce'>): Promise<QuoteDraft> {
  const workOrder = await deps.workOrders.load(input.workOrderId)
  if (!workOrder.sfQuoteId || workOrder.quoteStatus !== QuoteStatus.DRAFT) {
    throw new WorkOrderNotEligibleError(`${workOrder.workOrderNumber} has no Salesforce quote in Draft to adopt`)
  }
  if (await deps.quoteDrafts.findBySalesforceQuote(workOrder.sfQuoteId)) throw new WorkOrderNotEligibleError('This quote already has a quote draft')
  const pricingDate = new Date()
  const pricing = await findContractPricing({ deviceId: workOrder.deviceId, on: pricingDate }, deps)
  if (!pricing) throw new WorkOrderNotEligibleError(`${workOrder.workOrderNumber}'s contract has no price list`)

  const onQuote = await deps.workOrders.find({ sfQuoteIds: [workOrder.sfQuoteId] })
  const ordered = [workOrder, ...onQuote.filter((wo) => wo.id !== workOrder.id)]
  const lines = await deps.salesforce.query<SalesforceLine>(
    `SELECT Id, Quantity, UnitPrice, Discount, QuotePdf_ProductName__c, Quote_Line_Description__c, Product2.Name FROM QuoteLineItem WHERE QuoteId = '${workOrder.sfQuoteId}'`,
  )

  const draft = QuoteDraft.adopt({
    contractId: pricing.contractId,
    priceListId: pricing.priceList.id,
    currency: pricing.priceList.currency,
    sfQuoteId: workOrder.sfQuoteId,
    workOrders: await Promise.all(ordered.map((wo) => toDraftWorkOrder(wo, pricingDate, deps))),
    lines: lines.map((line) => ({
      customerText: [line.QuotePdf_ProductName__c || line.Product2?.Name, line.Quote_Line_Description__c].filter(Boolean).join(': '),
      quantity: line.Quantity,
      // A draft line has no discount: keep the price the customer was going to pay, and say where it came from.
      unitPrice: line.Discount ? Math.round(line.UnitPrice * (100 - line.Discount)) / 100 : line.UnitPrice,
      note: line.Discount ? `Imported from the existing Salesforce quote: ${line.UnitPrice} with a ${line.Discount}% discount` : undefined,
    })),
  })
  return deps.quoteDrafts.save(draft)
}
