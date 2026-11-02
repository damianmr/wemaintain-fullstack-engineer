import type { Deps } from '../shared/boilerplate/deps'
import { recordQuoteStatus } from '../quotes/commands/record-quote-status'
import { QuoteStatusesSF, QuoteStatusesSFtoDomain } from '../quotes/infrastructure/salesforce/quote-status'
import { registerQuoteChange } from '../work-orders/commands/register-quote-change'

export interface SFQuoteStatusChangeEvent {
  QuoteId__c: string
  From__c?: QuoteStatusesSF
  To__c: QuoteStatusesSF
  CreatedDate?: string
}

interface SFWorkOrderLink {
  RRID__c: string
  Quote__r: { QuoteNumber: string; Status: QuoteStatusesSF }
}

export async function onQuoteStatusChanged(event: SFQuoteStatusChangeEvent, deps: Deps): Promise<void> {
  // A new quote starts in Draft: nothing to record. A quote moved back to Draft is a change: its draft can be edited again.
  if (event.To__c === QuoteStatusesSF.Draft && !event.From__c) return

  const status = QuoteStatusesSFtoDomain[event.To__c]
  if (!status) throw new Error(`Unknown status ${event.To__c} on QuoteStatusChangeEvent__e for ${event.QuoteId__c}`)

  await recordQuoteStatus(
    { quoteId: event.QuoteId__c, status, date: event.CreatedDate ? new Date(event.CreatedDate) : undefined },
    deps,
  )

  const records = await deps.salesforce.query<SFWorkOrderLink>(
    `SELECT Id, RRID__c, Quote__r.QuoteNumber, Quote__r.Status FROM Repair_Request__c WHERE Quote__c = '${event.QuoteId__c}'`,
  )
  for (const record of records) {
    await registerQuoteChange(
      {
        workOrderId: record.RRID__c,
        sfQuoteId: event.QuoteId__c,
        quoteNumber: record.Quote__r.QuoteNumber,
        status: QuoteStatusesSFtoDomain[record.Quote__r.Status],
      },
      deps,
    ).catch((error) => deps.log(`Could not register quote change on work order ${record.RRID__c}: ${error}`))
  }
}
