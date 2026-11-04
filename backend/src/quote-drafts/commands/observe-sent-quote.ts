import type { Deps } from '../../shared/boilerplate/deps'
import { observeSentLines, SentLine } from '../domain/sent-lines'
import { QuoteDraftObservationOrmEntity } from '../infrastructure/database/quote-draft-observation.orm-entity'

interface SalesforceLine {
  Quantity: number
  UnitPrice: number
  Discount: number | null
  WeMaintain_Line_ID__c: string | null
}

/** When a draft's quote is presented to the customer, records which contract lines reached it at the list price. */
export async function observeSentQuote(input: { sfQuoteId: string }, deps: Pick<Deps, 'db' | 'quoteDrafts' | 'salesforce'>): Promise<void> {
  const draft = await deps.quoteDrafts.findBySalesforceQuote(input.sfQuoteId)
  if (!draft) return
  const lines = await deps.salesforce.query<SalesforceLine>(
    `SELECT Id, Quantity, UnitPrice, Discount, WeMaintain_Line_ID__c FROM QuoteLineItem WHERE QuoteId = '${input.sfQuoteId}'`,
  )
  const sentLines: SentLine[] = lines.map((line) => ({
    lineId: line.WeMaintain_Line_ID__c,
    quantity: line.Quantity,
    unitPrice: line.UnitPrice,
    discount: line.Discount,
  }))
  await deps.db.getRepository(QuoteDraftObservationOrmEntity).save({
    draftId: draft.id,
    sfQuoteId: input.sfQuoteId,
    ...observeSentLines(draft.sentLines, sentLines),
    sentLines,
  })
}
